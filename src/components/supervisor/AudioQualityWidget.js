'use client';

// =====================================================
// AudioQualityWidget.js — V3 (Plan de Implementación Aprobado)
// Contextual Metrics, Global Narrative & Progress Bars
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import UnifiedFlightCard from './UnifiedFlightCard';

const CHECKLIST_LABELS = {
    menciona_nombre_equipo: { label: 'Mencionó el nombre del equipo', icon: 'badge', action: 'mencionar al equipo', failMsg: 'no mencionó el equipo', passMsg: 'mencionó el equipo' },
    menciona_destino: { label: 'Anunció el destino del vuelo', icon: 'explore', action: 'anunciar el destino', failMsg: 'no mencionó el destino', passMsg: 'mencionó el destino' },
    dinamica_sube_sube: { label: 'Realizó la dinámica ¡Sube Sube!', icon: 'flight_takeoff', action: 'realizar la dinámica Sube Sube', failMsg: 'no realizó la dinámica Sube Sube', passMsg: 'realizó la dinámica Sube Sube' },
    energia_positiva: { label: 'Transmitió energía positiva', icon: 'mood', action: 'transmitir energía positiva', failMsg: 'no transmitió energía positiva', passMsg: 'transmitió energía positiva' },
    participacion_ninos_audible: { label: 'Logró participación de los niños', icon: 'groups', action: 'lograr la participación de los niños', failMsg: 'no logró participación de los niños', passMsg: 'logró participación de los niños' }
};

const ENERGY_COLORS = {
    alta: { bg: 'rgba(34,197,94,0.15)', text: '#4ADE80', label: 'Alta' },
    media: { bg: 'rgba(234,179,8,0.15)', text: '#FACC15', label: 'Media' },
    baja: { bg: 'rgba(239,68,68,0.15)', text: '#F87171', label: 'Baja' }
};

