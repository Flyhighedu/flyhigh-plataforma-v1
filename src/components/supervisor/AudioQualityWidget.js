'use client';

// =====================================================
// AudioQualityWidget.js
//
// Premium dashboard widget for supervisors to monitor
// ISA's pre-flight dynamic quality scores in real-time.
//
// Displays:
//   - Average score gauge
//   - Per-criteria compliance bars
//   - Energy distribution
//   - Alerts for low-scoring tandas
//   - Individual tanda scorecards (expandable)
//
// Data source: GET /api/admin/audio-quality
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import UnifiedFlightCard from './UnifiedFlightCard';

const CHECKLIST_LABELS = {
    menciona_nombre_equipo: { label: 'Nombre del equipo', emoji: '✋', desc: 'Dijo "Escuadrón X"' },
    menciona_destino: { label: 'Mención del destino', emoji: '🗺️', desc: 'Mencionó a dónde volarían' },
    dinamica_sube_sube: { label: 'Dinámica ¡Sube Sube!', emoji: '🚀', desc: 'Hizo la dinámica interactiva' },
    participacion_ninos_audible: { label: 'Participación de niños', emoji: '👧', desc: 'Se escuchan respuestas de los niños' }
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

function scoreGrade(score) {
    if (score >= 90) return 'Excelente';
    if (score >= 75) return 'Bien';
    if (score >= 60) return 'Regular';
    if (score >= 40) return 'Bajo';
    return 'Crítico';
}

function fmtTime(iso) {
    if (!iso) return '--:--';
    try {
        return new Date(iso).toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'America/Mexico_City'
        });
    } catch { return '--:--'; }
}

