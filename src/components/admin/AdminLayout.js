"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { 
    Users, Calendar, Plane, CreditCard, Shield,
    ChevronLeft, ChevronRight, LogOut, Sun, Moon, BarChart2,
    Globe, Zap, School, Gem, FileText, Database, Heart
} from 'lucide-react';

export default function AdminLayout({ activeTab, setActiveTab, isAuthenticated, onLogout, children }) {
    const { theme, setTheme } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedTabs, setExpandedTabs] = useState([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    if (!isAuthenticated) return <div className="min-h-screen bg-slate-900">{children}</div>;

    const isDark = theme === 'dark';

    // ── PALETA LIENZO PRINCIPAL ──
    const bgColor = isDark ? '#1a1b26' : '#FAFAFA'; 
    const textColor = isDark ? '#94a3b8' : '#71717a';
    const textLogo = isDark ? '#38bdf8' : '#0ea5e9'; 
    
    // Sombras Físicas Lienzo Principal
    const shadowOuter = isDark 
        ? '5px 5px 12px #111219, -5px -5px 12px #232533'
        : '6px 6px 14px #e4e4e7, -6px -6px 14px #ffffff';
    
    const shadowInnerPlain = isDark
        ? 'inset 4px 4px 8px #111219, inset -4px -4px 8px #232533'
        : 'inset 5px 5px 10px #e4e4e7, inset -5px -5px 10px #ffffff';

    // ── PALETA SIDEBAR NEOMÓRFICO AZUL ──
    // Un azul premium que funcione como base.
    const sidebarBg = isDark ? '#172f6b' : '#2563eb'; 
    const sideOuter = isDark
        ? '6px 6px 14px rgba(0,0,0,0.5), -6px -6px 14px #264a9e'
        : '8px 8px 16px #1646b5, -8px -8px 16px #457dff';
    const sideInner = isDark
        ? 'inset 4px 4px 8px rgba(0,0,0,0.5), inset -4px -4px 8px #264a9e'
        : 'inset 4px 4px 8px #1646b5, inset -4px -4px 8px #457dff';
    const sideTextInactive = isDark ? '#93c5fd' : '#bfdbfe'; // text-blue-300 / 200

    const sideOuterButton = isDark
        ? '3px 3px 6px rgba(0,0,0,0.3), -3px -3px 6px #264a9e'
        : '3px 3px 8px #1a4abf, -3px -3px 8px #3275ff';

    const TABS = [
        { id: 'bd', label: 'Base de Datos', icon: <Database size={18} />, color: '#f43f5e' }, // Rose

        { id: 'patrocinadores', label: 'Patrocinadores', icon: <CreditCard size={18} />, color: '#c084fc' }, // Violet
        { id: 'cronograma', label: 'Cronograma', icon: <Calendar size={18} />, color: '#34d399' }, // Emerald
        { id: 'operativos', label: 'FlyHigh Ops', icon: <Users size={18} />, color: '#2563eb' }, // Blue
        { id: 'hr', label: 'Recursos Humanos', icon: <Heart size={18} />, color: '#ec4899' }, // Pink
        { 
            id: 'analytics', 
            label: 'Analytics', 
            icon: <BarChart2 size={18} />, 
            color: '#facc15',
            subTabs: [
                { id: 'analytics-impacto', label: 'Impacto Global', icon: <Globe size={18} /> },
                { id: 'analytics-operacion', label: 'Operación', icon: <Zap size={18} /> },
                { id: 'analytics-escuelas', label: 'Escuelas', icon: <School size={18} /> },
                { id: 'analytics-patrocinios', label: 'Patrocinios', icon: <Gem size={18} /> },
                { id: 'analytics-reportes', label: 'Reportes', icon: <FileText size={18} /> },
            ]
        },
    ];

    const activeTabConfig = TABS.find(t => t.id === activeTab) || 
        TABS.reduce((acc, current) => {
            if (acc) return acc;
            if (current.subTabs) {
                const sub = current.subTabs.find(s => s.id === activeTab);
                if (sub) {
                    return {
                        id: sub.id,
                        label: (
                            <span className="flex items-center gap-3">
                                <span className="opacity-50">{current.label}</span> 
                                <span className="opacity-30">/</span> 
                                <span className="flex items-center gap-1">{sub.icon} {sub.label}</span>
                            </span>
                        ),
                        icon: current.icon,
                        color: current.color
                    };
                }
            }
            return null;
        }, null);

    const fluidTransition = "transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.2,0.64,1)] transform-gpu";

    return (
        <div style={{ backgroundColor: bgColor, color: textColor }} className={`flex h-screen w-full font-sans overflow-hidden text-sm ${fluidTransition} relative`}>
            
            {/* ── LOGO FIJO ESTÁTICO (NO SE PLIEGA) ── */}
            <div className="absolute top-0 left-0 h-28 flex items-center px-8 z-50 pointer-events-none w-[320px]">
                <div 
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 pointer-events-auto ${fluidTransition}`}
                    style={{ boxShadow: shadowOuter, background: bgColor }}
                >
                    <Shield size={22} color={textLogo} strokeWidth={2.5} />
                </div>
                <div className="ml-5 flex flex-col justify-center pointer-events-auto">
                    <h1 className="font-black text-lg tracking-tight" style={{ color: textLogo }}>
                        FlyHigh
                    </h1>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-70 mt-0.5 whitespace-nowrap">Control Admin</span>
                </div>
            </div>

            {/* ── SIDEBAR FLOTANTE AZUL (Estilo File Explorer) ── */}
            {/* Se empuja hacia abajo (mt-28) para estar debajo del logo absoluto. */}
            <aside 
                className={`relative flex flex-col z-40 shrink-0 mt-28 h-[calc(100dvh-7rem)] rounded-tr-[3.5rem] ${fluidTransition} ${isCollapsed ? 'w-20' : 'w-[280px]'}`}
                style={{ 
                    background: sidebarBg,
                    boxShadow: shadowOuter // Sombra neutral idéntica a las tarjetas del lienzo
                }}
            >
                {/* BOTÓN COLAPSO INTEGRADO ESTÉTICAMENTE */}
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'} px-4 pt-5 pb-2`}>
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:brightness-110 active:scale-90 text-white/90 hover:text-white transition-all"
                        style={{ backgroundColor: sidebarBg, boxShadow: sideOuterButton }}
                    >
                        {isCollapsed 
                            ? <ChevronRight size={22} strokeWidth={2.5} /> 
                            : <ChevronLeft size={22} strokeWidth={2.5} />
                        }
                    </button>
                </div>

                <div className="flex-1 px-4 py-2 space-y-3 overflow-y-auto no-scrollbar">
                    {TABS.map(tab => {
                        const isPrimaryActive = activeTab === tab.id || (tab.subTabs && activeTab.startsWith(tab.id + '-'));
                        const isExpanded = expandedTabs.includes(tab.id) && !isCollapsed;

                        return (
                            <div 
                                key={tab.id} 
                                className="w-full flex flex-col rounded-2xl transition-all duration-500 overflow-hidden"
                                style={{
                                    backgroundColor: sidebarBg,
                                    boxShadow: isPrimaryActive ? sideInner : 'none',
                                    color: isPrimaryActive ? '#ffffff' : sideTextInactive,
                                }}
                            >
                                <button
                                    onClick={() => {
                                        if (tab.subTabs) {
                                            setExpandedTabs(prev => 
                                                prev.includes(tab.id) 
                                                    ? prev.filter(id => id !== tab.id) 
                                                    : [...prev, tab.id]
                                            );
                                            if (!activeTab.startsWith(tab.id + '-')) {
                                                setActiveTab(tab.subTabs[0].id);
                                            }
                                        } else {
                                            setActiveTab(tab.id);
                                        }
                                    }}
                                    className={`w-full flex items-center will-change-transform ${fluidTransition} ${isCollapsed ? 'p-3 aspect-square justify-center' : 'py-3.5 px-4'} ${isPrimaryActive && !tab.subTabs ? 'cursor-default pointer-events-none' : 'group active:scale-[0.98]'}`}
                                    style={{
                                        fontWeight: isPrimaryActive ? '800' : '600'
                                    }}
                                >
                                    <div 
                                        className={`shrink-0 flex items-center justify-center ${fluidTransition}`}
                                        style={{ color: isPrimaryActive ? tab.color : 'inherit' }}
                                    >
                                        <div className={!isPrimaryActive ? "group-hover:text-white transition-colors duration-300" : ""}>
                                            {React.cloneElement(tab.icon, { strokeWidth: isPrimaryActive ? 3 : 2 })}
                                        </div>
                                    </div>
                                    <div className={`flex-1 overflow-hidden flex items-center justify-between ${fluidTransition} ${isCollapsed ? 'w-0 opacity-0 hidden' : 'ml-4 w-auto opacity-100'}`}>
                                        <span className={`tracking-wide whitespace-nowrap ${!isPrimaryActive ? "group-hover:text-white transition-colors duration-300" : ""}`}>
                                            {tab.label}
                                        </span>
                                        {tab.subTabs && (
                                            <svg className={`shrink-0 w-4 h-4 ml-2 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white' : 'text-blue-300 group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                                
                                {/* Sub Menú Desplegable (Adentro del contenedor hundido) */}
                                {tab.subTabs && (
                                    <div className={`w-full overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.2,0.64,1)] ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                                        <div className="flex flex-col gap-1 pl-4 pr-3 pb-3">
                                            {tab.subTabs.map(sub => {
                                                const isSubActive = activeTab === sub.id;
                                                return (
                                                    <button
                                                        key={sub.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveTab(sub.id);
                                                        }}
                                                        className={`w-full flex items-center py-2 px-3 rounded-xl transition-all duration-300 text-left relative overflow-hidden group/sub active:scale-[0.97] hover:bg-white/10`}
                                                        style={{
                                                            backgroundColor: isSubActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                        }}
                                                    >
                                                        <span className={`w-6 text-center text-[15px] transition-transform duration-300 ${isSubActive ? 'scale-110 grayscale-0' : 'grayscale opacity-70 group-hover/sub:grayscale-0 group-hover/sub:opacity-100'} ${fluidTransition} ${isCollapsed ? 'opacity-0 w-0' : 'mr-3'}`}>
                                                            {sub.icon}
                                                        </span>
                                                        <span className={`text-[13px] font-bold tracking-wide transition-colors ${isSubActive ? 'text-white' : 'text-blue-200 group-hover/sub:text-white'} ${fluidTransition} ${isCollapsed ? 'opacity-0 w-0' : ''}`}>
                                                            {sub.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 space-y-3 shrink-0 border-t border-white/10 pt-6 mb-2">
                    <button
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        className={`w-full flex items-center rounded-2xl overflow-hidden group active:scale-[0.98] will-change-transform ${fluidTransition} ${isCollapsed ? 'p-3 aspect-square justify-center' : 'py-3.5 px-4'}`}
                        style={{ color: sideTextInactive }}
                    >
                        <div className={`shrink-0 flex items-center justify-center ${fluidTransition}`}>
                             <div className="group-hover:text-[#fde047] transition-colors duration-300">
                                {isDark ? <Sun size={20} strokeWidth={2.5}/> : <Moon size={20} strokeWidth={2.5} />}
                             </div>
                        </div>
                        <div className={`overflow-hidden ${fluidTransition} ${isCollapsed ? 'w-0 opacity-0 hidden' : 'ml-4 w-auto opacity-100'}`}>
                            <span className="font-bold tracking-wide group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                Tema {isDark ? 'Claro' : 'Oscuro'}
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={onLogout}
                        className={`w-full flex items-center rounded-2xl overflow-hidden group active:scale-[0.98] will-change-transform ${fluidTransition} ${isCollapsed ? 'p-3 aspect-square justify-center' : 'py-3.5 px-4'}`}
                        style={{ color: sideTextInactive }} 
                    >
                        <div className={`shrink-0 flex items-center justify-center ${fluidTransition}`}>
                            <div className="group-hover:text-[#fca5a5] transition-colors duration-300">
                                <LogOut size={20} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className={`overflow-hidden ${fluidTransition} ${isCollapsed ? 'w-0 opacity-0 hidden' : 'ml-4 w-auto opacity-100'}`}>
                            <span className="font-bold tracking-wide group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                Desconectar
                            </span>
                        </div>
                    </button>
                </div>
            </aside>

            {/* ── CONTENIDO PRINCIPAL ── */}
            <main className={`flex-1 flex flex-col relative z-10 w-full overflow-hidden ${fluidTransition}`}>
                
                {/* Header superior: el título "Vuelos HQ" se empuja condicionalmente para evitar el Logo Absoluto */}
                <header className={`h-28 flex items-center justify-between shrink-0 ${fluidTransition} pr-12 ${isCollapsed ? 'pl-[300px]' : 'pl-12'}`}>
                    <div className="flex items-center gap-5">
                        <div 
                            className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center ${fluidTransition}`}
                            style={{ 
                                boxShadow: shadowInnerPlain, 
                                color: activeTabConfig?.color || textLogo 
                            }}
                        >
                            {activeTabConfig?.icon ? React.cloneElement(activeTabConfig.icon, { size: 24, strokeWidth: 2.5 }) : <Plane size={24} strokeWidth={2.5} />}
                        </div>
                        <h2 className={`text-3xl font-black tracking-tight ${fluidTransition} flex items-center gap-2`} style={{ color: isDark ? '#ffffff' : '#1e293b' }}>
                            {activeTabConfig?.label || 'Dashboard'}
                        </h2>
                    </div>
                    <div 
                        className={`flex items-center gap-3 px-5 py-2.5 rounded-full ${fluidTransition}`}
                        style={{ boxShadow: shadowOuter }}
                    >
                        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#10b981' }} />
                        <span className="text-[13px] font-black tracking-widest uppercase" style={{ color: '#10b981' }}>En Línea</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full no-scrollbar px-12 pb-32 pt-2 relative">
                    <div className="max-w-[1400px] mx-auto w-full">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
