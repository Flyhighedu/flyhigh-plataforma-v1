"use client";

import { useState, useCallback } from 'react';
import { TremorBarChart, TremorAreaChart } from './TremorCharts';
import { SkeletonPanel } from './SkeletonCard';
import {
    BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/* ── Constants ── */
const MONTH_LABELS = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};
const SHORT_MONTHS = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

const PRIMARY = '#6366f1';
const PRIMARY_LIGHT = '#818cf8';
const ACCENT = '#8b5cf6';

function formatMonthLabel(monthStr) {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    return `${MONTH_LABELS[month] || month} ${year}`;
}

function formatWeekLabel(weekStr, index) {
    return `Sem. ${index + 1}`;
}

/* ═══════════════════════════════════════════════════════
   1. METRIC CARD
   ═══════════════════════════════════════════════════════ */
function MetricCard({ icon, label, value, sublabel, accent }) {
    return (
        <div className="group relative rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 overflow-hidden">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(135deg, ${accent}08, transparent 60%)` }} />
            <div className="relative space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight text-foreground">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
            </div>
            <div className="absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full w-0"
                style={{ backgroundColor: accent }} />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   2. DETAIL MODAL (appears on bar click)
   ═══════════════════════════════════════════════════════ */
function DetailModal({ title, subtitle, schools, onClose }) {
    if (!schools) return null;
    const maxStudents = Math.max(...schools.map(s => s.students), 1);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            {/* Modal */}
            <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">{title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                {/* Content */}
                <div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-3">
                    {schools.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Sin datos para este periodo</p>
                    ) : schools.map((school, i) => {
                        const pct = Math.round((school.students / maxStudents) * 100);
                        return (
                            <div key={school.name + i} className="group/row">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{school.name}</span>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                                        <span className="tabular-nums"><strong className="text-foreground">{school.students.toLocaleString()}</strong> alumnos</span>
                                        <span className="tabular-nums">{school.flights} vuelos</span>
                                    </div>
                                </div>
                                <div className="h-2 w-full rounded-full bg-secondary/50 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Footer */}
                <div className="px-6 py-3 border-t border-border bg-secondary/20">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{schools.length} {schools.length === 1 ? 'escuela' : 'escuelas'}</span>
                        <span className="font-semibold text-foreground tabular-nums">
                            {schools.reduce((s, sc) => s + sc.students, 0).toLocaleString()} alumnos totales
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════════════
   3. CLICKABLE BAR CHART (single color, hover + click)
   ═══════════════════════════════════════════════════════ */
function ClickableBarChart({ data, xKey, yKey, height = 340, onBarClick, hoverLabel }) {
    const [activeIdx, setActiveIdx] = useState(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
                No hay datos para el periodo seleccionado
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        const entry = payload[0]?.payload;
        const schoolCount = entry?.schools?.length || 0;
        return (
            <div className="rounded-xl border border-border bg-card shadow-xl p-3 text-xs space-y-1.5 min-w-[180px]">
                <p className="font-bold text-foreground text-sm">{label}</p>
                <div className="flex items-center justify-between text-muted-foreground">
                    <span>{hoverLabel || 'Alumnos'}</span>
                    <span className="font-bold text-foreground tabular-nums">{payload[0]?.value?.toLocaleString()}</span>
                </div>
                {entry?.flights != null && (
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span>Vuelos</span>
                        <span className="font-semibold text-foreground tabular-nums">{entry.flights}</span>
                    </div>
                )}
                {entry?.missions != null && (
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span>Misiones</span>
                        <span className="font-semibold text-foreground tabular-nums">{entry.missions}</span>
                    </div>
                )}
                {schoolCount > 0 && (
                    <div className="pt-1.5 mt-1.5 border-t border-border text-muted-foreground flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        <span>Click para ver {schoolCount} {schoolCount === 1 ? 'escuela' : 'escuelas'}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsBarChart
                data={data}
                margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
                barGap={4}
                onMouseLeave={() => setActiveIdx(null)}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" strokeOpacity={0.5} />
                <XAxis
                    dataKey={xKey}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground, #94a3b8)' }}
                    axisLine={false} tickLine={false}
                />
                <YAxis
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground, #94a3b8)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v.toLocaleString()}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent, #f1f5f9)', opacity: 0.3 }} />
                <Bar
                    dataKey={yKey}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={52}
                    onClick={(entry, index) => onBarClick?.(entry, index)}
                    onMouseEnter={(_, index) => setActiveIdx(index)}
                    style={{ cursor: 'pointer' }}
                >
                    {data.map((_, i) => (
                        <Cell
                            key={i}
                            fill={i === activeIdx ? PRIMARY_LIGHT : PRIMARY}
                            style={{ transition: 'fill 0.2s ease', filter: i === activeIdx ? 'brightness(1.15)' : 'none' }}
                        />
                    ))}
                </Bar>
            </RechartsBarChart>
        </ResponsiveContainer>
    );
}

/* ═══════════════════════════════════════════════════════
   4. VIEW TOGGLE (Mensual / Semanal)
   ═══════════════════════════════════════════════════════ */
function ViewToggle({ value, onChange }) {
    const opts = [
        { key: 'monthly', label: 'Mensual', icon: '📅' },
        { key: 'weekly', label: 'Semanal', icon: '📆' },
    ];
    return (
        <div className="inline-flex items-center rounded-xl border border-border bg-secondary/30 p-0.5">
            {opts.map(o => (
                <button
                    key={o.key}
                    onClick={() => onChange(o.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                        ${value === o.key
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <span>{o.icon}</span>
                    <span>{o.label}</span>
                </button>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   5. MAIN PANEL EXPORT
   ═══════════════════════════════════════════════════════ */
export default function PanelImpacto({ data, loading, dateRange }) {
    const [modalData, setModalData] = useState(null);

    const isWeeklyView = dateRange === 'week';

    const handleBarClick = useCallback((entry) => {
        if (entry?.schools && entry.schools.length > 0) {
            const title = entry.monthLabel || entry.weekLabel || '';
            const subtitle = `${entry.students?.toLocaleString()} alumnos · ${entry.flights} vuelos · ${entry.missions} ${entry.missions === 1 ? 'misión' : 'misiones'}`;
            setModalData({ title, subtitle, schools: entry.schools });
        }
    }, []);

    if (loading) return <SkeletonPanel />;
    if (!data) return null;

    // Prepare monthly data
    const monthlyData = (data.monthlyTrend || []).map(t => ({
        ...t,
        monthLabel: formatMonthLabel(t.month),
        label: SHORT_MONTHS[t.month.split('-')[1]] || t.month,
    }));

    // Prepare weekly data
    const weeklyData = (data.weeklyTrend || []).map((w, i) => ({
        ...w,
        weekLabel: formatWeekLabel(w.week, i),
        label: formatWeekLabel(w.week, i),
    }));

    // Area chart data (always monthly, for the trend line)
    const areaData = monthlyData.map(d => ({
        label: d.label,
        Alumnos: d.students,
        Vuelos: d.flights,
    }));

    const activeData = isWeeklyView ? weeklyData : monthlyData;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Impacto General</h2>
                <p className="text-sm text-muted-foreground mt-1">Resumen del impacto global de las misiones Fly High</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon="👧🏽" label="Alumnos atendidos" value={data.totalStudents}
                    sublabel={`${(data.totalBecados || 0).toLocaleString()} becados`} accent={PRIMARY} />
                <MetricCard icon="🛩️" label="Vuelos realizados" value={data.totalFlights}
                    sublabel={`${data.totalMissions} misiones`} accent={ACCENT} />
                <MetricCard icon="⏱️" label="Horas de operación" value={data.totalHours}
                    sublabel="Tiempo acumulado de vuelo" accent="#ec4899" />
                <MetricCard icon="🎯" label="Meta patrocinados" value={data.sponsoredKidsGoal?.toLocaleString()}
                    sublabel={`${Math.round((data.totalStudents / (data.sponsoredKidsGoal || 1)) * 100)}% alcanzado`} accent="#10b981" />
            </div>

            {/* ── Bar Chart: Click to see school detail ── */}
            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground">Alumnos Atendidos</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isWeeklyView ? 'Desglose semanal' : 'Desglose mensual'} · Haz click en una barra para ver las escuelas
                    </p>
                </div>
                <ClickableBarChart
                    data={activeData}
                    xKey="label"
                    yKey="students"
                    height={340}
                    onBarClick={handleBarClick}
                    hoverLabel="Alumnos"
                />
            </div>

            {/* ── Area Chart: Trend Line ── */}
            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Tendencia de Crecimiento</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Evolución de alumnos y vuelos por mes</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PRIMARY }} />
                            Alumnos
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ACCENT }} />
                            Vuelos
                        </span>
                    </div>
                </div>
                <TremorAreaChart
                    data={areaData}
                    index="label"
                    categories={['Alumnos', 'Vuelos']}
                    colors={[PRIMARY, ACCENT]}
                    height={280}
                />
            </div>

            {/* ── School Totals Summary ── */}
            {data.schoolTotals && data.schoolTotals.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="mb-5">
                        <h3 className="text-lg font-semibold text-foreground">Rankings por Escuela</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Contribución acumulada por institución</p>
                    </div>
                    <div className="space-y-3">
                        {data.schoolTotals.map((school, i) => {
                            const max = data.schoolTotals[0]?.students || 1;
                            const pct = Math.round((school.students / max) * 100);
                            return (
                                <div key={school.name + i}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="text-xs font-bold text-muted-foreground w-5 text-right tabular-nums">{i + 1}</span>
                                            <span className="text-sm font-medium text-foreground truncate">{school.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                                            <span className="tabular-nums"><strong className="text-foreground">{school.students.toLocaleString()}</strong> alumnos</span>
                                            <span className="tabular-nums">{school.flights} vuelos</span>
                                            <span className="tabular-nums">{school.missions} {school.missions === 1 ? 'misión' : 'misiones'}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-secondary/50 overflow-hidden ml-7">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_LIGHT})` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Detail Modal ── */}
            {modalData && (
                <DetailModal
                    title={modalData.title}
                    subtitle={modalData.subtitle}
                    schools={modalData.schools}
                    onClose={() => setModalData(null)}
                />
            )}
        </div>
    );
}
