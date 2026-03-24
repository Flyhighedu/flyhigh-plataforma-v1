"use client";

import { TremorDonutChart, TremorProgressBar } from './TremorCharts';
import { SkeletonPanel, SkeletonChart } from './SkeletonCard';

const CATEGORY_COLORS = {
    Combustible: '#ef4444',
    Mantenimiento: '#f59e0b',
    Logística: '#3b82f6',
    Personal: '#10b981',
};

const CATEGORY_ICONS = {
    Combustible: '⛽',
    Mantenimiento: '🔧',
    Logística: '🚛',
    Personal: '👥',
};

export default function PanelPatrocinios({ data, loading }) {
    if (loading) return (
        <div className="space-y-6">
            <SkeletonPanel />
            <SkeletonChart height={300} />
        </div>
    );
    if (!data) return null;

    const donutData = (data.sponsors || []).map(s => ({
        name: s.name,
        value: s.total,
    }));

    const consumptionPercent = data.totalAssigned > 0
        ? Math.round((data.totalConsumed / data.totalAssigned) * 100)
        : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Fondo de Patrocinadores</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Distribución y consumo del presupuesto de patrocinio
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="rounded-2xl border border-border bg-card p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fondo Total</p>
                    <p className="text-3xl font-extrabold text-foreground mt-2">
                        ${data.totalFund?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{data.sponsors?.length || 0} patrocinadores</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Presupuesto Asignado</p>
                    <p className="text-3xl font-extrabold text-foreground mt-2">
                        ${data.totalAssigned?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Distribuido en 4 categorías</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consumido</p>
                    <p className="text-3xl font-extrabold mt-2" style={{ color: consumptionPercent > 85 ? '#ef4444' : consumptionPercent > 60 ? '#f59e0b' : '#10b981' }}>
                        ${data.totalConsumed?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{consumptionPercent}% del presupuesto</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut Chart — Sponsor Distribution */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Reparto por Patrocinador</h3>
                    <p className="text-xs text-muted-foreground mb-4">Aportación total de cada patrocinador</p>
                    <TremorDonutChart
                        data={donutData}
                        nameKey="name"
                        valueKey="value"
                        colors={['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b']}
                        height={300}
                        centerLabel={`$${Math.round(data.totalFund / 1000)}k`}
                    />
                </div>

                {/* Category Progress Bars */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Consumo por Categoría</h3>
                    <p className="text-xs text-muted-foreground mb-6">Porcentaje utilizado del presupuesto asignado</p>
                    <div className="space-y-6">
                        {(data.categoryBreakdown || []).map(cat => {
                            const pct = cat.assigned > 0 ? Math.round((cat.consumed / cat.assigned) * 100) : 0;
                            return (
                                <TremorProgressBar
                                    key={cat.category}
                                    value={pct}
                                    label={`${CATEGORY_ICONS[cat.category] || '📦'} ${cat.category}`}
                                    sublabel={`$${cat.consumed.toLocaleString()} / $${cat.assigned.toLocaleString()}`}
                                    color={CATEGORY_COLORS[cat.category] || '#6366f1'}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Detail Table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">Detalle por Patrocinador y Categoría</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10">
                            <tr>
                                <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Patrocinador</th>
                                <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Categoría</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Asignado</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Consumido</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Restante</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(data.fundDetail || []).map((row, i) => {
                                const pct = row.assigned > 0 ? Math.round((row.consumed / row.assigned) * 100) : 0;
                                const remaining = row.assigned - row.consumed;
                                return (
                                    <tr key={i} className="hover:bg-accent/40 transition-colors">
                                        <td className="px-6 py-3.5 font-medium text-foreground">{row.sponsor}</td>
                                        <td className="px-6 py-3.5 text-muted-foreground">
                                            {CATEGORY_ICONS[row.category] || '📦'} {row.category}
                                        </td>
                                        <td className="px-6 py-3.5 text-right font-semibold text-foreground">${row.assigned.toLocaleString()}</td>
                                        <td className="px-6 py-3.5 text-right text-muted-foreground">${row.consumed.toLocaleString()}</td>
                                        <td className="px-6 py-3.5 text-right" style={{ color: remaining < 0 ? '#ef4444' : '#10b981' }}>
                                            ${remaining.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3.5 text-right">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                                                ${pct > 85 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                                    : pct > 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                                                {pct}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
