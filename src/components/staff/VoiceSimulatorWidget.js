'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Pencil, Check, X, ChevronDown, BookOpen } from 'lucide-react';
import useVoiceCopilot from '@/hooks/useVoiceCopilot';

// ═══════════════════════════════════════════════════════════════
// VOICE STATES
// ═══════════════════════════════════════════════════════════════
const VOICE_STATES = {
    off:     { container: 'bg-white border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.03)]',  textPrimary: 'text-slate-800', textSecondary: 'text-slate-500', pillBg: 'bg-slate-50 border-slate-100 text-slate-700' },
    idle:    { container: 'bg-white border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.05)]',  textPrimary: 'text-slate-800', textSecondary: 'text-slate-500', pillBg: 'bg-slate-50 border-slate-200 text-slate-700' },
    wake:    { container: 'bg-amber-500 border-amber-600 shadow-[0_12px_40px_rgba(245,158,11,0.3)]', textPrimary: 'text-white', textSecondary: 'text-white', pillBg: 'bg-black/10 border-black/10 text-white' },
    matched: { container: 'bg-emerald-500 border-emerald-600 shadow-[0_12px_40px_rgba(16,185,129,0.3)]', textPrimary: 'text-white', textSecondary: 'text-white', pillBg: 'bg-black/10 border-black/10 text-white' },
    playing: { container: 'bg-blue-500 border-blue-600 shadow-[0_12px_40px_rgba(59,130,246,0.3)]', textPrimary: 'text-white', textSecondary: 'text-white', pillBg: 'bg-black/10 border-black/10 text-white' },
};

