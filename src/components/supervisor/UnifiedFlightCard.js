'use client';

import { useState } from 'react';

const CHECKLIST_LABELS = {
    menciona_nombre_equipo: { label: 'Nombre del equipo', emoji: '✋' },
    menciona_destino: { label: 'Mención del destino', emoji: '🗺️' },
    dinamica_sube_sube: { label: 'Dinámica ¡Sube Sube!', emoji: '🚀' },
    participacion_ninos_audible: { label: 'Participación de niños', emoji: '👧' }
};

const ENERGY_COLORS = {
    alta: { bg: '#DCFCE7', text: '#16A34A', label: 'Alta' },
    media: { bg: '#FEF9C3', text: '#CA8A04', label: 'Media' },
    baja: { bg: '#FEE2E2', text: '#DC2626', label: 'Baja' }
};

function scoreColor(score) {
    if (score >= 80) return '#16A34A';
    if (score >= 60) return '#CA8A04';
    if (score >= 40) return '#EA580C';
    return '#DC2626';
}

function scoreBg(score) {
    if (score >= 80) return '#F0FDF4';
    if (score >= 60) return '#FEFCE8';
    if (score >= 40) return '#FFF7ED';
    return '#FEF2F2';
}

function fmtMMSS(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function fmtClock(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });
    } catch { return ''; }
}

