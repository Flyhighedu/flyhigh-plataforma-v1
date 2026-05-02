'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, School, Plane, Calendar, Users, Building2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

import SandboxEscuelasPage from '@/app/sandbox-escuelas/page';
import SandboxVuelosPage from '@/app/sandbox-vuelos/page';
import SandboxCronogramaPage from '@/app/sandbox-cronograma/page';
import SandboxHRPage from '@/app/sandbox-hr/page';
import SandboxPatrocinadoresPage from '@/app/sandbox-patrocinadores/page';

export default function AdminBasesDeDatosPage() {
    const router = useRouter();
    const [dbView, setDbView] = useState('menu'); // 'menu' | 'catalogo' | 'vuelos' | 'cronograma' | 'hr' | 'patrocinadores'
    const [isExitingDB, setIsExitingDB] = useState(false);

    return (
        <div className="animate-premium-in w-full">
            {dbView === 'menu' && (
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                            <Database className="w-8 h-8 text-rose-500" />
                            <span>Bases de Datos <span className="text-rose-500">Maestras</span></span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                            Acceso directo a las fuentes de verdad (Catálogos históricos y operacionales).
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                        {/* CRM Escuelas Card (NUEVO) */}
                        <button 
                            onClick={() => router.push('/admin/crm-escuelas')}
                            className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                            style={{ 
                                backgroundColor: '#3b82f6', // Blue premium
                                boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                            }}
                        >
                            <Building2 className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                            
                            <div className="relative z-10 mt-2">
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                    CRM Escuelas
                                </h2>
                                <p className="text-blue-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                    Gestión comercial, pipeline de ventas, recordatorios y notas detalladas por institución.
                                </p>
                            </div>
                            
                            <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                <span>Abrir CRM</span>
                                <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                    <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                </div>
                            </div>
                        </button>

                        {/* Catálogo de Escuelas Card */}
                        <button 
                            onClick={() => setDbView('catalogo')}
                            className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                            style={{ 
                                backgroundColor: '#f43f5e',
                                boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                            }}
                        >
                            <School className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                            
                            <div className="relative z-10 mt-2">
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                    Catálogo de Escuelas
                                </h2>
                                <p className="text-rose-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                    Registros base (CCT) de las instituciones e historial del padrón activo a nivel municipio.
                                </p>
                            </div>
                            
                            <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                <span>Explorar</span>
                                <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                    <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                </div>
                            </div>
                        </button>

                        {/* Historial de Vuelos Card */}
                        <button 
                            onClick={() => setDbView('vuelos')}
                            className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                            style={{ 
                                backgroundColor: '#0ea5e9',
                                boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                            }}
                        >
                            <Plane className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                            
                            <div className="relative z-10 mt-2">
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                    Archivo Histórico
                                </h2>
                                <p className="text-sky-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                    Desglose maestro de operaciones de vuelo, registros de asistencia y estatus.
                                </p>
                            </div>
                            
                            <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                <span>Inspeccionar</span>
                                <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                    <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                </div>
                            </div>
                        </button>

                        {/* Cronograma Sandbox Card */}
                        <button 
                            onClick={() => setDbView('cronograma')}
                            className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                            style={{ 
                                backgroundColor: '#10b981',
                                boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                            }}
                        >
                            <Calendar className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 pointer-events-none" />
                            
                            <div className="relative z-10 mt-2">
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                    Cronograma
                                </h2>
                                <p className="text-emerald-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                    Pipeline de vuelos. Visualiza escuelas programadas, completadas y canceladas.
                                </p>
                            </div>
                            
                            <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                <span>Desplegar</span>
                                <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                    <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                </div>
                            </div>
                        </button>

                        {/* Personal HR Sandbox Card */}
                        <button 
                            onClick={() => setDbView('hr')}
                            className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                            style={{ 
                                backgroundColor: '#8b5cf6',
                                boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                            }}
                        >
                            <Users className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                            
                            <div className="relative z-10 mt-2">
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                    RH
                                </h2>
                                <p className="text-violet-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                    Base de datos dinámica de perfiles operativos. Acceso completo y depuración.
                                </p>
                            </div>
                            
                            <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                <span>Administrar</span>
                                <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                    <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                </div>
                            </div>
                        </button>

                        {/* Padrón Patrocinadores Sandbox Card */}
                        <button 
                            onClick={() => setDbView('patrocinadores')}
                            className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                            style={{ 
                                backgroundColor: '#d946ef',
                                boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                            }}
                        >
                            <Building2 className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                            
                            <div className="relative z-10 mt-2">
                                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                    Patrocinadores
                                </h2>
                                <p className="text-fuchsia-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                    Base de datos financiera. Acceso completo al padrón de inversionistas y control de aportaciones.
                                </p>
                            </div>
                            
                            <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                <span>Gestionar</span>
                                <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                    <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {(dbView !== 'menu' || isExitingDB) && typeof document !== 'undefined' && createPortal(
                <div className={`fixed inset-0 z-[9999] bg-white dark:bg-[#0f172a] flex flex-col overflow-hidden ${isExitingDB ? 'animate-premium-out' : 'animate-premium-in'}`}>
                    <div className="shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 md:px-8 py-4 flex items-center shadow-sm z-10 w-full">
                        <button
                            onClick={() => {
                                if (isExitingDB) return;
                                setIsExitingDB(true);
                                setTimeout(() => {
                                    setDbView('menu');
                                    setIsExitingDB(false);
                                }, 400);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-700 dark:text-slate-200 font-bold text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 group"
                        >
                            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                            <span>Volver al Panel</span>
                        </button>
                        <div className="ml-auto flex items-center gap-3">
                            <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                Tiempo Real
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 w-full overflow-y-auto override-sandbox-bg">
                        <style>{`
                            .override-sandbox-bg > div {
                                background-color: transparent !important;
                                min-height: auto !important;
                            }
                        `}</style>
                        <div className="max-w-[100vw]">
                            {dbView === 'catalogo' && <SandboxEscuelasPage />}
                            {dbView === 'vuelos' && <SandboxVuelosPage />}
                            {dbView === 'cronograma' && <SandboxCronogramaPage />}
                            {dbView === 'hr' && <SandboxHRPage />}
                            {dbView === 'patrocinadores' && <SandboxPatrocinadoresPage />}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
