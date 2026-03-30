"use client";

import { SkeletonPanel, SkeletonTable } from './SkeletonCard';

function TopSchoolCard({ rank, name, students, flights, missions }) {
    const medals = ['🥇', '🥈', '🥉'];
    const gradients = [
        'from-amber-400/20 to-yellow-400/5 border-amber-300 dark:border-amber-700',
        'from-slate-300/20 to-gray-300/5 border-slate-300 dark:border-slate-600',
        'from-orange-400/15 to-amber-300/5 border-orange-300 dark:border-orange-700',
    ];

    return (
        <div className={`neu-list-item relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1`}>
            <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${gradients[rank] || gradients[2]} pointer-events-none break-inside-avoid`} />
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <span className="text-3xl">{medals[rank] || '🏅'}</span>
                    <h4 className="text-base font-bold text-foreground leading-tight">{name}</h4>
                </div>
                <span className="text-xs font-bold text-muted-foreground bg-secondary rounded-full px-2.5 py-1">
                    #{rank + 1}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                    <p className="text-xs text-muted-foreground">Alumnos</p>
                    <p className="text-lg font-extrabold text-foreground">{students.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Vuelos</p>
                    <p className="text-lg font-extrabold text-foreground">{flights.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Misiones</p>
                    <p className="text-lg font-extrabold text-foreground">{missions}</p>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        closed: { label: 'Cerrada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
        operation: { label: 'Operación', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
        prep: { label: 'Preparación', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
        report: { label: 'Reporte', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
    };
    const s = map[status] || { label: status, cls: 'bg-secondary text-muted-foreground' };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            {s.label}
        </span>
    );
}

export default function PanelEscuelas({ data, loading }) {
    if (loading) return (
        <div className="space-y-6">
            <SkeletonPanel />
            <SkeletonTable rows={6} />
        </div>
    );
    if (!data) return null;

    const top3 = (data.topSchools || []).slice(0, 3);
    const restSchools = (data.topSchools || []).slice(3);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Operación por Escuela</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {data.visitedCount} de {data.totalCatalog} escuelas del catálogo visitadas
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                    <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">
                        {data.visitedCount} visitadas
                    </span>
                </div>
            </div>

            {/* Top 3 Schools */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {top3.map((school, i) => (
                    <TopSchoolCard
                        key={school.name}
                        rank={i}
                        name={school.name}
                        students={school.students}
                        flights={school.flights}
                        missions={school.missions}
                    />
                ))}
            </div>

            {/* Ranking Table (4th onward) */}
            {restSchools.length > 0 && (
                <div className="neu-list-item overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/40">
                        <h3 className="text-base font-semibold text-foreground">Ranking completo</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-secondary/50 backdrop-blur-sm z-10">
                                <tr>
                                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</th>
                                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escuela</th>
                                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Alumnos</th>
                                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Vuelos</th>
                                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Misiones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {restSchools.map((s, i) => (
                                    <tr key={s.name} className="hover:bg-accent/40 transition-colors">
                                        <td className="px-6 py-3.5 font-semibold text-muted-foreground">{i + 4}</td>
                                        <td className="px-6 py-3.5 font-medium text-foreground">{s.name}</td>
                                        <td className="px-6 py-3.5 text-right font-semibold text-foreground">{s.students.toLocaleString()}</td>
                                        <td className="px-6 py-3.5 text-right text-muted-foreground">{s.flights.toLocaleString()}</td>
                                        <td className="px-6 py-3.5 text-right text-muted-foreground">{s.missions}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Mission History Table */}
            <div className="neu-list-item overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40">
                    <h3 className="text-base font-semibold text-foreground">Historial de Misiones</h3>
                </div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10">
                            <tr>
                                <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Fecha</th>
                                <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escuela</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Alumnos</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Vuelos</th>
                                <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Becados</th>
                                <th className="text-center px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(data.history || []).map((h, i) => (
                                <tr key={i} className="hover:bg-accent/40 transition-colors">
                                    <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">{h.date}</td>
                                    <td className="px-6 py-3.5 font-medium text-foreground">{h.school}</td>
                                    <td className="px-6 py-3.5 text-right font-semibold text-foreground">{h.students.toLocaleString()}</td>
                                    <td className="px-6 py-3.5 text-right text-muted-foreground">{h.flights.toLocaleString()}</td>
                                    <td className="px-6 py-3.5 text-right text-muted-foreground">{h.becados}</td>
                                    <td className="px-6 py-3.5 text-center"><StatusBadge status={h.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
