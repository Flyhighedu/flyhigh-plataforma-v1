'use client';

// =====================================================
// TeacherWaitingScreen.js
// Pantallas de estado dinámicas para el Docente
// 1. Apoyo en bodega (Light) -> Initial/Default
// 2. Momento de cargar (Light) -> Pilot Ready + auto-advance to route
// =====================================================

import { useState, useEffect, useCallback } from 'react';

import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import SyncHeader from './SyncHeader';

const POLL_INTERVAL_MS = 5000;
const AUX_LOAD_WAIT_STATES = new Set(['WAITING_AUX_VEHICLE_CHECK', 'PILOT_READY_FOR_LOAD']);
const AUX_RELEASE_STATES = new Set(['AUX_CONTAINERS_DONE', 'ROUTE_READY', 'IN_ROUTE', 'ROUTE_IN_PROGRESS']);
const AUX_ROLE_VALUES = new Set(['assistant', 'auxiliar', 'aux']);

function normalizeJourneyMeta(meta) {
    if (!meta) return {};
    if (typeof meta === 'string') {
        try {
            const parsed = JSON.parse(meta);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    if (typeof meta === 'object' && !Array.isArray(meta)) {
        return meta;
    }

    return {};
}

function isAssistantPayloadRole(payloadRole) {
    const normalized = String(payloadRole || '').toLowerCase();
    return !normalized || AUX_ROLE_VALUES.has(normalized);
}

function hasAuxLoadCta(meta, targetAuxId = null) {
    const safeMeta = normalizeJourneyMeta(meta);
    const ctaBy = safeMeta.aux_load_cta_by;
    const ctaAt = safeMeta.aux_load_cta_at;

    if (!ctaAt && !ctaBy) return false;
    if (targetAuxId && ctaBy && ctaBy !== targetAuxId) return Boolean(ctaAt);
    return Boolean(ctaAt || ctaBy);
}

export default function TeacherWaitingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    onRouteStarted,
    preview = false,
    onRefresh
}) {
    const [missionState, setMissionState] = useState('TEACHER_SUPPORTING_PILOT');
    const [auxUserId, setAuxUserId] = useState(null);
    const [auxCheckedIn, setAuxCheckedIn] = useState(false);
    const [auxPrepComplete, setAuxPrepComplete] = useState(false);
    const [dotIndex, setDotIndex] = useState(0);

    const firstName = profile?.full_name?.split(' ')[0] || 'Docente';
    const roleName = ROLE_LABELS[profile?.role] || 'Docente';
    const assignedAuxId = missionInfo?.aux_id || null;
    const loadReadyCopy = '¡Manos a la obra! Es momento de trasladar y acomodar los contenedores en el vehículo. Sigue las indicaciones del equipo para una carga segura.';

    const checkAuxProgress = useCallback(async (clientOverride = null) => {
        if (preview || !journeyId) return;

        try {
            const supabase = clientOverride || createClient();

            const { data: journeySnapshot } = await supabase
                .from('staff_journeys')
                .select('mission_state, meta')
                .eq('id', journeyId)
                .maybeSingle();

            if (journeySnapshot?.mission_state) {
                setMissionState(journeySnapshot.mission_state);
            }

            const journeyMeta = normalizeJourneyMeta(journeySnapshot?.meta);
            const ctaByMeta = journeyMeta.aux_load_cta_by || null;
            const hasJourneyCta = hasAuxLoadCta(journeyMeta);

            const { data: allCheckins } = await supabase
                .from('staff_prep_events')
                .select('user_id, created_at')
                .eq('journey_id', journeyId)
                .eq('event_type', 'checkin')
                .order('created_at', { ascending: false })
                .limit(25);

            const { data: allPrepCompleteEvents } = await supabase
                .from('staff_prep_events')
                .select('user_id, payload, created_at')
                .eq('journey_id', journeyId)
                .eq('event_type', 'prep_complete')
                .order('created_at', { ascending: false })
                .limit(25);

            const latestAuxPrepComplete = (allPrepCompleteEvents || []).find((eventRow) => {
                return isAssistantPayloadRole(eventRow?.payload?.role);
            });

            let targetAuxId = ctaByMeta || assignedAuxId || latestAuxPrepComplete?.user_id || auxUserId || null;

            if (!targetAuxId) {
                const candidateIds = [...new Set((allCheckins || []).map((entry) => entry.user_id).filter(Boolean))];

                if (candidateIds.length > 0) {
                    const { data: auxProfile } = await supabase
                        .from('staff_profiles')
                        .select('user_id')
                        .in('user_id', candidateIds)
                        .eq('role', 'assistant')
                        .limit(1)
                        .maybeSingle();

                    if (auxProfile?.user_id) {
                        targetAuxId = auxProfile.user_id;
                    }
                }
            }

            if (targetAuxId) {
                setAuxUserId((prev) => (prev === targetAuxId ? prev : targetAuxId));
            }

            if (!targetAuxId) {
                setAuxCheckedIn(Boolean(hasJourneyCta));
                setAuxPrepComplete(hasJourneyCta || Boolean(latestAuxPrepComplete));
                return;
            }

            const hasAuxCheckIn = (allCheckins || []).some((entry) => entry?.user_id === targetAuxId);
            const hasAuxPrepCompleteForTarget = (allPrepCompleteEvents || []).some((eventRow) => {
                if (eventRow?.user_id !== targetAuxId) return false;
                return isAssistantPayloadRole(eventRow?.payload?.role);
            });

            const hasJourneyCtaForTarget = hasAuxLoadCta(journeyMeta, targetAuxId);

            setAuxCheckedIn(hasAuxCheckIn || hasJourneyCtaForTarget);
            setAuxPrepComplete(hasJourneyCtaForTarget || hasAuxPrepCompleteForTarget);
        } catch (error) {
            console.warn('Error checking aux progress for teacher wait screen:', error);
        }
    }, [assignedAuxId, auxUserId, journeyId, preview]);

    // Subscripción a cambios de estado en tiempo real
    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();

        const fetchInitialState = async () => {
            const { data } = await supabase
                .from('staff_journeys')
                .select('mission_state')
                .eq('id', journeyId)
                .single();
            if (data?.mission_state) setMissionState(data.mission_state);
            await checkAuxProgress(supabase);
        };
        fetchInitialState();

        const channel = supabase
            .channel(`teacher_sync_${journeyId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'staff_journeys', filter: `id=eq.${journeyId}` },
                (payload) => {
                    const newState = payload.new?.mission_state;
                    if (newState) {
                        setMissionState(newState);

                        const knownAuxId = assignedAuxId || auxUserId;
                        if (hasAuxLoadCta(payload.new?.meta, knownAuxId || null)) {
                            setAuxCheckedIn(true);
                            setAuxPrepComplete(true);
                        }

                        // Auto-advance logic: if state is ready for route, trigger completion
                        if (AUX_RELEASE_STATES.has(newState)) {
                            if (!preview && onRouteStarted) {
                                setTimeout(() => onRouteStarted(), 1500);
                            }
                        }

                        checkAuxProgress(supabase);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'staff_prep_events', filter: `journey_id=eq.${journeyId}` },
                (payload) => {
                    const eventType = payload.new?.event_type;
                    if (eventType !== 'checkin' && eventType !== 'prep_complete') return;

                    if (eventType === 'prep_complete') {
                        if (!isAssistantPayloadRole(payload.new?.payload?.role)) {
                            return;
                        }
                    }

                    const knownAuxId = assignedAuxId || auxUserId;
                    if (knownAuxId && payload.new?.user_id === knownAuxId) {
                        if (eventType === 'checkin') {
                            setAuxCheckedIn(true);
                        }

                        if (eventType === 'prep_complete') {
                            setAuxPrepComplete(true);
                        }

                        return;
                    }

                    checkAuxProgress(supabase);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [journeyId, preview, onRouteStarted, assignedAuxId, auxUserId, checkAuxProgress]);

    useEffect(() => {
        if (preview || !journeyId || (auxCheckedIn && auxPrepComplete) || !AUX_LOAD_WAIT_STATES.has(missionState)) return;

        const supabase = createClient();
        const interval = setInterval(() => {
            checkAuxProgress(supabase);
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [preview, journeyId, missionState, auxCheckedIn, auxPrepComplete, checkAuxProgress]);

    // Polling fallback / Initial state auto-advance
    useEffect(() => {
        if (!preview && AUX_RELEASE_STATES.has(missionState)) {
            if (onRouteStarted) {
                const timer = setTimeout(() => onRouteStarted(), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [missionState, preview, onRouteStarted]);

    // Animación de puntos
    useEffect(() => {
        const interval = setInterval(() => {
            setDotIndex(prev => (prev + 1) % 3);
        }, 600);
        return () => clearInterval(interval);
    }, []);




    // --- UI DETERMINATION ---
    let title = "";
    let subtitle = "";
    let subtitleSecondary = "";
    let waitPhase = 'warehouse'; // 'warehouse' | 'load'

    if (missionState === 'AUX_CONTAINERS_DONE' || missionState === 'ROUTE_READY' || missionState === 'ROUTE_IN_PROGRESS' || missionState === 'IN_ROUTE'
        || missionState === 'WAITING_AUX_VEHICLE_CHECK' || missionState === 'PILOT_READY_FOR_LOAD') {
        // FASE 2: Momento de cargar (stays visible during auto-advance)
        title = "Momento de cargar";
        if (AUX_LOAD_WAIT_STATES.has(missionState)) {
            if (!auxCheckedIn) {
                subtitle = 'El auxiliar llegara pronto.';
            } else if (!auxPrepComplete) {
                subtitle = 'El auxiliar esta preparando el vehiculo y llegara pronto a la zona de carga.';
                subtitleSecondary = 'Vayan acercando los contenedores a la zona de carga para agilizar la carga.';
            } else {
                subtitle = loadReadyCopy;
            }
        } else {
            subtitle = loadReadyCopy;
        }
        waitPhase = 'load';
    } else {
        // FASE 1: Apoyo en bodega (Light)
        title = "Apoyo en bodega";
        subtitle = "Mientras se termina la verificación electrónica, ayuda a acomodar contenedores y preparar la carga. Te avisaremos automáticamente.";
        waitPhase = 'warehouse';
    }

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#F3F6F8',
            color: '#1e293b',
            minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase={waitPhase === 'route' ? 'load' : waitPhase}
                onDemoStart={onRefresh}
            />

            {/* Main Content */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 24px', textAlign: 'center',
                overflowY: 'auto'
            }}>

                {/* ── Illustration ── */}
                {waitPhase === 'warehouse' ? (
                    /* Phase 1: Warehouse SVG */
                    <div style={{
                        width: '100%', maxWidth: 260,
                        aspectRatio: '1 / 1',
                        position: 'relative', marginBottom: 20
                    }}>
                        <div style={{
                            position: 'absolute', inset: 16,
                            background: 'linear-gradient(135deg, #DBEAFE 0%, #EEF2FF 100%)',
                            borderRadius: '50%', filter: 'blur(40px)', opacity: 0.7
                        }} />
                        <svg style={{ width: '100%', height: '100%', position: 'relative', filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.08))' }} fill="none" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="200" cy="200" r="140" fill="#EBF5FF" />
                            <rect x="80" y="100" width="240" height="200" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="4" />
                            <line x1="80" y1="170" x2="320" y2="170" stroke="#CBD5E1" strokeWidth="4" />
                            <line x1="80" y1="240" x2="320" y2="240" stroke="#CBD5E1" strokeWidth="4" />
                            <g transform="translate(180, 160)">
                                <path d="M20 80C20 80 5 85 5 110V140H75V110C75 85 60 80 60 80" fill="#3B82F6" />
                                <circle cx="40" cy="55" r="25" fill="#FFD7BA" />
                                <path d="M10 50C10 33.4315 23.4315 20 40 20C56.5685 20 70 33.4315 70 50H10Z" fill="#1D4ED8" />
                                <rect x="65" y="45" width="20" height="5" rx="2.5" fill="#1D4ED8" />
                                <circle cx="48" cy="52" r="2" fill="#1E293B" />
                                <path d="M42 62C42 62 45 65 48 62" stroke="#1E293B" strokeLinecap="round" strokeWidth="2" />
                            </g>
                            <g transform="translate(100, 120)">
                                <rect width="50" height="46" rx="4" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2" />
                                <path d="M10 10L25 25L40 10" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" />
                                <line x1="25" y1="25" x2="25" y2="46" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" />
                            </g>
                            <g transform="translate(240, 190)">
                                <rect width="60" height="46" rx="4" fill="#93C5FD" stroke="#3B82F6" strokeWidth="2" />
                                <path d="M10 10L30 25L50 10" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
                                <line x1="30" y1="25" x2="30" y2="46" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
                            </g>
                            <g transform="translate(170, 230)">
                                <rect width="70" height="55" rx="6" fill="#FBA778" stroke="#EA580C" strokeWidth="2" />
                                <path d="M10 10L35 30L60 10" stroke="#EA580C" strokeOpacity="0.3" strokeWidth="2" />
                                <line x1="35" y1="30" x2="35" y2="55" stroke="#EA580C" strokeOpacity="0.3" strokeWidth="2" />
                                <rect x="20" y="35" width="30" height="10" rx="2" fill="white" fillOpacity="0.8" />
                                <line x1="25" y1="40" x2="45" y2="40" stroke="#CBD5E1" strokeWidth="2" />
                            </g>
                            <circle cx="170" cy="260" r="12" fill="#FFD7BA" />
                            <circle cx="240" cy="260" r="12" fill="#FFD7BA" />
                            <circle className="animate-pulse" cx="340" cy="100" r="8" fill="#F472B6" />
                            <path d="M50 320L60 310L70 320" stroke="#3B82F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                        </svg>
                    </div>
                ) : (
                    /* Phase 2: Animated cargo-loading SVG */
                    <div style={{
                        width: '100%', maxWidth: 320,
                        position: 'relative', marginBottom: 20
                    }}>
                        <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
                            <defs>
                                <filter id="tws-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#94a3b8" floodOpacity="0.15" />
                                </filter>
                                <path id="tws-ruta-colocacion" d="M 175 245 L 220 220 L 330 220" />
                            </defs>

                            {/* Fondo */}
                            <rect x="50" y="50" width="500" height="300" rx="150" fill="#f0f5ff" />
                            {/* Suelo */}
                            <line x1="100" y1="310" x2="500" y2="310" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />

                            {/* Camión */}
                            <g id="tws-camion-grupo">
                                <animateTransform attributeName="transform" type="translate"
                                    values="0,0; 0,0; 0,4; 0,0; 0,0"
                                    keyTimes="0; 0.6; 0.65; 0.75; 1"
                                    dur="4s" repeatCount="indefinite" />
                                <line x1="260" y1="310" x2="470" y2="310" stroke="#94a3b8" strokeWidth="10" strokeLinecap="round" opacity="0.4" />
                                {/* Interior */}
                                <rect x="250" y="140" width="140" height="150" rx="12" fill="#e2e8f0" />
                                {/* Chasis */}
                                <path d="M 250 140 L 378 140 Q 390 140 390 152 L 390 278 Q 390 290 378 290 L 250 290"
                                    fill="none" stroke="#ffffff" strokeWidth="12" strokeLinejoin="round" filter="url(#tws-soft-shadow)" />
                                <path d="M 250 140 L 378 140 Q 390 140 390 152 L 390 278 Q 390 290 378 290 L 250 290"
                                    fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinejoin="round" />
                                {/* Cabina */}
                                <path d="M 380 180 L 450 180 Q 470 180 475 200 L 485 240 Q 490 250 490 260 L 490 280 Q 490 290 480 290 L 380 290 Z"
                                    fill="#3b82f6" stroke="#2563eb" strokeWidth="4" strokeLinejoin="round" />
                                <path d="M 390 190 L 445 190 Q 455 190 460 200 L 470 230 Q 472 235 465 235 L 390 235 Z"
                                    fill="#bfdbfe" stroke="#93c5fd" strokeWidth="3" strokeLinejoin="round" />
                                <rect x="475" y="260" width="10" height="15" rx="5" fill="#fef08a" />
                                <line x1="410" y1="250" x2="425" y2="250" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" />
                                {/* Ruedas */}
                                <g transform="translate(300, 290)">
                                    <circle cx="0" cy="0" r="22" fill="#1e293b" /><circle cx="0" cy="0" r="10" fill="#cbd5e1" />
                                </g>
                                <g transform="translate(430, 290)">
                                    <circle cx="0" cy="0" r="22" fill="#1e293b" /><circle cx="0" cy="0" r="10" fill="#cbd5e1" />
                                </g>
                            </g>

                            {/* Caja animada */}
                            <g id="tws-caja-equipo">
                                <animateMotion dur="4s" repeatCount="indefinite" keyTimes="0; 0.1; 0.6; 0.9; 1" keyPoints="0; 0; 1; 1; 0" calcMode="linear">
                                    <mpath href="#tws-ruta-colocacion" />
                                </animateMotion>
                                <animate attributeName="opacity" values="0; 1; 1; 1; 0" keyTimes="0; 0.05; 0.6; 0.9; 0.95" dur="4s" repeatCount="indefinite" />
                                <rect x="-20" y="-20" width="40" height="40" rx="6" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
                                <line x1="-20" y1="0" x2="20" y2="0" stroke="#d97706" strokeWidth="3" opacity="0.5" />
                                <rect x="-8" y="-20" width="16" height="40" fill="#f59e0b" opacity="0.4" />
                            </g>

                            {/* Operativo */}
                            <g id="tws-operativo">
                                <ellipse cx="150" cy="310" rx="20" ry="4" fill="#94a3b8" opacity="0.4" />
                                <line x1="140" y1="260" x2="140" y2="310" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                                <line x1="160" y1="260" x2="160" y2="310" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                                <rect x="125" y="200" width="50" height="65" rx="16" fill="#3b82f6" />
                                <path d="M 140 200 L 140 265" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
                                <path d="M 160 200 L 160 265" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
                                <rect x="142" y="185" width="16" height="20" rx="8" fill="#fcd34d" />
                                <circle cx="150" cy="170" r="22" fill="#fde68a" />
                                <circle cx="158" cy="165" r="3" fill="#475569" /><circle cx="142" cy="165" r="3" fill="#475569" />
                                <path d="M 144 175 Q 150 182 156 175" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
                                <path d="M 128 160 A 22 22 0 0 1 172 160 Z" fill="#1e3a8a" />
                                <line x1="160" y1="160" x2="180" y2="160" stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" />
                                {/* Brazos animados */}
                                <g>
                                    <animateTransform attributeName="transform" type="rotate"
                                        values="-20 150 215; -35 150 215; -35 150 215; -20 150 215; -20 150 215"
                                        keyTimes="0; 0.2; 0.6; 0.8; 1"
                                        dur="4s" repeatCount="indefinite" />
                                    <line x1="150" y1="215" x2="175" y2="245" stroke="#60a5fa" strokeWidth="14" strokeLinecap="round" />
                                    <circle cx="175" cy="245" r="7" fill="#fcd34d" />
                                </g>
                            </g>

                            {/* Checkmark de confirmación */}
                            <g transform="translate(320, 180)">
                                <animateTransform attributeName="transform" type="translate"
                                    values="320,190; 320,180; 320,180; 320,190"
                                    keyTimes="0; 0.6; 0.7; 1"
                                    dur="4s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.6; 0.65; 0.9; 0.95" dur="4s" repeatCount="indefinite" />
                                <circle cx="0" cy="0" r="24" fill="#10b981" filter="url(#tws-soft-shadow)" />
                                <path d="M -10 -2 L -2 6 L 12 -8" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                        </svg>
                    </div>
                )}

                {/* ── Text block ── */}
                <div style={{ maxWidth: 380 }}>
                    <h2 style={{
                        fontSize: 26, fontWeight: 700,
                        color: '#1e293b',
                        letterSpacing: '-0.02em', lineHeight: 1.2,
                        marginBottom: 12
                    }}>
                        {title}
                    </h2>

                    {waitPhase === 'warehouse' ? (
                        <>
                            <p style={{
                                fontSize: 15, color: '#64748b',
                                lineHeight: 1.6, fontWeight: 400, margin: 0
                            }}>
                                Mientras se termina la verificación electrónica, ayuda a acomodar contenedores y preparar la carga.
                            </p>
                            <p style={{
                                fontSize: 15, color: '#64748b',
                                lineHeight: 1.6, fontWeight: 500,
                                marginTop: 8
                            }}>
                                Te avisaremos automáticamente.
                            </p>
                        </>
                    ) : (
                        <>
                            <p style={{
                                fontSize: 15, color: '#64748b',
                                lineHeight: 1.6, fontWeight: 400, margin: 0
                            }}>
                                {subtitle}
                            </p>
                            {subtitleSecondary && (
                                <p style={{
                                    fontSize: 15,
                                    color: '#64748b',
                                    lineHeight: 1.6,
                                    fontWeight: 500,
                                    marginTop: 8,
                                    marginBottom: 0
                                }}>
                                    {subtitleSecondary}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* ── Footer ── */}
            <div style={{
                padding: '8px 24px 32px',
                background: 'linear-gradient(to top, #F3F6F8 80%, transparent)',
                flexShrink: 0
            }}>
                <div style={{
                    backgroundColor: 'white', borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 12,
                    fontSize: 14, fontWeight: 500, color: '#475569'
                }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 20, color: '#22C55E',
                        fontVariationSettings: "'FILL' 1, 'wght' 400"
                    }}>verified_user</span>
                    <span>No cierres la app (los datos se guardan)</span>
                </div>
            </div>
        </div>
    );
}
