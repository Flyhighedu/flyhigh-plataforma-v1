'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, School, Play, Landmark, Building2, HeartHandshake, Globe, Cpu, Wifi, Award, Shield, X, Triangle } from 'lucide-react';

// --- COMPONENTE DE CARRUSEL INFINITO (MARQUEE) ---
const AlliesMarquee = () => {
    // Lista de ejemplo de 8 aliados (Placeholders con iconos)
    // Lista de aliados reales con logos
    const allies = [
        { logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-ccfdsp.png", name: "FÁBRICA SAN PEDRO" },
        { logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-parque.png", name: "PARQUE NACIONAL" },
        { logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-secretaria-cultura-y-turismo.png", name: "SEC. CULTURA" },
        { logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/logo-museo-del-agua-png.png", name: "MUSEO DEL AGUA" },
        { logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/bonanza.png", name: "LA BONANZA" },
        { logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/strong-plastic.png", name: "STRONG PLASTIC" },
    ];

    // Duplicamos la lista para el efecto de loop infinito
    const marqueeList = [...allies, ...allies];

    return (
        <div className="w-full overflow-hidden flex items-center pt-2 opacity-90">
            {/* Contenedor animado que se mueve a la izquierda */}
            <motion.div
                className="flex gap-8 items-center whitespace-nowrap"
                animate={{ x: ["0%", "-50%"] }} // Se mueve hasta la mitad (el final de la primera lista)
                transition={{ ease: "linear", duration: 30, repeat: Infinity }} // Loop infinito suave
            >
                {marqueeList.map((ally, index) => (
                    <div key={index} className="flex items-center gap-2 shrink-0 grayscale hover:grayscale-0 transition-all duration-300">
                        <img src={ally.logo} alt={ally.name} className="h-6 w-auto object-contain brightness-0 invert" />
                        <span className="text-[10px] font-bold text-white/80 tracking-wider">{ally.name}</span>
                    </div>
                ))}
            </motion.div>
            {/* Degradados laterales para suavizar la entrada/salida */}
            <div className="absolute left-0 inset-y-0 w-4 bg-gradient-to-r from-white/10 to-transparent pointer-events-none rounded-l-[20px]"></div>
            <div className="absolute right-0 inset-y-0 w-4 bg-gradient-to-l from-white/10 to-transparent pointer-events-none rounded-r-[20px]"></div>
        </div>
    );
};

export default function Hero() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        // Intentar autoplay del preview
        if (videoRef.current && !isModalOpen) {
            videoRef.current.play().catch(e => console.log("Autoplay prevented"));
        }
    }, [isModalOpen]);

    const openModal = () => {
        setIsModalOpen(true);
        if (videoRef.current) videoRef.current.pause();
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    return (
        // LIENZO "OFF-WHITE" PREMIUM (#F2F2F7)
        <div className="h-[100dvh] w-full bg-white text-[#1D1D1F] font-sans overflow-hidden flex flex-col relative selection:bg-black selection:text-white pt-16 sticky top-0 z-0">

            {/* =====================================================================================
          2. ZONA SPLIT 65/35 (Título vs. Misión)
         ===================================================================================== */}
            <div className="px-4 pt-2 pb-2 flex items-center gap-3 z-10 min-h-[120px] shrink-0 relative">

                {/* COLUMNA IZQUIERDA (65%): TÍTULO ARQUITECTÓNICO */}
                <div className="flex flex-col justify-center leading-[0.9] select-none w-auto">
                    <motion.h1
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        className="font-['Anton',sans-serif] text-[14.5vw] md:text-[6vw] tracking-[-0.03em]"
                    >
                        <motion.span
                            animate={{ backgroundPosition: ["0% center", "200% center"] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-[length:200%_auto]"
                        >
                            EL CIELO
                        </motion.span>
                    </motion.h1>

                    {/* Línea 2: ES (Gris) + SUYO (Negro) */}
                    <div className="flex items-center gap-3">
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="font-['Inter',sans-serif] font-bold text-gray-500 text-[7vw] md:text-[3vw]"
                        >
                            ES
                        </motion.span>
                        <motion.h1
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="font-['Anton',sans-serif] text-[14.5vw] md:text-[6vw] tracking-[-0.03em] text-black"
                        >
                            SUYO
                        </motion.h1>
                    </div>
                </div>

                {/* DIVISOR VERTICAL */}
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "70px" }}
                    transition={{ duration: 0.8 }}
                    className="w-[1.5px] bg-gray-300 rounded-full"
                ></motion.div>

                {/* COLUMNA DERECHA (35%): MISIÓN CORTA */}
                <div className="w-[35%] flex items-center">
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="font-['Inter',sans-serif] text-[11px] md:text-[14px] font-medium text-gray-500 leading-tight -ml-2"
                    >
                        Llevamos a volar a la niñez de Uruapan para que descubran que pueden llegar tan alto como se atrevan a mirar.
                    </motion.p>
                </div>

            </div>

            {/* =====================================================================================
          3. EL MONOLITO DE VIDEO (Anclado al Suelo)
         ===================================================================================== */}
            {/* WRAPPER DE ENTRADA (Maneja la aparición desde abajo) */}
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "circOut" }}
                className="flex-1 mx-4 mt-6 mb-0 relative rounded-t-[32px] rounded-b-none shadow-[0_-10px_40px_rgba(0,0,0,0.15)] isolate bg-black"
            >
                {/* CONTENEDOR DE VIDEO (CLIPPED) */}
                <div className="absolute inset-0 rounded-t-[32px] overflow-hidden">
                    {/* VIDEO PREVIEW (Muted, Loop) */}
                    <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover object-center opacity-80 hover:opacity-100 transition-opacity duration-500"
                        src="https://flyhighedu.com.mx/wp-content/uploads/2025/11/kling_20251130_Image_to_Video__3700_0.mp4"
                        autoPlay
                        muted
                        loop
                        playsInline
                    />

                    {/* Gradiente Sutil (Solo abajo para resaltar la Isla) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                </div>

                {/* PLAY BUTTON (Centro Geométrico Visual) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-40 md:pb-32 gap-2">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg animate-pulse group-hover:scale-110 transition-transform">
                        <Play size={24} fill="white" className="text-white ml-1 opacity-90" />
                    </div>
                    <span className="text-[9px] font-medium text-white/60 uppercase tracking-[0.2em] mt-1">Reproducir</span>
                </div>

                {/* Interacción Click -> ABRIR MODAL */}
                <div onClick={openModal} className="absolute inset-0 z-10 cursor-pointer group"></div>

                {/* 1. Triángulo Cian (Arriba Izquierda - Cruzando esquina) */}
                <motion.div
                    className="absolute -top-8 -left-6 z-30 text-cyan-400 opacity-90"
                    initial={{ rotate: -45 }}
                    animate={{
                        x: [0, 10, 0],
                        y: [0, -15, 0],
                        rotate: [-45, -40, -45]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Triangle size={24} fill="currentColor" />
                </motion.div>

                {/* 2. Triángulo Naranja (Derecha Medio - Cruzando borde) */}
                <motion.div
                    className="absolute top-1/3 -right-8 z-30 text-orange-400 opacity-90"
                    initial={{ rotate: 135 }}
                    animate={{
                        x: [0, -15, 0],
                        y: [0, 20, 0],
                        rotate: [135, 130, 135]
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                    <Triangle size={20} fill="currentColor" />
                </motion.div>

                {/* 3. Triángulo Rosa (Abajo Izquierda - Cerca de la isla) */}
                <motion.div
                    className="absolute bottom-40 -left-4 z-30 text-pink-500 opacity-90"
                    initial={{ rotate: 15 }}
                    animate={{
                        x: [0, 20, 0],
                        y: [0, 10, 0],
                        rotate: [15, 20, 15]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                >
                    <Triangle size={16} fill="currentColor" />
                </motion.div>

                {/* 4. Triángulo Violeta (Arriba Derecha) */}
                <motion.div
                    className="absolute -top-4 -right-4 z-30 text-violet-500 opacity-90"
                    initial={{ rotate: 60 }}
                    animate={{
                        x: [0, -10, 0],
                        y: [0, 15, 0],
                        rotate: [60, 65, 60]
                    }}
                    transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 3 }}
                >
                    <Triangle size={18} fill="currentColor" />
                </motion.div>

                {/* 5. Triángulo Lima (Abajo Derecha) */}
                <motion.div
                    className="absolute bottom-20 -right-5 z-30 text-lime-400 opacity-90"
                    initial={{ rotate: -30 }}
                    animate={{
                        x: [0, -15, 0],
                        y: [0, -10, 0],
                        rotate: [-30, -25, -30]
                    }}
                    transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                >
                    <Triangle size={22} fill="currentColor" />
                </motion.div>

                {/* =====================================================================================
            4. ISLA DE CRISTAL FINAL (Texto Técnico + Botones + Carrusel)
           ===================================================================================== */}
                {/* Ajustado bottom-0 y pb-8 para que se sienta anclado dentro de la tarjeta */}
                <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none px-4">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white/10 backdrop-blur-xl border-t border-x border-white/20 rounded-t-[24px] rounded-b-none px-4 pt-4 pb-6 md:pb-4 shadow-2xl flex flex-col gap-4 pointer-events-auto relative overflow-hidden"
                    >
                        {/* 1. TEXTO TÉCNICO (Fuente Inter, Uppercase, Pequeño) */}
                        <div className="text-center">
                            <p className="font-['Inter',sans-serif] font-bold text-[10px] md:text-xs text-white/80 uppercase tracking-[0.15em]">
                                Campaña Fly High Edu 2025-2026
                            </p>
                        </div>

                        {/* 2. FILA DE BOTONES */}
                        <div className="flex gap-3">
                            {/* Botón Padrino (Dominante Blanco) */}
                            <button
                                onClick={() => document.getElementById('impact-engine')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex-1 bg-white text-black font-['Inter',sans-serif] font-bold text-[10px] md:text-xs py-3.5 rounded-[16px] shadow-lg flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all whitespace-nowrap"
                            >
                                <Heart size={16} fill="black" className="text-red-500" />
                                APADRINA UN SUEÑO
                            </button>

                            {/* Botón Escuela (Glass Outline) */}
                            <button className="flex-1 bg-transparent border border-white/30 text-white font-['Inter',sans-serif] font-bold text-xs py-3.5 rounded-[16px] flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all">
                                <School size={16} />
                                ESCUELA
                            </button>
                        </div>

                        {/* 3. CARRUSEL INFINITO DE ALIADOS (Marquee) */}
                        <AlliesMarquee />

                    </motion.div >
                </div >

            </motion.div >

            {/* =====================================================================================
          MODAL DE VIDEO (FULLSCREEN)
         ===================================================================================== */}
            < AnimatePresence >
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-10"
                        onClick={closeModal}
                    >
                        {/* Botón Cerrar */}
                        <button
                            onClick={closeModal}
                            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-[110]"
                        >
                            <X size={40} />
                        </button>

                        {/* Contenedor del Video */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full max-w-7xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <video
                                className="w-full h-full object-contain"
                                src="https://flyhighedu.com.mx/wp-content/uploads/2025/11/Trailer-comp.mp4"
                                controls
                                autoPlay
                                playsInline
                            />
                        </motion.div>
                    </motion.div>
                )
                }
            </AnimatePresence >

        </div >
    );
};
