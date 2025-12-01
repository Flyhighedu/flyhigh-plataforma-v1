'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { MapPin, PlayCircle, ArrowDown } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function PlanVuelo() {
    const sectionRef = useRef(null);
    const visorRef = useRef(null);
    const buttonRef = useRef(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top top",
                    end: "+=100%", // Scroll distance to complete animation
                    pin: true,
                    scrub: 1, // Smooth scrubbing
                    // markers: true, // Uncomment for debugging
                }
            });

            // 1. Visor moves UP from below (y: 100% or similar) to center (y: 0)
            tl.fromTo(visorRef.current,
                { y: 300, opacity: 0 }, // Start state: down and invisible
                { y: 0, opacity: 1, duration: 2, ease: "power2.out" }
            )
                // 2. Button fades in at the end (overlapping with visor arrival)
                .fromTo(buttonRef.current,
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
                    "-=0.5" // Sync end of animation with visor arrival
                );

        }, sectionRef);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={sectionRef} className="h-[100dvh] w-full snap-start flex flex-col py-2 md:py-4 bg-white relative overflow-hidden">

            {/* Styles for this component */}
            <style jsx>{`
                /* Animación de Flotación (Floating) - GPU Optimized */
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-15px); }
                }

                .animate-float {
                    animation: float 6s ease-in-out infinite;
                    will-change: transform;
                }

                /* Ticket Ticket */
                .adventure-badge {
                    background: linear-gradient(90deg, #FF0055, #FF0080);
                    box-shadow: 0 4px 15px rgba(255, 0, 85, 0.4);
                    transform: rotate(-2deg);
                }
            `}</style>

            {/* Import Font manually if not in layout */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
            `}</style>

            {/* Fondo Dinámico - Optimized with translate3d for GPU */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -right-20 w-[800px] h-[800px] bg-blue-50/80 rounded-full blur-[120px] transform-gpu"></div>
                <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] bg-purple-50/60 rounded-full blur-[100px] transform-gpu"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full h-full flex flex-col justify-center">

                {/* 1. HEADER */}
                <div className="text-center mb-1 md:mb-2 shrink-0 relative">

                    <div className="inline-flex items-center gap-2 px-6 py-2 md:px-4 md:py-1.5 rounded-full bg-slate-900 text-white mb-2 md:mb-3 shadow-lg">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F0FF]"></span>
                        </span>
                        <span className="text-xs md:text-[10px] font-bold tracking-[0.2em] uppercase text-[#00F0FF]">Experiencia Aérea</span>
                    </div>

                    {/* TÍTULO COMPLETO */}
                    <h2 className="font-['Outfit',sans-serif] font-black text-5xl md:text-5xl lg:text-6xl text-slate-900 tracking-tighter leading-[1.1] mb-2 md:mb-3 drop-shadow-xl max-w-6xl mx-auto">
                        Aventura por el <br className="md:hidden" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] via-cyan-400 to-[#00C6FF] bg-[length:200%_auto] animate-pulse">cielo de Uruapan.</span>
                    </h2>

                    <p className="text-slate-500 text-base md:text-xl leading-relaxed max-w-4xl mx-auto text-pretty px-4">
                        Un emocionante vuelo por los principales puntos de interés de Uruapan, <span className="text-slate-900 font-bold bg-sky-50 px-1 rounded">totalmente en tiempo real</span>, que inspira a nuestros niños a volver a mirar hacia el cielo.
                    </p>
                </div>

                {/* 2. LA ATRACCIÓN (Pure CSS VR Visor) */}
                <div ref={visorRef} className="relative w-full max-w-3xl mx-auto flex flex-col items-center opacity-0 translate-y-[300px] will-change-transform transform-gpu">

                    {/* SVG Definition for Visor Shape (Goggle with Nose Notch) */}
                    <svg width="0" height="0" className="absolute">
                        <defs>
                            <clipPath id="visor-shape" clipPathUnits="objectBoundingBox">
                                <path d="M 0.08, 0.15 Q 0.5, 0.05 0.92, 0.15 Q 1, 0.15 1, 0.5 Q 1, 0.85 0.92, 0.85 L 0.6, 0.85 Q 0.5, 0.65 0.4, 0.85 L 0.08, 0.85 Q 0, 0.85 0, 0.5 Q 0, 0.15 0.08, 0.15 Z" />
                            </clipPath>
                        </defs>
                    </svg>

                    {/* Wrapper for Visor + Shadow */}
                    <div className="relative w-full aspect-[16/9] md:aspect-[2/1] animate-float">

                        {/* SEPARATED SHADOW ELEMENT (Static & Diffuse, moves with parent) */}
                        <div
                            className="absolute inset-0 bg-black/40 blur-[25px] z-0 translate-y-6 scale-[0.98]"
                            style={{ clipPath: 'url(#visor-shape)', WebkitClipPath: 'url(#visor-shape)' }}
                        ></div>

                        {/* Visor Container */}
                        <div className="relative w-full h-full z-10">

                            {/* Hardware Body (White Glossy) - Masked by SVG */}
                            <div
                                className="absolute inset-0 bg-white"
                                style={{ clipPath: 'url(#visor-shape)', WebkitClipPath: 'url(#visor-shape)' }}
                            >
                                {/* Video Screen (Inside) */}
                                <div
                                    className="absolute inset-x-[3%] inset-y-[10%] bg-slate-900 overflow-hidden shadow-inner"
                                    style={{ clipPath: 'url(#visor-shape)', WebkitClipPath: 'url(#visor-shape)' }}
                                >
                                    <video
                                        className="w-full h-full object-cover opacity-90"
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                    >
                                        <source src="https://flyhighedu.com.mx/wp-content/uploads/2025/10/Teaser-web2.mp4" type="video/mp4" />
                                    </video>

                                    {/* Screen Glare / Reflection */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none mix-blend-overlay"></div>

                                    {/* Altura Indicator (Top Right) */}
                                    <div className="absolute top-[15%] right-[10%] z-30 flex items-center gap-2 pointer-events-none">
                                        <ArrowDown className="w-3 h-3 md:w-4 md:h-4 text-white rotate-180 drop-shadow-md" />
                                        <span className="font-['Share_Tech_Mono',monospace] text-white text-[10px] md:text-sm tracking-[0.2em] uppercase font-bold drop-shadow-md">
                                            ALTURA: 120m
                                        </span>
                                    </div>
                                </div>

                                {/* Bezel Shading Removed for Uniform White Look */}
                            </div>

                            {/* En Vivo Indicator (Floating outside or inside?) Inside looks better for HUD feel */}
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

                </div>

                {/* Próxima Parada Button (Below Card) */}
                <div ref={buttonRef} className="mt-1 md:mt-2 mb-2 flex justify-center shrink-0 opacity-0 will-change-transform transform-gpu">
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
                </div>

            </div>

        </section>
    );
}
