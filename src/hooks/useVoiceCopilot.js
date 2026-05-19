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
            // Tolerancia de 1 letra (ej. "pantion" vs "panteon") o 2 letras si es muy larga
            const tolerance = normTarget.length > 7 ? 2 : 1;
            if (levenshteinDistance(tw, normTarget) <= tolerance) return true;
        }
    }
    
    return false;
}

// ═══════════════════════════════════════════════════════════════
// VAD (Voice Activity Detection) — Filtro de Energía Acústica
// Solo envía audio a Vosk cuando se detecta voz humana real.
// Reduce la carga del CPU 4-5x en dispositivos de gama baja.
// ═══════════════════════════════════════════════════════════════
const VAD_ENERGY_THRESHOLD = 0.008; // Umbral RMS mínimo para considerar que hay voz
const VAD_TRAILING_FRAMES = 3;      // Frames adicionales a enviar después de que la voz se corta

function getAudioEnergy(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
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

        const noSpaceNorm = norm.replace(/\s+/g, '');
        let best = null;
        let bestScore = 0;

        for (const cmd of voiceCommands) {
            if (!cmd.keywords.length) continue;
            let score = 0;
            
            for (const kw of cmd.keywords) {
                // 1. Coincidencia estricta
                if (norm.includes(kw)) {
                    score += kw.length;
                    continue;
                }
                
                // 2. Coincidencia sin espacios (Desfragmentación)
                if (noSpaceNorm.includes(kw)) {
                    score += kw.length;
                    continue;
                }
                
                // 3. Levenshtein difuso (solo para keywords de más de 4 letras)
                if (kw.length >= 5) {
                    const transcriptWords = norm.split(/\s+/);
                    let matched = false;
                    for (const tw of transcriptWords) {
                        const tolerance = kw.length > 7 ? 2 : 1;
                        if (levenshteinDistance(tw, kw) <= tolerance) {
                            score += kw.length - 1; // Puntuación ligeramente menor por ser fuzzy
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
        
        // Puntuación mínima requerida: 4
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
    const attentionTimeoutRef = useRef(null); // Ref para la bomba de tiempo de la ventana de atención
    const flushIntervalRef = useRef(null);    // Ref para el timer de Flush Agresivo

    useEffect(() => {
        setSupported(typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext));
        
        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                // El usuario minimizó la app o bloqueó la pantalla.
                // Apagamos el micrófono y destruimos el worker para evitar que el OS lo corrompa en segundo plano.
                if (callbacksRef.current.setIsActive) {
                    callbacksRef.current.setIsActive(false);
                }
                if (callbacksRef.current.stopListening) {
                    callbacksRef.current.stopListening();
                }
                if (voskWorkerRef.current) {
                    voskWorkerRef.current.postMessage({ action: 'destroy' });
                    voskWorkerRef.current.terminate();
                    voskWorkerRef.current = null;
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
            if (flushIntervalRef.current) {
                clearInterval(flushIntervalRef.current);
                flushIntervalRef.current = null;
            }
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
        
        // Detener el Flush Agresivo
        if (flushIntervalRef.current) {
            clearInterval(flushIntervalRef.current);
            flushIntervalRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
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

    const callbacksRef = useRef({ findMatchInBuffer, playMatchedAudio, wakeWord, stopListening, setIsActive });
    useEffect(() => {
        callbacksRef.current = { findMatchInBuffer, playMatchedAudio, wakeWord, stopListening, setIsActive };
    });

    const startListening = useCallback(async () => {
        setErrorMsg(null);
        
        try {
            // 1. Iniciar Micrófono y AudioContext (PRIMERO para conocer el Sample Rate Nativo)
            if (!audioContextRef.current) {
                // Desactivamos echoCancellation para evitar el "Modo Llamada" (HFP) y desconexión de A2DP
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: true, // Reactivado: Limpia viento y ruido ambiental por hardware
                        autoGainControl: true,  // Reactivado: Amplifica la voz automáticamente
                        channelCount: 1
                        // NO forzamos sampleRate aquí para evitar HFP, dejamos que tome la tasa nativa del dispositivo
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

                            const currentWakeWord = callbacksRef.current.wakeWord;
                            const hasWakeWord = isWakeWordDetected(transcript, currentWakeWord);
                            
                            // DEBUG: Mostrar SIEMPRE el transcript para verificar que el flush funciona.
                            // Se debería ver el texto aparecer y desaparecer cada 1.5s.
                            setLastTranscript(transcript);

                            setIsDetectingVoice(true);
                            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
                            detectTimeoutRef.current = setTimeout(() => setIsDetectingVoice(false), 800);

                            // 1. Activar Alerta Visual y Ventana de Atención
                            if (hasWakeWord && stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                                setVoiceState('wake');
                                stateRef.current = 'wake';
                                
                                // Iniciar/Reiniciar la Ventana de Atención de 10 segundos
                                if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                attentionTimeoutRef.current = setTimeout(() => {
                                    if (stateRef.current === 'wake') {
                                        setVoiceState('listening');
                                        stateRef.current = 'listening';
                                        setLastTranscript(''); // Limpiar si expiró la ventana
                                    }
                                }, 10000);
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
                                    // Si no hay match, no hacemos nada, la Ventana de 10s sigue corriendo
                                }

                                // 3. FLUSH CLEANUP: Si es un resultado final en modo 'listening'
                                // y NO contiene el wake word, desechamos el texto de la pantalla.
                                // Esto es el "descarte visual" del Flush Agresivo.
                                if (stateRef.current === 'listening' && !hasWakeWord) {
                                    setLastTranscript('');
                                }
                            }
                        } else if (type === 'error') {
                            setErrorMsg(`Error del motor de voz: ${error}`);
                            console.error('[Vosk]', error);
                            callbacksRef.current.stopListening();
                        }
                    };
                    
                    // Pedirle al worker que cargue el modelo a 16kHz, y pasarle la tasa nativa del dispositivo
                    voskWorkerRef.current.postMessage({ 
                        action: 'init', 
                        data: { 
                            modelUrl: '/vosk-models/vosk-model-small-es-0.42.zip',
                            sampleRate: 16000,
                            deviceSampleRate: audioCtx.sampleRate
                        } 
                    });
                } else {
                    // Si el worker ya estaba vivo (toggle mic off -> on), hay que resetear la línea de tiempo de Kaldi
                    voskWorkerRef.current.postMessage({ action: 'reset' });
                    setVoiceState('listening');
                    stateRef.current = 'listening';
                }

                // Aumentamos el buffer de 4096 a 8192 para darle respiro al CPU móvil (menos tirones)
                const source = audioCtx.createMediaStreamSource(stream);
                const processor = audioCtx.createScriptProcessor(8192, 1, 1);
                
                // VAD trailing counter: persiste entre callbacks para mantener el "trailing buffer"
                let vadTrailingCounter = 0;

                processor.onaudioprocess = (e) => {
                    if (stateRef.current === 'listening' || stateRef.current === 'wake') {
                        const audioData = e.inputBuffer.getChannelData(0);
                        if (voskWorkerRef.current) {
                            const energy = getAudioEnergy(audioData);

                            if (energy >= VAD_ENERGY_THRESHOLD) {
                                // Hay voz: enviar audio crudo al Worker (el Worker hace el downsampling)
                                vadTrailingCounter = VAD_TRAILING_FRAMES;
                                voskWorkerRef.current.postMessage({ action: 'process', data: audioData });
                            } else if (vadTrailingCounter > 0) {
                                // Trailing buffer: enviar frames adicionales para no cortar la última sílaba
                                vadTrailingCounter--;
                                voskWorkerRef.current.postMessage({ action: 'process', data: audioData });
                            }
                            // Si energy < umbral Y trailing agotado: NO enviamos nada. CPU descansa.
                        }
                    }
                };
                
                source.connect(processor);
                processor.connect(audioCtx.destination);
                scriptProcessorRef.current = processor;

                // ═══════════════════════════════════════════════════════════════
                // FLUSH AGRESIVO v2 — Con Guardia de Prefijo
                // 
                // Mejoras sobre v1:
                // 1. Ventana de 3s (antes 1.5s) — "computadora" (~1s) cabe completa
                // 2. Guardia de Prefijo: Si el texto actual parece que el piloto
                //    ESTÁ EN MEDIO de decir "computadora" (ej: "compu..."), NO
                //    hacemos flush. Esperamos al siguiente ciclo para no cortar
                //    la palabra a la mitad.
                // ═══════════════════════════════════════════════════════════════
                const FLUSH_INTERVAL_MS = 3000;
                // Ref para guardar el último partial result (accesible desde el interval)
                let lastPartialText = '';
                
                // Guardar cada partial result para la Guardia de Prefijo
                const originalOnMessage = voskWorkerRef.current.onmessage;
                voskWorkerRef.current.onmessage = (e) => {
                    // Capturar el último partial para la guardia
                    if (e.data.type === 'partial') {
                        const p = e.data.result?.partial || '';
                        if (p) lastPartialText = p;
                    }
                    // Delegar al handler original
                    originalOnMessage(e);
                };

                if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
                flushIntervalRef.current = setInterval(() => {
                    if (stateRef.current === 'listening' && voskWorkerRef.current) {
                        // ── GUARDIA DE PREFIJO ──
                        // Si el texto actual termina con algo que parece el inicio de "computadora",
                        // el piloto puede estar en medio de decirlo. NO hacemos flush.
                        const wakeTarget = normalizeFull(callbacksRef.current.wakeWord);
                        const currentText = normalizeFull(lastPartialText);
                        
                        if (currentText && wakeTarget.length >= 4) {
                            // Checamos si algún sufijo del texto actual es un prefijo del wake word
                            // Ej: texto="hola compu", wake="computadora" → "compu" es prefijo de "computadora" → SKIP
                            const words = currentText.split(/\s+/);
                            const lastWord = words[words.length - 1] || '';
                            
                            if (lastWord.length >= 3 && wakeTarget.startsWith(lastWord)) {
                                // El piloto parece estar diciendo el wake word, NO flush
                                return;
                            }
                        }

                        // No hay riesgo de cortar la palabra → flush seguro
                        voskWorkerRef.current.postMessage({ action: 'flush' });
                        setLastTranscript(''); // Borrar el texto de la pantalla (descarte visual)
                        lastPartialText = '';  // Resetear la guardia
                    }
                    // En 'wake', 'matched', 'playing' o 'booting': NO hacemos flush.
                    // Esto permite que Vosk acumule la frase del POI sin interrupción.
                }, FLUSH_INTERVAL_MS);
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
        
        // Mantener exports aunque no se usen
        tfjsIsLoaded: true,
        tfjsIsCalibrated: true,
        collectExample: async () => {},
        trainModel: async () => {}
    };
}
