'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, School } from 'lucide-react';
import Link from 'next/link';

/**
 * FloatingTrailerBtn - Botón flotante con dos fases:
 * 
 * Fase 1: "Ver Tráiler" (cyan-azul) - Aparece al hacer scroll, abre modal de video
 * Fase 2: "Agendar Escuela" (morado) - Aparece después de cerrar el video, lleva a /escuelas
 */
export default function FloatingTrailerBtn() {
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [phase, setPhase] = useState('trailer'); // 'trailer' | 'escuela'

    useEffect(() => {
        const handleScroll = () => {
            // El botón aparece cuando el usuario ha scrolleado más allá del 80% de la altura del viewport
            const scrollThreshold = window.innerHeight * 0.8;
            setIsVisible(window.scrollY > scrollThreshold);
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleOpenModal = () => {
        setIsModalOpen(true);
        setIsVisible(false);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setPhase('escuela'); // Cambiar a fase 2 después de cerrar el video
        setIsVisible(true);
    };

    return (
        <>
            {/* BOTÓN FLOTANTE - FASE 1: VER TRÁILER */}
            <AnimatePresence>
                {isVisible && phase === 'trailer' && !isModalOpen && (
                    <motion.button
                        key="trailer-btn"
                        initial={{ opacity: 0, y: 30, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20
                        }}
                        onClick={handleOpenModal}
                        className="
                            fixed bottom-6 right-6 z-[9999]
                            flex items-center gap-3
                            pl-2 pr-5 py-2
                            bg-gradient-to-r from-cyan-500 to-blue-600
                            rounded-full
                            text-white font-['Inter',sans-serif] font-bold text-sm
                            shadow-[0_8px_30px_rgba(34,211,238,0.4),0_4px_15px_rgba(0,0,0,0.2)]
                            hover:shadow-[0_12px_40px_rgba(34,211,238,0.5),0_6px_20px_rgba(0,0,0,0.3)]
                            active:scale-95
                            transition-all duration-300
                            cursor-pointer
                            group
                            overflow-hidden
                        "
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                    >
                        {/* Shimmer effect */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        />

                        {/* Icono Play con pulso */}
                        <motion.div
                            className="relative w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors"
                        >
                            {/* Anillo pulsante */}
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-white/50"
                                animate={{
                                    scale: [1, 1.3, 1],
                                    opacity: [0.8, 0, 0.8]
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeOut"
                                }}
                            />
                            <Play size={18} fill="white" className="text-white ml-0.5 drop-shadow-sm" />
                        </motion.div>

                        {/* Texto */}
                        <span className="relative tracking-wider uppercase text-xs font-semibold drop-shadow-sm">
                            Ver Tráiler
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* BOTÓN FLOTANTE - FASE 2: AGENDAR ESCUELA (MORADO) */}
            <AnimatePresence>
                {isVisible && phase === 'escuela' && !isModalOpen && (
                    <motion.div
                        key="escuela-btn"
                        initial={{ opacity: 0, y: 30, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            delay: 0.2
                        }}
                    >
                        <Link
                            href="/escuelas"
                            className="
                                fixed bottom-6 right-6 z-[9999]
                                flex items-center gap-3
                                pl-2 pr-5 py-2
                                bg-gradient-to-r from-violet-500 to-purple-600
                                rounded-full
                                text-white font-['Inter',sans-serif] font-bold text-sm
                                shadow-[0_8px_30px_rgba(139,92,246,0.4),0_4px_15px_rgba(0,0,0,0.2)]
                                hover:shadow-[0_12px_40px_rgba(139,92,246,0.5),0_6px_20px_rgba(0,0,0,0.3)]
                                hover:scale-105
                                active:scale-95
                                transition-all duration-300
                                cursor-pointer
                                group
                                overflow-hidden
                            "
                        >
                            {/* Shimmer effect */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                            />

                            {/* Icono Escuela con pulso */}
                            <motion.div
                                className="relative w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors"
                            >
                                {/* Anillo pulsante */}
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-white/50"
                                    animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [0.8, 0, 0.8]
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeOut"
                                    }}
                                />
                                <School size={18} className="text-white drop-shadow-sm" />
                            </motion.div>

                            {/* Texto */}
                            <span className="relative tracking-wider uppercase text-xs font-semibold drop-shadow-sm">
                                Agendar Escuela
                            </span>
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL DE VIDEO (Independiente) */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-10"
                        onClick={handleCloseModal}
                    >
                        {/* Botón Cerrar */}
                        <button
                            onClick={handleCloseModal}
                            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-[10010]"
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
                                src="/videos/Trailer.mp4"
                                controls
                                autoPlay
                                playsInline
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
