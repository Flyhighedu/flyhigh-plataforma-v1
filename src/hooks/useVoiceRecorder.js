'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useVoiceRecorder — WhatsApp-style press-and-hold voice recording hook.
 * Uses MediaRecorder API. Max duration: 30s. Outputs audio blob.
 */
const MAX_DURATION = 30; // seconds

const AUDIO_MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4'
];

function pickSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return null;
    }

    return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function resolveMicErrorMessage(error) {
    const name = String(error?.name || '').trim();

    if (['NotAllowedError', 'PermissionDeniedError'].includes(name)) {
        return 'Permiso de microfono denegado. Activalo e intenta de nuevo.';
    }

    if (['NotFoundError', 'DevicesNotFoundError'].includes(name)) {
        return 'No encontramos un microfono disponible en este dispositivo.';
    }

    if (['NotReadableError', 'TrackStartError'].includes(name)) {
        return 'El microfono esta ocupado por otra app o pestana.';
    }

    if (name === 'SecurityError') {
        return 'La grabacion solo funciona en conexion segura (HTTPS).';
    }

    if (name === 'AbortError') {
        return 'La grabacion se interrumpio. Intenta nuevamente.';
    }

    return 'No se pudo acceder al microfono. Verifica permisos e intenta de nuevo.';
}

export default function useVoiceRecorder() {
    const [state, setState] = useState('idle'); // idle | recording | processing | recorded
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);
    const ignoreNextStopRef = useRef(false);
    const recordingStartRef = useRef(null);
    const lastObjectUrlRef = useRef(null);

    const clearTimer = useCallback(() => {
        if (!timerRef.current) return;
        clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    const stopStream = useCallback(() => {
        if (!streamRef.current) return;
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const revokeCurrentUrl = useCallback(() => {
        if (!lastObjectUrlRef.current) return;
        URL.revokeObjectURL(lastObjectUrlRef.current);
        lastObjectUrlRef.current = null;
    }, []);

    useEffect(() => {
        lastObjectUrlRef.current = audioUrl || null;
    }, [audioUrl]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimer();
            stopStream();
            revokeCurrentUrl();
        };
    }, [clearTimer, stopStream, revokeCurrentUrl]);

    const startRecording = useCallback(async () => {
        if (state === 'recording' || state === 'processing') return;

        setError(null);
        chunksRef.current = [];
        ignoreNextStopRef.current = false;
        clearTimer();
        stopStream();

        if (audioBlob) {
            setAudioBlob(null);
        }

        if (audioUrl) {
            revokeCurrentUrl();
            setAudioUrl(null);
        }

        setDuration(0);

        const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
        const isSecureContext = typeof window === 'undefined' ? true : window.isSecureContext === true;

        if (!isSecureContext) {
            setError('La grabacion solo funciona en conexion segura (HTTPS).');
            setState('idle');
            return;
        }

        if (!hasMediaDevices || !hasMediaRecorder) {
            setError('Tu navegador no permite grabar audio aqui.');
            setState('idle');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;

            const mimeType = pickSupportedMimeType();

            let recorder;
            try {
                recorder = mimeType
                    ? new MediaRecorder(stream, { mimeType })
                    : new MediaRecorder(stream);
            } catch {
                recorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = recorder;
            recordingStartRef.current = Date.now();

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onerror = (event) => {
                console.error('Voice recorder runtime error:', event?.error || event);
                clearTimer();
                stopStream();
                setState('idle');
                setError('Error al grabar audio. Intenta nuevamente.');
            };

            recorder.onstop = () => {
                clearTimer();

                if (ignoreNextStopRef.current) {
                    ignoreNextStopRef.current = false;
                    chunksRef.current = [];
                    mediaRecorderRef.current = null;
                    stopStream();
                    return;
                }

                const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: finalMimeType });

                chunksRef.current = [];
                mediaRecorderRef.current = null;
                stopStream();

                if (!blob || blob.size <= 0) {
                    setState('idle');
                    setError('No se pudo guardar el audio. Intenta de nuevo.');
                    return;
                }

                const elapsed = recordingStartRef.current
                    ? Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000))
                    : Math.max(1, Number(duration) || 1);

                setDuration(elapsed);
                revokeCurrentUrl();

                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                setState('recorded');
                setError(null);
                recordingStartRef.current = null;
            };

            recorder.start(100);
            setState('recording');

            const startAt = recordingStartRef.current || Date.now();
            timerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startAt) / 1000);
                setDuration(elapsed);

                if (elapsed >= MAX_DURATION) {
                    clearTimer();

                    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                        setState('processing');
                        mediaRecorderRef.current.stop();
                    }
                }
            }, 250);
        } catch (err) {
            console.error('Mic permission error:', err);
            clearTimer();
            stopStream();
            setError(resolveMicErrorMessage(err));
            setState('idle');
            recordingStartRef.current = null;
        }
    }, [
        audioBlob,
        audioUrl,
        clearTimer,
        duration,
        revokeCurrentUrl,
        state,
        stopStream
    ]);

    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') return;

        clearTimer();
        setState('processing');

        try {
            recorder.stop();
        } catch (err) {
            console.error('Error stopping voice recorder:', err);
            setError('No se pudo finalizar la grabacion. Intenta nuevamente.');
            setState('idle');
            stopStream();
            mediaRecorderRef.current = null;
            recordingStartRef.current = null;
        }
    }, [clearTimer, stopStream]);

    const reset = useCallback(() => {
        clearTimer();

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            ignoreNextStopRef.current = true;
            try {
                recorder.stop();
            } catch {
                // noop
            }
        }

        mediaRecorderRef.current = null;
        stopStream();
        revokeCurrentUrl();

        setAudioBlob(null);
        setAudioUrl(null);
        setDuration(0);
        setError(null);
        setState('idle');

        chunksRef.current = [];
        recordingStartRef.current = null;
    }, [clearTimer, revokeCurrentUrl, stopStream]);

    return {
        isRecording: state === 'recording',
        isProcessing: state === 'processing',
        hasRecording: state === 'recorded',
        audioBlob,
        audioUrl,
        duration,
        error,
        startRecording,
        stopRecording,
        reset,
    };
}
