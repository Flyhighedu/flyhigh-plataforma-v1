'use client';

// =====================================================
// useAudioRecorder.js
// Custom hook for capturing microphone audio using the
// MediaRecorder API with WebM/Opus codec at ultra-low
// bitrate (16kbps).
//
// Designed for PWA field use:
// - Requests mic permission with user feedback
// - Records in chunks (crash resilience)
// - Produces a single Blob for upload
// - Handles permission denials gracefully
//
// SAFETY: Pure hook. If MediaRecorder is unavailable
// (e.g., iOS Safari < 14.5), returns isSupported=false
// and the UI hides the recording feature.
// =====================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import fixWebmDuration from 'fix-webm-duration';

const AUDIO_MIME = 'audio/webm;codecs=opus';
const TARGET_BITRATE = 16000; // 16 kbps — ~480KB per 4 minutes
const TIMESLICE_MS = 5000; // Collect data every 5s for crash resilience

/**
 * @returns {{
 *   isSupported: boolean,
 *   isRecording: boolean,
 *   isPaused: boolean,
 *   durationSeconds: number,
 *   permissionState: 'prompt'|'granted'|'denied'|null,
 *   startRecording: () => Promise<boolean>,
 *   stopRecording: () => Promise<Blob|null>,
 *   cancelRecording: () => void
 * }}
 */
export default function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [permissionState, setPermissionState] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const resolveStopRef = useRef(null);
    const durationRef = useRef(0);

    // Feature detection
    const isSupported = typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported(AUDIO_MIME);

    // Check permission state on mount
    useEffect(() => {
        if (!isSupported) return;
        try {
            navigator.permissions?.query({ name: 'microphone' })
                .then(result => {
                    setPermissionState(result.state);
                    result.onchange = () => setPermissionState(result.state);
                })
                .catch(() => setPermissionState('prompt'));
        } catch (_e) {
            setPermissionState('prompt');
        }
    }, [isSupported]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
            try {
                mediaRecorderRef.current?.stop();
                streamRef.current?.getTracks().forEach(t => t.stop());
            } catch (_e) { /* cleanup best-effort */ }
        };
    }, []);

    const startRecording = useCallback(async () => {
        if (!isSupported || isRecording) return false;

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000, // Low sample rate for voice
                    channelCount: 1    // Mono
                }
            });

            streamRef.current = stream;
            chunksRef.current = [];
            setPermissionState('granted');

            const recorder = new MediaRecorder(stream, {
                mimeType: AUDIO_MIME,
                audioBitsPerSecond: TARGET_BITRATE
            });

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: AUDIO_MIME });
                if (durationRef.current > 0) {
                    fixWebmDuration(blob, durationRef.current * 1000, (fixedBlob) => {
                        if (resolveStopRef.current) {
                            resolveStopRef.current(fixedBlob);
                            resolveStopRef.current = null;
                        }
                    });
                } else {
                    if (resolveStopRef.current) {
                        resolveStopRef.current(blob);
                        resolveStopRef.current = null;
                    }
                }
            };

            recorder.onerror = (err) => {
                console.warn('⚠️ MediaRecorder error:', err);
                setIsRecording(false);
                clearInterval(timerRef.current);
            };

            mediaRecorderRef.current = recorder;
            recorder.start(TIMESLICE_MS);

            setIsRecording(true);
            setIsPaused(false);
            setDurationSeconds(0);
            durationRef.current = 0;

            // Duration timer
            timerRef.current = setInterval(() => {
                durationRef.current += 1;
                setDurationSeconds(durationRef.current);
            }, 1000);

            return true;
        } catch (err) {
            console.warn('⚠️ Mic access denied or failed:', err);
            if (err.name === 'NotAllowedError') {
                setPermissionState('denied');
            }
            return false;
        }
    }, [isSupported, isRecording]);

    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            clearInterval(timerRef.current);

            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                // Build blob from whatever chunks we have
                if (chunksRef.current.length > 0) {
                    resolve(new Blob(chunksRef.current, { type: AUDIO_MIME }));
                } else {
                    resolve(null);
                }
                setIsRecording(false);
                return;
            }

            resolveStopRef.current = resolve;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);

            // Release microphone
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        });
    }, []);

    const cancelRecording = useCallback(() => {
        clearInterval(timerRef.current);
        chunksRef.current = [];
        resolveStopRef.current = null;

        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } catch (_e) { /* best-effort */ }

        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;

        setIsRecording(false);
        setIsPaused(false);
        setDurationSeconds(0);
    }, []);

    return {
        isSupported,
        isRecording,
        isPaused,
        durationSeconds,
        permissionState,
        startRecording,
        stopRecording,
        cancelRecording
    };
}
