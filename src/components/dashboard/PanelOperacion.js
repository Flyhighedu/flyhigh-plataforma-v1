"use client";

import { ProgressCircle, TremorBarChart } from './TremorCharts';
import { SkeletonPanel, SkeletonProgressCircle } from './SkeletonCard';

function WaitTimeCard({ label, value, unit = 'min' }) {
    const color = value <= 10 ? '#10b981' : value <= 20 ? '#f59e0b' : '#ef4444';
    const bgColor = value <= 10 ? 'bg-emerald-50 dark:bg-emerald-950/30' : value <= 20 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30';
    const borderColor = value <= 10 ? 'border-emerald-200 dark:border-emerald-800' : value <= 20 ? 'border-amber-200 dark:border-amber-800' : 'border-red-200 dark:border-red-800';

    return (
        <div className={`rounded-2xl border ${borderColor} ${bgColor} p-5 transition-all duration-300 hover:shadow-md`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
            <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold" style={{ color }}>{value}</span>
                <span className="text-sm font-medium text-muted-foreground">{unit}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">
                    {value <= 10 ? 'Óptimo' : value <= 20 ? 'Aceptable' : 'Requiere atención'}
                </span>
            </div>
        </div>
    );
}

function StatMini({ label, value, icon }) {
    return (
        <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>{icon}</span>{label}
            </p>
            <p className="text-3xl font-extrabold text-foreground mt-2">{value}</p>
        </div>
    );
}

export default function PanelOperacion({ data, loading }) {
    if (loading) return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <SkeletonProgressCircle />
                <SkeletonProgressCircle />
                <SkeletonProgressCircle />
            </div>
            <SkeletonPanel />
        </div>
    );
    if (!data) return null;

    const avgDurationMin = Math.round(data.avgFlightDuration / 60 * 10) / 10;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Eficiencia Operativa</h2>
                <p className="text-sm text-muted-foreground mt-1">Métricas de rendimiento de vuelos y utilización de capacidad</p>
            </div>

            {/* Top Row — Circles + Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ProgressCircle — Capacity Utilization */}
                <div className="rounded-2xl border border-border bg-card p-6 flex justify-center">
                    <ProgressCircle
                        value={data.capacityUtilization}
                        label="Utilización de Capacidad"
                        sublabel={`${data.totalFlightRecords} vuelos registrados`}
                    />
                </div>

                {/* Wait Time Card */}
                <WaitTimeCard
                    label="Tiempo de espera promedio"
                    value={data.avgWaitMinutes}
                />

                <div className="grid grid-cols-1 gap-4">
                    <StatMini label="Duración promedio" value={`${avgDurationMin} min`} icon="⏱️" />
                    <StatMini label="Vuelos/Misión" value={data.flightsPerMission} icon="📊" />
                </div>
            </div>

            {/* Bottom Row — Stats grid + Distribution Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="grid grid-cols-2 gap-4">
                    <StatMini label="Registros de vuelo" value={data.totalFlightRecords?.toLocaleString()} icon="📋" />
                    <StatMini label="Alumnos/Vuelo" value={data.avgStudentsPerFlight} icon="👧🏽" />
                </div>

                {/* Flight Duration Distribution */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Distribución de Duración</h3>
                    <TremorBarChart
                        data={data.durationDistribution || []}
                        index="range"
                        categories={['count']}
                        colors={['#8b5cf6']}
                        height={200}
                    />
                </div>
            </div>
        </div>
    );
}