function scoreColor(s) { if (s >= 80) return '#4ADE80'; if (s >= 60) return '#FACC15'; if (s >= 40) return '#FB923C'; return '#F87171'; }
function scoreGrade(s) { if (s >= 90) return 'Excelente'; if (s >= 75) return 'Bien'; if (s >= 60) return 'Regular'; if (s >= 40) return 'Bajo'; return 'Crítico'; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildGlobalNarrative(summary, name) {
    if (!summary || summary.totalAudited === 0) return null;
    const passed = [];
    const failed = [];
    Object.entries(CHECKLIST_LABELS).forEach(([key, cfg]) => {
        const rate = summary.checklist[key].rate;
        if (rate >= 60) passed.push(cfg.action);
        else failed.push(cfg.action);
    });

    const grade = scoreGrade(summary.avgScore);
    let report = `En las últimas ${summary.totalAudited} misiones, ${name} obtuvo una calificación global ${grade.toLowerCase()}.`;
    
    if (passed.length > 0) {
        if (passed.length <= 2) report += ` Demostró dominio al ${passed.join(' y ')}.`;
        else report += ` Demostró dominio al ${passed.slice(0, -1).join(', ')} y ${passed[passed.length - 1]}.`;
    }
    if (failed.length > 0) {
        if (failed.length === 1) report += ` Su principal área de oportunidad es ${failed[0]}.`;
        else report += ` Requiere atención urgente para ${failed.slice(0, -1).join(', ')} y ${failed[failed.length - 1]}.`;
    }
    return report;
}

function buildNarrative(alert, isaName, audits) {
    const name = isaName || 'la Docente';
    const grade = scoreGrade(alert.score);
    const audit = (audits || []).find(a => a.id === alert.id);
    if (!audit) return { headline: `La calificación de ${name} fue ${grade.toLowerCase()}.`, failedNames: [], details: [], tip: alert.feedback };

    const failed = [];
    const passed = [];
    Object.entries(CHECKLIST_LABELS).forEach(([key, cfg]) => {
        if (audit[key] === true) passed.push({ ...cfg, ok: true });
        else if (audit[key] === false) failed.push({ ...cfg, ok: false });
    });

    const energyKey = audit.energia_interaccion;
    const energyLabel = ENERGY_COLORS[energyKey]?.label || null;

    let headline = `La calificación de ${name} fue ${grade.toLowerCase()}.`;
    if (energyLabel) headline += ` Su energía vocal fue ${energyLabel.toLowerCase()}`;
    if (failed.length > 0) {
        const failNames = failed.map(f => f.failMsg);
        if (failed.length === 1) {
            headline += `${energyLabel ? ' y' : ''} ${failNames[0]} (1 de ${failed.length + passed.length} fallado).`;
        } else {
            const last = failNames.pop();
            headline += `${energyLabel ? ',' : ''} ${failNames.join(', ')} y ${last} (${failed.length} de ${failed.length + passed.length} fallados).`;
        }
    } else {
        headline += '.';
    }

    const details = [...failed.map(f => ({ ok: false, text: capitalize(f.failMsg) })), ...passed.map(p => ({ ok: true, text: capitalize(p.passMsg) }))];
    const tip = audit.feedback_para_isa || alert.feedback || null;
    return { headline, details, tip };
}

export default function AudioQualityWidget({ journeyId, journeyIds, date, style, hideDetails = false, parsedMeta = null, isaName = null }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alertsExpanded, setAlertsExpanded] = useState(null);
    const [isGlobalReportOpen, setIsGlobalReportOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const idsToFetch = (Array.isArray(journeyIds) && journeyIds.length > 0) ? journeyIds : (journeyId ? [journeyId] : []);

            if (idsToFetch.length > 0) {
                const responses = await Promise.all(idsToFetch.map(id => fetch(`/api/admin/audio-quality?journeyId=${id}`).then(r => r.json()).catch(() => ({ ok: false }))));
                let allAudits = [];
                responses.forEach(json => { if (json.ok && Array.isArray(json.audits)) allAudits = [...allAudits, ...json.audits]; });
                const seen = new Set();
                allAudits = allAudits.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

                // ── ISOLATION: Global metrics use DOCENTE audits only ──
                // Pilot audits appear in individual cards but NEVER contaminate the global report
                const docenteAudits = allAudits.filter(a => a.source !== 'pilot_narration');
                const completed = docenteAudits.filter(a => a.score !== null);
                const totalAudited = completed.length;
                const avgScore = totalAudited > 0 ? Math.round(completed.reduce((s, a) => s + a.score, 0) / totalAudited) : null;
                const countTrue = (f) => completed.filter(a => a[f] === true).length;
                const rate = (f) => totalAudited > 0 ? Math.round((countTrue(f) / totalAudited) * 100) : null;

                const energy = { alta: 0, media: 0, baja: 0 };
                completed.forEach(a => { if (a.energia_interaccion && energy.hasOwnProperty(a.energia_interaccion)) energy[a.energia_interaccion]++; });
                const dominantEnergy = Object.entries(energy).sort((a, b) => b[1] - a[1])[0];

                // Alerts also use docente-only audits
                const alerts = completed.filter(a => a.score < 60).map(a => ({
                    id: a.id, flight_number: a.flight_number, score: a.score,
                    nombre_equipo: a.nombre_equipo_detectado, resumen: a.resumen_supervisor, feedback: a.feedback_para_isa
                }));

                const checklist = {};
                Object.keys(CHECKLIST_LABELS).forEach(k => { checklist[k] = { passed: countTrue(k), rate: rate(k) }; });

                // Pass ALL audits (both roles) so carousel cards can render each one with its own checklist
                setData({ ok: true, summary: { totalAudited, avgScore, checklist, energy, dominantEnergy: dominantEnergy?.[1] > 0 ? dominantEnergy[0] : null }, alerts, audits: allAudits });
                setError(null);
            } else if (date) {
                const res = await fetch(`/api/admin/audio-quality?date=${date}`);
                const json = await res.json();
                if (json.ok) { setData(json); setError(null); } else { setError(json.error || 'Error'); }
            } else {
                const res = await fetch(`/api/admin/audio-quality?days=1`);
                const json = await res.json();
                if (json.ok) { setData(json); setError(null); } else { setError(json.error || 'Error'); }
            }
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [journeyId, journeyIds, date]);

    useEffect(() => { fetchData(); const iv = setInterval(fetchData, 60000); return () => clearInterval(iv); }, [fetchData]);

    if (loading && !data) return (
        <div style={{ ...baseCard, ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 12 }}>
            <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#A78BFA', borderRadius: '50%', animation: 'qaWidgetSpin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Cargando reporte IA…</span>
            <style>{`@keyframes qaWidgetSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error && !data) return (
        <div style={{ ...baseCard, ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, color: '#F87171', fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>
    );

    const { summary, alerts, audits } = data || {};
    const noData = !summary || summary.totalAudited === 0;
    const displayName = isaName || 'la Docente';

    const isAlertsOpen = alertsExpanded !== null ? alertsExpanded : (alerts?.length || 0) <= 2;
    const globalNarrative = summary ? buildGlobalNarrative(summary, displayName) : null;

    return (
        <div style={{ ...baseCard, ...style }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(91,33,182,0.4))', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        <span className="material-symbols-outlined" style={{ color: '#C4B5FD', fontSize: 18 }}>mic_external_on</span>
                    </div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#F8FAFC', margin: 0, letterSpacing: '-0.01em' }}>Desempeño Docente IA</h3>
                        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '2px 0 0' }}>
                            {summary?.totalAudited || 0} misiones evaluadas{isaName ? ` · ${displayName}` : ''}
                        </p>
                    </div>
                </div>
                <button onClick={fetchData} disabled={loading} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: loading ? 0.5 : 1, transition: 'background 0.2s' }} title="Actualizar">
                    <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>refresh</span>
                </button>
            </div>

            {noData && !parsedMeta ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(15,23,42,0.3)', borderRadius: 12, border: '1px dashed rgba(148,163,184,0.2)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.5, color: '#94A3B8' }}>mic_off</span>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0', margin: '0 0 4px' }}>Sin análisis recientes</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>La IA procesará los audios tras cada vuelo.</p>
                </div>
            ) : (
                <>
                    {/* ── Panel de Reporte de Desempeño (Veredicto y Progreso) ── */}
                    <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: 14, padding: '20px 16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <p style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                                Reporte de Desempeño Global
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                            <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                                <svg width="64" height="64" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="44" fill="none" stroke={scoreColor(summary.avgScore)} strokeWidth="8" strokeDasharray="276" strokeDashoffset={276 - (276 * (summary.avgScore || 0) / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 20, fontWeight: 900, color: '#F8FAFC', lineHeight: 1 }}>{summary.avgScore ?? '–'}</span>
                                    <span style={{ fontSize: 8, fontWeight: 800, color: '#94A3B8', marginTop: 2 }}>/ 100</span>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 800, color: scoreColor(summary.avgScore), margin: '0 0 4px' }}>
                                    {scoreGrade(summary.avgScore)}
                                </p>
                                {summary.dominantEnergy && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: ENERGY_COLORS[summary.dominantEnergy].bg, border: `1px solid ${ENERGY_COLORS[summary.dominantEnergy].text}40`, padding: '2px 8px', borderRadius: 20 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: ENERGY_COLORS[summary.dominantEnergy].text }}>bolt</span>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: ENERGY_COLORS[summary.dominantEnergy].text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Energía: {ENERGY_COLORS[summary.dominantEnergy].label}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Veredicto Narrativo de la IA (Colapsable) */}
                        {globalNarrative && (
                            <div style={{ marginBottom: 20 }}>
                                <button onClick={() => setIsGlobalReportOpen(!isGlobalReportOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s ease', color: '#C7D2FE', position: 'relative', zIndex: 2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#818CF8' }}>memory</span>
                                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leer análisis del Supervisor IA</span>
                                    </div>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, transform: isGlobalReportOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>expand_more</span>
                                </button>
                                {isGlobalReportOpen && (
                                    <div style={{ background: 'rgba(99,102,241,0.04)', borderRadius: '0 0 10px 10px', padding: '16px 12px 12px', border: '1px solid rgba(99,102,241,0.1)', borderTop: 'none', borderLeft: `3px solid ${scoreColor(summary.avgScore)}`, marginTop: -6, position: 'relative', zIndex: 1, animation: 'qaFadeIn 0.2s ease-out' }}>
                                        <p style={{ fontSize: 12, color: '#E2E8F0', margin: 0, lineHeight: 1.6 }}>{globalNarrative}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lista de Cumplimiento (Progress Bars) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {Object.entries(CHECKLIST_LABELS).map(([key, config]) => {
                                const item = summary.checklist?.[key];
                                const r = item?.rate ?? 0;
                                const passedAmt = item?.passed ?? 0;
                                const total = summary.totalAudited;
                                const ok = r >= 60;
                                return (
                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#94A3B8' }}>{config.icon}</span>
                                                {config.label}
                                            </span>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: ok ? '#4ADE80' : '#F87171' }}>
                                                {passedAmt} de {total} misiones
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, overflow: 'hidden', position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, background: ok ? '#4ADE80' : '#F87171', width: `${r}%`, transition: 'width 1s ease-out' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Collapsible Alerts ── */}
                    {alerts && alerts.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <button onClick={() => setAlertsExpanded(!isAlertsOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', marginBottom: isAlertsOpen ? 10 : 0, transition: 'all 0.2s ease' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F43F5E', boxShadow: '0 0 10px rgba(244,63,94,0.6)', animation: 'qaAlertPulse 2s ease-in-out infinite' }} />
                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#F43F5E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requiere Atención</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ background: 'rgba(244,63,94,0.2)', color: '#FDA4AF', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>{alerts.length} misiones</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#FDA4AF', transform: isAlertsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>expand_more</span>
                                </div>
                            </button>
                            <style>{`@keyframes qaAlertPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

                            {isAlertsOpen && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'qaFadeIn 0.2s ease-out' }}>
                                    <style>{`@keyframes qaFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                                    {alerts.map(alert => {
                                        const narr = buildNarrative(alert, isaName, audits);
                                        return (
                                            <div key={alert.id} style={{ background: 'rgba(244,63,94,0.04)', borderRadius: 10, padding: '12px', border: '1px solid rgba(244,63,94,0.15)', borderLeft: '3px solid #F43F5E' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#FDA4AF' }}>
                                                        Tanda #{alert.flight_number || '?'}{alert.nombre_equipo ? ` · "${alert.nombre_equipo}"` : ''}
                                                    </span>
                                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#FFE4E6', background: 'rgba(225,29,72,0.3)', padding: '2px 6px', borderRadius: 4 }}>Score: {alert.score}</span>
                                                </div>
                                                <p style={{ fontSize: 11, color: '#FECDD3', margin: '0 0 8px', lineHeight: 1.5, fontWeight: 500 }}>{narr.headline}</p>
                                                {narr.details.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: narr.tip ? 8 : 0 }}>
                                                        {narr.details.map((d, i) => (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 2 }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: 13, color: d.ok ? '#4ADE80' : '#F87171' }}>{d.ok ? 'check_circle' : 'cancel'}</span>
                                                                <span style={{ fontSize: 11, color: d.ok ? 'rgba(74,222,128,0.9)' : 'rgba(254,205,211,0.9)', fontWeight: 500 }}>{d.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {narr.tip && (
                                                    <div style={{ background: 'rgba(139,92,246,0.1)', borderRadius: 8, padding: '6px 10px', border: '1px solid rgba(139,92,246,0.2)', marginTop: 4, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#C4B5FD', marginTop: 1 }}>chat</span>
                                                        <p style={{ fontSize: 10, color: '#C4B5FD', margin: 0, lineHeight: 1.5, fontStyle: 'italic', fontWeight: 500 }}>{narr.tip}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── Timeline (Horizontal Carousel) ── */}
            {!hideDetails && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {parsedMeta ? 'Bitácora & Reportes' : 'Detalle por tanda'}
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6366F1', animation: 'qaSwipeHint 2s infinite ease-in-out' }}>swipe</span>
                        </p>
                    </div>
                    <style>{`
                        @keyframes qaSwipeHint { 0%, 100% { transform: translateX(0); opacity: 0.5; } 50% { transform: translateX(4px); opacity: 1; } }
                        .qa-carousel::-webkit-scrollbar { height: 4px; }
                        .qa-carousel::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
                        .qa-carousel::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); border-radius: 4px; }
                    `}</style>

                    {parsedMeta ? (
                        <div className="qa-carousel" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 12, paddingBottom: 12, margin: '0 -10px', padding: '0 10px 12px 10px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.4) transparent' }}>
                            {(() => {
                                const bitacoras = Array.isArray(parsedMeta.escuadron_bitacora_history) ? parsedMeta.escuadron_bitacora_history : [];
                                const audiosList = Array.isArray(parsedMeta.telemetry_recordings) ? parsedMeta.telemetry_recordings : [];
                                const auditsList = audits || [];
                                const pilotAudios = audiosList.filter(a => a.source === 'pilot_narration');
                                const teacherAudios = audiosList.filter(a => a.source === 'bitacora');
                                const untaggedAudios = audiosList.filter(a => !a.source || (a.source !== 'pilot_narration' && a.source !== 'bitacora'));
                                const bitacoraFlightSet = new Set();
                                bitacoras.forEach((b, idx) => bitacoraFlightSet.add(b.flightNumber || (idx + 1)));

                                // Dedup audits: keep only the latest (first in list) per flight_number + source
                                const seenAuditKeys = new Set();
                                const dedupedAudits = auditsList.filter(a => {
                                    const key = `${a.flight_number}-${a.source || 'unknown'}`;
                                    if (seenAuditKeys.has(key)) return false;
                                    seenAuditKeys.add(key);
                                    return true;
                                });

                                // Dedup pilot audios by flightNumber (keep first occurrence)
                                const seenPilotFlights = new Set();
                                const dedupedPilotAudios = pilotAudios.filter(a => {
                                    const fn = a.flightNumber || 0;
                                    if (seenPilotFlights.has(fn)) return false;
                                    seenPilotFlights.add(fn);
                                    return true;
                                });

                                let maxFlight = 0;
                                bitacoras.forEach((b, i) => maxFlight = Math.max(maxFlight, b.flightNumber || (i + 1)));
                                audiosList.forEach((a, i) => maxFlight = Math.max(maxFlight, a.flightNumber || (i + 1)));
                                dedupedAudits.forEach(a => maxFlight = Math.max(maxFlight, a.flight_number || 0));

                                const ops = [];
                                for (let i = 1; i <= maxFlight; i++) {
                                    const bitacora = bitacoras.find((b, idx) => (b.flightNumber || (idx + 1)) === i);
                                    const pilotAudio = dedupedPilotAudios.find((a, idx) => (a.flightNumber || (idx + 1)) === i);
                                    const untagged = untaggedAudios.find((a, idx) => (a.flightNumber || (idx + 1)) === i);

                                    // Resolve pilot audio (explicit or untagged fallback)
                                    let ePilot = pilotAudio;
                                    if (!ePilot && untagged && !bitacoraFlightSet.has(i)) ePilot = untagged;

                                    // Find SEPARATE audits for each role
                                    const pilotAudit = dedupedAudits.find(a => a.flight_number === i && a.source === 'pilot_narration') || null;
                                    const docenteAudit = dedupedAudits.find(a => a.flight_number === i && a.source !== 'pilot_narration') || null;


                                    // Pilot cards now render inline in flight record cards (page.js)

                                    // Card for DOCENTE (if docente audit exists)
                                    if (docenteAudit) {
                                        const teacherAudio = teacherAudios.find(a => (a.flightNumber || 0) === i) || null;
                                        ops.push({
                                            flightNumber: i,
                                            teamName: bitacora?.nombreClave || docenteAudit?.nombre_equipo_detectado || null,
                                            destinations: bitacora?.destinos || null,
                                            audioUrl: teacherAudio?.url || bitacora?.audioUrl || null,
                                            audioSizeKB: teacherAudio?.sizeKB || 0,
                                            audioDurationSeconds: teacherAudio?.durationSeconds || 0,
                                            timestamp: bitacora?.timestamp || docenteAudit?.created_at || null,
                                            audit: docenteAudit,
                                            isaName
                                        });
                                    }

                                    // Fallback: if NO audit exists for either role but bitacora exists, show placeholder
                                    if (!pilotAudit && !docenteAudit && !ePilot && bitacora) {
                                        ops.push({
                                            flightNumber: i,
                                            teamName: bitacora?.nombreClave || null,
                                            destinations: bitacora?.destinos || null,
                                            audioUrl: null,
                                            audioSizeKB: 0,
                                            audioDurationSeconds: 0,
                                            timestamp: bitacora?.timestamp || null,
                                            audit: null,
                                            isaName
                                        });
                                    }
                                }
                                if (ops.length === 0) return <p style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', textAlign: 'center', padding: 16, width: '100%' }}>No hay misiones registradas aún.</p>;
                                return ops.map((op, idx) => (
                                    <div key={`${op.flightNumber}-${op.audit?.source || 'none'}-${idx}`} style={{ flex: '0 0 92%', maxWidth: '92%', scrollSnapAlign: 'center' }}>
                                        <UnifiedFlightCard {...op} />
                                    </div>
                                ));
                            })()}
                        </div>
                    ) : (
                        <div className="qa-carousel" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 12, paddingBottom: 12, margin: '0 -10px', padding: '0 10px 12px 10px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.4) transparent' }}>
                            {audits && audits.map(audit => (
                                <div key={audit.id} style={{ flex: '0 0 92%', maxWidth: '92%', scrollSnapAlign: 'center' }}>
                                    <UnifiedFlightCard flightNumber={audit.flight_number} audit={audit} timestamp={audit.created_at} teamName={audit.nombre_equipo_detectado} isaName={isaName} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const baseCard = { background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
