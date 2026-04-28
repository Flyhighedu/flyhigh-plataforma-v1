'use client';

// ═══════════════════════════════════════════════════════════════════
// /staff/contingencia-piloto — Isolated "No Pilot" Contingency Route
//
// This is a PARALLEL app that does NOT modify the main dashboard.
// It reuses existing UI components but has its own state machine.
// Connects to the same Supabase tables for real-time sync.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { parseMeta } from '@/utils/metaHelpers';
import { CONTINGENCY_META_FLAGS, isNoPilotContingency, DISMANTLING_TASK_OVERRIDES } from '@/utils/contingencyPilotConfig';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { resolveDismantlingRoute, DISMANTLING_ROUTE_IDS, normalizeDismantlingRole } from '@/utils/dismantlingRouting';

// Reuse existing UI components (read-only imports — no modifications)
import StaffOperationLegacy from '@/components/staff/StaffOperationLegacy';
import SupervisorBitacoraScreen from '@/components/staff/SupervisorBitacoraScreen';
import PrepChecklist from '@/components/staff/PrepChecklist';
import EnRutaScreen from '@/components/staff/EnRutaScreen';
import PilotPrepareFlightScreen from '@/components/staff/PilotPrepareFlightScreen';
import PilotMusicAmbienceScreen from '@/components/staff/PilotMusicAmbienceScreen';
import SeatDeploymentScreen from '@/components/staff/SeatDeploymentScreen';
import HeadphonesSetupScreen from '@/components/staff/HeadphonesSetupScreen';
import GlassesSetupScreen from '@/components/staff/GlassesSetupScreen';
import UnloadScreen from '@/components/staff/UnloadScreen';

// Closure components
import AdWallDismantleScreen from '@/components/staff/AdWallDismantleScreen';
import DroneStorageScreen from '@/components/staff/DroneStorageScreen';
import GlassesStorageScreen from '@/components/staff/GlassesStorageScreen';
import HeadphonesStorageScreen from '@/components/staff/HeadphonesStorageScreen';
import SeatFoldingScreen from '@/components/staff/SeatFoldingScreen';
import VehiclePositioningScreen from '@/components/staff/VehiclePositioningScreen';
import GlobalLoadingScreen from '@/components/staff/GlobalLoadingScreen';
import MomentoDeCargarScreen from '@/components/staff/MomentoDeCargarScreen';
import ReturnRouteScreen from '@/components/staff/ReturnRouteScreen';
import ApoyoBodegaScreen from '@/components/staff/ApoyoBodegaScreen';
import EquipmentUnloadScreen from '@/components/staff/EquipmentUnloadScreen';
import ReturnInventoryScreen from '@/components/staff/ReturnInventoryScreen';
import ChargingStationScreen from '@/components/staff/ChargingStationScreen';
import AuxRecordingChargingScreen from '@/components/staff/AuxRecordingChargingScreen';
import FinalParkingScreen from '@/components/staff/FinalParkingScreen';
import CheckoutScreen from '@/components/staff/CheckoutScreen';
import PilotOperationalWaitScreen from '@/components/staff/PilotOperationalWaitScreen';
import OperationPanelConstructionScreen from '@/components/staff/OperationPanelConstructionScreen';

import { Loader2, AlertCircle } from 'lucide-react';

function safeParseJson(value, fallback = null) {
    try {
        if (!value) return fallback;
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return fallback;
    }
}

