'use client';

// =====================================================
// Staff Dashboard — Stepper Shell V1
// 3 pasos: Montaje → Operación → Reporte
// Auto-detecta escuela del día desde proximas_escuelas
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ClipboardList, Plane, FileText, Loader2, AlertCircle, MapPin, Calendar, LogOut, ChevronLeft, User, Truck } from 'lucide-react';
import PrepChecklist from '@/components/staff/PrepChecklist';
import StaffOperationLegacy from '@/components/staff/StaffOperationLegacy';
import ClosureLegacy from '@/components/staff/ClosureLegacy';
import WaitingAuxLoad from '@/components/staff/WaitingAuxLoad';
import AuxWaitingScreen from '@/components/staff/AuxWaitingScreen';
import AuxVehicleChecklist from '@/components/staff/AuxVehicleChecklist';
import MissionSelector from '@/components/staff/MissionSelector';
import MissionBrief from '@/components/staff/MissionBrief';
import ResetProcessButton from '@/components/staff/ResetProcessButton';
import TeacherWaitingScreen from '@/components/staff/TeacherWaitingScreen';
import EnRutaScreen from '@/components/staff/EnRutaScreen';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { ensureTestJourney, resetTestJourney, TEST_JOURNEY_ID } from '@/utils/testModeUtils';
import { clearJourneyLocalOperationalData } from '@/utils/staff/resetJourneyLocalData';

import { STAFF_STEPS } from '@/constants/staffSteps';

const STEPS = [
    { id: 'prep', label: 'Montaje', icon: ClipboardList },
    { id: 'en_ruta', label: 'En Ruta', icon: Truck },
    { id: 'operation', label: 'Operación', icon: Plane },
    { id: 'report', label: 'Reporte', icon: FileText },
];

