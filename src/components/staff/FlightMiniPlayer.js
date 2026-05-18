'use client';

import { Music, Play, Pause, SkipForward, Loader2, AlertCircle, Headphones } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// FlightMiniPlayer — Compact audio player for the cockpit
// ═══════════════════════════════════════════════════════════════
// Positioned directly below the CopilotOrbUI to form
// a unified "Media Station" in the operation screen.
//
// Primary mode: visual-only (shows current track info)
// Secondary mode: manual override controls (play/pause/skip)
// ═══════════════════════════════════════════════════════════════

const PHASE_LABELS = {
    boarding: { label: 'Abordaje', emoji: '🎵', gradient: 'from-sky-500/20 to-blue-500/20', border: 'border-sky-500/30', text: 'text-sky-300' },
    in_flight: { label: 'En Vuelo', emoji: '🚀', gradient: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/30', text: 'text-violet-300' },
};

export default function FlightMiniPlayer({
    flightPhase = 'cold',
    currentTrack = null,
    isPlaying = false,
    isLoading = false,
    hasError = false,
    onTogglePlayPause,
    onSkipTrack,
    isPeripheralActive = false,
}) {
    // Don't render when audio engine is cold (not yet prepared)
    if (flightPhase === 'cold') return null;

    const phaseConfig = PHASE_LABELS[flightPhase] || PHASE_LABELS.boarding;
    const trackTitle = currentTrack?.title || 'Sin pista';
    const trackArtist = currentTrack?.artist || '';

    return (
        <div className={`w-full max-w-[280px] mx-auto mt-1 mb-1 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2`}>
            <div className="relative px-3 py-2 transition-all duration-500">
                <div className="flex items-center gap-2.5">
                    {/* ── Equalizer / Status Icon ── */}
                    <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isPeripheralActive 
                            ? 'bg-white/10' 
                            : 'bg-slate-100'
                    }`}>
                        {isLoading ? (
                            <Loader2 size={14} className={`animate-spin ${isPeripheralActive ? 'text-white/70' : 'text-slate-400'}`} />
                        ) : hasError ? (
                            <AlertCircle size={14} className="text-amber-400" />
                        ) : isPlaying ? (
                            // Animated equalizer bars
                            <div className="flex items-end gap-[2px] h-3">
                                {[1, 2, 3].map(i => (
                                    <div 
                                        key={i}
                                        className={`w-[3px] rounded-full ${isPeripheralActive ? 'bg-white/80' : 'bg-violet-500'}`}
                                        style={{
                                            animation: `equalizerBounce ${0.4 + i * 0.15}s ease-in-out infinite alternate`,
                                            height: `${4 + i * 3}px`
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Music size={14} className={`${isPeripheralActive ? 'text-white/50' : 'text-slate-400'}`} />
                        )}
                    </div>

                    {/* ── Track Info ── */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold truncate leading-tight transition-colors duration-300 ${
                            isPeripheralActive ? 'text-white/90' : 'text-slate-700'
                        }`}>
                            {trackTitle}
                        </p>
                        <p className={`text-[9px] font-semibold uppercase tracking-wider truncate transition-colors duration-300 ${
                            isPeripheralActive ? phaseConfig.text : 'text-slate-400'
                        }`}>
                            {phaseConfig.emoji} {phaseConfig.label}
                            {trackArtist && ` · ${trackArtist}`}
                        </p>
                    </div>

                    {/* ── Manual Controls (Plan B) ── */}
                    <div className="shrink-0 flex items-center gap-1">
                        <button
                            onClick={onTogglePlayPause}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 ${
                                isPeripheralActive 
                                    ? 'hover:bg-white/10 text-white/70 hover:text-white' 
                                    : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                            }`}
                            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                        >
                            {isPlaying 
                                ? <Pause size={12} strokeWidth={2.5} /> 
                                : <Play size={12} strokeWidth={2.5} className="ml-[1px]" />
                            }
                        </button>
                        <button
                            onClick={onSkipTrack}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 ${
                                isPeripheralActive 
                                    ? 'hover:bg-white/10 text-white/50 hover:text-white' 
                                    : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                            }`}
                            aria-label="Siguiente pista"
                        >
                            <SkipForward size={11} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Equalizer Animation Keyframes ── */}
            <style jsx>{`
                @keyframes equalizerBounce {
                    0% { height: 3px; }
                    100% { height: 12px; }
                }
            `}</style>
        </div>
    );
}