// ═══════════════════════════════════════════════════════════════════
// CONTINGENCY DISMANTLING ROUTER
// Overrides pilot-specific tasks to the correct substitute role.
// ═══════════════════════════════════════════════════════════════════
function resolveContingencyDismantlingRoute(role, meta) {
    const normalizedRole = normalizeDismantlingRole(role);

    // For pilot role (shouldn't happen in contingency, but safety net)
    if (normalizedRole === 'pilot') {
        return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.CHECKOUT, routeKey: 'pilot:checkout' };
    }

    // Use the normal routing first
    const normalRoute = resolveDismantlingRoute(normalizedRole, meta);

    // Override: If the normal route would send someone to APOYO_BODEGA waiting for pilot,
    // and the task is actually a pilot task, redirect to the correct substitute
    if (normalRoute.kind === 'wait' && normalRoute.routeKey?.includes('pilot')) {
        // No pilot exists — skip waits that depend on pilot
        // Check what pilot task is pending and assign it
        const safeMeta = parseMeta(meta);

        if (normalizedRole === 'teacher') {
            // Teacher absorbs pilot's inventory + charging tasks
            if (!isDone(safeMeta, 'pilot_return_inventory_done', 'closure_return_inventory_done')) {
                return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.RETURN_INVENTORY, routeKey: 'teacher:contingency_return_inventory' };
            }
            if (!isDone(safeMeta, 'pilot_electronics_charged', 'closure_electronics_charging_done')) {
                return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.ELECTRONICS_CHARGING, routeKey: 'teacher:contingency_electronics_charging' };
            }
        }

        if (normalizedRole === 'assistant') {
            // Assistant absorbs pilot's drone storage
            if (!isDone(safeMeta, 'pilot_drones_stored', 'global_drone_storage_done')) {
                return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.DRONE_STORAGE, routeKey: 'assistant:contingency_drone_storage' };
            }
        }

        // If we handled all pilot tasks, skip to the next normal task
        return resolveDismantlingRoute(normalizedRole, meta);
    }

    // For assistant: inject drone storage FIRST if not done
    if (normalizedRole === 'assistant') {
        const safeMeta = parseMeta(meta);
        if (!isDone(safeMeta, 'pilot_drones_stored', 'global_drone_storage_done')) {
            // Drone storage comes before the assistant's normal first task
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.DRONE_STORAGE, routeKey: 'assistant:contingency_drone_storage' };
        }
    }

    return normalRoute;
}