export default function StaffDashboard() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [todaySchool, setTodaySchool] = useState(null);
    const [manualMission, setManualMission] = useState(null);
    const [journeyId, setJourneyId] = useState(null);
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);
    const [noSchoolToday, setNoSchoolToday] = useState(false);
    const [showBrief, setShowBrief] = useState(true);
    const [checkInTimestamp, setCheckInTimestamp] = useState(null);
    const [waitingForAux, setWaitingForAux] = useState(false);
    const [auxFlowState, setAuxFlowState] = useState(null); // 'waiting' | 'checklist' | null
    const [teacherFlowState, setTeacherFlowState] = useState(null); // 'waiting'
    const [isTestMode, setIsTestMode] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [missionState, setMissionState] = useState(null); // Local reliable state

    useEffect(() => {
        setMounted(true);
    }, []);

    // ── REUSABLE FETCH FUNCTION (For Manual Refresh) ──
    const refreshMission = useCallback(async () => {
        // If we don't have a userId yet, we can't do much (unless we rely on implicit triggers)
        // But for manual refresh, we expect userId to be set.
        if (!userId) return;

        setLoading(true);
        console.log('🔄 Refreshing Mission Data...');

        try {
            const supabase = createClient();
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

            // 1. Get School
            const { data: scheduled } = await supabase
                .from('proximas_escuelas')
                .select('*')
                .eq('fecha_programada', today)
                .eq('estatus', 'pendiente')
                .limit(1);

            if (scheduled && scheduled.length > 0) {
                const school = scheduled[0];
                const schoolData = {
                    id: school.id,
                    school_name: school.nombre_escuela,
                    colonia: school.colonia,
                    fecha: school.fecha_programada,
                };

                setTodaySchool(schoolData);
                localStorage.setItem('flyhigh_staff_mission', JSON.stringify(schoolData));
                setNoSchoolToday(false);

                // 2. Get Journey
                // For test mode users, we might be using a fake ID, but the query uses RLS? 
                // Let's use the current 'userId' state which is set by init.
                const { data: existingJourney } = await supabase
                    .from('staff_journeys')
                    .select('id')
                    .eq('date', today)
                    .eq('school_id', school.id)
                    .single();

                if (existingJourney) {
                    setJourneyId(existingJourney.id);
                    // Check mission state for Aux
                    const { data: journeyState } = await supabase
                        .from('staff_journeys')
                        .select('mission_state')
                        .eq('id', existingJourney.id)
                        .single();

                    const state = journeyState?.mission_state;
                    setMissionState(state);

                    if (profile?.role === 'assistant') {
                        if (state === 'WAITING_AUX_VEHICLE_CHECK') {
                            setAuxFlowState('checklist');
                        } else if (['AUX_VEHICLE_CHECK_DONE', 'OPERATION', 'ROUTE_READY', 'IN_ROUTE'].includes(state)) {
                            setAuxFlowState(null);
                        } else {
                            setAuxFlowState(null);
                        }
                    }

                    // Determine Step based on State
                    if (['prep', 'PILOT_PREP', 'AUX_PREP_DONE', 'TEACHER_SUPPORTING_PILOT', 'PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK'].includes(state)) {
                        setCurrentStep(0);
                    } else if (['ROUTE_READY', 'IN_ROUTE'].includes(state)) {
                        setCurrentStep(1); // En Ruta
                    } else if (['ARRIVAL_PHOTO_DONE', 'OPERATION', 'operation'].includes(state)) {
                        setCurrentStep(2); // Operation
                    } else if (['report', 'closed'].includes(state) || existingJourney.status === 'report') {
                        setCurrentStep(3); // Report
                    }

                } else {
                    const { data: newJourney, error: insertError } = await supabase
                        .from('staff_journeys')
                        .insert({
                            date: today,
                            school_id: school.id,
                            school_name: school.nombre_escuela,
                            created_by: userId,
                            status: 'prep'
                        })
                        .select('id')
                        .single();

                    if (insertError) {
                        // If it fails for ANY reason (likely race condition or constraint), try fetching existing
                        console.warn('⚠️ Journey insert failed (Race condition likely). Fetching existing ID...', insertError);
                        const { data: existing } = await supabase
                            .from('staff_journeys')
                            .select('id')
                            .eq('date', today)
                            .eq('school_id', school.id)
                            .single();

                        if (existing) {
                            setJourneyId(existing.id);
                        } else {
                            console.error('❌ Critical: Could not create nor find journey:', insertError);
                        }
                    } else if (newJourney) {
                        setJourneyId(newJourney.id);
                    }
                }

                // 3. Check for Check-in
                if (existingJourney || journeyId) {
                    const jId = existingJourney?.id || journeyId;
                    if (jId) {
                        const { data: checkInEvent } = await supabase
                            .from('staff_prep_events')
                            .select('payload')
                            .eq('journey_id', jId)
                            .eq('event_type', 'checkin')
                            .limit(1)
                            .single();
                        if (checkInEvent) {
                            setCheckInTimestamp(checkInEvent.payload.timestamp);
                            setTodaySchool(prev => ({ ...prev, checkInTimestamp: checkInEvent.payload.timestamp }));
                            setShowBrief(false);
                        }
                    }
                }

            } else {
                setNoSchoolToday(true);
                localStorage.removeItem('flyhigh_staff_mission');
                setTodaySchool(null);
            }
        } catch (error) {
            console.error('Error refreshing mission:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, profile]); // Removed journeyId from dependencies to avoid loop

    // ── INITIALIZATION ──
    useEffect(() => {
        const init = async () => {
            console.log('🚀 Dashboard: Init started');
            try {
                // ── PRIORITY: CHECK TEST MODE FIRST ──
                if (typeof window !== 'undefined') {
                    const testConfigStr = sessionStorage.getItem('flyhigh_test_mode');
                    if (testConfigStr) {
                        try {
                            const testConfig = JSON.parse(testConfigStr);
                            if (testConfig.active) {
                                console.log('🔹 MODO TEST DETECTADO:', testConfig);
                                setIsTestMode(true);
                                const mockRole = testConfig.role || 'pilot';
                                let finalProfile = testConfig.impersonatedProfile || {
                                    id: mockRole === 'pilot' ? 'test-pilot-id' : 'test-assistant-id',
                                    role: mockRole,
                                    full_name: `Operativo ${mockRole.toUpperCase()} (Test)`,
                                    is_active: true
                                };
                                finalProfile = { ...finalProfile, id: finalProfile.role === 'pilot' ? 'test-pilot-id' : 'test-assistant-id' };
                                setProfile(finalProfile);
                                setUserId(finalProfile.id);
                                const testJourney = await ensureTestJourney(finalProfile.id, finalProfile.role);
                                setJourneyId(TEST_JOURNEY_ID);
                                setLoading(false);
                                return;
                            }
                        } catch (e) {
                            console.error('Error parsing test mode config:', e);
                        }
                    }
                }

                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/staff/login');
                    return;
                }
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
                setProfile(profileData);

            } catch (e) {
                console.error('Init error:', e);
                setError('Error al inicializar.');
            }
        };
        init();
    }, [router]);

    // Trigger Refresh when User/Profile is ready
    useEffect(() => {
        if (userId && profile && !journeyId) { // Only auto-refresh if journeyId not set yet
            refreshMission();
        }
    }, [userId, profile, journeyId, refreshMission]);

    // ── GLOBAL RESET LISTENER ──
    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();
        console.log('🔌 Listening for Global Resets on journey:', journeyId);

        const channel = supabase
            .channel(`global_reset_${journeyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for UPDATE and DELETE
                    schema: 'public',
                    table: 'staff_journeys',
                    filter: `id=eq.${journeyId}`
                },
                (payload) => {
                    console.log('🔄 Global Reset/Update Check:', payload);

                    // Case 1: Journey Reset via Update (Legacy/Alternative)
                    if (payload.eventType === 'UPDATE') {
                        const newState = payload.new.mission_state;
                        setMissionState(newState); // Keep local state in sync

                        if (['PILOT_PREP', 'prep'].includes(newState)) {
                            console.warn('⚠️ Global Reset (State Change) Detected! Reloading...');
                            clearJourneyLocalOperationalData(journeyId);
                            window.location.reload();
                        }

                        // Auto-advance logic
                        // Auto-advance logic
                        if (['ROUTE_READY', 'IN_ROUTE'].includes(newState)) {
                            setCurrentStep(1);
                            setAuxFlowState(null);
                            setTeacherFlowState(null);
                        }
                        if (['ARRIVAL_PHOTO_DONE', 'OPERATION'].includes(newState)) setCurrentStep(2);
                        if (['report'].includes(newState)) setCurrentStep(3);
                    }

                    // Case 2: Journey DELETED (Real School Reset)
                    // If the journey is deleted, we reload. 
                    // Since the school still exists (for real missions), the app will reload, 
                    // find the school, see no journey, and start fresh (or create new journey).
                    if (payload.eventType === 'DELETE') {
                        console.warn('⚠️ Current Journey Deleted! Reloading to reset...');
                        // Optional: Clear local storage if we want to force a full re-fetch
                        clearJourneyLocalOperationalData(journeyId);
                        localStorage.removeItem('flyhigh_staff_mission');
                        window.location.reload();
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [journeyId]);

    // ── [NEW] SCHOOL ASSIGNMENT LISTENER (For Demo Mode) ──
    useEffect(() => {
        // Only listen if we don't have a school yet, OR if we want to switch to demo dynamically
        const supabase = createClient();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

        console.log('📡 Listening for School Assignments for:', today);

        const channel = supabase
            .channel('school_assignments')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'proximas_escuelas'
                    // FILTER REMOVED: catch all events to ensure reliability
                },
                (payload) => {
                    console.log('🔔 Raw School Update Received:', payload);

                    // 1. HANDLE INSERT / UPDATE
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const newSchool = payload.new;
                        // Client-side Date Check
                        if (newSchool.fecha_programada === today && newSchool.estatus === 'pendiente') {
                            const schoolData = {
                                id: newSchool.id,
                                school_name: newSchool.nombre_escuela,
                                colonia: newSchool.colonia,
                                fecha: newSchool.fecha_programada,
                            };
                            console.log('✨ Auto-assigning new school (Sync):', schoolData);
                            setTodaySchool(schoolData);
                            localStorage.setItem('flyhigh_staff_mission', JSON.stringify(schoolData));
                            setNoSchoolToday(false);
                            refreshMission();
                        }
                    }

                    // 2. HANDLE DELETE (Global Reset)
                    if (payload.eventType === 'DELETE') {
                        console.warn('🗑️ Global Reset (Delete Event) detected.');
                        // For safety, if WE are seeing a mission, and A mission was deleted, we reload.
                        // Ideally we check ID, but payload.old might be empty depending on Supabase config.
                        // Given the use case (one mission per day usually), a reload is safe.

                        const deletedId = payload.old?.id;
                        const currentId = todaySchool?.id || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('flyhigh_staff_mission') || '{}').id : null);

                        // Loose check: If we have ANY mission, and a mission was deleted, assume it's ours or a reset
                        // especially if deletedId matches OR is the known demo ID
                        if (currentId) {
                            console.log('Testing Delete match:', deletedId, currentId);
                            if (!deletedId || String(deletedId) === String(currentId) || String(deletedId) === '999999') {
                                console.log('✅ Match confirmed. Reloading...');
                                localStorage.removeItem('flyhigh_staff_mission');
                                localStorage.removeItem('flyhigh_test_mode');
                                setTodaySchool(null);
                                setNoSchoolToday(true);
                                setJourneyId(null);
                                window.location.reload();
                            }
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [refreshMission]);

    // Session refresh
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.refreshSession();

        const interval = setInterval(() => {
            if (navigator.onLine) {
                supabase.auth.refreshSession();
            }
        }, 10 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('flyhigh_staff_mission');
        router.push('/staff/login');
        router.refresh();
    };

    const handleExitTestMode = () => {
        sessionStorage.removeItem('flyhigh_test_mode');
        localStorage.removeItem('flyhigh_staff_mission');
        // Clear cookie
        document.cookie = "flyhigh_test_mode=; path=/; max-age=0";
        window.location.href = '/staff/login';
    };

    const handleManualMissionSelect = async (mission) => {
        setManualMission(mission);
        const missionData = {
            id: mission.id,
            school_name: mission.school_name || mission.nombre_escuela,
        };
        setTodaySchool(missionData);
        // FIX: Persist to localStorage
        localStorage.setItem('flyhigh_staff_mission', JSON.stringify(missionData));
        setNoSchoolToday(false);

        // Crear jornada para misión manual
        try {
            const supabase = createClient();
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

            const { data: newJourney } = await supabase
                .from('staff_journeys')
                .upsert({
                    date: today,
                    school_id: mission.id,
                    school_name: mission.school_name || mission.nombre_escuela,
                    created_by: userId,
                    status: 'prep'
                }, { onConflict: 'date,school_id' })
                .select('id')
                .single();

            if (newJourney) setJourneyId(newJourney.id);
        } catch (e) {
            console.warn('Error creando jornada manual:', e);
        }
    };

    const handleCheckIn = () => {
        setCheckInTimestamp(new Date().toISOString());
        setCurrentStep(0); // Go to Prep Checklists
        console.log('📍 CheckIn processed, moving to Step 0 (Prep)');
    };

    const handlePrepComplete = async () => {
        console.log('✅ Dashboard: handlePrepComplete called', { isTestMode, role: profile?.role });
        // Test Mode Logic -> Broadcast handled in component, we just update local state if needed


        // Pilots: show waiting screen for aux to confirm vehicle loading
        if (profile?.role === 'pilot') {
            setWaitingForAux(true);
        } else if (profile?.role === 'assistant') {
            // Assistants go through their own flow (handled by auxFlowState)
            setAuxFlowState('waiting');
            // Do NOT advance step yet; waiting screen is part of Step 0 visual flow or overlay
        } else if (profile?.role === 'teacher') {
            setTeacherFlowState('waiting');
        } else {
            setCurrentStep(0); // Actually wait for state change
        }
        // Actualizar estado de jornada
        if (journeyId) {
            try {
                const supabase = createClient();
                const updates = {
                    updated_at: new Date().toISOString()
                };
                // Pilot completing prep → signal aux and teacher
                if (profile?.role === 'pilot') {
                    updates.mission_state = 'PILOT_READY_FOR_LOAD'; // Explicitly set state
                }
                await supabase
                    .from('staff_journeys')
                    .update(updates)
                    .eq('id', journeyId);
            } catch (e) { console.warn('Error actualizando jornada:', e); }
        }
    };

    // Handler for when aux vehicle checklist is done
    const handleAuxVehicleCheckDone = async () => {
        setAuxFlowState(null);
        setMissionState('ROUTE_READY');
        setCurrentStep(1); // En Ruta

        // Update DB
        if (journeyId) {
            const supabase = createClient();
            await supabase.from('staff_journeys').update({ mission_state: 'ROUTE_READY' }).eq('id', journeyId);
        }
    };

    // Handler when pilot is ready (from aux waiting screen)
    const handlePilotReadyForAux = useCallback(() => {
        console.log('🚀 Dashboard: Pilot ready signal received. Switching to checklist.');
        setAuxFlowState('checklist');
    }, []);

    const handleAuxConfirmed = () => {
        setWaitingForAux(false);
        // Pilot also waits for route start? No, pilot waits for En Ruta
        // Actually if Aux finished, state is ROUTE_READY.
        setCurrentStep(1);
    };

    const handleGoToReport = () => {
        setCurrentStep(3); // Report is step 3
        if (journeyId) {
            const supabase = createClient();
            supabase.from('staff_journeys')
                .update({ status: 'report', updated_at: new Date().toISOString() })
                .eq('id', journeyId)
                .then(() => { });
        }
    };

    const handleReportComplete = async () => {
        if (journeyId) {
            try {
                const supabase = createClient();
                await supabase
                    .from('staff_journeys')
                    .update({ status: 'closed', updated_at: new Date().toISOString() })
                    .eq('id', journeyId);
            } catch (e) { console.warn('Error cerrando jornada:', e); }
        }
        router.push('/staff/login');
    };

    // --- Loading / Hydration Guard ---
    if (!mounted || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    <p className="text-slate-500 font-medium">Cargando tu jornada...</p>
                </div>
            </div>
        );
    }

    // --- Error ---
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="max-w-sm text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <button onClick={handleLogout} className="text-sm text-blue-500 underline">Cerrar sesión</button>
                </div>
            </div>
        );
    }

    // --- No school today → Fallback mission selector ---
    if (noSchoolToday && showBrief) {
        return (
            <div className="min-h-screen bg-slate-50">
                <MissionBrief
                    profile={profile}
                    school={null}
                    journeyId={null}
                    userId={userId}
                    onCheckedIn={() => { }}
                    onLogout={handleLogout}
                    onRefresh={refreshMission} // [NEW] Pass refresh handler
                /* onComplete missing? No, not needed here */
                />
                {profile?.role === 'admin' && (
                    <div className="max-w-lg mx-auto px-5 pb-10">
                        <button
                            onClick={() => { setShowBrief(false); }}
                            className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all"
                        >
                            Seleccionar misión manualmente
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Legacy manual selector (after admin clicks manual selection)
    if (noSchoolToday && !showBrief) {
        return (
            <div className="min-h-screen bg-slate-50 p-4">
                <div className="max-w-md mx-auto space-y-6 pt-6">
                    {profile && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{profile.full_name}</p>
                                    <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role] || profile.role}</p>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500">
                                <LogOut size={20} />
                            </button>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-800 text-sm">No hay escuela programada hoy</p>
                            <p className="text-xs text-amber-600 mt-1">Selecciona una misión manualmente para continuar.</p>
                        </div>
                    </div>

                    <MissionSelector onSelect={handleManualMissionSelect} />
                </div>
            </div>
        );
    }


    // --- Mission Brief (first screen) ---
    // If we haven't checked in OR if we are explicitly showing brief
    if (showBrief && !manualMission) {
        return (
            <>
                <MissionBrief
                    profile={profile}
                    school={todaySchool}
                    journeyId={journeyId}
                    userId={userId}
                    // If we found a journey with check-in event, pass timestamp
                    existingCheckIn={todaySchool?.checkInTimestamp}
                    onCheckedIn={() => setShowBrief(false)}
                    onLogout={handleLogout}
                    onRefresh={refreshMission} // [NEW] Pass refresh handler
                /* onComplete? */
                />
                {journeyId && <ResetProcessButton journeyId={journeyId} />}
            </>
        );
    }

    // --- Pilot: Waiting for Aux to confirm vehicle loading ---
    if (waitingForAux && profile?.role === 'pilot') {
        return (
            <>
                <WaitingAuxLoad
                    journeyId={journeyId}
                    userId={userId}
                    profile={profile}
                    missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                    onAuxReady={handleAuxConfirmed}
                />
                {journeyId && <ResetProcessButton journeyId={journeyId} />}
            </>
        );
    }

    // --- Assistant: Waiting for pilot OR doing vehicle checklist ---
    if (profile?.role === 'assistant' && auxFlowState === 'waiting') {
        return (
            <>
                <AuxWaitingScreen
                    journeyId={journeyId}
                    userId={userId}
                    profile={profile}
                    missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                    onPilotReady={handlePilotReadyForAux}
                />
                {journeyId && <ResetProcessButton journeyId={journeyId} />}
            </>
        );
    }

    if (profile?.role === 'assistant' && auxFlowState === 'checklist') {
        return (
            <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
                {profile && journeyId && userId ? (
                    <AuxVehicleChecklist
                        journeyId={journeyId}
                        userId={userId}
                        onComplete={handleAuxVehicleCheckDone}
                        missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                    />
                ) : (
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Preparando carga de vehículo...
                        </div>
                    </div>
                )}
                {journeyId && <ResetProcessButton journeyId={journeyId} />}
            </div>
        );
    }

    if (profile?.role === 'teacher' && teacherFlowState === 'waiting') {
        return (
            <>
                <TeacherWaitingScreen
                    journeyId={journeyId}
                    userId={userId}
                    profile={profile}
                    missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                    onRouteStarted={() => {
                        setTeacherFlowState(null);
                        setCurrentStep(1);
                    }}
                />
                {journeyId && <ResetProcessButton journeyId={journeyId} />}
            </>
        );
    }

    // --- Step 2: En Ruta (Full Screen Override) ---
    if (currentStep === 1) {
        return (
            <div className="min-h-screen">
                <EnRutaScreen
                    journeyId={journeyId}
                    userId={userId}
                    role={profile?.role}
                    profile={profile}
                    missionInfo={todaySchool}
                    missionState={missionState}
                    onStateChange={(newState) => {
                        setMissionState(newState);
                        if (['ARRIVAL_PHOTO_DONE', 'OPERATION'].includes(newState)) setCurrentStep(2);
                    }}
                    onRefresh={refreshMission}
                />
                <ResetProcessButton journeyId={journeyId} />
            </div>
        );
    }

    // --- Step 0: Prep Checklist (Pilot, Assistant & Teacher) ---
    if (currentStep === 0 && (profile?.role === 'pilot' || profile?.role === 'assistant' || profile?.role === 'teacher')) {
        return (
            <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
                {profile && journeyId && userId ? (
                    <PrepChecklist
                        role={profile.role}
                        journeyId={journeyId}
                        userId={userId}
                        onComplete={handlePrepComplete}
                        missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                        preview={false} // Enable DB writes to Test Journey
                    />
                ) : (
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Preparando jornada...
                        </div>
                    </div>
                )}
                {journeyId && <ResetProcessButton journeyId={journeyId} />}
            </div>
        );
    }

    // --- Main Stepper View ---
    return (
        <div className="min-h-screen bg-slate-50">
            <ResetProcessButton journeyId={journeyId} />

            {/* Test Mode Banner */}
            {isTestMode && (
                <div className="bg-amber-400 text-black px-4 py-2 flex items-center justify-between shadow-sm sticky top-0 z-50">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-bold text-sm">MODO TEST (REALTIME)</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                if (confirm('¿Reiniciar estado de la misión de prueba?')) {
                                    await resetTestJourney();
                                    window.location.reload();
                                }
                            }}
                            className="bg-black/10 hover:bg-black/20 px-3 py-1 rounded-full text-xs font-bold transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleExitTestMode}
                            className="bg-black/10 hover:bg-black/20 px-3 py-1 rounded-full text-xs font-bold transition-colors"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="bg-white border-b border-slate-100 px-4 py-3">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        {currentStep > 0 && (
                            <button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} className="p-1 hover:bg-slate-100 rounded-full">
                                <ChevronLeft size={20} className="text-slate-600" />
                            </button>
                        )}
                        <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-sm">{profile?.full_name}</p>
                            <p className="text-[10px] text-slate-400">{ROLE_LABELS[profile?.role]} • {todaySchool?.school_name}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-50">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Stepper Indicator */}
            <div className="bg-white border-b border-slate-100 px-4 py-3">
                <div className="max-w-lg mx-auto flex items-center gap-2">
                    {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isActive = idx === currentStep;
                        const isCompleted = idx < currentStep;

                        return (
                            <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
                                <div className={`w-full h-1.5 rounded-full transition-colors ${isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-slate-200'
                                    }`} />
                                <div className="flex items-center gap-1.5">
                                    <Icon size={14} className={`${isCompleted ? 'text-green-500' : isActive ? 'text-blue-600' : 'text-slate-400'
                                        }`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCompleted ? 'text-green-600' : isActive ? 'text-blue-600' : 'text-slate-400'
                                        }`}>{step.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* School Info Bar */}
            {todaySchool && (
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
                    <div className="max-w-lg mx-auto flex items-center gap-2 text-sm">
                        <MapPin size={14} className="text-blue-500" />
                        <span className="font-medium text-blue-700 truncate">{todaySchool.school_name}</span>
                        {todaySchool.colonia && (
                            <span className="text-blue-400 text-xs truncate">• {todaySchool.colonia}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Step Content */}
            <div className="max-w-lg mx-auto px-4 py-6">
                {/* PASO 1: Montaje (non-pilot roles) */}
                {currentStep === 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="text-xl font-bold text-slate-900 mb-1">Pre-Jornada</h2>
                        <p className="text-sm text-slate-500 mb-6">Completa tu checklist antes de salir a campo.</p>

                        {profile && journeyId && userId && (
                            <PrepChecklist
                                role={profile.role}
                                journeyId={journeyId}
                                userId={userId}
                                onComplete={handlePrepComplete}
                                missionInfo={{ ...todaySchool, profile }}
                                preview={false} // Enable DB writes to Test Journey
                            />
                        )}

                        {!journeyId && (
                            <div className="text-center py-8 text-slate-400">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                Preparando jornada...
                            </div>
                        )}
                    </div>
                )}

                {/* PASO 2: En Ruta (Moved to Full Screen Above) */}

                {/* PASO 3: Operación */}
                {currentStep === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <StaffOperationLegacy
                            initialMission={todaySchool}
                            onCloseDay={handleGoToReport}
                            hideMenu={false}
                            journeyId={journeyId}
                            userId={userId}
                            profile={profile}
                            missionState={missionState}
                            onRefresh={refreshMission}
                        />
                    </div>
                )}

                {/* PASO 4: Reporte */}
                {currentStep === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <ClosureLegacy onComplete={handleReportComplete} />
                    </div>
                )}
            </div>
        </div>
    );
}
