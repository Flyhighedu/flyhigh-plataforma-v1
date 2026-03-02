'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Radio } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { deleteMediaDraft, downloadMediaBlob, loadMediaDraft, saveMediaDraft } from '@/utils/mediaDraftStore';

const VIDEO_MIME_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
];

const VIDEO_CAPTURE_ATTEMPTS = [
    {
        mode: 'rear_video_audio',
        constraints: {
            video: { facingMode: { ideal: 'environment' } },
            audio: true
        }
    },
    {
        mode: 'video_audio',
        constraints: {
            video: true,
            audio: true
        }
    },
    {
        mode: 'video_only',
        constraints: {
            video: true,
            audio: false
        }
    }
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

function getVideoStartErrorCode(error) {
    const errorName = String(error?.name || '').trim();

    if (['NotAllowedError', 'PermissionDeniedError'].includes(errorName)) {
        return 'permission_denied';
    }

    if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(errorName)) {
        return 'camera_not_found';
    }

    if (['NotReadableError', 'TrackStartError'].includes(errorName)) {
        return 'camera_busy';
    }

    if (errorName === 'SecurityError') {
        return 'security_error';
    }

    if (errorName === 'AbortError') {
        return 'aborted';
    }

    return 'unknown';
}

function getVideoStartErrorMessage(errorCode) {
    if (errorCode === 'permission_denied') {
        return 'No tenemos permiso para usar la cámara. Revisa permisos y vuelve a intentar.';
    }

    if (errorCode === 'camera_not_found') {
        return 'No encontramos una cámara disponible en este dispositivo.';
    }

    if (errorCode === 'camera_busy') {
        return 'La cámara está ocupada por otra app o pestaña. Ciérrala e inténtalo de nuevo.';
    }

    if (errorCode === 'security_error') {
        return 'La cámara solo funciona en una conexión segura (HTTPS).';
    }

    if (errorCode === 'unsupported') {
        return 'Tu navegador no permite grabar video aquí.';
    }

    return 'No se pudo iniciar la grabación. Intenta nuevamente.';
}

async function requestVideoStreamWithFallback() {
    let lastError = null;

    for (const attempt of VIDEO_CAPTURE_ATTEMPTS) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
            return { stream, captureMode: attempt.mode };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No se pudo obtener un stream de cámara válido.');
}

export default function AuxCivicEvidenceParallelScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh,
    onBackToTask
}) {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [auxStatus, setAuxStatus] = useState('pending_recording');
    const [auxError, setAuxError] = useState('');
    const [auxErrorCode, setAuxErrorCode] = useState('');
    const [pendingVideoBlob, setPendingVideoBlob] = useState(null);

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const videoChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);
    const recordingStartRef = useRef(null);
    const previewVideoRef = useRef(null);

    const meta = parseMeta(missionInfo?.meta);

    const draftKey = useMemo(() => {
        if (!journeyId || !userId) return null;
        return `civic-video:${journeyId}:${userId}`;
    }, [journeyId, userId]);

    useEffect(() => {
        const metaStatus = meta.civic_parallel_aux_status || 'pending_recording';
        const normalizedStatus = metaStatus === 'recording' && !isRecording ? 'pending_upload' : metaStatus;

        if (!isRecording) {
            setAuxStatus(normalizedStatus);
        }

        setAuxError(typeof meta.civic_parallel_aux_error === 'string' ? meta.civic_parallel_aux_error : '');
        setAuxErrorCode(typeof meta.civic_parallel_aux_error_code === 'string' ? meta.civic_parallel_aux_error_code : '');
    }, [meta.civic_parallel_aux_status, meta.civic_parallel_aux_error, meta.civic_parallel_aux_error_code, isRecording]);

    useEffect(() => {
        const loadDraft = async () => {
            if (!draftKey) return;
            if (!['pending_upload', 'failed', 'uploading'].includes(auxStatus) || pendingVideoBlob) return;

            try {
                const draftBlob = await loadMediaDraft(draftKey);
                if (draftBlob) {
                    setPendingVideoBlob(draftBlob);
                }
            } catch (error) {
                console.warn('No se pudo restaurar borrador de video:', error);
            }
        };

        loadDraft();
    }, [auxStatus, draftKey, pendingVideoBlob]);

    useEffect(() => {
        const previewNode = previewVideoRef.current;

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }

            if (previewNode) {
                previewNode.srcObject = null;
            }

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (!isRecording) return;

        const previewNode = previewVideoRef.current;
        const stream = mediaStreamRef.current;

        if (!previewNode || !stream) return;

        if (previewNode.srcObject !== stream) {
            previewNode.srcObject = stream;
        }

        previewNode.muted = true;
        previewNode.playsInline = true;
        const playPromise = previewNode.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
        }
    }, [isRecording]);

    const firstName = profile?.full_name?.split(' ')[0] || 'Auxiliar';
    const roleName = ROLE_LABELS[profile?.role] || 'Auxiliar';

    const updateJourneyMeta = async (patch) => {
        const supabase = createClient();
        const now = new Date().toISOString();

        const { data: currentData, error: selectError } = await supabase
            .from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single();

        if (selectError) throw selectError;

        const currentMeta = parseMeta(currentData?.meta);
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

        return nextMeta;
    };

    const markCaptureFailure = async (errorCode, message) => {
        try {
            await updateJourneyMeta({
                civic_parallel_aux_status: 'failed',
                civic_parallel_aux_error: message,
                civic_parallel_aux_error_code: errorCode,
                civic_parallel_aux_failed_at: new Date().toISOString()
            });
        } catch (metaError) {
            console.warn('No se pudo guardar estado failed de video:', metaError);
        }

        setAuxStatus('failed');
        setAuxError(message);
        setAuxErrorCode(errorCode);
    };

    const uploadVideoEvidence = async (blob, durationSec) => {
        if (!blob) return;

        setIsUploading(true);
        setAuxError('');
        setAuxStatus('uploading');

        try {
            await updateJourneyMeta({
                civic_parallel_aux_status: 'uploading',
                civic_parallel_aux_error: null,
                civic_parallel_aux_error_code: null,
                civic_parallel_aux_failed_at: null
            });

            const supabase = createClient();
            const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
            const filePath = `${journeyId}/civic-video/aux-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from('staff-arrival')
                .upload(filePath, blob, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('staff-arrival')
                .getPublicUrl(filePath);

            await updateJourneyMeta({
                civic_parallel_aux_status: 'uploaded',
                civic_parallel_aux_video_url: publicData.publicUrl,
                civic_parallel_aux_error: null,
                civic_parallel_aux_error_code: null,
                civic_parallel_aux_failed_at: null,
                civic_parallel_aux_duration_sec: durationSec,
                civic_parallel_aux_uploaded_at: new Date().toISOString()
            });

            if (draftKey) {
                await deleteMediaDraft(draftKey);
            }

            setPendingVideoBlob(null);
            setAuxStatus('uploaded');
            setAuxErrorCode('');
            onRefresh && onRefresh();

            if (typeof onBackToTask === 'function') {
                setTimeout(() => {
                    onBackToTask();
                }, 280);
            }
        } catch (error) {
            const message = error?.message || 'No se pudo subir.';

            try {
                await updateJourneyMeta({
                    civic_parallel_aux_status: 'failed',
                    civic_parallel_aux_error: message,
                    civic_parallel_aux_error_code: 'upload_failed',
                    civic_parallel_aux_failed_at: new Date().toISOString()
                });
            } catch (metaError) {
                console.warn('No se pudo guardar estado failed de video:', metaError);
            }

            setAuxStatus('failed');
            setAuxError(message);
            setAuxErrorCode('upload_failed');
        } finally {
            setIsUploading(false);
        }
    };

    const startRecording = async () => {
        if (isRecording || isUploading) return;

        setAuxError('');
        setAuxErrorCode('');

        const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
        const isSecureContext = typeof window === 'undefined' ? true : window.isSecureContext === true;

        if (!hasMediaDevices || !hasMediaRecorder || !isSecureContext) {
            const errorCode = isSecureContext ? 'unsupported' : 'security_error';
            const message = getVideoStartErrorMessage(errorCode);
            await markCaptureFailure(errorCode, message);
            return;
        }

        try {
            const { stream, captureMode } = await requestVideoStreamWithFallback();

            const mimeType = pickSupportedMimeType(VIDEO_MIME_TYPES);
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

            mediaStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            videoChunksRef.current = [];
            recordingStartRef.current = Date.now();

            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = stream;
                previewVideoRef.current.muted = true;
                previewVideoRef.current.play().catch(() => { });
            }

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    videoChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = null;
                }

                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                    mediaStreamRef.current = null;
                }

                const outputType = mimeType || 'video/webm';
                const videoBlob = new Blob(videoChunksRef.current, { type: outputType });
                const durationSec = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));

                setSeconds(durationSec);
                setPendingVideoBlob(videoBlob);

                if (draftKey) {
                    await saveMediaDraft(draftKey, videoBlob);
                }

                await updateJourneyMeta({
                    civic_parallel_aux_status: 'pending_upload',
                    civic_parallel_aux_duration_sec: durationSec,
                    civic_parallel_aux_stopped_at: new Date().toISOString(),
                    civic_parallel_aux_error: null,
                    civic_parallel_aux_error_code: null,
                    civic_parallel_aux_failed_at: null
                });

                setAuxStatus('pending_upload');
                await uploadVideoEvidence(videoBlob, durationSec);
            };

            recorder.start(1000);

            setIsRecording(true);
            setAuxStatus('recording');
            setAuxError('');
            setAuxErrorCode('');
            setSeconds(0);

            await updateJourneyMeta({
                civic_parallel_aux_status: 'recording',
                civic_parallel_aux_started_at: new Date().toISOString(),
                civic_parallel_aux_error: null,
                civic_parallel_aux_error_code: null,
                civic_parallel_aux_failed_at: null,
                civic_parallel_aux_capture_mode: captureMode
            });

            timerIntervalRef.current = setInterval(() => {
                setSeconds((value) => value + 1);
            }, 1000);
        } catch (error) {
            console.error('Error iniciando grabación de evidencia:', error);

            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = null;
            }

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                mediaStreamRef.current = null;
            }

            const errorCode = getVideoStartErrorCode(error);
            const message = getVideoStartErrorMessage(errorCode);
            await markCaptureFailure(errorCode, message);
        }
    };

    const stopRecording = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        setIsRecording(false);

        try {
            mediaRecorderRef.current.stop();
        } catch (error) {
            console.error('Error deteniendo grabacion de evidencia:', error);
            markCaptureFailure('stop_error', 'No se pudo detener la grabacion. Intenta de nuevo.');
        }
    };

    const handleRetryUpload = async () => {
        if (isUploading) return;

        let blob = pendingVideoBlob;
        if (!blob && draftKey) {
            blob = await loadMediaDraft(draftKey);
            if (blob) setPendingVideoBlob(blob);
        }

        if (!blob) {
            await startRecording();
            return;
        }

        const durationSec = Number(meta.civic_parallel_aux_duration_sec) || seconds || 60;
        await uploadVideoEvidence(blob, durationSec);
    };

    const handleSaveCopy = async () => {
        let blob = pendingVideoBlob;
        if (!blob && draftKey) {
            blob = await loadMediaDraft(draftKey);
            if (blob) setPendingVideoBlob(blob);
        }

        if (!blob) {
            setAuxError('No hay una copia local para guardar.');
            return;
        }

        downloadMediaBlob(blob, `acto-civico-evidencia-${journeyId || 'draft'}.webm`);
    };

    const showRetryActions = ['pending_upload', 'failed'].includes(auxStatus);
    const hasDraftForUpload = Boolean(pendingVideoBlob) || auxStatus === 'pending_upload';
    const isUploadFailure = hasDraftForUpload || auxErrorCode === 'upload_failed';
    const retryPrimaryLabel = isUploadFailure ? 'Reintentar' : 'Abrir camara';
    const retryTitle = isUploadFailure ? 'No se pudo subir' : 'No se pudo iniciar la camara';
    const retryMessage = isUploadFailure
        ? 'No pasa nada. Quedo guardado para reintentar.'
        : auxErrorCode === 'permission_denied'
            ? 'Activa permisos de camara en el navegador y vuelve a intentar.'
            : auxErrorCode === 'camera_not_found'
                ? 'No detectamos una camara disponible en este dispositivo.'
                : auxErrorCode === 'security_error'
                    ? 'Necesitas abrir la app en una conexion segura (HTTPS).'
                    : 'Puedes reintentar o volver a tu tarea.';
    const showSaveCopyButton = isUploadFailure && Boolean(pendingVideoBlob);
    const canStartVideoRecording =
        !isRecording &&
        auxStatus !== 'uploading' &&
        (!pendingVideoBlob || ['pending_recording', 'uploaded'].includes(auxStatus));

    const handleBackToTaskWithSkip = async () => {
        try {
            const now = new Date().toISOString();
            const shouldSkipEvidence = auxStatus !== 'uploaded';

            if (journeyId && shouldSkipEvidence) {
                await updateJourneyMeta({
                    civic_parallel_aux_status: 'skipped',
                    civic_parallel_aux_skipped: true,
                    civic_parallel_aux_skipped_at: now,
                    civic_parallel_aux_skipped_by: userId,
                    civic_parallel_aux_skipped_by_name: profile?.full_name || firstName,
                    civic_parallel_aux_done_at: meta.civic_parallel_aux_done_at || now,
                    civic_parallel_aux_error: null,
                    civic_parallel_aux_error_code: null,
                    civic_parallel_aux_failed_at: null
                });

                setAuxStatus('skipped');
                setAuxError('');
                setAuxErrorCode('');
            }

            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error marcando skip de evidencia auxiliar:', error);
        } finally {
            if (typeof onBackToTask === 'function') {
                onBackToTask();
            }
        }
    };

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#F3F4F6',
            color: '#111827',
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased'
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
                chipOverride="Evidencia"
                hideTeacherCivicFab={true}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '16px 24px 140px',
                overflowY: 'auto',
                maxWidth: 448,
                margin: '0 auto',
                width: '100%'
            }}>
                {/* ─── Civic Scene Illustration ─── */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 340 }}>
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: '#DBEAFE',
                            borderRadius: '50%',
                            transform: 'scale(0.7)',
                            opacity: 0.5,
                            filter: 'blur(32px)'
                        }} />
                        <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', position: 'relative', zIndex: 1 }}>
                            <defs>
                                <filter id="shadow-phone" x="-20%" y="-20%" width="140%" height="150%">
                                    <feDropShadow dx="0" dy="25" stdDeviation="20" floodColor="#0f172a" floodOpacity="0.3" />
                                </filter>
                                <filter id="shadow-soft" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#64748b" floodOpacity="0.15" />
                                </filter>
                                <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                                <clipPath id="pantalla-clip">
                                    <rect x="270" y="160" width="460" height="230" rx="16" />
                                </clipPath>
                                <g id="escena-civica">
                                    <path d="M 200 150 Q 240 130 280 150 Q 320 140 360 160 Q 300 180 200 150 Z" fill="#e0f2fe" />
                                    <path d="M 750 200 Q 790 180 830 200 Q 860 190 880 220 Q 820 230 750 200 Z" fill="#e0f2fe" />
                                    <rect x="150" y="250" width="700" height="250" rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="4" />
                                    <line x1="150" y1="400" x2="850" y2="400" stroke="#f1f5f9" strokeWidth="6" />
                                    <rect x="320" y="100" width="12" height="400" rx="6" fill="#cbd5e1" />
                                    <circle cx="326" cy="95" r="10" fill="#fbbf24" />
                                    <g>
                                        <animateTransform attributeName="transform" type="skewY" values="0; 2; 0; -2; 0" dur="4s" repeatCount="indefinite" />
                                        <path d="M 332 110 L 412 110 L 412 180 L 332 180 Z" fill="#10b981" />
                                        <path d="M 412 110 L 492 110 L 492 180 L 412 180 Z" fill="#ffffff" />
                                        <circle cx="452" cy="145" r="12" fill="#ca8a04" />
                                        <circle cx="452" cy="145" r="8" fill="#ffffff" />
                                        <circle cx="452" cy="145" r="4" fill="#65a30d" />
                                        <path d="M 492 110 L 572 110 L 572 180 L 492 180 Z" fill="#ef4444" />
                                    </g>
                                    <g transform="translate(550, 260)">
                                        <ellipse cx="60" cy="230" rx="70" ry="15" fill="#e2e8f0" />
                                        <g id="orador">
                                            <rect x="20" y="45" width="80" height="80" rx="20" fill="#1e293b" />
                                            <polygon points="45,45 75,45 60,85" fill="#f8fafc" />
                                            <polygon points="58,55 62,55 63,60 57,60" fill="#dc2626" />
                                            <polygon points="57,60 63,60 60,95" fill="#ef4444" />
                                            <rect x="52" y="30" width="16" height="20" rx="6" fill="#fed7aa" />
                                            <circle cx="60" cy="20" r="18" fill="#ffedd5" />
                                            <path d="M 41 22 A 19 19 0 0 1 79 22 Z" fill="#0f172a" />
                                            <circle cx="53" cy="20" r="2.5" fill="#0f172a" />
                                            <circle cx="67" cy="20" r="2.5" fill="#0f172a" />
                                            <path d="M 56 26 Q 60 26 64 26" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round">
                                                <animate attributeName="d" values="M 56 26 Q 60 26 64 26; M 56 26 Q 60 30 64 26; M 56 26 Q 60 26 64 26" dur="1.5s" repeatCount="indefinite" />
                                            </path>
                                        </g>
                                        <rect x="20" y="100" width="80" height="130" rx="4" fill="#8b5cf6" />
                                        <rect x="10" y="80" width="100" height="20" rx="4" fill="#7c3aed" />
                                        <rect x="30" y="100" width="60" height="130" fill="#6d28d9" opacity="0.3" />
                                        <polygon points="40,110 80,110 70,220 50,220" fill="#a78bfa" opacity="0.2" />
                                        <circle cx="25" cy="80" r="7" fill="#ffedd5" />
                                        <circle cx="95" cy="80" r="7" fill="#ffedd5" />
                                        <path d="M 45 80 Q 40 50 25 40" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
                                        <ellipse cx="20" cy="35" rx="6" ry="8" fill="#1e293b" transform="rotate(-30 20 35)" />
                                        <path d="M 75 80 Q 80 50 95 40" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
                                        <ellipse cx="100" cy="35" rx="6" ry="8" fill="#1e293b" transform="rotate(30 100 35)" />
                                    </g>
                                </g>
                            </defs>

                            <use href="#escena-civica" />

                            <g>
                                <animateTransform attributeName="transform" type="translate" values="0,700; 0,0; 0,0; 0,700; 0,700" keyTimes="0; 0.15; 0.8; 0.95; 1" calcMode="spline" keySplines="0.2 0 0.2 1; 1 0 0 1; 0.8 0 0.8 1; 1 0 0 1" dur="8s" repeatCount="indefinite" />
                                <ellipse cx="500" cy="520" rx="200" ry="25" fill="#0f172a" opacity="0.1" />
                                <rect x="250" y="140" width="500" height="270" rx="30" fill="#1e293b" filter="url(#shadow-phone)" />
                                <rect x="260" y="150" width="480" height="250" rx="20" fill="#020617" />
                                <g clipPath="url(#pantalla-clip)">
                                    <rect x="270" y="160" width="460" height="230" fill="#000000" />
                                    <g transform="translate(-130, -50) scale(1.25)">
                                        <use href="#escena-civica" />
                                    </g>
                                    <rect x="270" y="160" width="460" height="230" fill="#000000" opacity="0.1" />
                                    <line x1="423" y1="160" x2="423" y2="390" stroke="#ffffff" strokeWidth="1.5" opacity="0.3" />
                                    <line x1="576" y1="160" x2="576" y2="390" stroke="#ffffff" strokeWidth="1.5" opacity="0.3" />
                                    <line x1="270" y1="236" x2="730" y2="236" stroke="#ffffff" strokeWidth="1.5" opacity="0.3" />
                                    <line x1="270" y1="313" x2="730" y2="313" stroke="#ffffff" strokeWidth="1.5" opacity="0.3" />
                                    <g stroke="#facc15" strokeWidth="3" fill="none">
                                        <path d="M 460 250 L 460 230 L 480 230" />
                                        <path d="M 520 230 L 540 230 L 540 250" />
                                        <path d="M 460 300 L 460 320 L 480 320" />
                                        <path d="M 540 300 L 540 320 L 520 320" />
                                        <animateTransform attributeName="transform" type="scale" values="1.1; 1; 1" keyTimes="0; 0.25; 1" dur="8s" repeatCount="indefinite" />
                                        <animateTransform attributeName="transform" type="translate" additive="sum" values="-50,-27; 0,0; 0,0" keyTimes="0; 0.25; 1" dur="8s" repeatCount="indefinite" />
                                    </g>
                                    <rect x="650" y="160" width="80" height="230" fill="#000000" opacity="0.5" />
                                    <circle cx="690" cy="275" r="24" fill="none" stroke="#ffffff" strokeWidth="4" />
                                    <circle cx="690" cy="275" r="18" fill="#ef4444" />
                                    <g transform="translate(290, 185)">
                                        <circle cx="0" cy="0" r="8" fill="#ef4444" filter="url(#glow-red)">
                                            <animate attributeName="opacity" values="1; 0; 1; 0; 1; 0; 1; 0; 1" keyTimes="0; 0.2; 0.3; 0.4; 0.5; 0.6; 0.7; 0.8; 1" dur="8s" repeatCount="indefinite" />
                                        </circle>
                                        <text x="15" y="5" fontFamily="sans-serif" fontWeight="bold" fontSize="16" fill="#ffffff">REC</text>
                                    </g>
                                </g>
                                <path d="M 270 160 L 500 160 L 350 390 L 270 390 Z" fill="#ffffff" opacity="0.05" />
                                <rect x="230" y="220" width="20" height="110" rx="10" fill="#000000" />
                                <circle cx="240" cy="275" r="4" fill="#1e293b" />
                                <circle cx="240" cy="275" r="1.5" fill="#38bdf8" />
                                <g transform="translate(210, 310)">
                                    <rect x="0" y="0" width="50" height="30" rx="15" fill="#fed7aa" />
                                    <rect x="-10" y="35" width="50" height="30" rx="15" fill="#fdba74" />
                                    <rect x="-15" y="70" width="50" height="30" rx="15" fill="#fdba74" />
                                    <path d="M -60 0 L -10 0 L -25 100 L -60 100 Z" fill="#3b82f6" />
                                </g>
                                <g transform="translate(730, 230)">
                                    <rect x="-20" y="30" width="30" height="70" rx="15" fill="#fed7aa" transform="rotate(-15 -5 65)" />
                                    <rect x="10" y="0" width="40" height="100" rx="20" fill="#fdba74" />
                                    <path d="M 40 -10 L 80 -10 L 80 110 L 40 110 Z" fill="#2563eb" />
                                </g>
                                <g transform="translate(500, 275)">
                                    <animateTransform attributeName="transform" type="scale" values="0; 0; 1.2; 1; 1; 0" keyTimes="0; 0.73; 0.76; 0.8; 0.9; 0.95" dur="8s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.73; 0.75; 0.9; 0.95" dur="8s" repeatCount="indefinite" />
                                    <circle cx="0" cy="0" r="45" fill="#10b981" filter="url(#shadow-soft)" />
                                    <circle cx="0" cy="0" r="38" fill="none" stroke="#34d399" strokeWidth="2" />
                                    <path d="M -18 -2 L -4 10 L 22 -16" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                                </g>
                            </g>
                        </svg>
                    </div>
                </div>

                {/* ─── Title + Description ─── */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <h2 style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: '#111827',
                        marginBottom: 8,
                        letterSpacing: '-0.01em'
                    }}>
                        Graba evidencia
                    </h2>
                    <p style={{
                        margin: '0 auto',
                        fontSize: 14,
                        color: '#6B7280',
                        lineHeight: 1.5,
                        maxWidth: 280
                    }}>
                        Espera a que Isa empiece a hablar y comienza a grabar.
                    </p>
                    <p style={{
                        marginTop: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#2563EB'
                    }}>
                        Con 1-2 minutos basta.
                    </p>
                </div>

                {/* ─── Tips Card ─── */}
                <div style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 24,
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #F3F4F6'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Tip 1 */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{
                                flexShrink: 0,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: '#EFF6FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 2
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563EB', fontVariationSettings: "'FILL' 1" }}>videocam</span>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#374151' }}>Enfoca al docente</p>
                                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>Asegúrate de tener buena iluminación.</p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '100%', height: 1, background: '#F3F4F6' }} />

                        {/* Tip 2 */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{
                                flexShrink: 0,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: '#EFF6FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 2
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563EB', fontVariationSettings: "'FILL' 1" }}>mic</span>
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#374151' }}>Audio claro</p>
                                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>Evita ruidos externos durante la grabación.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Modo Ligero Pill ─── */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <button style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 999,
                        border: '1px solid #DBEAFE',
                        background: '#EFF6FF',
                        cursor: 'pointer',
                        transition: 'transform 0.15s'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563EB', fontVariationSettings: "'FILL' 1" }}>wifi_tethering</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#2563EB' }}>Modo ligero para ahorrar datos</span>
                    </button>
                </div>

                {/* ─── Recording States (shown when active) ─── */}
                {(isRecording || auxStatus === 'uploading' || auxStatus === 'uploaded' || showRetryActions) && (
                    <div style={{
                        background: 'white',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #E5E7EB',
                        marginBottom: 24
                    }}>
                        {/* Video preview */}
                        <div style={{ position: 'relative', height: 200, background: '#111827' }}>
                            <video
                                ref={previewVideoRef}
                                playsInline
                                muted
                                autoPlay
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    opacity: isRecording ? 1 : 0.3
                                }}
                            />

                            {!isRecording && auxStatus !== 'uploaded' && !showRetryActions && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    color: 'white'
                                }}>
                                    <Camera size={28} />
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Preparado para grabar</p>
                                </div>
                            )}

                            {isRecording && (
                                <div style={{
                                    position: 'absolute',
                                    top: 12,
                                    right: 12,
                                    padding: '6px 12px',
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(239,68,68,0.9)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: 'white'
                                }}>
                                    <Radio size={12} />
                                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>REC</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(seconds)}</span>
                                </div>
                            )}
                        </div>

                        {/* Action area */}
                        <div style={{ padding: 16 }}>
                            {auxStatus === 'uploading' && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 4 }}>
                                    <Loader2 size={16} className="animate-spin" style={{ color: '#2563EB' }} />
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151' }}>Subiendo evidencia…</p>
                                </div>
                            )}

                            {auxStatus === 'uploaded' && (
                                <div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        padding: '12px 0 16px'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#16A34A', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#16A34A' }}>Evidencia enviada</p>
                                    </div>
                                    <button
                                        onClick={handleBackToTaskWithSkip}
                                        style={{
                                            width: '100%',
                                            padding: 13,
                                            borderRadius: 12,
                                            border: '1px solid #E5E7EB',
                                            background: '#F9FAFB',
                                            color: '#374151',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Volver a mi tarea
                                    </button>
                                </div>
                            )}

                            {showRetryActions && (
                                <div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginBottom: 8
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#EF4444', fontVariationSettings: "'FILL' 1" }}>error</span>
                                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#991B1B' }}>{retryTitle}</p>
                                    </div>
                                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6B7280' }}>
                                        {retryMessage}
                                    </p>

                                    {auxError && (
                                        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9CA3AF' }}>{auxError}</p>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: showSaveCopyButton ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                                        <button
                                            onClick={handleRetryUpload}
                                            disabled={isUploading}
                                            style={{
                                                padding: 12,
                                                borderRadius: 12,
                                                border: 'none',
                                                background: '#2563EB',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: 13,
                                                cursor: 'pointer',
                                                opacity: isUploading ? 0.6 : 1
                                            }}
                                        >
                                            {retryPrimaryLabel}
                                        </button>

                                        {showSaveCopyButton && (
                                            <button
                                                onClick={handleSaveCopy}
                                                style={{
                                                    padding: 12,
                                                    borderRadius: 12,
                                                    border: '1px solid #E5E7EB',
                                                    background: '#F9FAFB',
                                                    color: '#374151',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Guardar video
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleBackToTaskWithSkip}
                                        style={{
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 12,
                                            border: '1px solid #E5E7EB',
                                            background: 'transparent',
                                            color: '#6B7280',
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Volver a mi tarea
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {isRecording && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'white',
                    borderTop: '1px solid #F3F4F6',
                    padding: '18px 24px 28px',
                    borderRadius: '24px 24px 0 0',
                    boxShadow: '0 -10px 40px -15px rgba(0,0,0,0.1)',
                    zIndex: 25
                }}>
                    <div style={{ maxWidth: 448, margin: '0 auto' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            marginBottom: 12,
                            color: '#DC2626'
                        }}>
                            <Radio size={13} />
                            <span style={{ fontSize: 12, fontWeight: 800 }}>Grabando {formatDuration(seconds)}</span>
                        </div>
                        <button
                            onClick={stopRecording}
                            style={{
                                width: '100%',
                                padding: 15,
                                borderRadius: 16,
                                border: 'none',
                                background: '#111827',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: 16,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>stop_circle</span>
                            Detener y guardar
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Sticky Bottom Bar ─── */}
            {canStartVideoRecording && !isRecording && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'white',
                    borderTop: '1px solid #F3F4F6',
                    padding: '24px 24px 32px',
                    borderRadius: '24px 24px 0 0',
                    boxShadow: '0 -10px 40px -15px rgba(0,0,0,0.1)',
                    zIndex: 20
                }}>
                    <div style={{ maxWidth: 448, margin: '0 auto' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            marginBottom: 16
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#9CA3AF', fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                            <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>No cierres la app (los datos se guardan)</span>
                        </div>
                        <button
                            onClick={startRecording}
                            disabled={isUploading}
                            style={{
                                width: '100%',
                                padding: 16,
                                borderRadius: 16,
                                border: 'none',
                                background: '#2563EB',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 16,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 12,
                                boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.3)',
                                opacity: isUploading ? 0.6 : 1,
                                transition: 'transform 0.15s'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>videocam</span>
                            <span>Iniciar grabación</span>
                        </button>

                        <button
                            onClick={handleBackToTaskWithSkip}
                            style={{
                                marginTop: 10,
                                width: '100%',
                                padding: 12,
                                borderRadius: 12,
                                border: '1px solid #E5E7EB',
                                background: '#F9FAFB',
                                color: '#6B7280',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer'
                            }}
                        >
                            Volver a mi tarea
                        </button>
                    </div>
                </div>
            )}

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    );
}
