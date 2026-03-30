"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PanelImpacto from '@/components/dashboard/PanelImpacto';
import PanelOperacion from '@/components/dashboard/PanelOperacion';
import PanelEscuelas from '@/components/dashboard/PanelEscuelas';
import PanelPatrocinios from '@/components/dashboard/PanelPatrocinios';
import PanelReportes from '@/components/dashboard/PanelReportes';
import { Loader2 } from 'lucide-react';



/* ── Period Selector UI (Adapter para Admin Layout Neumorfico) ── */
function PeriodSelector({ filter, setFilter }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('mes'); // 'general', 'mes', 'rango'
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const triggerLabel = () => {
        if (filter.type === 'month') return `${months[filter.month - 1]} ${filter.year}`;
        if (filter.type === 'custom') return `${filter.start} al ${filter.end}`;
        return 'Todo el tiempo';
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="neu-list-item flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm group min-w-[200px] justify-between"
            >
                <div className="flex items-center gap-2">
                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">📅</span>
                    <span className="neu-text whitespace-nowrap">{triggerLabel()}</span>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-80 rounded-[1.5rem] neu-card z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ padding: 0 }}>
                        {/* Tabs del selector */}
                        <div className="flex border-b border-black/5 dark:border-white/5 p-2 gap-1 bg-black/5 dark:bg-black/20" style={{ borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem' }}>
                            {['general', 'mes', 'rango'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 text-xs font-bold py-2.5 rounded-xl capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-500 scale-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            {activeTab === 'general' && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => { setFilter({ type: 'all' }); setIsOpen(false); }}
                                        className={`w-full text-left px-5 py-4 rounded-2xl text-sm transition-all font-bold ${filter.type === 'all' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        🌐 Todo el tiempo
                                    </button>
                                </div>
                            )}

                            {activeTab === 'mes' && (
                                <div>
                                    <div className="flex justify-between items-center mb-5 px-3">
                                        <button onClick={() => setYear(y => y - 1)} className="p-2 hover:bg-black/5 rounded-xl text-slate-500 transition-colors active:scale-95">◀</button>
                                        <span className="font-black text-lg neu-text">{year}</span>
                                        <button onClick={() => setYear(y => y + 1)} className="p-2 hover:bg-black/5 rounded-xl text-slate-500 transition-colors active:scale-95">▶</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {months.map((m, i) => {
                                            const isSelected = filter.type === 'month' && filter.month === i + 1 && filter.year === year;
                                            return (
                                                <button
                                                    key={m}
                                                    onClick={() => { setFilter({ type: 'month', year, month: i + 1 }); setIsOpen(false); }}
                                                    className={`py-3 rounded-2xl text-xs font-bold transition-all ${isSelected ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 scale-105' : 'bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:scale-105 active:scale-95'}`}
                                                >
                                                    {m}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'rango' && (
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Desde</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full neu-input-inset rounded-xl px-4 py-3 text-sm font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Hasta</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full neu-input-inset rounded-xl px-4 py-3 text-sm font-semibold"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        disabled={!startDate || !endDate}
                                        onClick={() => { setFilter({ type: 'custom', start: startDate, end: endDate }); setIsOpen(false); }}
                                        className="w-full py-4 mt-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                                    >
                                        Aplicar Rango
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function AnalyticsView({ activeTab = 'analytics-impacto' }) {
    const activeSubTab = activeTab.replace('analytics-', '');
    const [filter, setFilter] = useState({ type: 'month', year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = '/api/sandbox-dashboards?';
            const effectiveFilter = activeSubTab === 'impacto' ? { type: 'all' } : filter;

            if (effectiveFilter.type === 'month') {
                const start = `${filter.year}-${String(filter.month).padStart(2, '0')}-01`;
                const nextMonth = filter.month === 12 ? 1 : filter.month + 1;
                const nextYear = filter.month === 12 ? filter.year + 1 : filter.year;
                const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
                query += `start=${start}&end=${end}`;
            } else if (filter.type === 'custom') {
                query += `start=${filter.start}&end=${filter.end}T23:59:59.999Z`;
            } else {
                query += `range=all`;
            }

            const res = await fetch(query);
            if (!res.ok) throw new Error('Error al cargar datos');
            const json = await res.json();
            setData(json);
        } catch (err) {
            setError(err.message);
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [filter, activeSubTab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const panelMap = {
        impacto: <PanelImpacto data={data?.impacto} loading={loading} filter={filter} />,
        operacion: <PanelOperacion data={data?.operacion} loading={loading} />,
        escuelas: <PanelEscuelas data={data?.escuelas} loading={loading} />,
        patrocinios: <PanelPatrocinios data={data?.patrocinios} loading={loading} />,
        reportes: <PanelReportes data={data} filter={filter} setFilter={setFilter} loading={loading} />,
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 -mt-2">
            {/* Header de la vista combinada neumórfica */}
            <div className={`flex flex-col md:flex-row md:items-center ${activeSubTab !== 'impacto' && activeSubTab !== 'reportes' ? 'justify-end' : 'justify-between'} gap-6 mb-8`}>

                {/* Controles: Selector de periodo solo para paneles compatibles */}
                {activeSubTab !== 'impacto' && activeSubTab !== 'reportes' && (
                    <div className="flex-shrink-0">
                        <PeriodSelector filter={filter} setFilter={setFilter} />
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div className="neu-list-item !border-red-500/30 !bg-red-500/5 mb-8 p-5 flex items-center justify-between gap-4 w-full">
                    <p className="text-sm text-red-600 dark:text-red-400 font-bold whitespace-nowrap flex-1 truncate">
                        ⚠️ Hubo un error al cargar métricas: {error}
                    </p>
                    <button
                        onClick={fetchData}
                        className="flex-shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-colors shadow-sm shadow-red-500/30 hover:shadow-red-500/50"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Panel Principal */}
            <div className={`relative transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'} min-h-[500px]`}>
                 {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-4 rounded-3xl shadow-2xl">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        </div>
                    </div>
                 )}
                 {panelMap[activeSubTab]}
            </div>
        </div>
    );
}
