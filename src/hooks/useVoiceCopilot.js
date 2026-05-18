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
            const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            const hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
            if (!hasMediaDevices || !hasAudioContext) setSupported(false);
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

    // ── Web Audio API & MediaRecorder references ──
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const recorderRef = useRef(null);
    const animationFrameRef = useRef(null);
    
    const chunksRef = useRef([]);
    const speakingChunksRef = useRef([]);
    const isSpeakingRef = useRef(false);
    const silenceStartRef = useRef(null);

    const processTranscribedText = useCallback((text) => {
        if (!text) return;
        setLastTranscript(text);
        
        let currentState = stateRef.current;
        const tempBuffer = (bufferRef.current + ' ' + text).trim();
        bufferRef.current = tempBuffer;
        const fullBuffer = bufferRef.current;

        const wakeDetected = hasWakeWord(fullBuffer);
        const poiMatch = findMatchInBuffer(fullBuffer);
        
        if (wakeDetected && poiMatch) {
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
        
        // If it was waking from VAD but no wake word found, return to idle
        if (currentState === 'wake' && !wakeDetected) {
             setVoiceState('idle');
             stateRef.current = 'idle';
        }
    }, [hasWakeWord, findMatchInBuffer, playMatchedAudio]);

    const transcribeAudio = useCallback(async (blob) => {
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'audio.webm');
            
            const res = await fetch('/api/transcribe-voice', {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) throw new Error('Transcription failed');
            const data = await res.json();
            
            if (data.text && isListeningRef.current) {
                processTranscribedText(data.text.trim().toLowerCase());
            } else if (isListeningRef.current) {
                if (stateRef.current === 'wake') {
                    setVoiceState('idle');
                    stateRef.current = 'idle';
                }
            }
        } catch (err) {
            console.error('[VoiceSim] Transcribe error:', err);
            if (stateRef.current === 'wake' && isListeningRef.current) {
                setVoiceState('idle');
                stateRef.current = 'idle';
            }
        }
    }, [processTranscribedText]);

    const stopListening = useCallback(() => {
        isListeningRef.current = false;
        setIsDetectingVoice(false);
        stopBufferFlush();
        
        if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
        if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            try { recorderRef.current.stop(); } catch(e){}
        }
        recorderRef.current = null;
        
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
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

    const startListening = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioCtx;
            
            const source = audioCtx.createMediaStreamSource(stream);
            
            // Bandpass filter for human voice frequencies (approx 300Hz to 3000Hz)
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000;
            filter.Q.value = 0.5;
            
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.4;
            analyserRef.current = analyser;
            
            source.connect(filter);
            filter.connect(analyser);
            
            // Setup MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            const recorder = new MediaRecorder(stream, { mimeType });
            recorderRef.current = recorder;
            
            chunksRef.current = [];
            speakingChunksRef.current = [];
            isSpeakingRef.current = false;
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    if (isSpeakingRef.current) {
                        speakingChunksRef.current.push(e.data);
                    } else {
                        // Keep a pre-roll buffer of 1 chunk (500ms)
                        chunksRef.current = [e.data];
                    }
                }
            };
            
            recorder.start(500); // 500ms chunks
            
            isListeningRef.current = true;
            setVoiceState('idle');
            setErrorMsg(null);
            startBufferFlush();
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const vadLoop = () => {
                if (!isListeningRef.current) return;
                
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const normalizedEnergy = avg / 255;
                
                const THRESHOLD = 0.12; // VAD sensitivity
                
                if (normalizedEnergy > THRESHOLD) {
                    setIsDetectingVoice(true);
                    if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
                    detectTimeoutRef.current = setTimeout(() => setIsDetectingVoice(false), 800);

                    // Trigger WAKE state natively if not already playing/waking
                    if (!isSpeakingRef.current && stateRef.current !== 'playing') {
                        isSpeakingRef.current = true;
                        setVoiceState('wake');
                        stateRef.current = 'wake';
                        speakingChunksRef.current = [...chunksRef.current];
                    }
                    silenceStartRef.current = null;
                } else {
                    if (isSpeakingRef.current) {
                        if (!silenceStartRef.current) {
                            silenceStartRef.current = performance.now();
                        } else if (performance.now() - silenceStartRef.current > 1500) {
                            // Silence for 1.5s -> Stop speaking, flush and transcribe
                            isSpeakingRef.current = false;
                            silenceStartRef.current = null;
                            
                            if (recorderRef.current && recorderRef.current.state === 'recording') {
                                recorderRef.current.requestData();
                                
                                setTimeout(() => {
                                    if (speakingChunksRef.current.length > 0) {
                                        const blob = new Blob(speakingChunksRef.current, { type: recorderRef.current.mimeType });
                                        transcribeAudio(blob);
                                    } else if (stateRef.current === 'wake') {
                                        setVoiceState('idle');
                                        stateRef.current = 'idle';
                                    }
                                    speakingChunksRef.current = [];
                                    chunksRef.current = [];
                                }, 100);
                            }
                        }
                    }
                }
                
                animationFrameRef.current = requestAnimationFrame(vadLoop);
            };
            
            vadLoop();
            
        } catch (err) {
            console.error('[VoiceSim] Mic error:', err);
            if (err.name === 'NotAllowedError') {
                setErrorMsg('Permiso de micrófono denegado. Actívalo en tu navegador.');
            } else {
                setErrorMsg('No se pudo acceder al micrófono.');
            }
            stopListening();
        }
    }, [startBufferFlush, stopListening, transcribeAudio]);

    const handleToggle = useCallback(() => {
        if (isActive) {
            stopListening();
            setIsActive(false);
        } else {
            setIsActive(true);
            startListening();
        }
    }, [isActive, setIsActive, startListening, stopListening]);

    useEffect(() => {
        return () => {
            isListeningRef.current = false;
            if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
            if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (recorderRef.current && recorderRef.current.state !== 'inactive') {
                try { recorderRef.current.stop(); } catch(e){}
            }
            if (audioContextRef.current) {
                try { audioContextRef.current.close(); } catch(e){}
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
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
