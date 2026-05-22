'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Minus, Plus, Mic } from 'lucide-react';

const GAIN_MIN = 0.0;
const GAIN_MAX = 1.0;
const GAIN_STEP = 0.05;

const GUIDE_PHRASES = [
    '🗣️ Di: "Probando, probando"',
    '🗣️ Di: "Computadora"',
    '🗣️ Di: "Uno, dos, tres"',
];

export default function MicCalibrator({ micGain, setMicGain, dictatedText, onClose }) {
    const [hasHeardVoice, setHasHeardVoice] = useState(false);
    const [phraseIndex, setPhraseIndex] = useState(0);
    const silenceTimerRef = useRef(null);
    const lastTextRef = useRef('');

    // Detect when Vosk transcribes something
    useEffect(() => {
        let isMounted = true;
        if (dictatedText && dictatedText !== lastTextRef.current && dictatedText.trim().length > 2) {
            lastTextRef.current = dictatedText;
            setHasHeardVoice(true);
            // Reset after 5s of no new text
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (!isMounted) return;
                setHasHeardVoice(false);
                // Rotate guide phrase
                setPhraseIndex(prev => (prev + 1) % GUIDE_PHRASES.length);
            }, 5000);
        }
        return () => {
            isMounted = false;
            clearTimeout(silenceTimerRef.current);
        };
    }, [dictatedText]);


    const handleStepDown = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        setMicGain(Math.max(GAIN_MIN, micGain - GAIN_STEP));
    };

    const handleStepUp = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        setMicGain(Math.min(GAIN_MAX, micGain + GAIN_STEP));
    };

    const handleSlider = (e) => {
        const val = parseFloat(e.target.value);
        setMicGain(val);
    };

    const handleClose = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 50, 30]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
            <div className="w-full max-w-[400px] bg-white rounded-t-3xl shadow-2xl px-6 pt-4 pb-8 animate-slide-up"
                 onClick={(e) => e.stopPropagation()}>

                {/* Handle bar */}
                <div className="flex justify-center mb-3">
                    <div className="w-10 h-1 rounded-full bg-slate-200" />
                </div>

                {/* Close */}
                <button onClick={handleClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                    <X size={16} className="text-slate-500" />
                </button>

                {/* Header */}
                <div className="text-center mb-5">
                    <div className="text-3xl mb-2">🎙️</div>
                    <h2 className="text-lg font-bold text-slate-800">Ajusta tu micrófono</h2>
                    <p className="text-sm text-slate-500 mt-1">Sube hasta que veas tus palabras aparecer.</p>
                </div>

                {/* Guide phrase — Duolingo style */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-4 py-3 mb-4 text-center">
                    <p className="text-sm font-bold text-blue-700">{GUIDE_PHRASES[phraseIndex]}</p>
                </div>

                {/* Vosk live box */}
                <div className={`rounded-2xl px-4 py-4 mb-4 min-h-[60px] flex items-center justify-center transition-all duration-500 border-2 ${
                    hasHeardVoice
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                }`}>
                    {dictatedText && dictatedText.trim().length > 0 ? (
                        <p className={`text-center text-base font-semibold transition-colors ${
                            hasHeardVoice ? 'text-emerald-700' : 'text-slate-700'
                        }`}>
                            "{dictatedText}"
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400 italic">🤫 Escuchando...</p>
                    )}
                </div>

                {/* Dynamic indicator */}
                <div className={`rounded-xl px-4 py-2.5 mb-5 text-center transition-all duration-500 ${
                    hasHeardVoice
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                }`}>
                    <p className="text-sm font-bold">
                        {hasHeardVoice
                            ? '✅ ¡Te escucho perfecto!'
                            : '😶 Aún no te escucho. Sube ↑'
                        }
                    </p>
                </div>

                {/* Slider + Buttons */}
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={handleStepDown}
                        disabled={micGain <= GAIN_MIN}
                        className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                            micGain <= GAIN_MIN
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Minus size={18} strokeWidth={2.5} />
                    </button>

                    <div className="flex-1 relative">
                        <input
                            type="range"
                            min={GAIN_MIN}
                            max={GAIN_MAX}
                            step={0.01}
                            value={micGain}
                            onChange={handleSlider}
                            className="mic-calibrator-slider w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 outline-none"
                        />
                    </div>

                    <button
                        onClick={handleStepUp}
                        disabled={micGain >= GAIN_MAX}
                        className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                            micGain >= GAIN_MAX
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        }`}
                    >
                        <Plus size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Level label */}
                <p className="text-center text-xs font-bold text-slate-400 mb-5 tracking-wide">
                    Sensibilidad: {Math.round(micGain * 100)}%
                </p>

                {/* Duolingo tip */}
                <div className="bg-slate-50 rounded-xl px-4 py-2.5 mb-5">
                    <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                        💡 <span className="font-semibold text-slate-500">Tip:</span> Si ves palabras que <strong>tú no dijiste</strong>, baja un poco la sensibilidad.
                    </p>
                </div>

                {/* Done button */}
                <button
                    onClick={handleClose}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-base tracking-wide shadow-[0_8px_24px_-8px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all hover:bg-blue-700"
                >
                    ✓ Listo
                </button>
            </div>

            {/* Slide-up animation */}
            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .mic-calibrator-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #3b82f6;
                    border: 4px solid white;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
                    cursor: pointer;
                    transition: transform 0.15s;
                }
                .mic-calibrator-slider::-webkit-slider-thumb:active {
                    transform: scale(1.2);
                }
                .mic-calibrator-slider::-moz-range-thumb {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #3b82f6;
                    border: 4px solid white;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}
