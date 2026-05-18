'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// normalizeCommand — Extracts significant keywords from a POI title.
// Strips accents, short articles, returns a lowercase slug.
// ═══════════════════════════════════════════════════════════════
export function normalizeCommand(text) {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 2)
        .join(' ') || text.toLowerCase().trim().split(/\s+/)[0] || '';
}

// Normalize a full text blob for comparison (no word filtering)
function normalizeFull(text) {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .trim();
}

const BUFFER_FLUSH_MS = 8000;

export default function useVoiceCopilot({ 
    pois = [], 
    audioRef, 
    playingPoiId, 
    setPlayingPoiId, 
    onStateChange,
    isActive: controlledIsActive,
    setIsActive: controlledSetIsActive
}) {
    const [internalIsActive, setInternalIsActive] = useState(false);
    
    const isActive = controlledIsActive !== undefined ? controlledIsActive : internalIsActive;
    const setIsActive = controlledSetIsActive || setInternalIsActive;
    
    // ── Wake Word ──
    const [wakeWord, setWakeWord] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('flyhigh_voice_wake_word') || 'computadora';
        }
        return 'computadora';
    });
    
    // ── Voice engine ──
    const [voiceState, setVoiceState] = useState('off');
    const [lastTranscript, setLastTranscript] = useState('');
    const [matchedPoi, setMatchedPoi] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isDetectingVoice, setIsDetectingVoice] = useState(false);

    // ── Lifting State Up ──
    useEffect(() => {
        if (typeof onStateChange === 'function') {
            onStateChange(voiceState);
        }
    }, [voiceState, onStateChange]);

    const recognitionRef = useRef(null);
    const isListeningRef = useRef(false);
    const wakeTimeoutRef = useRef(null);
    const stateRef = useRef('off');
    const bufferRef = useRef('');          // NLP conversational buffer
    const bufferTimerRef = useRef(null);   // Auto-flush timer
    const detectTimeoutRef = useRef(null); // Voice detection timeout

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);

    // ── Browser support ──
    const [supported, setSupported] = useState(true);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) setSupported(false);
        }
    }, []);

    // ── Build command dictionary from live POIs ──
    const voiceCommands = useMemo(() => {
        return pois
            .filter(p => p.audio_url)
            .map(p => ({
                id: p.id,
                name: p.name,
                audio_url: p.audio_url,
                command: normalizeCommand(p.name),
                keywords: normalizeCommand(p.name).split(' ').filter(Boolean),
            }));
    }, [pois]);

    // ── Conversational NLP: find POI match inside a text blob ──
    const findMatchInBuffer = useCallback((blob) => {
        const norm = normalizeFull(blob);
        if (!norm || norm.length < 4) return null;

        let best = null;
        let bestScore = 0;
        for (const cmd of voiceCommands) {
            if (!cmd.keywords.length) continue;
            let score = 0;
            for (const kw of cmd.keywords) {
                if (norm.includes(kw)) score += kw.length;
            }
            if (score > bestScore) {
                bestScore = score;
                best = cmd;
            }
        }
        return bestScore >= 4 ? best : null;
    }, [voiceCommands]);

    // ── Check if wake word is present in text ──
    const hasWakeWord = useCallback((text) => {
        const norm = normalizeFull(text);
        const wakeNorm = normalizeFull(wakeWord);
        return norm.includes(wakeNorm);
    }, [wakeWord]);

    // ── Play audio for matched POI ──
    const playMatchedAudio = useCallback((poi) => {
        if (!poi?.audio_url) return;
        if (audioRef?.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        const audio = new Audio(poi.audio_url);
        if (audioRef) audioRef.current = audio;
        if (setPlayingPoiId) setPlayingPoiId(poi.id);
        setVoiceState('playing');
        audio.play().catch(() => {
            setVoiceState('idle');
            if (setPlayingPoiId) setPlayingPoiId(null);
        });
        audio.onended = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            if (isListeningRef.current) setVoiceState('idle');
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        };
        audio.onerror = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            if (isListeningRef.current) setVoiceState('idle');
        };
    }, [audioRef, setPlayingPoiId]);

    // ── Flush buffer periodically ──
    const startBufferFlush = useCallback(() => {
        if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
        bufferTimerRef.current = setInterval(() => {
            bufferRef.current = '';
        }, BUFFER_FLUSH_MS);
    }, []);

    const stopBufferFlush = useCallback(() => {
        if (bufferTimerRef.current) {
            clearInterval(bufferTimerRef.current);
            bufferTimerRef.current = null;
        }
        bufferRef.current = '';
    }, []);

    // ── Speech Recognition lifecycle ──
    const startListening = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        const recognition = new SR();
        recognition.lang = 'es-MX';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            setIsDetectingVoice(true);
            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
            detectTimeoutRef.current = setTimeout(() => setIsDetectingVoice(false), 800);

            const last = event.results[event.results.length - 1];
            const transcript = last[0].transcript.trim().toLowerCase();
            setLastTranscript(transcript);

            let currentState = stateRef.current;
            const tempBuffer = (bufferRef.current + ' ' + transcript).trim();

            if (currentState === 'idle' && hasWakeWord(tempBuffer)) {
                setVoiceState('wake');
                stateRef.current = 'wake';
                currentState = 'wake';
            }

            if (!last.isFinal) return;

            bufferRef.current = tempBuffer;
            const fullBuffer = bufferRef.current;

            if (currentState === 'idle' || currentState === 'wake') {
                const wakeDetected = hasWakeWord(fullBuffer);
                const poiMatch = findMatchInBuffer(fullBuffer);
                const isAwake = currentState === 'wake' || wakeDetected;

                if (isAwake && poiMatch) {
                    if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
                    bufferRef.current = ''; 
                    setMatchedPoi(poiMatch);
                    setVoiceState('matched');
                    stateRef.current = 'matched';
                    setTimeout(() => playMatchedAudio(poiMatch), 800);
                    return;
                }

                if (wakeDetected && !poiMatch) {
                    setVoiceState('wake');
                    stateRef.current = 'wake';
                    setLastTranscript(''); 
                    if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
                    wakeTimeoutRef.current = setTimeout(() => {
                        if (stateRef.current === 'wake') {
                            setVoiceState('idle');
                            stateRef.current = 'idle';
                            setLastTranscript('');
                            bufferRef.current = '';
                        }
                    }, 6000);
                    return;
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'not-allowed') {
                setErrorMsg('Permiso de micrófono denegado. Actívalo en la configuración de tu navegador.');
                stopListening();
                return;
            }
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            console.warn('[VoiceSim] SpeechRecognition error:', event.error);
        };

        recognition.onend = () => {
            if (isListeningRef.current) {
                try { recognition.start(); } catch (e) { /* already started */ }
            }
        };

        recognitionRef.current = recognition;
        isListeningRef.current = true;

        try {
            recognition.start();
            setVoiceState('idle');
            setErrorMsg(null);
            startBufferFlush();
        } catch (e) {
            console.error('[VoiceSim] Failed to start recognition:', e);
            if (e.name !== 'InvalidStateError') {
                setErrorMsg('No se pudo iniciar el reconocimiento de voz.');
            }
        }
    }, [wakeWord, hasWakeWord, findMatchInBuffer, playMatchedAudio, startBufferFlush]);

    const stopListening = useCallback(() => {
        isListeningRef.current = false;
        setIsDetectingVoice(false);
        stopBufferFlush();
        if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
        if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
            recognitionRef.current = null;
        }
        if (audioRef?.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (setPlayingPoiId) setPlayingPoiId(null);
        setVoiceState('off');
        setLastTranscript('');
        setMatchedPoi(null);
    }, [audioRef, setPlayingPoiId, stopBufferFlush]);

    const handleToggle = useCallback(() => {
        if (isActive) {
            stopListening();
            setIsActive(false);
        } else {
            setIsActive(true);
            startListening();
        }
    }, [isActive, startListening, stopListening]);

    useEffect(() => {
        return () => {
            isListeningRef.current = false;
            if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
            if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { /* */ }
            }
        };
    }, []);

    const saveWakeWord = (val) => {
        const finalVal = (val || '').trim() || 'computadora';
        setWakeWord(finalVal);
        localStorage.setItem('flyhigh_voice_wake_word', finalVal);
    };

    return {
        isActive,
        setIsActive, // Only used when controlled externally
        handleToggle,
        voiceState,
        lastTranscript,
        matchedPoi,
        errorMsg,
        supported,
        wakeWord,
        saveWakeWord,
        voiceCommands,
        startListening,
        stopListening,
        isDetectingVoice
    };
}
