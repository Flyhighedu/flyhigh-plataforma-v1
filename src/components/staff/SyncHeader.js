'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getDismantlingSyncBadge } from '@/utils/dismantlingRouting';

/**
 * Hook to manage the Sync Mode state (tinting condition)
 */
export function useSyncHeaderState(journeyId, role, missionState) {
    const [waitingCount, setWaitingCount] = useState(0);
    const [resolvedMissionState, setResolvedMissionState] = useState(String(missionState || '').trim());

    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();

        const fetchWaitingCounts = async () => {
            try {
                // Always fetch latest mission state from journey row (source of truth)
                let currentState = missionState;
                const { data: journey } = await supabase
                    .from('staff_journeys')
                    .select('mission_state')
                    .eq('id', journeyId)
                    .single();

                if (journey?.mission_state) {
                    currentState = journey.mission_state;
                }

                const normalizedState = String(currentState || '').trim();
                if (normalizedState) {
                    setResolvedMissionState((prev) => (prev === normalizedState ? prev : normalizedState));
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
                (payload) => {
                    const nextState = String(payload?.new?.mission_state || '').trim();
                    if (nextState) {
                        setResolvedMissionState((prev) => (prev === nextState ? prev : nextState));
                    }
                    fetchWaitingCounts();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [journeyId, role, missionState]);

    return { waitingCount, resolvedMissionState };
}


import { CheckCircle2, Loader2, Mic, X } from 'lucide-react';
import HeaderHamburgerMenu from './HeaderHamburgerMenu';
import HeaderOperativo from './HeaderOperativo';
import { getHeaderPhaseForState } from '../../constants/headerPhases';
import useUploadQueueStatus from '@/hooks/useUploadQueueStatus';

const CIVIC_REQUIRED_SECONDS = 90;
const CIVIC_EARLY_FINISH_REASONS = [
    'El acto cívico fue más corto',
    'Dirección pidió acelerar',
    'Cambio de agenda / sin tiempo',
    'Ruido / imposible grabar bien',
    'Otro (especificar)'
];

const AUDIO_MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg'
];

function pickSupportedMimeType(candidates) {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return null;
    }

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function formatDuration(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const min = String(Math.floor(safe / 60)).padStart(2, '0');
    const sec = String(safe % 60).padStart(2, '0');
    return `${min}:${sec}`;
}

function normalizeTeacherCivicStageLock(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['seat', 'headphones', 'glasses'].includes(normalized) ? normalized : null;
}

function resolveTeacherCivicStageLock(meta, missionState) {
    if (String(missionState || '').trim() !== 'seat_deployment') return null;

    const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta)
        ? meta
        : Object.create(null);

    const seatDone = safeMeta.global_seat_deployment_done === true;
    const headphonesDone = safeMeta.global_headphones_done === true;
    const glassesDone = safeMeta.global_glasses_done === true;

    if (seatDone && headphonesDone && !glassesDone) return 'glasses';
    if (seatDone && !headphonesDone) return 'headphones';
    return 'seat';
}

export default function SyncHeader({
    firstName,
    roleName,
    role,
    // navSteps deprecated: HeaderOperativo uses shared phase mapping
    journeyId,
    userId,
    missionInfo,
    missionState,
    isWaitScreen = false,
    waitPhase = null,
    chipOverride = null,
    hideTeacherCivicFab = false,
    onDemoStart = null,
    onCloseMission = null
}) {
    const { waitingCount, resolvedMissionState } = useSyncHeaderState(journeyId, role, missionState);
    const { pendingCount } = useUploadQueueStatus();
    const effectiveMissionState = resolvedMissionState || missionState;
    const headerRef = useRef(null);
    const [useFixedMobileHeader, setUseFixedMobileHeader] = useState(false);
    const [mobileHeaderOffset, setMobileHeaderOffset] = useState(0);
    const [compactProgress, setCompactProgress] = useState(0);
    const [showCivicStartModal, setShowCivicStartModal] = useState(false);
    const [showCivicRecorder, setShowCivicRecorder] = useState(false);
    const [showEarlyFinishModal, setShowEarlyFinishModal] = useState(false);
    const [isCivicRecording, setIsCivicRecording] = useState(false);
    const [isCivicSaving, setIsCivicSaving] = useState(false);
    const [civicElapsedSeconds, setCivicElapsedSeconds] = useState(0);
    const [civicError, setCivicError] = useState('');
    const [civicToast, setCivicToast] = useState('');
    const [micPermissionBlocked, setMicPermissionBlocked] = useState(false);
    const [earlyFinishReason, setEarlyFinishReason] = useState('');
    const [earlyFinishOtherReason, setEarlyFinishOtherReason] = useState('');
    const [civicCompletedLocal, setCivicCompletedLocal] = useState(false);
    const [pendingCivicBlob, setPendingCivicBlob] = useState(null);
    const [lastRecordedDuration, setLastRecordedDuration] = useState(0);
    const [lastStopPayload, setLastStopPayload] = useState({ endedEarly: false, reason: null, reasonDetail: null });
    const [standbyNotified, setStandbyNotified] = useState(false);
    const [isNotifyingSaving, setIsNotifyingSaving] = useState(false);

    const civicTimerRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingStartedAtRef = useRef(null);
    const stoppingInProgressRef = useRef(false);
    const stopPayloadRef = useRef(null);

    const parseHeaderMeta = (value) => {
        if (!value) return {};
        if (typeof value === 'string') {
            try {
                return JSON.parse(value) || {};
            } catch (error) {
                return {};
            }
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    };

    const headerMeta = parseHeaderMeta(missionInfo?.meta);
    const teacherCivicStageLock = normalizeTeacherCivicStageLock(headerMeta.civic_parallel_teacher_stage_lock);
    const teacherCivicDecision =
        headerMeta.teacher_civic_decision ||
        (headerMeta.teacher_civic_notified === true ? 'yes' : null);
    const teacherAudioStatus = headerMeta.civic_parallel_teacher_audio_status || 'idle';
    const teacherCivicInProgress = headerMeta.civic_parallel_status === 'in_progress';
    const teacherCivicCompleted =
        civicCompletedLocal ||
        teacherAudioStatus === 'uploaded' ||
        Boolean(headerMeta.civic_parallel_teacher_done_at);
    const teacherCivicStarted =
        teacherCivicInProgress ||
        Boolean(headerMeta.civic_parallel_started_at) ||
        Boolean(headerMeta.civic_parallel_teacher_ack_at);
    const auxCivicStatus = headerMeta.civic_parallel_aux_status || null;
    const auxEvidenceReady = auxCivicStatus === 'uploaded';
    const auxEvidenceInProcess = !auxEvidenceReady && teacherCivicInProgress;
    const auxDisplayName = missionInfo?.aux_name || 'Osvaldo';

    const shouldShowTeacherCivicFab =
        !hideTeacherCivicFab &&
        role === 'teacher' &&
        teacherCivicDecision === 'yes' &&
        !teacherCivicStarted &&
        !teacherCivicCompleted &&
        !showCivicRecorder &&
        !isCivicRecording;

    const isDismantlingPhase = String(effectiveMissionState || '').trim() === 'dismantling';
    const dismantlingSyncBadge = isDismantlingPhase
        ? getDismantlingSyncBadge(role, headerMeta)
        : null;
    const dismantlingChipText = String(dismantlingSyncBadge?.chipText || '').trim() || null;

    const handleTeacherCivicFabClick = async () => {
        setShowCivicStartModal(true);
        setMicPermissionBlocked(false);
        setCivicError('');
        setStandbyNotified(false);

        // Write stage lock immediately so Realtime updates from Pilot
        // don't displace the teacher while the modal is open
        try {
            const lockValue = teacherCivicStageLock ||
                resolveTeacherCivicStageLock(headerMeta, effectiveMissionState) ||
                'seat';
            await updateJourneyMeta({
                civic_parallel_teacher_stage_lock: lockValue
            });
        } catch (e) {
            console.warn('[SyncHeader] Could not pre-set stage lock:', e);
        }
    };

    const handleNotifyStandby = async () => {
        if (isNotifyingSaving || standbyNotified) return;
        setIsNotifyingSaving(true);
        try {
            await updateJourneyMeta({
                is_recording_standby: true,
                is_recording_standby_at: new Date().toISOString(),
                is_recording_standby_by: userId
            });
            setStandbyNotified(true);
        } catch (error) {
            console.error('Error notificando standby:', error);
            setCivicError('No se pudo notificar. Intenta de nuevo.');
        } finally {
            setIsNotifyingSaving(false);
        }
    };

    // Determine TINT / Gatekeeper Status
    const isPilotGatekeeper = role === 'pilot' && waitingCount >= 1;
    const isAuxGatekeeper = role === 'assistant' && waitingCount >= 1;

    // Detect who we are waiting for
    let waitingForRole = 'PILOTO';
    if (['PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK', 'WAITING_AUX', 'ROUTE_READY'].includes(effectiveMissionState)) {
        waitingForRole = 'AUXILIAR';
    } else if (effectiveMissionState === 'IN_ROUTE') {
        waitingForRole = 'DOCENTE';
    } else if (effectiveMissionState === 'waiting_dropzone') {
        waitingForRole = 'AUXILIAR';
    } else if (effectiveMissionState === 'waiting_unload_assignment') {
        waitingForRole = 'DOCENTE';
    } else if (['OPERATION', 'operation', 'PILOT_OPERATION'].includes(effectiveMissionState)) {
        waitingForRole = null; // Operation phase — no waiting, show phase label
    } else if (effectiveMissionState === 'dismantling') {
        waitingForRole = null; // Dismantling phase label
    }

    const isTeacherGatekeeper = role === 'teacher' && effectiveMissionState === 'IN_ROUTE';
    const isAuxDropzoneGatekeeper = role === 'assistant' && effectiveMissionState === 'waiting_dropzone';
    const isTeacherAssignmentGatekeeper = role === 'teacher' && effectiveMissionState === 'waiting_unload_assignment';
    const isOperationPhase = ['OPERATION', 'operation', 'PILOT_OPERATION', 'seat_deployment', 'post_unload_coordination', 'unload'].includes(effectiveMissionState);
    const isDismantlingState = effectiveMissionState === 'dismantling';

    let waitLabel = waitingForRole ? `ESPERANDO ${waitingForRole}` : '';

    // Strict Chip Logic per Phase 12-B
    if (effectiveMissionState === 'waiting_unload_assignment') {
        if (role === 'teacher') waitLabel = 'DIRECCIÓN';
        else waitLabel = 'EN ESPERA DEL DOCENTE';
    } else if (effectiveMissionState === 'waiting_dropzone') {
        if (role === 'assistant') waitLabel = 'TE ESPERAN';
        else waitLabel = 'EN ESPERA DEL AUXILIAR';
    } else if (isTeacherGatekeeper) {
        waitLabel = 'ESPERANDO TU CONFIRMACIÓN';
    } else if (isPilotGatekeeper || isAuxGatekeeper) {
        waitLabel = 'TE ESPERAN';
    } else if (isOperationPhase) {
        waitLabel = 'EN OPERACIÓN';
    } else if (isDismantlingState && !dismantlingChipText) {
        waitLabel = 'DESMONTAJE';
    }

    // Only show "EN RUTA" if strictly on a wait screen WITHOUT a waitPhase (e.g. Map Screen)
    const shouldHideChip = false;
    const chipText = shouldHideChip ? null : ((isWaitScreen && !waitPhase) ? 'EN RUTA' : waitLabel);
    const civicChipText =
        role === 'teacher'
            ? (isCivicRecording
                ? '🟢 ACTO CÍVICO — GRABANDO'
                : (teacherCivicCompleted ? '🟢 ACTO CÍVICO — COMPLETADO' : null))
            : null;
    const finalChipText = civicChipText || chipOverride || dismantlingChipText || chipText;
    const shouldShowChip = !!finalChipText && (
        !!civicChipText ||
        !!chipOverride ||
        !!dismantlingChipText ||
        isWaitScreen ||
        isPilotGatekeeper ||
        isAuxGatekeeper ||
        isTeacherGatekeeper ||
        isAuxDropzoneGatekeeper ||
        isTeacherAssignmentGatekeeper ||
        isOperationPhase ||
        isDismantlingState ||
        !!waitPhase
    );
    const normalizedChipText = String(finalChipText || '').trim().toUpperCase();
    const isWaitModeVisual = shouldShowChip && normalizedChipText === 'TE ESPERAN';
    const isWaitingChipVisual = shouldShowChip && (
        normalizedChipText.startsWith('ESPERANDO ') ||
        normalizedChipText.startsWith('EN ESPERA ')
    );
    const shouldUseBottomStatusLabel = isWaitModeVisual || isWaitingChipVisual;
    const formatBottomStatusText = (value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        if (trimmed.toUpperCase() === 'TE ESPERAN') return 'Te esperan';

        const lower = trimmed.toLocaleLowerCase('es-MX');
        return `${lower.charAt(0).toLocaleUpperCase('es-MX')}${lower.slice(1)}`;
    };
    const bottomStatusText = shouldUseBottomStatusLabel ? formatBottomStatusText(finalChipText) : '';
    const isCheckInHeaderPhase = getHeaderPhaseForState(effectiveMissionState, headerMeta).id === 'checkin';

    const canConfirmEarlyFinish =
        !!earlyFinishReason &&
        (earlyFinishReason !== 'Otro (especificar)' || earlyFinishOtherReason.trim().length > 0);
    const civicProgressPercent = Math.min(100, (civicElapsedSeconds / CIVIC_REQUIRED_SECONDS) * 100);

    const updateJourneyMeta = async (patch) => {
        if (!journeyId) throw new Error('No encontramos la misión activa.');

        const supabase = createClient();
        const now = new Date().toISOString();

        const { data: currentData, error: selectError } = await supabase
            .from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single();

        if (selectError) throw selectError;

        const currentMeta = parseHeaderMeta(currentData?.meta);
        const nextMeta = {
            ...currentMeta,
            ...patch
        };

        const { error: updateError } = await supabase
            .from('staff_journeys')
            .update({
                meta: nextMeta,
                updated_at: now
            })
            .eq('id', journeyId);

        if (updateError) throw updateError;
    };

    const releaseMediaResources = () => {
        if (civicTimerRef.current) {
            clearInterval(civicTimerRef.current);
            civicTimerRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        mediaRecorderRef.current = null;
    };

    const uploadTeacherAudioEvidence = async (audioBlob, durationSec, stopPayload) => {
        if (!audioBlob) return;

        const safeDuration = Math.max(1, durationSec || 1);
        const payload = stopPayload || { endedEarly: false, reason: null, reasonDetail: null };

        setIsCivicSaving(true);
        setCivicError('');

        try {
            await updateJourneyMeta({
                civic_parallel_teacher_audio_status: 'uploading',
                civic_parallel_teacher_audio_error: null
            });

            const supabase = createClient();
            const extension = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
            const filePath = `${journeyId}/civic-audio/teacher-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from('staff-arrival')
                .upload(filePath, audioBlob, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('staff-arrival')
                .getPublicUrl(filePath);

            await updateJourneyMeta({
                civic_parallel_teacher_audio_status: 'uploaded',
                civic_parallel_teacher_audio_url: publicData.publicUrl,
                civic_parallel_teacher_audio_duration_sec: safeDuration,
                civic_parallel_teacher_audio_uploaded_at: new Date().toISOString(),
                civic_parallel_teacher_audio_stopped_at: new Date().toISOString(),
                civic_parallel_teacher_audio_error: null,
                civic_parallel_teacher_audio_ended_early: payload.endedEarly === true,
                civic_parallel_teacher_audio_early_reason: payload.endedEarly ? payload.reason : null,
                civic_parallel_teacher_audio_early_reason_detail: payload.endedEarly ? payload.reasonDetail : null,
                civic_parallel_teacher_done_at: new Date().toISOString(),
                civic_parallel_teacher_done_by: userId,
                civic_parallel_teacher_done_by_name: firstName || roleName || 'Docente',
                civic_parallel_teacher_stage_lock: null
            });

            setPendingCivicBlob(null);
            setLastStopPayload({ endedEarly: false, reason: null, reasonDetail: null });
            setCivicCompletedLocal(true);
            setShowCivicRecorder(false);
            setShowEarlyFinishModal(false);
            setCivicToast('✅ Audio guardado');
            setEarlyFinishReason('');
            setEarlyFinishOtherReason('');
            onDemoStart && onDemoStart();
        } catch (error) {
            const message = error?.message || 'No se pudo guardar la evidencia de audio.';

            try {
                await updateJourneyMeta({
                    civic_parallel_teacher_audio_status: 'failed',
                    civic_parallel_teacher_audio_error: message
                });
            } catch (metaError) {
                console.warn('No se pudo guardar el estado de error del audio cívico:', metaError);
            }

            setCivicError('No se pudo guardar el audio. Reintenta para completar el registro.');
            setShowCivicRecorder(true);
        } finally {
            setIsCivicSaving(false);
        }
    };

    const completeCivicRecording = ({ endedEarly = false, reason = null, reasonDetail = null }) => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive' || stoppingInProgressRef.current) {
            return;
        }

        stoppingInProgressRef.current = true;
        stopPayloadRef.current = { endedEarly, reason, reasonDetail };

        if (civicTimerRef.current) {
            clearInterval(civicTimerRef.current);
            civicTimerRef.current = null;
        }

        setIsCivicRecording(false);
        setShowEarlyFinishModal(false);

        try {
            mediaRecorderRef.current.stop();
        } catch (error) {
            console.error('Error deteniendo la grabación cívica:', error);
            stoppingInProgressRef.current = false;
            setCivicError('No se pudo detener la grabación. Intenta nuevamente.');
        }
    };

    const startCivicRecording = async () => {
        if (isCivicRecording || isCivicSaving || role !== 'teacher') return;

        stoppingInProgressRef.current = false;
        stopPayloadRef.current = null;
        setCivicElapsedSeconds(0);

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setShowCivicRecorder(true);
            setMicPermissionBlocked(true);
            setCivicError('Necesitamos permiso de micrófono para registrar la evidencia del acto cívico.');
            return;
        }

        setIsCivicSaving(true);
        setMicPermissionBlocked(false);
        setCivicError('');
        setShowCivicRecorder(true);

        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = pickSupportedMimeType(AUDIO_MIME_TYPES);
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

            mediaStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recordingStartedAtRef.current = Date.now();
            stopPayloadRef.current = { endedEarly: false, reason: null, reasonDetail: null };

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                const stopWasRequested = stoppingInProgressRef.current;
                const outputType = mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: outputType });
                const durationSec = Math.max(1, Math.round((Date.now() - (recordingStartedAtRef.current || Date.now())) / 1000));

                setLastRecordedDuration(durationSec);
                releaseMediaResources();

                const stopPayload = stopPayloadRef.current || { endedEarly: false, reason: null, reasonDetail: null };
                stopPayloadRef.current = null;

                if (!stopWasRequested) {
                    setPendingCivicBlob(null);
                    setLastStopPayload({ endedEarly: false, reason: null, reasonDetail: null });
                    setIsCivicRecording(false);
                    setShowCivicRecorder(true);
                    setShowEarlyFinishModal(false);
                    setCivicError('La grabación se interrumpió antes de tiempo. Presiona "Comenzar" para intentar de nuevo.');

                    try {
                        await updateJourneyMeta({
                            civic_parallel_teacher_audio_status: 'failed',
                            civic_parallel_teacher_audio_error: 'La grabación se interrumpió antes de tiempo.'
                        });
                    } catch (metaError) {
                        console.warn('No se pudo guardar estado de interrupción de audio:', metaError);
                    }

                    stoppingInProgressRef.current = false;
                    return;
                }

                setPendingCivicBlob(audioBlob);
                setLastStopPayload(stopPayload);
                await uploadTeacherAudioEvidence(audioBlob, durationSec, stopPayload);
                stoppingInProgressRef.current = false;
            };

            const now = new Date().toISOString();
            const nextTeacherCivicStageLock =
                teacherCivicStageLock ||
                resolveTeacherCivicStageLock(headerMeta, effectiveMissionState) ||
                'seat';

            await updateJourneyMeta({
                civic_parallel_status: 'in_progress',
                civic_parallel_started_at: headerMeta.civic_parallel_started_at || now,
                civic_parallel_started_by: headerMeta.civic_parallel_started_by || userId,
                civic_parallel_teacher_ack_at: now,
                civic_parallel_aux_status: headerMeta.civic_parallel_aux_status || 'pending_recording',
                civic_parallel_teacher_audio_required_sec: CIVIC_REQUIRED_SECONDS,
                civic_parallel_teacher_audio_status: 'recording',
                civic_parallel_teacher_audio_started_at: now,
                civic_parallel_teacher_audio_error: null,
                civic_parallel_teacher_stage_lock: nextTeacherCivicStageLock
            });

            recorder.start(1000);

            setShowCivicStartModal(false);
            setShowCivicRecorder(true);
            setIsCivicRecording(true);
            setCivicElapsedSeconds(0);
            setEarlyFinishReason('');
            setEarlyFinishOtherReason('');

            civicTimerRef.current = setInterval(() => {
                setCivicElapsedSeconds((value) => {
                    const next = value + 1;

                    if (next >= CIVIC_REQUIRED_SECONDS && !stoppingInProgressRef.current) {
                        window.setTimeout(() => {
                            completeCivicRecording({ endedEarly: false });
                        }, 0);
                    }

                    return next;
                });
            }, 1000);
        } catch (error) {
            console.error('Error iniciando acto cívico:', error);

            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }

            releaseMediaResources();
            setIsCivicRecording(false);
            const permissionBlocked = ['NotAllowedError', 'NotFoundError', 'SecurityError', 'NotReadableError'].includes(error?.name);

            if (permissionBlocked) {
                setMicPermissionBlocked(true);
                setCivicError('Necesitamos permiso de micrófono para registrar la evidencia del acto cívico.');
            } else {
                setMicPermissionBlocked(false);
                setCivicError('No se pudo iniciar la grabación. Intenta nuevamente.');
            }
        } finally {
            setIsCivicSaving(false);
        }
    };

    const handleFinishCivic = () => {
        if (!isCivicRecording || isCivicSaving) return;

        if (civicElapsedSeconds < CIVIC_REQUIRED_SECONDS) {
            setShowEarlyFinishModal(true);
            return;
        }

        completeCivicRecording({ endedEarly: false });
    };

    const handleConfirmEarlyFinish = () => {
        if (!canConfirmEarlyFinish || !isCivicRecording) return;

        completeCivicRecording({
            endedEarly: true,
            reason: earlyFinishReason,
            reasonDetail: earlyFinishReason === 'Otro (especificar)' ? earlyFinishOtherReason.trim() : null
        });
    };

    const handleRetryAudioUpload = async () => {
        if (!pendingCivicBlob || isCivicSaving) return;

        await uploadTeacherAudioEvidence(
            pendingCivicBlob,
            lastRecordedDuration || civicElapsedSeconds || CIVIC_REQUIRED_SECONDS,
            lastStopPayload || { endedEarly: false, reason: null, reasonDetail: null }
        );
    };

    useEffect(() => {
        if (teacherAudioStatus === 'uploaded' || headerMeta.civic_parallel_teacher_done_at) {
            setCivicCompletedLocal(true);
        }
    }, [teacherAudioStatus, headerMeta.civic_parallel_teacher_done_at]);

    useEffect(() => {
        if (!civicToast) return;

        const timer = setTimeout(() => {
            setCivicToast('');
        }, 2400);

        return () => clearTimeout(timer);
    }, [civicToast]);

    useEffect(() => {
        return () => {
            releaseMediaResources();
        };
    }, []);

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
        if (typeof window === 'undefined') return;

        // ── Part A: Mobile header height observer ──
        let resizeObserver;
        if (useFixedMobileHeader) {
            const headerNode = headerRef.current;
            if (headerNode) {
                const updateHeight = () => {
                    const nextHeight = Math.ceil(headerNode.getBoundingClientRect().height);
                    setMobileHeaderOffset((prevHeight) => (prevHeight === nextHeight ? prevHeight : nextHeight));
                };
                updateHeight();
                if (typeof ResizeObserver !== 'undefined') {
                    resizeObserver = new ResizeObserver(updateHeight);
                    resizeObserver.observe(headerNode);
                }
                window.addEventListener('resize', updateHeight);
                window.addEventListener('orientationchange', updateHeight);
            }
        }

        // ── Part B: Scroll-based compact progress ──
        if (!isCheckInHeaderPhase) {
            setCompactProgress((prev) => (prev === 1 ? prev : 1));
        }

        let rafId = null;
        let onScroll = null;

        if (isCheckInHeaderPhase) {
            const start = useFixedMobileHeader ? 8 : 14;
            const end = useFixedMobileHeader ? 104 : 132;

            const updateProgress = () => {
                const y = Math.max(0, window.scrollY || window.pageYOffset || 0);
                const next = Math.max(0, Math.min(1, (y - start) / (end - start)));
                setCompactProgress((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
                rafId = null;
            };

            onScroll = () => {
                if (rafId !== null) return;
                rafId = window.requestAnimationFrame(updateProgress);
            };

            updateProgress();
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll);
            window.addEventListener('orientationchange', onScroll);
        }

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            if (onScroll) {
                window.removeEventListener('scroll', onScroll);
                window.removeEventListener('resize', onScroll);
                window.removeEventListener('orientationchange', onScroll);
            }
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, [useFixedMobileHeader, isCheckInHeaderPhase]);

    return (
        <>
            {useFixedMobileHeader && mobileHeaderOffset > 0 && (
                <div aria-hidden="true" style={{ height: mobileHeaderOffset }} />
            )}

            {shouldShowTeacherCivicFab && (
                <button
                    onClick={handleTeacherCivicFabClick}
                    className="fixed bottom-6 right-5 z-[80] flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-extrabold text-blue-700 shadow-[0_14px_34px_-14px_rgba(5,56,143,0.55)] border border-blue-100"
                >
                    <Mic size={16} />
                    🎙️ Iniciar acto cívico (90s)
                </button>
            )}

            <HeaderOperativo
                ref={headerRef}
                firstName={firstName}
                roleLabel={roleName || role}
                missionState={effectiveMissionState}
                missionMeta={headerMeta}
                schoolName={missionInfo?.school_name || missionInfo?.nombre_escuela || ''}
                compactProgress={isCheckInHeaderPhase ? compactProgress : 1}
                waitModeActive={isWaitModeVisual}
                waitModeText="Te esperan"
                bottomStatusText={bottomStatusText}
                className={`${useFixedMobileHeader ? 'inset-x-0' : ''}`}
                style={{
                    position: useFixedMobileHeader ? 'fixed' : 'sticky',
                    top: 0,
                    left: useFixedMobileHeader ? 0 : undefined,
                    right: useFixedMobileHeader ? 0 : undefined,
                    zIndex: useFixedMobileHeader ? 70 : 50,
                    paddingTop: useFixedMobileHeader ? 'calc(env(safe-area-inset-top, 0px) + 1rem)' : '1rem'
                }}
                statusSlot={
                    <>
                        {shouldShowChip && !shouldUseBottomStatusLabel && (
                            <div className="animate-in fade-in slide-in-from-right-4 flex max-w-[138px] min-w-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2 py-1 backdrop-blur-md sm:max-w-[172px]">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                </span>
                                <span className="truncate text-[8px] font-black uppercase leading-none tracking-wide text-white sm:text-[9px]">
                                    {finalChipText}
                                </span>
                            </div>
                        )}
                        {pendingCount > 0 && (
                            <div className="flex items-center gap-1 rounded-full bg-white/10 border border-white/12 px-2 py-1 backdrop-blur-md">
                                <span className="animate-pulse text-[9px]">☁️</span>
                                <span className="text-[8px] font-bold text-white/80 leading-none tracking-wide">Subiendo...</span>
                            </div>
                        )}
                    </>
                }
                actionsSlot={(
                    <HeaderHamburgerMenu
                        journeyId={journeyId}
                        schoolId={missionInfo?.id}
                        role={role}
                        onDemoStart={onDemoStart}
                        onCloseMission={onCloseMission}
                    />
                )}
            />



            {(showCivicStartModal || showCivicRecorder) && role === 'teacher' && (
                <div className="fixed inset-0 z-[110] bg-black/60 px-4 py-6 flex items-center justify-center" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-3xl bg-white text-slate-900 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] overflow-hidden relative" style={{ animation: 'fadeInUp 0.3s ease-out' }}>

                        {/* Close button — only when NOT recording */}
                        {!showCivicRecorder && (
                            <button
                                onClick={() => {
                                    setShowCivicStartModal(false);
                                    // Clear stage lock since teacher dismissed without recording
                                    updateJourneyMeta({ civic_parallel_teacher_stage_lock: null })
                                        .catch(e => console.warn('[SyncHeader] Could not clear stage lock:', e));
                                }}
                                className="absolute top-4 right-4 z-50 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        )}

                        {/* ─── PRE-RECORDING VIEW (2-Step Sequential) ─── */}
                        {!showCivicRecorder && (
                            <>
                                {/* Illustration header */}
                                <div className="bg-blue-50 pt-8 pb-4 flex flex-col items-center justify-center relative overflow-hidden">
                                    <div className="absolute w-64 h-64 bg-blue-500/5 rounded-full blur-2xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    <div className="relative z-10 w-40 h-40">
                                        <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="100" cy="100" r="80" fill="white" opacity="0.8" />
                                            <path d="M100 120 C100 120 70 180 60 190 H140 C130 180 100 120 100 120" fill="#2563EB" />
                                            <circle cx="100" cy="85" r="25" fill="#FFDBAC" />
                                            <path d="M75 80 C75 60 85 50 100 50 C115 50 125 60 125 80 V90 H75 V80 Z" fill="#1E3A8A" />
                                            <path d="M92 85 A 2 2 0 0 1 94 85" stroke="#1F2937" strokeLinecap="round" strokeWidth="2" />
                                            <path d="M106 85 A 2 2 0 0 1 108 85" stroke="#1F2937" strokeLinecap="round" strokeWidth="2" />
                                            <path d="M96 95 Q 100 100 104 95" stroke="#C2410C" strokeLinecap="round" strokeWidth="2" />
                                            <rect x="115" y="110" width="10" height="20" rx="5" fill="#374151" />
                                            <rect x="118" y="130" width="4" height="20" fill="#9CA3AF" />
                                            <circle cx="120" cy="140" r="8" fill="#FFDBAC" />
                                            <path d="M140 110 Q 150 120 140 130" stroke="#3B82F6" strokeLinecap="round" strokeWidth="3" opacity="0.8" />
                                            <path d="M150 105 Q 165 120 150 135" stroke="#3B82F6" strokeLinecap="round" strokeWidth="3" opacity="0.5" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <div className="text-center mb-5">
                                        <h3 className="text-2xl font-bold text-blue-900 mb-2">¿Listo para el acto cívico?</h3>
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            Sigue los pasos para coordinar con {auxDisplayName}.
                                        </p>
                                    </div>

                                    {/* Step indicators */}
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${standbyNotified ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                                            }`}>
                                            {standbyNotified ? '✓' : '1'}
                                        </div>
                                        <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${standbyNotified ? 'bg-emerald-400' : 'bg-gray-200'
                                            }`} />
                                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${standbyNotified ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                                            }`}>
                                            2
                                        </div>
                                    </div>

                                    {/* Step 1: Notify Osvaldo */}
                                    <div className={`rounded-xl p-4 mb-3 flex items-start gap-3 border transition-all duration-300 ${standbyNotified
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-gray-50 border-gray-100'
                                        }`}>
                                        <div className={`p-2 rounded-lg shrink-0 ${standbyNotified ? 'bg-emerald-100' : 'bg-blue-100'
                                            }`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: standbyNotified ? '#059669' : '#2563EB', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                                                {standbyNotified ? 'check_circle' : 'videocam'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-800 mb-1 uppercase tracking-wide">Paso 1 — Preparar cámara</p>
                                            <p className="text-sm text-gray-500 leading-relaxed">
                                                {standbyNotified
                                                    ? <span className="font-semibold text-emerald-700">✅ {auxDisplayName} fue notificado</span>
                                                    : <>Notifica a <strong className="text-blue-600">{auxDisplayName}</strong> para que prepare la cámara DJI Osmo.</>
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* Step 2: Info */}
                                    <div className={`rounded-xl p-4 mb-6 flex items-start gap-3 border transition-all duration-300 ${standbyNotified
                                        ? 'bg-gray-50 border-gray-100'
                                        : 'bg-gray-50/50 border-gray-100/50 opacity-50'
                                        }`}>
                                        <div className={`p-2 rounded-lg shrink-0 ${standbyNotified ? 'bg-blue-100' : 'bg-gray-100'
                                            }`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: standbyNotified ? '#2563EB' : '#9CA3AF', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>mic</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-800 mb-1 uppercase tracking-wide">Paso 2 — Iniciar grabación</p>
                                            <p className="text-sm text-gray-500 leading-relaxed">
                                                Se grabarán <strong className="text-blue-600">90 segundos</strong> de tu voz para asegurar el estándar de calidad del acto.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Button A: Notify Standby */}
                                    <button
                                        onClick={handleNotifyStandby}
                                        disabled={isNotifyingSaving || standbyNotified}
                                        className={`w-full transition-all font-semibold py-4 rounded-xl flex items-center justify-center gap-2 text-base mb-3 ${standbyNotified
                                            ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 cursor-default'
                                            : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-lg shadow-blue-500/30'
                                            }`}
                                        style={{ opacity: standbyNotified ? 0.85 : (isNotifyingSaving ? 0.65 : 1) }}
                                    >
                                        {isNotifyingSaving ? (
                                            <><Loader2 size={16} className="animate-spin" /> Notificando...</>
                                        ) : standbyNotified ? (
                                            <><CheckCircle2 size={16} /> Notificado — {auxDisplayName} está listo</>
                                        ) : (
                                            <>Notificar a {auxDisplayName} (Preparar Cámara)</>
                                        )}
                                    </button>

                                    {/* Button B: Start Civic Act */}
                                    <button
                                        onClick={startCivicRecording}
                                        disabled={!standbyNotified || isCivicSaving}
                                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 text-base"
                                        style={{ opacity: (!standbyNotified || isCivicSaving) ? 0.4 : 1 }}
                                    >
                                        <span>{isCivicSaving ? 'Preparando...' : 'Iniciar Acto Cívico (grabar 90s)'}</span>
                                        {!isCivicSaving && standbyNotified && (
                                            <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 500" }}>arrow_forward</span>
                                        )}
                                    </button>

                                    {/* Error display */}
                                    {civicError && (
                                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                                            <p className="m-0 text-sm font-bold text-red-700">{civicError}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ─── RECORDING VIEW (same modal) ─── */}
                        {showCivicRecorder && (
                            <>
                                <style>{`
                                    @keyframes civicWaveMotion {
                                        0%, 100% { transform: scaleY(0.45); opacity: 0.4; }
                                        50% { transform: scaleY(1); opacity: 1; }
                                    }
                                `}</style>

                                {/* Header with live indicator */}
                                <div className="bg-blue-50 pt-6 pb-5 px-6 flex flex-col items-center justify-center relative overflow-hidden">
                                    <div className="absolute w-64 h-64 bg-blue-500/5 rounded-full blur-2xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    <div className="relative z-10 text-center">
                                        <div className="inline-flex items-center gap-2 bg-red-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-3">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                                            </span>
                                            Grabando
                                        </div>
                                        <h3 className="text-xl font-bold text-blue-900 mb-1">Tu momento ✨</h3>
                                        <p className="text-sm text-gray-500">Tú marcas el inicio de la misión.</p>
                                    </div>
                                </div>

                                <div className="p-6 flex flex-col gap-4">
                                    {/* Mic permission warning */}
                                    {micPermissionBlocked && !isCivicRecording && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                            <p className="m-0 text-sm font-bold text-amber-800 leading-snug">Necesitamos permiso de micrófono</p>
                                            <p className="m-0 text-sm font-medium text-amber-700 leading-snug">para registrar la evidencia del acto cívico.</p>
                                            <button
                                                onClick={startCivicRecording}
                                                disabled={isCivicSaving}
                                                className="mt-3 w-full rounded-xl bg-amber-500 text-white text-sm font-bold py-2.5"
                                                style={{ opacity: isCivicSaving ? 0.7 : 1 }}
                                            >
                                                Permitir micrófono
                                            </button>
                                        </div>
                                    )}

                                    {/* Wave animation + progress */}
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                        <p className="m-0 text-xs font-semibold text-gray-800 uppercase tracking-wide mb-3">Grabando evidencia de audio (90s)</p>

                                        {/* Wave bars */}
                                        <div className="flex items-end justify-center gap-1 h-12">
                                            {Array.from({ length: 18 }).map((_, index) => (
                                                <span
                                                    key={`wave-${index}`}
                                                    style={{
                                                        width: 4,
                                                        height: `${14 + ((index * 5) % 22)}px`,
                                                        borderRadius: 999,
                                                        backgroundColor: isCivicRecording ? '#2563EB' : '#94A3B8',
                                                        animation: 'civicWaveMotion 1s ease-in-out infinite',
                                                        animationDelay: `${index * 0.08}s`,
                                                        opacity: isCivicRecording ? 1 : 0.5
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        {/* Timer + percentage */}
                                        <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-600">
                                            <span>{formatDuration(civicElapsedSeconds)} / {formatDuration(CIVIC_REQUIRED_SECONDS)}</span>
                                            {isCivicSaving && !isCivicRecording ? (
                                                <span className="inline-flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Guardando...</span>
                                            ) : (
                                                <span>{Math.round(civicProgressPercent)}%</span>
                                            )}
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${civicProgressPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Finish button */}
                                    <button
                                        onClick={handleFinishCivic}
                                        disabled={!isCivicRecording || isCivicSaving}
                                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 text-base"
                                        style={{ opacity: !isCivicRecording || isCivicSaving ? 0.5 : 1 }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>check_circle</span>
                                        <span>Terminar acto cívico</span>
                                    </button>

                                    {/* Aux evidence status */}
                                    {(auxEvidenceInProcess || auxEvidenceReady) && (
                                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                                            {auxEvidenceReady ? (
                                                <p className="m-0 text-sm font-bold text-emerald-600 inline-flex items-center gap-2">
                                                    <CheckCircle2 size={16} />
                                                    Evidencia lista
                                                </p>
                                            ) : (
                                                <>
                                                    <p className="m-0 text-sm font-bold text-gray-700">Evidencia en proceso…</p>
                                                    <p className="m-0 text-xs text-gray-500">{auxDisplayName} está grabando.</p>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Error + retry */}
                                    {civicError && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                                            <p className="m-0 text-sm font-bold text-red-700">{civicError}</p>
                                            {pendingCivicBlob && !isCivicRecording && (
                                                <button
                                                    onClick={handleRetryAudioUpload}
                                                    disabled={isCivicSaving}
                                                    className="mt-2.5 w-full rounded-xl bg-red-500 text-white text-sm font-bold py-2"
                                                    style={{ opacity: isCivicSaving ? 0.65 : 1 }}
                                                >
                                                    Reintentar guardado
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                </div>
            )}

            {showEarlyFinishModal && role === 'teacher' && (
                <div className="fixed inset-0 z-[120] bg-slate-950/55 px-4 py-6 flex items-end justify-center">
                    <div className="w-full max-w-lg rounded-3xl bg-white text-slate-900 border border-slate-200 p-5 shadow-[0_30px_50px_-28px_rgba(15,23,42,0.65)]">
                        <h3 className="text-[22px] font-black tracking-tight mb-1">Terminaste antes de los 90s</h3>
                        <p className="text-[14px] text-slate-600 mb-3">Selecciona el motivo para registro de calidad.</p>

                        <div className="grid gap-2">
                            {CIVIC_EARLY_FINISH_REASONS.map((reason) => {
                                const selected = earlyFinishReason === reason;
                                return (
                                    <button
                                        key={reason}
                                        onClick={() => {
                                            setEarlyFinishReason(reason);
                                            if (reason !== 'Otro (especificar)') {
                                                setEarlyFinishOtherReason('');
                                            }
                                        }}
                                        className="w-full text-left rounded-xl px-3.5 py-2.5 text-[14px] font-bold"
                                        style={{
                                            border: selected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                            backgroundColor: selected ? '#eff6ff' : 'white',
                                            color: '#0f172a'
                                        }}
                                    >
                                        {reason}
                                    </button>
                                );
                            })}
                        </div>

                        {earlyFinishReason === 'Otro (especificar)' && (
                            <textarea
                                value={earlyFinishOtherReason}
                                onChange={(event) => setEarlyFinishOtherReason(event.target.value)}
                                placeholder="Especifica el motivo"
                                rows={3}
                                className="w-full mt-3 rounded-xl border border-slate-300 px-3 py-2 text-[14px] text-slate-800 outline-none"
                                style={{ resize: 'none' }}
                            />
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                onClick={handleConfirmEarlyFinish}
                                disabled={!canConfirmEarlyFinish}
                                className="rounded-xl bg-slate-900 text-white text-[14px] font-extrabold py-2.5"
                                style={{ opacity: canConfirmEarlyFinish ? 1 : 0.55 }}
                            >
                                Confirmar y terminar
                            </button>
                            <button
                                onClick={() => setShowEarlyFinishModal(false)}
                                className="rounded-xl border border-slate-300 text-slate-700 text-[14px] font-bold py-2.5 bg-white"
                            >
                                Seguir grabando
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {civicToast && (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-5 z-[130] rounded-full bg-slate-900 text-white px-4 py-2 text-[13px] font-bold shadow-[0_14px_28px_-18px_rgba(15,23,42,0.75)]">
                    {civicToast}
                </div>
            )}
        </>
    );
}
