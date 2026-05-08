'use client';

import { useState } from 'react';

// ── Checklist: Docente (ISA) ──
const DOCENTE_CHECKLIST = {
    menciona_nombre_equipo: { label: 'Nombre del equipo', failMsg: 'no mencionó el nombre del equipo', passMsg: 'mencionó el nombre del equipo' },
    menciona_destino: { label: 'Destino del vuelo', failMsg: 'no mencionó el destino', passMsg: 'mencionó el destino del vuelo' },
    dinamica_sube_sube: { label: '¡Sube Sube!', failMsg: 'no realizó la dinámica ¡Sube Sube!', passMsg: 'realizó la dinámica ¡Sube Sube!' },
    energia_positiva: { label: 'Energía positiva', failMsg: 'no transmitió energía positiva', passMsg: 'transmitió energía positiva' },
    participacion_ninos_audible: { label: 'Participación niños', failMsg: 'no se escuchó participación de los niños', passMsg: 'se escuchó participación de los niños' }
};

// ── Checklist: Piloto ──
const PILOT_CHECKLIST = {
    menciona_destino: { label: 'Dato educativo/geográfico', failMsg: 'no mencionó datos educativos o geográficos', passMsg: 'mencionó datos educativos o geográficos' },
    energia_positiva: { label: 'Energía positiva', failMsg: 'no transmitió energía positiva', passMsg: 'transmitió energía positiva' },
    fomenta_interaccion: { label: 'Fomenta interacción', failMsg: 'no fomentó la interacción con los niños', passMsg: 'fomentó la interacción con los niños' },
    participacion_ninos_audible: { label: 'Participación niños', failMsg: 'no se escuchó participación de los niños', passMsg: 'se escuchó participación de los niños' }
};

const ENERGY_COLORS = {
    alta: { text: '#4ADE80', label: 'Alta' },
    media: { text: '#FACC15', label: 'Media' },
    baja: { text: '#F87171', label: 'Baja' }
};

function scoreColor(s) { if (s >= 80) return '#4ADE80'; if (s >= 60) return '#FACC15'; if (s >= 40) return '#FB923C'; return '#F87171'; }
function scoreBg(s) { if (s >= 80) return 'rgba(74,222,128,0.12)'; if (s >= 60) return 'rgba(250,204,21,0.12)'; if (s >= 40) return 'rgba(251,146,60,0.12)'; return 'rgba(248,113,113,0.12)'; }
function scoreGrade(s) { if (s >= 90) return 'Excelente'; if (s >= 75) return 'Bien'; if (s >= 60) return 'Regular'; if (s >= 40) return 'Bajo'; return 'Crítico'; }

