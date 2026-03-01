'use client';

// =====================================================
// WaitingAuxLoad — "Momento de cargar" screen
// Shows after pilot completes prep, waits for assistant
// to confirm vehicle loading before advancing.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import SyncHeader from './SyncHeader';

const POLL_INTERVAL_MS = 5000; // 5s polling

export default function WaitingAuxLoad({
    journeyId,
    userId,
    profile,
    missionInfo,
    onAuxReady, // Callback when aux finishes checklist → mission_state = AUX_CONTAINERS_DONE
    preview = false
}) {
    const [auxName, setAuxName] = useState(null);
    const [auxReady, setAuxReady] = useState(false);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [dotIndex, setDotIndex] = useState(0);
    const [missionState, setMissionState] = useState(null); // Local state for sync header
    const supabaseRef = useRef(null);
    const channelRef = useRef(null);

    const firstName = profile?.full_name?.split(' ')[0] || 'Operativo';
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

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
                        .select('full_name, role')
                        .in('user_id', auxUserIds)
                        .eq('role', 'assistant')
                        .limit(1)
                        .single();

                    if (auxProfile) {
                        setAuxName(auxProfile.full_name?.split(' ')[0] || null);
                        return;
                    }
                }

                // Fallback: any assistant
                const { data: anyAux } = await supabase
                    .from('staff_profiles')
                    .select('full_name')
                    .eq('role', 'assistant')
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                if (anyAux) {
                    setAuxName(anyAux.full_name?.split(' ')[0] || null);
                }
            } catch (e) {
                console.warn('Error fetching aux name:', e);
            }
        };

        fetchAuxName();
    }, [journeyId, userId, preview]);

    // ── Realtime subscription on staff_journeys ──
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
                    if (newState === 'AUX_CONTAINERS_DONE' || newState === 'ROUTE_IN_PROGRESS') {
                        setAuxReady(true);
                        if (onAuxReady) {
                            setTimeout(() => onAuxReady(), 1200);
                        }
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [journeyId, preview, onAuxReady]);

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
                if (data.mission_state === 'AUX_CONTAINERS_DONE' || data.mission_state === 'ROUTE_IN_PROGRESS') {
                    setAuxReady(true);
                    if (onAuxReady) {
                        setTimeout(() => onAuxReady(), 1200);
                    }
                }
            }
        } catch (e) {
            console.warn('Poll error:', e);
        }
    }, [journeyId, preview, isOnline, onAuxReady]);

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
            setDotIndex(prev => (prev + 1) % 4); // 0, 1, 2, 3
        }, 600);
        return () => clearInterval(interval);
    }, []);

    const displayAuxName = auxName || 'el Auxiliar';


    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)', // FlyHigh Blue
            WebkitFontSmoothing: 'antialiased', color: 'white',
            position: 'relative'
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
            />

            {/* ════════ OFFLINE BANNER ════════ */}
            {!isOnline && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
                    backgroundColor: '#ef4444', color: 'white',
                    padding: '6px 16px', textAlign: 'center',
                    fontSize: 12, fontWeight: 600
                }}>
                    Sin conexión — los datos se guardan localmente
                </div>
            )}

            {/* ════════ MAIN CONTENT ════════ */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 32px', textAlign: 'center'
            }}>
                {/* Truck card */}
                <div style={{ position: 'relative', marginBottom: 40 }}>
                    {/* Glow */}
                    <div style={{
                        position: 'absolute', inset: -30,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        borderRadius: '50%', filter: 'blur(60px)'
                    }} />
                    <div style={{
                        position: 'relative',
                        width: 200, height: 200,
                        backgroundColor: 'white', borderRadius: 24,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 20
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 80, color: '#007AFF',
                            fontVariationSettings: "'FILL' 0, 'wght' 400"
                        }}>
                            local_shipping
                        </span>
                        {/* Animated dots */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    backgroundColor: '#007AFF',
                                    opacity: dotIndex === i ? 1 : 0.2,
                                    transition: 'opacity 0.3s ease'
                                }} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Text */}
                <div style={{ maxWidth: 320 }}>
                    <h1 style={{
                        fontSize: 28, fontWeight: 800, color: 'white',
                        letterSpacing: '-0.02em', lineHeight: 1.2,
                        marginBottom: 14
                    }}>
                        {auxReady ? '¡Carga completa!' : 'Momento de cargar'}
                    </h1>
                    <p style={{
                        fontSize: 17, color: 'rgba(255,255,255,0.9)',
                        lineHeight: 1.5, fontWeight: 500
                    }}>
                        {auxReady ? (
                            'El equipo está verificado. Avanzando...'
                        ) : (
                            <>
                                Espera a que{' '}
                                <span style={{
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    padding: '2px 8px', borderRadius: 6,
                                    fontWeight: 700, color: 'white'
                                }}>
                                    {displayAuxName}
                                </span>{' '}
                                complete la carga y verificación del vehículo.
                            </>
                        )}
                    </p>
                </div>
            </main>

            {/* ════════ FOOTER ════════ */}
            <footer style={{ padding: '0 24px 40px', textAlign: 'center' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.2)'
                }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 18, color: 'rgba(255,255,255,0.9)',
                        fontVariationSettings: "'FILL' 1, 'wght' 400"
                    }}>
                        verified_user
                    </span>
                    <p style={{
                        fontSize: 12, fontWeight: 700, color: 'white',
                        margin: 0, letterSpacing: '-0.01em'
                    }}>
                        No cierres la app (los datos se guardan)
                    </p>
                </div>

                {/* Preview: Skip button (no real polling in preview mode) */}
                {preview && (
                    <div style={{ marginTop: 20 }}>
                        <button
                            onClick={() => {
                                setAuxReady(true);
                                if (onAuxReady) setTimeout(() => onAuxReady(), 1500);
                            }}
                            style={{
                                padding: '12px 32px', borderRadius: 12,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                border: '1px solid rgba(255,255,255,0.4)',
                                color: 'white', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', letterSpacing: '-0.01em'
                            }}
                        >
                            Simular confirmación del Auxiliar
                        </button>
                    </div>
                )}

                {/* Home indicator */}
                <div style={{
                    marginTop: 32, width: 134, height: 5,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    borderRadius: 999, margin: '32px auto 0'
                }} />
            </footer>

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
