'use client';

// =====================================================
// useSharedMicrophone.js — Single Shared MediaStream
// =====================================================
// This hook manages ONE getUserMedia call that is shared
// between all audio consumers (Vosk, pilot recorder, etc.).
//
// KEY DESIGN DECISIONS:
//   1. External mic preference (USB, lavalier, airpods)
//   2. Constraints optimized for speech recognition
//      (echoCancellation OFF to preserve raw audio for Vosk)
//   3. Stream lifecycle controlled here, never by consumers
//   4. Consumers connect/disconnect freely; stream lives on
//
// Architecture:
//   getUserMedia() → MediaStream (ONE)
//      ├── Vosk AudioContext pipeline (via useVoiceCopilot)
//      └── MediaRecorder (via useAudioRecorder)
// =====================================================

import { useState, useRef, useCallback, useEffect } from 'react';

// Priority keywords for external/USB/lavalier microphones
const EXTERNAL_KEYWORDS = [
    'usb', 'wired', 'external', 'lavalier', 'lapel',
    'solapa', 'headset', 'airpod'
];

function isExternalMic(label) {
    const lower = (label || '').toLowerCase();
    return EXTERNAL_KEYWORDS.some(kw => lower.includes(kw));
}

export default function useSharedMicrophone() {
    const [isActive, setIsActive] = useState(false);
    const [activeMicLabel, setActiveMicLabel] = useState(null);
    const [permissionState, setPermissionState] = useState(null);

    const streamRef = useRef(null);
    const consumerCountRef = useRef(0);

    // ── Check permission state on mount ──
    useEffect(() => {
        if (typeof window === 'undefined') return;
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
    }, []);

    // ── Cleanup on unmount ──
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                try {
                    streamRef.current.getTracks().forEach(t => t.stop());
                } catch (_e) { /* best-effort */ }
                streamRef.current = null;
            }
        };
    }, []);

    // ═══════════════════════════════════════════════════
    // startMicrophone() — Opens ONE stream with external
    // mic preference. Idempotent: if already active, returns
    // the existing stream.
    // ═══════════════════════════════════════════════════
    const startMicrophone = useCallback(async () => {
        // If already active, return existing stream
        if (streamRef.current) {
            const tracks = streamRef.current.getAudioTracks();
            if (tracks.length > 0 && tracks[0].readyState === 'live') {
                console.log('[SharedMic] Stream already active, reusing');
                return streamRef.current;
            }
            // Stream is dead, clean up and re-acquire
            streamRef.current = null;
        }

        console.log('[SharedMic] Acquiring microphone...');

        // ─── Step 1: Temporary permission request so Chrome exposes real labels ───
        let tempStream;
        try {
            tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (permErr) {
            console.error('[SharedMic] Mic permission denied:', permErr);
            setPermissionState('denied');
            throw permErr;
        }

        setPermissionState('granted');

        // ─── Step 2: Enumerate devices and find the best mic ───
        let selectedDeviceId = null;
        let selectedLabel = 'Micrófono interno';
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            console.log('[SharedMic] Detected microphones:', audioInputs.map(d => `${d.label} [${d.deviceId.slice(0, 8)}]`));

            // Prefer external mic, fall back to first available
            const externalMic = audioInputs.find(d => isExternalMic(d.label));
            if (externalMic) {
                selectedDeviceId = externalMic.deviceId;
                selectedLabel = externalMic.label || 'Micrófono externo';
                console.log('[SharedMic] ✅ External mic detected:', selectedLabel);
            } else if (audioInputs.length > 0) {
                const fallback = audioInputs[0];
                selectedDeviceId = fallback.deviceId;
                selectedLabel = fallback.label || 'Micrófono interno';
                console.log('[SharedMic] ⚠️ No external mic, using:', selectedLabel);
            }
        } catch (enumErr) {
            console.warn('[SharedMic] enumerateDevices failed, using default:', enumErr);
        }

        // ─── Step 3: Close temp stream and open the real one with exact deviceId ───
        tempStream.getTracks().forEach(t => t.stop());

        // Constraints optimized for Vosk (raw audio, no browser processing)
        // The pilot recorder will use this same raw stream through MediaRecorder.
        // MediaRecorder applies its own codec (opus@16kbps) so raw input is fine.
        const constraints = {
            audio: {
                ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
                echoCancellation: false,
                noiseSuppression: true,
                autoGainControl: false
            },
            video: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // ─── Step 4: Confirm active device and update UI ───
        const activeTrack = stream.getAudioTracks()[0];
        const finalLabel = activeTrack?.label || selectedLabel;
        setActiveMicLabel(finalLabel);
        setIsActive(true);
        console.log('[SharedMic] 🎤 Active microphone:', finalLabel);

        // ─── Step 5: Listen for track ending (e.g. user unplugs mic) ───
        if (activeTrack) {
            activeTrack.onended = () => {
                console.warn('[SharedMic] ⚠️ Mic track ended (device unplugged?)');
                setIsActive(false);
                streamRef.current = null;
            };
        }

        return stream;
    }, []);

    // ═══════════════════════════════════════════════════
    // stopMicrophone() — Stops the shared stream entirely.
    // Only call when ALL consumers are done (e.g. closing
    // the operation screen).
    // ═══════════════════════════════════════════════════
    const stopMicrophone = useCallback(() => {
        if (!streamRef.current) return;
        console.log('[SharedMic] Stopping shared microphone');
        try {
            streamRef.current.getTracks().forEach(track => track.stop());
        } catch (_e) { /* best-effort */ }
        streamRef.current = null;
        setIsActive(false);
        setActiveMicLabel(null);
    }, []);

    // ═══════════════════════════════════════════════════
    // getStream() — Synchronous access for consumers
    // that need to check if the stream is live.
    // ═══════════════════════════════════════════════════
    const getStream = useCallback(() => {
        return streamRef.current;
    }, []);

    return {
        streamRef,
        isActive,
        activeMicLabel,
        permissionState,
        startMicrophone,
        stopMicrophone,
        getStream
    };
}
