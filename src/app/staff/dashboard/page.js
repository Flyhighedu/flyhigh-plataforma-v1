'use client';

// =====================================================
// Staff Dashboard — Stepper Shell V1
// 3 pasos: Montaje → Operación → Reporte
// Auto-detecta escuela del día desde proximas_escuelas
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ClipboardList, Plane, FileText, Loader2, AlertCircle, MapPin, Calendar, LogOut, ChevronLeft, User, Truck, School, RefreshCw } from 'lucide-react';
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
import DropzoneWaitingScreen from '@/components/staff/DropzoneWaitingScreen';
import DropzoneActionScreen from '@/components/staff/DropzoneActionScreen';
import UnloadAssignmentActionScreen from '@/components/staff/UnloadAssignmentActionScreen';
import WaitingUnloadAssignmentScreen from '@/components/staff/WaitingUnloadAssignmentScreen';
import PilotPrepareFlightScreen from '@/components/staff/PilotPrepareFlightScreen';
import UnloadScreen from '@/components/staff/UnloadScreen';
import AuxParkingVehicleScreen from '@/components/staff/AuxParkingVehicleScreen';
import AuxAdWallInstallScreen from '@/components/staff/AuxAdWallInstallScreen';
import TeacherCivicNotificationScreen from '@/components/staff/TeacherCivicNotificationScreen';
import PilotOperationalWaitScreen from '@/components/staff/PilotOperationalWaitScreen';
import SeatDeploymentScreen from '@/components/staff/SeatDeploymentScreen';
import HeadphonesSetupScreen from '@/components/staff/HeadphonesSetupScreen';
import GlassesSetupScreen from '@/components/staff/GlassesSetupScreen';
import PilotMusicAmbienceScreen from '@/components/staff/PilotMusicAmbienceScreen';
import TeacherOperationReadyScreen from '@/components/staff/TeacherOperationReadyScreen';
import AuxOperationReadyScreen from '@/components/staff/AuxOperationReadyScreen';
import OperationStartBridgeScreen from '@/components/staff/OperationStartBridgeScreen';
import OperationPanelConstructionScreen from '@/components/staff/OperationPanelConstructionScreen';
import TeacherCivicParallelScreen from '@/components/staff/TeacherCivicParallelScreen';
import AuxCivicEvidenceParallelScreen from '@/components/staff/AuxCivicEvidenceParallelScreen';
import AdWallDismantleScreen from '@/components/staff/AdWallDismantleScreen';
import DroneStorageScreen from '@/components/staff/DroneStorageScreen';
import GlassesStorageScreen from '@/components/staff/GlassesStorageScreen';
import HeadphonesStorageScreen from '@/components/staff/HeadphonesStorageScreen';
import SeatFoldingScreen from '@/components/staff/SeatFoldingScreen';
import VehiclePositioningScreen from '@/components/staff/VehiclePositioningScreen';
import GlobalLoadingScreen from '@/components/staff/GlobalLoadingScreen';
import MomentoDeCargarScreen from '@/components/staff/MomentoDeCargarScreen';
import ReturnRouteScreen from '@/components/staff/ReturnRouteScreen';
import ArrivalNotificationScreen from '@/components/staff/ArrivalNotificationScreen';
import ApoyoBodegaScreen from '@/components/staff/ApoyoBodegaScreen';
import EquipmentUnloadScreen from '@/components/staff/EquipmentUnloadScreen';
import ReturnInventoryScreen from '@/components/staff/ReturnInventoryScreen';
import ChargingStationScreen from '@/components/staff/ChargingStationScreen';
import AuxRecordingChargingScreen from '@/components/staff/AuxRecordingChargingScreen';
import FinalParkingScreen from '@/components/staff/FinalParkingScreen';
import CheckoutScreen from '@/components/staff/CheckoutScreen';
import TaskErrorBoundary from '@/components/staff/TaskErrorBoundary';
import ContingencyBypassMenu from '@/components/staff/ContingencyBypassMenu';

import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { ensureTestJourney, resetTestJourney, TEST_JOURNEY_ID } from '@/utils/testModeUtils';
import { clearJourneyLocalOperationalData } from '@/utils/staff/resetJourneyLocalData';
import HeaderHamburgerMenu from '@/components/staff/HeaderHamburgerMenu';
import useBackgroundSync from '@/hooks/useBackgroundSync';
import { saveLocalProgress, getLocalProgress } from '@/utils/offlineSyncManager';

import { STAFF_STEPS } from '@/constants/staffSteps';
import { parseMeta, shouldLockPilot, isPilotReady } from '@/utils/metaHelpers';
import DependencyTransitionOverlay from '@/components/staff/DependencyTransitionOverlay';
import useDependencyTransition from '@/hooks/useDependencyTransition';
import { getTransitionCopy } from '@/utils/transitionCopyMap';
import {
    DISMANTLING_ROUTE_IDS,
    resolveDismantlingRoute,
    normalizeDismantlingRole
} from '@/utils/dismantlingRouting';

const STEPS = [
    { id: 'prep', label: 'Montaje', icon: ClipboardList },
    { id: 'en_ruta', label: 'En Ruta', icon: Truck },
    { id: 'operation', label: 'Operación', icon: Plane },
    { id: 'report', label: 'Reporte', icon: FileText },
];

const TEACHER_LOAD_PHASE_STATES = new Set([
    'AUX_CONTAINERS_DONE',
    'ROUTE_READY',
    'ROUTE_IN_PROGRESS',
    'IN_ROUTE',
    'WAITING_AUX_VEHICLE_CHECK',
    'PILOT_READY_FOR_LOAD'
]);

const ASSISTANT_CIVIC_PENDING_STATUSES = new Set([
    'pending_recording',
    'recording',
    'pending_upload',
    'uploading',
    'failed'
]);

const LISTENER_STEP_ONE_STATES = new Set([
    'ROUTE_READY',
    'IN_ROUTE',
    'ROUTE_IN_PROGRESS',
    'waiting_dropzone',
    'unload',
    'waiting_unload_assignment',
    'post_unload_coordination',
    'seat_deployment',
    'ARRIVAL_PHOTO_DONE',
    'OPERATION'
]);

const AUX_WAITING_AUTO_CHECKLIST_STATES = new Set([
    'WAITING_AUX_VEHICLE_CHECK',
    'PILOT_READY_FOR_LOAD',
    'AUX_CONTAINERS_DONE',
    'ROUTE_READY',
    'OPERATION'
]);

const PILOT_WAITING_AUX_RELEASE_STATES = new Set([
    'AUX_CONTAINERS_DONE',
    'ROUTE_IN_PROGRESS',
    'IN_ROUTE',
    'ROUTE_READY'
]);

const PILOT_WAITING_FOR_AUX_STATES = new Set([
    'PILOT_READY_FOR_LOAD',
    'WAITING_AUX_VEHICLE_CHECK',
    'AUX_CONTAINERS_DONE'
]);

const PILOT_CONNECT_PHASE_STATES = new Set([
    'ARRIVAL_PHOTO_DONE',
    'waiting_unload_assignment',
    'waiting_dropzone',
    'unload',
    'post_unload_coordination',
    'seat_deployment',
    'OPERATION',
    'operation'
]);

const TEACHER_WAITING_ROUTE_RELEASE_STATES = new Set([
    'AUX_CONTAINERS_DONE',
    'ROUTE_READY',
    'IN_ROUTE',
    'ROUTE_IN_PROGRESS'
]);

const TEACHER_CIVIC_LOCK_AUDIO_STATUSES = new Set([
    'recording',
    'uploading',
    'pending_upload',
    'failed'
]);

function firstNameOrFallback(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

function normalizeMeta(meta) {
    if (!meta) return Object.create(null);

    if (typeof meta === 'string') {
        try {
            const parsed = JSON.parse(meta);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return Object.create(null);
            }
            return parsed;
        } catch {
            return Object.create(null);
        }
    }

    if (typeof meta === 'object' && !Array.isArray(meta)) {
        return meta;
    }

    return Object.create(null);
}

function getTeacherWaitPhase(missionState) {
    return TEACHER_LOAD_PHASE_STATES.has(missionState) ? 'load' : 'warehouse';
}

function normalizeTeacherCivicStageLock(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['seat', 'headphones', 'glasses'].includes(normalized) ? normalized : null;
}

function resolveTeacherCivicStage(meta, missionState) {
    if (String(missionState || '').trim() !== 'seat_deployment') return null;

    const safeMeta = normalizeMeta(meta);
    const seatDone = safeMeta.global_seat_deployment_done === true;
    const headphonesDone = safeMeta.global_headphones_done === true;
    const glassesDone = safeMeta.global_glasses_done === true;

    if (seatDone && headphonesDone && !glassesDone) return 'glasses';
    if (seatDone && !headphonesDone) return 'headphones';
    return 'seat';
}

function shouldKeepTeacherCivicStageLocked(role, missionState, meta) {
    if (role !== 'teacher') return false;
    if (String(missionState || '').trim() !== 'seat_deployment') return false;

    const safeMeta = normalizeMeta(meta);
    const stageLock = normalizeTeacherCivicStageLock(safeMeta.civic_parallel_teacher_stage_lock);
    if (!stageLock) return false;

    const audioStatus = String(safeMeta.civic_parallel_teacher_audio_status || 'idle').trim().toLowerCase();
    const teacherCivicDone =
        Boolean(safeMeta.civic_parallel_teacher_done_at) ||
        audioStatus === 'uploaded';

    return !teacherCivicDone && TEACHER_CIVIC_LOCK_AUDIO_STATUSES.has(audioStatus);
}