export default function VoiceSimulatorWidget({
    pois = [],
    audioRef,
    playingPoiId,
    setPlayingPoiId,
    isActive,
    setIsActive,
    onStateChange = null,
}) {
    const copilot = useVoiceCopilot({
        pois, audioRef, playingPoiId, setPlayingPoiId, onStateChange, isActive, setIsActive
    });

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [isEditingWake, setIsEditingWake] = useState(false);
    const [wakeWordDraft, setWakeWordDraft] = useState(copilot.wakeWord);
    const wakeInputRef = useRef(null);
    const [showCommands, setShowCommands] = useState(false);
    const canvasRef = useRef(null);

    useEffect(() => {
        let animationFrameId;

        const drawRadialWave = () => {
            if (!copilot.analyserRef?.current || !canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            const analyser = copilot.analyserRef.current;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                if (!canvas || !analyser) return;
                animationFrameId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const baseRadius = 36; // matches active 72px center circle (r = 36px)

                ctx.lineWidth = 2.5;
                const barCount = 36;
                const angleStep = (Math.PI * 2) / barCount;

                for (let i = 0; i < barCount; i++) {
                    const dataIdx = Math.floor((i / barCount) * (bufferLength / 2));
                    const val = dataArray[dataIdx] || 0;
                    const amplitude = val / 255.0;
                    const barHeight = amplitude * 12; // max height of 12px radiating out

                    const angle = i * angleStep + (Date.now() * 0.0008); // slow rotation
                    const xStart = cx + Math.cos(angle) * baseRadius;
                    const yStart = cy + Math.sin(angle) * baseRadius;
                    const xEnd = cx + Math.cos(angle) * (baseRadius + barHeight);
                    const yEnd = cy + Math.sin(angle) * (baseRadius + barHeight);

                    const hue = 220 - (amplitude * 40);
                    ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.5 + amplitude * 0.5})`;
                    ctx.beginPath();
                    ctx.moveTo(xStart, yStart);
                    ctx.lineTo(xEnd, yEnd);
                    ctx.stroke();
                }
            };
            draw();
        };

        if (copilot.isActive) {
            const timer = setTimeout(() => {
                drawRadialWave();
            }, 300);
            return () => {
                clearTimeout(timer);
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
            };
        }
    }, [copilot.isActive, copilot.analyserRef]);

    // ── CONTAINER WIDTH RE-MEASUREMENT PARA 60FPS ──
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // ── HIGH-PERFORMANCE ACCORDION HEIGHT (60FPS) ──
    const contentRef = useRef(null);
    const [contentHeight, setContentHeight] = useState(0);

    useEffect(() => {
        if (contentRef.current) {
            const h = contentRef.current.scrollHeight;
            if (h !== contentHeight) {
                setContentHeight(h);
            }
        }
    });

    // ── ANIMATION STATE MACHINE ──
    // 'off' -> 'sliding_on' -> 'flying_on' -> 'on'
    // 'on' -> 'flying_off' -> 'sliding_off' -> 'off'
    const [animPhase, setAnimPhase] = useState(copilot.isActive ? 'on' : 'off');
    const prevIsActive = useRef(copilot.isActive);

    useEffect(() => {
        let t1, t2;
        if (copilot.isActive && !prevIsActive.current) {
            setAnimPhase('sliding_on');
            t1 = setTimeout(() => setAnimPhase('flying_on'), 250);
            t2 = setTimeout(() => setAnimPhase('on'), 950); // 250 + 700
        } else if (!copilot.isActive && prevIsActive.current) {
            setAnimPhase('flying_off');
            t1 = setTimeout(() => setAnimPhase('sliding_off'), 450);
            t2 = setTimeout(() => setAnimPhase('off'), 700); // 450 + 250
        }
        prevIsActive.current = copilot.isActive;
        
        return () => {
            if (t1) clearTimeout(t1);
            if (t2) clearTimeout(t2);
        };
    }, [copilot.isActive]);

    const isExpandedPhase = animPhase === 'flying_on' || animPhase === 'on';

    const saveWakeWordLocal = () => {
        copilot.saveWakeWord(wakeWordDraft);
        setIsEditingWake(false);
    };

    useEffect(() => {
        if (isEditingWake && wakeInputRef.current) {
            wakeInputRef.current.focus();
            wakeInputRef.current.select();
        }
    }, [isEditingWake]);

    const handleToggleClick = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        copilot.handleToggle();
    };

    const S = VOICE_STATES[copilot.isActive ? copilot.voiceState : 'off'] || VOICE_STATES.off;
    const playablePois = copilot.voiceCommands.length;

    // Halos del Orbi
    let haloClass = 'bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-500 animate-[spin_12s_linear_infinite]';
    if (copilot.voiceState === 'booting') haloClass = 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-500 animate-[spin_2s_linear_infinite] opacity-80';
    if (copilot.voiceState === 'wake') haloClass = 'bg-gradient-to-tr from-amber-400 via-orange-500 to-red-400 animate-[spin_2s_linear_infinite] opacity-100 scale-110';
    if (copilot.voiceState === 'matched') haloClass = 'bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500 animate-[spin_3s_linear_infinite]';
    if (copilot.voiceState === 'playing') haloClass = 'bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-500 animate-[spin_8s_linear_infinite] opacity-70';

    const getOrbStyles = () => {
        const W = containerWidth || 360; // Fallback previniendo NaN en render inicial SSR
        const base = { 
            pointerEvents: 'auto',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '72px',
            height: '72px',
            willChange: 'transform, opacity',
            transformOrigin: 'center center'
        };
        switch (animPhase) {
            case 'off':
                return { ...base, transform: `translate3d(${W - 103}px, 5px, 0) scale(0.388889)`, transition: 'transform 250ms ease-out' };
            case 'sliding_on':
                return { ...base, transform: `translate3d(${W - 73}px, 5px, 0) scale(0.388889)`, transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)' };
            case 'flying_on':
            case 'on':
                return { ...base, transform: `translate3d(${W / 2 - 36}px, 130px, 0) scale(1)`, transition: 'transform 700ms cubic-bezier(0.25, 1, 0.4, 1)' };
            case 'flying_off':
                return { ...base, transform: `translate3d(${W - 73}px, 5px, 0) scale(0.388889)`, transition: 'transform 450ms cubic-bezier(0.25, 1, 0.4, 1)' };
            case 'sliding_off':
                return { ...base, transform: `translate3d(${W - 103}px, 5px, 0) scale(0.388889)`, transition: 'transform 250ms ease-out' };
            default:
                return { ...base, transform: `translate3d(${W - 103}px, 5px, 0) scale(0.388889)` };
        }
    };

    if (!mounted) return null;

    if (!copilot.supported) {
        return (
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.03)] p-5 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <MicOff size={18} className="text-slate-400" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-slate-800">Orbi de Práctica</p>
                        <p className="text-[11px] text-slate-400">Tu navegador no soporta reconocimiento de voz.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={`rounded-[28px] border-2 overflow-hidden mb-6 transition-colors duration-700 relative ${S.container} ${isExpandedPhase ? 'ring-4 ring-white/10' : ''}`}>
            
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* THE MORPHING ORBI (Shared Element Illusion) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div 
                className={`z-[60] rounded-full`}
                style={getOrbStyles()}
                onClick={handleToggleClick}
            >
                {/* Sonar Ping (Active only) */}
                <div className={`absolute inset-0 rounded-full bg-white transition-all duration-500 ${isExpandedPhase && (copilot.voiceState === 'wake' || copilot.isDetectingVoice) ? 'opacity-40 animate-ping' : 'opacity-0 scale-50'}`}></div>

                {/* Colorful Spinning Halo (Behind the solid circle) */}
                <div className={`absolute inset-[-20%] rounded-full transition-all duration-[800ms] ease-in-out ${haloClass} ${isExpandedPhase ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
                
                {/* Radial Visualizer Canvas */}
                {copilot.isActive && isExpandedPhase && (
                    <canvas
                        ref={canvasRef}
                        width={96}
                        height={96}
                        className="absolute inset-[-12px] w-[96px] h-[96px] z-10 pointer-events-none"
                    />
                )}

                {/* Solid White Center & Icons */}
                <div className={`relative w-full h-full bg-white rounded-full flex items-center justify-center transition-all duration-700 ${isExpandedPhase ? 'shadow-[0_10px_40px_rgba(0,0,0,0.3)] ring-4 ring-white/50 cursor-pointer active:scale-95' : 'shadow-sm'}`}>
                    
                    {/* Icon OFF */}
                    <MicOff 
                        size={36} 
                        className={`absolute text-slate-400 transition-all duration-[400ms] ${isExpandedPhase ? 'opacity-0 scale-50 rotate-[-45deg]' : 'opacity-100 scale-100 rotate-0'}`} 
                    />
                    
                    {/* Icon ON */}
                    <Mic 
                        size={28} 
                        className={`absolute transition-all duration-[600ms] delay-100 ${isExpandedPhase ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-[45deg]'} ${copilot.voiceState === 'wake' ? 'text-amber-500' : copilot.voiceState === 'matched' ? 'text-emerald-500' : copilot.voiceState === 'playing' ? 'text-blue-500' : 'text-slate-700'}`} 
                    />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HEADER ROW */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className={`p-5 pb-4 relative z-20 transition-colors duration-500 ${isExpandedPhase ? 'bg-transparent' : 'bg-inherit'}`}>
                <div className="flex items-start justify-between mb-2">
                    <div className="pr-4">
                        <p className={`text-[15px] font-black uppercase tracking-wider transition-colors duration-500 ${S.textPrimary}`}>
                            Prueba de Comandos
                        </p>
                        <p className={`text-[11px] font-medium opacity-80 transition-colors duration-500 leading-relaxed mt-1 ${S.textSecondary}`}>
                            Prueba tus comandos de voz antes del vuelo.
                        </p>
                    </div>

                    {/* DUAL-STATE TRIGGER CONTAINER */}
                    <div className="relative w-[64px] h-[34px] shrink-0 mt-1 z-50">
                        
                        {/* 1. THE PILL TRACK */}
                        <button
                            onClick={handleToggleClick}
                            className={`absolute inset-0 w-full h-full rounded-full transition-all duration-300 outline-none ${
                                isExpandedPhase ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
                            } ${
                                animPhase === 'sliding_on' || animPhase === 'flying_off'
                                ? 'bg-blue-500/20 shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]'
                                : 'bg-slate-200 shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)] hover:bg-slate-300'
                            }`}
                        />

                        {/* 2. THE 'X' CLOSE BUTTON */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleToggleClick(); }}
                            className={`absolute -right-2 -top-2 w-[50px] h-[50px] rounded-full flex items-center justify-center transition-all duration-[400ms] outline-none shadow-none z-50 ${
                                isExpandedPhase ? 'opacity-100 scale-100 rotate-0 pointer-events-auto' : 'opacity-0 scale-50 rotate-[-90deg] pointer-events-none'
                            }`}
                        >
                            <div className="w-[34px] h-[34px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shadow-sm">
                                <X size={16} strokeWidth={3} />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Error Banner */}
                <div className={`transition-[max-height] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden`} style={{ maxHeight: copilot.errorMsg ? '100px' : '0px', willChange: 'max-height' }}>
                    <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mt-2 flex items-start gap-2 shadow-sm">
                        <span className="text-red-500 text-sm mt-0.5">⚠️</span>
                        <p className="text-[11px] text-red-600 font-medium leading-relaxed">{copilot.errorMsg}</p>
                        <button onClick={() => copilot.setErrorMsg(null)} className="ml-auto text-red-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ACCORDION EXPANDED CONTENT (Staggered Fade-ins) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div 
                className={`transition-[height] ease-[cubic-bezier(0.25,1,0.3,1)] overflow-hidden ${isExpandedPhase ? 'duration-[800ms]' : 'duration-[500ms] delay-[150ms]'}`}
                style={{ height: isExpandedPhase ? `${contentHeight}px` : '0px', willChange: 'height' }}
            >
                <div ref={contentRef} className="px-5 pb-6 flex flex-col items-center">
                    
                    {/* SPACER FOR THE MORPHING ORBI */}
                    <div className="h-[140px] w-full shrink-0"></div>

                    {/* ── LIVE TRANSCRIPT ── */}
                    <div className={`mt-2 h-8 flex items-center justify-center min-w-[200px] transition-[transform,opacity] duration-[600ms] delay-[150ms] ${isExpandedPhase ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
                        <p className={`text-[11px] font-bold uppercase tracking-widest transition-colors duration-500 ${S.textSecondary}`}>
                            {copilot.voiceState === 'booting' ? 'Conectando Copiloto...' : 
                             copilot.voiceState === 'idle' || copilot.voiceState === 'listening' ? (copilot.engineMode === 'local-vad-api' ? 'Habla para activar...' : `Di "${copilot.wakeWord}"...`) : 
                             copilot.voiceState === 'wake' ? 'Escuchando Comando...' : 
                             copilot.voiceState === 'processing' ? 'Procesando Voz...' :
                             copilot.voiceState === 'matched' ? '¡Comando detectado!' :
                             copilot.voiceState === 'playing' ? 'Reproduciendo...' : ''}
                        </p>
                    </div>

                    {/* Live Transcript Display Card */}
                    {copilot.isActive && (copilot.dictatedText || copilot.lastTranscript) && copilot.voiceState !== 'booting' && copilot.voiceState !== 'matched' && copilot.voiceState !== 'playing' && (
                        <div className={`mt-1.5 px-4 py-2 border rounded-xl w-full max-w-[285px] text-center backdrop-blur-sm shadow-sm transition-all duration-300 animate-fade-in ${S.pillBg}`}>
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block mb-0.5">
                                Transcripción en Vivo
                            </span>
                            <p className={`text-xs font-semibold italic ${S.textPrimary}`}>
                                &ldquo;{copilot.dictatedText || copilot.lastTranscript}&rdquo;
                            </p>
                        </div>
                    )}
                    
                    {/* Matched POI Name Display Container */}
                    <div className="mt-2 h-[32px] w-full relative flex justify-center">
                        <div className={`absolute flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/20 text-white shadow-sm transition-[transform,opacity] duration-[600ms] ease-out ${copilot.matchedPoi && (copilot.voiceState === 'matched' || copilot.voiceState === 'playing') ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90 pointer-events-none'}`}>
                            <span className="text-sm">{copilot.voiceState === 'matched' ? '✅' : '🔊'}</span>
                            <p className="text-[12px] font-bold truncate max-w-[200px]">{copilot.matchedPoi?.name || ''}</p>
                        </div>
                    </div>

                    {/* ── MOTOR DE VOZ SELECTOR ── */}
                    <div className={`w-full mt-3 transition-[transform,opacity] duration-[700ms] delay-[200ms] ${isExpandedPhase ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className={`rounded-2xl border p-2 flex flex-col gap-2 transition-colors duration-500 shadow-sm ${S.pillBg}`}>
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 transition-colors duration-300">
                                    Motor de Voz
                                </p>
                                <span className="text-[9px] font-bold opacity-45">
                                    {copilot.engineMode === 'vosk' ? '🎙️ Vosk Offline Activo' : copilot.engineMode === 'pocketsphinx-js' ? '🦊 PocketSphinx Activo' : '🤖 Offline "Go" Activo'}
                                </span>
                            </div>
                            <div className="flex bg-slate-100/40 p-1 rounded-xl border border-slate-200/50 shadow-inner w-full justify-between gap-1">
                                <button
                                    onClick={() => copilot.changeEngineMode('vosk')}
                                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                        copilot.engineMode === 'vosk' 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Vozq (Vosk)
                                </button>
                                {/*
                                <button
                                    onClick={() => copilot.changeEngineMode('pocketsphinx-js')}
                                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                        copilot.engineMode === 'pocketsphinx-js' 
                                            ? 'bg-amber-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    PocketSphinx
                                </button>
                                */}
                                <button
                                    onClick={() => copilot.changeEngineMode('tfjs-go')}
                                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                        copilot.engineMode === 'tfjs-go' 
                                            ? 'bg-purple-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    TFJS (Go)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── WAKE WORD CONFIGURATOR ── */}
                    <div className={`w-full mt-4 transition-[transform,opacity] duration-[700ms] delay-[250ms] ${isExpandedPhase ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className={`rounded-2xl border p-3.5 flex items-center justify-between transition-colors duration-500 shadow-sm ${S.pillBg}`}>
                                <div className="flex-1">
                                    <p className={`text-[9px] font-black uppercase tracking-widest opacity-60 mb-1 transition-colors duration-300`}>
                                        Palabra Mágica
                                    </p>
                                    {isEditingWake ? (
                                        <input
                                            ref={wakeInputRef}
                                            type="text"
                                            value={wakeWordDraft}
                                            onChange={(e) => setWakeWordDraft(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') saveWakeWordLocal(); if (e.key === 'Escape') { setIsEditingWake(false); setWakeWordDraft(copilot.wakeWord); }}}
                                            className="w-full bg-white border border-blue-400 rounded-lg px-2 py-1 text-[13px] font-bold text-slate-800 outline-none focus:border-blue-500 shadow-inner transition-all animate-[fadeIn_0.3s_ease-out]"
                                            maxLength={20}
                                            placeholder="ej. Computadora"
                                        />
                                    ) : (
                                        <button 
                                            onClick={() => { 
                                                if (copilot.engineMode === 'tfjs-go') return;
                                                setWakeWordDraft(copilot.wakeWord); 
                                                setIsEditingWake(true); 
                                            }} 
                                            disabled={copilot.engineMode === 'tfjs-go'}
                                            className={`flex items-center gap-2 group outline-none ${copilot.engineMode === 'tfjs-go' ? 'cursor-not-allowed' : ''}`}
                                        >
                                            <span className={`text-[14px] font-black tracking-tight`}>&ldquo;{copilot.wakeWord}&rdquo;</span>
                                            {copilot.engineMode !== 'tfjs-go' && (
                                                <Pencil size={12} className={`opacity-40 group-hover:opacity-100 transition-opacity`} />
                                            )}
                                            {copilot.engineMode === 'tfjs-go' && (
                                                <span className="text-[9px] font-bold opacity-45 italic">(Fijo en Offline)</span>
                                            )}
                                        </button>
                                    )}
                                </div>
                                
                                {isEditingWake && (
                                    <div className="flex items-center gap-1.5 ml-2 animate-[fadeIn_0.3s_ease-out]">
                                        <button onClick={saveWakeWordLocal} className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 active:scale-90 transition-all shadow-sm">
                                            <Check size={14} strokeWidth={3} />
                                        </button>
                                        <button onClick={() => { setIsEditingWake(false); setWakeWordDraft(copilot.wakeWord); }} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all shadow-sm">
                                            <X size={14} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── COMMANDS DICTIONARY ── */}
                        <div className={`w-full mt-3 transition-[transform,opacity] duration-[800ms] delay-[350ms] ${isExpandedPhase ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            <div className={`rounded-2xl border transition-colors duration-500 overflow-hidden shadow-sm ${S.pillBg}`}>
                                <button onClick={() => setShowCommands(!showCommands)} className="flex items-center justify-between w-full p-3.5 group outline-none active:bg-black/5 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <BookOpen size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                                        <p className={`text-[10px] font-black uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity`}>
                                            Diccionario de Comandos ({playablePois})
                                        </p>
                                    </div>
                                    <div className={`transition-transform duration-500 ease-out opacity-60 group-hover:opacity-100 ${showCommands ? 'rotate-180' : 'rotate-0'}`}>
                                        <ChevronDown size={14} />
                                    </div>
                                </button>

                                <div 
                                    className={`transition-[max-height] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden`} 
                                    style={{ maxHeight: showCommands ? '300px' : '0px', willChange: 'max-height' }}
                                >
                                    <div className="px-3 pb-3 space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar">
                                        {copilot.voiceCommands.length === 0 ? (
                                            <p className="text-[11px] italic opacity-60 text-center py-2">No hay narrativas con audio.</p>
                                        ) : (
                                            copilot.voiceCommands.map((cmd, i) => (
                                                <div key={cmd.id} className="flex flex-col rounded-xl px-3 py-2 bg-white/40 border border-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)] transition-colors hover:bg-white/60 animate-[fadeInUp_0.4s_ease-out]" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                                                    <span className="text-[11px] font-bold opacity-90 truncate text-slate-800">
                                                        &ldquo;{cmd.keywords.join(', ')}&rdquo;
                                                    </span>
                                                    <span className="text-[9px] truncate opacity-70 text-slate-600 mt-0.5">
                                                        Responde: {cmd.name}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            
            <style jsx>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
