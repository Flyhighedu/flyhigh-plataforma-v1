"use client";

import { TremorBarChart } from './TremorCharts';
import { SkeletonPanel } from './SkeletonCard';

const MONTH_NAMES = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function MetricCard({ icon, label, value, sublabel, accent }) {
    return (
        <div className="group relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 overflow-hidden">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(135deg, ${accent}08, transparent 60%)` }} />
            <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
                <p className="text-4xl font-extrabold tracking-tight text-foreground">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                {sublabel && <p className="text-sm text-muted-foreground">{sublabel}</p>}
            </div>
            <div className="absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full w-0"
                style={{ backgroundColor: accent }} />
        </div>
    );
}

export default function PanelImpacto({ data, loading }) {
    if (loading) return <SkeletonPanel />;
    if (!data) return null;

    const trendData = (data.monthlyTrend || []).map(t => ({
        ...t,
        month: MONTH_NAMES[t.month.split('-')[1]] || t.month,
    }));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Impacto General</h2>
                <p className="text-sm text-muted-foreground mt-1">Resumen del impacto global de las misiones Fly High</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                    icon="👧🏽"
                    label="Alumnos atendidos"
                    value={data.totalStudents}
                    sublabel={`${data.totalBecados.toLocaleString()} becados`}
                    accent="#6366f1"
                />
                <MetricCard
                    icon="🛩️"
                    label="Vuelos realizados"
                    value={data.totalFlights}
                    sublabel={`${data.totalMissions} misiones`}
                    accent="#8b5cf6"
                />
                <MetricCard
                    icon="⏱️"
                    label="Horas de operación"
                    value={data.totalHours}
                    sublabel="Tiempo acumulado de vuelo"
                    accent="#ec4899"
                />
                <MetricCard
                    icon="🎯"
                    label="Meta patrocinados"
                    value={data.sponsoredKidsGoal?.toLocaleString()}
                    sublabel={`${Math.round((data.totalStudents / (data.sponsoredKidsGoal || 1)) * 100)}% alcanzado`}
                    accent="#10b981"
                />
            </div>

            {/* Bar Chart */}
            <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Tendencia Mensual</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Alumnos y vuelos por mes</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
                            Alumnos
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8b5cf6' }} />
                            Vuelos
                        </span>
                    </div>
                </div>
                <TremorBarChart
                    data={trendData}
                    index="month"
                    categories={['students', 'flights']}
                    colors={['#6366f1', '#8b5cf6']}
                    height={340}
                />
            </div>
        </div>
    );
}
