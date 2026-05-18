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
    const [isMegaphoneActive, setIsMegaphoneActive] = useState(false); // Estado para Megáfono

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
        });

        audio.onended = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            setVoiceState('listening');
            stateRef.current = 'listening';
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        };
        
        audio.onerror = () => {
            if (setPlayingPoiId) setPlayingPoiId(null);
            setVoiceState('listening');
            stateRef.current = 'listening';
        };
    }, [audioRef, setPlayingPoiId]);

    // References moved below stopListening

    const voskWorkerRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const scriptProcessorRef = useRef(null);
    const micSourceRef = useRef(null); // Ref para conectar/desconectar el megáfono
    const attentionTimeoutRef = useRef(null); // Ref para la bomba de tiempo de la ventana de atención

    // Efecto para aplicar/quitar el megáfono cuando cambia el estado
    useEffect(() => {
        if (!micSourceRef.current || !audioContextRef.current) return;
        
        try {
            if (isMegaphoneActive) {
                micSourceRef.current.connect(audioContextRef.current.destination);
            } else {
                micSourceRef.current.disconnect(audioContextRef.current.destination);
            }
        } catch (err) {
            console.warn('Error toggling megaphone:', err);
        }
    }, [isMegaphoneActive]);

    useEffect(() => {
        setSupported(typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext));
        
        return () => {
            if (voskWorkerRef.current) {
                voskWorkerRef.current.postMessage({ action: 'destroy' });
                voskWorkerRef.current.terminate();
                voskWorkerRef.current = null;
            }
            if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try { audioContextRef.current.close(); } catch(e){}
            }
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const stopListening = useCallback(() => {
        setIsDetectingVoice(false);
        if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
        
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (micSourceRef.current) {
            micSourceRef.current.disconnect();
            micSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try { audioContextRef.current.close(); } catch(e){}
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
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

    const isActiveRef = useRef(isActive);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    const callbacksRef = useRef({ findMatchInBuffer, playMatchedAudio, wakeWord, stopListening });
    useEffect(() => {
        callbacksRef.current = { findMatchInBuffer, playMatchedAudio, wakeWord, stopListening };
    });

    const startListening = useCallback(async () => {
        setErrorMsg(null);
        
        try {
            // 1. Iniciar Micrófono y AudioContext (PRIMERO para conocer el Sample Rate Nativo)
            if (!audioContextRef.current) {
                // Desactivamos el procesamiento de voz nativo (echoCancellation, etc.) 
                // para evitar que Android active el "Modo Llamada" (HFP) y desconecte el Bluetooth A2DP de alta calidad.
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        channelCount: 1
                        // NO forzamos sampleRate: 16000 aquí, dejamos que tome la tasa nativa del dispositivo
                    } 
                });
                mediaStreamRef.current = stream;
                
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                // NO FORZAMOS SAMPLE RATE. Al omitirlo, Android usa la tasa nativa (ej. 48000),
                // lo que mantiene la conexión Bluetooth A2DP activa en lugar de cambiar a modo "llamada" (HFP 16000Hz).
                const audioCtx = new AudioContext(); 
                audioContextRef.current = audioCtx;
                
                // 2. Inicializar Worker de Vosk si no existe, pasándole el sampleRate nativo
                if (!voskWorkerRef.current) {
                    setVoiceState('booting');
                    stateRef.current = 'booting';
                    
                    voskWorkerRef.current = new Worker(new URL('../workers/voskProcessorWorker.js', import.meta.url), { type: 'module' });
                    
                    voskWorkerRef.current.onmessage = (e) => {
                        const { type, status, result, error } = e.data;
                        
                        if (type === 'status') {
                            if (status === 'ready') {
                                setVoiceState('listening');
                                stateRef.current = 'listening';
                            }
                        } else if (type === 'partial' || type === 'final') {
                            const transcript = result?.partial || result?.text || '';
                            if (!transcript) return;
                            
                            setLastTranscript(transcript);
                            setIsDetectingVoice(true);
                            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
                            detectTimeoutRef.current = setTimeout(() => setIsDetectingVoice(false), 800);

                            const currentWakeWord = callbacksRef.current.wakeWord.toLowerCase();
                            const hasWakeWord = transcript.includes(currentWakeWord) || transcript.includes('computadora');

                            // 1. Activar Alerta Visual y Ventana de Atención
                            if (hasWakeWord && stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                                setVoiceState('wake');
                                stateRef.current = 'wake';
                                
                                // Iniciar/Reiniciar la Ventana de Atención de 5 segundos
                                if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                attentionTimeoutRef.current = setTimeout(() => {
                                    if (stateRef.current === 'wake') {
                                        setVoiceState('listening');
                                        stateRef.current = 'listening';
                                        setLastTranscript(''); // Limpiar si expiró la ventana
                                    }
                                }, 5000);
                            }

                            // 2. Evaluación de Resultados Finales
                            if (type === 'final') {
                                // Si estamos en la ventana de atención ('wake'), cualquier frase final puede detonar el comando
                                if (stateRef.current === 'wake') {
                                    const poiMatch = callbacksRef.current.findMatchInBuffer(transcript);

                                    if (poiMatch) {
                                        // Comando detectado exitosamente
                                        if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current); // Cancelar bomba de tiempo
                                        setMatchedPoi(poiMatch);
                                        setVoiceState('matched'); 
                                        stateRef.current = 'matched';
                                        setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 800);
                                    }
                                    // Si no hay match, no hacemos nada, la Ventana de 5s sigue corriendo
                                }
                            }
                        } else if (type === 'error') {
                            setErrorMsg(`Error del motor de voz: ${error}`);
                            console.error('[Vosk]', error);
                            callbacksRef.current.stopListening();
                        }
                    };
                    
                    // Pedirle al worker que cargue el modelo, y procese el audio a la Tasa Nativa de Bluetooth
                    voskWorkerRef.current.postMessage({ 
                        action: 'init', 
                        data: { 
                            modelUrl: '/vosk-models/vosk-model-small-es-0.42.zip',
                            sampleRate: audioCtx.sampleRate 
                        } 
                    });
                } else {
                    // Si el worker ya estaba vivo (toggle mic off -> on), hay que resetear la línea de tiempo de Kaldi
                    voskWorkerRef.current.postMessage({ action: 'reset' });
                    setVoiceState('listening');
                    stateRef.current = 'listening';
                }

                const source = audioCtx.createMediaStreamSource(stream);
                micSourceRef.current = source; // Guardar referencia para el megáfono
                
                // Si el megáfono estaba activo antes de iniciar el micro, reconectarlo
                if (isMegaphoneActive) {
                    source.connect(audioCtx.destination);
                }

                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                
                processor.onaudioprocess = (e) => {
                    if (stateRef.current === 'listening' || stateRef.current === 'wake') {
                        const audioData = e.inputBuffer.getChannelData(0);
                        if (voskWorkerRef.current) {
                            voskWorkerRef.current.postMessage({ action: 'process', data: audioData });
                        }
                    }
                };
                
                source.connect(processor);
                processor.connect(audioCtx.destination);
                scriptProcessorRef.current = processor;
            }
        } catch (err) {
            setErrorMsg('Permiso de micrófono denegado o no soportado.');
            console.error(err);
            stopListening();
        }
    }, [stopListening]);

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
        isMegaphoneActive, // Exportar estado del megáfono
        setIsMegaphoneActive, // Exportar función para toggle
        
        // Mantener exports aunque no se usen
        tfjsIsLoaded: true,
        tfjsIsCalibrated: true,
        collectExample: async () => {},
        trainModel: async () => {}
    };
}
