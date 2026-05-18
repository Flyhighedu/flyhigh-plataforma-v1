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

function normalizeFull(text) {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .trim();
}

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
    
    const [wakeWord, setWakeWord] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('flyhigh_voice_wake_word') || 'computadora';
        }
        return 'computadora';
    });
    
    const [voiceState, setVoiceState] = useState('off'); // off, listening, matched, playing
    const [lastTranscript, setLastTranscript] = useState('');
    const [matchedPoi, setMatchedPoi] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isDetectingVoice, setIsDetectingVoice] = useState(false);

    useEffect(() => {
        if (typeof onStateChange === 'function') {
            onStateChange(voiceState);
        }
    }, [voiceState, onStateChange]);

    const recognitionRef = useRef(null);
    const stateRef = useRef('off');
    const detectTimeoutRef = useRef(null);
    const micStreamRef = useRef(null);

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);

    const [supported, setSupported] = useState(true);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) setSupported(false);
        }
    }, []);

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

    const stopListening = useCallback(() => {
        setIsDetectingVoice(false);
        if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
        
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
        }

        if (audioRef?.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (setPlayingPoiId) setPlayingPoiId(null);
        setVoiceState('off');
        stateRef.current = 'off';
        setLastTranscript('');
        setMatchedPoi(null);
    }, [audioRef, setPlayingPoiId]);

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
        stateRef.current = 'playing';

        audio.play().catch(() => {
            setVoiceState('listening');
            stateRef.current = 'listening';
            if (setPlayingPoiId) setPlayingPoiId(null);
            if (isActive && recognitionRef.current) {
                try { recognitionRef.current.start(); } catch(e){}
            }
        });

        audio.onended = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            setVoiceState('listening');
            stateRef.current = 'listening';
            if (isActive && recognitionRef.current) {
                try { recognitionRef.current.start(); } catch(e){}
            }
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        };
        
        audio.onerror = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            setVoiceState('listening');
            stateRef.current = 'listening';
            if (isActive && recognitionRef.current) {
                try { recognitionRef.current.start(); } catch(e){}
            }
        };
    }, [audioRef, setPlayingPoiId, isActive]);

    const isActiveRef = useRef(isActive);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    const callbacksRef = useRef({ findMatchInBuffer, playMatchedAudio, wakeWord, stopListening });
    useEffect(() => {
        callbacksRef.current = { findMatchInBuffer, playMatchedAudio, wakeWord, stopListening };
    });

    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        const recognition = new SR();
        recognition.lang = 'es-MX';
        // continuous=true para que no se detenga en cada frase y evite pitidos múltiples
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

            const currentWakeWord = callbacksRef.current.wakeWord.toLowerCase();

            // Activar alerta visual ÁMBAR (estado 'wake') si escucha la palabra clave en el ínterin
            if (transcript.includes(currentWakeWord) || transcript.includes('computadora')) {
                if (stateRef.current !== 'wake' && stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                    setVoiceState('wake');
                    stateRef.current = 'wake';
                }
            }

            if (!last.isFinal) return;

            // Revisar si dijo la palabra clave o algo similar
            if (transcript.includes(currentWakeWord) || transcript.includes('computadora')) {
                const poiMatch = callbacksRef.current.findMatchInBuffer(transcript);

                if (poiMatch) {
                    setMatchedPoi(poiMatch);
                    setVoiceState('matched'); // Alerta ESMERALDA
                    stateRef.current = 'matched';
                    try { recognition.abort(); } catch(e){}
                    setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 800);
                } else {
                    // Falsa alarma o comando incompleto: Regresa a escuchar silenciosamente
                    setTimeout(() => {
                        if (stateRef.current === 'wake') {
                            setVoiceState('listening');
                            stateRef.current = 'listening';
                        }
                    }, 1500);
                    setLastTranscript('');
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'not-allowed') {
                setErrorMsg('Permiso de micrófono denegado. Actívalo en la configuración.');
                callbacksRef.current.stopListening();
                return;
            }
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            console.warn('[VoiceSim] SpeechRecognition error:', event.error);
        };

        recognition.onend = () => {
            setIsDetectingVoice(false);
            // Si seguimos activos y no estamos reproduciendo audio, reiniciar (bucle continuo)
            if (isActiveRef.current && stateRef.current === 'listening') {
                setTimeout(() => {
                    try {
                        if (recognitionRef.current) recognitionRef.current.start();
                    } catch (e) {
                        console.error("Error restarting recognition loop:", e);
                    }
                }, 200); // Pequeño delay para evitar loop infinito síncrono si el mic está bloqueado
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { /* */ }
            }
        };
    }, []); // <-- Array vacío: la instancia no se recrea, evitando el abort() prematuro

    const startListening = useCallback(() => {
        setErrorMsg(null);
        setVoiceState('listening');
        stateRef.current = 'listening';

        if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch (e) { /* Ya iniciado */ }
        }
    }, []);

    const handleToggle = useCallback(() => {
        if (isActive) {
            stopListening();
            setIsActive(false);
        } else {
            setIsActive(true);
            startListening();
        }
    }, [isActive, startListening, stopListening]);

    const saveWakeWord = (val) => {
        const finalVal = (val || '').trim() || 'computadora';
        setWakeWord(finalVal);
        localStorage.setItem('flyhigh_voice_wake_word', finalVal);
    };

    return {
        isActive,
        setIsActive,
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
        isDetectingVoice,
        
        // Mantener exports aunque no se usen (por si otras UIs lo esperan)
        tfjsIsLoaded: true,
        tfjsIsCalibrated: true,
        collectExample: async () => {},
        trainModel: async () => {}
    };
}
