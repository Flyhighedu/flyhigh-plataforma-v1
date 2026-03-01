'use client';

// =====================================================
// WaitingAuxLoad — "Momento de cargar" screen (Light)
// Shows after pilot completes prep, waits for assistant
// to confirm vehicle loading before advancing.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import SyncHeader from './SyncHeader';

const POLL_INTERVAL_MS = 5000; // 5s polling
const AUX_RELEASE_STATES = new Set(['AUX_CONTAINERS_DONE', 'ROUTE_IN_PROGRESS', 'IN_ROUTE', 'ROUTE_READY']);
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

export default function WaitingAuxLoad({
    journeyId,
    userId,
    profile,
    missionInfo,
    onAuxReady, // Callback when aux finishes checklist → mission_state = AUX_CONTAINERS_DONE
    preview = false,
    onRefresh
}) {
    const [auxName, setAuxName] = useState(null);
    const [auxUserId, setAuxUserId] = useState(null);
    const [auxCheckedIn, setAuxCheckedIn] = useState(false);
    const [auxPrepComplete, setAuxPrepComplete] = useState(false);
    const [auxReady, setAuxReady] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [dotIndex, setDotIndex] = useState(0);
    const [missionState, setMissionState] = useState(null);
    const supabaseRef = useRef(null);
    const channelRef = useRef(null);
    const checkinChannelRef = useRef(null);

    const firstName = profile?.full_name?.split(' ')[0] || 'Operativo';
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';
    const assignedAuxId = missionInfo?.aux_id || null;
    const loadReadyCopy = '¡Manos a la obra! Es momento de trasladar y acomodar los contenedores en el vehículo. Sigue las indicaciones del equipo para una carga segura.';

    // ── Fetch Initial State ──
    const fetchMissionState = useCallback(async () => {
        if (!journeyId) return;
        try {
            const supabase = createClient();
            const { data } = await supabase.from('staff_journeys').select('mission_state').eq('id', journeyId).single();
            if (data) setMissionState(data.mission_state);
        } catch (e) { }
    }, [journeyId]);

    // ── Init supabase ──
    useEffect(() => {
        supabaseRef.current = createClient();
        fetchMissionState();
    }, [fetchMissionState]);

    // ── Online/Offline ──
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // ── Fetch aux name ──
    useEffect(() => {
        if (preview || !journeyId) { setAuxName(null); return; }

        const fetchAuxName = async () => {
            try {
                const supabase = supabaseRef.current;
                if (!supabase) return;

                const { data: auxEvents } = await supabase
                    .from('staff_prep_events')
                    .select('user_id')
                    .eq('journey_id', journeyId)
                    .in('event_type', ['checkin', 'prep_complete'])
                    .neq('user_id', userId)
                    .limit(10);

                if (auxEvents && auxEvents.length > 0) {
                    const auxUserIds = [...new Set(auxEvents.map(e => e.user_id))];
                    const { data: auxProfile } = await supabase
                        .from('staff_profiles')
                        .select('user_id, full_name, role')
                        .in('user_id', auxUserIds)
                        .eq('role', 'assistant')
                        .limit(1)
                        .single();

                    if (auxProfile) {
                        setAuxUserId(auxProfile.user_id || null);
                        setAuxName(auxProfile.full_name?.split(' ')[0] || null);
                        return;
                    }
                }

                // Fallback: any assistant
                const { data: anyAux } = await supabase
                    .from('staff_profiles')
                    .select('user_id, full_name')
                    .eq('role', 'assistant')
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                if (anyAux) {
                    setAuxUserId(anyAux.user_id || null);
                    setAuxName(anyAux.full_name?.split(' ')[0] || null);
                }
            } catch (e) {
                console.warn('Error fetching aux name:', e);
            }
        };

        fetchAuxName();
    }, [journeyId, userId, preview]);

    const checkAuxProgress = useCallback(async () => {
        if (preview || !journeyId) return;

        try {
            const supabase = supabaseRef.current;
            if (!supabase) return;

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
        } catch (e) {
            console.warn('Error checking aux progress:', e);
        }
    }, [assignedAuxId, auxUserId, journeyId, preview]);

    useEffect(() => {
        if (!journeyId || preview) return;

        checkAuxProgress();
    }, [journeyId, preview, assignedAuxId, checkAuxProgress]);

    // ── Realtime subscription on staff_journeys + prep check-ins ──
    useEffect(() => {
        if (!journeyId) return;
        const supabase = supabaseRef.current;
        if (!supabase) return;

        // PREVIEW MODE
        if (preview) {
            const channel = supabase.channel('preview_channel')
                .on('broadcast', { event: 'aux_done' }, (payload) => {
                    setAuxReady(true);
                    if (onAuxReady) setTimeout(() => onAuxReady(), 1200);
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }

        // PRODUCTION MODE
        const channel = supabase
            .channel(`journey_state_aux_${journeyId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'staff_journeys',
                    filter: `id=eq.${journeyId}`
                },
                (payload) => {
                    const newState = payload.new?.mission_state;
                    setMissionState(newState);

                    const knownAuxId = assignedAuxId || auxUserId;
                    if (hasAuxLoadCta(payload.new?.meta, knownAuxId || null)) {
                        setAuxCheckedIn(true);
                        setAuxPrepComplete(true);
                    }

                    if (AUX_RELEASE_STATES.has(newState)) {
                        setAuxReady(true);
                        if (onAuxReady) {
                            setTimeout(() => onAuxReady(), 1200);
                        }
                    }

                    checkAuxProgress();
                }
            )
            .subscribe();

        const checkinChannel = supabase
            .channel(`journey_aux_checkin_${journeyId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'staff_prep_events',
                    filter: `journey_id=eq.${journeyId}`
                },
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

                    checkAuxProgress();
                }
            )
            .subscribe();

        channelRef.current = channel;
        checkinChannelRef.current = checkinChannel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
            if (checkinChannelRef.current) {
                supabase.removeChannel(checkinChannelRef.current);
            }
        };
    }, [journeyId, preview, onAuxReady, assignedAuxId, auxUserId, checkAuxProgress]);

    // ── Polling fallback ──
    const checkMissionState = useCallback(async () => {
        if (preview || !journeyId || !isOnline) return;
        try {
            const supabase = supabaseRef.current;
            if (!supabase) return;

            const { data } = await supabase
                .from('staff_journeys')
                .select('mission_state, meta')
                .eq('id', journeyId)
                .single();

            if (data) {
                setMissionState(data.mission_state);

                const knownAuxId = assignedAuxId || auxUserId;
                if (hasAuxLoadCta(data.meta, knownAuxId || null)) {
                    setAuxCheckedIn(true);
                    setAuxPrepComplete(true);
                }

                if (AUX_RELEASE_STATES.has(data.mission_state)) {
                    setAuxReady(true);
                    if (onAuxReady) {
                        setTimeout(() => onAuxReady(), 1200);
                    }
                }

                if (!auxCheckedIn || !auxPrepComplete) {
                    await checkAuxProgress();
                }
            }
        } catch (e) {
            console.warn('Poll error:', e);
        }
    }, [journeyId, preview, isOnline, onAuxReady, auxCheckedIn, auxPrepComplete, checkAuxProgress, assignedAuxId, auxUserId]);

    useEffect(() => {
        checkMissionState();
        const interval = setInterval(checkMissionState, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [checkMissionState]);

    // Resume polling when back online
    useEffect(() => {
        if (isOnline && !auxReady) {
            checkMissionState();
        }
    }, [isOnline, auxReady, checkMissionState]);

    // ── Animated dots ──
    useEffect(() => {
        const interval = setInterval(() => {
            setDotIndex(prev => (prev + 1) % 4);
        }, 600);
        return () => clearInterval(interval);
    }, []);

    const waitingPrimaryCopy = !auxCheckedIn
        ? 'El auxiliar llegara pronto.'
        : auxPrepComplete
            ? loadReadyCopy
            : 'El auxiliar esta preparando el vehiculo y llegara pronto a la zona de carga.';
    const waitingSecondaryCopy = auxCheckedIn && !auxPrepComplete
        ? 'Vayan acercando los contenedores a la zona de carga para agilizar la carga.'
        : '';

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            background: '#F3F6F8',
            WebkitFontSmoothing: 'antialiased', color: '#1e293b',
            position: 'relative', overflow: 'hidden'
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
                waitPhase="load"
                onDemoStart={onRefresh}
            />

            {/* ════════ OFFLINE BANNER ════════ */}
            {!isOnline && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
                    backgroundColor: '#FEF2F2', color: '#EF4444',
                    padding: '6px 16px', textAlign: 'center',
                    fontSize: 12, fontWeight: 600,
                    borderBottom: '1px solid #FECACA'
                }}>
                    Sin conexión — los datos se guardan localmente
                </div>
            )}

            {/* ════════ MAIN CONTENT ════════ */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 24px', textAlign: 'center',
                overflowY: 'auto'
            }}>
                {/* Animated Cargo-Loading Illustration */}
                <div style={{
                    width: '100%', maxWidth: 320,
                    position: 'relative', marginBottom: 20
                }}>
                    <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
                        <defs>
                            <filter id="wal-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#94a3b8" floodOpacity="0.15" />
                            </filter>
                            <path id="wal-ruta-colocacion" d="M 175 245 L 220 220 L 330 220" />
                        </defs>

                        {/* Fondo */}
                        <rect x="50" y="50" width="500" height="300" rx="150" fill="#f0f5ff" />
                        {/* Suelo */}
                        <line x1="100" y1="310" x2="500" y2="310" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />

                        {/* Camión */}
                        <g id="wal-camion-grupo">
                            <animateTransform attributeName="transform" type="translate"
                                values="0,0; 0,0; 0,4; 0,0; 0,0"
                                keyTimes="0; 0.6; 0.65; 0.75; 1"
                                dur="4s" repeatCount="indefinite" />
                            <line x1="260" y1="310" x2="470" y2="310" stroke="#94a3b8" strokeWidth="10" strokeLinecap="round" opacity="0.4" />
                            {/* Interior */}
                            <rect x="250" y="140" width="140" height="150" rx="12" fill="#e2e8f0" />
                            {/* Chasis */}
                            <path d="M 250 140 L 378 140 Q 390 140 390 152 L 390 278 Q 390 290 378 290 L 250 290"
                                fill="none" stroke="#ffffff" strokeWidth="12" strokeLinejoin="round" filter="url(#wal-soft-shadow)" />
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
                        <g id="wal-caja-equipo">
                            <animateMotion dur="4s" repeatCount="indefinite" keyTimes="0; 0.1; 0.6; 0.9; 1" keyPoints="0; 0; 1; 1; 0" calcMode="linear">
                                <mpath href="#wal-ruta-colocacion" />
                            </animateMotion>
                            <animate attributeName="opacity" values="0; 1; 1; 1; 0" keyTimes="0; 0.05; 0.6; 0.9; 0.95" dur="4s" repeatCount="indefinite" />
                            <rect x="-20" y="-20" width="40" height="40" rx="6" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
                            <line x1="-20" y1="0" x2="20" y2="0" stroke="#d97706" strokeWidth="3" opacity="0.5" />
                            <rect x="-8" y="-20" width="16" height="40" fill="#f59e0b" opacity="0.4" />
                        </g>

                        {/* Operativo */}
                        <g id="wal-operativo">
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
                            <circle cx="0" cy="0" r="24" fill="#10b981" filter="url(#wal-soft-shadow)" />
                            <path d="M -10 -2 L -2 6 L 12 -8" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    </svg>
                </div>

                {/* ── Text block ── */}
                <div style={{ maxWidth: 380 }}>
                    <h2 style={{
                        fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
                        lineHeight: 1.2, marginBottom: 12, color: '#1e293b'
                    }}>
                        {auxReady ? '¡Carga completa!' : 'Momento de cargar'}
                    </h2>
                    <p style={{
                        fontSize: 15, color: '#64748b',
                        lineHeight: 1.6, fontWeight: 400, margin: 0
                    }}>
                        {auxReady ? (
                            'El equipo está verificado. Avanzando...'
                        ) : (
                            waitingPrimaryCopy
                        )}
                    </p>
                    {!auxReady && waitingSecondaryCopy && (
                        <p style={{
                            fontSize: 15,
                            color: '#64748b',
                            lineHeight: 1.6,
                            fontWeight: 500,
                            marginTop: 8,
                            marginBottom: 0
                        }}>
                            {waitingSecondaryCopy}
                        </p>
                    )}
                </div>

                {/* Offline banner (inline) */}
                {!isOnline && (
                    <div style={{
                        marginTop: 20, padding: '10px 16px',
                        backgroundColor: '#FEF2F2',
                        borderRadius: 10, border: '1px solid #FECACA',
                        display: 'flex', alignItems: 'center', gap: 8
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 18, color: '#EF4444',
                            fontVariationSettings: "'FILL' 0, 'wght' 400"
                        }}>wifi_off</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>
                            Sin conexión — reintentando al reconectar
                        </span>
                    </div>
                )}

                {/* Preview: Skip button */}
                {preview && (
                    <div style={{ marginTop: 24 }}>
                        <button
                            onClick={() => {
                                setAuxReady(true);
                                if (onAuxReady) setTimeout(() => onAuxReady(), 1500);
                            }}
                            style={{
                                padding: '12px 32px', borderRadius: 12,
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                color: '#2563EB', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', letterSpacing: '-0.01em'
                            }}
                        >
                            Simular confirmación del Auxiliar
                        </button>
                    </div>
                )}
            </main>

            {/* ════════ FOOTER ════════ */}
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
                        fontSize: 20, color: '#2563EB',
                        fontVariationSettings: "'FILL' 1, 'wght' 400"
                    }}>verified_user</span>
                    <span>No cierres la app (los datos se guardan)</span>
                </div>
            </div>

            {/* ════════ SUCCESS OVERLAY ════════ */}
            {auxReady && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(34,197,94,0.92)',
                    backdropFilter: 'blur(8px)', color: 'white',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        backgroundColor: 'white', color: '#22c55e',
                        borderRadius: '50%', padding: 20, marginBottom: 20,
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)'
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 44, fontVariationSettings: "'FILL' 1, 'wght' 700"
                        }}>check</span>
                    </div>
                    <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
                        ¡Vehículo cargado!
                    </h2>
                    <p style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                        Todo listo para la operación
                    </p>
                </div>
            )}
        </div>
    );
}
