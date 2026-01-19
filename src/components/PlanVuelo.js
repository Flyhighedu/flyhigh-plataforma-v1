'use client';

import React, { useRef, useState, memo } from 'react';
import { ArrowDown } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const PlanVuelo = () => {
    const sectionRef = useRef(null);
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // 1. Optimización de Scroll con Spring Physics
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"]
    });

    // Absorbe el "jitter" del scroll táctil
    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    // 2. Transformaciones Mapeadas
    // Cuando la sección entra, el visor sube desde y=200px a y=0px
    const visorY = useTransform(smoothProgress, [0.1, 0.4], [200, 0]);
    const visorOpacity = useTransform(smoothProgress, [0.1, 0.3], [0, 1]);

    // Header parallax suave
    const headerY = useTransform(smoothProgress, [0, 0.3], [50, 0]);

    // Botón aparece al final
    const buttonOpacity = useTransform(smoothProgress, [0.35, 0.45], [0, 1]);
    const buttonY = useTransform(smoothProgress, [0.35, 0.45], [20, 0]);

    return (
        <div
            ref={sectionRef}
            className="relative z-10 bg-white w-full snap-start -mt-1"
            style={{ isolation: 'isolate' }} // 4. Simplificación de capas de pintado
        >
            <section className="min-h-[100dvh] w-full flex flex-col py-2 md:py-4 bg-white relative z-50 overflow-hidden">

                {/* Styles for this component */}
                <style jsx>{`
                    /* Animación de Flotación (Floating) - GPU Optimized */
                    @keyframes float {
                        0%, 100% { transform: translate3d(0, 0, 0); }
                        50% { transform: translate3d(0, -15px, 0); }
                    }

                    .animate-float {
                        animation: float 6s ease-in-out infinite;
                        will-change: transform; /* 1. Hardware Acceleration Hint */
                    }
                `}</style>

                {/* Import Font manually if not in layout */}
                <style jsx global>{`
                    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
                `}</style>

                {/* Fondo Estático Simplificado */}
                <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(239,246,255,0.8)_0%,transparent_70%)] opacity-50 will-change-transform translate-z-0"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full h-full flex flex-col justify-center">

                    {/* 1. HEADER */}
                    <motion.div
                        style={{ y: headerY }}
                        className="text-center mb-1 md:mb-2 shrink-0 relative will-change-transform"
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
                            Un emocionante vuelo por los principales puntos de interés de Uruapan, <span className="text-slate-900 font-bold bg-sky-50 px-1 rounded">totalmente en tiempo real</span>, que inspira a nuestros niños a volver a mirar hacia el cielo.
                        </p>
                    </motion.div>

                    {/* 2. LA ATRACCIÓN (Pure CSS VR Visor) */}
                    <motion.div
                        style={{ y: visorY, opacity: visorOpacity }}
                        className="relative w-full max-w-3xl mx-auto flex flex-col items-center will-change-transform transform-gpu" // 1. Hardware Acceleration
                    >
                        {/* SVG Definition for Visor Shape */}
                        <svg width="0" height="0" className="absolute">
                            <defs>
                                <clipPath id="visor-shape" clipPathUnits="objectBoundingBox">
                                    <path d="M 0.08, 0.15 Q 0.5, 0.05 0.92, 0.15 Q 1, 0.15 1, 0.5 Q 1, 0.85 0.92, 0.85 L 0.6, 0.85 Q 0.5, 0.65 0.4, 0.85 L 0.08, 0.85 Q 0, 0.85 0, 0.5 Q 0, 0.15 0.08, 0.15 Z" />
                                </clipPath>
                            </defs>
                        </svg>

                        {/* Wrapper for Visor + Shadow */}
                        <div className="relative w-full aspect-[16/9] md:aspect-[2/1] animate-float" style={{ transform: 'translate3d(0,0,0)' }}>

                            {/* SEPARATED SHADOW ELEMENT */}
                            <div
                                className="absolute inset-0 bg-black/40 blur-[25px] z-0 translate-y-6 scale-[0.98]"
                                style={{
                                    clipPath: 'url(#visor-shape)',
                                    WebkitClipPath: 'url(#visor-shape)',
                                    transform: 'translate3d(0, 24px, 0) scale(0.98)' // GPU transform
                                }}
                            ></div>

                            {/* Visor Container */}
                            <div className="relative w-full h-full z-10">

                                {/* Hardware Body */}
                                <div
                                    className="absolute inset-0 bg-white"
                                    style={{
                                        clipPath: 'url(#visor-shape)',
                                        WebkitClipPath: 'url(#visor-shape)',
                                        transform: 'translate3d(0,0,0)'
                                    }}
                                >
                                    {/* Video Screen (Inside) */}
                                    <div
                                        className="absolute inset-x-[3%] inset-y-[10%] bg-slate-900 overflow-hidden shadow-inner"
                                        style={{
                                            clipPath: 'url(#visor-shape)',
                                            WebkitClipPath: 'url(#visor-shape)',
                                            transform: 'translate3d(0,0,0)'
                                        }}
                                    >
                                        {/* Fallback Poster Image */}
                                        <div
                                            className={`absolute inset-0 z-20 transition-opacity duration-700 ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                            style={{ willChange: 'opacity' }}
                                        >
                                            <img
                                                src="/img/poster-visor.jpg"
                                                className="w-full h-full object-cover"
                                                alt="Visor Poster"
                                            />
                                        </div>

                                        {/* 3. Decodificación de Video Optimizada */}
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
                                                // Solo ocultar poster cuando realmente hay frames reproduciéndose
                                                if (e.target.currentTime > 0.2 && !isPlaying) {
                                                    setIsPlaying(true);
                                                }
                                            }}
                                            style={{ transform: 'translate3d(0,0,0)' }}
                                        >
                                            <source src="/videos/TeaserWeb.mp4" type="video/mp4" />
                                        </video>

                                        {/* Screen Glare */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none mix-blend-overlay"></div>

                                        {/* Altura Indicator */}
                                        <div className="absolute top-[15%] right-[10%] z-30 flex items-center gap-2 pointer-events-none">
                                            <ArrowDown className="w-3 h-3 md:w-4 md:h-4 text-white rotate-180 drop-shadow-md" />
                                            <span className="font-['Share_Tech_Mono',monospace] text-white text-[10px] md:text-sm tracking-[0.2em] uppercase font-bold drop-shadow-md">
                                                ALTURA: 120m
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* En Vivo Indicator */}
                                <div className="absolute bottom-[25%] left-[15%] z-30 flex items-center gap-2 pointer-events-none">
                                    <div className="relative flex h-2 w-2 md:h-3 md:w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-red-500"></span>
                                    </div>
                                    <span className="font-['Share_Tech_Mono',monospace] text-white text-[10px] md:text-sm tracking-[0.2em] uppercase font-bold drop-shadow-md">
                                        EN VIVO
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Próxima Parada Button */}
                    <motion.div
                        style={{ opacity: buttonOpacity, y: buttonY }}
                        className="mt-1 md:mt-2 mb-2 flex justify-center shrink-0 will-change-transform" // 1. Hardware Acceleration
                    >
                        <div
                            onClick={() => {
                                const element = document.getElementById('experiencia-inmersiva');
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                            className="bg-white text-slate-900 px-6 py-3 rounded-full font-['Outfit',sans-serif] font-bold text-xs md:text-sm tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 transition-transform cursor-pointer border border-slate-100"
                        >
                            PRÓXIMA PARADA
                            <ArrowDown className="w-4 h-4" />
                        </div>
                    </motion.div>

                </div>
            </section>
        </div>
    );
};

// 5. Reducción de Re-renders
export default memo(PlanVuelo);
