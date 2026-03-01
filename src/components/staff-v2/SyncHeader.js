'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Hook to manage the Sync Mode state (tinting condition)
 */
export function useSyncHeaderState(journeyId, role, missionState) {
    const [waitingCount, setWaitingCount] = useState(0);

    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();

        const fetchWaitingCounts = async () => {
            try {
                // Fetch current mission state first if not provided
                let currentState = missionState;
                if (!currentState) {
                    const { data: journey } = await supabase.from('staff_journeys').select('mission_state').eq('id', journeyId).single();
                    currentState = journey?.mission_state;
                }

                // Phase 1: WAREHOUSE (Purple) - Pilot is gatekeeper
                if (role === 'pilot') {
                    // 1. Check global state FIRST (very reliable)
                    let countFromState = 0;
                    if (['AUX_PREP_DONE', 'TEACHER_SUPPORTING_PILOT'].includes(currentState)) {
                        countFromState = 1;
                    }

                    // 2. Try to get exact count from events (detailed)
                    // We use a broader query and filter locally to avoid RLS/JSON complexities
                    const { data: events } = await supabase
                        .from('staff_prep_events')
                        .select('payload, user_id') // Select user_id directly
                        .eq('journey_id', journeyId)
                        .eq('event_type', 'prep_complete');

                    if (events) {
                        const uniqueOperatives = new Set(
                            events
                                .filter(e => ['teacher', 'assistant', 'auxiliar'].includes(e.payload?.role))
                                .map(e => e.user_id || e.payload?.user_id) // Fallback if user_id is in payload
                        );
                        // Filter out undefined if any
                        uniqueOperatives.delete(undefined);

                        setWaitingCount(Math.max(countFromState, uniqueOperatives.size));
                    } else {
                        setWaitingCount(countFromState);
                    }
                }
                // Phase 2: LOAD (Blue) - Assistant is gatekeeper
                else if (role === 'assistant') {
                    if (['PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK'].includes(currentState)) {
                        setWaitingCount(1);
                    } else {
                        setWaitingCount(0);
                    }
                }
            } catch (err) {
                console.error("Error fetching waiting counts:", err);
            }
        };

        fetchWaitingCounts();

        // [CRITICAL FIX] Listen to BOTH events and journey state changes
        const channel = supabase
            .channel(`sync_header_${journeyId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'staff_prep_events', filter: `journey_id=eq.${journeyId}` },
                (payload) => {
                    if (payload.new.event_type === 'prep_complete') {
                        fetchWaitingCounts();
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'staff_journeys', filter: `id=eq.${journeyId}` },
                () => {
                    fetchWaitingCounts();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [journeyId, role, missionState]);

    return { waitingCount };
}


import { STAFF_STEPS } from '@/constants/staffSteps';
import { RefreshCw } from 'lucide-react';

export default function SyncHeader({
    firstName,
    roleName,
    role,
    navSteps: _navSteps, // Ignored in favor of STAFF_STEPS
    journeyId,
    userId,
    missionInfo,
    missionState,
    isWaitScreen = false,
    waitPhase = null // 'warehouse' (purple) or 'load' (blue)
}) {
    const { waitingCount } = useSyncHeaderState(journeyId, role, missionState);
    const headerRef = useRef(null);
    const [useFixedMobileHeader, setUseFixedMobileHeader] = useState(false);
    const [mobileHeaderOffset, setMobileHeaderOffset] = useState(0);

    // Dynamic Step Calculation
    const activeStepId = STAFF_STEPS.find(step => step.states.includes(missionState))?.id || STAFF_STEPS[0].id;
    const activeIndex = STAFF_STEPS.findIndex(s => s.id === activeStepId);

    // Determine TINT
    const isPilotGatekeeper = role === 'pilot' && waitingCount >= 1;
    const isAuxGatekeeper = role === 'assistant' && waitingCount >= 1;

    // Detect who we are waiting for (Global rule for microcopy)
    let waitingForRole = 'PILOTO';
    if (['PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK', 'WAITING_AUX', 'ROUTE_READY'].includes(missionState)) {
        waitingForRole = 'AUXILIAR';
    }

    // Tint color selection
    let headerBg = 'transparent';
    let isTinted = false;
    let logoFilter = 'none';
    let logoSrc = "/img/logoFH.png";
    let textColor = '#0f172a';
    let subTextColor = '#94a3b8';
    let iconBg = '#FACC15';
    let iconColor = '#1a1a1a';
    let navConnectedColor = '#e2e8f0';
    let navActiveColor = '#0066FF';
    let navCompletedColor = '#22c55e';

    if (isWaitScreen) {
        isTinted = true;
        headerBg = 'rgba(255,255,255,0.05)';
        logoFilter = 'brightness(0) invert(1)';
        textColor = 'white';
        subTextColor = 'rgba(255,255,255,0.8)';
        iconBg = 'rgba(255,255,255,0.2)';
        iconColor = 'white';
        navConnectedColor = 'rgba(255,255,255,0.2)';
        navActiveColor = 'white';
        navCompletedColor = 'white';
    } else if (isPilotGatekeeper) {
        isTinted = true;
        headerBg = '#8B5CF6';
        logoFilter = 'brightness(0) invert(1)';
        textColor = 'white';
        subTextColor = 'rgba(255,255,255,0.8)';
        iconBg = 'rgba(255,255,255,0.2)';
        iconColor = 'white';
        navConnectedColor = 'rgba(255,255,255,0.2)';
        navActiveColor = 'white';
        navCompletedColor = '#22c55e';
    } else if (isAuxGatekeeper) {
        isTinted = true;
        headerBg = '#1EA1FF';
        logoFilter = 'brightness(0) invert(1)';
        textColor = 'white';
        subTextColor = 'rgba(255,255,255,0.8)';
        iconBg = 'rgba(255,255,255,0.2)';
        iconColor = 'white';
        navConnectedColor = 'rgba(255,255,255,0.2)';
        navActiveColor = 'white';
        navCompletedColor = '#22c55e';
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(max-width: 1024px), (hover: none) and (pointer: coarse)');
        const handleQueryChange = () => {
            setUseFixedMobileHeader(mediaQuery.matches);
        };

        handleQueryChange();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleQueryChange);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(handleQueryChange);
        }

        window.addEventListener('orientationchange', handleQueryChange);

        return () => {
            if (typeof mediaQuery.removeEventListener === 'function') {
                mediaQuery.removeEventListener('change', handleQueryChange);
            } else if (typeof mediaQuery.removeListener === 'function') {
                mediaQuery.removeListener(handleQueryChange);
            }
            window.removeEventListener('orientationchange', handleQueryChange);
        };
    }, []);

    useEffect(() => {
        if (!useFixedMobileHeader) return;

        const headerNode = headerRef.current;
        if (!headerNode) return;

        const updateHeight = () => {
            const nextHeight = Math.ceil(headerNode.getBoundingClientRect().height);
            setMobileHeaderOffset((prevHeight) => (prevHeight === nextHeight ? prevHeight : nextHeight));
        };

        updateHeight();

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateHeight);
            resizeObserver.observe(headerNode);
        }

        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            window.removeEventListener('resize', updateHeight);
            window.removeEventListener('orientationchange', updateHeight);
        };
    }, [useFixedMobileHeader]);

    return (
        <>
            {useFixedMobileHeader && mobileHeaderOffset > 0 && (
                <div aria-hidden="true" style={{ height: mobileHeaderOffset }} />
            )}

            <header
                ref={headerRef}
                style={{
                    padding: '16px 20px',
                    paddingTop: useFixedMobileHeader ? 'calc(env(safe-area-inset-top, 0px) + 16px)' : '16px',
                    backgroundColor: headerBg,
                    backdropFilter: isWaitScreen ? 'blur(20px)' : 'none',
                    WebkitBackdropFilter: isWaitScreen ? 'blur(20px)' : 'none',
                    borderBottom: isTinted ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f1f5f9',
                    transition: 'all 0.5s ease',
                    position: useFixedMobileHeader ? 'fixed' : 'sticky',
                    top: 0,
                    left: useFixedMobileHeader ? 0 : undefined,
                    right: useFixedMobileHeader ? 0 : undefined,
                    zIndex: useFixedMobileHeader ? 70 : 50
                }}
            >
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
                {/* Top Row: Logo & Profile */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                            src={logoSrc}
                            alt="FlyHigh"
                            style={{ height: 22, filter: logoFilter, transition: 'all 0.5s ease' }}
                        />
                        <div style={{ width: 1, height: 24, backgroundColor: isTinted ? 'rgba(255,255,255,0.2)' : '#e2e8f0' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                width: 32, height: 32,
                                backgroundColor: iconBg,
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: iconColor,
                                fontWeight: 'bold',
                                fontSize: 13,
                                boxShadow: isTinted ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                            }}>
                                {firstName?.[0]}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: textColor, lineHeight: 1.1 }}>{firstName}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: subTextColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{roleName}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        {isTinted && (
                            <div style={{
                                padding: '4px 12px',
                                backgroundColor: 'rgba(255,255,255,0.15)',
                                borderRadius: 20,
                                display: 'flex', alignItems: 'center', gap: 6,
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                <span style={{ fontSize: 9, fontWeight: 800, color: 'white', letterSpacing: '0.03em' }}>
                                    {(isPilotGatekeeper || isAuxGatekeeper) ? 'TE ESPERAN' : `EN ESPERA DEL ${waitingForRole}`}
                                </span>
                            </div>
                        )}
                        <button style={{
                            width: 36, height: 36,
                            backgroundColor: isTinted ? 'rgba(255,255,255,0.1)' : '#f8fafc',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: isTinted ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                            color: isTinted ? 'white' : '#64748b'
                        }}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Stepper Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {STAFF_STEPS.map((step, idx) => {
                        const isCompleted = idx < activeIndex;
                        const isActive = idx === activeIndex;

                        let color = navConnectedColor;
                        if (isCompleted) color = navCompletedColor;
                        if (isActive) color = navActiveColor;

                        // Special rule: Pilot's 'INFORME' label is always white
                        let labelColor = color;
                        if (role === 'pilot' && step.id === 'informe') {
                            labelColor = 'white';
                        }

                        return (
                            <div key={step.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{
                                    height: 3,
                                    width: '100%',
                                    backgroundColor: color,
                                    borderRadius: 4,
                                    transition: 'all 0.5s ease'
                                }} />
                                <span style={{
                                    fontSize: 8,
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    color: labelColor,
                                    letterSpacing: '0.02em',
                                    transition: 'color 0.5s ease',
                                    opacity: (isActive || isCompleted) ? 1 : 0.4
                                }}>
                                    {isActive ? `• ${step.label}` : step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            </header>
        </>
    );
}