function isDone(meta, ...keys) {
    return keys.some(k => meta?.[k] === true || meta?.[k] === 'true' || meta?.[k] === 1);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ContingenciaPilotoPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profile, setProfile] = useState(null);
    const [userId, setUserId] = useState(null);
    const [journeyId, setJourneyId] = useState(null);
    const [missionInfo, setMissionInfo] = useState(null);
    const [missionState, setMissionState] = useState(null);

    const refreshMission = useCallback(async () => {
        if (!journeyId) return;
        try {
            const supabase = createClient();
            const { data } = await supabase
                .from('staff_journeys')
                .select('*')
                .eq('id', journeyId)
                .single();
            if (data) {
                const meta = parseMeta(data.meta);
                setMissionState(data.mission_state);
                setMissionInfo(prev => ({
                    ...prev,
                    ...data,
                    meta,
                }));
            }
        } catch (e) {
            console.error('[ContingenciaPiloto] refreshMission error:', e);
        }
    }, [journeyId]);

    // ── 1. Initialize: auth + journey from localStorage ──
    useEffect(() => {
        const init = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.push('/staff/login'); return; }
                setUserId(user.id);

                const { data: profileData, error: profileError } = await supabase
                    .from('staff_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (profileError || !profileData || !profileData.is_active) {
                    setError('Perfil no encontrado o inactivo.');
                    setLoading(false);
                    return;
                }
                if (profileData.role === 'auxiliar') profileData.role = 'assistant';
                setProfile(profileData);

                const savedMission = safeParseJson(localStorage.getItem('flyhigh_staff_mission'));
                const savedMissionId = localStorage.getItem('flyhigh_selected_mission_id');
                const schoolId = savedMission?.id || savedMissionId;
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

                let journey = null;

                // Strategy 1: Find journey by school for today
                if (schoolId) {
                    const { data } = await supabase
                        .from('staff_journeys')
                        .select('*')
                        .eq('date', today)
                        .eq('school_id', schoolId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    journey = data;
                }

                // Strategy 2: No school or no journey found — find ANY journey with contingency flag for today
                if (!journey) {
                    const { data } = await supabase
                        .from('staff_journeys')
                        .select('*')
                        .eq('date', today)
                        .order('created_at', { ascending: false })
                        .limit(10);

                    if (data && data.length > 0) {
                        // Find the one with contingency_no_pilot flag
                        journey = data.find(j => {
                            const m = parseMeta(j.meta);
                            return m?.contingency_no_pilot === true;
                        });
                        // If none found with flag, just take the latest one
                        if (!journey) journey = data[0];
                    }
                }

                if (!journey) {
                    setError('No se encontró una jornada activa para hoy. Regresa al dashboard y selecciona una misión primero.');
                    setLoading(false);
                    return;
                }

                // If contingency flag isn't set yet (race condition), set it now
                let meta = parseMeta(journey.meta);
                if (!isNoPilotContingency(meta)) {
                    const now = new Date().toISOString();
                    const nextMeta = {
                        ...meta,
                        contingency_no_pilot: true,
                        contingency_no_pilot_activated_at: now,
                        contingency_no_pilot_activated_by: user.id,
                        contingency_no_pilot_activated_by_name: profileData.full_name?.split(' ')[0] || 'Operativo',
                    };
                    await supabase.from('staff_journeys').update({
                        meta: nextMeta,
                        updated_at: now,
                    }).eq('id', journey.id);
                    meta = nextMeta;
                }

                setJourneyId(journey.id);
                setMissionState(journey.mission_state);
                setMissionInfo({
                    ...savedMission,
                    ...journey,
                    meta,
                    school_name: journey.school_name || savedMission?.school_name || 'Escuela'
                });
                setLoading(false);
            } catch (e) {
                console.error('[ContingenciaPiloto] init error:', e);
                setError('Error al inicializar contingencia.');
                setLoading(false);
            }
        };
        init();
    }, [router]);

    // ── 2. Realtime listener ──
    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`contingencia-piloto-${journeyId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'staff_journeys', filter: `id=eq.${journeyId}` },
                (payload) => {
                    const newStatus = payload.new?.status;
                    const newMeta = parseMeta(payload.new?.meta);
                    const newState = payload.new?.mission_state;

                    if (newStatus === 'closed' || newStatus === 'completada' || newStatus === 'cerrada') {
                        localStorage.removeItem('flyhigh_staff_mission');
                        localStorage.removeItem('flyhigh_selected_mission_id');
                        localStorage.removeItem('flyhigh_active_journey_id');
                        window.location.href = '/staff/dashboard?tab=history';
                        return;
                    }

                    if (newState) setMissionState(newState);
                    if (payload.new) {
                        setMissionInfo(prev => ({ ...prev, ...payload.new, meta: newMeta }));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [journeyId]);

    // ── 3. Session keep-alive ──
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.refreshSession();
        const interval = setInterval(() => { supabase.auth.refreshSession(); }, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // RENDER HELPERS
    // ═══════════════════════════════════════════════════════════════
    const commonProps = {
        journeyId,
        userId,
        profile,
        missionInfo,
        missionState,
        onRefresh: refreshMission,
    };

    const closureProps = {
        ...commonProps,
        onCheckoutComplete: async () => {
            localStorage.removeItem('flyhigh_staff_mission');
            localStorage.removeItem('flyhigh_selected_mission_id');
            localStorage.removeItem('flyhigh_active_journey_id');
            window.location.href = '/staff/dashboard?tab=history';
        },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    <p className="text-slate-500 font-medium">Cargando...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
                <div className="max-w-sm text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <button onClick={() => router.push('/staff/dashboard')} className="text-sm text-blue-500 underline">
                        Volver al dashboard
                    </button>
                </div>
            </div>
        );
    }

    const role = profile?.role;
    const meta = parseMeta(missionInfo?.meta);

    // ═══════════════════════════════════════════════════════════════
    // DISMANTLING PHASE — Closure with redistributed pilot tasks
    // ═══════════════════════════════════════════════════════════════
    if (missionState === 'dismantling') {
        const dismantlingRoute = resolveContingencyDismantlingRoute(role, missionInfo?.meta);

        if (dismantlingRoute.kind === 'wait') {
            // Skip waits for pilot — reassign or show generic wait
            if (dismantlingRoute.routeKey?.includes('pilot')) {
                // No pilot — this wait shouldn't happen, but safety fallback
                return <ApoyoBodegaScreen {...closureProps} />;
            }
            return (
                <PilotOperationalWaitScreen
                    {...closureProps}
                    chipOverride={dismantlingRoute.waitChip}
                    waitTitle="En espera..."
                    waitMessage={dismantlingRoute.waitMessage}
                    waitSubMessage={null}
                    waitPhase="load"
                />
            );
        }

        switch (dismantlingRoute.screen) {
            case DISMANTLING_ROUTE_IDS.AD_WALL_DISMANTLE:
                return <AdWallDismantleScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.DRONE_STORAGE:
                return <DroneStorageScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.GLASSES_STORAGE:
                return <GlassesStorageScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.HEADPHONES_STORAGE:
                return <HeadphonesStorageScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.SEAT_FOLDING:
                return <SeatFoldingScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.VEHICLE_POSITIONING:
                return <VehiclePositioningScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.GLOBAL_LOADING:
            case DISMANTLING_ROUTE_IDS.CONTAINER_LOADING:
                if (normalizeDismantlingRole(role) === 'assistant') {
                    return <GlobalLoadingScreen {...closureProps} />;
                }
                return <MomentoDeCargarScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.RETURN_ROUTE:
                return <ReturnRouteScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.APOYO_BODEGA:
                return <ApoyoBodegaScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD:
                return <EquipmentUnloadScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.RETURN_INVENTORY:
                return <ReturnInventoryScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.ELECTRONICS_CHARGING:
                return <ChargingStationScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.AUX_RECORDING_CHARGING:
                return <AuxRecordingChargingScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.FINAL_PARKING:
                return <FinalParkingScreen {...closureProps} />;
            case DISMANTLING_ROUTE_IDS.CHECKOUT:
                return <CheckoutScreen {...closureProps} />;
            default:
                return <CheckoutScreen {...closureProps} />;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // OPERATION PHASE
    // ═══════════════════════════════════════════════════════════════
    const isOperationState = ['OPERATION', 'operation', 'PILOT_OPERATION'].includes(missionState);

    if (isOperationState) {
        // Teacher → manages flight panel (same as normal)
        if (role === 'teacher') {
            return (
                <SupervisorBitacoraScreen
                    {...commonProps}
                />
            );
        }

        // Assistant → in contingency, they FLY the drone.
        // They use StaffOperationLegacy which handles flight logging.
        if (role === 'assistant') {
            return (
                <StaffOperationLegacy
                    initialMission={missionInfo}
                    onCloseDay={async () => {
                        // Transition to dismantling
                        try {
                            const supabase = createClient();
                            const now = new Date().toISOString();
                            const currentMeta = parseMeta(missionInfo?.meta);
                            const nextMeta = {
                                ...currentMeta,
                                closure_phase: 'dismantling',
                                closure_started_at: currentMeta.closure_started_at || now,
                                closure_started_by: userId,
                            };
                            await supabase.from('staff_journeys').update({
                                mission_state: 'dismantling',
                                meta: nextMeta,
                                updated_at: now,
                            }).eq('id', journeyId);
                            setMissionState('dismantling');
                            refreshMission();
                        } catch (err) {
                            console.error('[ContingenciaPiloto] Error starting dismantling:', err);
                        }
                    }}
                    hideMenu={false}
                    useSyncHeader={true}
                    journeyId={journeyId}
                    userId={userId}
                    profile={profile}
                    missionState={missionState}
                    onRefresh={refreshMission}
                />
            );
        }

        // Any other role — show construction/wait screen
        return <OperationPanelConstructionScreen {...commonProps} />;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRE-OPERATION PHASES
    // Seat deployment, kickoff, music, glasses, headphones
    // ═══════════════════════════════════════════════════════════════
    if (missionState === 'seat_deployment') {
        const seatMeta = meta;
        const seatDone = seatMeta.global_seat_deployment_done === true;
        const headphonesDone = seatMeta.global_headphones_done === true;
        const glassesDone = seatMeta.global_glasses_done === true;

        // Glasses done → Kickoff bridge (music for aux, ready for teacher)
        if (glassesDone) {
            // In contingency: Aux does music (pilot's task)
            if (role === 'assistant') {
                return (
                    <PilotMusicAmbienceScreen
                        {...commonProps}
                        role="pilot"  // Override so the component behaves as pilot
                    />
                );
            }
            // Teacher/others wait for operation
            return (
                <PilotOperationalWaitScreen
                    {...commonProps}
                    chipOverride="Preparando operación"
                    waitTitle="Casi listos..."
                    waitMessage="El auxiliar está configurando la música y el equipo de vuelo."
                    waitSubMessage={null}
                    waitPhase="load"
                />
            );
        }

        if (seatDone && headphonesDone && !glassesDone) {
            return <GlassesSetupScreen {...commonProps} role={role} />;
        }
        if (seatDone && !headphonesDone) {
            return <HeadphonesSetupScreen {...commonProps} role={role} />;
        }

        // Aux: if they haven't done flight prep yet, show PilotPrepareFlightScreen
        if (role === 'assistant') {
            const auxReady = seatMeta.aux_ready_seat_deployment === true;
            const pilotReady = seatMeta.pilot_ready === true;

            if (auxReady && !pilotReady) {
                // Aux does pilot's flight prep (controller, audio, spot)
                return (
                    <PilotPrepareFlightScreen
                        journeyId={journeyId}
                        userId={userId}
                        profile={{ ...profile, role: 'pilot' }}  // Present as pilot to the component
                        missionInfo={missionInfo}
                        missionState={missionState}
                        onPilotReadyForLoad={(nextMeta) => {
                            refreshMission();
                        }}
                        onRefresh={refreshMission}
                    />
                );
            }
        }

        return <SeatDeploymentScreen {...commonProps} missionState="seat_deployment" />;
    }

    // ═══════════════════════════════════════════════════════════════
    // EN ROUTE / ARRIVAL / UNLOAD / POST-UNLOAD
    // These work the same — no pilot-specific behavior needed
    // ═══════════════════════════════════════════════════════════════
    if (['IN_ROUTE', 'ROUTE_IN_PROGRESS', 'ARRIVAL_PHOTO_DONE'].includes(missionState)) {
        return (
            <EnRutaScreen
                {...commonProps}
                role={role}
                onStateChange={(newState) => {
                    setMissionState(newState);
                }}
            />
        );
    }

    if (missionState === 'unload') {
        return <UnloadScreen {...commonProps} role={role} />;
    }

    if (missionState === 'post_unload_coordination') {
        return <SeatDeploymentScreen {...commonProps} missionState="seat_deployment" />;
    }

    if (missionState === 'waiting_dropzone' || missionState === 'waiting_unload_assignment') {
        // ── CONTINGENCY: No pilot to coordinate → auto-advance to unload ──
        // In normal ops, this wait exists for role coordination.
        // In contingency, there's no pilot, so we skip straight to unload.
        // Using setTimeout to avoid calling setState during render.
        setTimeout(async () => {
            try {
                const supabase = createClient();
                await supabase.from('staff_journeys').update({
                    mission_state: 'unload',
                    updated_at: new Date().toISOString(),
                }).eq('id', journeyId);
            } catch (e) {
                console.warn('[ContingenciaPiloto] auto-advance DB update error:', e);
            }
            setMissionState('unload');
        }, 0);
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    <p className="text-slate-500 font-medium">Avanzando a descarga...</p>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // PREP PHASE — Each role does their checklist
    // In contingency: Teacher also does pilot's kit checklist
    // ═══════════════════════════════════════════════════════════════
    if (!missionState || [
        'prep', 'PILOT_PREP', 'MISSION_BRIEF',
        'CHECKIN_DONE', 'PREP_DONE', 'AUX_PREP_DONE',
        'TEACHER_SUPPORTING_PILOT', 'WAITING_AUX_VEHICLE_CHECK',
        'PILOT_READY_FOR_LOAD', 'AUX_CONTAINERS_DONE', 'ROUTE_READY'
    ].includes(missionState)) {
        return (
            <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
                <PrepChecklist
                    role={role}
                    journeyId={journeyId}
                    userId={userId}
                    onComplete={async () => {
                        // After prep, advance to en_route
                        if (journeyId) {
                            try {
                                const supabase = createClient();
                                await supabase.from('staff_journeys').update({
                                    mission_state: 'IN_ROUTE',
                                    updated_at: new Date().toISOString(),
                                }).eq('id', journeyId);
                                setMissionState('IN_ROUTE');
                            } catch (e) {
                                console.warn('[ContingenciaPiloto] prep complete error:', e);
                            }
                        }
                    }}
                    missionInfo={{ ...missionInfo, profile, mission_state: missionState }}
                    preview={false}
                    onRefresh={refreshMission}
                />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // CLOSURE / REPORT PHASE — Redirect to checkout
    // ═══════════════════════════════════════════════════════════════
    if (['SHUTDOWN', 'POST_MISSION_REPORT', 'CLOSURE'].includes(missionState)) {
        return <CheckoutScreen {...closureProps} />;
    }

    // ═══════════════════════════════════════════════════════════════
    // FALLBACK — Unknown state: auto-resolve to prep instead of error
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
            <PrepChecklist
                role={role}
                journeyId={journeyId}
                userId={userId}
                onComplete={async () => {
                    if (journeyId) {
                        try {
                            const supabase = createClient();
                            await supabase.from('staff_journeys').update({
                                mission_state: 'IN_ROUTE',
                                updated_at: new Date().toISOString(),
                            }).eq('id', journeyId);
                            setMissionState('IN_ROUTE');
                        } catch (e) {
                            console.warn('[ContingenciaPiloto] prep complete error:', e);
                        }
                    }
                }}
                missionInfo={{ ...missionInfo, profile, mission_state: missionState }}
                preview={false}
                onRefresh={refreshMission}
            />
        </div>
    );
}
