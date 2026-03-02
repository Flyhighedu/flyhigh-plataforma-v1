'use client';

// =====================================================
// AuxWaitingScreen — "Apoyo en bodega" (Purple)
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
    preview = false
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
                if (data.mission_state === 'WAITING_AUX_VEHICLE_CHECK' || data.mission_state === 'PILOT_READY_FOR_LOAD' || data.mission_state === 'AUX_CONTAINERS_DONE') {
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
            background: 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)', // FlyHigh Purple
            WebkitFontSmoothing: 'antialiased', color: 'white',
            position: 'relative'
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
            />

            {/* ── MAIN CONTENT ── */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 24px', textAlign: 'center',
                position: 'relative', zIndex: 10
            }}>
                {/* Main Icon in White Card */}
                <div style={{
                    position: 'relative', marginBottom: 32
                }}>
                    <div style={{ position: 'absolute', inset: -30, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%', filter: 'blur(60px)' }} />
                    <div style={{
                        position: 'relative', width: 200, height: 200, borderRadius: 24,
                        backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 80, color: '#7C3AED', // Purple Icon
                            fontVariationSettings: "'FILL' 0, 'wght' 300"
                        }}>
                            inventory_2
                        </span>
                    </div>
                </div>

                {pilotReady ? (
                    <>
                        <h1 style={{
                            fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
                            lineHeight: 1.2, margin: '0 0 12px', color: 'white'
                        }}>
                            ¡Piloto listo!
                        </h1>
                        <p style={{
                            fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                            lineHeight: 1.5, maxWidth: 280
                        }}>
                            Avanzando a la siguiente fase...
                        </p>
                    </>
                ) : (
                    <>
                        <h1 style={{
                            fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
                            lineHeight: 1.2, margin: '0 0 12px', color: 'white'
                        }}>
                            Apoyo en bodega
                        </h1>
                        <p style={{
                            fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                            lineHeight: 1.5, maxWidth: 300
                        }}>
                            Mientras se termina la verificación electrónica, ayuda a acomodar contenedores y preparar la carga. Te avisaremos automáticamente.
                        </p>
                    </>
                )}

                {/* School info */}
                {missionInfo?.school_name && (
                    <div style={{
                        marginTop: 32, padding: '14px 20px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: 14, backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="material-symbols-outlined" style={{
                                fontSize: 20, color: 'rgba(255,255,255,0.7)',
                                fontVariationSettings: "'FILL' 0, 'wght' 300"
                            }}>
                                school
                            </span>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>
                                    {missionInfo.school_name}
                                </p>
                                {missionInfo.colonia && (
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>
                                        {missionInfo.colonia}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Offline banner */}
                {!isOnline && (
                    <div style={{
                        marginTop: 20, padding: '10px 16px',
                        backgroundColor: 'rgba(239,68,68,0.2)',
                        borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                        display: 'flex', alignItems: 'center', gap: 8
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 18, color: '#fca5a5',
                            fontVariationSettings: "'FILL' 0, 'wght' 400"
                        }}>
                            wifi_off
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5' }}>
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
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.4)',
                                color: 'white', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', letterSpacing: '-0.01em'
                            }}
                        >
                            Simular: Piloto terminó verificación
                        </button>
                    </div>
                )}
            </main>

            {/* ── FOOTER ── */}
            <footer style={{
                padding: '20px 24px 40px',
                textAlign: 'center', position: 'relative', zIndex: 10
            }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>verified_user</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.01em' }}>No cierres la app (los datos se guardan)</p>
                </div>
                <div style={{ marginTop: 32, width: 134, height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 999, margin: '32px auto 0' }} />
            </footer>
        </div>
    );
}
