'use client';
import React, { useState } from 'react';
import { Mic, Check, Settings, Activity } from 'lucide-react';

export default function TFCalibratorModal({ 
    isOpen, 
    collectExample, 
    trainModel, 
    onCalibrationComplete 
}) {
    const [step, setStep] = useState('intro'); // intro, noise, voice, training, done
    const [examplesCount, setExamplesCount] = useState({ noise: 0, voice: 0 });
    const [isRecording, setIsRecording] = useState(false);
    const [trainingProgress, setTrainingProgress] = useState(0);

    if (!isOpen) return null;

    const handleRecordNoise = async () => {
        setIsRecording(true);
        try {
            // Recolectar 3 ejemplos de ruido (aprox 3 segundos)
            for (let i = 0; i < 3; i++) {
                await collectExample('_background_noise_');
                setExamplesCount(prev => ({ ...prev, noise: prev.noise + 1 }));
            }
            setStep('voice');
        } catch (e) {
            console.error("Error capturando ruido:", e);
        }
        setIsRecording(false);
    };

    const handleRecordVoice = async () => {
        setIsRecording(true);
        try {
            // Recolectar 1 ejemplo de la palabra "computadora"
            await collectExample('computadora');
            setExamplesCount(prev => {
                const newCount = prev.voice + 1;
                if (newCount >= 3) {
                    setStep('training');
                    startTraining();
                }
                return { ...prev, voice: newCount };
            });
        } catch (e) {
            console.error("Error capturando voz:", e);
        }
        setIsRecording(false);
    };

    const startTraining = async () => {
        try {
            await trainModel((epoch, logs) => {
                // Son 25 epochs
                const progress = Math.round(((epoch + 1) / 25) * 100);
                setTrainingProgress(progress);
            });
            setStep('done');
        } catch (e) {
            console.error("Error entrenando:", e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-700/50">
                <div className="flex flex-col items-center text-center space-y-6">
                    
                    {/* ICONO CENTRAL */}
                    <div className="h-20 w-20 rounded-full bg-indigo-500/10 flex items-center justify-center relative">
                        {step === 'training' ? (
                            <Activity className="text-4xl text-indigo-400 animate-pulse" />
                        ) : step === 'done' ? (
                            <Check className="text-4xl text-emerald-400" />
                        ) : (
                            <Settings className="text-4xl text-indigo-400" />
                        )}
                        {isRecording && (
                            <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-rose-500 animate-ping"></span>
                        )}
                    </div>

                    {/* CONTENIDO SEGÚN PASO */}
                    {step === 'intro' && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-white">Calibración de IA</h2>
                            <p className="text-slate-300">
                                Para activar el copiloto sin tocar la pantalla, necesitamos enseñarle a reconocer el ruido de fondo y tu voz.
                            </p>
                            <button 
                                onClick={() => setStep('noise')}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-2xl transition-colors"
                            >
                                Empezar Calibración
                            </button>
                        </div>
                    )}

                    {step === 'noise' && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-white">Silencio por favor...</h2>
                            <p className="text-slate-300">
                                Vamos a grabar 3 segundos del ruido ambiente de la cabina. Quédate en silencio.
                            </p>
                            <button 
                                onClick={handleRecordNoise}
                                disabled={isRecording}
                                className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
                            >
                                {isRecording ? 'Grabando ruido...' : 'Grabar Ruido Base'}
                            </button>
                        </div>
                    )}

                    {step === 'voice' && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-white">Di "Computadora"</h2>
                            <p className="text-slate-300">
                                Presiona el botón y di la palabra claramente. Faltan {3 - examplesCount.voice} repeticiones.
                            </p>
                            <button 
                                onClick={handleRecordVoice}
                                disabled={isRecording}
                                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Mic />
                                {isRecording ? 'Escuchando...' : 'Mantén presionado para decir "Computadora"'}
                            </button>
                            <p className="text-xs text-slate-400">Progreso: {examplesCount.voice} / 3</p>
                        </div>
                    )}

                    {step === 'training' && (
                        <div className="space-y-4 w-full">
                            <h2 className="text-2xl font-bold text-white">Entrenando Motor Local...</h2>
                            <p className="text-slate-300 text-sm">
                                Procesando redes neuronales en tu dispositivo. Esto tomará unos segundos.
                            </p>
                            <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                    style={{ width: `${trainingProgress}%` }}
                                ></div>
                            </div>
                            <p className="text-slate-400 font-mono text-sm">{trainingProgress}%</p>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-white">¡Calibración Exitosa!</h2>
                            <p className="text-slate-300">
                                Tu dispositivo ahora está listo para escuchar silenciosamente en el fondo.
                            </p>
                            <button 
                                onClick={onCalibrationComplete}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-2xl transition-colors"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
