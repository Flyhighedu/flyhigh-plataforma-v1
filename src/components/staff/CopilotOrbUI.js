'use client';

import { useEffect, useState, useRef, forwardRef, useImperativeHandle, memo } from 'react';
import useVoiceCopilot from '@/hooks/useVoiceCopilot';
import { BookOpen, ChevronDown, ChevronUp, Mic, MicOff, SlidersHorizontal } from 'lucide-react';
import TFCalibratorModal from '@/components/staff/TFCalibratorModal';
import MicCalibrator from '@/components/staff/MicCalibrator';

const CopilotOrbUI = memo(forwardRef(({
    pois = [],
    audioRef,
    playingPoiId,
    setPlayingPoiId,
    isActive,
    setIsActive,
    onStateChange = null,
    isPeripheralActive = false,
    // ── Shared Microphone (Plan A) ──
    sharedMicStreamRef = null,
    sharedMicLabel = null,
}, ref) => {
    const copilot = useVoiceCopilot({
        pois, audioRef, playingPoiId, setPlayingPoiId, onStateChange, isActive, setIsActive,
        sharedStreamRef: sharedMicStreamRef,
        sharedMicLabel
    });

    useImperativeHandle(ref, () => ({
        startListening: copilot.startListening,
        stopListening: copilot.stopListening,
        changeEngineMode: copilot.changeEngineMode,
        engineMode: copilot.engineMode,
        deviceInfo: copilot.deviceInfo
    }));

    const [showDictionary, setShowDictionary] = useState(false);
    const [showCalibrator, setShowCalibrator] = useState(false);

    const handleOrbClick = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        copilot.handleToggle();
    };

    if (!copilot.supported) return null;

    // ═══════════════════════════════════════════════════
    // CSS-only state classes (zero JS animation, zero canvas)
    // All animations run on the GPU compositor thread.
    // ═══════════════════════════════════════════════════
    const isOff = !copilot.isActive;
    const vs = copilot.voiceState;

    // Outer ring: subtle feedback ring
    let ringClass = 'scale-100 opacity-0';
    if (vs === 'booting') ringClass = 'scale-105 opacity-40 animate-pulse';
    if (vs === 'listening' || vs === 'idle') ringClass = 'scale-100 opacity-20';
    if (vs === 'wake') ringClass = 'scale-110 opacity-70 animate-ping';
    if (vs === 'matched' || vs === 'success') ringClass = 'scale-105 opacity-60';
    if (vs === 'playing') ringClass = 'scale-105 opacity-50 animate-pulse';
    if (copilot.isDetectingVoice && copilot.isActive) ringClass = 'scale-110 opacity-60 animate-ping';

    // Ring color
    let ringColorClass = 'bg-blue-400';
    if (vs === 'booting') ringColorClass = 'bg-indigo-400';
    if (vs === 'wake') ringColorClass = 'bg-amber-400';
    if (vs === 'matched' || vs === 'success') ringColorClass = 'bg-emerald-400';
    if (vs === 'playing') ringColorClass = 'bg-blue-400';

    // Halo glow (border + shadow)
    let haloClass = 'border-slate-200 shadow-sm';
    if (isOff) haloClass = 'border-slate-200 shadow-sm';
    if (vs === 'booting') haloClass = 'border-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.25)]';
    if (vs === 'listening' || vs === 'idle') haloClass = 'border-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.15)]';
    if (vs === 'wake') haloClass = 'border-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.35)]';
    if (vs === 'matched' || vs === 'success') haloClass = 'border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.35)]';
    if (vs === 'playing') haloClass = 'border-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.25)]';

    // Icon color
    let iconClass = 'text-slate-300';
    if (copilot.isActive) {
        iconClass = 'text-blue-400';
        if (vs === 'wake' || copilot.isDetectingVoice) iconClass = 'text-blue-600';
        if (vs === 'matched' || vs === 'success') iconClass = 'text-emerald-500';
        if (vs === 'playing') iconClass = 'text-blue-500';
        if (vs === 'booting') iconClass = 'text-indigo-400';
    }

    // Center dot indicator (tiny, always visible when active)
    let dotClass = 'bg-slate-300';
    if (copilot.isActive) {
        dotClass = 'bg-blue-400 animate-pulse';
        if (vs === 'wake') dotClass = 'bg-amber-400 animate-ping';
        if (vs === 'matched') dotClass = 'bg-emerald-400';
        if (vs === 'playing') dotClass = 'bg-blue-400 animate-pulse';
    }

    return (
        <div className="w-full flex flex-col items-center justify-center pt-0 pb-1 relative z-50">
            {/* ── NARRATIONS DICTIONARY (COLLAPSIBLE) - MINIMALIST TOP ── */}
            <div className="w-full flex flex-col items-center justify-center mb-3">
                <button 
                    onClick={() => setShowDictionary(!showDictionary)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors active:scale-95 ${showDictionary ? (isPeripheralActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700') : (isPeripheralActive ? 'text-white/60 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50')}`}
                >
                    <BookOpen size={12} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Diccionario de Narraciones</span>
                    {showDictionary ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

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

                {/* ── ENGINE SWITCHER ── */}
                <div className={`flex items-center gap-1 mt-2 border rounded-full p-0.5 ${
                    isPeripheralActive 
                        ? 'border-white/10 bg-white/5' 
                        : 'border-slate-200 bg-slate-50/50'
                }`}>
                    <button
                        onClick={() => copilot.changeEngineMode('vosk')}
                        className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full tracking-wider transition-all ${
                            copilot.engineMode === 'vosk'
                                ? (isPeripheralActive ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-white shadow-sm')
                                : (isPeripheralActive ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-600')
                        }`}
                    >
                        Vosk
                    </button>
                    <button
                        onClick={() => copilot.changeEngineMode('tfjs-go')}
                        className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full tracking-wider transition-all ${
                            copilot.engineMode === 'tfjs-go'
                                ? (isPeripheralActive ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-800 text-white shadow-sm')
                                : (isPeripheralActive ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-600')
                        }`}
                    >
                        TFJS + Web
                    </button>
                </div>

                {/* ── MIC CALIBRATOR BUTTON ── */}
                <button
                    onClick={() => {
                        if (!copilot.isActive) copilot.startListening();
                        setShowCalibrator(true);
                    }}
                    className={`flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full transition-all active:scale-95 ${
                        isPeripheralActive
                            ? 'text-white/50 hover:bg-white/10'
                            : 'text-slate-400 hover:bg-slate-50'
                    }`}
                >
                    <SlidersHorizontal size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Calibrar</span>
                </button>

                {/* ── ACTIVE MIC BADGE ── */}
                {copilot.activeMicLabel && copilot.isActive && (() => {
                    const label = copilot.activeMicLabel.toLowerCase();
                    const isExt = ['usb', 'wired', 'external', 'lavalier', 'lapel', 'solapa', 'headset', 'airpod'].some(kw => label.includes(kw));
                    return (
                        <div className={`flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full border transition-all ${
                            isExt
                                ? (isPeripheralActive ? 'border-emerald-400/30 bg-emerald-500/15' : 'border-emerald-200 bg-emerald-50')
                                : (isPeripheralActive ? 'border-amber-400/30 bg-amber-500/15' : 'border-amber-200 bg-amber-50')
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isExt ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.5)]'
                            }`} />
                            <span className={`text-[8px] font-semibold truncate max-w-[140px] ${
                                isExt
                                    ? (isPeripheralActive ? 'text-emerald-300' : 'text-emerald-700')
                                    : (isPeripheralActive ? 'text-amber-300' : 'text-amber-700')
                            }`}>
                                {copilot.activeMicLabel.length > 25
                                    ? copilot.activeMicLabel.slice(0, 25) + '…'
                                    : copilot.activeMicLabel}
                            </span>
                        </div>
                    );
                })()}

                {/* ── RNNOISE STATUS BADGE ── */}
                {copilot.isActive && copilot.rnnoiseStatus === 'loading' && (
                    <div className={`flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full border animate-pulse ${
                        isPeripheralActive ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            isPeripheralActive ? 'bg-slate-400' : 'bg-slate-300'
                        }`} />
                        <span className={`text-[7px] font-semibold uppercase tracking-wider ${
                            isPeripheralActive ? 'text-white/40' : 'text-slate-400'
                        }`}>Cargando IA…</span>
                    </div>
                )}
                {copilot.isActive && copilot.rnnoiseStatus === 'active' && (
                    <div className={`flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full border ${
                        isPeripheralActive ? 'border-violet-400/30 bg-violet-500/15' : 'border-violet-200 bg-violet-50'
                    }`}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.6)]" />
                        <span className={`text-[7px] font-bold uppercase tracking-wider ${
                            isPeripheralActive ? 'text-violet-300' : 'text-violet-600'
                        }`}>RNNoise ✨</span>
                    </div>
                )}
            </div>

            {/* ── THE ORB (CSS-only, zero canvas, zero rAF) ── */}
            <button
                onClick={handleOrbClick}
                className="relative w-28 h-28 flex items-center justify-center group outline-none focus:outline-none"
                aria-label="Toggle Copilot"
            >
                {/* Sonar Ring — CSS only, GPU-composited */}
                <div className={`absolute inset-0 rounded-full transition-[transform,opacity] duration-500 will-change-[transform,opacity] ${ringColorClass} ${ringClass}`} />

                {/* Solid Center Circle */}
                <div 
                    className={`relative w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center z-10 transition-[transform,opacity,border-color,box-shadow] duration-300 will-change-[transform,opacity] border-2 ${haloClass} ${
                        copilot.isActive ? 'group-hover:scale-105' : 'group-hover:scale-102'
                    }`}
                >
                     {copilot.isActive ? (
                         <Mic size={28} className={`transition-colors duration-300 ${iconClass}`} />
                     ) : (
                         <MicOff size={28} className="text-slate-300 opacity-60" />
                     )}

                     {/* Status dot — bottom right */}
                     <span className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors duration-300 ${dotClass}`} />
                </div>
            </button>

            {/* ── STATUS + LIVE TRANSCRIPT (unified, minimal) ── */}
            <div className="mt-3 flex flex-col items-center justify-center min-h-[40px] max-w-[260px] px-2">
                {copilot.isActive && (
                    <>
                        {/* State label */}
                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
                            vs === 'wake'
                                ? (isPeripheralActive ? 'text-amber-200/80' : 'text-amber-500')
                                : (isPeripheralActive ? 'text-white/40' : 'text-slate-300')
                        }`}>
                            {vs === 'booting' ? 'Conectando…' : 
                             vs === 'idle' || vs === 'listening' ? `Di "${copilot.wakeWord}"` : 
                             vs === 'wake' ? 'Escuchando comando…' : 
                             vs === 'matched' ? 'Detectado' :
                             vs === 'playing' ? 'Reproduciendo' : ''}
                        </p>

                        {/* Live transcript — style adapts to state */}
                        {(copilot.dictatedText || copilot.lastTranscript) && vs !== 'booting' && (
                            <p className={`mt-1 text-center leading-snug transition-all duration-300 ${
                                vs === 'wake'
                                    ? 'text-[14px] font-semibold ' + (isPeripheralActive ? 'text-white' : 'text-slate-800')
                                    : 'text-[11px] font-normal ' + (isPeripheralActive ? 'text-white/30' : 'text-slate-300')
                            }`}>
                                {copilot.dictatedText || copilot.lastTranscript}
                            </p>
                        )}

                        {/* Matched POI pill */}
                        {copilot.matchedPoi && (vs === 'matched' || vs === 'playing') && (
                            <div className={`mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-300 ${
                                isPeripheralActive 
                                    ? 'bg-white/15 backdrop-blur-sm' 
                                    : 'bg-slate-50 border border-slate-100'
                            }`}>
                                <span className="text-[11px]">{vs === 'matched' ? '✓' : '♪'}</span>
                                <span className={`text-[11px] font-semibold truncate max-w-[180px] ${
                                    isPeripheralActive ? 'text-white' : 'text-slate-700'
                                }`}>
                                    {copilot.matchedPoi.name}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── MIC CALIBRATOR MODAL ── */}
            {showCalibrator && (
                <MicCalibrator
                    micGain={copilot.micGain}
                    setMicGain={copilot.setMicGain}
                    dictatedText={copilot.dictatedText || copilot.lastTranscript}
                    onClose={() => setShowCalibrator(false)}
                />
            )}
        </div>
    );
}));

CopilotOrbUI.displayName = 'CopilotOrbUI';

export default CopilotOrbUI;
