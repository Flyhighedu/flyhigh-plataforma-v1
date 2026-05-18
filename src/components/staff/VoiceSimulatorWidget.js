'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Pencil, Check, X, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import useVoiceCopilot from '@/hooks/useVoiceCopilot';
import TFCalibratorModal from '@/components/staff/TFCalibratorModal';

// ═══════════════════════════════════════════════════════════════
// VOICE STATES + Peripheral Vision styling
// ═══════════════════════════════════════════════════════════════
const VOICE_STATES = {
    off:     { label: 'Apagado',                 barClass: '',           container: 'bg-white border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.03)]',  textPrimary: 'text-slate-800', textSecondary: 'text-slate-500', textMuted: 'text-slate-400', pillBg: 'bg-slate-50 border-slate-100 text-slate-700',  barColor: '#CBD5E1', iconBg: 'bg-slate-100', iconColor: 'text-slate-400' },
    idle:    { label: 'Esperando palabra mágica…', barClass: 'vw-idle',   container: 'bg-white border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.03)]',  textPrimary: 'text-slate-800', textSecondary: 'text-slate-500', textMuted: 'text-slate-400', pillBg: 'bg-slate-50 border-slate-100 text-slate-700',  barColor: '#94A3B8', iconBg: 'bg-gradient-to-br from-[#2563eb] to-[#4338ca]', iconColor: 'text-white' },
    wake:    { label: '¡Escuchando comando!',     barClass: 'vw-wake',   container: 'bg-amber-500 border-amber-600 shadow-[0_8px_20px_rgba(0,0,0,0.03)]', textPrimary: 'text-white', textSecondary: 'text-white', textMuted: 'text-amber-100', pillBg: 'bg-black/10 border-black/10 text-white', barColor: '#FFFFFF', iconBg: 'bg-black/20', iconColor: 'text-white' },
    matched: { label: '¡Comando detectado!',      barClass: 'vw-matched', container: 'bg-emerald-500 border-emerald-600 shadow-[0_8px_20px_rgba(0,0,0,0.03)]', textPrimary: 'text-white', textSecondary: 'text-white', textMuted: 'text-emerald-100', pillBg: 'bg-black/10 border-black/10 text-white', barColor: '#FFFFFF', iconBg: 'bg-black/20', iconColor: 'text-white' },
    playing: { label: 'Reproduciendo…',           barClass: 'vw-playing', container: 'bg-blue-500 border-blue-600 shadow-[0_8px_20px_rgba(0,0,0,0.03)]', textPrimary: 'text-white', textSecondary: 'text-white', textMuted: 'text-blue-100', pillBg: 'bg-black/10 border-black/10 text-white', barColor: '#FFFFFF', iconBg: 'bg-black/20', iconColor: 'text-white' },
};