export default function AudioQualityWidget({ journeyId, journeyIds, date, style, hideDetails = false, parsedMeta = null }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedAudit, setExpandedAudit] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            
            // If we have multiple journeyIds, fetch audits for ALL of them
            const idsToFetch = (Array.isArray(journeyIds) && journeyIds.length > 0)
                ? journeyIds
                : (journeyId ? [journeyId] : []);

            if (idsToFetch.length > 0) {
                // Fetch all in parallel
                const responses = await Promise.all(
                    idsToFetch.map(id =>
                        fetch(`/api/admin/audio-quality?journeyId=${id}`).then(r => r.json()).catch(() => ({ ok: false }))
                    )
                );

                // Merge audits from all responses
                let allAudits = [];
                responses.forEach(json => {
                    if (json.ok && Array.isArray(json.audits)) {
                        allAudits = [...allAudits, ...json.audits];
                    }
                });

                // De-duplicate by ID
                const seen = new Set();
                allAudits = allAudits.filter(a => {
                    if (seen.has(a.id)) return false;
                    seen.add(a.id);
                    return true;
                });

                // Rebuild summary from merged audits
                const completed = allAudits.filter(a => a.score !== null);
                const totalAudited = completed.length;
                const avgScore = totalAudited > 0
                    ? Math.round(completed.reduce((sum, a) => sum + a.score, 0) / totalAudited)
                    : null;

                const countTrue = (field) => completed.filter(a => a[field] === true).length;
                const rate = (field) => totalAudited > 0 ? Math.round((countTrue(field) / totalAudited) * 100) : null;

                const energyCounts = { alta: 0, media: 0, baja: 0 };
                completed.forEach(a => {
                    if (a.energia_interaccion && energyCounts.hasOwnProperty(a.energia_interaccion)) {
                        energyCounts[a.energia_interaccion]++;
                    }
                });

                const alerts = completed
                    .filter(a => a.score !== null && a.score < 60)
                    .map(a => ({
                        id: a.id,
                        flight_number: a.flight_number,
                        score: a.score,
                        nombre_equipo: a.nombre_equipo_detectado,
                        resumen: a.resumen_supervisor,
                        feedback: a.feedback_para_isa
                    }));

                setData({
                    ok: true,
                    summary: {
                        totalAudited,
                        avgScore,
                        checklist: {
                            menciona_nombre_equipo: { passed: countTrue('menciona_nombre_equipo'), rate: rate('menciona_nombre_equipo') },
                            menciona_destino: { passed: countTrue('menciona_destino'), rate: rate('menciona_destino') },
                            dinamica_sube_sube: { passed: countTrue('dinamica_sube_sube'), rate: rate('dinamica_sube_sube') },
                            participacion_ninos_audible: { passed: countTrue('participacion_ninos_audible'), rate: rate('participacion_ninos_audible') }
                        },
                        energy: energyCounts,
                        equiposConNombre: { count: countTrue('menciona_nombre_equipo'), total: totalAudited }
                    },
                    alerts,
                    audits: allAudits
                });
                setError(null);
            } else if (date) {
                const res = await fetch(`/api/admin/audio-quality?date=${date}`);
                const json = await res.json();
                if (json.ok) { setData(json); setError(null); }
                else { setError(json.error || 'Error desconocido'); }
            } else {
                const res = await fetch(`/api/admin/audio-quality?days=1`);
                const json = await res.json();
                if (json.ok) { setData(json); setError(null); }
                else { setError(json.error || 'Error desconocido'); }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [journeyId, journeyIds, date]);

    useEffect(() => {
        fetchData();
        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading && !data) {
        return (
            <div style={{
                ...baseCard, ...style,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 200, gap: 12
            }}>
                <div style={{
                    width: 24, height: 24, border: '3px solid #E2E8F0',
                    borderTopColor: '#7C3AED', borderRadius: '50%',
                    animation: 'qaWidgetSpin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>
                    Cargando métricas de calidad…
                </span>
                <style>{`@keyframes qaWidgetSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div style={{
                ...baseCard, ...style,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 120, color: '#94A3B8', fontSize: 13
            }}>
                ⚠️ {error}
            </div>
        );
    }

    const { summary, alerts, audits } = data || {};
    const noData = !summary || summary.totalAudited === 0;

    return (
        <div style={{ ...baseCard, ...style }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)'
                    }}>🎙️</div>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#F8FAFC', margin: 0, letterSpacing: '0.02em' }}>
                            Calidad de Dinámica
                        </h3>
                        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: 0 }}>
                            Monitorización IA · {summary?.totalAudited || 0} {summary?.totalAudited === 1 ? 'tanda analizada' : 'tandas analizadas'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(255, 255, 255, 0.05)',
                        color: '#F8FAFC',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 14,
                        opacity: loading ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                    }}
                    title="Actualizar"
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                >🔄</button>
            </div>

            {noData && !parsedMeta ? (
                <div style={{
                    textAlign: 'center', padding: '32px 16px',
                    background: '#F8FAFC', borderRadius: 16,
                    border: '1px dashed #CBD5E1'
                }}>
                    <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🎙️</span>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#64748B', margin: '0 0 4px' }}>
                        Sin auditorías aún
                    </p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                        Los audios se analizarán automáticamente cuando ISA complete cada tanda.
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Score Gauge + Quick Stats ── */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: 12, marginBottom: 20
                    }}>
                        {/* Score Gauge */}
                        <div style={{
                            background: scoreBg(summary.avgScore),
                            borderRadius: 16, padding: '20px 16px',
                            textAlign: 'center',
                            border: `1px solid ${scoreColor(summary.avgScore)}20`
                        }}>
                            <p style={{
                                fontSize: 42, fontWeight: 900, margin: 0,
                                color: scoreColor(summary.avgScore),
                                lineHeight: 1, fontVariantNumeric: 'tabular-nums'
                            }}>
                                {summary.avgScore}
                            </p>
                            <p style={{
                                fontSize: 11, fontWeight: 800, margin: '6px 0 0',
                                color: scoreColor(summary.avgScore),
                                textTransform: 'uppercase', letterSpacing: '0.08em'
                            }}>
                                {scoreGrade(summary.avgScore)}
                            </p>
                            <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, margin: '4px 0 0', lineHeight: 1.2 }}>
                                Promedio general de la IA <br/>(basado en {summary.totalAudited} {summary.totalAudited === 1 ? 'tanda' : 'tandas'})
                            </p>
                        </div>

                        {/* Energy Distribution */}
                        <div style={{
                            background: '#F8FAFC', borderRadius: 16, padding: '16px',
                            border: '1px solid #E2E8F0',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8
                        }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                                Niveles de Energía (Por Tanda)
                            </p>
                            {Object.entries(ENERGY_COLORS).map(([key, config]) => {
                                const count = summary.energyDist?.[key] || 0;
                                const pct = summary.totalAudited > 0 ? Math.round((count / summary.totalAudited) * 100) : 0;
                                return (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: config.text, flexShrink: 0
                                        }} />
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155', flex: 1, lineHeight: 1.2 }}>
                                            <strong>{count} {count === 1 ? 'tanda' : 'tandas'}</strong> con energía {config.label}
                                        </span>
                                        <span style={{
                                            fontSize: 12, fontWeight: 800, color: config.text,
                                            fontVariantNumeric: 'tabular-nums'
                                        }}>
                                            {pct}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Checklist Compliance Bars ── */}
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                            Cumplimiento por Criterio
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {Object.entries(CHECKLIST_LABELS).map(([key, config]) => {
                                const item = summary.checklist?.[key];
                                const rate = item?.rate ?? 0;
                                const passed = item?.passed ?? 0;
                                const total = summary.totalAudited;

                                return (
                                    <div key={key}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1 }}>
                                                <span style={{ fontSize: 14 }}>{config.emoji}</span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'currentColor', opacity: 0.9 }}>
                                                        {config.label}
                                                    </span>
                                                    <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                                                        {passed === 0 ? 'No se cumplió en ninguna tanda' : 
                                                         `Cumplido en ${passed} de ${total} ${total === 1 ? 'tanda' : 'tandas'}`}
                                                    </span>
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: 13, fontWeight: 800,
                                                color: rate >= 75 ? '#16A34A' : rate >= 50 ? '#CA8A04' : '#DC2626',
                                                fontVariantNumeric: 'tabular-nums',
                                                paddingTop: 2
                                            }}>
                                                {rate}%
                                            </span>
                                        </div>
                                        <div style={{
                                            height: 6, borderRadius: 3,
                                            background: '#F1F5F9', overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%', borderRadius: 3,
                                                width: `${rate}%`,
                                                background: rate >= 75
                                                    ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                                                    : rate >= 50
                                                        ? 'linear-gradient(90deg, #EAB308, #CA8A04)'
                                                        : 'linear-gradient(90deg, #EF4444, #DC2626)',
                                                transition: 'width 0.6s ease'
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Alerts ── */}
                    {alerts && alerts.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                                ⚠️ Alertas ({alerts.length})
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {alerts.map(alert => (
                                    <div key={alert.id} style={{
                                        background: '#FEF2F2', borderRadius: 12,
                                        padding: '12px 14px', border: '1px solid #FECACA'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>
                                                Tanda #{alert.flight_number || '?'}
                                                {alert.nombre_equipo ? ` · "${alert.nombre_equipo}"` : ''}
                                            </span>
                                            <span style={{
                                                fontSize: 11, fontWeight: 900,
                                                color: 'white', background: '#DC2626',
                                                padding: '2px 8px', borderRadius: 6,
                                                display: 'flex', alignItems: 'center', gap: 4
                                            }}>
                                                <span>🤖</span> Score: {alert.score}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 12, color: '#7F1D1D', margin: 0, lineHeight: 1.4 }}>
                                            {alert.resumen || alert.feedback}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── Unified Operations Timeline — ALWAYS shown when parsedMeta has data ── */}
            {!hideDetails && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                                    {parsedMeta ? 'Bitácora Operativa (Vuelos)' : 'Detalle por tanda'}
                                </p>
                            </div>
                            
                            {parsedMeta ? (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {(() => {
                                        const bitacoras = Array.isArray(parsedMeta.escuadron_bitacora_history) ? parsedMeta.escuadron_bitacora_history : [];
                                        const audiosList = Array.isArray(parsedMeta.telemetry_recordings) ? parsedMeta.telemetry_recordings : [];
                                        const auditsList = audits || [];

                                        // Separate audio by source tag
                                        const pilotAudios = audiosList.filter(a => a.source === 'pilot_narration');
                                        const teacherAudios = audiosList.filter(a => a.source === 'bitacora');
                                        const untaggedAudios = audiosList.filter(a => !a.source || (a.source !== 'pilot_narration' && a.source !== 'bitacora'));

                                        // Build a set of flight numbers that have bitácora entries (teacher flights)
                                        const bitacoraFlightSet = new Set();
                                        bitacoras.forEach((b, idx) => bitacoraFlightSet.add(b.flightNumber || (idx + 1)));

                                        let maxFlight = 0;
                                        bitacoras.forEach((b, i) => maxFlight = Math.max(maxFlight, b.flightNumber || (i + 1)));
                                        audiosList.forEach((a, i) => maxFlight = Math.max(maxFlight, a.flightNumber || (i + 1)));
                                        auditsList.forEach(a => maxFlight = Math.max(maxFlight, a.flight_number || 0));

                                        const unifiedOperations = [];
                                        for (let i = 1; i <= maxFlight; i++) {
                                            const bitacora = bitacoras.find((b, idx) => (b.flightNumber || (idx + 1)) === i);
                                            const pilotAudio = pilotAudios.find((a, idx) => (a.flightNumber || (idx + 1)) === i);
                                            const teacherAudio = teacherAudios.find((a, idx) => (a.flightNumber || (idx + 1)) === i);
                                            const audit = auditsList.find(a => a.flight_number === i);

                                            // Handle untagged legacy audio: if bitácora entry exists, it's teacher audio
                                            const untagged = untaggedAudios.find((a, idx) => (a.flightNumber || (idx + 1)) === i);
                                            let effectivePilotAudio = pilotAudio;
                                            let effectiveTeacherAudio = teacherAudio;
                                            if (untagged && !pilotAudio && !teacherAudio) {
                                                if (bitacoraFlightSet.has(i)) {
                                                    effectiveTeacherAudio = untagged; // teacher audio
                                                } else {
                                                    effectivePilotAudio = untagged; // pilot audio
                                                }
                                            } else if (untagged && !pilotAudio && teacherAudio) {
                                                // Already has teacher audio, untagged might be pilot
                                                if (!bitacoraFlightSet.has(i)) effectivePilotAudio = untagged;
                                            }

                                            if (bitacora || effectivePilotAudio || effectiveTeacherAudio || audit) {
                                                // Determine teacher audio URL: prefer bitacora entry, then tagged telemetry, then untagged
                                                const teacherUrl = bitacora?.audioUrl || effectiveTeacherAudio?.url || null;
                                                const teacherDuration = bitacora?.audioDurationSeconds || effectiveTeacherAudio?.durationSeconds || 0;

                                                unifiedOperations.push({
                                                    flightNumber: i,
                                                    teamName: bitacora?.nombreClave || audit?.nombre_equipo_detectado || null,
                                                    destinations: bitacora?.destinos || null,
                                                    // Pilot narration audio
                                                    audioUrl: effectivePilotAudio?.url || null,
                                                    audioSizeKB: effectivePilotAudio?.fileSizeKB || 0,
                                                    audioDurationSeconds: effectivePilotAudio?.durationSeconds || 0,
                                                    // Teacher bitácora audio
                                                    teacherAudioUrl: teacherUrl,
                                                    teacherAudioSizeKB: effectiveTeacherAudio?.fileSizeKB || bitacora?.audioSizeKB || 0,
                                                    teacherAudioDurationSeconds: teacherDuration,
                                                    timestamp: bitacora?.timestamp || effectivePilotAudio?.timestamp || effectiveTeacherAudio?.timestamp || audit?.created_at || null,
                                                    audit: audit || null
                                                });
                                            }
                                        }

                                        if (unifiedOperations.length === 0) {
                                            return <p style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>No hay operaciones registradas aún.</p>;
                                        }

                                        return unifiedOperations.reverse().map((op) => (
                                            <UnifiedFlightCard key={op.flightNumber} {...op} />
                                        ));
                                    })()}
                                </div>
                            ) : (
                                /* ── Old render path (fallback if parsedMeta is not passed) ── */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {audits && audits.map(audit => {
                                        const isExpanded = expandedAudit === audit.id;

                                        return (
                                            <div key={audit.id} style={{
                                                background: 'white', borderRadius: 12,
                                                border: `1px solid ${isExpanded ? '#7C3AED40' : '#E2E8F0'}`,
                                                overflow: 'hidden',
                                                transition: 'border-color 0.2s'
                                            }}>
                                                {/* Row header (always visible) */}
                                                <button
                                                    onClick={() => setExpandedAudit(isExpanded ? null : audit.id)}
                                                    style={{
                                                        width: '100%', padding: '10px 14px',
                                                        border: 'none', background: 'transparent',
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        cursor: 'pointer', textAlign: 'left'
                                                    }}
                                                >
                                                    {/* Score pill */}
                                                    <div style={{
                                                        width: 36, height: 36, borderRadius: 10,
                                                        background: scoreBg(audit.score),
                                                        border: `1px solid ${scoreColor(audit.score)}30`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <span style={{
                                                            fontSize: 14, fontWeight: 900,
                                                            color: scoreColor(audit.score),
                                                            fontVariantNumeric: 'tabular-nums'
                                                        }}>{audit.score}</span>
                                                    </div>

                                                    {/* Info */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                                                            Tanda #{audit.flight_number || '?'}
                                                            {audit.nombre_equipo_detectado ? ` · "${audit.nombre_equipo_detectado}"` : ''}
                                                        </p>
                                                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 600 }}>
                                                            {fmtTime(audit.created_at)}
                                                            {audit.destino_detectado ? ` · 📍 ${audit.destino_detectado}` : ''}
                                                        </p>
                                                    </div>

                                                    {/* Expand chevron */}
                                                    <span style={{
                                                        fontSize: 14, color: '#94A3B8',
                                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                                        transition: 'transform 0.2s'
                                                    }}>▼</span>
                                                </button>

                                                {/* Expanded detail */}
                                                {isExpanded && (
                                                    <div style={{
                                                        padding: '0 14px 14px',
                                                        borderTop: '1px solid #F1F5F9'
                                                    }}>
                                                        {/* Mini checklist */}
                                                        <div style={{
                                                            display: 'grid', gridTemplateColumns: '1fr 1fr',
                                                            gap: 6, marginTop: 10, marginBottom: 10
                                                        }}>
                                                            {Object.entries(CHECKLIST_LABELS).map(([key, config]) => {
                                                                const val = audit[key];
                                                                const icon = val === true ? '✅' : val === false ? '❌' : '❓';
                                                                return (
                                                                    <div key={key} style={{
                                                                        fontSize: 11, fontWeight: 600,
                                                                        color: val === true ? '#16A34A' : val === false ? '#DC2626' : '#94A3B8',
                                                                        display: 'flex', alignItems: 'center', gap: 4
                                                                    }}>
                                                                        <span>{icon}</span>
                                                                        <span>{config.label}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Energy badge */}
                                                        {audit.energia_interaccion && audit.energia_interaccion !== 'no_detectado' && (
                                                            <div style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                background: ENERGY_COLORS[audit.energia_interaccion]?.bg || '#F1F5F9',
                                                                color: ENERGY_COLORS[audit.energia_interaccion]?.text || '#64748B',
                                                                padding: '4px 10px', borderRadius: 8,
                                                                fontSize: 11, fontWeight: 700, marginBottom: 8
                                                            }}>
                                                                ⚡ Energía {ENERGY_COLORS[audit.energia_interaccion]?.label || audit.energia_interaccion}
                                                            </div>
                                                        )}

                                                        {/* Supervisor summary */}
                                                        {audit.resumen_supervisor && (
                                                            <p style={{
                                                                fontSize: 12, color: '#475569', margin: '0 0 6px',
                                                                lineHeight: 1.45, fontWeight: 600,
                                                                background: '#F8FAFC', padding: '8px 10px',
                                                                borderRadius: 8, border: '1px solid #E2E8F0'
                                                            }}>
                                                                📋 {audit.resumen_supervisor}
                                                            </p>
                                                        )}

                                                        {/* Feedback sent to ISA */}
                                                        {audit.feedback_para_isa && (
                                                            <p style={{
                                                                fontSize: 11, color: '#7C3AED', margin: 0,
                                                                lineHeight: 1.4, fontWeight: 600,
                                                                fontStyle: 'italic'
                                                            }}>
                                                                💬 Feedback a ISA: "{audit.feedback_para_isa}"
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
        </div>
    );
}

const baseCard = {
    background: 'white',
    borderRadius: 20,
    border: '1px solid #E2E8F0',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
};
