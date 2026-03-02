'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mic, Radio } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { deleteMediaDraft, downloadMediaBlob, loadMediaDraft, saveMediaDraft } from '@/utils/mediaDraftStore';

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

    const safeMeta = parseMeta(meta);
    const seatDone = safeMeta.global_seat_deployment_done === true;
    const headphonesDone = safeMeta.global_headphones_done === true;
    const glassesDone = safeMeta.global_glasses_done === true;

    if (seatDone && headphonesDone && !glassesDone) return 'glasses';
    if (seatDone && !headphonesDone) return 'headphones';
    return 'seat';
}

export default function TeacherCivicParallelScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh,
    onBackToTask
}) {
    const [isStarting, setIsStarting] = useState(false);
    const [startFeedback, setStartFeedback] = useState('');

    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const [audioSeconds, setAudioSeconds] = useState(0);
    const [audioStatus, setAudioStatus] = useState('idle');
    const [audioError, setAudioError] = useState('');
    const [pendingAudioBlob, setPendingAudioBlob] = useState(null);

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);
    const recordingStartRef = useRef(null);

    const meta = parseMeta(missionInfo?.meta);
    const teacherCivicStageLock = normalizeTeacherCivicStageLock(meta.civic_parallel_teacher_stage_lock);
    const civicStarted = meta.civic_parallel_status === 'in_progress';

    const draftKey = useMemo(() => {
        if (!journeyId || !userId) return null;
        return `civic-audio:${journeyId}:${userId}`;
    }, [journeyId, userId]);

    useEffect(() => {
        const metaStatus = meta.civic_parallel_teacher_audio_status || 'idle';
        const normalizedStatus = metaStatus === 'recording' && !isRecordingAudio ? 'pending_upload' : metaStatus;

        if (!isRecordingAudio) {
            setAudioStatus(normalizedStatus);
        }

        if (meta.civic_parallel_teacher_audio_error) {
            setAudioError(meta.civic_parallel_teacher_audio_error);
        }
    }, [
        meta.civic_parallel_teacher_audio_status,
        meta.civic_parallel_teacher_audio_error,
        isRecordingAudio
    ]);

    useEffect(() => {
        const loadDraft = async () => {
            if (!draftKey) return;

            const shouldLoad = ['pending_upload', 'failed', 'uploading'].includes(audioStatus);
            if (!shouldLoad || pendingAudioBlob) return;

            try {
                const draftBlob = await loadMediaDraft(draftKey);
                if (draftBlob) {
                    setPendingAudioBlob(draftBlob);
                }
            } catch (error) {
                console.warn('No se pudo restaurar borrador de audio:', error);
            }
        };

        loadDraft();
    }, [audioStatus, draftKey, pendingAudioBlob]);

    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const firstName = profile?.full_name?.split(' ')[0] || 'Docente';
    const roleName = ROLE_LABELS[profile?.role] || 'Docente';

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

    const uploadAudioEvidence = async (blob, durationSec) => {
        if (!blob) return;

        setIsUploadingAudio(true);
        setAudioError('');
        setAudioStatus('uploading');

        try {
            await updateJourneyMeta({
                civic_parallel_teacher_audio_status: 'uploading',
                civic_parallel_teacher_audio_error: null
            });

            const supabase = createClient();
            const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
            const filePath = `${journeyId}/civic-audio/teacher-${Date.now()}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from('staff-arrival')
                .upload(filePath, blob, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('staff-arrival')
                .getPublicUrl(filePath);

            await updateJourneyMeta({
                civic_parallel_teacher_audio_status: 'uploaded',
                civic_parallel_teacher_audio_url: publicData.publicUrl,
                civic_parallel_teacher_audio_duration_sec: durationSec,
                civic_parallel_teacher_audio_error: null,
                civic_parallel_teacher_audio_uploaded_at: new Date().toISOString(),
                civic_parallel_teacher_done_at: new Date().toISOString(),
                civic_parallel_teacher_done_by: userId,
                civic_parallel_teacher_done_by_name: profile?.full_name || firstName,
                civic_parallel_teacher_stage_lock: null
            });

            if (draftKey) {
                await deleteMediaDraft(draftKey);
            }

            setPendingAudioBlob(null);
            setAudioStatus('uploaded');
            onRefresh && onRefresh();
        } catch (error) {
            const message = error?.message || 'No se pudo subir.';

            try {
                await updateJourneyMeta({
                    civic_parallel_teacher_audio_status: 'failed',
                    civic_parallel_teacher_audio_error: message
                });
            } catch (metaError) {
                console.warn('No se pudo guardar estado failed de audio:', metaError);
            }

            setAudioStatus('failed');
            setAudioError(message);
        } finally {
            setIsUploadingAudio(false);
        }
    };

    const startAudioRecording = async () => {
        if (isRecordingAudio || isUploadingAudio) return;

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            alert('Tu navegador no permite grabar audio aquí.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = pickSupportedMimeType(AUDIO_MIME_TYPES);
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

            mediaStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recordingStartRef.current = Date.now();

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                    mediaStreamRef.current = null;
                }

                const outputType = mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: outputType });
                const durationSec = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));

                setAudioSeconds(durationSec);
                setPendingAudioBlob(audioBlob);

                if (draftKey) {
                    await saveMediaDraft(draftKey, audioBlob);
                }

                await updateJourneyMeta({
                    civic_parallel_teacher_audio_status: 'pending_upload',
                    civic_parallel_teacher_audio_duration_sec: durationSec,
                    civic_parallel_teacher_audio_stopped_at: new Date().toISOString(),
                    civic_parallel_teacher_audio_error: null
                });

                setAudioStatus('pending_upload');
                await uploadAudioEvidence(audioBlob, durationSec);
            };

            recorder.start(1000);

            setIsRecordingAudio(true);
            setAudioStatus('recording');
            setAudioError('');
            setAudioSeconds(0);

            const nextTeacherCivicStageLock =
                teacherCivicStageLock ||
                resolveTeacherCivicStageLock(meta, missionState) ||
                'seat';

            await updateJourneyMeta({
                civic_parallel_teacher_audio_status: 'recording',
                civic_parallel_teacher_audio_started_at: new Date().toISOString(),
                civic_parallel_teacher_audio_error: null,
                civic_parallel_teacher_stage_lock: nextTeacherCivicStageLock
            });

            timerIntervalRef.current = setInterval(() => {
                setAudioSeconds((value) => value + 1);
            }, 1000);
        } catch (error) {
            console.error('Error iniciando grabación de audio:', error);
            alert('No se pudo iniciar la grabación de audio.');
        }
    };

    const stopAudioRecording = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        setIsRecordingAudio(false);
        mediaRecorderRef.current.stop();
    };

    const handleRetryAudioUpload = async () => {
        if (isUploadingAudio) return;

        let blob = pendingAudioBlob;
        if (!blob && draftKey) {
            blob = await loadMediaDraft(draftKey);
            if (blob) setPendingAudioBlob(blob);
        }

        if (!blob) {
            setAudioError('No hay copia local para reintentar.');
            return;
        }

        const durationSec = Number(meta.civic_parallel_teacher_audio_duration_sec) || audioSeconds || 60;
        await uploadAudioEvidence(blob, durationSec);
    };

    const handleSaveAudioCopy = async () => {
        let blob = pendingAudioBlob;

        if (!blob && draftKey) {
            blob = await loadMediaDraft(draftKey);
            if (blob) setPendingAudioBlob(blob);
        }

        if (!blob) {
            setAudioError('No hay una copia local para guardar.');
            return;
        }

        downloadMediaBlob(blob, `acto-civico-audio-${journeyId || 'draft'}.webm`);
    };

    const handleStartCivic = async () => {
        if (isStarting || civicStarted) return;

        setIsStarting(true);
        try {
            const now = new Date().toISOString();
            await updateJourneyMeta({
                civic_parallel_status: 'in_progress',
                civic_parallel_started_at: meta.civic_parallel_started_at || now,
                civic_parallel_started_by: meta.civic_parallel_started_by || userId,
                civic_parallel_teacher_ack_at: now,
                civic_parallel_aux_status: meta.civic_parallel_aux_status || 'pending_recording',
                civic_parallel_teacher_done_at: null,
                civic_parallel_teacher_done_by: null,
                civic_parallel_teacher_done_by_name: null
            });

            setStartFeedback('Listo. Osvaldo ya puede grabar evidencia.');
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error iniciando acto cívico paralelo:', error);
            alert('No se pudo iniciar el acto cívico. Intenta de nuevo.');
        } finally {
            setIsStarting(false);
        }
    };

    const handleBackToTask = async () => {
        try {
            const now = new Date().toISOString();
            await updateJourneyMeta({
                civic_parallel_teacher_skipped: true,
                civic_parallel_teacher_skipped_at: now,
                civic_parallel_teacher_skipped_by: userId,
                civic_parallel_teacher_skipped_by_name: profile?.full_name || firstName,
                civic_parallel_teacher_done_at: meta.civic_parallel_teacher_done_at || now,
                civic_parallel_teacher_done_by: meta.civic_parallel_teacher_done_by || userId,
                civic_parallel_teacher_done_by_name: meta.civic_parallel_teacher_done_by_name || profile?.full_name || firstName,
                civic_parallel_teacher_stage_lock: null
            });
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error marcando cierre de acto civico para docente:', error);
        } finally {
            onBackToTask && onBackToTask();
        }
    };

    const showAudioRetryActions = ['pending_upload', 'failed'].includes(audioStatus);
    const canStartAudioRecording =
        !isRecordingAudio &&
        audioStatus !== 'uploading' &&
        (!pendingAudioBlob || ['idle', 'uploaded'].includes(audioStatus));

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)',
            color: 'white',
            minHeight: '100vh',
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
                chipOverride="Acto cívico"
                hideTeacherCivicFab={true}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 18,
                padding: '20px 22px 28px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em' }}>
                        Tu momento ✨
                    </h1>
                    <p style={{ margin: 0, fontSize: 16, opacity: 0.94, lineHeight: 1.45 }}>
                        Estás por abrir la misión con el acto cívico.
                    </p>
                    <p style={{ marginTop: 6, fontSize: 16, opacity: 0.94, lineHeight: 1.45 }}>
                        Breve, con energía y con intención.
                    </p>
                    <p style={{ marginTop: 14, fontSize: 14, opacity: 0.88, fontWeight: 600 }}>
                        Hoy vamos a volar a muchos niños. Tú marcas el inicio.
                    </p>
                </div>

                {!civicStarted ? (
                    <div>
                        <button
                            onClick={handleStartCivic}
                            disabled={isStarting}
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: 16,
                                border: 'none',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                fontSize: 18,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10
                            }}
                        >
                            {isStarting ? <Loader2 className="animate-spin" size={18} /> : null}
                            Ya inicié el acto cívico
                        </button>

                        {startFeedback && (
                            <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
                                {startFeedback}
                            </p>
                        )}

                        <button
                            onClick={handleBackToTask}
                            style={{
                                marginTop: 10,
                                width: '100%',
                                padding: '12px',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.35)',
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 700
                            }}
                        >
                            Volver a mi tarea
                        </button>
                    </div>
                ) : (
                    <div style={{
                        borderRadius: 18,
                        padding: 16,
                        backgroundColor: 'rgba(255,255,255,0.14)',
                        border: '1px solid rgba(255,255,255,0.22)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <CheckCircle2 size={18} />
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                                Evidencia en proceso…
                            </p>
                        </div>
                        <p style={{ margin: 0, fontSize: 14, opacity: 0.92 }}>
                            Osvaldo está grabando.
                        </p>

                        <button
                            onClick={handleBackToTask}
                            style={{
                                marginTop: 12,
                                width: '100%',
                                padding: '12px',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.35)',
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 700
                            }}
                        >
                            Volver a mi tarea
                        </button>
                    </div>
                )}

                <section style={{
                    borderRadius: 20,
                    padding: 16,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <Mic size={18} />
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Audio del acto (opcional)</h3>
                    </div>

                    <p style={{ margin: 0, fontSize: 13, opacity: 0.9, lineHeight: 1.45, marginBottom: 12 }}>
                        Graba 1-2 minutos. Queremos escuchar tu voz y energía.
                    </p>

                    {canStartAudioRecording && (
                        <button
                            onClick={startAudioRecording}
                            disabled={isUploadingAudio}
                            style={{
                                width: '100%',
                                padding: '13px',
                                borderRadius: 12,
                                border: 'none',
                                backgroundColor: 'white',
                                color: '#007AFF',
                                fontWeight: 800,
                                fontSize: 15
                            }}
                        >
                            Grabar audio
                        </button>
                    )}

                    {isRecordingAudio && (
                        <div style={{ marginTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Radio size={16} />
                                    <span style={{ fontSize: 14, fontWeight: 800 }}>Grabando…</span>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 800 }}>{formatDuration(audioSeconds)}</span>
                            </div>

                            <button
                                onClick={stopAudioRecording}
                                style={{
                                    width: '100%',
                                    padding: '13px',
                                    borderRadius: 12,
                                    border: 'none',
                                    backgroundColor: '#0f172a',
                                    color: 'white',
                                    fontWeight: 800,
                                    fontSize: 15
                                }}
                            >
                                Detener y enviar
                            </button>
                        </div>
                    )}

                    {audioStatus === 'uploading' && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Loader2 size={16} className="animate-spin" />
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Subiendo evidencia…</p>
                        </div>
                    )}

                    {audioStatus === 'uploaded' && (
                        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, fontWeight: 800 }}>
                            Evidencia enviada ✅
                        </p>
                    )}

                    {showAudioRetryActions && (
                        <div style={{ marginTop: 10 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>No se pudo subir.</p>
                            <p style={{ margin: '6px 0 10px', fontSize: 12, opacity: 0.88 }}>
                                No pasa nada. Quedó guardado para reintentar.
                            </p>

                            {audioError && (
                                <p style={{ margin: '0 0 10px', fontSize: 11, opacity: 0.75 }}>{audioError}</p>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button
                                    onClick={handleRetryAudioUpload}
                                    disabled={isUploadingAudio}
                                    style={{
                                        padding: '11px',
                                        borderRadius: 10,
                                        border: 'none',
                                        backgroundColor: 'white',
                                        color: '#007AFF',
                                        fontWeight: 800,
                                        fontSize: 13
                                    }}
                                >
                                    Reintentar
                                </button>

                                <button
                                    onClick={handleSaveAudioCopy}
                                    style={{
                                        padding: '11px',
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.35)',
                                        backgroundColor: 'rgba(255,255,255,0.12)',
                                        color: 'white',
                                        fontWeight: 800,
                                        fontSize: 13
                                    }}
                                >
                                    Guardar copia
                                </button>
                            </div>

                            <button
                                onClick={handleBackToTask}
                                style={{
                                    marginTop: 8,
                                    width: '100%',
                                    padding: '11px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    backgroundColor: 'transparent',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: 13
                                }}
                            >
                                Volver a mi tarea
                            </button>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
