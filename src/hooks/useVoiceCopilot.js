'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';

// ═══════════════════════════════════════════════════════════════
// normalizeCommand — Extrae palabras clave significativas.
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

// ═══════════════════════════════════════════════════════════════
// FUZZY MATCHING (Levenshtein Distance)
// ═══════════════════════════════════════════════════════════════
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + indicator // substitution
            );
        }
    }
    return matrix[a.length][b.length];
}

// ═══════════════════════════════════════════════════════════════
// WAKE WORD FUZZY DETECTION
// ═══════════════════════════════════════════════════════════════
function isWakeWordDetected(transcript, targetWakeWord) {
    const normTranscript = normalizeFull(transcript);
    const noSpaceTranscript = normTranscript.replace(/\s+/g, '');
    const normTarget = normalizeFull(targetWakeWord);
    
    // 1. Matriz de Alias para "computadora" (Fallback crítico)
    if (normTarget === 'computadora') {
        const aliases = ['computadora', 'computador', 'compu', 'conputadora', 'conmutadora', 'comutadora', 'como tadora', 'con putadora', 'compu tadora', 'computura', 'con dictadora', 'computa dora'];
        for (const alias of aliases) {
            if (normTranscript.includes(alias) || noSpaceTranscript.includes(alias.replace(/\s+/g, ''))) return true;
        }
    }

    // 2. Coincidencia estricta y sin espacios
    if (normTranscript.includes(normTarget)) return true;
    if (noSpaceTranscript.includes(normTarget.replace(/\s+/g, ''))) return true;

    // 3. Tolerancia Levenshtein en la última/única palabra si es suficientemente larga
    const transcriptWords = normTranscript.split(/\s+/);
    for (const tw of transcriptWords) {
        if (tw.length >= 5 && normTarget.length >= 5) {
            const tolerance = normTarget.length > 7 ? 2 : 1;
            if (levenshteinDistance(tw, normTarget) <= tolerance) return true;
        }
    }
    
    return false;
}

