"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, HeartHandshake, Plane, LogIn } from 'lucide-react';

/**
 * PatrocinadoresHero Component
 * Auditoría Estructural: Composición equilibrada y rítmica.
 */
export default function PatrocinadoresHero({ onScrollToSponsors, onOpenPortal }) {
    const [logoIndex, setLogoIndex] = useState(0);

    const sponsorLogos = [
        { src: "/img/logo sp Negro.png", alt: "Strong Plastic", isMedium: true },
        { src: "/img/Logo Madobox.png", alt: "Madobox" },
        { src: "/img/logo RV Fresh.png", alt: "RV Fresh", isFeatured: true },
        { src: "/img/Logo Global Frut png.png", alt: "Global Frut", isFeatured: true },
        { src: "/img/bonanza.png", alt: "Bonanza", isSmall: true }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setLogoIndex((prev) => (prev + 1) % sponsorLogos.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [sponsorLogos.length]);

    const scrollToContent = () => {
        if (onScrollToSponsors) {
            onScrollToSponsors();
        }
    };

    return (
        <header className="relative w-full h-[100dvh] overflow-hidden font-sans bg-slate-950">
            {/* Background Video - Encuadrado para visibilidad facial */}
            <div className="absolute inset-0 z-0">
                <video
                    className="w-full h-full object-cover scale-[1.1] object-[center_40%]"
                    src="/videos/video hero niño patrocinadores.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                />
                {/* Cinematic Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/30 to-slate-900/90" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150 mix-blend-overlay pointer-events-none"></div>
            </div>

            {/* Main Composition Layout */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-between pt-12 pb-4 px-6 sm:pt-20 sm:pb-8">

                {/* Upper Content: Header, Title & Subtitle */}
                <div className="flex flex-col items-center gap-y-6 sm:gap-y-10 max-w-5xl w-full mt-4">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}
                    >
                        <span className="inline-flex items-center gap-3 text-white/90 drop-shadow-md font-black uppercase tracking-[0.4em] text-xs sm:text-base">
                            <HeartHandshake size={20} />
                            Portal Patrocinadores
                        </span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="text-4xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter uppercase leading-[0.9] drop-shadow-2xl text-center"
                    >
                        EL CIELO DE <br className="hidden sm:block" />
                        URUAPAN TIENE <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">NOMBRE.</span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.4 }}
                        className="text-sm sm:text-xl text-slate-200 font-medium max-w-xl mx-auto leading-relaxed text-balance drop-shadow-lg text-center opacity-90"
                    >
                        Las empresas que decidieron apostar por <span className="text-white font-bold">nuestra infancia</span> para que toda una generación comience a <span className="text-white font-bold italic">conquistar el cielo.</span>
                    </motion.p>
                </div>

                {/* Bottom Content: Logos, Buttons & Scroll */}
                <div className="flex flex-col items-center w-full gap-y-4 sm:gap-y-6">
                    {/* Logo Carousel - Escalado Selectivo Sutil (+15%) - Pegado Total */}
                    <div className="h-32 sm:h-56 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={logoIndex}
                                src={sponsorLogos[logoIndex].src}
                                alt={sponsorLogos[logoIndex].alt}
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.1, y: -10 }}
                                transition={{ duration: 0.6 }}
                                className={`w-auto object-contain brightness-0 invert opacity-60 transition-all ${sponsorLogos[logoIndex].isSmall ? 'h-16 sm:h-30' :
                                    sponsorLogos[logoIndex].isMedium ? 'h-21 sm:h-39' :
                                        sponsorLogos[logoIndex].isFeatured ? 'h-28 sm:h-50' :
                                            'h-24 sm:h-44'
                                    }`}
                            />
                        </AnimatePresence>
                    </div>

                    {/* Action Buttons (Smart FAB Style) - Pegado Total */}
                    <div className="flex flex-col items-center gap-3 w-full px-8 -mt-10 sm:-mt-22">
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            onClick={() => window.location.href = '/dashboard'}
                            className="w-64 py-3.5 bg-transparent border border-white/80 text-white rounded-full transition-all active:scale-95 flex items-center justify-center gap-3 hover:bg-white/5"
                        >
                            <img
                                src="/img/login icono saludando.gif"
                                alt="Login"
                                className="w-6 h-6 object-contain"
                            />
                            <div className="flex flex-col items-start text-left leading-tight">
                                <span className="font-black text-[10px] uppercase tracking-widest">Iniciar Sesión</span>
                                <span className="font-medium text-[7px] opacity-60 uppercase tracking-[0.2em] -mt-0.5">Como Patrocinador</span>
                            </div>
                        </motion.button>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            onClick={scrollToContent}
                            className="w-64 py-3.5 bg-white text-blue-600 rounded-full font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center justify-center gap-2"
                        >
                            <Plane size={16} />
                            CONÓCELOS
                        </motion.button>
                    </div>

                    {/* Footer Nav - Forzando visibilidad */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.8 }}
                        transition={{ delay: 1 }}
                        className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-100 transition-opacity pb-2 sm:pb-4 z-30"
                        onClick={scrollToContent}
                    >
                        <span className="text-[9px] font-bold uppercase tracking-[0.4em] mb-1">Desliza</span>
                        <ArrowDown size={28} className="animate-bounce text-white" />
                    </motion.div>
                </div>
            </div>
        </header>
    );
}
