"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import PanelImpacto from '@/components/dashboard/PanelImpacto';
import PanelOperacion from '@/components/dashboard/PanelOperacion';
import PanelEscuelas from '@/components/dashboard/PanelEscuelas';
import PanelPatrocinios from '@/components/dashboard/PanelPatrocinios';

/* ── Tab Config ── */
const TABS = [
    { id: 'impacto', label: 'Impacto', icon: '🚀', description: 'Impacto global de misiones' },
    { id: 'operacion', label: 'Operación', icon: '⚡', description: 'Eficiencia operativa' },
    { id: 'escuelas', label: 'Escuelas', icon: '🏫', description: 'Operación por escuela' },
    { id: 'patrocinios', label: 'Patrocinios', icon: '💎', description: 'Fondo de patrocinadores' },
];

/* ── Period Selector UI ── */
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/50 text-sm font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
            >
                <span className="text-muted-foreground">📅</span>
                {triggerLabel()}
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Tabs */}
                        <div className="flex border-b border-border bg-muted/40 p-2 gap-1 rounded-t-2xl">
                            {['general', 'mes', 'rango'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg capitalize transition-colors ${activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {activeTab === 'general' && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => { setFilter({ type: 'all' }); setIsOpen(false); }}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${filter.type === 'all' ? 'bg-primary/10 text-primary font-bold shadow-inner' : 'hover:bg-accent text-foreground'}`}
                                    >
                                        🌐 Todo el tiempo
                                    </button>
                                </div>
                            )}

                            {activeTab === 'mes' && (
                                <div>
                                    <div className="flex justify-between items-center mb-4 px-2">
                                        <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-accent rounded-lg text-muted-foreground transition-colors">◀</button>
                                        <span className="font-bold text-foreground text-sm">{year}</span>
                                        <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-accent rounded-lg text-muted-foreground transition-colors">▶</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {months.map((m, i) => {
                                            const isSelected = filter.type === 'month' && filter.month === i + 1 && filter.year === year;
                                            return (
                                                <button
                                                    key={m}
                                                    onClick={() => { setFilter({ type: 'month', year, month: i + 1 }); setIsOpen(false); }}
                                                    className={`py-2 rounded-xl text-sm font-medium transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'bg-muted/30 hover:bg-accent text-muted-foreground hover:text-foreground'}`}
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
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full bg-accent/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full bg-accent/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        disabled={!startDate || !endDate}
                                        onClick={() => { setFilter({ type: 'custom', start: startDate, end: endDate }); setIsOpen(false); }}
                                        className="w-full py-2.5 mt-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
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

/* ── Theme Switch ── */
function ThemeSwitch() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="w-16 h-8" />;

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 shadow-inner"
            style={{ backgroundColor: isDark ? '#6366f1' : '#e2e8f0' }}
            aria-label="Toggle theme"
        >
            <span
                className="absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300"
                style={{ transform: isDark ? 'translateX(32px)' : 'translateX(0)' }}
            >
                {isDark ? '🌙' : '☀️'}
            </span>
        </button>
    );
}

/* ── Sidebar ── */
function Sidebar({ activeTab, onTabChange }) {
    return (
        <aside className="fixed left-0 top-0 bottom-0 w-[260px] border-r border-border bg-card/80 backdrop-blur-xl z-30 flex flex-col">
            {/* Logo */}
            <div className="px-6 py-6 border-b border-border">
                <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-sm">✈️</span>
                    <div>
                        <h1 className="text-base font-extrabold tracking-tight text-foreground">Fly High</h1>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Analytics</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                                ${isActive
                                    ? 'bg-primary/10 text-primary shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                        >
                            <span className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                                {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-medium">
                    Datos en tiempo real · Supabase
                </p>
            </div>
        </aside>
    );
}

/* ── Top Bar ── */
function TopBar({ activeTab, filter, setFilter }) {
    const tabInfo = TABS.find(t => t.id === activeTab);

    return (
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-xl">
            <div className="flex items-center justify-between px-8 py-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <span>{tabInfo?.icon}</span>
                        {tabInfo?.label}
                    </h2>
                    <p className="text-xs text-muted-foreground">{tabInfo?.description}</p>
                </div>

                <div className="flex items-center gap-4">
                    {activeTab !== 'impacto' && <PeriodSelector filter={filter} setFilter={setFilter} />}
                    <ThemeSwitch />
                </div>
            </div>
        </header>
    );
}

/* ── Main Page ── */
export default function SandboxDashboardsPage() {
    const [activeTab, setActiveTab] = useState('impacto');
    const [filter, setFilter] = useState({ type: 'month', year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = '/api/sandbox-dashboards?';
            const effectiveFilter = activeTab === 'impacto' ? { type: 'all' } : filter;

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
    }, [filter, activeTab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const panelMap = {
        impacto: <PanelImpacto data={data?.impacto} loading={loading} filter={filter} />,
        operacion: <PanelOperacion data={data?.operacion} loading={loading} />,
        escuelas: <PanelEscuelas data={data?.escuelas} loading={loading} />,
        patrocinios: <PanelPatrocinios data={data?.patrocinios} loading={loading} />,
    };

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 ml-[260px] relative">
                <TopBar
                    activeTab={activeTab}
                    filter={filter}
                    setFilter={setFilter}
                />

                <main className="px-8 py-6">
                    {loading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none transition-opacity duration-300">
                            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin shadow-lg"></div>
                        </div>
                    )}
                    {error && (
                        <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                                ⚠️ {error}
                            </p>
                            <button
                                onClick={fetchData}
                                className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold hover:text-red-800 transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                    <div className={loading ? 'opacity-40 transition-opacity pointer-events-none' : 'opacity-100 transition-opacity'}>
                        {panelMap[activeTab]}
                    </div>
                </main>
            </div>
        </div>
    );
}