function hasPendingPilotControllerConnect(missionState, meta) {
    const safeMeta = meta || Object.create(null);
    const spotAtMs = Date.parse(safeMeta.pilot_spot_set_at || '');
    const prepAtMs = Date.parse(safeMeta.pilot_prep_complete_at || '');
    const controllerAtMs = Date.parse(safeMeta.pilot_controller_connected_at || '');
    const audioAtMs = Date.parse(safeMeta.pilot_audio_configured_at || '');
    const hasChecklistForCurrentSpot =
        Number.isFinite(spotAtMs) &&
        Number.isFinite(prepAtMs) &&
        prepAtMs >= spotAtMs;

    const hasControllerForCurrentSpot =
        hasChecklistForCurrentSpot &&
        safeMeta.pilot_controller_connected === true &&
        (!Number.isFinite(controllerAtMs) || controllerAtMs >= prepAtMs);

    const hasAudioForCurrentSpot =
        hasControllerForCurrentSpot &&
        safeMeta.pilot_audio_configured === true &&
        (!Number.isFinite(audioAtMs) || audioAtMs >= (Number.isFinite(controllerAtMs) ? controllerAtMs : prepAtMs));

    return (
        PILOT_CONNECT_PHASE_STATES.has(missionState) &&
        hasChecklistForCurrentSpot &&
        !hasAudioForCurrentSpot
    );
}

function getVisibleTaskKey(snapshot) {
    const role = snapshot.profileRole;
    const missionState = snapshot.missionState;
    const currentStep = Number.isFinite(snapshot.currentStep) ? snapshot.currentStep : 0;
    const meta = normalizeMeta(snapshot.missionMeta);
    const arrivalPhotoTakenAt = snapshot.arrivalPhotoTakenAt || null;

    if (missionState === 'dismantling') {
        const dismantlingRoute = resolveDismantlingRoute(role, meta);
        return `closure:${dismantlingRoute.routeKey}`;
    }

    if (snapshot.showBrief) {
        return 'brief:mission';
    }

    if (shouldLockPilot(role, missionState, meta, arrivalPhotoTakenAt)) {
        return 'pilot:fortress';
    }

    const pilotNeedsControllerConnect =
        role === 'pilot' &&
        hasPendingPilotControllerConnect(missionState, meta);

    if (pilotNeedsControllerConnect) {
        const prepAtMs = Date.parse(meta.pilot_prep_complete_at || '');
        const controllerAtMs = Date.parse(meta.pilot_controller_connected_at || '');
        const controllerConnectedForCurrentSpot =
            Number.isFinite(prepAtMs) &&
            meta.pilot_controller_connected === true &&
            (!Number.isFinite(controllerAtMs) || controllerAtMs >= prepAtMs);

        return controllerConnectedForCurrentSpot ? 'pilot:configure_audio' : 'pilot:connect_controller';
    }

    if (snapshot.waitingForAux && role === 'pilot') {
        return 'pilot:waiting_aux_load';
    }

    if (role === 'assistant' && snapshot.auxFlowState === 'waiting') {
        return 'assistant:waiting_pilot';
    }

    if (role === 'assistant' && snapshot.auxFlowState === 'checklist') {
        return 'assistant:vehicle_checklist';
    }

    if (role === 'teacher' && snapshot.teacherFlowState === 'waiting') {
        return `teacher:waiting:${getTeacherWaitPhase(missionState)}`;
    }

    const teacherCivicConfirmed = meta.teacher_civic_notified === true;
    const civicParallelInProgress = meta.civic_parallel_status === 'in_progress';
    const teacherCivicSkipped =
        meta.civic_parallel_teacher_skipped === true ||
        Boolean(meta.civic_parallel_teacher_skipped_at);
    const teacherCivicDone =
        teacherCivicSkipped ||
        Boolean(meta.civic_parallel_teacher_done_at) ||
        meta.civic_parallel_teacher_audio_status === 'uploaded';
    const assistantCivicStatus = meta.civic_parallel_aux_status || null;
    const assistantCivicSkipped =
        meta.civic_parallel_aux_skipped === true ||
        Boolean(meta.civic_parallel_aux_skipped_at) ||
        String(assistantCivicStatus || '').trim().toLowerCase() === 'skipped';
    const assistantNeedsCivicPanel =
        (civicParallelInProgress || meta.is_recording_standby === true) &&
        !assistantCivicSkipped &&
        (!assistantCivicStatus || ASSISTANT_CIVIC_PENDING_STATUSES.has(assistantCivicStatus));
    const teacherCivicStageLock = normalizeTeacherCivicStageLock(meta.civic_parallel_teacher_stage_lock);
    const teacherCivicStageLocked = shouldKeepTeacherCivicStageLocked(role, missionState, meta);

    const shouldShowTeacherCivicParallel =
        role === 'teacher' &&
        teacherCivicConfirmed &&
        meta.civic_parallel_use_legacy_panel === true &&
        !teacherCivicSkipped &&
        !teacherCivicDone &&
        (snapshot.teacherCivicPanelOpen || (civicParallelInProgress && !snapshot.teacherCivicPanelDismissed));

    if (shouldShowTeacherCivicParallel) {
        return 'teacher:civic_parallel';
    }

    const shouldShowAssistantCivicParallel =
        role === 'assistant' &&
        assistantNeedsCivicPanel &&
        !snapshot.assistantCivicPanelDismissed;

    if (shouldShowAssistantCivicParallel) {
        return 'assistant:civic_parallel';
    }

    // [FIX] Phase-independent fallback: If the assistant hasn't finished the ad wall,
    // force them back to it regardless of what phase the rest of the team advanced to.
    if (role === 'assistant' && meta.aux_ready_seat_deployment === true && meta.aux_ad_wall_done !== true) {
        return 'assistant:ad_wall_install';
    }

    const postGlassesKickoffActive =
        missionState === 'seat_deployment' &&
        meta.global_glasses_done === true;

    if (teacherCivicStageLocked) {
        return `teacher:civic_locked:${teacherCivicStageLock || resolveTeacherCivicStage(meta, missionState) || 'seat'}`;
    }

    if (postGlassesKickoffActive && meta.operation_start_bridge_at) {
        return 'global:operation_start_bridge';
    }

    if (postGlassesKickoffActive) {
        if (role === 'pilot') return 'pilot:music_ambience';
        if (role === 'teacher') return 'teacher:operation_ready';
        if (role === 'assistant') return 'assistant:operation_ready';
        return 'global:operation_kickoff';
    }

    if (currentStep === 1) {
        if (missionState === 'unload') {
            return `step1:unload:${role || 'unknown'}`;
        }

        if (missionState === 'post_unload_coordination') {
            if (role === 'pilot') return 'pilot:seat_deployment';
            if (role === 'assistant') return 'assistant:parking_vehicle';
            if (role === 'teacher') return 'teacher:civic_notification';
            return `step1:post_unload_wait:${role || 'unknown'}`;
        }

        if (missionState === 'seat_deployment') {
            const auxReady = meta.aux_ready_seat_deployment === true;
            const adWallDone = meta.aux_ad_wall_done === true;
            const teacherReady = meta.teacher_civic_notified === true;
            const seatDone = meta.global_seat_deployment_done === true;
            const headphonesDone = meta.global_headphones_done === true;
            const glassesDone = meta.global_glasses_done === true;

            if (role === 'assistant' && !auxReady) return 'assistant:parking_vehicle';
            if (role === 'assistant' && auxReady && !adWallDone) return 'assistant:ad_wall_install';
            if (role === 'teacher' && !teacherReady) return 'teacher:civic_notification';

            if (seatDone && !headphonesDone) {
                return `global:headphones_setup:${role || 'unknown'}`;
            }

            if (seatDone && headphonesDone && !glassesDone) {
                return `global:glasses_setup:${role || 'unknown'}`;
            }

            return `step1:seat_deployment:${role || 'unknown'}`;
        }

        if (missionState === 'waiting_dropzone') {
            if (role === 'assistant') return 'assistant:dropzone_action';
            return `step1:dropzone_waiting:${role || 'unknown'}`;
        }

        if (missionState === 'waiting_unload_assignment') {
            if (role === 'teacher') return 'teacher:unload_assignment_action';
            return `step1:waiting_unload_assignment:${role || 'unknown'}`;
        }

        if (role === 'teacher') {
            if (missionState === 'IN_ROUTE' || missionState === 'ROUTE_IN_PROGRESS') {
                return 'teacher:en_route_travel';
            }

            return `teacher:waiting:${getTeacherWaitPhase(missionState)}`;
        }

        return `step1:en_ruta:${role || 'unknown'}:${missionState || 'unknown'}`;
    }

    if (currentStep === 0 && ['pilot', 'assistant', 'teacher'].includes(role)) {
        return `step0:prep_checklist:${role}`;
    }

    if (currentStep === 2) {
        return `step2:operation:${role || 'unknown'}`;
    }

    if (currentStep === 3) {
        return `flow:completed:${role || 'unknown'}`;
    }

    return `stepper:step${currentStep}:${role || 'unknown'}:${missionState || 'unknown'}`;
}