export default function UnifiedFlightCard({
    flightNumber,
    teamName,
    destinations,
    audioUrl,
    audioSizeKB,
    audioDurationSeconds,
    timestamp,
    audit // The QA data object from AudioQualityWidget if it exists
}) {
    // If there's an audit and score is < 60, start expanded to draw attention
    const [isExpanded, setIsExpanded] = useState(audit && audit.score !== null && audit.score < 60);
    const [isRetrying, setIsRetrying] = useState(false);
    const [retrySuccess, setRetrySuccess] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            const res = await fetch('/api/staff/analyze-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auditId: audit.id,
                    audioUrl: audioUrl,
                    journeyId: audit.journey_id,
                    flightNumber: flightNumber,
                    audioDurationSeconds: audioDurationSeconds
                })
            });
            const data = await res.json();
            if (data.ok) {
                setRetrySuccess(true);
            } else {
                alert('Falló el reintento: ' + data.error);
            }
        } catch (e) {
            alert('Error de red al reintentar.');
        } finally {
            setIsRetrying(false);
        }
    };

    return (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden mb-3 shadow-sm">
            {/* ── HEADER ── */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/60">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center size-6 rounded-md bg-violet-500/15 text-[10px] font-black text-violet-300 flex-shrink-0">
                            #{flightNumber}
                        </span>
                        <h3 className="text-sm font-extrabold text-white truncate">
                            {teamName ? `"${teamName}"` : 'Sin nombre de equipo'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 ml-8">
                        {timestamp && (
                            <p className="text-[10px] text-slate-500">{fmtClock(timestamp)}</p>
                        )}
                        {audit?.source === 'pilot_narration' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/20">✈️ Piloto</span>
                        ) : audit?.source === 'bitacora' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/20">🎓 Docente</span>
                        ) : null}
                    </div>
                </div>

                {audit && audit.status === 'completed' && audit.score !== null && (
                    <div
                        className="flex items-center justify-center px-2 py-1 rounded-md flex-shrink-0 border gap-1.5 shadow-sm"
                        style={{
                            background: scoreBg(audit.score),
                            borderColor: `${scoreColor(audit.score)}40`,
                            color: scoreColor(audit.score)
                        }}
                        title={`Calificación de la IA: ${audit.score}/100`}
                    >
                        <span className="text-[10px] font-extrabold tracking-widest uppercase opacity-75">🤖 SCORE IA</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-[14px] font-black leading-none tabular-nums tracking-tight">{audit.score}</span>
                            <span className="text-[9px] font-bold opacity-60 leading-none">/100</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── BODY (Bitácora & Audio) ── */}
            <div className="px-4 py-3 space-y-3">
                {/* Destinos */}
                {destinations && (
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-sm text-sky-400/80 mt-0.5 flex-shrink-0">map</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{destinations}</p>
                    </div>
                )}

                {/* Audio Telemetry */}
                {audioUrl && (
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px] text-violet-400">mic</span>
                                Telemetría
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 tabular-nums">
                                {audioDurationSeconds > 0 && <span>{fmtMMSS(audioDurationSeconds)}</span>}
                                {audioSizeKB > 0 && <span>{audioSizeKB}KB</span>}
                            </div>
                        </div>
                        <audio
                            controls
                            preload="none"
                            className="w-full h-8"
                            style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.8 }}
                        >
                            <source src={audioUrl} type="audio/webm" />
                            Tu navegador no soporta audio.
                        </audio>
                    </div>
                )}

                {(!destinations && !audioUrl) && (
                    <p className="text-xs text-slate-500 italic">No hay datos de bitácora ni audio para esta tanda.</p>
                )}
            </div>

            {/* ── FOOTER (AI Audit Breakdown) ── */}
            {audit && (
                <div className="border-t border-slate-700/50">
                    {(audit.status === 'failed' || audit.status === 'parse_failed') ? (
                        <div className="px-4 py-3 bg-rose-500/10 flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-sm text-rose-400 mt-0.5">error</span>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-rose-400">La IA no pudo analizar este audio</p>
                                    <p className="text-[10px] text-rose-300/70 mt-0.5 leading-tight">{audit.error_message || 'Servidor ocupado'}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleRetry}
                                disabled={isRetrying || retrySuccess}
                                className="self-start mt-1 px-3 py-1.5 rounded-md bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30 hover:bg-rose-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <span className={`material-symbols-outlined text-[14px] ${isRetrying ? 'animate-spin' : ''}`}>
                                    {retrySuccess ? 'check_circle' : 'refresh'}
                                </span>
                                {retrySuccess ? 'Enviado, actualiza la página' : isRetrying ? 'Reintentando...' : 'Forzar Reintento Manual'}
                            </button>
                        </div>
                    ) : audit.status === 'completed' && (
                        <>
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:bg-slate-700/30 transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-amber-400">smart_toy</span>
                                    Evaluación de Calidad IA
                                </span>
                                <span className={`material-symbols-outlined text-sm text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="px-4 pb-4 pt-1 bg-slate-800/20">
                                    {/* Checklist */}
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-3">
                                        {Object.entries(CHECKLIST_LABELS).map(([key, config]) => {
                                            const val = audit[key];
                                            const isPass = val === true;
                                            const isFail = val === false;
                                            return (
                                                <div key={key} className={`flex items-center gap-1.5 text-[11px] font-bold ${isPass ? 'text-emerald-400' : isFail ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    <span>{isPass ? '✅' : isFail ? '❌' : '❓'}</span>
                                                    <span className="truncate">{config.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Energy Badge */}
                                    {audit.energia_interaccion && audit.energia_interaccion !== 'no_detectado' && (
                                        <div
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold mb-3"
                                            style={{
                                                background: ENERGY_COLORS[audit.energia_interaccion]?.bg || '#F1F5F9',
                                                color: ENERGY_COLORS[audit.energia_interaccion]?.text || '#64748B'
                                            }}
                                        >
                                            ⚡ Energía {ENERGY_COLORS[audit.energia_interaccion]?.label || audit.energia_interaccion}
                                        </div>
                                    )}

                                    {/* Supervisor Summary */}
                                    {audit.resumen_supervisor && (
                                        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50 mb-2">
                                            <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                                <span className="mr-1.5">📋</span>{audit.resumen_supervisor}
                                            </p>
                                        </div>
                                    )}

                                    {/* Feedback to ISA */}
                                    {audit.feedback_para_isa && (
                                        <p className="text-[11px] text-violet-300 leading-relaxed font-semibold italic bg-violet-500/10 rounded px-2 py-1.5 border border-violet-500/20">
                                            💬 Feedback a ISA: "{audit.feedback_para_isa}"
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