// Remuestreador (downsampler) eficiente para convertir cualquier frecuencia de entrada del hardware a 16kHz
function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
    if (inputSampleRate === outputSampleRate) {
        return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

// Conversión rápida de ArrayBuffer a Base64 para el streaming de PCM por WebSockets
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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

    const [engineMode, setEngineMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('flyhigh_voice_engine_mode') || 'gemini';
        }
        return 'gemini';
    });
    
    const [voiceState, setVoiceState] = useState('off'); // off, booting, listening, wake, matched, playing
    const [lastTranscript, setLastTranscript] = useState('');
    const [dictatedText, setDictatedText] = useState('');
    const [matchedPoi, setMatchedPoi] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isDetectingVoice, setIsDetectingVoice] = useState(false);

    useEffect(() => {
        if (typeof onStateChange === 'function') {
            onStateChange(voiceState);
        }
    }, [voiceState, onStateChange]);

    const stateRef = useRef('off');
    const detectTimeoutRef = useRef(null);
    const attentionTimeoutRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const apiKeyRef = useRef(null);
    const engineModeRef = useRef(engineMode);

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);
    useEffect(() => { engineModeRef.current = engineMode; }, [engineMode]);

    // Referencias para la arquitectura de hardware
    const mediaStreamRef = useRef(null);
    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const processorNodeRef = useRef(null);
    const analyserRef = useRef(null);
    const recognitionRef = useRef(null);
    const transcriptBufferRef = useRef('');
    
    // Estado de la SpeechRecognition activa en modo VAD
    const recognitionActiveRef = useRef(false);
    const vadTimeoutRef = useRef(null);

    // Estado y referencias para TensorFlow.js (Speech Commands)
    const tfjsRecognizerRef = useRef(null);
    const tfjsListeningRef = useRef(false);
    const restartTfjsRef = useRef(null);
    const initMicrophoneRef = useRef(null);
    const closeMicrophoneRef = useRef(null);
    const triggerSpeechRecognitionWindowRef = useRef(null);

    const [supported, setSupported] = useState(true);
    useEffect(() => {
        setSupported(typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext));
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

    const findMatchInBuffer = useCallback((text) => {
        const norm = normalizeFull(text);
        if (!norm || norm.length < 4) return null;

        const noSpaceNorm = norm.replace(/\s+/g, '');
        let best = null;
        let bestScore = 0;

        for (const cmd of voiceCommands) {
            if (!cmd.keywords.length) continue;
            let score = 0;
            
            for (const kw of cmd.keywords) {
                if (norm.includes(kw)) {
                    score += kw.length;
                    continue;
                }
                if (noSpaceNorm.includes(kw)) {
                    score += kw.length;
                    continue;
                }
                if (kw.length >= 5) {
                    const transcriptWords = norm.split(/\s+/);
                    let matched = false;
                    for (const tw of transcriptWords) {
                        const tolerance = kw.length > 7 ? 2 : 1;
                        if (levenshteinDistance(tw, kw) <= tolerance) {
                            score += kw.length - 1;
                            matched = true;
                            break;
                        }
                    }
                    if (matched) continue;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                best = cmd;
            }
        }
        
        return bestScore >= 4 ? best : null;
    }, [voiceCommands]);

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
            restartNativeIfNeeded();
        });

        audio.onended = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            setVoiceState('listening');
            stateRef.current = 'listening';
            setDictatedText('');
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            restartNativeIfNeeded();
        };
        
        audio.onerror = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            setVoiceState('listening');
            stateRef.current = 'listening';
            setDictatedText('');
            restartNativeIfNeeded();
        };
    }, [audioRef, setPlayingPoiId]);


    const stopListening = useCallback(() => {
        setIsDetectingVoice(false);
        if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
        if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);
        reconnectTimeoutRef.current = null;
        apiKeyRef.current = null;
        recognitionActiveRef.current = false;
        
        // Detener TensorFlow.js si estuviera activo
        if (tfjsRecognizerRef.current) {
            try {
                if (tfjsRecognizerRef.current.audioDataExtractor) {
                    const stream = tfjsRecognizerRef.current.audioDataExtractor.stream;
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                }
                tfjsRecognizerRef.current.stopListening();
            } catch(e){}
            tfjsRecognizerRef.current = null;
        }
        tfjsListeningRef.current = false;

        // Detener API nativa
        if (recognitionRef.current) {
            try {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            } catch(e){}
            recognitionRef.current = null;
        }

        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                try { wsRef.current.close(); } catch(e){}
            }
            wsRef.current = null;
        }

        if (closeMicrophoneRef.current) {
            closeMicrophoneRef.current();
        }

        if (audioRef?.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (setPlayingPoiId) setPlayingPoiId(null);
        
        setVoiceState('off');
        stateRef.current = 'off';
        setLastTranscript('');
        setDictatedText('');
        setMatchedPoi(null);
        transcriptBufferRef.current = '';
    }, [audioRef, setPlayingPoiId]);

    const isActiveRef = useRef(isActive);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    const callbacksRef = useRef({ findMatchInBuffer, playMatchedAudio, wakeWord, stopListening, setIsActive });
    useEffect(() => {
        callbacksRef.current = { findMatchInBuffer, playMatchedAudio, wakeWord, stopListening, setIsActive };
    });

    const connectWS = useCallback(() => {
        if (!apiKeyRef.current) return;
        if (wsRef.current) {
            try { wsRef.current.close(); } catch(e){}
            wsRef.current = null;
        }

        console.log('[VoiceCopilot WS] Inicializando conexión WebSocket...');
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKeyRef.current}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[VoiceCopilot WS] Conectado exitosamente a la Gemini Live API.');
            
            const setupMessage = {
                setup: {
                    model: "models/gemini-2.5-flash-native-audio-latest",
                    generationConfig: {
                        responseModalities: ["AUDIO"]
                    },
                    systemInstruction: {
                        parts: [
                            {
                                text: "Eres un transcriptor de audio en tiempo real ultra veloz. Escribe ÚNICAMENTE las palabras textuales que escuchas en español. No saludes, no respondas, no agregues puntuación extra ni explicaciones. Si hay silencio o ruido de fondo, no devuelvas nada."
                            }
                        ]
                    }
                }
            };
            ws.send(JSON.stringify(setupMessage));
            
            setVoiceState('listening');
            stateRef.current = 'listening';
        };

        ws.onmessage = async (event) => {
            try {
                let textData;
                if (event.data instanceof Blob) {
                    textData = await event.data.text();
                } else {
                    textData = event.data;
                }
                const response = JSON.parse(textData);

                if (response.serverContent?.modelTurn?.parts) {
                    const parts = response.serverContent.modelTurn.parts;
                    let text = '';
                    for (const part of parts) {
                        if (part.text) {
                            text += part.text;
                        }
                    }

                    const cleanText = text.trim();
                    if (cleanText) {
                        console.log('[VoiceCopilot WS] Recibido fragmento:', cleanText);

                        setLastTranscript(cleanText);
                        setDictatedText(prev => {
                            const updated = prev ? `${prev} ${cleanText}` : cleanText;
                            const words = updated.split(/\s+/);
                            if (words.length > 15) {
                                return words.slice(words.length - 15).join(' ');
                            }
                            return updated;
                        });

                        transcriptBufferRef.current = (transcriptBufferRef.current + ' ' + cleanText).trim();
                        const words = transcriptBufferRef.current.split(/\s+/);
                        if (words.length > 15) {
                            transcriptBufferRef.current = words.slice(words.length - 15).join(' ');
                        }

                        const currentBufferText = transcriptBufferRef.current;
                        console.log('[VoiceCopilot WS] Búfer deslizante actual:', currentBufferText);

                        const currentWakeWord = callbacksRef.current.wakeWord;
                        const hasWakeWord = isWakeWordDetected(currentBufferText, currentWakeWord);

                        if (hasWakeWord && stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                            if (stateRef.current !== 'wake') {
                                setVoiceState('wake');
                                stateRef.current = 'wake';
                                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
                            }

                            if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                            attentionTimeoutRef.current = setTimeout(() => {
                                if (stateRef.current === 'wake') {
                                    setVoiceState('listening');
                                    stateRef.current = 'listening';
                                    setLastTranscript('');
                                    setDictatedText('');
                                    transcriptBufferRef.current = '';
                                }
                            }, 12000);
                        }

                        if (stateRef.current === 'wake') {
                            const poiMatch = callbacksRef.current.findMatchInBuffer(currentBufferText);
                            if (poiMatch) {
                                if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                setMatchedPoi(poiMatch);
                                setVoiceState('matched');
                                stateRef.current = 'matched';
                                transcriptBufferRef.current = '';
                                setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 200);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[VoiceCopilot WS] Error procesando mensaje de WebSocket:', e);
            }
        };

        ws.onerror = (e) => {
            console.error('[VoiceCopilot WS] Error de conexión:', e);
        };

        ws.onclose = () => {
            console.log('[VoiceCopilot WS] WebSocket cerrado.');
            if (isActiveRef.current && engineModeRef.current === 'gemini') {
                console.log('[VoiceCopilot WS] Intentando reconectar automáticamente en 3s...');
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isActiveRef.current && engineModeRef.current === 'gemini') {
                        connectWS();
                    }
                }, 3000);
            }
        };
    }, []);

    // ── INICIAR ENGINE NATIVO ──
    const startNativeListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMsg('Este navegador no soporta reconocimiento nativo Web Speech API.');
            setVoiceState('listening');
            stateRef.current = 'listening';
            return;
        }

        console.log('[VoiceCopilot Native] Inicializando Web Speech API...');
        const rec = new SpeechRecognition();
        recognitionRef.current = rec;
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'es-MX';

        rec.onstart = () => {
            console.log('[VoiceCopilot Native] Escuchando activamente...');
            setVoiceState('listening');
            stateRef.current = 'listening';
        };

        rec.onerror = (e) => {
            console.error('[VoiceCopilot Native] Error:', e);
            if (e.error === 'not-allowed') {
                setErrorMsg('Acceso al micrófono bloqueado o denegado.');
            }
        };

        rec.onend = () => {
            console.log('[VoiceCopilot Native] Sesión finalizada.');
            if (isActiveRef.current && stateRef.current !== 'off' && stateRef.current !== 'playing' && engineModeRef.current === 'native') {
                try {
                    rec.start();
                } catch(err) {
                    console.warn('[VoiceCopilot Native] Re-intentando arrancar nativo tras onend:', err);
                }
            }
        };

        rec.onresult = (event) => {
            if (stateRef.current === 'playing' || stateRef.current === 'matched') return;

            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }

            const cleanText = (final || interim).trim();
            if (cleanText) {
                console.log('[VoiceCopilot Native] Transcripción nativa:', cleanText);
                setLastTranscript(cleanText);
                setDictatedText(cleanText);
                
                transcriptBufferRef.current = cleanText;

                const currentWakeWord = callbacksRef.current.wakeWord;
                const hasWakeWord = isWakeWordDetected(cleanText, currentWakeWord);

                if (hasWakeWord && stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                    if (stateRef.current !== 'wake') {
                        setVoiceState('wake');
                        stateRef.current = 'wake';
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
                    }

                    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                    attentionTimeoutRef.current = setTimeout(() => {
                        if (stateRef.current === 'wake') {
                            setVoiceState('listening');
                            stateRef.current = 'listening';
                            setLastTranscript('');
                            setDictatedText('');
                            transcriptBufferRef.current = '';
                        }
                    }, 12000);
                }

                if (stateRef.current === 'wake') {
                    const poiMatch = callbacksRef.current.findMatchInBuffer(cleanText);
                    if (poiMatch) {
                        if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                        setMatchedPoi(poiMatch);
                        setVoiceState('matched');
                        stateRef.current = 'matched';
                        transcriptBufferRef.current = '';
                        
                        // Detener Speech Recognition para evitar pitidos durante reproducción y eco
                        try {
                            rec.stop();
                        } catch(e){}

                        setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 200);
                    }
                }
            }
        };

        try {
            rec.start();
        } catch(err) {
            console.error('[VoiceCopilot Native] Error al iniciar reconocimiento nativo:', err);
        }
    }, []);

    const closeMicrophone = () => {
        console.log('[VoiceCopilot] Cerrando y liberando micrófono local...');
        if (processorNodeRef.current) {
            try { processorNodeRef.current.disconnect(); } catch(e){}
            processorNodeRef.current.onaudioprocess = null;
            processorNodeRef.current = null;
        }
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.disconnect(); } catch(e){}
            sourceNodeRef.current = null;
        }
        if (analyserRef.current) {
            try { analyserRef.current.disconnect(); } catch(e){}
            analyserRef.current = null;
        }
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch(e){}
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            try {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            } catch(e){}
            mediaStreamRef.current = null;
        }
        setIsDetectingVoice(false);
    };

    const initMicrophone = async () => {
        if (mediaStreamRef.current) return mediaStreamRef.current;
        
        console.log('[VoiceCopilot] Inicializando micrófono...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            } 
        });
        mediaStreamRef.current = stream;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass(); 
        audioContextRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        source.connect(analyser);

        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorNodeRef.current = processor;
        analyser.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            let maxVal = 0;
            for (let i = 0; i < inputData.length; i++) {
                const absVal = Math.abs(inputData[i]);
                if (absVal > maxVal) maxVal = absVal;
            }

            setIsDetectingVoice(maxVal > 0.01);

            // Si estamos en modo de ahorro VAD nativo o TFJS-Go
            if (engineModeRef.current === 'native-vad' || engineModeRef.current === 'tfjs-go') {
                if (engineModeRef.current === 'native-vad' && maxVal > 0.035 && !recognitionActiveRef.current && stateRef.current !== 'playing' && stateRef.current !== 'matched') {
                    if (triggerSpeechRecognitionWindowRef.current) {
                        triggerSpeechRecognitionWindowRef.current();
                    }
                }
                return;
            }

            if (engineModeRef.current === 'native') {
                return;
            }

            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            if (stateRef.current === 'playing' || stateRef.current === 'matched') return;

            const downsampled = downsampleBuffer(inputData, e.inputBuffer.sampleRate, 16000);
            const pcmBuffer = new Int16Array(downsampled.length);

            for (let i = 0; i < downsampled.length; i++) {
                const s = Math.max(-1, Math.min(1, downsampled[i]));
                pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            if (maxVal > 0.002) {
                const base64Data = arrayBufferToBase64(pcmBuffer.buffer);
                const mediaMessage = {
                    realtimeInput: {
                        mediaChunks: [
                            {
                                mimeType: "audio/pcm;rate=16000",
                                data: base64Data
                            }
                        ]
                    }
                };
                wsRef.current.send(JSON.stringify(mediaMessage));
            }
        };

        return stream;
    };

    initMicrophoneRef.current = initMicrophone;
    closeMicrophoneRef.current = closeMicrophone;

    // ── INICIAR ESCUCHA POR VENTANA NATIVA (VAD - AHORRO) ──
    const triggerSpeechRecognitionWindow = useCallback(() => {
        if (recognitionActiveRef.current || stateRef.current === 'playing' || stateRef.current === 'matched') return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const isOfflineMode = engineModeRef.current === 'tfjs-go';

        console.log(`[VoiceCopilot VAD] Disparando ventana de voz de 6s en modo ${isOfflineMode ? 'Offline (Woke)' : 'VAD (Listening)'}`);
        recognitionActiveRef.current = true;
        
        // Limpiar la transcripción y errores anteriores al iniciar una nueva ventana
        setDictatedText('');
        setLastTranscript('');
        setErrorMsg(null);
        
        // Cerrar micrófono local temporalmente para cederlo a la Speech API nativa (Crucial para Android)
        if (closeMicrophoneRef.current) {
            closeMicrophoneRef.current();
        }

        if (isOfflineMode) {
            setVoiceState('wake');
            stateRef.current = 'wake';
        } else {
            setVoiceState('listening');
            stateRef.current = 'listening';
        }

        const rec = new SpeechRecognition();
        recognitionRef.current = rec;
        rec.continuous = false; // Detener automáticamente cuando termine de hablar
        rec.interimResults = true;
        rec.lang = 'es-MX';

        const cleanUpAndRestart = () => {
            recognitionActiveRef.current = false;
            if (isActiveRef.current && stateRef.current !== 'playing' && stateRef.current !== 'matched') {
                setVoiceState('listening');
                stateRef.current = 'listening';
                
                // Re-inicializar micrófono local y después reiniciar TFJS
                if (initMicrophoneRef.current) {
                    initMicrophoneRef.current().then(() => {
                        if (isOfflineMode && restartTfjsRef.current) {
                            restartTfjsRef.current();
                        }
                    }).catch(err => {
                        console.error('[VoiceCopilot] Error al restablecer el micrófono local:', err);
                        setErrorMsg('Error al reactivar el micrófono local.');
                    });
                }
            }
        };

        // Temporizador de expiración de la ventana (para evitar que quede enganchada)
        if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);
        vadTimeoutRef.current = setTimeout(() => {
            if (recognitionActiveRef.current) {
                console.log('[VoiceCopilot VAD] Expiró la ventana de 6s.');
                try { rec.stop(); } catch(e){}
                cleanUpAndRestart();
            }
        }, 6000);

        rec.onerror = (e) => {
            console.error('[VoiceCopilot VAD] Error de reconocimiento:', e);
            if (e.error === 'network') {
                setErrorMsg('Error de red en Google Speech API. Se requiere internet para transcripción.');
            } else if (e.error === 'not-allowed') {
                setErrorMsg('Permiso de micrófono denegado para Google Speech API.');
            } else if (e.error === 'no-speech') {
                console.log('[VoiceCopilot VAD] No se detectó habla en la ventana.');
            } else {
                setErrorMsg(`Error de voz nativo: ${e.error}`);
            }
            cleanUpAndRestart();
        };

        rec.onend = () => {
            console.log('[VoiceCopilot VAD] Fin de ventana de voz.');
            cleanUpAndRestart();
        };

        rec.onresult = (event) => {
            if (stateRef.current === 'playing' || stateRef.current === 'matched') return;

            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }

            const cleanText = (final || interim).trim();
            if (cleanText) {
                console.log('[VoiceCopilot VAD] Texto detectado:', cleanText);
                setLastTranscript(cleanText);
                setDictatedText(cleanText);

                if (!isOfflineMode) {
                    // Comprobar wake word en modo online/ahorro
                    const currentWakeWord = callbacksRef.current.wakeWord;
                    const hasWakeWord = isWakeWordDetected(cleanText, currentWakeWord);

                    if (hasWakeWord && stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                        if (stateRef.current !== 'wake') {
                            setVoiceState('wake');
                            stateRef.current = 'wake';
                            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
                        }
                    }
                }

                if (stateRef.current === 'wake') {
                    const poiMatch = callbacksRef.current.findMatchInBuffer(cleanText);
                    if (poiMatch) {
                        if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);
                        setMatchedPoi(poiMatch);
                        setVoiceState('matched');
                        stateRef.current = 'matched';
                        recognitionActiveRef.current = false;
                        
                        try { rec.stop(); } catch(e){}
                        setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 200);
                    }
                }
            }
        };

        try {
            rec.start();
        } catch(err) {
            console.error('[VoiceCopilot VAD] Error al arrancar la Speech API:', err);
            setErrorMsg(`Error al iniciar micrófono: ${err.message || err}`);
            cleanUpAndRestart();
        }
    }, []);

    useEffect(() => {
        triggerSpeechRecognitionWindowRef.current = triggerSpeechRecognitionWindow;
    }, [triggerSpeechRecognitionWindow]);

    const restartTfjsIfNeeded = async () => {
        if (engineModeRef.current === 'tfjs-go' && tfjsRecognizerRef.current && !tfjsListeningRef.current && isActiveRef.current) {
            try {
                const recognizer = tfjsRecognizerRef.current;
                const words = recognizer.wordLabels();
                const goIndex = words.indexOf('go');
                
                tfjsListeningRef.current = true;
                setVoiceState('listening');
                stateRef.current = 'listening';
                
                await recognizer.listen(result => {
                    if (stateRef.current !== 'listening') return;
                    const score = result.scores[goIndex];
                    if (score > 0.30) {
                        console.log('[TFJS Go] Word "go" detected on restart with score:', score);
                        try { recognizer.stopListening(); } catch(e){}
                        tfjsListeningRef.current = false;
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
                        triggerSpeechRecognitionWindow();
                    }
                }, {
                    probabilityThreshold: 0.25,
                    overlapFactor: 0.50,
                    invokeCallbackOnNoiseAndUnknown: true
                });
            } catch (err) {
                console.error('[TFJS Go] Error al re-iniciar escucha:', err);
            }
        }
    };
    restartTfjsRef.current = restartTfjsIfNeeded;

    const restartNativeIfNeeded = () => {
        if (engineModeRef.current === 'native' && recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch(e) {
                console.warn('[VoiceCopilot Native] Re-intentando iniciar reconocimiento nativo:', e);
            }
        } else if (engineModeRef.current === 'native-vad') {
            recognitionActiveRef.current = false;
        } else if (engineModeRef.current === 'tfjs-go') {
            restartTfjsIfNeeded();
        }
    };

    const startListening = useCallback(async () => {
        setErrorMsg(null);
        setVoiceState('booting');
        stateRef.current = 'booting';
        transcriptBufferRef.current = '';
        setDictatedText('');

        try {
            // ── PASO CRÍTICO: Inicialización y Resumen del AudioContext (Resuelve Autoplay Policy de Chrome) ──
            if (initMicrophoneRef.current) {
                await initMicrophoneRef.current();
            }

            // Arrancar el motor seleccionado
            if (engineMode === 'native') {
                startNativeListening();
            } else if (engineMode === 'native-vad') {
                // En modo VAD, iniciamos silenciosamente en estado de escucha (monitoreando energía)
                setVoiceState('listening');
                stateRef.current = 'listening';
            } else if (engineMode === 'tfjs-go') {
                console.log('[TFJS Go] Inicializando TensorFlow.js Speech Commands...');
                try {
                    await tf.setBackend('webgl');
                    await tf.ready();
                } catch(e) {
                    console.warn('[TFJS Go] No se pudo configurar backend WebGL, usando default:', e);
                }
                
                const recognizer = speechCommands.create('BROWSER_FFT');
                await recognizer.ensureModelLoaded();
                tfjsRecognizerRef.current = recognizer;
                
                const words = recognizer.wordLabels();
                const goIndex = words.indexOf('go');
                
                tfjsListeningRef.current = true;
                setVoiceState('listening');
                stateRef.current = 'listening';
                
                await recognizer.listen(result => {
                    if (stateRef.current !== 'listening') return;
                    const score = result.scores[goIndex];
                    if (score > 0.30) {
                        console.log('[TFJS Go] Palabra "go" detectada con score:', score);
                        try { recognizer.stopListening(); } catch(e){}
                        tfjsListeningRef.current = false;
                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
                        triggerSpeechRecognitionWindow();
                    }
                }, {
                    probabilityThreshold: 0.25,
                    overlapFactor: 0.50,
                    invokeCallbackOnNoiseAndUnknown: true
                });
            } else {
                // Obtener llave API
                const tokenRes = await fetch('/api/voice-session');
                if (!tokenRes.ok) {
                    throw new Error('Error al inicializar sesión de voz. Inicie sesión de nuevo.');
                }
                const tokenData = await tokenRes.json();
                const apiKey = tokenData.apiKey;
                if (!apiKey) {
                    throw new Error('Clave API de Gemini no disponible en el servidor.');
                }
                apiKeyRef.current = apiKey;
                connectWS();
            }

        } catch (err) {
            setErrorMsg(err.message || 'Permiso de micrófono denegado o no soportado.');
            console.error('[VoiceCopilot] Error iniciando micrófono:', err);
            stopListening();
        }
    }, [stopListening, connectWS, startNativeListening, triggerSpeechRecognitionWindow, engineMode]);

    // Limpieza de visibilidad en segundo plano (importante para PWA)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                if (callbacksRef.current.setIsActive) {
                    callbacksRef.current.setIsActive(false);
                }
                if (callbacksRef.current.stopListening) {
                    callbacksRef.current.stopListening();
                }
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        
        return () => {
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
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

    const changeEngineMode = (mode) => {
        setEngineMode(mode);
        localStorage.setItem('flyhigh_voice_engine_mode', mode);
        if (isActive) {
            stopListening();
            setTimeout(() => {
                setInternalIsActive(true);
                if (controlledSetIsActive) {
                    controlledSetIsActive(true);
                }
            }, 100);
        }
    };

    // Auto-re-arranque al cambiar engineMode mientras esté activo
    useEffect(() => {
        if (isActive) {
            startListening();
        }
    }, [engineMode]);

    return {
        isActive,
        setIsActive,
        handleToggle,
        voiceState,
        lastTranscript,
        dictatedText,
        matchedPoi,
        errorMsg,
        supported,
        wakeWord: engineMode === 'tfjs-go' ? 'go' : wakeWord,
        saveWakeWord,
        voiceCommands,
        startListening,
        stopListening,
        isDetectingVoice,
        analyserRef,
        engineMode,
        changeEngineMode,
        // TFJS Compatibilities
        tfjsIsLoaded: true,
        tfjsIsCalibrated: true,
        collectExample: async () => {},
        trainModel: async () => {}
    };
}
