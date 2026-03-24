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

const DATE_FILTERS = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
    { value: 'all', label: 'Todo' },
];

/* ── Theme Toggle Switch ── */
function ThemeSwitch() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="w-16 h-8" />;

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
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
                    <span className="text-2xl">✈️</span>
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
                <p className="text-[10px] text-muted-foreground">
                    Datos en tiempo real · Supabase
                </p>
            </div>
        </aside>
    );
}

/* ── Top Bar ── */
function TopBar({ activeTab, dateRange, onDateChange }) {
    const tabInfo = TABS.find(t => t.id === activeTab);
    const [filterOpen, setFilterOpen] = useState(false);

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
                    {/* Date Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setFilterOpen(!filterOpen)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/50 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                        >
                            <span className="text-muted-foreground">📅</span>
                            {DATE_FILTERS.find(f => f.value === dateRange)?.label || 'Todo'}
                            <svg className={`w-4 h-4 text-muted-foreground transition-transform ${filterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {filterOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-border bg-card shadow-xl z-20 overflow-hidden">
                                    {DATE_FILTERS.map(f => (
                                        <button
                                            key={f.value}
                                            onClick={() => { onDateChange(f.value); setFilterOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                                                ${dateRange === f.value
                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                    : 'text-foreground hover:bg-accent'
                                                }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Theme Switch */}
                    <ThemeSwitch />
                </div>
            </div>
        </header>
    );
}

/* ── Main Page ── */
export default function SandboxDashboardsPage() {
    const [activeTab, setActiveTab] = useState('impacto');
    const [dateRange, setDateRange] = useState('all');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/sandbox-dashboards?range=${dateRange}`);
            if (!res.ok) throw new Error('Error al cargar datos');
            const json = await res.json();
            setData(json);
        } catch (err) {
            setError(err.message);
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const panelMap = {
        impacto: <PanelImpacto data={data?.impacto} loading={loading} />,
        operacion: <PanelOperacion data={data?.operacion} loading={loading} />,
        escuelas: <PanelEscuelas data={data?.escuelas} loading={loading} />,
        patrocinios: <PanelPatrocinios data={data?.patrocinios} loading={loading} />,
    };

    return (
        <div className="flex min-h-screen">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 ml-[260px]">
                <TopBar
                    activeTab={activeTab}
                    dateRange={dateRange}
                    onDateChange={setDateRange}
                />

                <main className="px-8 py-6">
                    {error && (
                        <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                                ⚠️ {error}
                            </p>
                            <button
                                onClick={fetchData}
                                className="mt-2 text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                    {panelMap[activeTab]}
                </main>
            </div>
        </div>
    );
}
