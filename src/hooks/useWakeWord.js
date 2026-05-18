import { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';

/**
 * Hook para manejar el Wake Word ("Computadora") usando TensorFlow.js
 * NOTA ARQUITECTÓNICA: Aunque se solicitó Web Worker, @tensorflow-models/speech-commands 
 * usa 'BROWSER_FFT' que depende inherentemente de window.AudioContext (Main Thread).
 * Para evitar bloqueos, forzamos el backend WebGL/WASM para que el GPU procese los tensores,
 * liberando el hilo principal de la UI.
 */
export function useWakeWord({ onWakeWordDetected }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isCalibrated, setIsCalibrated] = useState(false);
    
    // El reconocedor base y el transfer recognizer
    const baseRecognizerRef = useRef(null);
    const transferRecognizerRef = useRef(null);
    const isListeningRef = useRef(false);

    // Inicializar TFJS y el modelo
    useEffect(() => {
        let mounted = true;

        async function initTF() {
            try {
                // Forzar WebGL para offloading a GPU
                await tf.setBackend('webgl');
                await tf.ready();

                // Crear reconocedor base
                const recognizer = speechCommands.create('BROWSER_FFT');
                await recognizer.ensureModelLoaded();
                
                if (!mounted) return;
                
                baseRecognizerRef.current = recognizer;
                
                // Cargar modelo guardado (Transfer Learning) si existe en IndexedDB
                // Por ahora, creamos el espacio para 'computadora'
                const transfer = recognizer.createTransfer('custom-wake-word');
                transferRecognizerRef.current = transfer;

                // Verificar si ya hay ejemplos guardados (simulado por ahora con localStorage)
                const isTrained = localStorage.getItem('tfjs_wake_calibrated') === 'true';
                
                if (isTrained) {
                    // Si ya estuviera entrenado y guardado en IndexedDB, lo cargaríamos aquí.
                    // await transfer.load('indexeddb://my-wake-word-model');
                    setIsCalibrated(true);
                } else {
                    setIsCalibrated(false);
                }

                setIsLoaded(true);
            } catch (err) {
                console.error("Error inicializando TFJS:", err);
            }
        }

        initTF();

        return () => {
            mounted = false;
            if (isListeningRef.current && transferRecognizerRef.current) {
                transferRecognizerRef.current.stopListening();
            }
        };
    }, []);

    // Función para grabar un ejemplo durante la calibración
    const collectExample = useCallback(async (label) => {
        if (!transferRecognizerRef.current) return;
        // label puede ser "computadora" o "_background_noise_"
        await transferRecognizerRef.current.collectExample(label);
        return transferRecognizerRef.current.countExamples();
    }, []);

    // Entrenar el modelo con los ejemplos recolectados
    const trainModel = useCallback(async (onProgress) => {
        if (!transferRecognizerRef.current) return;
        
        await transferRecognizerRef.current.train({
            epochs: 25,
            callback: {
                onEpochEnd: async (epoch, logs) => {
                    if (onProgress) onProgress(epoch, logs);
                }
            }
        });

        // Simular guardado en IndexedDB
        // await transferRecognizerRef.current.save('indexeddb://my-wake-word-model');
        localStorage.setItem('tfjs_wake_calibrated', 'true');
        setIsCalibrated(true);
    }, []);

    // Iniciar escucha silenciosa (Fase de Crucero)
    const startSilentListening = useCallback(async () => {
        if (!transferRecognizerRef.current || isListeningRef.current || !isCalibrated) return;

        try {
            await transferRecognizerRef.current.listen(result => {
                const words = transferRecognizerRef.current.wordLabels();
                
                // Buscar el score de la palabra "computadora"
                const wordIndex = words.indexOf('computadora');
                if (wordIndex !== -1) {
                    const score = result.scores[wordIndex];
                    if (score > 0.85) { // 85% de confianza
                        console.log("¡WAKE WORD DETECTADA!", score);
                        stopSilentListening(); // Detener inmediatamente para liberar hardware
                        
                        // Emitir evento al OperationUI para iniciar Auto-Ducking y el Handoff
                        if (onWakeWordDetected) {
                            onWakeWordDetected();
                        }
                    }
                }
            }, {
                probabilityThreshold: 0.85,
                invokeCallbackOnNoiseAndUnknown: false,
                overlapFactor: 0.50 
            });

            isListeningRef.current = true;
            setIsListening(true);
        } catch (err) {
            console.error("Error iniciando escucha de TFJS:", err);
        }
    }, [isCalibrated, onWakeWordDetected]);

    // Detener escucha (para el Handoff a SpeechRecognition)
    const stopSilentListening = useCallback(async () => {
        if (!transferRecognizerRef.current || !isListeningRef.current) return;
        
        try {
            await transferRecognizerRef.current.stopListening();
            isListeningRef.current = false;
            setIsListening(false);
            
            // SUPER CRÍTICO: Asegurarnos de que el AudioContext subyacente y los tracks del micrófono se liberen.
            // La librería internamente mantiene un stream. Lo detenemos si es posible.
            // Para forzar la liberación en Android:
            if (baseRecognizerRef.current && baseRecognizerRef.current.audioDataExtractor) {
                const stream = baseRecognizerRef.current.audioDataExtractor.stream;
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                const audioContext = baseRecognizerRef.current.audioDataExtractor.audioContext;
                if (audioContext && audioContext.state !== 'closed') {
                    await audioContext.suspend();
                }
            }
        } catch (err) {
            console.error("Error deteniendo escucha de TFJS:", err);
        }
    }, []);

    return {
        isLoaded,
        isCalibrated,
        isListening,
        collectExample,
        trainModel,
        startSilentListening,
        stopSilentListening
    };
}
