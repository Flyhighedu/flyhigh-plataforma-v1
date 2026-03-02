'use client';

// =====================================================
// AuxWaitingScreen — "Apoyo en bodega" (Light)
// Replaces "En preparación"
// Waits for pilot to be ready.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import SyncHeader from './SyncHeader';

const POLL_INTERVAL_MS = 5000; // 5s polling

export default function AuxWaitingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    onPilotReady,    // callback when pilot finishes prep → mission_state = WAITING_AUX_VEHICLE_CHECK
    preview = false,
    onRefresh
}) {
    const [pilotName, setPilotName] = useState(null);
    const [pilotReady, setPilotReady] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [dotIndex, setDotIndex] = useState(0);
    const [missionState, setMissionState] = useState(null); // Local state for sync header
    const supabaseRef = useRef(null);
    const channelRef = useRef(null);

    const firstName = profile?.full_name?.split(' ')[0] || 'Auxiliar';
    const roleName = ROLE_LABELS[profile?.role] || 'Auxiliar';

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

    // ── Fetch pilot name ──
    useEffect(() => {
        if (preview || !journeyId) { setPilotName(null); return; }

        const fetchPilotName = async () => {
            try {
                const supabase = supabaseRef.current;
                if (!supabase) return;

                // Look for pilot's check-in event
                const { data: pilotEvents } = await supabase
                    .from('staff_prep_events')
                    .select('user_id')
                    .eq('journey_id', journeyId)
                    .in('event_type', ['checkin', 'prep_complete'])
                    .neq('user_id', userId)
                    .limit(5);

                if (pilotEvents && pilotEvents.length > 0) {
                    const pilotUserIds = [...new Set(pilotEvents.map(e => e.user_id))];
                    const { data: pilotProfile } = await supabase
                        .from('staff_profiles')
                        .select('full_name, role')
                        .in('user_id', pilotUserIds)
                        .eq('role', 'pilot')
                        .limit(1)
                        .single();

                    if (pilotProfile) {
                        setPilotName(pilotProfile.full_name?.split(' ')[0] || null);
                        return;
                    }
                }

                // Fallback: any pilot
                const { data: anyPilot } = await supabase
                    .from('staff_profiles')
                    .select('full_name')
                    .eq('role', 'pilot')
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                if (anyPilot) {
                    setPilotName(anyPilot.full_name?.split(' ')[0] || null);
                }
            } catch (e) {
                console.warn('Error fetching pilot name:', e);
            }
        };

        fetchPilotName();
    }, [journeyId, userId, preview]);

    // ── Realtime subscription on staff_journeys ──
    useEffect(() => {
        if (!journeyId) return;
        const supabase = supabaseRef.current;
        if (!supabase) return;

        // PREVIEW MODE: Use Broadcast channel
        if (preview) {
            const channel = supabase.channel('preview_channel')
                .on('broadcast', { event: 'pilot_done' }, (payload) => {
                    console.log('Preview: Pilot done signal received', payload);
                    setPilotReady(true);
                    if (onPilotReady) setTimeout(() => onPilotReady(), 1200);
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }

        // PRODUCTION MODE: Postgres Changes
        console.log(`🔌 Subscribing to journey_state_${journeyId}`);
        const channel = supabase
            .channel(`journey_state_${journeyId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'staff_journeys',
                    filter: `id=eq.${journeyId}`
                },
                (payload) => {
                    console.log('⚡ Realtime update received:', payload);
                    const newState = payload.new?.mission_state;
                    setMissionState(newState);
                    if (newState === 'WAITING_AUX_VEHICLE_CHECK' || newState === 'PILOT_READY_FOR_LOAD' || newState === 'AUX_CONTAINERS_DONE' || newState === 'OPERATION') {
                        setPilotReady(true);
                        if (onPilotReady) {
                            setTimeout(() => onPilotReady(), 1200);
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`🔌 Subscription status for ${journeyId}:`, status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [journeyId, preview, onPilotReady]);

    // ── Polling fallback ──
    const checkMissionState = useCallback(async () => {
        if (preview || !journeyId || !isOnline) return;
        try {
            const supabase = supabaseRef.current;
            if (!supabase) return;

            const { data } = await supabase
                .from('staff_journeys')
                .select('mission_state')
                .eq('id', journeyId)
                .single();

            if (data) {
                setMissionState(data.mission_state);
                if (data.mission_state === 'WAITING_AUX_VEHICLE_CHECK' || data.mission_state === 'PILOT_READY_FOR_LOAD' || data.mission_state === 'AUX_CONTAINERS_DONE' || data.mission_state === 'ROUTE_READY') {
                    console.log('📡 Polling found ready state:', data.mission_state);
                    setPilotReady(true);
                    if (onPilotReady) {
                        setTimeout(() => onPilotReady(), 1200);
                    }
                }
            }
        } catch (e) {
            console.warn('Poll error:', e);
        }
    }, [journeyId, preview, isOnline, onPilotReady]);

    useEffect(() => {
        checkMissionState();
        const interval = setInterval(checkMissionState, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [checkMissionState]);

    // ── Animated dots ──
    useEffect(() => {
        const interval = setInterval(() => {
            setDotIndex(prev => (prev + 1) % 3);
        }, 600);
        return () => clearInterval(interval);
    }, []);

    const displayPilotName = pilotName || 'el Piloto';

    // ── Stepper ──
    const NAV_STEPS = [
        { id: 'informe', label: 'INFORME', status: 'completed' },
        { id: 'preparacion', label: 'MONTAJE', status: 'active' },
        { id: 'carga', label: 'CARGA', status: 'pending' },
        { id: 'operacion', label: 'OPERACIÓN', status: 'pending' },
    ];

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
                navSteps={NAV_STEPS}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="warehouse"
                onDemoStart={onRefresh}
            />

            {/* ── MAIN CONTENT ── */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 24px', textAlign: 'center',
                position: 'relative', zIndex: 10,
                overflowY: 'auto'
            }}>
                {/* SVG Warehouse Illustration */}
                <div style={{
                    width: '100%', maxWidth: 260,
                    aspectRatio: '1 / 1',
                    position: 'relative', marginBottom: 20
                }}>
                    {/* Soft glow */}
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
                        {/* Person */}
                        <g transform="translate(180, 160)">
                            <path d="M20 80C20 80 5 85 5 110V140H75V110C75 85 60 80 60 80" fill="#3B82F6" />
                            <circle cx="40" cy="55" r="25" fill="#FFD7BA" />
                            <path d="M10 50C10 33.4315 23.4315 20 40 20C56.5685 20 70 33.4315 70 50H10Z" fill="#1D4ED8" />
                            <rect x="65" y="45" width="20" height="5" rx="2.5" fill="#1D4ED8" />
                            <circle cx="48" cy="52" r="2" fill="#1E293B" />
                            <path d="M42 62C42 62 45 65 48 62" stroke="#1E293B" strokeLinecap="round" strokeWidth="2" />
                        </g>
                        {/* Yellow box */}
                        <g transform="translate(100, 120)">
                            <rect width="50" height="46" rx="4" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2" />
                            <path d="M10 10L25 25L40 10" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" />
                            <line x1="25" y1="25" x2="25" y2="46" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" />
                        </g>
                        {/* Blue box */}
                        <g transform="translate(240, 190)">
                            <rect width="60" height="46" rx="4" fill="#93C5FD" stroke="#3B82F6" strokeWidth="2" />
                            <path d="M10 10L30 25L50 10" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
                            <line x1="30" y1="25" x2="30" y2="46" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
                        </g>
                        {/* Orange box */}
                        <g transform="translate(170, 230)">
                            <rect width="70" height="55" rx="6" fill="#FBA778" stroke="#EA580C" strokeWidth="2" />
                            <path d="M10 10L35 30L60 10" stroke="#EA580C" strokeOpacity="0.3" strokeWidth="2" />
                            <line x1="35" y1="30" x2="35" y2="55" stroke="#EA580C" strokeOpacity="0.3" strokeWidth="2" />
                            <rect x="20" y="35" width="30" height="10" rx="2" fill="white" fillOpacity="0.8" />
                            <line x1="25" y1="40" x2="45" y2="40" stroke="#CBD5E1" strokeWidth="2" />
                        </g>
                        {/* Hands */}
                        <circle cx="170" cy="260" r="12" fill="#FFD7BA" />
                        <circle cx="240" cy="260" r="12" fill="#FFD7BA" />
                        {/* Pink accent dot */}
                        <circle className="animate-pulse" cx="340" cy="100" r="8" fill="#F472B6" />
                        {/* Arrow */}
                        <path d="M50 320L60 310L70 320" stroke="#3B82F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                    </svg>
                </div>

                {/* ── Text block ── */}
                <div style={{ maxWidth: 380 }}>
                    {pilotReady ? (
                        <>
                            <h2 style={{
                                fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em',
                                lineHeight: 1.2, marginBottom: 16, color: '#1e293b'
                            }}>
                                ¡Piloto listo!
                            </h2>
                            <p style={{
                                fontSize: 18, color: '#64748b',
                                lineHeight: 1.6, fontWeight: 400, margin: 0
                            }}>
                                Avanzando a la siguiente fase...
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 style={{
                                fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
                                lineHeight: 1.2, marginBottom: 12, color: '#1e293b'
                            }}>
                                Apoyo en bodega
                            </h2>
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
                    )}
                </div>

                {/* Offline banner */}
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
                        }}>
                            wifi_off
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444' }}>
                            Sin conexión — reintentando al reconectar
                        </span>
                    </div>
                )}

                {preview && !pilotReady && (
                    <div style={{ marginTop: 24 }}>
                        <button
                            onClick={() => {
                                setPilotReady(true);
                                if (onPilotReady) setTimeout(() => onPilotReady(), 1200);
                            }}
                            style={{
                                padding: '12px 32px', borderRadius: 12,
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                color: '#2563EB', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', letterSpacing: '-0.01em'
                            }}
                        >
                            Simular: Piloto terminó verificación
                        </button>
                    </div>
                )}
            </main>

            {/* ── FOOTER ── */}
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
