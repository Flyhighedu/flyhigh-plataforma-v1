'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';
import { useRNNoise } from './useRNNoise';

// ═══════════════════════════════════════════════════════════════
// Helper utilities
// ═══════════════════════════════════════════════════════════════
const VAD_ENERGY_THRESHOLD = 0.02;
const VAD_TRAILING_FRAMES = 5;

const ACCENT_CORRECTIONS = {
    'teleferico': 'teleférico',
    'fabrica': 'fábrica',
    'jicalan': 'jicalán',
    'michoacan': 'michoacán',
    'aguila': 'águila',
    'que': 'qué',
    'estan': 'están',
    'como': 'cómo',
    'ecologico': 'ecológico',
    'publica': 'pública'
};

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
        .filter(w => w.length > 2)
        .join(' ') || text.toLowerCase().trim().split(/\s+/)[0] || '';
}

const PHONETIC_NORMALIZATION_MAP = {
    // Variantes fonéticas/ortográficas de Jicalán
    'xicalan': 'jicalan',
    'gicalan': 'jicalan',
    'hicalan': 'jicalan',
    'yicalan': 'jicalan',
    'chicalan': 'jicalan',
    'icalan': 'jicalan'
};

function normalizeFull(text) {
    if (!text) return '';
    const clean = text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .trim();
    
    return clean
        .split(/\s+/)
        .map(w => PHONETIC_NORMALIZATION_MAP[w] || w)
        .join(' ');
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
    setIsActive: controlledSetIsActive,
    // ── Shared Microphone (Plan A) ──
    // When provided, this hook will NOT call getUserMedia itself.
    // Instead it will use the shared stream for its AudioContext pipeline.
    sharedStreamRef = null,
    sharedMicLabel = null
}) {
    const [internalIsActive, setInternalIsActive] = useState(false);
    const isActive = controlledIsActive !== undefined ? controlledIsActive : internalIsActive;
    const setIsActive = controlledSetIsActive || setInternalIsActive;

    // RNNoise: noise suppression IA (modular, isolated, safe bypass)
    const { rnnoiseStatus, connectRNNoise, disconnectRNNoise } = useRNNoise();
    
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
    const lastDetectingRef = useRef(false); // [PERF FIX] dedup to avoid re-renders
    const [internalMicLabel, setInternalMicLabel] = useState(null);
    // If using shared mic, prefer its label; otherwise use internal label
    const activeMicLabel = sharedMicLabel || internalMicLabel;
    const [micGain, setMicGainState] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = parseFloat(localStorage.getItem('flyhigh_voice_mic_gain'));
            if (isNaN(saved)) return 0.40;
            // Migrate old slider range [0.05, 0.50] to new [0.0, 1.0]
            if (saved <= 0.50) {
                return Math.max(0.0, Math.min(1.0, saved * 2.0));
            }
            return saved;
        }
        return 0.40;
    });

    const micGainRef = useRef(micGain);
    useEffect(() => {
        micGainRef.current = micGain;
    }, [micGain]);

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
    const isStreamSharedRef = useRef(false);
    
    // Vosk Worker
    const voskWorkerRef = useRef(null);
    const voskBridgeChannelRef = useRef(null); // [PERF] MessageChannel for direct AudioWorklet→Vosk Worker
    const pendingPoiRef = useRef(null);       // POI detectado esperando a que el piloto termine de hablar
    const speechEndTimerRef = useRef(null);   // Timer de 1.5s de silencio para lanzar narración

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

    // Calcular palabras clave que son únicas/exclusivas de un solo POI en todo el catálogo
    const uniqueKeywords = useMemo(() => {
        const counts = {};
        voiceCommands.forEach(cmd => {
            cmd.keywords.forEach(kw => {
                counts[kw] = (counts[kw] || 0) + 1;
            });
        });
        const uniques = new Set();
        Object.entries(counts).forEach(([kw, count]) => {
            if (count === 1) {
                uniques.add(kw);
            }
        });
        return uniques;
    }, [voiceCommands]);

    // Build the dynamic grammar list for Vosk to optimize CPU and eliminate lag
    const grammarList = useMemo(() => {
        const words = new Set();
        // 1. Unknown token for out-of-vocabulary sounds
        words.add('[unk]');
        
        // 2. Wake word variations
        const normWake = (wakeWord || '').toLowerCase().trim();
        if (normWake) {
            words.add(normWake);
            normWake.split(/\s+/).forEach(w => {
                if (w.length > 2) words.add(w);
            });
        }
        if (normWake === 'computadora') {
            ['computadora', 'computador', 'compu', 'conputadora', 'comutadora'].forEach(w => words.add(w));
        }

        const cleanTextWithAccents = (text) => {
            if (!text) return '';
            return text
                .toLowerCase()
                .replace(/[^a-zA-Z0-9\sáéíóúüñ]/g, '')
                .trim();
        };

        const getUnaccentedWord = (w) => {
            return w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };

        const getCorrectedWord = (w) => {
            const unaccented = getUnaccentedWord(w);
            return ACCENT_CORRECTIONS[unaccented] || w;
        };

        const JICALAN_PHONETIC_VARIATIONS = [
            'jicalan', 'jicalán',
            'xicalan', 'xicalán',
            'gicalan', 'gicalán',
            'hicalan', 'hicalán',
            'icalan', 'icalán',
            'chicalan', 'chicalán'
        ];

        // 3. POIs vocabulary words/phrases
        pois.forEach(poi => {
            if (!poi.name) return;
            
            const rawClean = cleanTextWithAccents(poi.name);
            if (!rawClean) return;

            const rawWords = rawClean.split(/\s+/).filter(Boolean);
            rawWords.forEach(w => {
                const unaccented = getUnaccentedWord(w);
                if (w.length > 2) {
                    words.add(w); // Con acento original
                    words.add(unaccented); // Sin acento
                    words.add(getCorrectedWord(w)); // Con acento corregido
                    
                    if (unaccented === 'jicalan') {
                        JICALAN_PHONETIC_VARIATIONS.forEach(v => words.add(v));
                    }
                }
            });

            words.add(rawClean); // Frase con acento original
            words.add(getUnaccentedWord(rawClean)); // Frase sin acento
            
            // Frase con acento corregido palabra por palabra
            const correctedPhrase = rawWords.map(getCorrectedWord).join(' ');
            words.add(correctedPhrase);

            // Inyectar combinaciones de frases fonéticas para Jicalán
            if (rawClean.includes('jicalan') || rawClean.includes('jicalán')) {
                JICALAN_PHONETIC_VARIATIONS.forEach(variant => {
                    words.add(rawClean.replace(/jicalan|jicalán/g, variant));
                    words.add(getUnaccentedWord(rawClean).replace(/jicalan|jicalán/g, variant));
                });
            }
        });

        const result = Array.from(words);
        console.log('[VoiceCopilot] 📝 Gramática generada para Vosk (palabras/frases):', result.length, result);
        return result;
    }, [pois, wakeWord]);

    const grammarListRef = useRef(grammarList);
    useEffect(() => {
        grammarListRef.current = grammarList;
        // Si el worker de Vosk está activo, actualizar su gramática de inmediato
        if (stateRef.current !== 'off' && engineModeRef.current === 'vosk' && voskWorkerRef.current) {
            console.log('[VoiceCopilot] 📝 Actualizando gramática del reconocedor en ejecución con POIs cargados.');
            voskWorkerRef.current.postMessage({
                action: 'reset',
                grammar: JSON.stringify(grammarList)
            });
        }
    }, [grammarList]);

    const findMatchInBuffer = useCallback((text) => {
        const norm = normalizeFull(text);
        if (!norm || norm.length < 3) return null;

        let transcriptWords = norm.split(/\s+/);
        // Corrección acústica de confusión: si incluye "cerro" y Vosk escuchó "fabrica",
        // es sumamente probable que sea un falso positivo de "jicalan" debido a la similitud acústica.
        if (transcriptWords.includes('cerro') && transcriptWords.includes('fabrica')) {
            transcriptWords = transcriptWords.map(w => w === 'fabrica' ? 'jicalan' : w);
        }
        let best = null;
        let bestScore = 0;

        for (const cmd of voiceCommands) {
            if (!cmd.keywords.length) continue;
            let score = 0;
            let matchedKeywordsCount = 0;
            const totalKwLength = cmd.keywords.reduce((sum, kw) => sum + kw.length, 0);
            const requiredScore = Math.min(4, totalKwLength);
            
            for (const kw of cmd.keywords) {
                let kwMatched = false;
                
                // 1. Coincidencia exacta de palabra completa (Whole-word exact match)
                if (transcriptWords.includes(kw)) {
                    score += kw.length;
                    kwMatched = true;
                } 
                // 2. Coincidencia difusa de palabra completa para términos largos (>= 5 caracteres)
                else if (kw.length >= 5) {
                    for (const tw of transcriptWords) {
                        const tolerance = kw.length > 7 ? 2 : 1;
                        if (levenshteinDistance(tw, kw) <= tolerance) {
                            score += kw.length - 1;
                            kwMatched = true;
                            break;
                        }
                    }
                }
                
                if (kwMatched) {
                    matchedKeywordsCount++;
                }
            }

            const totalKeywordsCount = cmd.keywords.length;
            // Regla de coincidencia fraccional:
            // - 1 o 2 palabras clave: requiere coincidencia del 100% (todas)
            // - 3 o más palabras clave: requiere coincidencia de al menos el 60% (redondeado hacia arriba)
            const requiredMatches = totalKeywordsCount <= 2 
                ? totalKeywordsCount 
                : Math.ceil(totalKeywordsCount * 0.6);

            // Si alguna de las palabras clave que coincidieron es única en todo el catálogo de POIs,
            // permitimos la coincidencia (match) de este comando/POI de inmediato
            const hasUniqueMatch = cmd.keywords.some(kw => uniqueKeywords.has(kw) && transcriptWords.includes(kw));

            if ((matchedKeywordsCount >= requiredMatches || hasUniqueMatch) && score > bestScore && (score >= requiredScore || hasUniqueMatch)) {
                bestScore = score;
                best = cmd;
            }
        }
        
        return best;
    }, [voiceCommands, uniqueKeywords]);

    const closeMicrophone = async () => {
        console.log('[VoiceCopilot] Disconnecting AudioContext pipeline...');
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
        // Disconnect RNNoise node before source
        disconnectRNNoise();
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
        // [PLAN A] Only stop the MediaStream if we OWN it (no shared stream was actually used).
        if (mediaStreamRef.current && !isStreamSharedRef.current) {
            try {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            } catch(e){}
            mediaStreamRef.current = null;
        } else {
            mediaStreamRef.current = null;
        }
        setIsDetectingVoice(false);
    };
    closeMicrophoneRef.current = closeMicrophone;

    const initMicrophone = async () => {
        if (mediaStreamRef.current) return mediaStreamRef.current;
        
        let stream;
        let isShared = false;

        // [PLAN A] If a shared stream is available, use it instead of calling getUserMedia.
        // The shared stream is managed by useSharedMicrophone and already has external mic preference.
        if (sharedStreamRef && sharedStreamRef.current) {
            const tracks = sharedStreamRef.current.getAudioTracks();
            if (tracks.length > 0 && tracks[0].readyState === 'live') {
                console.log('[VoiceCopilot] Using shared microphone stream');
                stream = sharedStreamRef.current;
                mediaStreamRef.current = stream;
                isShared = true;
            }
        }

        // Fallback: acquire our own stream (simulation mode, or shared not available)
        if (!stream) {
            console.log('[VoiceCopilot] Acquiring own microphone (no shared stream)...');

            // ─── Step 1: Request temporary permission so Chrome exposes real labels ───
            let tempStream;
            try {
                tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            } catch (permErr) {
                console.error('[VoiceCopilot] No se pudo obtener permiso de micrófono:', permErr);
                throw permErr;
            }

            // ─── Step 2: Enumerate devices and find the best mic ───
            let selectedDeviceId = null;
            let selectedLabel = 'Micrófono interno';
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(d => d.kind === 'audioinput');
                console.log('[VoiceCopilot] Micrófonos detectados:', audioInputs.map(d => `${d.label} [${d.deviceId.slice(0,8)}]`));

                const EXTERNAL_KEYWORDS = ['usb', 'wired', 'external', 'lavalier', 'lapel', 'solapa', 'headset', 'airpod'];
                const isExternal = (label) => {
                    const lower = label.toLowerCase();
                    return EXTERNAL_KEYWORDS.some(kw => lower.includes(kw));
                };

                const externalMic = audioInputs.find(d => isExternal(d.label));
                if (externalMic) {
                    selectedDeviceId = externalMic.deviceId;
                    selectedLabel = externalMic.label || 'Micrófono externo';
                    console.log('[VoiceCopilot] ✅ Micrófono externo detectado:', selectedLabel);
                } else if (audioInputs.length > 0) {
                    const fallback = audioInputs[0];
                    selectedDeviceId = fallback.deviceId;
                    selectedLabel = fallback.label || 'Micrófono interno';
                    console.log('[VoiceCopilot] ⚠️ Sin micrófono externo, usando:', selectedLabel);
                }
            } catch (enumErr) {
                console.warn('[VoiceCopilot] enumerateDevices falló, usando default:', enumErr);
            }

            tempStream.getTracks().forEach(t => t.stop());

            const constraints = {
                audio: {
                    ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
                    echoCancellation: false,
                    noiseSuppression: true,
                    autoGainControl: false
                },
                video: false
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;
            isShared = false;

            const activeTrack = stream.getAudioTracks()[0];
            const finalLabel = activeTrack?.label || selectedLabel;
            setInternalMicLabel(finalLabel);
            console.log('[VoiceCopilot] 🎤 Micrófono activo (propio):', finalLabel);
        }

        isStreamSharedRef.current = isShared;

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

        // ─── RNNoise: insert noise suppression (bypass-safe) ───
        // connectRNNoise always returns an AudioNode:
        //   - If RNNoise OK → returns rnnoiseNode (clean audio)
        //   - If disabled/error → returns source directly (bypass)
        const cleanSource = await connectRNNoise(audioCtx, source);

        // GainNode fixed at 1.0 — Vosk receives full raw audio.
        // Sensitivity is controlled by the VAD threshold, NOT by volume.
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;
        gainNodeRef.current = gainNode;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        // [source → rnnoiseNode?] → cleanSource → gainNode → [analyser, processorNode]
        cleanSource.connect(gainNode);
        gainNode.connect(analyser);

        // ═══════════════════════════════════════════════════════════════
        // [PERF FIX] Dual-mode audio processor:
        //
        // MODE 1 (Bridge worklet + MessagePort → Vosk):
        //   VAD + downsampling happen in the audio thread.
        //   Audio goes DIRECTLY to Vosk Worker via MessagePort.
        //   Main thread only receives lightweight VAD state changes.
        //
        // MODE 2 (Fallback for pocketsphinx/tfjs-go):
        //   Audio frames sent to main thread for processing.
        //   Same behavior as the old audio-feeder-worklet.js.
        // ═══════════════════════════════════════════════════════════════

        // handleAudioFrame is ONLY used in fallback mode (no MessagePort)
        let vadTrailingCounter = 0;
        const VAD_TRAILING_FRAMES = 8;

        const handleAudioFrame = (inputData, peak) => {
            const energy = getAudioEnergy(inputData);
            const sensitivity = micGainRef.current;
            const vadThreshold = sensitivity >= 1.0 ? 0 : (1.0 - sensitivity) * 0.04;
            const isVoiceActive = energy >= vadThreshold;

            const newDetecting = isVoiceActive || vadTrailingCounter > 0;
            if (newDetecting !== lastDetectingRef.current) {
                lastDetectingRef.current = newDetecting;
                setIsDetectingVoice(newDetecting);
            }

            const mode = engineModeRef.current;
            if (mode === 'vosk' || mode === 'pocketsphinx-js') {
                const worker = mode === 'vosk' ? voskWorkerRef.current : pocketsphinxWorkerRef.current;
                if (worker) {
                    if (isVoiceActive || vadTrailingCounter > 0) {
                        if (isVoiceActive) {
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
                // Try the optimized bridge worklet first
                await audioCtx.audioWorklet.addModule('/audio-vosk-bridge-worklet.js');
                const workletNode = new AudioWorkletNode(audioCtx, 'audio-vosk-bridge-processor');
                processorNodeRef.current = workletNode;

                gainNode.connect(workletNode);
                workletNode.connect(audioCtx.destination);

                // Send initial sensitivity to the worklet
                workletNode.port.postMessage({
                    type: 'set-sensitivity',
                    sensitivity: micGainRef.current
                });

                // Listen for messages from the bridge worklet
                workletNode.port.onmessage = (e) => {
                    if (e.data.type === 'vad-state') {
                        // Lightweight VAD state update (no audio data)
                        const newDetecting = e.data.isVoiceActive;
                        if (newDetecting !== lastDetectingRef.current) {
                            lastDetectingRef.current = newDetecting;
                            setIsDetectingVoice(newDetecting);
                        }
                    } else if (e.data.type === 'audio-frame') {
                        // Fallback path (no MessagePort connected)
                        handleAudioFrame(e.data.frame, e.data.peak);
                    }
                };

                console.log('[VoiceCopilot] ✅ Bridge worklet loaded (MessagePort will connect when Vosk starts)');
            } catch (workletErr) {
                console.warn('[VoiceCopilot] Bridge worklet failed, trying old feeder worklet:', workletErr);
                try {
                    await audioCtx.audioWorklet.addModule('/audio-feeder-worklet.js');
                    const workletNode = new AudioWorkletNode(audioCtx, 'audio-feeder-processor');
                    processorNodeRef.current = workletNode;
                    gainNode.connect(workletNode);
                    workletNode.connect(audioCtx.destination);
                    workletNode.port.onmessage = (e) => {
                        if (e.data.type === 'audio-frame') {
                            handleAudioFrame(e.data.frame, e.data.peak);
                        }
                    };
                    console.log('[VoiceCopilot] ✅ Old feeder worklet connected (fallback)');
                } catch (feederErr) {
                    console.warn('[VoiceCopilot] All worklets failed, using ScriptProcessor:', feederErr);
                    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                    processorNodeRef.current = processor;
                    gainNode.connect(processor);
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
            }
        } else {
            // Fallback: ScriptProcessor for older browsers
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorNodeRef.current = processor;
            gainNode.connect(processor);
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
        if (speechEndTimerRef.current) clearTimeout(speechEndTimerRef.current);
        pendingPoiRef.current = null;

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

        // [PERF] Clean up MessageChannel bridge
        if (voskBridgeChannelRef.current) {
            try { voskBridgeChannelRef.current.port1.close(); } catch (e) {}
            try { voskBridgeChannelRef.current.port2.close(); } catch (e) {}
            voskBridgeChannelRef.current = null;
        }

        // Disconnect bridge worklet from Vosk
        const workletNode = processorNodeRef.current;
        if (workletNode && workletNode.port) {
            try { workletNode.port.postMessage({ type: 'disconnect-vosk-port' }); } catch (e) {}
        }

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

    const cancelNarration = useCallback(() => {
        if (audioRef?.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (setPlayingPoiId) setPlayingPoiId(null);
        setVoiceState('listening');
        stateRef.current = 'listening';
        setDictatedText('');
        restartNativeIfNeeded();
        console.log('[VoiceCopilot] Narración cancelada manualmente.');
    }, [audioRef, setPlayingPoiId]);

    const triggerSpeechRecognitionWindow = useCallback(() => {
        if (recognitionActiveRef.current || stateRef.current === 'playing' || stateRef.current === 'matched') return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        console.log('[VoiceCopilot VAD] Disparando ventana de voz de 7s en modo Offline (Woke)');
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
                console.log('[VoiceCopilot VAD] Expiró la ventana de 7s.');
                try { rec.stop(); } catch(e){}
            }
        }, 7000);

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
                            const isFinal = type === 'final';
                            let transcript = '';
                            if (isFinal) {
                                // Filtrar palabras por confianza para evitar falsos positivos de palabras fuera de vocabulario
                                if (result?.result && Array.isArray(result.result)) {
                                    const highConfWords = result.result
                                        .filter(w => {
                                            const cleanWord = (w.word || '').toLowerCase().trim();
                                            const isWordInVocabulary = grammarListRef.current?.includes(cleanWord);
                                            const threshold = isWordInVocabulary ? 0.65 : 0.75;
                                            return w.conf >= threshold;
                                        })
                                        .map(w => w.word);
                                    transcript = highConfWords.join(' ');
                                    console.log('[VoiceCopilot] 📊 Transcripción filtrada por confianza dinámica (vocabulario >= 0.65, otros >= 0.75):', transcript, result.result);
                                } else {
                                    transcript = result?.text || '';
                                }
                            } else {
                                transcript = result?.partial || '';
                            }
                            if (!transcript) return;

                            // Siempre mostrar lo que Vosk escucha (excepto en matched/playing)
                            if (stateRef.current !== 'matched' && stateRef.current !== 'playing') {
                                setLastTranscript(transcript);
                                setDictatedText(transcript);
                            }

                            // 1) Detección de wake word: listening → wake (Funciona en partials y finals para respuesta rápida)
                            if (stateRef.current === 'listening') {
                                const currentWakeWord = callbacksRef.current.wakeWord;
                                if (isWakeWordDetected(transcript, currentWakeWord)) {
                                    setVoiceState('wake');
                                    stateRef.current = 'wake';
                                    setDictatedText('');
                                    setLastTranscript('');
                                    pendingPoiRef.current = null;
                                    playFeedbackSound();
                                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);

                                    // Timeout de atención: 7s para decir el POI
                                    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                    attentionTimeoutRef.current = setTimeout(() => {
                                        if (stateRef.current === 'wake' || stateRef.current === 'matched') {
                                            setVoiceState('listening');
                                            stateRef.current = 'listening';
                                            setLastTranscript('');
                                            setDictatedText('');
                                            if (voskWorkerRef.current) {
                                                voskWorkerRef.current.postMessage({ 
                                                    action: 'reset',
                                                    grammar: JSON.stringify(grammarListRef.current)
                                                });
                                            }
                                        }
                                    }, 7000);

                                    return;
                                }
                            }

                            // 2) POI matching: wake → matched (azul) y reproducción
                            //    IMPORTANTE: Solo procesamos la coincidencia de POI en eventos 'final' (cuando el piloto deja de hablar)
                            if (isFinal && stateRef.current === 'wake') {
                                const poiMatch = callbacksRef.current.findMatchInBuffer(transcript);
                                if (poiMatch) {
                                    if (attentionTimeoutRef.current) clearTimeout(attentionTimeoutRef.current);
                                    
                                    setMatchedPoi(poiMatch);
                                    setVoiceState('matched');
                                    stateRef.current = 'matched';

                                    // Reset del worker y reproducción de la narración
                                    if (voskWorkerRef.current) {
                                        voskWorkerRef.current.postMessage({ 
                                            action: 'reset',
                                            grammar: JSON.stringify(grammarListRef.current)
                                        });
                                    }
                                    
                                    // Reproducir el audio después de un micro-timeout para la animación
                                    setTimeout(() => {
                                        callbacksRef.current.playMatchedAudio(poiMatch);
                                    }, 100);
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
                            deviceSampleRate: audioCtx.sampleRate,
                            grammar: JSON.stringify(grammarListRef.current)
                        }
                    });

                    // ═══════════════════════════════════════════════════════════
                    // [PERF] Wire MessageChannel: AudioWorklet → Vosk Worker
                    // Audio frames bypass the main thread completely.
                    // ═══════════════════════════════════════════════════════════
                    const workletNode = processorNodeRef.current;
                    if (workletNode && workletNode.port) {
                        try {
                            // Clean up previous channel if any
                            if (voskBridgeChannelRef.current) {
                                try { voskBridgeChannelRef.current.port1.close(); } catch (e) {}
                                try { voskBridgeChannelRef.current.port2.close(); } catch (e) {}
                            }

                            const channel = new MessageChannel();
                            voskBridgeChannelRef.current = channel;

                            // Send port1 to the AudioWorklet (audio thread)
                            workletNode.port.postMessage(
                                { type: 'connect-vosk-port', port: channel.port1 },
                                [channel.port1]
                            );

                            // Send port2 to the Vosk Worker (worker thread)
                            voskWorkerRef.current.postMessage(
                                { action: 'connect-port', data: { port: channel.port2 } },
                                [channel.port2]
                            );

                            // Sync sensitivity to the worklet
                            workletNode.port.postMessage({
                                type: 'set-sensitivity',
                                sensitivity: micGainRef.current
                            });

                            console.log('[VoiceCopilot] 🚀 MessageChannel connected: AudioWorklet → Vosk Worker (zero main thread)');
                        } catch (channelErr) {
                            console.warn('[VoiceCopilot] MessageChannel failed, using main-thread fallback:', channelErr);
                            // Bridge worklet will fall back to sending frames to main thread
                        }
                    }
                } else {
                    voskWorkerRef.current.postMessage({ 
                        action: 'reset',
                        grammar: JSON.stringify(grammarListRef.current)
                    });
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

    // Reactively start or stop listening based on the controlled isActive prop
    useEffect(() => {
        if (isActive) {
            startListening();
        } else {
            stopListening();
        }
    }, [isActive, startListening, stopListening]);

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
        cancelNarration,
        activeMicLabel,
        rnnoiseStatus,
        micGain,
        setMicGain: useCallback((value) => {
            const clamped = Math.max(0.0, Math.min(1.0, value));
            const rounded = Math.round(clamped * 100) / 100;
            micGainRef.current = rounded;
            // GainNode stays at 1.0 — sensitivity is VAD-threshold based
            setMicGainState(rounded);
            // [PERF] Sync sensitivity to bridge worklet (VAD runs there now)
            try {
                const workletNode = processorNodeRef.current;
                if (workletNode && workletNode.port) {
                    workletNode.port.postMessage({ type: 'set-sensitivity', sensitivity: rounded });
                }
            } catch (e) { /* worklet may not support this message */ }
            try { localStorage.setItem('flyhigh_voice_mic_gain', rounded.toString()); } catch(e) {}
        }, []),
        tfjsIsLoaded: true,
        tfjsIsCalibrated: true,
        collectExample: async () => {},
        trainModel: async () => {}
    };
}
