'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { supabaseNew } from '@/lib/supabaseClientNew';
import {
    Plane, Users, MapPin, FileText, Camera, Radio,
    Target, TrendingUp, School, Calendar, ExternalLink, Clock, CheckCircle,
    Loader2, AlertCircle, Eye, Heart, Lock, X, ChevronRight, Mail, KeyRound, ArrowRight
} from 'lucide-react';

// --- CONSTANTES ---
const META_NINOS = 30000;

// Helper: Build enriched flight list from staff_journeys + cierres_mision
const buildFlightList = (journeys, cierres, schools, liveMap = {}) => {
    const cierreMap = {};
    (cierres || []).forEach(c => { if (c.journey_id) cierreMap[c.journey_id] = c; });
    const schoolMap = {};
    (schools || []).forEach(s => { schoolMap[s.id] = s; });

    return (journeys || [])
        .map(j => {
            const cierre = cierreMap[j.id];
            const school = schoolMap[j.school_id];
            const liveSum = liveMap[j.id] || 0;
            const ninos = cierre?.total_students ?? liveSum;
            
            return {
                id: j.id,
                fecha: j.date,
                nombre_escuela: j.school_name || school?.nombre_escuela || '—',
                colonia: school?.colonia || '',
                ninos_sesion: ninos,
                total_flights: cierre?.total_flights || 0,
                becados: cierre?.becados || 0,
                acta_url: cierre?.signature_url || null,
                foto_url: cierre?.group_photo_url || null,
            };
        })
        .filter(flight => flight.ninos_sesion > 0) // <--- Ocultar misiones test con 0 niños
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
};

