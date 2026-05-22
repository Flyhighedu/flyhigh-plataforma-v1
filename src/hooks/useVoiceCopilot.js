'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';

// ═══════════════════════════════════════════════════════════════
// Helper utilities
// ═══════════════════════════════════════════════════════════════
const VAD_ENERGY_THRESHOLD = 0.02;
const VAD_TRAILING_FRAMES = 5;

function getAudioEnergy(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
}

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

function isWakeWordDetected(transcript, targetWakeWord) {
    const normTranscript = normalizeFull(transcript);
    const noSpaceTranscript = normTranscript.replace(/\s+/g, '');
    const normTarget = normalizeFull(targetWakeWord);
    
    if (normTarget === 'computadora') {
        const aliases = ['computadora', 'computador', 'compu', 'conputadora', 'conmutadora', 'comutadora', 'como tadora', 'con putadora', 'compu tadora', 'computura', 'con dictadora', 'computa dora'];
        for (const alias of aliases) {
            if (normTranscript.includes(alias) || noSpaceTranscript.includes(alias.replace(/\s+/g, ''))) return true;
        }
    }

    if (normTranscript.includes(normTarget)) return true;
    if (noSpaceTranscript.includes(normTarget.replace(/\s+/g, ''))) return true;

    const transcriptWords = normTranscript.split(/\s+/);
    for (const tw of transcriptWords) {
        if (tw.length >= 5 && normTarget.length >= 5) {
            const tolerance = normTarget.length > 7 ? 2 : 1;
            if (levenshteinDistance(tw, normTarget) <= tolerance) return true;
        }
    }
    
    return false;
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
            const saved = localStorage.getItem('flyhigh_voice_engine_mode');
            if (saved === 'vosk' || saved === 'tfjs-go') {
                return saved;
            }
            const ram = navigator.deviceMemory || 8;
            const cores = navigator.hardwareConcurrency || 8;
            const isLowEnd = ram <= 4 || cores <= 4;
            const defaultMode = isLowEnd ? 'tfjs-go' : 'vosk';
            localStorage.setItem('flyhigh_voice_engine_mode', defaultMode);
            return defaultMode;
        }
        return 'vosk';
    });
    
    const [voiceState, setVoiceState] = useState('off'); // off, booting, listening, wake, matched, playing
    const [lastTranscript, setLastTranscript] = useState('');
    const [dictatedText, setDictatedText] = useState('');
    const [matchedPoi, setMatchedPoi] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isDetectingVoice, setIsDetectingVoice] = useState(false);
    const [micGain, setMicGainState] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = parseFloat(localStorage.getItem('flyhigh_voice_mic_gain'));
            return isNaN(saved) ? 0.22 : saved;
        }
        return 0.22;
    });

    useEffect(() => {
        if (typeof onStateChange === 'function') {
            onStateChange(voiceState);
        }
    }, [voiceState, onStateChange]);

    const stateRef = useRef('off');
    const detectTimeoutRef = useRef(null);
    const attentionTimeoutRef = useRef(null);
    const engineModeRef = useRef(engineMode);
    const isActiveRef = useRef(isActive);

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);
    useEffect(() => { engineModeRef.current = engineMode; }, [engineMode]);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    // Hardware refs
    const mediaStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const processorNodeRef = useRef(null);
    const analyserRef = useRef(null);
    const gainNodeRef = useRef(null);
    
    // Vosk Worker
    const voskWorkerRef = useRef(null);

    // PocketSphinx Worker
    const pocketsphinxWorkerRef = useRef(null);

    // TFJS and Web Speech recognition refs
    const tfjsRecognizerRef = useRef(null);
    const tfjsListeningRef = useRef(false);
    const recognitionRef = useRef(null);
    const recognitionActiveRef = useRef(false);
    const vadTimeoutRef = useRef(null);

    // Callback refs to prevent stale closures
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

    const closeMicrophone = async () => {
        console.log('[VoiceCopilot] Cerrando y liberando micrófono local...');
        if (processorNodeRef.current) {
            try {
                // AudioWorkletNode uses port, ScriptProcessor uses onaudioprocess
                if (processorNodeRef.current.port) {
                    processorNodeRef.current.port.onmessage = null;
                    processorNodeRef.current.port.close();
                } else {
                    processorNodeRef.current.onaudioprocess = null;
                }
                processorNodeRef.current.disconnect();
            } catch(e){}
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
            try {
                if (audioContextRef.current.state !== 'closed') {
                    await audioContextRef.current.suspend();
                }
            } catch(e){}
        }
        if (mediaStreamRef.current) {
            try {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            } catch(e){}
            mediaStreamRef.current = null;
        }
        setIsDetectingVoice(false);
    };
    closeMicrophoneRef.current = closeMicrophone;

    const initMicrophone = async () => {
        if (mediaStreamRef.current) return mediaStreamRef.current;
        
        console.log('[VoiceCopilot] Inicializando micrófono...');
        const constraints = {
            audio: {
                deviceId: 'default', // Opcional: Esto ayuda a que el SO no se confunda
                echoCancellation: false,
                noiseSuppression: true,
                autoGainControl: false
            },
            video: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStreamRef.current = stream;

        let audioCtx = audioContextRef.current;
        if (!audioCtx || audioCtx.state === 'closed') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass(); 
            audioContextRef.current = audioCtx;
        }

        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        // Attenuate mic input — reduces podcast/background noise energy
        // below VAD threshold while pilot voice at 30cm stays above it.
        // Value is persisted in localStorage via MicCalibrator.
        const savedGain = parseFloat(localStorage.getItem('flyhigh_voice_mic_gain'));
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = isNaN(savedGain) ? 0.22 : savedGain;
        gainNodeRef.current = gainNode;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        source.connect(gainNode);
        gainNode.connect(analyser);

        // ═══════════════════════════════════════════════════════════════
        // Audio Processing: AudioWorkletNode (preferred) or ScriptProcessor (fallback)
        // AudioWorklet runs in a dedicated real-time thread, eliminating
        // GC pressure from AudioProcessingEvent objects on the main thread.
        // ═══════════════════════════════════════════════════════════════
        let vadTrailingCounter = 0;

        const handleAudioFrame = (inputData, peak) => {
            setIsDetectingVoice(peak > 0.015);

            const mode = engineModeRef.current;
            if (mode === 'vosk' || mode === 'pocketsphinx-js') {
                // Audio ALWAYS flows to worker — the State Machine inside
                // the worker handles suppression and wake word detection.
                // This keeps the Kaldi lattice "warm" during playback,
                // enabling instant wake word detection after narration ends.
                const worker = mode === 'vosk' ? voskWorkerRef.current : pocketsphinxWorkerRef.current;
                if (worker) {
                    const energy = getAudioEnergy(inputData);
                    const isVADActive = energy >= VAD_ENERGY_THRESHOLD;
                    if (isVADActive || vadTrailingCounter > 0) {
                        if (isVADActive) {
                            vadTrailingCounter = VAD_TRAILING_FRAMES;
                        } else {
                            vadTrailingCounter--;
                        }
                        const dataCopy = new Float32Array(inputData);
                        worker.postMessage({ action: 'process', data: dataCopy });
                    }
                }
            }
        };

        const useWorklet = typeof audioCtx.audioWorklet !== 'undefined';

        if (useWorklet) {
            try {
                await audioCtx.audioWorklet.addModule('/audio-feeder-worklet.js');
                const workletNode = new AudioWorkletNode(audioCtx, 'audio-feeder-processor');
                processorNodeRef.current = workletNode;
                analyser.connect(workletNode);
                workletNode.connect(audioCtx.destination);

                workletNode.port.onmessage = (e) => {
                    if (e.data.type === 'audio-frame') {
                        handleAudioFrame(e.data.frame, e.data.peak);
                    }
                };
                console.log('[VoiceCopilot] ✅ AudioWorkletNode activo (zero main-thread GC)');
            } catch (workletErr) {
                console.warn('[VoiceCopilot] AudioWorklet falló, usando ScriptProcessor fallback:', workletErr);
                const processor = audioCtx.createScriptProcessor(8192, 1, 1);
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
                    handleAudioFrame(inputData, maxVal);
                };
            }
        } else {
            // Fallback: ScriptProcessor for older browsers
            const processor = audioCtx.createScriptProcessor(8192, 1, 1);
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
                handleAudioFrame(inputData, maxVal);
            };
            console.log('[VoiceCopilot] ⚠️ Usando ScriptProcessor (fallback)');
        }

        return stream;
    };
    initMicrophoneRef.current = initMicrophone;

    const stopListening = useCallback(async () => {
        setIsDetectingVoice(false);
        if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
        if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
        if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);

        if (tfjsRecognizerRef.current) {
            try {
                if (tfjsRecognizerRef.current.audioDataExtractor) {
                    const stream = tfjsRecognizerRef.current.audioDataExtractor.stream;
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                }
                await tfjsRecognizerRef.current.stopListening().catch(() => {});
            } catch(e){}
            tfjsRecognizerRef.current = null;
        }
        tfjsListeningRef.current = false;

        if (recognitionRef.current) {
            try {
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            } catch(e){}
            recognitionRef.current = null;
        }
        recognitionActiveRef.current = false;

        if (voskWorkerRef.current) {
            try {
                voskWorkerRef.current.postMessage({ action: 'destroy' });
                voskWorkerRef.current.terminate();
            } catch(e){}
            voskWorkerRef.current = null;
        }

        if (pocketsphinxWorkerRef.current) {
            try {
                pocketsphinxWorkerRef.current.postMessage({ action: 'destroy' });
                pocketsphinxWorkerRef.current.terminate();
            } catch(e){}
            pocketsphinxWorkerRef.current = null;
        }

        await closeMicrophone();

        setVoiceState('off');
        stateRef.current = 'off';
        setLastTranscript('');
        setDictatedText('');
        setMatchedPoi(null);
    }, []);

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
                    if (score > 0.15) {
                        console.log('[TFJS Go] Word "go" detected on restart with score:', score);
                        
                        playFeedbackSound();
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            navigator.vibrate([120, 80, 120]);
                        }
                        
                        setVoiceState('wake');
                        stateRef.current = 'wake';
                        
                        setTimeout(() => {
                            recognizer.stopListening().catch(() => {});
                            tfjsListeningRef.current = false;
                            if (triggerSpeechRecognitionWindowRef.current) {
                                triggerSpeechRecognitionWindowRef.current();
                            }
                        }, 150);
                    }
                }, {
                    probabilityThreshold: 0.08,
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
        if (engineModeRef.current === 'tfjs-go') {
            if (initMicrophoneRef.current) {
                initMicrophoneRef.current().then(() => {
                    if (restartTfjsRef.current) {
                        restartTfjsRef.current();
                    }
                }).catch(err => {
                    console.error('[VoiceCopilot] Error al reactivar micrófono en restartNativeIfNeeded:', err);
                });
            } else {
                if (restartTfjsRef.current) {
                    restartTfjsRef.current();
                }
            }
        } else if (engineModeRef.current === 'vosk') {
            if (voskWorkerRef.current) {
                voskWorkerRef.current.postMessage({ action: 'reset' });
            }
            setVoiceState('listening');
            stateRef.current = 'listening';
        } else if (engineModeRef.current === 'pocketsphinx-js') {
            if (pocketsphinxWorkerRef.current) {
                pocketsphinxWorkerRef.current.postMessage({ action: 'reset' });
            }
            setVoiceState('listening');
            stateRef.current = 'listening';
        }
    };

    const playFeedbackSound = () => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const ctx = audioContextRef.current || new AudioContextClass();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
            
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch(e) {
            console.warn('[VoiceCopilot] No se pudo reproducir tono sintético:', e);
        }
    };

    const playMatchedAudio = useCallback((poi) => {
        if (!poi?.audio_url) {
            // No audio to play — return to listening immediately
            // Without this, stateRef stays stuck at 'matched' forever
            setVoiceState('listening');
            stateRef.current = 'listening';
            setMatchedPoi(null);
            return;
        }
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

    const triggerSpeechRecognitionWindow = useCallback(() => {
        if (recognitionActiveRef.current || stateRef.current === 'playing' || stateRef.current === 'matched') return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        console.log('[VoiceCopilot VAD] Disparando ventana de voz de 6s en modo Offline (Woke)');
        recognitionActiveRef.current = true;
        
        setDictatedText('');
        setLastTranscript('');
        setErrorMsg(null);
        
        closeMicrophone();

        setVoiceState('wake');
        stateRef.current = 'wake';

        const rec = new SpeechRecognition();
        recognitionRef.current = rec;
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'es-MX';

        let latestText = '';

        const cleanUpAndRestart = () => {
            if (!recognitionActiveRef.current) return;
            recognitionActiveRef.current = false;
            if (isActiveRef.current && stateRef.current !== 'playing' && stateRef.current !== 'matched') {
                setVoiceState('listening');
                stateRef.current = 'listening';
                
                initMicrophone().then(() => {
                    if (restartTfjsRef.current) {
                        restartTfjsRef.current();
                    }
                }).catch(err => {
                    console.error('[VoiceCopilot] Error al restablecer el micrófono local:', err);
                    setErrorMsg('Error al reactivar el micrófono local.');
                });
            }
        };

        if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);
        vadTimeoutRef.current = setTimeout(() => {
            if (recognitionActiveRef.current) {
                console.log('[VoiceCopilot VAD] Expiró la ventana de 6s.');
                try { rec.stop(); } catch(e){}
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
            console.log('[VoiceCopilot VAD] Fin de ventana de voz. Procesando texto final:', latestText);
            
            let matched = false;
            if (stateRef.current === 'wake' && latestText.trim()) {
                const poiMatch = callbacksRef.current.findMatchInBuffer(latestText);
                if (poiMatch) {
                    matched = true;
                    if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);
                    setMatchedPoi(poiMatch);
                    setVoiceState('matched');
                    stateRef.current = 'matched';
                    recognitionActiveRef.current = false;
                    
                    setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 200);
                }
            }
            
            if (!matched) {
                cleanUpAndRestart();
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
                latestText = cleanText;
                console.log('[VoiceCopilot VAD] Texto detectado:', cleanText);
                setLastTranscript(cleanText);
                setDictatedText(cleanText);

                // Extender el temporizador de inactividad mientras el usuario siga hablando (3.5s)
                if (vadTimeoutRef.current) clearTimeout(vadTimeoutRef.current);
                vadTimeoutRef.current = setTimeout(() => {
                    if (recognitionActiveRef.current) {
                        console.log('[VoiceCopilot VAD] Expiró la ventana por silencio de 3.5s.');
                        try { rec.stop(); } catch(e){}
                    }
                }, 3500);
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
    triggerSpeechRecognitionWindowRef.current = triggerSpeechRecognitionWindow;

    const callbacksRef = useRef({ findMatchInBuffer, playMatchedAudio, wakeWord, stopListening, setIsActive });
    useEffect(() => {
        callbacksRef.current = { findMatchInBuffer, playMatchedAudio, wakeWord, stopListening, setIsActive };
    });

    const startListening = useCallback(async () => {
        setErrorMsg(null);
        setVoiceState('booting');
        stateRef.current = 'booting';
        setDictatedText('');
        setLastTranscript('');

        try {
            if (initMicrophoneRef.current) {
                await initMicrophoneRef.current();
            } else {
                await initMicrophone();
            }

            const currentMode = engineModeRef.current;

            if (currentMode === 'tfjs-go') {
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
                    if (score > 0.15) {
                        console.log('[TFJS Go] Palabra "go" detectada con score:', score);
                        
                        playFeedbackSound();
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            navigator.vibrate([120, 80, 120]);
                        }
                        
                        setVoiceState('wake');
                        stateRef.current = 'wake';
                        
                        setTimeout(() => {
                            recognizer.stopListening().catch(() => {});
                            tfjsListeningRef.current = false;
                            if (triggerSpeechRecognitionWindowRef.current) {
                                triggerSpeechRecognitionWindowRef.current();
                            }
                        }, 150);
                    }
                }, {
                    probabilityThreshold: 0.08,
                    overlapFactor: 0.50,
                    invokeCallbackOnNoiseAndUnknown: true
                });
            } else if (currentMode === 'vosk') {
                // ═══ VOSK MODO LIMPIO ═══
                // Worker solo emite: 'status', 'partial', 'final', 'cycle_reset', 'error'
                // Wake word + POI matching se hacen aquí en el hilo principal.
                if (!voskWorkerRef.current) {
                    voskWorkerRef.current = new Worker(new URL('../workers/voskProcessorWorker.js', import.meta.url), { type: 'module' });
                    
                    voskWorkerRef.current.onmessage = (e) => {
                        const { type, status, result, error } = e.data;
                        
                        if (type === 'status') {
                            if (status === 'ready') {
                                setVoiceState('listening');
                                stateRef.current = 'listening';
                            }
                        } else if (type === 'cycle_reset') {
                            // Amnesia cada 10s — limpiar texto en pantalla
                            if (stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                                setLastTranscript('');
                                setDictatedText('');
                            }
                        } else if (type === 'partial' || type === 'final') {
                            const transcript = result?.partial || result?.text || '';
                            if (!transcript) return;

                            // Siempre mostrar lo que Vosk escucha (excepto en matched/playing)
                            if (stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                                setLastTranscript(transcript);
                                setDictatedText(transcript);
                            }

                            // 1) Detección de wake word: listening → wake
                            if (stateRef.current === 'listening') {
                                const currentWakeWord = callbacksRef.current.wakeWord;
                                if (isWakeWordDetected(transcript, currentWakeWord)) {
                                    setVoiceState('wake');
                                    stateRef.current = 'wake';
                                    setDictatedText('');
                                    setLastTranscript('');
                                    playFeedbackSound();
                                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);

                                    // Reset recognizer para que el POI se detecte limpio
                                    if (voskWorkerRef.current) {
                                        voskWorkerRef.current.postMessage({ action: 'reset' });
                                    }

                                    // Timeout de atención: 6s para decir el POI
                                    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                    attentionTimeoutRef.current = setTimeout(() => {
                                        if (stateRef.current === 'wake') {
                                            setVoiceState('listening');
                                            stateRef.current = 'listening';
                                            setLastTranscript('');
                                            setDictatedText('');
                                        }
                                    }, 6000);
                                }
                            }

                            // 2) POI matching: wake → matched
                            if (stateRef.current === 'wake') {
                                const poiMatch = callbacksRef.current.findMatchInBuffer(transcript);
                                if (poiMatch) {
                                    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                    setMatchedPoi(poiMatch);
                                    setVoiceState('matched');
                                    stateRef.current = 'matched';
                                    
                                    // Reset limpio del worker
                                    if (voskWorkerRef.current) {
                                        voskWorkerRef.current.postMessage({ action: 'reset' });
                                    }

                                    setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 800);
                                }
                            }
                        } else if (type === 'error') {
                            console.warn('[VoiceCopilot] Worker error (non-fatal):', error);
                            if (voskWorkerRef.current) {
                                try {
                                    voskWorkerRef.current.postMessage({ action: 'reset' });
                                } catch (e) {
                                    console.error('[VoiceCopilot] Worker irrecuperable:', e);
                                    callbacksRef.current.stopListening();
                                }
                            }
                        }
                    };

                    const audioCtx = audioContextRef.current;
                    voskWorkerRef.current.postMessage({
                        action: 'init',
                        data: {
                            modelUrl: '/vosk-models/vosk-model-small-es-0.42.zip',
                            sampleRate: 16000,
                            deviceSampleRate: audioCtx.sampleRate
                        }
                    });
                } else {
                    voskWorkerRef.current.postMessage({ action: 'reset' });
                    setVoiceState('listening');
                    stateRef.current = 'listening';
                }
            } else if (currentMode === 'pocketsphinx-js') {
                if (!pocketsphinxWorkerRef.current) {
                    pocketsphinxWorkerRef.current = new Worker('/pocketsphinx/pocketsphinxWorker.js');
                    
                    pocketsphinxWorkerRef.current.onmessage = (e) => {
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
                            setDictatedText(transcript);

                            const currentWakeWord = callbacksRef.current.wakeWord;
                            const hasWakeWord = isWakeWordDetected(transcript, currentWakeWord);

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
                                    }
                                }, 5000);
                            }

                            if (type === 'final') {
                                if (stateRef.current === 'wake') {
                                    const poiMatch = callbacksRef.current.findMatchInBuffer(transcript);
                                    if (poiMatch) {
                                        if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                        setMatchedPoi(poiMatch);
                                        setVoiceState('matched');
                                        stateRef.current = 'matched';
                                        
                                        if (pocketsphinxWorkerRef.current) {
                                            pocketsphinxWorkerRef.current.postMessage({ action: 'reset' });
                                        }

                                        setTimeout(() => callbacksRef.current.playMatchedAudio(poiMatch), 800);
                                    }
                                }
                            }
                        } else if (type === 'error') {
                            setErrorMsg(`Error del motor PocketSphinx: ${error}`);
                            console.error('[PocketSphinx]', error);
                            callbacksRef.current.stopListening();
                        }
                    };

                    const audioCtx = audioContextRef.current;
                    pocketsphinxWorkerRef.current.postMessage({
                        action: 'init',
                        data: {
                            wakeWord: callbacksRef.current.wakeWord,
                            deviceSampleRate: audioCtx.sampleRate
                        }
                    });
                } else {
                    pocketsphinxWorkerRef.current.postMessage({ action: 'reset' });
                    setVoiceState('listening');
                    stateRef.current = 'listening';
                }
            }
        } catch (err) {
            setErrorMsg(err.message || 'Permiso de micrófono denegado o no soportado.');
            console.error('[VoiceCopilot] Error iniciando micrófono:', err);
            callbacksRef.current.stopListening();
        }
    }, []);

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
    }, [isActive, startListening, stopListening, setIsActive]);

    const saveWakeWord = (val) => {
        const finalVal = (val || '').trim() || 'computadora';
        setWakeWord(finalVal);
        localStorage.setItem('flyhigh_voice_wake_word', finalVal);
    };

    const changeEngineMode = async (mode) => {
        let targetMode = mode;
        if (targetMode === 'pocketsphinx-js') {
            targetMode = 'vosk';
        }
        if (targetMode === engineModeRef.current) return;
        
        const wasActive = isActiveRef.current;
        if (wasActive) {
            await stopListening();
        }
        
        engineModeRef.current = targetMode;
        setEngineMode(targetMode);
        localStorage.setItem('flyhigh_voice_engine_mode', targetMode);
        
        if (wasActive) {
            setTimeout(() => {
                startListening();
            }, 200);
        }
    };

    const deviceInfo = (() => {
        if (typeof window === 'undefined') return { ram: 8, cores: 8, isLowEnd: false };
        const ram = navigator.deviceMemory || 8;
        const cores = navigator.hardwareConcurrency || 8;
        const isLowEnd = ram <= 4 || cores <= 4;
        return { ram, cores, isLowEnd };
    })();

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
        deviceInfo,
        micGain,
        setMicGain: useCallback((value) => {
            const clamped = Math.max(0.05, Math.min(0.50, value));
            const rounded = Math.round(clamped * 100) / 100;
            if (gainNodeRef.current) gainNodeRef.current.gain.value = rounded;
            setMicGainState(rounded);
            try { localStorage.setItem('flyhigh_voice_mic_gain', rounded.toString()); } catch(e) {}
        }, []),
        tfjsIsLoaded: true,
        tfjsIsCalibrated: true,
        collectExample: async () => {},
        trainModel: async () => {}
    };
}
