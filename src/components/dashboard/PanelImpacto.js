"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TremorAreaChart } from './TremorCharts';
import { SkeletonPanel } from './SkeletonCard';
import {
    BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell
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
const PRIMARY_GLOW = '#a5b4fc';
const PRIMARY_SELECTED = '#4f46e5';
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
function MetricCard({ icon, label, value, sublabel, accent, isJoined }) {
    return (
        <div className={`group relative transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
            isJoined 
            ? 'bg-transparent border-transparent px-4 py-3 hover:-translate-y-1' 
            : 'rounded-2xl border border-border bg-card p-5 hover:shadow-lg hover:-translate-y-1'
        }`}>
            <div className="relative space-y-1.5">
                <div className="flex items-center gap-3">
                    <span 
                        className={`text-lg transition-transform duration-500 flex items-center justify-center w-8 h-8 rounded-xl text-white shadow-md ${isJoined ? 'scale-110' : ''}`} 
                        style={{ backgroundColor: accent }}
                    >
                        {icon}
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors duration-500 ${isJoined ? 'text-foreground/90' : 'text-muted-foreground'}`}>{label}</span>
                </div>
                <p className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground transition-all duration-500 mt-2">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                {sublabel && (
                    <p className={`text-[11px] font-medium transition-colors duration-500 ${isJoined ? 'text-primary/80' : 'text-muted-foreground'}`}>{sublabel}</p>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   2. SVG ICONS (inline, no emoji)
   ═══════════════════════════════════════════════════════ */
const SvgStudents = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const SvgFlight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.7.5-1.1z" />
    </svg>
);
const SvgMission = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
);
const SvgSchool = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 22V10l10-7 10 7v12" /><path d="M6 22V14h4v8" /><path d="M14 22V14h4v8" /><line x1="12" y1="3" x2="12" y2="7" />
    </svg>
);

function RichTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;

    const schoolCount = entry.schools?.length || 0;

    return (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl px-5 py-4 shadow-2xl min-w-[200px]"
            style={{ boxShadow: `0 8px 32px -4px ${PRIMARY}20, 0 0 0 1px ${PRIMARY}10` }}>
            <p className="text-sm font-bold text-foreground mb-2.5 pb-2 border-b border-border">
                {entry.monthLabel || entry.weekLabel || label}
            </p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <SvgStudents /> Alumnos
                    </span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                        {(entry.students || 0).toLocaleString()}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <SvgFlight /> Vuelos
                    </span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                        {entry.flights || 0}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <SvgMission /> Misiones
                    </span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                        {entry.missions || 0}
                    </span>
                </div>
                {schoolCount > 0 && (
                    <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-border/50">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <SvgSchool /> Escuelas
                        </span>
                        <span className="text-sm font-bold text-foreground tabular-nums">
                            {schoolCount}
                        </span>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
                Click para ver desglose
            </p>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   3. INLINE SCHOOL BREAKDOWN (expands inside card)
   ═══════════════════════════════════════════════════════ */
function InlineSchoolBreakdown({ entry, isDetailed, onClose }) {
    const contentRef = useRef(null);
    const [height, setHeight] = useState(0);
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        if (contentRef.current) {
            setHeight(contentRef.current.scrollHeight);
            // Trigger opacity after a small delay for staggered animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setOpacity(1));
            });
        }
        return () => { setHeight(0); setOpacity(0); };
    }, [entry]);

    if (!entry?.schools?.length) return null;

    const title = entry.monthLabel || entry.weekLabel || entry.label || '';
    const schools = entry.schools;

    return (
        <div
            className="overflow-hidden"
            style={{
                maxHeight: height > 0 ? `${height + 32}px` : '0px',
                transition: 'max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <div ref={contentRef} style={{ opacity, transition: 'opacity 0.4s ease 0.15s' }}>
                {/* Clean minimalist divider */}
                <div className="relative my-4 flex items-center justify-center">
                    <div className="w-full max-w-sm h-px" style={{ background: `linear-gradient(90deg, transparent, ${PRIMARY}40, transparent)` }} />
                </div>

                {/* Lista de Escuelas (espacio optimizado al remover resumen redundante) */}
                <div className="space-y-1 mt-3 pr-1">
                    {schools.map((s, i) => {
                        const max = schools[0]?.students || 1;
                        const pct = Math.round((s.students / max) * 100);
                        return (
                            <div
                                key={s.name + i}
                                className="group/school rounded-xl py-2 px-3 hover:bg-secondary/40 transition-all duration-200"
                                style={{
                                    opacity,
                                    transform: opacity === 1 ? 'translateY(0)' : 'translateY(8px)',
                                    transition: `opacity 0.4s ease ${0.1 + i * 0.04}s, transform 0.4s ease ${0.1 + i * 0.04}s`,
                                }}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold tabular-nums"
                                            style={{
                                                background: `linear-gradient(135deg, ${PRIMARY}15, ${PRIMARY}08)`,
                                                color: PRIMARY,
                                            }}>
                                            {i + 1}
                                        </span>
                                        <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                                        <span className="tabular-nums">
                                            <strong className="text-foreground">{s.students.toLocaleString()}</strong> alumnos
                                        </span>
                                        <span className="tabular-nums">{s.flights} vuelos</span>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden ml-8">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${pct}%`,
                                            background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_LIGHT})`,
                                            transition: `width 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${0.3 + i * 0.05}s`,
                                        }}
                                    />
                                </div>
                                
                                {isDetailed && (
                                    <div className="ml-8 mt-2.5 flex items-center gap-4 text-[11px] bg-accent/40 rounded-lg px-3 py-2 text-muted-foreground border border-border/50">
                                        <div className="flex gap-1.5 items-center">
                                            <span><strong className="text-foreground">{s.missions}</strong> {s.missions === 1 ? 'misión' : 'misiones'}</span>
                                        </div>
                                        <div className="flex gap-1.5 items-center">
                                            <span><strong className="text-foreground">{s.flights}</strong> vuelos logrados</span>
                                        </div>
                                        <div className="flex gap-1.5 items-center ml-auto">
                                            <span><strong className="text-foreground text-primary">{s.students}</strong> de impacto</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   4. CLICKABLE BAR CHART with per-bar highlight
   ═══════════════════════════════════════════════════════ */

function ClickableBarChart({ data, xKey, yKey, height = 340, onBarClick, selectedIndex }) {
    const [activeIdx, setActiveIdx] = useState(null);
    const containerRef = useRef(null);

    // Inject global CSS: focus suppression and smooth transitions for Recharts Cell paths
    useEffect(() => {
        const id = 'recharts-bar-styles-native';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `
                .recharts-wrapper, .recharts-wrapper *, .recharts-surface,
                .recharts-wrapper:focus, .recharts-wrapper *:focus,
                .recharts-surface:focus, .recharts-surface:focus-visible,
                .recharts-wrapper:focus-visible, .recharts-wrapper *:focus-visible {
                    outline: none !important;
                    box-shadow: none !important;
                    border-color: transparent !important;
                @keyframes bar-click-fluid {
                    from { transform: scaleY(1) scaleX(1); }
                    to { transform: scaleY(1.06) scaleX(1.03); }
                }

                .impact-bar-cell {
                    transition: fill 0.3s ease, fill-opacity 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease !important;
                    cursor: pointer;
                    transform-origin: bottom center;
                    /* Base transform default */
                    transform: scaleY(1) scaleX(1);
                }
                
                /* Micro-interacción: Hover sobre barras apagadas o sin selección total */
                .impact-bar-cell[data-selected="false"]:hover {
                    transform: scaleY(1.025);
                    filter: brightness(1.1);
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease !important;
                }

                /* Animación fluida de un solo latido elegante al seleccionar */
                .impact-bar-cell[data-selected="true"] {
                    animation: bar-click-fluid 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    const handleMouseDown = useCallback(() => {
        if (document.activeElement && containerRef.current?.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    }, []);

    return (
        <div ref={containerRef} onMouseDown={handleMouseDown}>
        <ResponsiveContainer width="100%" height={height}>
            <RechartsBarChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                onMouseMove={(state) => {
                    // Solo actualizamos activeIdx si existe y es un número válido
                    if (state && typeof state.activeTooltipIndex === 'number') {
                        setActiveIdx(state.activeTooltipIndex);
                    } else {
                        setActiveIdx(null);
                    }
                }}
                onMouseLeave={() => setActiveIdx(null)}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey={xKey} axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} dy={8} />
                <YAxis axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
                <Tooltip
                    content={<RichTooltip />}
                    cursor={false}
                />
                <Bar
                    dataKey={yKey}
                    maxBarSize={64}
                    isAnimationActive={true}
                    animationDuration={600}
                    radius={[8, 8, 8, 8]}
                    onClick={(data, index) => {
                        onBarClick?.(data, index);
                        setTimeout(() => document.activeElement?.blur(), 0);
                    }}
                    cursor="pointer"
                >
                    {data.map((entry, index) => {
                        // Garantizar que la comparación sea independiente de tipos conflictivos
                        const isSelected = selectedIndex != null && Number(index) === Number(selectedIndex);
                        const isDimmed = selectedIndex != null && !isSelected;
                        const isHovered = selectedIndex == null && Number(index) === Number(activeIdx);

                        return (
                            <Cell
                                key={`cell-${index}`}
                                className="impact-bar-cell"
                                fill={isSelected ? PRIMARY : isHovered ? PRIMARY_LIGHT : PRIMARY}
                                fillOpacity={isDimmed ? 0.35 : 1}
                                stroke="none"
                                strokeWidth={0}
                                data-selected={isSelected ? "true" : "false"}
                            />
                        );
                    })}
                </Bar>
            </RechartsBarChart>
        </ResponsiveContainer>
        </div>
    );
}
/* ═══════════════════════════════════════════════════════
   5. MAIN PANEL EXPORT
   ═══════════════════════════════════════════════════════ */
export default function PanelImpacto({ data, loading, filter }) {
    // ── Drill-Down State ──
    const chartCardRef = useRef(null);
    const unifiedGroupRef = useRef(null);

    // Initial state derived from filter
    const getInitialDrillPath = useCallback((currentFilter) => {
        if (!currentFilter || currentFilter.type === 'all') {
            return [{ level: 'year', filterValue: null, label: 'Vista General Histórica', parentData: null }];
        }
        if (currentFilter.type === 'month') {
            return [{ 
                level: 'week', 
                filterValue: `${currentFilter.year}-${String(currentFilter.month).padStart(2, '0')}`, 
                label: `Vista de Mes (${SHORT_MONTHS[String(currentFilter.month).padStart(2, '0')] || currentFilter.month} ${currentFilter.year})`, 
                parentData: null 
            }];
        }
        if (currentFilter.type === 'custom') {
            return [{ level: 'month', filterValue: null, label: 'Rango Personalizado', parentData: null }];
        }
        return [{ level: 'year', filterValue: null, label: 'Vista General', parentData: null }];
    }, []);

    const [drillPath, setDrillPath] = useState(getInitialDrillPath(filter));
    
    // Reset drill down when global filter changes
    useEffect(() => {
        setDrillPath(getInitialDrillPath(filter));
    }, [filter, getInitialDrillPath]);

    const currentDrill = drillPath[drillPath.length - 1];
    const isJoined = !!currentDrill.filterValue;
    const activeDrillNode = isJoined ? currentDrill : null;
    const selectedEntry = activeDrillNode ? activeDrillNode.parentData : null;
    const periodLabel = activeDrillNode ? activeDrillNode.label : null;

    // ── Prepare chart data based on drill level ──
    const processData = useCallback(() => {
        let list = [];
        if (currentDrill.level === 'year') {
            list = data?.yearlyTrend || [];
            list = list.map(y => ({ ...y, label: String(y.year), rawId: String(y.year) }));
        } else if (currentDrill.level === 'month') {
            list = data?.monthlyTrend || [];
            if (currentDrill.filterValue) {
               list = list.filter(m => m.month.startsWith(currentDrill.filterValue));
            }
            list = list.map(m => ({ ...m, label: SHORT_MONTHS[m.month.split('-')[1]] || m.month, rawId: m.month }));
        } else if (currentDrill.level === 'week') {
            list = data?.weeklyTrend || [];
            if (currentDrill.filterValue) {
               list = list.filter(w => {
                   const monday = new Date(`${w.week}T12:00:00Z`);
                   const sunday = new Date(monday);
                   sunday.setUTCDate(monday.getUTCDate() + 6);
                   const mStr = currentDrill.filterValue; // e.g. "2026-03"
                   return w.week.startsWith(mStr) || sunday.toISOString().startsWith(mStr);
               });
            }
            list = list.map((w, i) => {
                const monday = new Date(`${w.week}T12:00:00Z`);
                const labelStr = currentDrill.filterValue 
                    ? `Semana del ${monday.getUTCDate()}` 
                    : `S-${monday.getUTCDate()} ${SHORT_MONTHS[String(monday.getUTCMonth()+1).padStart(2,'0')]}`;
                return { ...w, label: labelStr, rawId: w.week };
            });
        } else if (currentDrill.level === 'day') {
            list = data?.dailyTrend || [];
            if (currentDrill.filterValue) { // e.g., '2026-03-02' (A Monday)
               const baseMonday = new Date(`${currentDrill.filterValue}T12:00:00Z`);
               const daysInWeek = Array.from({length: 7}, (_, i) => {
                   const d = new Date(baseMonday);
                   d.setUTCDate(baseMonday.getUTCDate() + i);
                   return d.toISOString().split('T')[0];
               });
               list = list.filter(d => daysInWeek.includes(d.day));
            }
            list = list.map((d) => {
                const date = new Date(`${d.day}T12:00:00Z`);
                const label = `${date.getUTCDate()} ${SHORT_MONTHS[String(date.getUTCMonth()+1).padStart(2,'0')]}`;
                return { ...d, label, rawId: d.day };
            });
        } else if (currentDrill.level === 'detail') {
            list = currentDrill.parentData?.schools || [];
            list = list.map((s) => ({ ...s, label: s.name.length > 20 ? s.name.substring(0, 17) + '...' : s.name, rawId: s.name }));
        }
        return list;
    }, [data, currentDrill]);

    const activeData = useMemo(() => processData(), [processData]);

    // ── Compute metrics: selected period or global ──

    const metrics = useMemo(() => {
        if (!data) return { students: 0, flights: 0, hours: 0, missions: 0, becados: 0, schools: 0 };
        if (selectedEntry) {
            return {
                students: selectedEntry.students || 0,
                flights: selectedEntry.flights || 0,
                missions: selectedEntry.missions || 0,
                hours: data.totalHours,
                becados: data.totalBecados || 0,
                schools: selectedEntry.schools?.length || 0
            };
        }
        return {
            students: data.totalStudents || 0,
            flights: data.totalFlights || 0,
            hours: data.totalHours || 0,
            missions: data.totalMissions || 0,
            becados: data.totalBecados || 0,
            schools: data.schoolTotals?.length || 0
        };
    }, [data, selectedEntry]);

    // ── Area chart adapts to view mode ──
    const areaData = useMemo(() =>
        activeData.map(d => ({
            label: d.label,
            Alumnos: d.students,
            Vuelos: d.flights,
        })), [activeData]);

    const handleBarClick = useCallback((entry) => {
        let nextLevel;
        if (currentDrill.level === 'year') nextLevel = 'month';
        else if (currentDrill.level === 'month') nextLevel = 'week';
        else if (currentDrill.level === 'week') nextLevel = 'day';
        else if (currentDrill.level === 'day') nextLevel = 'detail';
        else return; // No further drill down

        setDrillPath(prev => {
            return [...prev, {
                level: nextLevel,
                filterValue: entry.rawId,
                label: currentDrill.level === 'week' ? `Día ${entry.label}` : currentDrill.level === 'day' ? `Detalle ${entry.label}` : entry.label,
                parentData: entry
            }];
        });

        // Auto-scroll the unified group into view
        setTimeout(() => {
            if (unifiedGroupRef.current) {
                const header = document.querySelector('header');
                const headerHeight = header?.getBoundingClientRect().height || 72;
                const groupTop = unifiedGroupRef.current.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({
                    top: groupTop - headerHeight - 16,
                    behavior: 'smooth',
                });
            }
        }, 100);
    }, [currentDrill]);

    const goBack = useCallback(() => {
        setDrillPath(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
    }, []);

    const jumpToLevel = useCallback((levelStr, labelStr) => {
        setDrillPath([{ level: levelStr, filterValue: null, label: labelStr, parentData: null }]);
    }, []);

    if (loading) return <SkeletonPanel />;
    if (!data) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header text */}
            <div className="flex items-center justify-between mb-4">
                <div className={`transition-opacity duration-500 ${isJoined ? 'opacity-0 h-0 hidden' : 'opacity-100'}`}>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Impacto General</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Resumen del impacto global de las misiones Fly High
                    </p>
                </div>
            </div>

            {/* ── Unified Report Group ── */}
            <div 
                ref={unifiedGroupRef}
                className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative -mx-2 -my-2 p-2 border ${
                isJoined 
                ? 'bg-card border-primary/20 shadow-2xl shadow-primary/5 rounded-[2rem] z-10' 
                : 'bg-transparent border-transparent rounded-[2rem]'
            }`}>
                
                {/* Metric Cards Row */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    isJoined ? 'gap-2 mb-2 p-2 bg-transparent rounded-[1.5rem]' : 'gap-4 mb-6 p-0 bg-transparent rounded-[1.5rem]'
                }`}>
                    <MetricCard icon="👧🏽" label="Alumnos atendidos" value={metrics.students}
                        sublabel={selectedEntry ? `En ${periodLabel}` : `${metrics.becados.toLocaleString()} becados`} accent={PRIMARY} isJoined={isJoined} />
                    <MetricCard icon="🛩️" label="Vuelos realizados" value={metrics.flights}
                        sublabel={`${metrics.missions} misiones`} accent={ACCENT} isJoined={isJoined} />
                    <MetricCard icon="⏱️" label="Horas de operación" value={metrics.hours}
                        sublabel="Tiempo acumulado de vuelo" accent="#ec4899" isJoined={isJoined} />
                    <MetricCard icon="🏫" label="Total de Escuelas" value={metrics.schools}
                        sublabel={selectedEntry ? `En ${periodLabel}` : "Acumulado global"} accent="#10b981" isJoined={isJoined} />
                </div>

                {/* ── Bar Chart Card — expands inline ── */}
                <div
                    ref={chartCardRef}
                    className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] border ${
                        isJoined 
                        ? 'p-6 bg-transparent border-transparent rounded-2xl' 
                        : 'rounded-2xl border-border bg-card p-6'
                    }`}
                >
                    <div className="mb-6 flex items-start sm:items-center flex-col sm:flex-row justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">
                                Alumnos Atendidos 
                                {isJoined 
                                    ? <span className="text-muted-foreground font-normal"> · Desglose {periodLabel}</span>
                                    : <span className="text-muted-foreground font-normal"> · Agrupación Mensual/Semanal</span>
                                }
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {currentDrill.level === 'day' 
                                    ? 'Visualizando impacto por día' 
                                    : 'Haz click en una barra para profundizar en ese periodo temporal'
                                }
                            </p>
                        </div>
                        
                        <div className="flex flex-col-reverse sm:flex-row items-end sm:items-center gap-3">
                            {/* Selector de Granularidad Global */}
                            <div className="flex items-center p-1 bg-muted/40 border border-border/50 rounded-xl">
                                {[
                                    { id: 'year', label: 'Año' },
                                    { id: 'month', label: 'Mes' },
                                    { id: 'week', label: 'Sem' },
                                    { id: 'day', label: 'Día' }
                                ].map(opt => {
                                    const isActive = currentDrill.level === opt.id && !currentDrill.filterValue;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => jumpToLevel(opt.id, `Vista Global por ${opt.label}`)}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                isActive ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Botón Volver (solo en inmersión activa) */}
                            {drillPath.length > 1 && (
                                <button
                                    onClick={goBack}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary/80 text-foreground hover:bg-secondary transition-all duration-200 animate-in fade-in zoom-in-95"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                                    Volver atrás
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="transition-[height] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden" style={{ height: isJoined ? 240 : 340 }}>
                        <ClickableBarChart
                            data={activeData}
                            xKey="label"
                            yKey="students"
                            height={isJoined ? 240 : 340}
                            onBarClick={handleBarClick}
                            selectedIndex={null} // We don't retain highlight, the whole chart zooms in
                        />
                    </div>

                    {/* ── Inline Expansion: school breakdown ── */}
                    {selectedEntry && selectedEntry.schools?.length > 0 && (
                        <InlineSchoolBreakdown
                            key={currentDrill.filterValue} // Re-animate on path change
                            entry={selectedEntry}
                            isDetailed={currentDrill.level === 'detail'}
                            onClose={goBack}
                        />
                    )}
                </div>
            </div>

            {/* ── Area Chart: Adapts to view mode ── */}
            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Tendencia General de Crecimiento</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Evolución de alumnos y vuelos de manera global
                        </p>
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

            {/* ── School Rankings — reactive to selected period ── */}
            {data.schoolTotals && data.schoolTotals.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="mb-5">
                        <h3 className="text-lg font-semibold text-foreground">Rankings por Escuela</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {selectedEntry && selectedEntry.schools?.length > 0
                                ? `Escuelas de ${periodLabel}`
                                : 'Contribución acumulada por institución'
                            }
                        </p>
                    </div>
                    <div className="space-y-3">
                        {(selectedEntry?.schools?.length > 0 ? selectedEntry.schools : data.schoolTotals).map((school, i) => {
                            const list = selectedEntry?.schools?.length > 0 ? selectedEntry.schools : data.schoolTotals;
                            const max = list[0]?.students || 1;
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
        </div>
    );
}
