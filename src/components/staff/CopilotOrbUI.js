'use client';

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import useVoiceCopilot from '@/hooks/useVoiceCopilot';
import { BookOpen, ChevronDown, ChevronUp, Mic, MicOff, Volume2 } from 'lucide-react';
import TFCalibratorModal from '@/components/staff/TFCalibratorModal';

const CopilotOrbUI = forwardRef(({
    pois = [],
    audioRef,
    playingPoiId,
    setPlayingPoiId,
    isActive,
    setIsActive,
    onStateChange = null,
    isPeripheralActive = false,
}, ref) => {
    const copilot = useVoiceCopilot({
        pois, audioRef, playingPoiId, setPlayingPoiId, onStateChange, isActive, setIsActive
    });

    useImperativeHandle(ref, () => ({
        startListening: copilot.startListening,
        stopListening: copilot.stopListening
    }));

    const [showDictionary, setShowDictionary] = useState(false);
    const [showCalibrator, setShowCalibrator] = useState(false);

    // Native Tailwind classes used instead of custom injected CSS to prevent shape issues

    let haloClass = 'bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-500 animate-[spin_12s_linear_infinite]';
    if (copilot.voiceState === 'booting') haloClass = 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-500 animate-[spin_2s_linear_infinite] opacity-80';
    if (copilot.voiceState === 'wake') haloClass = 'bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-500 animate-[spin_2s_linear_infinite] opacity-100 scale-110';
    if (copilot.voiceState === 'matched') haloClass = 'bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500 animate-[spin_3s_linear_infinite]';
    if (copilot.voiceState === 'playing') haloClass = 'bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-500 animate-[spin_8s_linear_infinite] opacity-70';
    
    // Si el copiloto está apagado, reducimos drásticamente la opacidad y añadimos un pulso suave
    if (!copilot.isActive) {
        haloClass = 'bg-slate-300 opacity-20 blur-md animate-[pulse_4s_ease-in-out_infinite]';
    }

    const handleOrbClick = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        copilot.handleToggle();
    };

    if (!copilot.supported) return null;

    return (
        <div className="w-full flex flex-col items-center justify-center pt-0 pb-1 relative z-50">
            {/* ── NARRATIONS DICTIONARY (COLLAPSIBLE) - MINIMALIST TOP ── */}
            <div className="w-full flex flex-col items-center justify-center mb-3">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowDictionary(!showDictionary)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors active:scale-95 ${showDictionary ? (isPeripheralActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700') : (isPeripheralActive ? 'text-white/60 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50')}`}
                    >
                        <BookOpen size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Diccionario de Narraciones</span>
                        {showDictionary ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    
                    {/* Botón Experimental de Megáfono */}
                    <button
                        onClick={() => copilot.setIsMegaphoneActive(!copilot.isMegaphoneActive)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors active:scale-95 border ${copilot.isMegaphoneActive ? 'bg-red-500 border-red-400 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' : (isPeripheralActive ? 'bg-white/10 border-white/20 text-white/80' : 'bg-white border-slate-200 text-slate-500')}`}
                        title="Megáfono Experimental (Retorno de voz a bocina)"
                    >
                        <Volume2 size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">{copilot.isMegaphoneActive ? 'Megáfono ON' : 'Megáfono OFF'}</span>
                    </button>
                </div>

                {showDictionary && (
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5 max-w-[280px] max-h-[80px] overflow-y-auto custom-scrollbar">
                        {pois && pois.length > 0 ? (
                            pois.map((poi, idx) => (
                                <span key={idx} className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${isPeripheralActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    {poi.name}
                                </span>
                            ))
                        ) : (
                            <span className={`text-[9px] italic ${isPeripheralActive ? 'text-white/60' : 'text-slate-400'}`}>Vacío</span>
                        )}
                    </div>
                )}
            </div>

            {/* ── THE ORB ── */}
            <button
                onClick={handleOrbClick}
                className="relative w-32 h-32 flex items-center justify-center group outline-none focus:outline-none"
                aria-label="Toggle Copilot"
            >
                {/* Sonar Ripple Animation (When speaking or wake mode) */}
                {(copilot.voiceState === 'wake' || copilot.isDetectingVoice) && (
                    <>
                        <div className={`absolute inset-0 rounded-full bg-blue-400 opacity-70 animate-ping ${copilot.isDetectingVoice ? 'duration-[0.8s]' : 'duration-[1.5s]'}`}></div>
                        <div className={`absolute inset-0 rounded-full bg-blue-300 opacity-50 animate-ping ${copilot.isDetectingVoice ? 'duration-[0.8s]' : 'duration-[1.5s]'}`} style={{ animationDelay: '0.2s' }}></div>
                    </>
                )}

                {/* Background Halo */}
                <div className={`absolute inset-0 rounded-full transition-all duration-700 ease-in-out ${haloClass} ${copilot.isDetectingVoice ? 'scale-110 opacity-100 animate-pulse' : ''}`} />
                
                {/* Solid Center Circle */}
                <div 
                    className={`relative w-20 h-20 bg-white shadow-xl flex items-center justify-center z-10 transition-all duration-300 rounded-full group-hover:scale-105 ${copilot.voiceState === 'wake' ? 'scale-90 ring-4 ring-blue-400/50 shadow-[0_0_30px_rgba(59,130,246,0.8)]' : copilot.isActive ? 'shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''} ${copilot.isDetectingVoice ? 'scale-95 ring-2 ring-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.6)]' : ''}`}
                    style={!copilot.isActive ? { animation: 'orbDeform 4s ease-in-out infinite' } : {}}
                >
                     {copilot.isActive ? (
                         <Mic size={32} className={`transition-colors duration-300 ${copilot.voiceState === 'wake' || copilot.isDetectingVoice ? 'text-blue-600 scale-110' : 'text-blue-400 opacity-80'}`} />
                     ) : (
                         <MicOff size={32} className="text-slate-300 opacity-60" />
                     )}
                </div>
            </button>

            {/* ── LIVE TRANSCRIPT / STATUS TEXT ── */}
            <div className="mt-2 h-6 flex items-center justify-center min-w-[200px]">
                {copilot.isActive ? (
                    <div className="text-center px-4">
                        {copilot.lastTranscript && copilot.voiceState !== 'booting' ? (
                            <p className={`text-[13px] font-medium italic animate-fade-in truncate max-w-[280px] transition-colors duration-300 ${isPeripheralActive ? 'text-white' : 'text-slate-700'}`}>
                                &ldquo;{copilot.lastTranscript}&rdquo;
                            </p>
                        ) : (
                            <p className={`text-[11px] font-bold uppercase tracking-widest opacity-60 transition-colors duration-300 ${isPeripheralActive ? 'text-white/80' : 'text-slate-400'}`}>
                                {copilot.voiceState === 'booting' ? 'Cargando Modelo (40MB)...' : 
                                 copilot.voiceState === 'idle' || copilot.voiceState === 'listening' ? `Di "${copilot.wakeWord}"...` : 
                                 copilot.voiceState === 'wake' ? 'Escuchando...' : 
                                 copilot.voiceState === 'matched' ? 'Comando detectado' :
                                 copilot.voiceState === 'playing' ? 'Reproduciendo...' : ''}
                            </p>
                        )}
                    </div>
                ) : null}
            </div>
            
            {/* Matched POI Name Display below transcript when playing */}
            {copilot.isActive && copilot.matchedPoi && (copilot.voiceState === 'matched' || copilot.voiceState === 'playing') && (
                <div className={`mt-2 flex items-center gap-2 px-3 py-1 rounded-full border transition-colors duration-300 ${isPeripheralActive ? 'bg-white/20 border-white/30 backdrop-blur-md' : 'bg-black/5 border-black/10'}`}>
                    <span className="text-xs">{copilot.voiceState === 'matched' ? '✅' : '🔊'}</span>
                    <p className={`text-[11px] font-bold truncate max-w-[200px] transition-colors duration-300 ${isPeripheralActive ? 'text-white' : 'text-slate-700'}`}>
                        {copilot.matchedPoi.name}
                    </p>
                </div>
            )}

            <style jsx>{`
                @keyframes orbDeform {
                    0%, 90%, 100% { transform: scale(1); }
                    95% { transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
});

export default CopilotOrbUI;
