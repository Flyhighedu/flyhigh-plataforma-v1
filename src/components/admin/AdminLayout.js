"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { 
    Users, Calendar, Plane, CreditCard, Shield,
    ChevronLeft, ChevronRight, LogOut, Sun, Moon, BarChart2,
    Globe, Zap, School, Gem, FileText, Database, Heart, Building2, Printer, Map, GraduationCap
} from 'lucide-react';
import AdminAlarms from './AdminAlarms';

const WhatsAppIcon = ({ size = 18, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

export default function AdminLayout({ activeTab, setActiveTab, isAuthenticated, onLogout, children }) {
    const { theme, setTheme } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedTabs, setExpandedTabs] = useState([]);
    const [mounted, setMounted] = useState(false);
    const [unreadCrm, setUnreadCrm] = useState(0);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        let interval;
        if (isAuthenticated) {
            const fetchUnread = async () => {
                try {
                    const res = await fetch('/api/crm-unread-count');
                    if (res.ok) {
                        const { unreadCount } = await res.json();
                        setUnreadCrm(unreadCount || 0);
                    }
                } catch(e) { }
            };
            fetchUnread();
            interval = setInterval(fetchUnread, 15000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isAuthenticated]);

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
        { id: 'crm-escuelas', label: 'CRM Escuelas', icon: <Building2 size={18} />, color: '#38bdf8' }, // Sky
        { id: 'crm', label: 'Leads WhatsApp', icon: <WhatsAppIcon size={18} />, color: '#25D366' }, // Whatsapp Green

        { id: 'patrocinadores', label: 'Patrocinadores', icon: <CreditCard size={18} />, color: '#c084fc' }, // Violet
        { id: 'cronograma', label: 'Cronograma', icon: <Calendar size={18} />, color: '#34d399' }, // Emerald
        { id: 'imprimibles', label: 'Imprimibles', icon: <Printer size={18} />, color: '#f97316' }, // Orange
        { id: 'operativos', label: 'FlyHigh Ops', icon: <Users size={18} />, color: '#2563eb' }, // Blue
        { 
            id: 'hr', 
            label: 'Recursos Humanos', 
            icon: <Heart size={18} />, 
            color: '#ec4899',
            subTabs: [
                { id: 'hr-directorio', label: 'Directorio', icon: <Users size={18} /> },
                { id: 'hr-asistencia', label: 'Asistencia', icon: <Calendar size={18} /> },
                { id: 'hr-academia', label: 'Academia', icon: <GraduationCap size={18} /> },
                { id: 'hr-rutas', label: 'Puntos Oficiales', icon: <Map size={18} /> },
            ]
        },
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
                            <span className="flex items-center gap-2 md:gap-3 truncate">
                                <span className="hidden md:inline-flex items-center gap-2 md:gap-3 opacity-50">
                                    <span>{current.label}</span> 
                                    <span className="opacity-30">/</span> 
                                </span>
                                <span className="font-bold">{sub.label}</span>
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
        <div style={{ backgroundColor: bgColor, color: textColor }} className={`flex flex-col md:flex-row h-[100dvh] w-full font-sans overflow-hidden text-sm ${fluidTransition} relative`}>
            
            {/* ── LOGO FIJO ESTÁTICO (NO SE PLIEGA) ── */}
            <div className={`absolute top-0 left-0 h-16 md:h-28 flex items-center px-4 md:px-8 z-50 pointer-events-none transition-all duration-[600ms] ease-out ${isCollapsed ? 'md:w-20' : 'md:w-[320px]'} w-full`}>
                <div 
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 pointer-events-auto ${fluidTransition}`}
                    style={{ boxShadow: shadowOuter, background: bgColor }}
                >
                    <Shield className="w-5 h-5 md:w-6 md:h-6" color={textLogo} strokeWidth={2.5} />
                </div>
                <div className={`ml-3 md:ml-5 flex flex-col justify-center pointer-events-auto transition-opacity duration-300 ${isCollapsed ? 'md:opacity-0 md:select-none' : 'opacity-100'}`}>
                    <h1 className="font-black text-base md:text-lg tracking-tight whitespace-nowrap" style={{ color: textLogo }}>
                        FlyHigh
                    </h1>
                    <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest opacity-70 mt-0.5 whitespace-nowrap">Control Admin</span>
                </div>
            </div>

            {/* ── SIDEBAR FLOTANTE AZUL (Desktop) / BOTTOM BAR (Mobile) ── */}
            <aside 
                className={`z-50 shrink-0 ${fluidTransition} 
                    /* Mobile: Fixed bottom scrolling bar */
                    fixed bottom-0 left-0 w-full h-16 sm:h-20 flex flex-row overflow-x-auto overflow-y-hidden items-center px-2 pb-safe
                    /* Desktop: Floating sidebar */
                    md:relative md:flex-col md:mt-28 md:h-[calc(100dvh-7rem)] md:rounded-tr-[3.5rem] md:overflow-hidden md:px-0 ${isCollapsed ? 'md:w-20' : 'md:w-[280px]'}
                `}
                style={{ 
                    background: sidebarBg,
                    boxShadow: shadowOuter,
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {/* BOTÓN COLAPSO INTEGRADO ESTÉTICAMENTE (Solo Desktop) */}
                <div className={`hidden md:flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'} px-4 pt-5 pb-2`}>
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

                {/* Contenedor de Tabs */}
                <div className="flex flex-row md:flex-col flex-1 px-2 md:px-4 py-0 md:py-2 gap-2 md:gap-3 md:overflow-y-auto no-scrollbar items-center md:items-stretch h-full md:h-auto w-max md:w-auto">
                    {TABS.map(tab => {
                        const isPrimaryActive = activeTab === tab.id || (tab.subTabs && activeTab.startsWith(tab.id + '-'));
                        const isExpanded = expandedTabs.includes(tab.id) && !isCollapsed;

                        return (
                            <div 
                                key={tab.id} 
                                className="flex flex-col md:rounded-2xl transition-all duration-500 overflow-visible md:overflow-hidden h-full md:h-auto justify-center md:justify-start shrink-0"
                                style={{
                                    backgroundColor: isPrimaryActive ? (typeof window !== 'undefined' && window.innerWidth >= 768 ? sidebarBg : 'rgba(255,255,255,0.1)') : 'transparent',
                                    boxShadow: isPrimaryActive && typeof window !== 'undefined' && window.innerWidth >= 768 ? sideInner : 'none',
                                    color: isPrimaryActive ? '#ffffff' : sideTextInactive,
                                    borderRadius: typeof window !== 'undefined' && window.innerWidth < 768 ? '12px' : undefined
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
                                    className={`flex items-center justify-center md:justify-start will-change-transform ${fluidTransition} p-2 md:py-3.5 md:px-4 ${isPrimaryActive && !tab.subTabs ? 'cursor-default pointer-events-none' : 'group active:scale-[0.98]'}`}
                                    style={{
                                        fontWeight: isPrimaryActive ? '800' : '600'
                                    }}
                                >
                                    <div 
                                        className={`shrink-0 flex items-center justify-center ${fluidTransition} relative`}
                                        style={{ color: isPrimaryActive ? tab.color : 'inherit' }}
                                    >
                                        <div className={!isPrimaryActive ? "md:group-hover:text-white transition-colors duration-300" : ""}>
                                            {React.cloneElement(tab.icon, { strokeWidth: isPrimaryActive ? 3 : 2 })}
                                        </div>
                                        {((isCollapsed && typeof window !== 'undefined' && window.innerWidth >= 768) || (typeof window !== 'undefined' && window.innerWidth < 768)) && tab.id === 'crm' && unreadCrm > 0 && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-[#172f6b] animate-pulse"></div>
                                        )}
                                    </div>
                                    <div className={`flex-1 overflow-hidden flex items-center justify-between ${fluidTransition} 
                                        /* Mobile: Hidden text */
                                        hidden
                                        /* Desktop: Show text unless collapsed */
                                        md:flex ${isCollapsed ? 'md:w-0 md:opacity-0 md:hidden' : 'md:ml-4 md:w-auto md:opacity-100'}
                                    `}>
                                        <div className="flex items-center gap-2">
                                            <span className={`tracking-wide whitespace-nowrap ${!isPrimaryActive ? "group-hover:text-white transition-colors duration-300" : ""}`}>
                                                {tab.label}
                                            </span>
                                            {tab.id === 'crm' && unreadCrm > 0 && (
                                                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-md animate-pulse">
                                                    {unreadCrm}
                                                </span>
                                            )}
                                        </div>
                                        {tab.subTabs && (
                                            <svg className={`shrink-0 w-4 h-4 ml-2 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-white' : 'text-blue-300 group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                                
                                {/* Sub Menú Desplegable (Adentro del contenedor hundido) - Solo Desktop o Modal en Móvil (simplificado a hidden en móvil por ahora) */}
                                {tab.subTabs && (
                                    <div className={`hidden md:block w-full overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.2,0.64,1)] ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
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

                {/* Acciones Inferiores (Logout) */}
                <div className="flex flex-row md:flex-col items-center gap-2 md:gap-3 p-2 md:p-4 shrink-0 md:border-t border-white/10 md:pt-6 md:mb-2 ml-auto md:ml-0">

                    <button
                        onClick={() => setShowLogoutModal(true)}
                        className={`flex items-center justify-center md:rounded-2xl overflow-hidden group active:scale-[0.98] will-change-transform ${fluidTransition} p-2 md:py-3.5 md:px-4`}
                        style={{ color: sideTextInactive }} 
                    >
                        <div className={`shrink-0 flex items-center justify-center ${fluidTransition}`}>
                            <div className="md:group-hover:text-[#fca5a5] transition-colors duration-300">
                                <LogOut size={20} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className={`overflow-hidden ${fluidTransition} hidden md:block ${isCollapsed ? 'md:w-0 md:opacity-0 md:hidden' : 'md:ml-4 md:w-auto md:opacity-100'}`}>
                            <span className="font-bold tracking-wide group-hover:text-white transition-colors duration-300 whitespace-nowrap">
                                Desconectar
                            </span>
                        </div>
                    </button>
                </div>
            </aside>

            {/* ── CONTENIDO PRINCIPAL ── */}
            <main className={`flex-1 flex flex-col relative z-10 w-full overflow-hidden ${fluidTransition} pt-16 md:pt-0`}>
                
                {/* Header superior: el título se empuja condicionalmente para evitar el Logo Absoluto */}
                {activeTab !== 'crm' && activeTab !== 'crm-escuelas' && activeTab !== 'cronograma' && activeTab !== 'imprimibles' && (
                    <header className={`h-16 md:h-28 flex items-center justify-between shrink-0 ${fluidTransition} px-4 md:pr-12 md:pl-12 ${isCollapsed ? 'md:pl-[300px]' : ''}`}>
                        <div className="flex items-center gap-3 md:gap-5 ml-[140px] md:ml-0">
                            <div 
                                className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-[1.25rem] flex items-center justify-center ${fluidTransition}`}
                                style={{ 
                                    boxShadow: shadowInnerPlain, 
                                    color: activeTabConfig?.color || textLogo 
                                }}
                            >
                                {activeTabConfig?.icon ? React.cloneElement(activeTabConfig.icon, { className: "w-5 h-5 md:w-6 md:h-6", strokeWidth: 2.5 }) : <Plane className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />}
                            </div>
                            <h2 className={`text-xl md:text-3xl font-black tracking-tight ${fluidTransition} flex items-center gap-2 truncate`} style={{ color: isDark ? '#ffffff' : '#1e293b' }}>
                                {activeTabConfig?.label || 'Dashboard'}
                            </h2>
                        </div>
                        <div 
                            className={`hidden md:flex items-center gap-3 px-5 py-2.5 rounded-full ${fluidTransition}`}
                            style={{ boxShadow: shadowOuter }}
                        >
                            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: '#10b981' }} />
                            <span className="text-[13px] font-black tracking-widest uppercase" style={{ color: '#10b981' }}>En Línea</span>
                        </div>
                    </header>
                )}

                <AdminAlarms />

                {activeTab === 'crm' || activeTab === 'crm-escuelas' || activeTab === 'cronograma' || activeTab === 'imprimibles' ? (
                    <div className="flex-1 flex flex-col overflow-y-auto w-full relative pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
                        {children}
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto w-full no-scrollbar px-4 md:px-12 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-32 pt-2 relative">
                        <div className="max-w-[1400px] mx-auto w-full h-full">
                            {children}
                        </div>
                    </div>
                )}
            </main>

            {/* ── MODAL CONFIRMACIÓN LOGOUT ── */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300"
                        onClick={() => setShowLogoutModal(false)}
                    />
                    <div className="relative w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300" style={{ backgroundColor: bgColor, color: textColor, boxShadow: shadowOuter }}>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                            <LogOut size={32} strokeWidth={2} className="text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black mb-2 tracking-tight" style={{ color: isDark ? '#fff' : '#1e293b' }}>
                            ¿Cerrar sesión?
                        </h3>
                        <p className="text-sm font-semibold mb-8 opacity-80 leading-relaxed">
                            Tendrás que volver a ingresar tus credenciales para acceder al panel de control.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="flex-1 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide active:scale-95 transition-all"
                                style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
                                    if (onLogout) onLogout();
                                }}
                                className="flex-1 py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30 active:scale-95 transition-all"
                            >
                                Sí, salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