function projectSnapshotForRealtimeUpdate(snapshot, nextState, incomingMeta, arrivalPhotoTakenAt) {
    const projected = {
        ...snapshot,
        missionState: nextState,
        missionMeta: incomingMeta,
        arrivalPhotoTakenAt: arrivalPhotoTakenAt || snapshot.arrivalPhotoTakenAt || null
    };

    if (nextState === 'dismantling') {
        projected.waitingForAux = false;
        projected.auxFlowState = null;
        projected.teacherFlowState = null;
        projected.currentStep = 2;
    }

    if (
        projected.profileRole === 'assistant' &&
        projected.auxFlowState === 'waiting' &&
        AUX_WAITING_AUTO_CHECKLIST_STATES.has(nextState)
    ) {
        projected.auxFlowState = 'checklist';
    }

    if (
        projected.profileRole === 'pilot'
    ) {
        const pilotNeedsControllerConnect = hasPendingPilotControllerConnect(nextState, incomingMeta);

        if (pilotNeedsControllerConnect) {
            projected.waitingForAux = false;
        } else if (PILOT_WAITING_FOR_AUX_STATES.has(nextState)) {
            projected.waitingForAux = true;
        } else if (projected.waitingForAux && PILOT_WAITING_AUX_RELEASE_STATES.has(nextState)) {
            projected.waitingForAux = false;
            projected.currentStep = Math.max(Number(projected.currentStep) || 0, 1);
        } else if (LISTENER_STEP_ONE_STATES.has(nextState) || nextState === 'report' || nextState === 'dismantling') {
            projected.waitingForAux = false;
        }
    }

    if (
        projected.profileRole === 'teacher' &&
        projected.teacherFlowState === 'waiting' &&
        TEACHER_WAITING_ROUTE_RELEASE_STATES.has(nextState)
    ) {
        projected.teacherFlowState = null;
        projected.currentStep = Math.max(Number(projected.currentStep) || 0, 1);
    }

    if (projected.currentCheckIn) {
        const isPilotLocked = shouldLockPilot(
            projected.profileRole,
            nextState,
            incomingMeta,
            projected.arrivalPhotoTakenAt || null
        );

        if (isPilotLocked) {
            if ((Number(projected.currentStep) || 0) < 1) {
                projected.currentStep = 1;
            }
            return projected;
        }

        if (LISTENER_STEP_ONE_STATES.has(nextState) && (Number(projected.currentStep) || 0) < 1) {
            projected.currentStep = 1;
        }

        if (LISTENER_STEP_ONE_STATES.has(nextState)) {
            projected.auxFlowState = null;
            projected.teacherFlowState = null;
        }

        if (nextState === 'OPERATION') {
            projected.currentStep = 2;
        }

        if (nextState === 'dismantling') {
            projected.currentStep = 2;
        }

    }

    return projected;
}

