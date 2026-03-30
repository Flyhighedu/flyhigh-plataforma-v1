import fs from 'fs';

const filePath = 'src/components/admin/AdminLayout.js';
let content = fs.readFileSync(filePath, 'utf-8');

// The file handles AdminLayout export. We're going to replace it with a clean Blue Neumorphic version.
const newContent = `"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { 
    Users, Calendar, Plane, CreditCard, Shield,
    ChevronLeft, ChevronRight, LogOut, Sun, Moon
} from 'lucide-react';

export default function AdminLayout({ activeTab, setActiveTab, isAuthenticated, onLogout, children }) {
    const { theme, setTheme } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);
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

    const TABS = [
        { id: 'vuelos', label: 'Vuelos HQ', icon: <Plane size={18} />, color: '#38bdf8' }, // Cyan
        { id: 'patrocinadores', label: 'Inversión', icon: <CreditCard size={18} />, color: '#c084fc' }, // Violet
        { id: 'cronograma', label: 'Operación', icon: <Calendar size={18} />, color: '#34d399' }, // Emerald
        { id: 'operativos', label: 'Staff', icon: <Users size={18} />, color: '#fb7185' }, // Rose
    ];

    const fluidTransition = "transition-all duration-[500ms] ease-[cubic-bezier(0.25,1,0.5,1)] transform-gpu";

    return (
        <div style={{ backgroundColor: bgColor, color: textColor }} className={\`flex min-h-screen font-sans overflow-hidden text-sm \${fluidTransition} relative\`}>
            
            {/* ── LOGO FIJO ESTÁTICO (NO SE PLIEGA) ── */}
            <div className="absolute top-0 left-0 h-28 flex items-center px-8 z-50 pointer-events-none w-[320px]">
                <div 
                    className={\`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 pointer-events-auto \${fluidTransition}\`}
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

            {/* ── SIDEBAR FLOTANTE AZUL ── */}
            {/* Se empuja hacia abajo (mt-28) para estar debajo del logo absoluto. */}
            <aside 
                className={\`relative flex flex-col z-40 shrink-0 mt-28 mb-8 ml-6 rounded-3xl \${fluidTransition} \${isCollapsed ? 'w-20' : 'w-[260px]'}\`}
                style={{ 
                    background: sidebarBg,
                    boxShadow: sideOuter,
                    border: isDark ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(255,255,255,0.1)'
                }}
            >
                {/* BOTÓN COLAPSO (Alineado en el borde derecho) */}
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={\`absolute -right-5 top-8 w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-90 z-50 group border-[3px] \${fluidTransition}\`}
                    style={{ 
                        boxShadow: shadowOuter, 
                        backgroundColor: bgColor, 
                        color: textLogo,
                        borderColor: bgColor 
                    }}
                >
                    {isCollapsed 
                        ? <ChevronRight size={18} strokeWidth={3} className={\`group-active:scale-90 \${fluidTransition}\`} /> 
                        : <ChevronLeft size={18} strokeWidth={3} className={\`group-active:scale-90 \${fluidTransition}\`} />
                    }
                </button>

                <div className="flex-1 px-4 py-8 space-y-3 overflow-y-auto no-scrollbar">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={\`w-full flex items-center rounded-2xl overflow-hidden will-change-transform \${fluidTransition} \${isCollapsed ? 'p-3 aspect-square justify-center' : 'py-3.5 px-4'} \${isActive ? 'cursor-default pointer-events-none' : 'group active:scale-[0.98]'}\`}
                                style={{
                                    backgroundColor: sidebarBg,
                                    boxShadow: isActive ? sideInner : 'none', // Sin sombra exterior para mantener limpieza, solo se hunde al estar activo.
                                    color: isActive ? '#ffffff' : sideTextInactive,
                                    fontWeight: isActive ? '800' : '600'
                                }}
                            >
                                <div 
                                    className={\`shrink-0 flex items-center justify-center \${fluidTransition}\`}
                                    style={{ color: isActive ? tab.color : 'inherit' }}
                                >
                                    <div className={!isActive ? "group-hover:text-white transition-colors duration-300" : ""}>
                                        {React.cloneElement(tab.icon, { strokeWidth: isActive ? 3 : 2 })}
                                    </div>
                                </div>
                                <div className={\`overflow-hidden flex items-center \${fluidTransition} \${isCollapsed ? 'w-0 opacity-0 hidden' : 'ml-4 w-auto opacity-100'}\`}>
                                    <span className={\`tracking-wide whitespace-nowrap \${!isActive ? "group-hover:text-white transition-colors duration-300" : ""}\`}>
                                        {tab.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 space-y-3 shrink-0 border-t border-white/10 pt-6 mb-2">
                    <button
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        className={\`w-full flex items-center rounded-2xl overflow-hidden group active:scale-[0.98] will-change-transform \${fluidTransition} \${isCollapsed ? 'p-3 aspect-square justify-center' : 'py-3.5 px-4'}\`}
                        style={{ color: sideTextInactive }}
                    >
                        <div className={\`shrink-0 flex items-center justify-center \${fluidTransition}\`}>
                             <div className="group-hover:text-[#fde047] transition-colors duration-300">
                                {isDark ? <Sun size={20} strokeWidth={2.5}/> : <Moon size={20} strokeWidth={2.5} />}
                             </div>
                        </div>
                        <div className={\`overflow-hidden \${fluidTransition} \${isCollapsed ? 'w-0 opacity-0 hidden' : 'ml-4 w-auto opacity-100'}\`}>
                            <span className="font-bold tracking-wide group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                Tema {isDark ? 'Claro' : 'Oscuro'}
                            </span>
                        </div>
                    </button>

                    <button
                        onClick={onLogout}
                        className={\`w-full flex items-center rounded-2xl overflow-hidden group active:scale-[0.98] will-change-transform \${fluidTransition} \${isCollapsed ? 'p-3 aspect-square justify-center' : 'py-3.5 px-4'}\`}
                        style={{ color: sideTextInactive }} 
                    >
                        <div className={\`shrink-0 flex items-center justify-center \${fluidTransition}\`}>
                            <div className="group-hover:text-[#fca5a5] transition-colors duration-300">
                                <LogOut size={20} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className={\`overflow-hidden \${fluidTransition} \${isCollapsed ? 'w-0 opacity-0 hidden' : 'ml-4 w-auto opacity-100'}\`}>
                            <span className="font-bold tracking-wide group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                Desconectar
                            </span>
                        </div>
                    </button>
                </div>
            </aside>

            {/* ── CONTENIDO PRINCIPAL ── */}
            <main className={\`flex-1 flex flex-col relative z-10 w-full overflow-hidden \${fluidTransition}\`}>
                
                {/* Header superior: el título "Vuelos HQ" se empuja condicionalmente para evitar el Logo Absoluto */}
                <header className={\`h-28 flex items-center justify-between shrink-0 \${fluidTransition} pr-12 \${isCollapsed ? 'pl-[300px]' : 'pl-12'}\`}>
                    <div className="flex items-center gap-5">
                        <div 
                            className={\`w-14 h-14 rounded-[1.25rem] flex items-center justify-center \${fluidTransition}\`}
                            style={{ 
                                boxShadow: shadowInnerPlain, 
                                color: TABS.find(t => t.id === activeTab)?.color || textLogo 
                            }}
                        >
                            {React.cloneElement(TABS.find(t => t.id === activeTab)?.icon || <Plane />, { size: 24, strokeWidth: 2.5 })}
                        </div>
                        <h2 className={\`text-3xl font-black tracking-tight \${fluidTransition}\`} style={{ color: isDark ? '#ffffff' : '#1e293b' }}>
                            {TABS.find(t => t.id === activeTab)?.label}
                        </h2>
                    </div>
                    <div 
                        className={\`flex items-center gap-3 px-5 py-2.5 rounded-full \${fluidTransition}\`}
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
`;
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('Done rewriting AdminLayout for Logo Extraction');