// --- COMPONENTE: Hero con Alerta de Vuelo ---
const DashboardHero = ({ sponsorName, onOpenLogin, onLogout }) => {
    return (
        <section className="relative w-full pt-24 pb-16 px-4 overflow-hidden">
            {/* Fondo degradado sutil */}
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/50 via-white to-white pointer-events-none"></div>

            {/* Botón Acceso Patrocinadores (Top Right) */}
            <div className="absolute top-6 right-6 md:top-10 md:right-10 z-20">
                {sponsorName ? (
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur border border-slate-200 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-red-500 transition-colors shadow-sm"
                    >
                        <Lock size={12} /> Cerrar Sesión
                    </button>
                ) : (
                    <button
                        onClick={onOpenLogin}
                        className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-white hover:border-cyan-300 hover:text-cyan-600 transition-all shadow-sm group"
                    >
                        <Lock size={12} className="group-hover:text-cyan-500 transition-colors" />
                        Acceso Patrocinador
                    </button>
                )}
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center">
                {/* Saludo personalizado si hay sponsor logueado */}
                {sponsorName && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-6"
                    >
                        <p className="text-sm text-slate-400 font-medium">
                            Bienvenido de vuelta,
                        </p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                            {sponsorName}
                        </p>
                    </motion.div>
                )}

                {/* Pill de sección */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm mb-6"
                >
                    <Target size={14} className="text-cyan-600" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Panel de Transparencia</span>
                </motion.div>


                {/* Título principal */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-4"
                >
                    Transparencia en{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-fuchsia-600">
                        Acción
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed"
                >
                    Cada vuelo documentado. Cada niño contado. Cada escuela registrada.
                </motion.p>


            </div>
        </section>
    );
};

// --- COMPONENTE: Contador de Impacto ---
const ImpactMeter = ({ ninosVolados, isLoading }) => {
    const [displayCount, setDisplayCount] = useState(0);
    const porcentaje = Math.min((ninosVolados / META_NINOS) * 100, 100);

    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { once: true, margin: "-100px" });

    // Animación de contador
    useEffect(() => {
        if (isLoading || !isInView) return;

        let start = 0;
        const end = ninosVolados;
        const duration = 2500; // Slower for more impact
        const increment = end / (duration / 16);

        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setDisplayCount(end);
                clearInterval(timer);
            } else {
                setDisplayCount(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [ninosVolados, isLoading, isInView]);

    return (
        <section className="w-full py-16 px-4 bg-white">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    ref={containerRef}
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
                >
                    {/* Glow decorativo */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-lg">
                                <TrendingUp size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Impacto Acumulado</h3>
                                <p className="text-slate-400 text-sm">Niños que han tocado el cielo</p>
                            </div>
                        </div>

                        {/* Contador grande */}
                        <div className="text-center mb-8">
                            {isLoading ? (
                                <Loader2 size={48} className="animate-spin text-cyan-400 mx-auto" />
                            ) : (
                                <div className="flex items-baseline justify-center gap-4">
                                    <span className="text-7xl md:text-9xl font-black text-white tracking-tighter">
                                        {displayCount.toLocaleString()}
                                    </span>
                                    <span className="text-xl md:text-2xl font-bold text-slate-400 uppercase tracking-widest">
                                        niños
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Barra de progreso */}
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Progreso hacia la meta</span>
                                <span className="text-cyan-400 font-bold">{porcentaje.toFixed(1)}%</span>
                            </div>
                            <div className="h-4 bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${porcentaje}%` }}
                                    transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                                    className="h-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 rounded-full shadow-lg"
                                ></motion.div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>0</span>
                                <span className="flex items-center gap-1">
                                    <Target size={12} />
                                    Meta: {META_NINOS.toLocaleString()} niños
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

// --- COMPONENTE: Contador de Becas con estética premium (Tarjeta) ---
const BecasImpactCounter = ({ ninosPatrocinados, isLoading }) => {
    const [displayCount, setDisplayCount] = useState(0);
    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { once: true, margin: "-50px" });

    useEffect(() => {
        if (isLoading || !isInView) return;

        let start = 0;
        const end = ninosPatrocinados;
        const duration = 2200;
        const increment = end / (duration / 16);

        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setDisplayCount(end);
                clearInterval(timer);
            } else {
                setDisplayCount(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [ninosPatrocinados, isLoading, isInView]);

    return (
        <section className="py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    ref={containerRef}
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ duration: 0.6 }}
                    className="relative bg-white rounded-3xl p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden hover:shadow-[0_30px_60px_-15px_rgba(0,102,255,0.15)] transition-all duration-300 group"
                >
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    Impacto Real
                                </h3>
                            </div>

                            <div className="flex items-baseline gap-3">
                                {isLoading ? (
                                    <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
                                ) : (
                                    <span className="text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-blue-800 to-cyan-600">
                                        {displayCount.toLocaleString()}
                                    </span>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold text-slate-700 leading-none">Niños</span>
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Becados Total</span>
                                </div>
                            </div>

                            <p className="mt-4 text-sm text-slate-500 font-medium max-w-md">
                                Historias cambiadas, futuros reescritos y sueños que comienzan a volar.
                            </p>
                        </div>

                        {/* Animated Icon Container */}
                        <div className="relative group-hover:scale-110 transition-transform duration-300 ease-out">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-300 blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white">
                                <Users size={36} strokeWidth={1.5} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};


// --- COMPONENTE: Tarjeta Privada de Inversión ---
const SponsorPrivateCard = ({ sponsor }) => {
    const aportacion = sponsor.aportacion_total || 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-12 px-4"
        >
            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 overflow-hidden shadow-2xl border border-slate-700">
                {/* Fondo decorativo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30 mb-3">
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Acceso Privado</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
                            Tu Apoyo al Futuro
                        </h2>
                        <p className="text-slate-400 text-sm md:text-base max-w-md">
                            Gracias a tu aportación, estamos transformando la educación de miles de niños en Uruapan. Este es tu impacto directo.
                        </p>
                    </div>

                    <div className="text-center md:text-right">
                        <div className="flex items-center justify-center md:justify-end gap-3 mb-1">
                            <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/30">
                                <span className="text-2xl">💎</span>
                            </div>
                            <span className="text-4xl md:text-5xl font-black text-white tracking-tight font-sans">
                                ${aportacion.toLocaleString()} <span className="text-lg text-slate-500 font-bold">MXN</span>
                            </span>
                        </div>
                        <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Apoyo Total Confirmado</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// --- COMPONENTE: Unified Impact Dashboard ---
const UnifiedImpactCard = ({ ninosVolados, ninosPatrocinados, isLoading }) => {
    const [displayTotal, setDisplayTotal] = useState(0);
    const [displayBecados, setDisplayBecados] = useState(0);
    const porcentaje = Math.min((ninosVolados / META_NINOS) * 100, 100);

    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { once: true, margin: "-50px" });

    useEffect(() => {
        if (isLoading || !isInView) return;

        let startT = 0;
        let startB = 0;
        const durT = 2500;
        const durB = 2500;

        const timerT = setInterval(() => {
            startT += ninosVolados / (durT / 16);
            if (startT >= ninosVolados) {
                setDisplayTotal(ninosVolados);
                clearInterval(timerT);
            } else setDisplayTotal(Math.floor(startT));
        }, 16);

        const timerB = setInterval(() => {
            startB += ninosPatrocinados / (durB / 16);
            if (startB >= ninosPatrocinados) {
                setDisplayBecados(ninosPatrocinados);
                clearInterval(timerB);
            } else setDisplayBecados(Math.floor(startB));
        }, 16);

        return () => {
            clearInterval(timerT);
            clearInterval(timerB);
        };
    }, [ninosVolados, ninosPatrocinados, isLoading, isInView]);

    return (
        <section className="px-4 w-full mb-12">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    ref={containerRef}
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_50px_-15px_rgba(0,102,255,0.1)] border border-slate-100 overflow-hidden"
                >
                    {/* Elementos decorativos de fondo */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-cyan-50 via-blue-50/20 to-transparent rounded-full blur-3xl opacity-70 pointer-events-none -mt-40 -mr-40"></div>
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-fuchsia-50/40 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none -mb-32 -ml-32"></div>

                    <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-end justify-between gap-12">
                        
                        {/* MÉTRICA PRINCIPAL: IMPACTO GLOBAL */}
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100/50 rounded-full mb-6 relative">
                                <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-cyan-800 uppercase tracking-[0.15em]">Impacto Global del Proyecto</span>
                            </div>
                            
                            {isLoading ? (
                                <Loader2 className="w-16 h-16 animate-spin text-cyan-500 mx-auto lg:mx-0 my-4" />
                            ) : (
                                <div className="flex flex-col lg:flex-row lg:items-baseline gap-2 lg:gap-4 mb-3">
                                    <span className="text-7xl md:text-[6rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 leading-none">
                                        {displayTotal.toLocaleString()}
                                    </span>
                                    <span className="text-xl md:text-3xl font-bold text-slate-400 uppercase tracking-widest mt-2 lg:mt-0">
                                        Niños
                                    </span>
                                </div>
                            )}
                            <p className="text-slate-500 text-sm md:text-base max-w-md mx-auto lg:mx-0 font-medium leading-relaxed">
                                Personas verdaderamente impactadas. Gracias a nuestro equipo y patrocinadores locales, hemos acercado el cielo a miles de estudiantes en la región.
                            </p>
                        </div>

                        {/* MÉTRICA SECUNDARIA: BECAS AL 100% */}
                        <div className="w-full lg:w-80 shrink-0">
                            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute -top-12 -right-12 w-32 h-32 bg-fuchsia-500/20 blur-2xl rounded-full"></div>
                                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-cyan-500/20 blur-2xl rounded-full"></div>
                                
                                <div className="relative z-10">
                                    <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mb-6">
                                        <Heart className="w-6 h-6 text-fuchsia-400" />
                                    </div>
                                    <h4 className="text-4xl font-black text-white tracking-tight mb-2">
                                        {displayBecados.toLocaleString()}
                                    </h4>
                                    <p className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3">
                                        Becados al 100%
                                    </p>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-4 mt-4">
                                        Estudiantes de alto riesgo cuyo acceso a la experiencia fue totalmente auspiciado sin costo alguno.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* BARRA DE PROGRESO */}
                    <div className="relative z-10 mt-12 pt-8 border-t border-slate-100">
                        <div className="flex justify-between items-end mb-3">
                            <div>
                                <h5 className="text-sm font-bold text-slate-700">Progreso hacia la meta global</h5>
                                <p className="text-xs text-slate-400 mt-0.5">Volando hacia los {META_NINOS.toLocaleString()} niños</p>
                            </div>
                            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                                {porcentaje.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${porcentaje}%` }}
                                transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 rounded-full"
                            ></motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

// --- COMPONENTE: Mapa de Colonias (Visualización Simple) ---
const SchoolsMap = ({ flights }) => {
    // Agrupar por colonia y contar vuelos
    const coloniaData = flights.reduce((acc, flight) => {
        const colonia = flight.colonia || 'Sin colonia';
        acc[colonia] = (acc[colonia] || 0) + 1;
        return acc;
    }, {});

    const colonias = Object.entries(coloniaData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);

    const maxCount = Math.max(...colonias.map(c => c[1]), 1);

    return (
        <section className="w-full py-16 px-4 bg-slate-50">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm mb-4">
                        <MapPin size={14} className="text-fuchsia-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Cobertura</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                        Colonias <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">Impactadas</span>
                    </h2>
                </div>

                {colonias.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <MapPin size={48} className="mx-auto mb-4 opacity-30" />
                        <p>Aún no hay vuelos registrados</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {colonias.map(([colonia, count], index) => (
                            <motion.div
                                key={colonia}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-lg transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div
                                        className="w-4 h-4 rounded-full shadow-sm"
                                        style={{
                                            backgroundColor: `hsl(${180 + (index * 20)}, 70%, 50%)`,
                                            opacity: 0.5 + (count / maxCount) * 0.5
                                        }}
                                    ></div>
                                    <span className="text-2xl font-black text-slate-800">{count}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 truncate group-hover:text-slate-900 transition-colors">
                                    {colonia}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {count === 1 ? '1 vuelo' : `${count} vuelos`}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

// --- COMPONENTE: Cronograma de Misiones (Tabs: Pendientes / Historial) ---
const TRASH_PATTERNS = /demo|prueba|test|ejemplo|sandbox|asdf/i;
const TRASH_IDS = new Set([999999, 44, 45, 46, 48]); // Duplicates/demo IDs from audit

const NextMissions = ({ missions }) => {
    const [activeTab, setActiveTab] = useState('pendientes');

    if (!missions || missions.length === 0) return null;

    // Filter out trash: name patterns, known trash IDs, archived status
    const cleanMissions = missions.filter((m) => {
        if (TRASH_IDS.has(m.id)) return false;
        if (m.estatus === 'archivado') return false;
        if (TRASH_PATTERNS.test(m.nombre_escuela || '')) return false;
        return true;
    });

    // Split into tabs: Pendientes = NOT completada, Historial = completada
    const pendientes = cleanMissions.filter((m) => m.estatus !== 'completada');
    const historial = cleanMissions.filter((m) => m.estatus === 'completada');

    const activeMissions = activeTab === 'pendientes' ? pendientes : historial;

    return (
        <section className="w-full py-12 px-4 bg-slate-50/50">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-sm">
                        <Calendar className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            Cronograma de Misiones
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">
                            {cleanMissions.length} misiones · {pendientes.length} pendientes · {historial.length} realizadas
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8">
                    <button
                        onClick={() => setActiveTab('pendientes')}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all duration-200 ${
                            activeTab === 'pendientes'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <Clock size={14} />
                        Pendientes
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                            activeTab === 'pendientes' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {pendientes.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('historial')}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all duration-200 ${
                            activeTab === 'historial'
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <CheckCircle size={14} />
                        Historial
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                            activeTab === 'historial' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                            {historial.length}
                        </span>
                    </button>
                </div>

                {/* Grid */}
                {activeMissions.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            {activeTab === 'pendientes' ? <Calendar size={28} className="text-slate-300" /> : <CheckCircle size={28} className="text-slate-300" />}
                        </div>
                        <p className="text-slate-400 font-medium">
                            {activeTab === 'pendientes' ? 'No hay misiones pendientes' : 'Aún no hay misiones completadas'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeMissions.map((mission, index) => (
                            <motion.div
                                key={mission.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.06 }}
                                className={`group relative rounded-[2rem] p-6 shadow-xl border overflow-hidden transition-all duration-300 ${
                                    mission.estatus === 'completada'
                                        ? 'bg-gradient-to-br from-emerald-50 to-white shadow-emerald-100/50 border-emerald-100 hover:shadow-emerald-200/60'
                                        : 'bg-white shadow-slate-200/50 border-white hover:shadow-2xl hover:shadow-amber-500/10'
                                }`}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <School size={80} className={mission.estatus === 'completada' ? 'text-emerald-500' : 'text-amber-500'} />
                                </div>

                                <div className="relative z-10">
                                    {/* Automated Status Badge */}
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border ${
                                        mission.estatus === 'completada'
                                            ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                                            : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                        {mission.estatus === 'completada' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                        {mission.estatus === 'completada' ? 'Realizada' : 'Programada'}
                                    </div>

                                    <h3 className={`text-xl font-bold mb-2 line-clamp-2 ${
                                        mission.estatus === 'completada' ? 'text-emerald-800' : 'text-slate-800'
                                    }`}>
                                        {mission.nombre_escuela}
                                    </h3>

                                    <div className="space-y-3 mt-4">
                                        {mission.colonia && (
                                            <div className="flex items-start gap-3 text-slate-500">
                                                <MapPin size={18} className={`${mission.estatus === 'completada' ? 'text-emerald-500' : 'text-amber-500'} shrink-0 mt-0.5`} />
                                                <span className="text-sm font-medium">{mission.colonia}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Calendar size={18} className={`${mission.estatus === 'completada' ? 'text-emerald-500' : 'text-amber-500'} shrink-0`} />
                                            <span className="text-sm font-bold text-slate-700">
                                                {new Date(mission.fecha_programada + 'T12:00:00').toLocaleDateString('es-MX', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

// --- COMPONENTE: Tabla de Transparencia ---
const TransparencyTable = ({ flights, isLoading }) => {
    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <section className="w-full py-16 px-4 bg-white">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full shadow-sm mb-4">
                        <Eye size={14} className="text-cyan-600" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Historial</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                        Registro de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-fuchsia-600">Vuelos</span>
                    </h2>
                    <p className="text-slate-500 mt-2 max-w-lg mx-auto">
                        Cada misión queda documentada con actas oficiales y fotografías de evidencia.
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 size={40} className="animate-spin text-cyan-500" />
                    </div>
                ) : flights.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Plane size={48} className="mx-auto mb-4 opacity-30" />
                        <p>No hay vuelos registrados aún</p>
                    </div>
                ) : (
                    <>
                        {/* Vista Desktop */}
                        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} />
                                                Fecha
                                            </div>
                                        </th>
                                        <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <div className="flex items-center gap-2">
                                                <School size={14} />
                                                Escuela
                                            </div>
                                        </th>
                                        <th className="text-center py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <div className="flex items-center justify-center gap-2">
                                                <Users size={14} />
                                                Niños
                                            </div>
                                        </th>
                                        <th className="text-center py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Documentos
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {flights.map((flight, index) => (
                                        <motion.tr
                                            key={flight.id || index}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="hover:bg-slate-50/50 transition-colors"
                                        >
                                            <td className="py-4 px-6 text-sm text-slate-600">
                                                {formatDate(flight.fecha)}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div>
                                                    <p className="font-medium text-slate-800">{flight.nombre_escuela || '—'}</p>
                                                    <p className="text-xs text-slate-400">{flight.colonia || ''}</p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-sm font-bold">
                                                    <Heart size={12} className="fill-current" />
                                                    {flight.ninos_sesion || 0}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-center gap-2">
                                                    {flight.acta_url ? (
                                                        <a
                                                            href={flight.acta_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                                                        >
                                                            <FileText size={14} />
                                                            Acta
                                                            <ExternalLink size={10} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                    {flight.foto_url ? (
                                                        <a
                                                            href={flight.foto_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 rounded-xl text-xs font-bold transition-colors"
                                                        >
                                                            <Camera size={14} />
                                                            Foto
                                                            <ExternalLink size={10} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Vista Mobile (Cards) */}
                        <div className="md:hidden space-y-4">
                            {flights.map((flight, index) => (
                                <motion.div
                                    key={flight.id || index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-slate-50 rounded-2xl p-5 border border-slate-100"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-bold text-slate-800">{flight.nombre_escuela || '—'}</p>
                                            <p className="text-xs text-slate-400">{flight.colonia || ''}</p>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-bold">
                                            <Heart size={12} className="fill-current" />
                                            {flight.ninos_sesion || 0}
                                        </span>
                                    </div>

                                    <div className="text-xs text-slate-500 mb-4">
                                        <Calendar size={12} className="inline mr-1" />
                                        {formatDate(flight.fecha)}
                                    </div>

                                    <div className="flex gap-2">
                                        {flight.acta_url && (
                                            <a
                                                href={flight.acta_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                            >
                                                <FileText size={14} />
                                                Ver Acta
                                            </a>
                                        )}
                                        {flight.foto_url && (
                                            <a
                                                href={flight.foto_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-fuchsia-500 text-white rounded-xl text-xs font-bold"
                                            >
                                                <Camera size={14} />
                                                Ver Foto
                                            </a>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

// --- PÁGINA PRINCIPAL ---
export default function DashboardPage({ previewMode = false }) {
    const [impactData, setImpactData] = useState({ ninosVolados: 0, ninosPatrocinados: 0 });
    const [flights, setFlights] = useState([]);
    const [nextMissions, setNextMissions] = useState([]); // <--- New State
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sponsorName, setSponsorName] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    // Verificar autenticación y leer datos del patrocinador
    // Verificar autenticación y leer datos del patrocinador (opcional)
    // Verificar autenticación y leer datos del patrocinador
    useEffect(() => {
        const checkSession = async () => {
            // BYPASS: Preview Mode from Props
            if (previewMode) {
                setSponsorUser({
                    nombre: 'Vista Previa Admin',
                    email: 'admin@flyhighedu.org',
                    id: 'admin-preview',
                    aportacion_total: 1500000,
                    role: 'admin_preview'
                });
                setSponsorName('Admin');
                setIsAuthenticated(true);
                setCheckingAuth(false);
                return;
            }

            // BYPASS: Vista Previa desde Admin
            // BYPASS: Vista Previa desde Admin
            const params = new URLSearchParams(window.location.search);
            if (params.get('preview') === 'admin_bypass') {
                const sponsorId = params.get('id');
                if (sponsorId) {
                    try {
                        const { data, error } = await supabaseNew
                            .from('patrocinadores')
                            .select('*')
                            .eq('id', sponsorId)
                            .single();

                        if (data && !error) {
                            setSponsorUser(data);
                            setSponsorName(data.nombre);
                            setIsAuthenticated(true);
                            setCheckingAuth(false);
                            return;
                        }
                    } catch (err) {
                        console.error('Error fetching preview sponsor:', err);
                    }
                }

                setSponsorUser({
                    nombre: 'Vista Previa Admin',
                    email: 'admin@flyhighedu.org',
                    id: 'admin-preview',
                    aportacion_total: 1500000, // Valor ejemplo para visualizar
                    role: 'admin_preview'
                });
                setSponsorName('Admin');
                setIsAuthenticated(true);
                setCheckingAuth(false);
                return;
            }

            try {
                const sessionData = sessionStorage.getItem('flyHighSponsor') || sessionStorage.getItem('sponsorUser');

                if (sessionData) {
                    const parsed = JSON.parse(sessionData);

                    if (parsed && parsed.id) {
                        // RE-FETCH para asegurar datos frescos (ej: nueva aportación)
                        const { data: freshData, error } = await supabaseNew
                            .from('patrocinadores')
                            .select('*')
                            .eq('id', parsed.id)
                            .single();

                        if (!error && freshData) {
                            setSponsorUser(freshData);
                            setSponsorName(freshData.nombre);
                            setIsAuthenticated(true);
                            // Actualizar sesión con datos frescos
                            sessionStorage.setItem('sponsorUser', JSON.stringify(freshData));
                        } else {
                            // Si falla (ej: usuario borrado), limpiar sesión
                            console.warn('Sesión inválida o usuario no encontrado');
                            sessionStorage.removeItem('flyHighSponsor');
                            sessionStorage.removeItem('sponsorUser');
                        }
                    }
                }
            } catch (err) {
                console.warn('Error validating session:', err);
            } finally {
                setCheckingAuth(false);
            }
        };

        checkSession();
    }, []);

    // --- ESTADO DE PATROCINADOR (LOGIN) ---
    const [sponsorUser, setSponsorUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    // --- EFECTO: PRELLENADO DE LOGIN (VISTA PREVIA) ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'test_login') {
            const email = params.get('email');
            const password = params.get('password');
            if (email && password) {
                setLoginForm({ email, password });
                setShowLoginModal(true);
            }
        }
    }, []);

    // --- HANDLER LOGIN ---
    const handleSponsorLogin = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        try {
            const { data, error } = await supabaseNew
                .from('patrocinadores')
                .select('*')
                .eq('email', loginForm.email)
                .eq('password', loginForm.password)
                .single();

            if (error || !data) throw new Error('Credenciales incorrectas');

            // Login exitoso
            setSponsorUser(data);
            setSponsorName(data.nombre);
            setIsAuthenticated(true); // <--- CRITICAL FIX: Update auth state

            // Persistir sesión
            sessionStorage.setItem('flyHighSponsor', JSON.stringify(data));
            sessionStorage.setItem('sponsorUser', JSON.stringify(data));

            setShowLoginModal(false); // Legacy state, nice to keep clean
            setLoginForm({ email: '', password: '' });
        } catch (err) {
            setLoginError('Acceso denegado. Verifica tus datos.');
        } finally {
            setLoginLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // ── FUENTE ÚNICA DE VERDAD: server-side API (bypasses RLS) ──
                const res = await fetch('/api/dashboard-data');
                if (!res.ok) throw new Error('Error al cargar datos del dashboard');
                const { journeys, cierres, schools, totals, liveStudentsMap } = await res.json();

                // Build enriched flight list from real data
                const enrichedFlights = buildFlightList(journeys, cierres, schools, liveStudentsMap);
                setFlights(enrichedFlights);

                // Totals already calculated server-side from cierres_mision
                setImpactData({
                    ninosVolados: totals.ninosVolados,
                    ninosPatrocinados: totals.ninosPatrocinados,
                });

                // ── CRITICAL FIX: SSoT for Cronograma ──
                // Use actual operational staff_journeys instead of hypothetical proximas_escuelas
                const schoolMap = {};
                (schools || []).forEach(s => { schoolMap[s.id] = s; });
                
                const realMissions = (journeys || []).map(j => {
                    const school = schoolMap[j.school_id];
                    return {
                        id: j.id,
                        estatus: j.status === 'closed' ? 'completada' : 'programada',
                        nombre_escuela: j.school_name || school?.nombre_escuela || 'Sin nombre',
                        colonia: school?.colonia || '',
                        fecha_programada: j.date,
                    };
                });
                
                setNextMissions(realMissions);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // ── Real-time: staff_journeys updates → auto-move Pendientes↔Historial ──
    useEffect(() => {
        const channel = supabaseNew
            .channel('cronograma-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'staff_journeys'
            }, (payload) => {
                if (payload.eventType === 'UPDATE' && payload.new) {
                    setNextMissions((prev) =>
                        prev.map((m) => m.id === payload.new.id ? { 
                            ...m, 
                            estatus: payload.new.status === 'closed' ? 'completada' : 'programada',
                            fecha_programada: payload.new.date
                        } : m)
                    );
                } else if (payload.eventType === 'INSERT' && payload.new) {
                    const newMission = {
                        id: payload.new.id,
                        estatus: payload.new.status === 'closed' ? 'completada' : 'programada',
                        nombre_escuela: payload.new.school_name || 'Nueva Escuela',
                        colonia: '',
                        fecha_programada: payload.new.date,
                    };
                    setNextMissions((prev) => [newMission, ...prev]);
                }
            })
            .subscribe();

        return () => {
            supabaseNew.removeChannel(channel);
        };
    }, []);

    // Mostrar pantalla de carga mientras se verifica autenticación
    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 size={40} className="animate-spin text-cyan-500" />
            </div>
        );
    }

    // --- VISTA DE LOGIN (NO AUTENTICADO) ---
    if (!isAuthenticated) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                {/* Modal/Tarjeta con imagen integrada (Traído de /login) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-full max-w-[420px] bg-white rounded-[28px] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.15)] overflow-hidden intro-card"
                >
                    {/* Imagen en la parte superior - visible completa */}

                    <div className="relative">
                        <img
                            src="/img/Firefly_Vertical mobile wallpaper, bright blue sky with soft white clouds, shallow depth of f 704566.jpg"
                            alt="Niño soñando con volar"
                            className="w-full h-[240px] object-cover"
                        />

                        {/* Labels en la imagen */}
                        <div className="absolute top-4 left-4">
                            <span
                                className="text-white text-xs font-bold uppercase tracking-[0.2em]"
                                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                            >
                                Patrocinadores
                            </span>
                        </div>

                        {/* Badge campaña activa */}
                        <div className="absolute top-4 right-4">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/30">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                <span className="text-white text-[10px] font-bold uppercase tracking-wide">
                                    Campaña activa
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Contenido del formulario */}
                    <div className="p-7">
                        {/* Header */}
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1">
                                El cielo tiene tu nombre
                            </h1>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Los sueños necesitan de alguien que crea en ellos antes de que despeguen. <span className="font-semibold text-slate-500">Gracias por creer.</span>
                            </p>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleSponsorLogin} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Tu correo
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-300" />
                                    <input
                                        type="email"
                                        value={loginForm.email}
                                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                                        required
                                        placeholder="correo@tuempresa.com"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 focus:bg-white transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-300" />
                                    <input
                                        type="password"
                                        value={loginForm.password}
                                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {loginError && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100"
                                >
                                    <AlertCircle size={15} />
                                    <span className="text-xs font-medium">{loginError}</span>
                                </motion.div>
                            )}

                            <button
                                type="submit"
                                disabled={loginLoading || !loginForm.email || !loginForm.password}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:translate-y-[-1px] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 group text-sm"
                            >
                                {loginLoading ? (
                                    <><Loader2 size={16} className="animate-spin" /> Verificando...</>
                                ) : (
                                    <>
                                        Ver mi impacto
                                        {/* Usando ChevronRight ya que ArrowRight no estaba importado */}
                                        <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                            <p className="text-slate-400 text-xs">
                                ¿Necesitas ayuda?{' '}
                                <a href="mailto:hola@flyhighedu.com" className="text-cyan-600 font-semibold hover:underline">
                                    hola@flyhighedu.com
                                </a>
                            </p>
                        </div>










                    </div>
                </motion.div>
            </main>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
                    <p className="text-slate-600">Error al cargar el dashboard</p>
                    <p className="text-sm text-slate-400 mt-2">{error}</p>
                </div>
            </div>
        );
    }

    // 4. VISTA DE DASHBOARD (AUTENTICADO)
    return (
        <main className="min-h-screen bg-white font-sans selection:bg-cyan-100 selection:text-cyan-900">
            <DashboardHero
                sponsorName={sponsorName}
                onLogout={() => {
                    setIsAuthenticated(false);
                    setSponsorUser(null);
                    setSponsorName(null);
                    sessionStorage.removeItem('flyHighSponsor');
                    sessionStorage.removeItem('sponsorUser');
                }}
            />

            {/* Tarjeta Privada */}
            <SponsorPrivateCard sponsor={sponsorUser} />

            {/* Sección de Estadísticas de Impacto (Global + Becas) */}
            <UnifiedImpactCard
                ninosVolados={impactData.ninosVolados}
                ninosPatrocinados={impactData.ninosPatrocinados}
                isLoading={isLoading}
            />

            {/* Registro de Vuelos (Mapa y Tabla) */}
            <SchoolsMap flights={flights} />
            <TransparencyTable flights={flights} isLoading={isLoading} />

            {/* Próximas Misiones */}
            <NextMissions missions={nextMissions} />

            {/* Footer simple */}
            <footer className="py-8 px-4 bg-slate-50 border-t border-slate-100">
                <p className="text-center text-xs text-slate-400">
                    Dashboard de Transparencia · Fly High Edu · {new Date().getFullYear()}
                </p>
            </footer>
        </main>
    );
}
