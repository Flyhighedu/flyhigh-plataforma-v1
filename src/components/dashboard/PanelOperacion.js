"use client";

import { ProgressCircle, TremorBarChart } from './TremorCharts';
import { SkeletonPanel, SkeletonProgressCircle } from './SkeletonCard';

function CycleTimeCard({ label, value, unit = 'min' }) {
    // Un ciclo total (vuelo + espera) óptimo es < 12min. Aceptable < 18min. Requiere atención > 18min.
    const color = value <= 12 ? '#10b981' : value <= 18 ? '#f59e0b' : '#ef4444';
    const bgColor = value <= 12 ? 'bg-emerald-50 dark:bg-emerald-950/30' : value <= 18 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30';
    const borderColor = value <= 12 ? 'border-emerald-200 dark:border-emerald-800' : value <= 18 ? 'border-amber-200 dark:border-amber-800' : 'border-red-200 dark:border-red-800';

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
                    {value <= 12 ? 'Óptimo' : value <= 18 ? 'Aceptable' : 'Requiere atención'}
                </span>
            </div>
        </div>
    );
}

function StatMini({ label, value, icon, className = "" }) {
    return (
        <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 line-clamp-1">
                <span>{icon}</span>{label}
            </p>
            <p className="text-2xl lg:text-3xl font-extrabold text-foreground mt-2">{value}</p>
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

            {/* Top Row — Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Capacity */}
                <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-center items-center">
                    <ProgressCircle
                        value={data.capacityUtilization}
                        label="Utilización de Capacidad"
                        sublabel={`${data.totalFlightRecords} vuelos registrados`}
                    />
                </div>

                {/* Time Metrics Column */}
                <div className="grid grid-cols-1 gap-4">
                    <CycleTimeCard
                        label="Duración del ciclo total"
                        value={data.cycleTimeMinutes}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <StatMini label="Prom. de Vuelo" value={`${avgDurationMin}m`} icon="⏱️" />
                        <StatMini label="Entre Vuelos" value={`${data.avgWaitMinutes}m`} icon="⏳" />
                    </div>
                </div>

                {/* Efficiency Column */}
                <div className="grid grid-cols-1 gap-4">
                    <StatMini label="Alumnos / hora" value={data.avgStudentsPerHour} icon="🚀" className="bg-primary/5 border-primary/20" />
                    <div className="grid grid-cols-2 gap-4">
                        <StatMini label="Vuelos / Misión" value={data.flightsPerMission} icon="📊" />
                        <StatMini label="Vuelos Totales" value={data.totalFlightRecords?.toLocaleString()} icon="📋" />
                    </div>
                </div>
            </div>

            {/* Bottom Row — Distribution Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Flight Duration Distribution */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex justify-between items-baseline mb-4">
                        <h3 className="text-lg font-semibold text-foreground">Duración de Vuelo</h3>
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-1 rounded-md">
                            Prom: {Math.round(data.avgFlightDuration / 60 * 10) / 10}m
                        </span>
                    </div>
                    <TremorBarChart
                        data={data.durationDistribution || []}
                        index="range"
                        categories={['count']}
                        colors={['#8b5cf6']}
                        height={240}
                    />
                </div>

                {/* Wait Time Distribution */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex justify-between items-baseline mb-4">
                        <h3 className="text-lg font-semibold text-foreground">Tiempo Entre Vuelos</h3>
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md">
                            Prom: {data.avgWaitMinutes}m
                        </span>
                    </div>
                    <TremorBarChart
                        data={data.waitDistribution || []}
                        index="range"
                        categories={['count']}
                        colors={['#f59e0b']}
                        height={240}
                    />
                </div>

                {/* Students per Flight Distribution */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex justify-between items-baseline mb-4">
                        <h3 className="text-lg font-semibold text-foreground">Alumnos por Vuelo</h3>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md">
                            Prom: {data.avgStudentsPerFlight}
                        </span>
                    </div>
                    <TremorBarChart
                        data={data.studentsDistribution || []}
                        index="range"
                        categories={['count']}
                        colors={['#10b981']}
                        height={240}
                    />
                </div>
            </div>
        </div>
    );
}