// ═══════════════════════════════════════════════════════════════
// CSS keyframes — injected once, no external stylesheet
// ═══════════════════════════════════════════════════════════════
const WIDGET_STYLES = `
@keyframes vw-bar-idle {
    0%, 100% { height: 6px; }
    50% { height: var(--bar-max, 14px); }
}
@keyframes vw-bar-wake {
    0%, 100% { height: 8px; }
    50% { height: var(--bar-max, 28px); }
}
@keyframes vw-bar-matched {
    0%, 100% { height: 14px; }
    50% { height: var(--bar-max, 32px); }
}
@keyframes vw-bar-playing {
    0%, 100% { height: 10px; }
    50% { height: var(--bar-max, 24px); }
}
@keyframes vw-pulse-border {
    0%, 100% { border-color: #3B82F6; }
    50% { border-color: #7C3AED; }
}
.vw-idle .vw-bar { animation: vw-bar-idle 1.8s ease-in-out infinite; }
.vw-wake .vw-bar { animation: vw-bar-wake 0.6s ease-in-out infinite; }
.vw-matched .vw-bar { animation: vw-bar-matched 0.4s ease-in-out infinite; }
.vw-playing .vw-bar { animation: vw-bar-playing 0.9s ease-in-out infinite; }
`;

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

    const [isEditingWake, setIsEditingWake] = useState(false);
    const [wakeWordDraft, setWakeWordDraft] = useState(copilot.wakeWord);
    const wakeInputRef = useRef(null);
    const [showCommands, setShowCommands] = useState(false);

    // ── Inject CSS once ──
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById('vw-styles')) return;
        const style = document.createElement('style');
        style.id = 'vw-styles';
        style.textContent = WIDGET_STYLES;
        document.head.appendChild(style);
    }, []);

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

    const [showCalibrator, setShowCalibrator] = useState(false);

    const handleOrbClick = () => {
        if (!copilot.isActive && !copilot.tfjsIsCalibrated) {
            setShowCalibrator(true);
        } else {
            copilot.handleToggle();
        }
    };

    // ── Derived UI ──
    const S = VOICE_STATES[copilot.voiceState] || VOICE_STATES.off;
    const playablePois = copilot.voiceCommands.length;
    const BAR_HEIGHTS = [14, 22, 28, 22, 14];

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════
    if (!copilot.supported) {
        return (
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.03)] p-5 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <MicOff size={18} className="text-slate-400" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-slate-800">Sistema de Narración</p>
                        <p className="text-[11px] text-slate-400">Tu navegador no soporta reconocimiento de voz.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-[28px] border-2 overflow-hidden mb-6 transition-all duration-500 relative ${S.container}`}>
            {/* Modal de Calibración TFJS */}
            <TFCalibratorModal 
                isOpen={showCalibrator}
                collectExample={copilot.collectExample}
                trainModel={copilot.trainModel}
                onCalibrationComplete={() => {
                    setShowCalibrator(false);
                    copilot.handleToggle(); // Activar IA después de calibrar
                }}
            />
            {/* ── HEADER ROW ── */}
            <div className="p-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${S.iconBg}`}>
                            {copilot.isActive
                                ? <Mic size={18} className={S.iconColor} strokeWidth={2.5} />
                                : <MicOff size={18} className={S.iconColor} strokeWidth={2} />
                            }
                        </div>
                        <div>
                            <p className={`text-[13px] font-black uppercase tracking-wider transition-colors duration-300 ${S.textPrimary}`}>
                                Sistema de Narración
                            </p>
                            <p className={`text-[11px] font-medium transition-colors duration-300 ${S.textSecondary}`}>
                                {copilot.isActive ? S.label : `${playablePois} narrativa${playablePois !== 1 ? 's' : ''} disponible${playablePois !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>

                    {/* ON/OFF Toggle */}
                    <button
                        onClick={copilot.handleToggle}
                        className={`relative w-[72px] h-[38px] rounded-full transition-all duration-500 active:scale-95 ${
                            copilot.isActive
                                ? (copilot.voiceState !== 'idle' && copilot.voiceState !== 'off' ? 'bg-black/20' : 'bg-gradient-to-r from-[#2563eb] to-[#4338ca] shadow-[0_4px_16px_rgba(37,99,235,0.3)]')
                                : 'bg-slate-200'
                        }`}
                    >
                        <div className={`absolute top-[3px] w-[32px] h-[32px] rounded-full bg-white shadow-md transition-all duration-500 flex items-center justify-center ${
                            copilot.isActive ? 'left-[37px]' : 'left-[3px]'
                        }`}>
                            {copilot.isActive
                                ? <Volume2 size={14} className={copilot.voiceState !== 'idle' && copilot.voiceState !== 'off' ? 'text-slate-800' : 'text-blue-600'} strokeWidth={2.5} />
                                : <MicOff size={14} className="text-slate-400" strokeWidth={2} />
                            }
                        </div>
                    </button>
                </div>

                {/* Error Banner */}
                {copilot.errorMsg && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-3 flex items-start gap-2 shadow-sm">
                        <span className="text-red-500 text-sm mt-0.5">⚠️</span>
                        <p className="text-[11px] text-red-600 font-medium leading-relaxed">{copilot.errorMsg}</p>
                        <button onClick={() => copilot.setErrorMsg(null)} className="ml-auto text-red-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── EXPANDED CONTENT (only when active) ── */}
            {copilot.isActive && (
                <div className="px-5 pb-5 space-y-4">
                    {/* ── SOUNDWAVE VISUALIZER ── */}
                    <div className="flex flex-col items-center gap-3">
                        <div className={`flex items-end justify-center gap-[5px] h-[40px] ${S.barClass}`}>
                            {BAR_HEIGHTS.map((maxH, i) => (
                                <div
                                    key={i}
                                    className="vw-bar w-[5px] rounded-full transition-colors duration-300"
                                    style={{
                                        '--bar-max': `${maxH}px`,
                                        animationDelay: `${i * 0.12}s`,
                                        height: '6px',
                                        background: S.barColor,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Live transcript pill */}
                        {copilot.lastTranscript && (
                            <div className={`rounded-full px-4 py-1.5 max-w-[280px] truncate border transition-colors duration-300 ${S.pillBg}`}>
                                <p className={`text-[11px] font-medium italic truncate transition-colors duration-300 ${S.textSecondary}`}>
                                    &ldquo;{copilot.lastTranscript}&rdquo;
                                </p>
                            </div>
                        )}

                        {/* Matched POI feedback */}
                        {copilot.matchedPoi && (copilot.voiceState === 'matched' || copilot.voiceState === 'playing') && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 bg-white/20 border-white/30 text-white shadow-sm">
                                <span className="text-sm">{copilot.voiceState === 'matched' ? '✅' : '🔊'}</span>
                                <p className="text-[12px] font-bold truncate max-w-[200px]">{copilot.matchedPoi.name}</p>
                            </div>
                        )}
                    </div>

                    {/* ── WAKE WORD CONFIGURATOR ── */}
                    <div className={`rounded-2xl border p-4 transition-colors duration-300 ${S.pillBg}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 transition-colors duration-300 ${S.textMuted}`}>
                            Palabra Mágica
                        </p>

                        {isEditingWake ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={wakeInputRef}
                                    type="text"
                                    value={wakeWordDraft}
                                    onChange={(e) => setWakeWordDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveWakeWordLocal(); if (e.key === 'Escape') { setIsEditingWake(false); setWakeWordDraft(copilot.wakeWord); }}}
                                    className="flex-1 bg-white border-2 border-blue-400 rounded-xl px-3 py-2 text-[15px] font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                    maxLength={20}
                                    placeholder="ej. Jarvis"
                                />
                                <button onClick={saveWakeWordLocal} className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center active:scale-95 transition-all shadow-sm">
                                    <Check size={18} strokeWidth={3} />
                                </button>
                                <button onClick={() => { setIsEditingWake(false); setWakeWordDraft(copilot.wakeWord); }} className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center active:scale-95 transition-all">
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setWakeWordDraft(copilot.wakeWord); setIsEditingWake(true); }}
                                className="flex items-center gap-2 group w-full"
                            >
                                <span className={`text-[18px] font-black tracking-tight transition-colors duration-300 ${S.textPrimary}`}>
                                    &ldquo;{copilot.wakeWord}&rdquo;
                                </span>
                                <Pencil size={14} className={`transition-colors opacity-50 group-hover:opacity-100 ${S.textPrimary}`} />
                            </button>
                        )}

                        <p className={`text-[10px] mt-2 leading-relaxed transition-colors duration-300 ${S.textMuted}`}>
                            Incluye esta palabra en tu frase y nombra una narrativa. Ejemplo: &ldquo;Niños, preguntémosle a la {copilot.wakeWord} sobre…&rdquo;
                        </p>
                    </div>

                    {/* ── AVAILABLE COMMANDS LIST (collapsible) ── */}
                    <div>
                        <button
                            onClick={() => setShowCommands(!showCommands)}
                            className="flex items-center gap-2 w-full text-left group"
                        >
                            <p className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${S.textMuted}`}>
                                Comandos Disponibles ({playablePois})
                            </p>
                            {showCommands
                                ? <ChevronUp size={14} className={S.textMuted} />
                                : <ChevronDown size={14} className={S.textMuted} />
                            }
                        </button>

                        {showCommands && (
                            <div className="mt-3 space-y-1.5 max-h-[160px] overflow-y-auto">
                                {copilot.voiceCommands.length === 0 ? (
                                    <p className={`text-[11px] italic py-2 ${S.textMuted}`}>No hay narrativas con audio.</p>
                                ) : (
                                    copilot.voiceCommands.map(cmd => (
                                        <div key={cmd.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors duration-300 ${S.pillBg}`}>
                                            <span className="text-[11px]">🗣️</span>
                                            <span className="text-[12px] font-bold truncate flex-1 opacity-90">
                                                &ldquo;{cmd.keywords.join(', ')}&rdquo;
                                            </span>
                                            <span className={`text-[10px] truncate max-w-[120px] opacity-70`}>{cmd.name}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