export default function StaffDashboard() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [todaySchool, setTodaySchool] = useState(null);
    const [todaySchools, setTodaySchools] = useState([]);
    const [lobbyMode, setLobbyMode] = useState(true);
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
    const [isStartingClosureFlow, setIsStartingClosureFlow] = useState(false);
    const [directOperationMode, setDirectOperationMode] = useState(false);
    const [teacherCivicPanelOpen, setTeacherCivicPanelOpen] = useState(false);
    const [teacherCivicPanelDismissed, setTeacherCivicPanelDismissed] = useState(false);
    const [assistantCivicPanelDismissed, setAssistantCivicPanelDismissed] = useState(false);
    const [civicModalVisible, setCivicModalVisible] = useState(false);
    const prevCivicNotifiedRef = useRef(false);
    const civicModalDismissedRef = useRef(false);

    // Background sync for offline-first uploads
    const { pendingCount, isSyncing, lastSyncResult, syncNow } = useBackgroundSync();

    const profileRef = useRef(profile);
    const missionStateRef = useRef(missionState);
    const checkInRef = useRef(checkInTimestamp);
    const currentStepRef = useRef(currentStep);
    const isPilotLockedRef = useRef(false);
    const todaySchoolRef = useRef(todaySchool);
    const showBriefRef = useRef(showBrief);
    const waitingForAuxRef = useRef(waitingForAux);
    const auxFlowStateRef = useRef(auxFlowState);
    const teacherFlowStateRef = useRef(teacherFlowState);
    const teacherCivicPanelOpenRef = useRef(teacherCivicPanelOpen);
    const teacherCivicPanelDismissedRef = useRef(teacherCivicPanelDismissed);
    const assistantCivicPanelDismissedRef = useRef(assistantCivicPanelDismissed);

    // ── Dependency Transition Overlay ──
    const { overlayData, triggerTransition } = useDependencyTransition();
    const prevMissionStateRef = useRef(missionState);
    useEffect(() => { prevMissionStateRef.current = missionState; }, [missionState]);

    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { missionStateRef.current = missionState; }, [missionState]);
    useEffect(() => { checkInRef.current = checkInTimestamp; }, [checkInTimestamp]);
    useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
    useEffect(() => { todaySchoolRef.current = todaySchool; }, [todaySchool]);
    useEffect(() => { showBriefRef.current = showBrief; }, [showBrief]);
    useEffect(() => { waitingForAuxRef.current = waitingForAux; }, [waitingForAux]);
    useEffect(() => { auxFlowStateRef.current = auxFlowState; }, [auxFlowState]);
    useEffect(() => { teacherFlowStateRef.current = teacherFlowState; }, [teacherFlowState]);
    useEffect(() => { teacherCivicPanelOpenRef.current = teacherCivicPanelOpen; }, [teacherCivicPanelOpen]);
    useEffect(() => { teacherCivicPanelDismissedRef.current = teacherCivicPanelDismissed; }, [teacherCivicPanelDismissed]);
    useEffect(() => { assistantCivicPanelDismissedRef.current = assistantCivicPanelDismissed; }, [assistantCivicPanelDismissed]);

    useEffect(() => {
        if (missionState !== 'dismantling') return;

        if (waitingForAuxRef.current) setWaitingForAux(false);
        if (auxFlowStateRef.current) setAuxFlowState(null);
        if (teacherFlowStateRef.current) setTeacherFlowState(null);
        if (teacherCivicPanelOpenRef.current) setTeacherCivicPanelOpen(false);

        if ((Number(currentStepRef.current) || 0) !== 2) {
            setCurrentStep(2);
        }
    }, [missionState]);

    const buildListenerSnapshot = useCallback((overrides = {}) => {
        const missionInfo = todaySchoolRef.current || Object.create(null);

        return {
            profileRole: profileRef.current?.role || null,
            showBrief: showBriefRef.current,
            currentStep: currentStepRef.current,
            currentCheckIn: Boolean(checkInRef.current),
            missionState: missionStateRef.current,
            waitingForAux: waitingForAuxRef.current,
            auxFlowState: auxFlowStateRef.current,
            teacherFlowState: teacherFlowStateRef.current,
            missionMeta: missionInfo.meta,
            arrivalPhotoTakenAt: missionInfo.arrival_photo_taken_at || null,
            teacherCivicPanelOpen: teacherCivicPanelOpenRef.current,
            teacherCivicPanelDismissed: teacherCivicPanelDismissedRef.current,
            assistantCivicPanelDismissed: assistantCivicPanelDismissedRef.current,
            ...overrides
        };
    }, []);

    // ── [FORTRESS] Stabilize Pilot Lock status via Ref ──
    useEffect(() => {
        const lockValue = shouldLockPilot(
            profile?.role,
            missionState,
            todaySchool?.meta,
            todaySchool?.arrival_photo_taken_at
        );
        if (lockValue !== isPilotLockedRef.current) {
            console.log(`🛡️ Fortress Lock Toggle: ${lockValue} (State: ${missionState}, Role: ${profile?.role})`);
            isPilotLockedRef.current = lockValue;
        }
    }, [profile, todaySchool, missionState]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOpenCivicParallel = (event) => {
            const eventJourneyId = event?.detail?.journeyId;
            if (eventJourneyId && String(eventJourneyId) !== String(journeyId)) return;
            if (profileRef.current?.role !== 'teacher') return;

            setTeacherCivicPanelOpen(true);
            setTeacherCivicPanelDismissed(false);
        };

        window.addEventListener('flyhigh:civic:open', handleOpenCivicParallel);
        return () => window.removeEventListener('flyhigh:civic:open', handleOpenCivicParallel);
    }, [journeyId]);

    useEffect(() => {
        const meta = parseMeta(todaySchool?.meta);
        const civicInProgress = meta.civic_parallel_status === 'in_progress';

        if (!civicInProgress && !meta.is_recording_standby) {
            setTeacherCivicPanelOpen(false);
            setTeacherCivicPanelDismissed(false);
            setAssistantCivicPanelDismissed(false);
        }
    }, [todaySchool?.meta]);

    // ── Phase 1: Full-screen modal notification for Auxiliary when teacher confirms civic act ──
    useEffect(() => {
        if (profile?.role !== 'assistant') return;
        const meta = parseMeta(todaySchool?.meta);
        const isNotified = meta.teacher_civic_notified === true;

        // GUARD: Never show modal if recording is already complete
        const auxStatus = meta.civic_parallel_aux_status;
        const isRecordingComplete = auxStatus === 'uploaded' || auxStatus === 'completed' || auxStatus === 'done';
        if (isRecordingComplete) return;

        // GUARD: Already shown and dismissed — never re-show (survives re-renders)
        if (civicModalDismissedRef.current) return;

        // GUARD: Already triggered once this lifecycle — permanent one-shot
        if (prevCivicNotifiedRef.current) return;

        if (isNotified) {
            prevCivicNotifiedRef.current = true;
            setCivicModalVisible(true);
            // Haptic: double vibration
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            // Audio: notification beep
            try {
                const sr = 44100, dur = 0.15, freq = 880;
                const n = Math.floor(sr * dur);
                const buf = new ArrayBuffer(44 + n * 2);
                const dv = new DataView(buf);
                const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
                ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
                dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
                dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
                dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
                for (let i = 0; i < n; i++) {
                    const t = i / sr, env = Math.min(1, (dur - t) * 15);
                    dv.setInt16(44 + i * 2, Math.sin(2 * Math.PI * freq * t) * 0.35 * env * 32767, true);
                }
                const bytes = new Uint8Array(buf);
                let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
                new Audio('data:audio/wav;base64,' + btoa(bin)).play().catch(() => { });
            } catch { }
        }
    }, [todaySchool?.meta, profile?.role]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // [PERSIST] Save step/state to IndexedDB on every change for crash recovery
    useEffect(() => {
        if (!journeyId || !mounted) return;
        saveLocalProgress(journeyId, {
            currentStep,
            missionState,
            role: profile?.role || null,
            showBrief,
            auxFlowState,
            teacherFlowState,
            checkInDone: Boolean(checkInTimestamp)
        });
    }, [journeyId, currentStep, missionState, showBrief, auxFlowState, teacherFlowState, mounted, profile?.role, checkInTimestamp]);

    // ── REUSABLE FETCH FUNCTION (For Manual Refresh) ──
    // ── PHASE A: FETCH ALL TODAY'S SCHOOLS (LOBBY) ──
    const refreshMission = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        console.log('🔄 Refreshing Mission Data (Lobby)...');

        try {
            const supabase = createClient();
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

            // Fetch ALL schools for today (no limit)
            const { data: scheduled } = await supabase
                .from('proximas_escuelas')
                .select('*')
                .eq('fecha_programada', today)
                .in('estatus', ['pendiente', 'en_progreso', 'completada', 'cerrada'])
                .order('id', { ascending: true });

            const schools = (scheduled || []).map(school => ({
                id: school.id,
                school_name: school.nombre_escuela,
                colonia: school.colonia,
                fecha: school.fecha_programada,
                pilot_id: school.pilot_id,
                teacher_id: school.teacher_id,
                aux_id: school.aux_id,
                estatus: school.estatus,
                presence: [], // will be populated below
            }));

            // Fetch presence for all today's schools
            if (schools.length > 0) {
                const schoolIds = schools.map(s => s.id);
                const { data: journeys } = await supabase
                    .from('staff_journeys')
                    .select('id, school_id')
                    .eq('date', today)
                    .in('school_id', schoolIds);

                if (journeys && journeys.length > 0) {
                    const journeyIds = journeys.map(j => j.id);
                    const { data: presenceData } = await supabase
                        .from('staff_presence')
                        .select('journey_id, role, is_online')
                        .in('journey_id', journeyIds)
                        .eq('is_online', true);

                    // Map presence to schools
                    if (presenceData) {
                        const journeyToSchool = {};
                        journeys.forEach(j => { journeyToSchool[j.id] = j.school_id; });

                        schools.forEach(school => {
                            school.presence = presenceData.filter(p => {
                                const schoolId = journeyToSchool[p.journey_id];
                                return schoolId === school.id;
                            });
                        });
                    }
                }
            }

            setTodaySchools(schools);

            if (schools.length === 0) {
                setNoSchoolToday(true);
                setTodaySchool(null);
                localStorage.removeItem('flyhigh_staff_mission');
            } else {
                setNoSchoolToday(false);
                // Check if there's a previously selected mission this session
                const savedId = localStorage.getItem('flyhigh_selected_mission_id');
                const match = savedId ? schools.find(s => String(s.id) === savedId) : null;
                const matchIsCompleted = match && (match.estatus === 'completada' || match.estatus === 'cerrada');
                if (match && !matchIsCompleted) {
                    // Auto-resume the previously selected mission
                    await selectMission(match);
                    return;
                }
                if (matchIsCompleted) {
                    // Don't auto-resume into a completed mission
                    localStorage.removeItem('flyhigh_selected_mission_id');
                }
                // Otherwise stay in lobby mode — user must pick
            }
        } catch (error) {
            console.error('Error refreshing mission:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, profile]);

    // ── PHASE B: SELECT A SPECIFIC MISSION FROM LOBBY ──
    const selectMission = useCallback(async (school) => {
        setLoading(true);
        setLobbyMode(false);
        localStorage.setItem('flyhigh_selected_mission_id', String(school.id));

        try {
            const supabase = createClient();
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

            // Fetch staff names for this school
            const staffIds = [school.pilot_id, school.teacher_id, school.aux_id].filter(Boolean);
            let staffMap = {};

            if (staffIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('staff_profiles')
                    .select('user_id, full_name')
                    .in('user_id', staffIds);

                if (profiles) {
                    profiles.forEach(p => {
                        staffMap[p.user_id] = p.full_name;
                    });
                }
            }

            const schoolData = {
                ...school,
                pilot_name: staffMap[school.pilot_id] || 'Por asignar',
                teacher_name: staffMap[school.teacher_id] || 'Por asignar',
                aux_name: staffMap[school.aux_id] || 'Por asignar',
            };

            setTodaySchool(schoolData);
            localStorage.setItem('flyhigh_staff_mission', JSON.stringify(schoolData));
            setNoSchoolToday(false);

            // 2. Get Journey (rest of the logic continues from the original function)
            const { data: journeyData } = await supabase
                .from('staff_journeys')
                .select('id, mission_state, meta, status, arrival_photo_taken_at')
                .eq('date', today)
                .eq('school_id', school.id)
                .single();

            if (journeyData) {
                setJourneyId(journeyData.id);
                const state = journeyData.mission_state;
                const meta = parseMeta(journeyData.meta);

                setMissionState(state);
                setTodaySchool(prev => ({
                    ...prev,
                    meta,
                    arrival_photo_taken_at: journeyData.arrival_photo_taken_at || null
                }));

                // ── [NEW] Fetch Active Staff Participants (via Check-ins AND Presence) ──

                // 1. Register SELF as Present immediately
                if (profile && journeyData.id) {
                    await supabase
                        .from('staff_presence')
                        .upsert({
                            user_id: profile.user_id,
                            journey_id: journeyData.id,
                            role: profile.role,
                            is_online: true,
                            last_seen_at: new Date().toISOString()
                        }, { onConflict: 'user_id' });
                }

                // 2. Fetch Check-ins (for status)
                const { data: checkIns } = await supabase
                    .from('staff_prep_events')
                    .select('user_id, created_at')
                    .eq('journey_id', journeyData.id)
                    .eq('event_type', 'checkin');

                // 3. Fetch Presence (for names even before check-in)
                const { data: presenceList } = await supabase
                    .from('staff_presence')
                    .select('user_id, role')
                    .eq('journey_id', journeyData.id);

                // Combine unique User IDs
                const checkInIds = checkIns?.map(c => c.user_id) || [];
                const presenceIds = presenceList?.map(p => p.user_id) || [];
                const allParticipantIds = [...new Set([...checkInIds, ...presenceIds])];

                // Add CURRENT USER explicitly if not in list (to ensure local display works instantly)
                if (userId && !allParticipantIds.includes(userId)) {
                    allParticipantIds.push(userId);
                }

                let staffMap = {};

                if (allParticipantIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('staff_profiles')
                        .select('user_id, full_name, role')
                        .in('user_id', allParticipantIds);

                    if (profiles) {
                        profiles.forEach(p => {
                            staffMap[p.role] = { name: p.full_name, id: p.user_id };
                        });
                    }
                }

                // Force Self-Correction if staffMap missing current user due to race condition
                if (profile && !staffMap[profile.role]) {
                    staffMap[profile.role] = { name: profile.full_name, id: profile.user_id };
                }

                // Update schoolData with discovered participants
                setTodaySchool(prev => ({
                    ...prev,
                    pilot_name: staffMap.pilot?.name || prev?.pilot_name || 'Por asignar',
                    teacher_name: staffMap.teacher?.name || prev?.teacher_name || 'Por asignar',
                    aux_name: staffMap.assistant?.name || prev?.aux_name || 'Por asignar',
                    pilot_id: staffMap.pilot?.id,
                    teacher_id: staffMap.teacher?.id,
                    aux_id: staffMap.assistant?.id || prev?.aux_id
                }));

                if (profile?.role === 'pilot') {
                    const pilotNeedsControllerConnect = hasPendingPilotControllerConnect(state, meta);

                    if (pilotNeedsControllerConnect) {
                        setWaitingForAux(false);
                    } else if (PILOT_WAITING_FOR_AUX_STATES.has(state)) {
                        setWaitingForAux(true);
                    } else if (LISTENER_STEP_ONE_STATES.has(state) || state === 'report' || state === 'closed' || state === 'dismantling') {
                        setWaitingForAux(false);
                    }
                }

                if (profile?.role === 'assistant') {
                    if (state === 'WAITING_AUX_VEHICLE_CHECK') {
                        setAuxFlowState('checklist');
                    } else if (['AUX_VEHICLE_CHECK_DONE', 'OPERATION', 'ROUTE_READY', 'IN_ROUTE'].includes(state)) {
                        setAuxFlowState(null);
                    } else {
                        setAuxFlowState(null);
                    }
                }

                // Determine Step based on State (LOCAL GATING APPLIED)
                // We must use the just-fetched checkInEvent to decide.
                // The variable 'checkInAvailable' will track if this user has checked in.
                let checkInAvailable = false;

                // Logic to find checkInEvent is further down in original code (loop issue),
                // but we need it HERE to decide step.
                // Let's look at checkIns array fetched above (line 159).
                if (checkIns && checkIns.find(c => c.user_id === userId)) {
                    checkInAvailable = true;
                }

                if (checkInAvailable) {
                    let serverStep = 0;
                    if (['prep', 'PILOT_PREP', 'AUX_PREP_DONE', 'TEACHER_SUPPORTING_PILOT', 'PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK'].includes(state)) {
                        serverStep = 0;
                    } else if (['ROUTE_READY', 'IN_ROUTE', 'ROUTE_IN_PROGRESS', 'waiting_unload_assignment', 'waiting_dropzone', 'unload', 'post_unload_coordination', 'seat_deployment'].includes(state)) {
                        serverStep = 1;
                    } else if (['ARRIVAL_PHOTO_DONE', 'OPERATION', 'operation', 'dismantling'].includes(state)) {
                        serverStep = 2;
                    } else if (['report', 'closed'].includes(state) || journeyData.status === 'report') {
                        serverStep = 3;
                    }

                    // [CRASH RECOVERY] Compare server step against IndexedDB local progress
                    let finalStep = serverStep;
                    try {
                        const localProgress = await getLocalProgress(journeyData.id);
                        if (localProgress && typeof localProgress.currentStep === 'number' && localProgress.currentStep > serverStep) {
                            console.log(`🛡️ [CrashRecovery] Local step (${localProgress.currentStep}) > server step (${serverStep}). Trusting local.`);
                            finalStep = localProgress.currentStep;
                            if (localProgress.missionState) {
                                setMissionState(localProgress.missionState);
                            }
                            if (localProgress.showBrief === false) {
                                setShowBrief(false);
                            }
                        }
                    } catch (e) {
                        console.warn('[CrashRecovery] Could not read IndexedDB:', e);
                    }

                    setCurrentStep(finalStep);
                } else {
                    // If NOT checked in, we stay at default (MissionBrief / Prep)
                    setCurrentStep(0);
                    console.log('🔒 User not checked in locally. Staying at Step 0/Brief.');
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
            if (journeyData || journeyId) {
                const jId = journeyData?.id || journeyId;
                if (jId) {
                    const { data: checkInRows, error: checkInError } = await supabase
                        .from('staff_prep_events')
                        .select('payload, created_at')
                        .eq('journey_id', jId)
                        .eq('event_type', 'checkin')
                        .eq('user_id', userId) // CRITICAL FIX: Only user's own check-in!
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (checkInError) {
                        console.warn('Check-in query fallback (non-blocking):', checkInError);

                        const inferredState = journeyData?.mission_state || todaySchoolRef.current?.mission_state || null;
                        const isOperationalFlowState = LISTENER_STEP_ONE_STATES.has(inferredState) || inferredState === 'dismantling' || inferredState === 'report' || inferredState === 'closed';

                        if (isOperationalFlowState || checkInRef.current) {
                            setShowBrief(false);
                        } else {
                            setCheckInTimestamp(null);
                            setShowBrief(true);
                        }

                        return;
                    }

                    const checkInEvent = Array.isArray(checkInRows) && checkInRows.length > 0
                        ? checkInRows[0]
                        : null;

                    if (checkInEvent) {
                        const checkInTs = checkInEvent?.payload?.timestamp || checkInEvent?.created_at || new Date().toISOString();
                        setCheckInTimestamp(checkInTs);
                        setTodaySchool(prev => ({ ...prev, checkInTimestamp: checkInTs }));
                        setShowBrief(false);
                    } else {
                        const inferredState =
                            journeyData?.mission_state ||
                            todaySchoolRef.current?.mission_state ||
                            missionStateRef.current ||
                            null;
                        const isOperationalFlowState =
                            LISTENER_STEP_ONE_STATES.has(inferredState) ||
                            inferredState === 'OPERATION' ||
                            inferredState === 'operation' ||
                            inferredState === 'dismantling' ||
                            inferredState === 'report' ||
                            inferredState === 'closed';

                        if (isOperationalFlowState || checkInRef.current) {
                            setShowBrief(false);
                        } else {
                            // Explicitly clear checking state only if user is really still pre-checkin
                            setCheckInTimestamp(null);
                            setShowBrief(true);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error selecting mission:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, profile]);

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
                        // [PHASE 12-B] Closure Safety using Refs
                        const currentProfile = profileRef.current;
                        const currentCheckIn = checkInRef.current;
                        const missionInfo = todaySchoolRef.current;

                        const newState = payload.new.mission_state;
                        const incomingMeta = parseMeta(payload.new?.meta);
                        const incomingArrivalPhotoTakenAt = payload.new?.arrival_photo_taken_at || null;

                        const beforeSnapshot = buildListenerSnapshot();
                        const afterSnapshot = projectSnapshotForRealtimeUpdate(
                            beforeSnapshot,
                            newState,
                            incomingMeta,
                            incomingArrivalPhotoTakenAt
                        );

                        const beforeVisibleTaskKey = getVisibleTaskKey(beforeSnapshot);
                        const afterVisibleTaskKey = getVisibleTaskKey(afterSnapshot);
                        setMissionState(newState); // Keep local state in sync

                        // ── Dependency Transition Overlay ──
                        const transitionCopy = getTransitionCopy(
                            newState,
                            prevMissionStateRef.current,
                            currentProfile?.role,
                            {
                                pilot_name: missionInfo?.pilot_name,
                                teacher_name: missionInfo?.teacher_name,
                                aux_name: missionInfo?.aux_name,
                            },
                            {
                                beforeVisibleTaskKey,
                                afterVisibleTaskKey,
                                beforeMeta: beforeSnapshot.missionMeta,
                                afterMeta: incomingMeta,
                                currentUserId: currentProfile?.user_id || userId || null
                            }
                        );

                        const hasEnteredOperationalFlow = showBriefRef.current === false;
                        const hasVisibleTaskChange = beforeVisibleTaskKey !== afterVisibleTaskKey;

                        if (transitionCopy && hasEnteredOperationalFlow && hasVisibleTaskChange) {
                            triggerTransition(transitionCopy);
                            console.log('🔔 Dependency overlay fired (visible task changed).', {
                                prevState: prevMissionStateRef.current,
                                newState,
                                beforeVisibleTaskKey,
                                afterVisibleTaskKey,
                                transitionKey: transitionCopy.transitionKey
                            });
                        } else if (transitionCopy) {
                            console.log('ℹ️ Dependency overlay skipped.', {
                                prevState: prevMissionStateRef.current,
                                newState,
                                hasEnteredOperationalFlow,
                                hasVisibleTaskChange,
                                beforeVisibleTaskKey,
                                afterVisibleTaskKey,
                                transitionKey: transitionCopy.transitionKey
                            });
                        }

                        prevMissionStateRef.current = newState;

                        // [PHASE 12-B] Real-time Meta Updates
                        if (payload.new) {
                            setTodaySchool(prev => {
                                if (!prev) return prev;
                                const next = payload.new;

                                return {
                                    ...prev,
                                    ...next,
                                    meta: incomingMeta
                                };

                            });
                        }

                        if (['PILOT_PREP', 'prep'].includes(newState)) {
                            console.warn('⚠️ Global Reset (State Change) Detected! Reloading...');
                            clearJourneyLocalOperationalData(journeyId);
                            window.location.reload();
                        }

                        // Auto-advance logic (LOCAL GATING ADDED)
                        // Auto-advance logic (LOCAL GATING WITH META CHECK)
                        if (currentCheckIn) {
                            if (currentProfile?.role === 'pilot') {
                                const pilotNeedsControllerConnect = hasPendingPilotControllerConnect(newState, incomingMeta);

                                if (pilotNeedsControllerConnect) {
                                    setWaitingForAux(false);
                                } else if (PILOT_WAITING_FOR_AUX_STATES.has(newState)) {
                                    setWaitingForAux(true);
                                } else if (LISTENER_STEP_ONE_STATES.has(newState) || newState === 'report' || newState === 'dismantling') {
                                    setWaitingForAux(false);
                                }
                            }

                            if (newState === 'dismantling') {
                                setWaitingForAux(false);
                                setAuxFlowState(null);
                                setTeacherFlowState(null);
                                setCurrentStep(2);
                            }

                            const isPilotLocked = shouldLockPilot(
                                currentProfile?.role,
                                newState,
                                incomingMeta,
                                incomingArrivalPhotoTakenAt
                            );

                            if (isPilotLocked) {
                                console.log('🛡️ Fortress Gating: Navigation BLOCKED in listener for Pilot.', {
                                    state: newState,
                                    pilot_ready: isPilotReady(incomingMeta, incomingArrivalPhotoTakenAt),
                                    meta: incomingMeta
                                });

                                // Allow initial step advancement from Brief to Prep
                                if (currentStepRef.current < 1) {
                                    setCurrentStep(1);
                                }
                                // No other transitions allowed (Step 2/3 blocked until pilot_ready = true)
                                return;
                            }


                            // If the mission has advanced to any post-checklist state, move to Step 1
                            if (LISTENER_STEP_ONE_STATES.has(newState)) {
                                if (currentStepRef.current < 1) {
                                    setCurrentStep(1);
                                }
                                setAuxFlowState(null);
                                setTeacherFlowState(null);
                            }

                            // Advance to Step 2 (Operation)
                            if (['OPERATION', 'dismantling'].includes(newState)) {
                                setCurrentStep(2);
                            }
                        } else {
                            console.log('⛔ Global update received but ignored for navigation - Waiting for local Check-in.');
                        }
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
    }, [journeyId, triggerTransition, buildListenerSnapshot, userId]);

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

    const activateDirectOperationMode = useCallback(() => {
        const activeRole = String(profileRef.current?.role || '').toLowerCase();
        if (!['pilot', 'teacher', 'assistant', 'auxiliar'].includes(activeRole)) return;

        setDirectOperationMode(true);
        setShowBrief(false);
        setWaitingForAux(false);
        setAuxFlowState(null);
        setTeacherFlowState(null);
        setTeacherCivicPanelOpen(false);
        setCurrentStep(2);

        console.log('🚀 Direct operation mode activated:', { role: activeRole });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleDirectOperation = (event) => {
            const roleFromEvent = String(event?.detail?.role || profileRef.current?.role || '').toLowerCase();
            if (!['pilot', 'teacher', 'assistant', 'auxiliar'].includes(roleFromEvent)) return;
            activateDirectOperationMode();
        };

        window.addEventListener('flyhigh:direct-operation', handleDirectOperation);
        return () => window.removeEventListener('flyhigh:direct-operation', handleDirectOperation);
    }, [activateDirectOperationMode]);

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

                // Pilot completing prep -> signal aux and teacher
                if (profile?.role === 'pilot') {
                    updates.mission_state = 'PILOT_READY_FOR_LOAD';
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
        setMissionState('IN_ROUTE');
        setCurrentStep(1); // En Ruta
    };

    // --- Gating Logic for Subflow ---
    const canEnterPostArrival = (missionState) => {
        // Only allow post-arrival views if the global state is ready AND we are largely in the right step.
        // However, the main gating is actually: "Don't show Dropzone/Unload if local user hasn't finished Check-in/Prep".
        // currentStep === 1 means we are functionally "En Ruta" or later in the stepper.
        return true;
        // Only allow post-arrival views if the global state is ready AND we are largely in the right step.
        // However, the main gating is actually: "Don't show Dropzone/Unload if local user hasn't finished Check-in/Prep".
        // currentStep === 1 means we are functionally "En Ruta" or later in the stepper.

        // Critical: If missionState is 'waiting_dropzone' or 'unload', we typically want to show it.
        // BUT, if the user refreshes, we must ensure they don't jump here if they were actually in PREP.
        // `currentStep` handles the macro-phase. If currentStep < 1, we are in PREP.
        // So checking `currentStep >= 1` is enough, which is implicit because we only render these screens if currentStep === 1.
        return true;
    };

    // Handler when pilot is ready (from aux waiting screen)
    const handlePilotReadyForAux = useCallback(() => {
        console.log('🚀 Dashboard: Pilot ready signal received. Switching to checklist.');
        setAuxFlowState('checklist');
    }, []);

    const handlePilotReadyForLoad = useCallback((nextMeta = null) => {
        setWaitingForAux(true);
        setCurrentStep(0);
        setMissionState('PILOT_READY_FOR_LOAD');

        if (nextMeta) {
            const safeMeta = parseMeta(nextMeta);
            setTodaySchool(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    meta: safeMeta
                };
            });
        }
    }, []);

    const handleAuxConfirmed = () => {
        setWaitingForAux(false);
        // Pilot also waits for route start? No, pilot waits for En Ruta
        // Actually if Aux finished, state is ROUTE_READY.
        setCurrentStep(1);
    };

    const handleCheckoutComplete = useCallback(() => {
        refreshMission();
    }, [refreshMission]);

    const handleGoToReport = async () => {
        if (isStartingClosureFlow) return;

        setDirectOperationMode(false);
        setWaitingForAux(false);
        setAuxFlowState(null);
        setTeacherFlowState(null);
        setTeacherCivicPanelOpen(false);
        setTeacherCivicPanelDismissed(false);
        setAssistantCivicPanelDismissed(false);
        setCurrentStep(2);

        if (!journeyId) {
            setMissionState('dismantling');
            return;
        }

        setIsStartingClosureFlow(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const { data, error: readError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            const currentMeta = parseMeta(data?.meta);
            const sanitizedMeta = { ...currentMeta };
            delete sanitizedMeta.closure_step;
            const starterName = firstNameOrFallback(profile?.full_name, 'Operativo');

            const nextMeta = {
                ...sanitizedMeta,
                closure_phase: 'dismantling',
                closure_started_at: sanitizedMeta.closure_started_at || now,
                closure_started_by: sanitizedMeta.closure_started_by || userId,
                closure_started_by_name: sanitizedMeta.closure_started_by_name || starterName
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'dismantling',
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setMissionState('dismantling');
            setTodaySchool((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    meta: nextMeta
                };
            });
            refreshMission();
        } catch (error) {
            console.error('Error iniciando desmontaje y retorno:', error);
            // Re-throw so the awaiting handleCloseDay in StaffOperationLegacy catches it
            // and shows the error inline in the modal (no orphaned alert)
            throw error;
        } finally {
            setIsStartingClosureFlow(false);
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
            } catch (e) {
                console.warn('Error cerrando jornada:', e);
            }
        }
        // Clean up all mission state so user returns to a fresh lobby
        localStorage.removeItem('flyhigh_selected_mission_id');
        localStorage.removeItem('flyhigh_staff_mission');
        localStorage.removeItem('flyhigh_flight_logs');
        localStorage.removeItem('flyhigh_completed_pauses');
        localStorage.removeItem('flyhigh_active_pause');
        localStorage.removeItem('flyhigh_active_flight');
        router.replace('/staff/dashboard');
    };

    const contingencyProps = {
        journeyId,
        userId,
        profile,
        missionState,
        missionInfo: todaySchool,
        onRefresh: refreshMission
    };

    const withDependencyOverlay = (content) => (
        <>
            <DependencyTransitionOverlay overlayData={overlayData} />
            <TaskErrorBoundary>
                {content}
            </TaskErrorBoundary>
            {civicModalVisible && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24
                    }}
                >
                    <div
                        className="animate-in zoom-in-95 duration-300"
                        style={{
                            backgroundColor: 'white', borderRadius: 24, padding: 28,
                            width: '100%', maxWidth: 340, textAlign: 'center',
                            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25)'
                        }}
                    >
                        <button
                            onClick={() => { civicModalDismissedRef.current = true; setCivicModalVisible(false); }}
                            aria-label="Cerrar"
                            style={{
                                position: 'absolute', top: 12, right: 12,
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#94a3b8', padding: 4
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                        </button>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            backgroundColor: '#EFF6FF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px'
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#2563EB', fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Acto Cívico</h3>
                        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
                            El acto cívico comenzará pronto. Ten lista la cámara DJI Osmo para los mejores momentos.
                        </p>
                        <button
                            onClick={() => { civicModalDismissedRef.current = true; setCivicModalVisible(false); }}
                            style={{
                                width: '100%', padding: '14px 0', borderRadius: 14,
                                background: '#0f172a', color: 'white', border: 'none',
                                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(15,23,42,0.3)'
                            }}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

        </>
    );

    // --- Loading / Hydration Guard ---
    if (!mounted || loading) {
        return withDependencyOverlay(
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
        return withDependencyOverlay(
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="max-w-sm text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <button onClick={handleLogout} className="text-sm text-blue-500 underline">Cerrar sesión</button>
                </div>
            </div>
        );
    }

    // --- MISSION LOBBY (always shown first until user picks a mission) ---
    if ((lobbyMode || noSchoolToday) && !todaySchool && !manualMission && !directOperationMode) {
        return withDependencyOverlay(
            <div className="min-h-screen bg-slate-50 p-4">
                <div className="max-w-md mx-auto space-y-6 pt-6">
                    {/* Header */}
                    {profile && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center shadow-md">
                                    <User className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{profile.full_name}</p>
                                    <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role] || profile.role}</p>
                                </div>
                            </div>
                            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <LogOut size={20} />
                            </button>
                        </div>
                    )}

                    {/* Today's date banner */}
                    <div className="text-center">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })}
                        </p>
                    </div>

                    {/* Mission Cards or Empty State */}
                    {todaySchools.length > 0 ? (
                        <div className="space-y-3">
                            <h2 className="text-lg font-extrabold text-slate-800">
                                Misiones del día
                                <span className="ml-2 text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                    {todaySchools.length}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 -mt-1">Selecciona una misión para iniciar operaciones.</p>

                            {todaySchools.map((school, idx) => {
                                const isCompleted = school.estatus === 'completada' || school.estatus === 'cerrada';
                                return (
                                    <button
                                        key={school.id}
                                        onClick={() => !isCompleted && selectMission(school)}
                                        disabled={isCompleted}
                                        className={`w-full text-left rounded-2xl border p-4 transition-all group ${isCompleted
                                            ? 'bg-slate-50 border-slate-200 opacity-60 grayscale-[30%] cursor-not-allowed'
                                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100 active:scale-[0.98] cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                                                <School className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                                                    {school.school_name}
                                                </p>
                                                {school.colonia && (
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <MapPin size={10} className="text-slate-400" />
                                                        {school.colonia}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-slate-300 group-hover:text-blue-400 transition-colors">
                                                {isCompleted ? (
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">✅ Completada</span>
                                                ) : (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>

                                        {/* Presence Avatars */}
                                        {school.presence && school.presence.length > 0 && (
                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                    En misión
                                                </span>
                                                <div className="flex flex-row-reverse">
                                                    {school.presence.map((p, pi) => {
                                                        const roleConfig = {
                                                            pilot: { bg: 'bg-blue-500', label: 'P', title: 'Piloto' },
                                                            teacher: { bg: 'bg-purple-500', label: 'D', title: 'Docente' },
                                                            assistant: { bg: 'bg-teal-500', label: 'A', title: 'Auxiliar' },
                                                            auxiliar: { bg: 'bg-teal-500', label: 'A', title: 'Auxiliar' },
                                                        };
                                                        const cfg = roleConfig[p.role] || { bg: 'bg-slate-400', label: '?', title: p.role };
                                                        return (
                                                            <div
                                                                key={`${p.role}-${pi}`}
                                                                title={cfg.title}
                                                                className={`w-7 h-7 rounded-full ${cfg.bg} border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm -ml-2 first:ml-0`}
                                                            >
                                                                {cfg.label}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-800 text-sm">Sin misiones el día de hoy</p>
                                <p className="text-xs text-amber-600 mt-1">No hay escuelas programadas. Contacta a tu coordinador.</p>
                            </div>
                        </div>
                    )}

                    {/* Refresh button */}
                    <button
                        onClick={refreshMission}
                        disabled={loading}
                        className="w-full py-2.5 bg-white border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>

                    {/* Admin manual selector (legacy) */}
                    {profile?.role === 'admin' && noSchoolToday && (
                        <MissionSelector onSelect={handleManualMissionSelect} />
                    )}
                </div>
            </div>
        );
    }


    // --- Mission Brief (first screen) ---
    // If we haven't checked in OR if we are explicitly showing brief
    if (showBrief && !manualMission && !directOperationMode) {
        const handleBackToLobby = () => {
            localStorage.removeItem('flyhigh_selected_mission_id');
            localStorage.removeItem('flyhigh_staff_mission');
            setTodaySchool(null);
            setJourneyId(null);
            setLobbyMode(true);
            setShowBrief(true);
            refreshMission();
        };

        return withDependencyOverlay(
            <div className="relative">
                {/* Back to lobby button — top-left */}
                <button
                    onClick={handleBackToLobby}
                    className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full text-xs font-semibold text-slate-600 shadow-sm hover:bg-white hover:shadow-md active:scale-95 transition-all"
                >
                    <ChevronLeft size={14} />
                    Cambiar misión
                </button>
                <MissionBrief
                    profile={profile}
                    school={todaySchool}
                    journeyId={journeyId}
                    userId={userId}
                    existingCheckIn={todaySchool?.checkInTimestamp}
                    onCheckedIn={() => setShowBrief(false)}
                    onLogout={handleLogout}
                    onRefresh={refreshMission}
                />
            </div>
        );
    }

    if (directOperationMode && missionState !== 'dismantling' && currentStep !== 3 && (profile?.role === 'assistant' || profile?.role === 'pilot' || profile?.role === 'teacher')) {
        if (profile?.role === 'teacher') {
            return withDependencyOverlay(
                <StaffOperationLegacy
                    initialMission={todaySchool}
                    onCloseDay={handleGoToReport}
                    hideMenu={false}
                    useSyncHeader={true}
                    startFromMissionSelector={true}
                    journeyId={journeyId}
                    userId={userId}
                    profile={profile}
                    missionState={missionState}
                    onRefresh={refreshMission}
                />
            );
        }

        return withDependencyOverlay(
            <OperationPanelConstructionScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={todaySchool}
                missionState={missionState}
                onRefresh={refreshMission}
            />
        );
    }





    // ── [SURGICAL PRIORITY #0] THE PILOT FORTRESS (Absolute Zero Bypass) ──
    const pilotLockedFinal = shouldLockPilot(
        profile?.role,
        missionState,
        todaySchool?.meta,
        todaySchool?.arrival_photo_taken_at
    );

    // 🔍 DEBUG TEMPORAL - Ver estado del meta
    if (profile?.role === 'pilot') {
        const meta = parseMeta(todaySchool?.meta);
        console.log('🔍 PILOT FORTRESS DEBUG:', {
            missionState: missionState,
            meta: meta,
            pilot_ready: isPilotReady(meta, todaySchool?.arrival_photo_taken_at),
            pilotLockedFinal: pilotLockedFinal,
            todaySchool: todaySchool
        });
    }


    const renderPilotFortressScreen = () => (
        withDependencyOverlay(
            <PilotPrepareFlightScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={todaySchool}
                missionState={missionState}
                onPilotReadyForLoad={handlePilotReadyForLoad}
                onRefresh={refreshMission}
            />
        )
    );


    if (pilotLockedFinal) {
        console.log(`🛡️ FORTRESS RENDER: Pilot ${profile?.full_name} is locked. State: ${missionState}, MetaReady: ${isPilotReady(todaySchool?.meta, todaySchool?.arrival_photo_taken_at)}`);


        // Final fallback: if somehow currentStep drifted to 2 or 3, snap it back to 1 (En Ruta shell)
        if (currentStep > 1) {
            console.warn('🛡️ Fortress Emergency: Snapping step back to 1.');
            setCurrentStep(1);
        }

        return renderPilotFortressScreen();
    }

    // --- Pilot: Waiting for Aux to confirm vehicle loading ---
    if (waitingForAux && profile?.role === 'pilot') {
        return withDependencyOverlay(
            <WaitingAuxLoad
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                onAuxReady={handleAuxConfirmed}
                onRefresh={refreshMission}
            />
        );
    }

    // --- Assistant: Waiting for pilot OR doing vehicle checklist ---
    if (profile?.role === 'assistant' && auxFlowState === 'waiting') {
        return withDependencyOverlay(
            <AuxWaitingScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                onPilotReady={handlePilotReadyForAux}
                onRefresh={refreshMission}
            />
        );
    }

    if (profile?.role === 'assistant' && auxFlowState === 'checklist') {
        return withDependencyOverlay(
            <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
                {profile && journeyId && userId ? (
                    <AuxVehicleChecklist
                        journeyId={journeyId}
                        userId={userId}
                        onComplete={handleAuxVehicleCheckDone}
                        missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                        onRefresh={refreshMission}
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
            </div>
        );
    }

    if (profile?.role === 'teacher' && teacherFlowState === 'waiting') {
        return withDependencyOverlay(
            <TeacherWaitingScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                onRouteStarted={() => {
                    setTeacherFlowState(null);
                    setCurrentStep(1);
                }}
                onRefresh={refreshMission}
            />
        );
    }

    const parallelMeta = parseMeta(todaySchool?.meta);
    const teacherCivicConfirmed = parallelMeta.teacher_civic_notified === true;
    const civicParallelInProgress = parallelMeta.civic_parallel_status === 'in_progress';
    const teacherCivicAudioStatus = String(parallelMeta.civic_parallel_teacher_audio_status || 'idle').trim().toLowerCase();
    const teacherCivicStageLock = normalizeTeacherCivicStageLock(parallelMeta.civic_parallel_teacher_stage_lock);
    const teacherCivicSkipped =
        parallelMeta.civic_parallel_teacher_skipped === true ||
        Boolean(parallelMeta.civic_parallel_teacher_skipped_at);
    const teacherCivicDone =
        teacherCivicSkipped ||
        Boolean(parallelMeta.civic_parallel_teacher_done_at) ||
        teacherCivicAudioStatus === 'uploaded';
    const teacherCivicEvidenceInProgress =
        !teacherCivicDone &&
        TEACHER_CIVIC_LOCK_AUDIO_STATUSES.has(teacherCivicAudioStatus);
    const shouldHoldTeacherInLockedStage =
        profile?.role === 'teacher' &&
        missionState === 'seat_deployment' &&
        Boolean(teacherCivicStageLock) &&
        teacherCivicEvidenceInProgress;
    const assistantCivicStatus = parallelMeta.civic_parallel_aux_status || null;
    const assistantCivicSkipped =
        parallelMeta.civic_parallel_aux_skipped === true ||
        Boolean(parallelMeta.civic_parallel_aux_skipped_at) ||
        String(assistantCivicStatus || '').trim().toLowerCase() === 'skipped';
    const assistantNeedsCivicPanel =
        (civicParallelInProgress || parallelMeta.is_recording_standby === true) &&
        !assistantCivicSkipped &&
        (!assistantCivicStatus || ASSISTANT_CIVIC_PENDING_STATUSES.has(assistantCivicStatus));

    const shouldShowTeacherCivicParallel =
        profile?.role === 'teacher' &&
        teacherCivicConfirmed &&
        parallelMeta.civic_parallel_use_legacy_panel === true &&
        !teacherCivicSkipped &&
        !teacherCivicDone &&
        (teacherCivicPanelOpen || (civicParallelInProgress && !teacherCivicPanelDismissed));

    const shouldShowAssistantCivicParallel =
        profile?.role === 'assistant' &&
        !assistantCivicSkipped &&
        assistantNeedsCivicPanel &&
        !assistantCivicPanelDismissed;

    if (shouldShowTeacherCivicParallel) {
        return withDependencyOverlay(
            <TeacherCivicParallelScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={todaySchool}
                missionState={missionState}
                onRefresh={refreshMission}
                onBackToTask={() => {
                    setTeacherCivicPanelOpen(false);
                    setTeacherCivicPanelDismissed(true);
                }}
            />
        );
    }

    if (shouldShowAssistantCivicParallel) {
        return withDependencyOverlay(
            <AuxCivicEvidenceParallelScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={todaySchool}
                missionState={missionState}
                onRefresh={refreshMission}
                onBackToTask={() => setAssistantCivicPanelDismissed(true)}
            />
        );
    }

    // [FIX] Phase-independent fallback: If the assistant hasn't finished the ad wall,
    // force them back to it regardless of what phase the rest of the team advanced to.
    // This ensures the Muro task is not skipped when the civic act interrupts and the
    // Teacher advances the global phase during the interruption.
    if (profile?.role === 'assistant') {
        const wallMeta = parseMeta(todaySchool?.meta);
        if (wallMeta.aux_ready_seat_deployment === true && wallMeta.aux_ad_wall_done !== true) {
            return withDependencyOverlay(
                <AuxAdWallInstallScreen
                    journeyId={journeyId}
                    userId={userId}
                    role={profile?.role}
                    profile={profile}
                    missionInfo={todaySchool}
                    missionState={missionState}
                    onRefresh={refreshMission}
                />
            );
        }
    }

    const operationKickoffMeta = parseMeta(todaySchool?.meta);
    const operationKickoffActive =
        missionState === 'seat_deployment' &&
        operationKickoffMeta.global_glasses_done === true;
    const shouldDeferOperationKickoffForTeacher =
        profile?.role === 'teacher' &&
        shouldHoldTeacherInLockedStage;

    if (!shouldDeferOperationKickoffForTeacher && operationKickoffActive && operationKickoffMeta.operation_start_bridge_at) {
        return withDependencyOverlay(
            <OperationStartBridgeScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={todaySchool}
                missionState={missionState}
                onRefresh={refreshMission}
            />
        );
    }

    if (!shouldDeferOperationKickoffForTeacher && operationKickoffActive) {
        if (profile?.role === 'pilot') {
            return withDependencyOverlay(
                <PilotMusicAmbienceScreen
                    journeyId={journeyId}
                    userId={userId}
                    role={profile?.role}
                    profile={profile}
                    missionInfo={todaySchool}
                    missionState={missionState}
                    onRefresh={refreshMission}
                />
            );
        }

        if (profile?.role === 'teacher') {
            return withDependencyOverlay(
                <TeacherOperationReadyScreen
                    journeyId={journeyId}
                    userId={userId}
                    role={profile?.role}
                    profile={profile}
                    missionInfo={todaySchool}
                    missionState={missionState}
                    onRefresh={refreshMission}
                />
            );
        }

        if (profile?.role === 'assistant') {
            return withDependencyOverlay(
                <AuxOperationReadyScreen
                    journeyId={journeyId}
                    userId={userId}
                    role={profile?.role}
                    profile={profile}
                    missionInfo={todaySchool}
                    missionState={missionState}
                    onRefresh={refreshMission}
                />
            );
        }
    }

    if (missionState === 'dismantling') {
        const closureCommonProps = {
            journeyId,
            userId,
            profile,
            missionInfo: todaySchool,
            missionState,
            onRefresh: refreshMission,
            onCheckoutComplete: handleCheckoutComplete
        };
        const dismantlingRoute = resolveDismantlingRoute(profile?.role, todaySchool?.meta);

        if (dismantlingRoute.kind === 'wait') {
            return withDependencyOverlay(
                <PilotOperationalWaitScreen
                    {...closureCommonProps}
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
                return withDependencyOverlay(<AdWallDismantleScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.DRONE_STORAGE:
                return withDependencyOverlay(<DroneStorageScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.GLASSES_STORAGE:
                return withDependencyOverlay(<GlassesStorageScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.HEADPHONES_STORAGE:
                return withDependencyOverlay(<HeadphonesStorageScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.SEAT_FOLDING:
                return withDependencyOverlay(<SeatFoldingScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.VEHICLE_POSITIONING:
                return withDependencyOverlay(<VehiclePositioningScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.GLOBAL_LOADING:
            case DISMANTLING_ROUTE_IDS.CONTAINER_LOADING:
                if (normalizeDismantlingRole(profile?.role) === 'assistant') {
                    return withDependencyOverlay(<GlobalLoadingScreen {...closureCommonProps} />);
                }
                return withDependencyOverlay(<MomentoDeCargarScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.RETURN_ROUTE:
                return withDependencyOverlay(<ReturnRouteScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.ARRIVAL_NOTIFICATION:
                return withDependencyOverlay(<ArrivalNotificationScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.APOYO_BODEGA:
                return withDependencyOverlay(<ApoyoBodegaScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD:
                return withDependencyOverlay(<EquipmentUnloadScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.RETURN_INVENTORY:
                return withDependencyOverlay(<ReturnInventoryScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.ELECTRONICS_CHARGING:
                return withDependencyOverlay(<ChargingStationScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.AUX_RECORDING_CHARGING:
                return withDependencyOverlay(<AuxRecordingChargingScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.FINAL_PARKING:
                return withDependencyOverlay(<FinalParkingScreen {...closureCommonProps} />);
            case DISMANTLING_ROUTE_IDS.CHECKOUT:
                return withDependencyOverlay(<CheckoutScreen {...closureCommonProps} />);
            default:
                return withDependencyOverlay(<CheckoutScreen {...closureCommonProps} />);
        }
    }



    // --- Step 1: En Ruta (y Subflujo Post-Llegada) ---
    if (currentStep === 1) {
        const pilotPostArrivalLock = shouldLockPilot(
            profile?.role,
            missionState,
            todaySchool?.meta,
            todaySchool?.arrival_photo_taken_at
        );

        // Helper to keep code clean
        const commonProps = {
            journeyId, userId, role: profile?.role, profile,
            missionInfo: todaySchool, missionState,
            onRefresh: refreshMission
        };

        // 1. Unload Phase (Global)
        if (missionState === 'unload') {
            if (pilotPostArrivalLock) {
                return renderPilotFortressScreen();
            }
            return withDependencyOverlay(<UnloadScreen {...commonProps} />);
        }

        // 1.5. Post-unload coordination split (Aux + Teacher in parallel)
        if (missionState === 'post_unload_coordination') {
            if (pilotPostArrivalLock) {
                return renderPilotFortressScreen();
            }

            if (profile?.role === 'pilot') {
                return withDependencyOverlay(<SeatDeploymentScreen {...commonProps} missionState="seat_deployment" />);
            }

            if (profile?.role === 'assistant') {
                return withDependencyOverlay(<AuxParkingVehicleScreen {...commonProps} />);
            }

            if (profile?.role === 'teacher') {
                return withDependencyOverlay(<TeacherCivicNotificationScreen {...commonProps} />);
            }

            return withDependencyOverlay(<PilotOperationalWaitScreen {...commonProps} />);
        }

        // 1.6. Seat deployment (Global)
        if (missionState === 'seat_deployment') {
            if (pilotPostArrivalLock) {
                return renderPilotFortressScreen();
            }

            const seatMeta = parseMeta(todaySchool?.meta);
            const auxReady = seatMeta.aux_ready_seat_deployment === true;
            const adWallDone = seatMeta.aux_ad_wall_done === true;
            const teacherReady = seatMeta.teacher_civic_notified === true;
            const seatDone = seatMeta.global_seat_deployment_done === true;
            const headphonesDone = seatMeta.global_headphones_done === true;
            const glassesDone = seatMeta.global_glasses_done === true;

            if (profile?.role === 'teacher' && shouldHoldTeacherInLockedStage) {
                if (teacherCivicStageLock === 'headphones') {
                    return withDependencyOverlay(<HeadphonesSetupScreen {...commonProps} />);
                }

                if (teacherCivicStageLock === 'glasses') {
                    return withDependencyOverlay(<GlassesSetupScreen {...commonProps} />);
                }

                return withDependencyOverlay(<SeatDeploymentScreen {...commonProps} missionState="seat_deployment" />);
            }

            if (profile?.role === 'assistant' && !auxReady) {
                return withDependencyOverlay(<AuxParkingVehicleScreen {...commonProps} />);
            }

            if (profile?.role === 'assistant' && auxReady && !adWallDone) {
                return withDependencyOverlay(<AuxAdWallInstallScreen {...commonProps} />);
            }

            if (profile?.role === 'teacher' && !teacherReady) {
                return withDependencyOverlay(<TeacherCivicNotificationScreen {...commonProps} />);
            }

            if (seatDone && !headphonesDone) {
                return withDependencyOverlay(<HeadphonesSetupScreen {...commonProps} />);
            }

            if (seatDone && headphonesDone && !glassesDone) {
                return withDependencyOverlay(<GlassesSetupScreen {...commonProps} />);
            }

            return withDependencyOverlay(<SeatDeploymentScreen {...commonProps} />);
        }

        // 2. Waiting Dropzone Phase (Global)
        if (missionState === 'waiting_dropzone') {
            if (pilotPostArrivalLock) {
                return renderPilotFortressScreen();
            }

            if (profile?.role === 'assistant') {
                return withDependencyOverlay(
                    <DropzoneActionScreen
                        {...commonProps}
                    />
                );
            } else {
                return withDependencyOverlay(
                    <DropzoneWaitingScreen
                        {...commonProps}
                        auxName={todaySchool?.aux_name}
                    />
                );
            }
        }

        // 3. Unload Assignment Phase (Global)
        if (missionState === 'waiting_unload_assignment') {
            if (pilotPostArrivalLock) {
                return renderPilotFortressScreen();
            }

            if (profile?.role === 'teacher') {
                return withDependencyOverlay(
                    <UnloadAssignmentActionScreen
                        {...commonProps}
                        missionInfo={todaySchool} // Ensure this has updated meta
                    />
                );
            } else {
                // Piloto protegido por Fortress Check (línea 895)
                return withDependencyOverlay(
                    <WaitingUnloadAssignmentScreen
                        {...commonProps}
                        missionInfo={todaySchool}
                    />
                );
            }
        }

        // 4. Default: En Ruta / Teacher Waiting Logic (Pre-Arrival)
        if (profile?.role === 'teacher') {
            // Check if we are actually EN RUTA (traveling)
            // If so, show the EnRutaScreen (Stitch UI) so teacher can Notify Arrival
            if (missionState === 'IN_ROUTE' || missionState === 'ROUTE_IN_PROGRESS') {
                return withDependencyOverlay(
                    <div className="min-h-screen">
                        <EnRutaScreen
                            {...commonProps}
                            onStateChange={(newState) => {
                                // Teacher triggers 'waiting_dropzone' via ArrivalPhoto
                                // EnRutaScreen handles internal logic but calls this to update parent
                                setMissionState(newState);
                            }}
                        />
                    </div>
                );
            }

            // Otherwise (e.g. PILOT_READY_FOR_LOAD, AUX_CONTAINERS_DONE, ROUTE_READY), show waiting screen
            // Teacher has their own waiting logic inside TeacherWaitingScreen
            return withDependencyOverlay(
                <TeacherWaitingScreen
                    {...commonProps}
                    onRouteStarted={() => {
                        // Realtime listener handles updates
                    }}
                />
            );
        }

        // 4. Default: En Ruta Screen (Pilot / Aux during travel)
        return withDependencyOverlay(
            <div className="min-h-screen">
                <EnRutaScreen
                    {...commonProps}
                    onStateChange={(newState) => {
                        setMissionState(newState);
                        if (['ARRIVAL_PHOTO_DONE', 'OPERATION'].includes(newState)) {
                            setCurrentStep(2);
                        }
                    }}
                />
            </div>
        );
    }

    // --- Step 0: Prep Checklist (Pilot, Assistant & Teacher) ---
    if (currentStep === 0 && (profile?.role === 'pilot' || profile?.role === 'assistant' || profile?.role === 'teacher')) {
        return withDependencyOverlay(
            <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
                {profile && journeyId && userId ? (
                    <PrepChecklist
                        role={profile.role}
                        journeyId={journeyId}
                        userId={userId}
                        onComplete={handlePrepComplete}
                        missionInfo={{ ...todaySchool, profile, mission_state: missionState }}
                        preview={false} // Enable DB writes to Test Journey
                        onRefresh={refreshMission}
                    />
                ) : (
                    <div className="flex items-center justify-center min-h-screen">
                        <div className="text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Preparando jornada...
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (currentStep === 2 && profile?.role === 'teacher') {
        return withDependencyOverlay(
            <StaffOperationLegacy
                initialMission={todaySchool}
                onCloseDay={handleGoToReport}
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

    if (currentStep === 2 && (profile?.role === 'pilot' || profile?.role === 'assistant')) {
        return withDependencyOverlay(
            <OperationPanelConstructionScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={todaySchool}
                missionState={missionState}
                onRefresh={refreshMission}
            />
        );
    }

    // --- Main Stepper View ---
    return withDependencyOverlay(
        <div className="min-h-screen bg-slate-50">
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
                    <HeaderHamburgerMenu
                        journeyId={journeyId}
                        schoolId={todaySchool?.id}
                        role={profile?.role}
                        onDemoStart={() => refreshMission()}
                    />
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
                                onRefresh={refreshMission}
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
                        />
                    </div>
                )}

                {/* PASO 4: Reporte */}
                {currentStep === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <ClosureLegacy journeyId={journeyId} onComplete={handleReportComplete} />
                    </div>
                )}
            </div>
        </div>
    );
}
