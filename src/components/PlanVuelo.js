'use client';

import React, { useRef, useState, memo } from 'react';
import { ArrowDown } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const PlanVuelo = () => {
    // Referencia al contenedor ALTO que permite el scroll
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // 1. Scroll vinculado al contenedor de 300vh
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    // 2. Física de resorte para suavizar el input táctil (menos agresivo que antes)
    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    // 3. Animaciones mapeadas al progreso del scroll (0 a 1 a lo largo de 300vh)

    // Visor: Entra durante el primer tercio del scroll
    const visorY = useTransform(smoothProgress, [0.1, 0.4], ["150%", "0%"]);
    const visorOpacity = useTransform(smoothProgress, [0.1, 0.3], [0, 1]);

    // Header: Pequeño parallax para dar profundidad
    const headerY = useTransform(smoothProgress, [0, 0.5], ["0%", "-50%"]);
    const headerOpacity = useTransform(smoothProgress, [0.4, 0.6], [1, 0]); // Se desvanece un poco al llegar el visor

    // Botón: Aparece al final
    const buttonOpacity = useTransform(smoothProgress, [0.6, 0.8], [0, 1]);
    const buttonY = useTransform(smoothProgress, [0.6, 0.8], [40, 0]);

    return (
        // CONTENEDOR MAESTRO (Height Track)
        // Crea el espacio de scroll físico para evitar jitter en secciones inferiores
        <div
            ref={containerRef}
            className="relative w-full h-[250vh] bg-white z-10"
        >
            {/* CONTENEDOR STICKY (Viewport fijo) */}
            <div className="sticky top-0 left-0 w-full h-[100dvh] overflow-hidden flex flex-col bg-white">

                {/* Styles */}
                <style jsx>{`
                    @keyframes float {
                        0%, 100% { transform: translate3d(0, 0, 0); }
                        50% { transform: translate3d(0, -10px, 0); }
                    }
                    .animate-float {
                        animation: float 6s ease-in-out infinite;
                        will-change: transform;
                    }
                `}</style>
                <style jsx global>{`
                    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
                `}</style>

                {/* Fondo Decorativo */}
                <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-20 -right-20 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(239,246,255,0.8)_0%,transparent_70%)] opacity-50"></div>
                </div>

                <div className="relative z-10 w-full h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center">

                    {/* 1. HEADER (Parallax) */}
                    <motion.div
                        style={{ y: headerY, opacity: headerOpacity }}
                        className="text-center mb-1 md:mb-4 shrink-0 relative will-change-transform"
                    >
                        <div className="inline-flex items-center gap-2 px-6 py-2 md:px-4 md:py-1.5 rounded-full bg-slate-900 text-white mb-2 md:mb-3 shadow-lg">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F0FF]"></span>
                            </span>
                            <span className="text-xs md:text-[10px] font-bold tracking-[0.2em] uppercase text-[#00F0FF]">Experiencia Aérea</span>
                        </div>

                        <h2 className="font-['Outfit',sans-serif] font-black text-5xl md:text-5xl lg:text-6xl text-slate-900 tracking-tighter leading-[1.1] mb-2 md:mb-3 drop-shadow-xl max-w-6xl mx-auto">
                            Aventura por el <br className="md:hidden" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] via-cyan-400 to-[#00C6FF] bg-[length:200%_auto] animate-pulse">cielo de Uruapan.</span>
                        </h2>

                        <p className="text-slate-500 text-base md:text-xl leading-relaxed max-w-4xl mx-auto text-pretty px-4">
                            Un emocionante vuelo por los principales puntos de interés de Uruapan, <span className="text-slate-900 font-bold bg-sky-50 px-1 rounded">en tiempo real</span>.
                        </p>
                    </motion.div>

                    {/* 2. VISOR + VIDEO (Main Actor) */}
                    <motion.div
                        style={{ y: visorY, opacity: visorOpacity }}
                        className="relative w-full max-w-4xl mx-auto flex flex-col items-center will-change-transform transform-gpu"
                    >
                        {/* SVG Clip Path */}
                        <svg width="0" height="0" className="absolute">
                            <defs>
                                <clipPath id="visor-shape-2" clipPathUnits="objectBoundingBox">
                                    <path d="M 0.08, 0.15 Q 0.5, 0.05 0.92, 0.15 Q 1, 0.15 1, 0.5 Q 1, 0.85 0.92, 0.85 L 0.6, 0.85 Q 0.5, 0.65 0.4, 0.85 L 0.08, 0.85 Q 0, 0.85 0, 0.5 Q 0, 0.15 0.08, 0.15 Z" />
                                </clipPath>
                            </defs>
                        </svg>

                        <div className="relative w-full aspect-[16/9] md:aspect-[2.2/1] animate-float">

                            {/* Sombra */}
                            <div
                                className="absolute inset-0 bg-black/40 blur-[30px] z-0 translate-y-8 scale-[0.95]"
                                style={{
                                    clipPath: 'url(#visor-shape-2)',
                                    WebkitClipPath: 'url(#visor-shape-2)',
                                    transform: 'translate3d(0,0,0)'
                                }}
                            ></div>

                            {/* Cuerpo del Visor */}
                            <div className="relative w-full h-full z-10">
                                <div
                                    className="absolute inset-0 bg-white"
                                    style={{
                                        clipPath: 'url(#visor-shape-2)',
                                        WebkitClipPath: 'url(#visor-shape-2)',
                                        transform: 'translate3d(0,0,0)'
                                    }}
                                >
                                    {/* Pantalla */}
                                    <div
                                        className="absolute inset-x-[2%] inset-y-[8%] bg-slate-900 overflow-hidden shadow-inner"
                                        style={{
                                            clipPath: 'url(#visor-shape-2)',
                                            WebkitClipPath: 'url(#visor-shape-2)',
                                            transform: 'translate3d(0,0,0)'
                                        }}
                                    >
                                        {/* Poster */}
                                        <div
                                            className={`absolute inset-0 z-20 transition-opacity duration-700 bg-slate-900 ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                            style={{ willChange: 'opacity' }}
                                        >
                                            <img
                                                src="/img/poster-visor.jpg"
                                                className="w-full h-full object-cover opacity-80"
                                                alt="Visor Poster"
                                            />
                                        </div>

                                        {/* Video Hardware Accelerated */}
                                        <video
                                            ref={videoRef}
                                            className="w-full h-full object-cover opacity-90 relative z-10"
                                            preload="metadata"
                                            decoding="async"
                                            muted
                                            loop
                                            playsInline
                                            autoPlay
                                            {...{ 'webkit-playsinline': 'true' }}
                                            suppressHydrationWarning={true}
                                            onTimeUpdate={(e) => {
                                                if (e.target.currentTime > 0.2 && !isPlaying) {
                                                    setIsPlaying(true);
                                                }
                                            }}
                                            style={{ transform: 'translate3d(0,0,0)' }}
                                        >
                                            <source src="/videos/TeaserWeb.mp4" type="video/mp4" />
                                        </video>

                                        {/* UI Overlays */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none mix-blend-overlay"></div>

                                        <div className="absolute top-[15%] right-[10%] z-30 flex items-center gap-2 pointer-events-none">
                                            <ArrowDown className="w-3 h-3 md:w-4 md:h-4 text-white rotate-180 drop-shadow-md" />
                                            <span className="font-['Share_Tech_Mono',monospace] text-white text-[10px] md:text-sm tracking-[0.2em] uppercase font-bold drop-shadow-md">
                                                ALT: 120m
                                            </span>
                                        </div>

                                        <div className="absolute bottom-[25%] left-[12%] z-30 flex items-center gap-2 pointer-events-none">
                                            <div className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                            </div>
                                            <span className="font-['Share_Tech_Mono',monospace] text-white text-[10px] md:text-sm tracking-[0.2em] uppercase font-bold drop-shadow-md">
                                                LIVE CAM
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* 3. BOTÓN (Next Step) */}
                    <motion.div
                        style={{ opacity: buttonOpacity, y: buttonY }}
                        className="mt-6 flex justify-center shrink-0 will-change-transform"
                    >
                        <div
                            onClick={() => {
                                const element = document.getElementById('experiencia-inmersiva');
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                            className="bg-white text-slate-900 px-6 py-3 rounded-full font-['Outfit',sans-serif] font-bold text-xs md:text-sm tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 transition-transform cursor-pointer border border-slate-200"
                        >
                            SIGUIENTE PARADA
                            <ArrowDown className="w-4 h-4 text-cyan-500" />
                        </div>
                    </motion.div>

                </div>
            </div>
        </div>
    );
};

export default memo(PlanVuelo);