function fmtMMSS(sec) { if (!sec || isNaN(sec)) return '00:00'; return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${Math.floor(sec % 60).toString().padStart(2, '0')}`; }
function fmtClock(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' }); } catch (_e) { return ''; } }

function getChecklistForAudit(audit) {
    if (!audit) return DOCENTE_CHECKLIST;
    return audit.source === 'pilot_narration' ? PILOT_CHECKLIST : DOCENTE_CHECKLIST;
}

function getRoleName(audit, isaName) {
    if (!audit) return isaName || 'La docente';
    if (audit.source === 'pilot_narration') return 'El piloto';
    return isaName || 'La docente';
}

function getRoleLabel(audit) {
    if (!audit) return 'Docente';
    return audit.source === 'pilot_narration' ? 'Piloto' : 'Docente';
}

function buildMiniReport(audit, isaName) {
    if (!audit || audit.status !== 'completed' || audit.score === null) return null;
    const checklist = getChecklistForAudit(audit);
    const name = getRoleName(audit, isaName);
    const passed = [];
    const failed = [];
    Object.entries(checklist).forEach(([key, cfg]) => {
        if (audit[key] === true) passed.push(cfg);
        else if (audit[key] === false) failed.push(cfg);
    });

    const grade = scoreGrade(audit.score);
    const energyKey = audit.energia_interaccion;
    const energyLabel = ENERGY_COLORS[energyKey]?.label?.toLowerCase() || null;

    let report = `${name} obtuvo una calificación ${grade.toLowerCase()} (${audit.score}/100).`;
    if (passed.length > 0) {
        const passNames = passed.map(p => p.passMsg);
        if (passNames.length <= 2) report += ` ${capitalize(passNames.join(' y '))}.`;
        else report += ` ${capitalize(passNames.slice(0, -1).join(', '))} y ${passNames[passNames.length - 1]}.`;
    }
    if (failed.length > 0) {
        const failNames = failed.map(f => f.failMsg);
        if (failNames.length === 1) report += ` Sin embargo, ${failNames[0]}.`;
        else report += ` Sin embargo, ${failNames.slice(0, -1).join(', ')} y ${failNames[failNames.length - 1]}.`;
    }
    if (energyLabel) report += ` Su energía vocal fue ${energyLabel}.`;
    return report;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function UnifiedFlightCard({
    flightNumber, teamName, destinations,
    audioUrl, audioSizeKB, audioDurationSeconds,
    timestamp, audit, isaName
}) {
    const [isRetrying, setIsRetrying] = useState(false);
    const [retrySuccess, setRetrySuccess] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            const res = await fetch('/api/staff/analyze-audio', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auditId: audit.id, audioUrl: audioUrl, journeyId: audit.journey_id, flightNumber, audioDurationSeconds })
            });
            const data = await res.json();
            if (data.ok) setRetrySuccess(true); else alert('Falló: ' + data.error);
        } catch (_e) { alert('Error de red.'); }
        finally { setIsRetrying(false); }
    };

    const hasAudio = !!audioUrl;
    const audioRoleLabel = audit?.source === 'pilot_narration' ? 'Piloto' : 'Docente';
    const audioRoleColor = audit?.source === 'pilot_narration' ? 'text-sky-400' : 'text-violet-400';
    const isAuditOk = audit && audit.status === 'completed' && audit.score !== null;
    const needsAttention = isAuditOk && audit.score < 60;

    // Select the correct checklist based on the audit's source
    const checklist = getChecklistForAudit(audit);
    const roleLabel = getRoleLabel(audit);
    const passedCount = isAuditOk ? Object.keys(checklist).filter(k => audit[k] === true).length : 0;
    const totalCriteria = Object.keys(checklist).length;
    const energyKey = audit?.energia_interaccion;
    const energyInfo = ENERGY_COLORS[energyKey] || null;
    const miniReport = isAuditOk ? buildMiniReport(audit, isaName) : null;

    // Role-based accent color
    const roleAccent = audit?.source === 'pilot_narration' ? '#38BDF8' : '#A78BFA';

    return (
        <div className={`rounded-xl border overflow-hidden shadow-md backdrop-blur-sm transition-all duration-300 ${needsAttention ? 'border-rose-500/30 bg-slate-900/60' : 'border-white/5 bg-slate-900/40 hover:border-white/10'}`}>
            {/* HEADER COMPACTO Y ELÁSTICO */}
            <div className={`px-4 py-3 flex flex-row items-start justify-between border-b gap-3 ${needsAttention ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/50 border-white/5'}`}>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[16px] font-black text-indigo-300/80 tracking-tighter">#{flightNumber}</span>
                        <h3 className="text-[14px] font-bold text-white whitespace-normal break-words leading-tight">
                            {teamName ? `"${teamName}"` : 'Sin equipo'}
                        </h3>
                    </div>
                    {/* Role badge */}
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded w-fit" style={{ color: roleAccent, background: `${roleAccent}15`, border: `1px solid ${roleAccent}30` }}>
                        {roleLabel}
                    </span>
                </div>

                {isAuditOk && (
                    <div className="flex items-baseline gap-0.5 px-2.5 py-1 rounded-md border shadow-inner mt-0.5 flex-shrink-0" style={{ background: scoreBg(audit.score), borderColor: `${scoreColor(audit.score)}40`, color: scoreColor(audit.score) }}>
                        <span className="text-[16px] font-black leading-none tracking-tight">{audit.score}</span>
                        <span className="text-[10px] font-bold opacity-70 leading-none">/100</span>
                    </div>
                )}
            </div>

            {/* BODY COMPACTO */}
            <div className="px-3 py-2">
                {/* Audio player */}
                <div className="flex flex-col gap-1.5">
                    {hasAudio && (
                        <div className="flex items-center gap-2 bg-slate-950/40 rounded border border-slate-800/60 px-2 py-1 shadow-inner">
                            <div className="flex flex-col justify-center w-16 flex-shrink-0">
                                <span className={`text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 ${audioRoleColor}`}>
                                    <span className="material-symbols-outlined text-[11px]">mic</span> {audioRoleLabel}
                                </span>
                                {audioDurationSeconds > 0 && <span className="text-[8px] text-slate-500 font-medium">{fmtMMSS(audioDurationSeconds)}</span>}
                            </div>
                            <audio controls preload="none" className="flex-1 h-6 opacity-70 hover:opacity-100 transition-opacity" style={{ filter: 'invert(1) hue-rotate(180deg)' }}>
                                <source src={audioUrl} type="audio/webm" />
                            </audio>
                        </div>
                    )}
                </div>

                {!hasAudio && <p className="text-[10px] text-slate-500 italic py-1 text-center">Sin registros de audio.</p>}

                {/* ── Mini Reporte IA ── */}
                {miniReport && (
                    <div className="mt-2 rounded bg-slate-800/30 p-2.5 border border-white/5 flex flex-col gap-1" style={{ borderLeft: `2px solid ${scoreColor(audit.score)}` }}>
                        <p className="text-[11px] text-slate-300 leading-relaxed m-0 font-medium whitespace-normal break-words">{miniReport}</p>
                        {audit.feedback_para_isa && (
                            <div className="flex items-start gap-1.5 mt-1 border-l-2 border-indigo-500/20 pl-2">
                                <span className="material-symbols-outlined text-[12px] text-indigo-400/80 mt-0.5">chat</span>
                                <p className="text-[10px] text-indigo-300/80 italic m-0 leading-relaxed font-medium whitespace-normal break-words">
                                    "{audit.feedback_para_isa}"
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FOOTER */}
            {audit && (
                <div className="border-t border-white/5 bg-slate-900/80">
                    {(audit.status === 'failed' || audit.status === 'parse_failed') ? (
                        <div className="px-3 py-2 flex items-center justify-between gap-3 bg-rose-500/5">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[14px] text-rose-400">error</span>
                                <span className="text-[10px] font-bold text-rose-400">Error IA: {audit.error_message || 'Fallo'}</span>
                            </div>
                            <button onClick={handleRetry} disabled={isRetrying || retrySuccess} className="px-2 py-1 rounded bg-rose-500/10 text-rose-300 text-[9px] font-bold border border-rose-500/20 hover:bg-rose-500/20 flex items-center gap-1 transition-colors">
                                <span className={`material-symbols-outlined text-[12px] ${isRetrying ? 'animate-spin' : ''}`}>{retrySuccess ? 'check' : 'refresh'}</span>
                                {retrySuccess ? 'OK' : 'Reintentar'}
                            </button>
                        </div>
                    ) : isAuditOk && (
                        <div className="px-3 py-2 flex flex-col">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="font-bold text-slate-300">{passedCount}/{totalCriteria} criterios cumplidos</span>
                                    {energyInfo && (
                                        <>
                                            <span className="text-slate-600">|</span>
                                            <span style={{ color: energyInfo.text }} className="font-bold flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[12px]">bolt</span> {energyInfo.label}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <button onClick={() => setShowChecklist(!showChecklist)} className="text-indigo-400 font-bold hover:text-indigo-300 text-[10px] flex items-center gap-0.5 transition-colors">
                                    {showChecklist ? 'Cerrar' : 'Ver checklist'}
                                    <span className={`material-symbols-outlined text-[14px] transition-transform ${showChecklist ? 'rotate-180' : ''}`}>expand_more</span>
                                </button>
                            </div>

                            {showChecklist && (
                                <div className="mt-2.5 grid grid-cols-2 gap-1.5 p-2 bg-black/20 rounded-lg border border-white/5 shadow-inner">
                                    {Object.entries(checklist).map(([key, config]) => {
                                        const val = audit[key];
                                        const isPass = val === true;
                                        const isFail = val === false;
                                        return (
                                            <div key={key} className={`flex items-center gap-1.5 text-[10px] font-medium ${isPass ? 'text-emerald-400/90' : isFail ? 'text-rose-400/90' : 'text-slate-500'}`}>
                                                <span className="material-symbols-outlined text-[13px]">
                                                    {isPass ? 'check_circle' : isFail ? 'cancel' : 'remove'}
                                                </span>
                                                <span className="truncate">{config.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
