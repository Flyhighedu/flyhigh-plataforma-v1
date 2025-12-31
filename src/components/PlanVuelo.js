'use client';

import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { MapPin, PlayCircle, ArrowDown, Play } from 'lucide-react';
import { useVideoImmortality } from '../hooks/useVideoImmortality';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function PlanVuelo() {
    const sectionRef = useRef(null);
    const visorRef = useRef(null);
    const videoRef = useRef(null); // Reference for the video element

    // Referencias UI
    const buttonRef = useRef(null);
    const curtainRef = useRef(null);
    const headerRef = useRef(null);

    const [isHeaderVisible, setIsHeaderVisible] = useState(false); // Estado para animar header

    // Hook de Inmortalidad: Gestiona toda la complejidad de reproducción
    // Usamos un ref simple para isInView por ahora, o podríamos usar un observer real si quisiéramos ser muy precisos.
    // Para simplificar, asumiremos que si el componente monta, queremos intentar reproducir (el hook maneja pausa si sale de pantalla si le pasamos inView).
    // Implementaremos un observer básico para pasarle al hook.
    const [isInView, setIsInView] = useState(false);

    // NOTA: videoRef se llena manualmente en el ref del wrapper div más abajo
    const { isPlaying, isError, attemptPlay } = useVideoImmortality(videoRef, isInView);

    // Efecto para sincronizar opacity del video RAW (HTML) con el estado de React
    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            if (isPlaying) {
                video.classList.remove('opacity-0');
                video.classList.add('opacity-90');
            } else {
                // No ocultamos inmediatamente para evitar parpadeo si es un re-buffer
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsInView(entry.isIntersecting),
            { threshold: 0.1 }
        );
        if (visorRef.current) observer.observe(visorRef.current);
        return () => observer.disconnect();
    }, []);

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

            // 0. White Curtain Animation (Fades in immediately as section enters)
            gsap.fromTo(curtainRef.current,
                { opacity: 0 },
                {
                    opacity: 1,
                    duration: 0.1, // Very fast fade in
                    ease: "none",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        start: "top bottom", // Starts when top of section hits bottom of viewport
                        end: "top top", // Ends when top of section hits top of viewport
                        scrub: true,
                    }
                }
            );

            // 0.5 Header Text Slide In (Removed opacity to fix gradient bug)
            gsap.fromTo(headerRef.current,
                { y: 50 },
                {
                    y: 0,
                    duration: 1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        start: "top 85%", // Starts when top of section is 85% down the viewport (almost immediately)
                        toggleActions: "play none none reverse"
                    }
                }
            );

            // 1. Visor moves UP from below (y: 100% or similar) to center (y: 0)
            tl.fromTo(visorRef.current,
                { y: 300, opacity: 0 }, // Start state: down and invisible
                { y: 0, opacity: 1, duration: 2, ease: "power2.out" },
                0.2 // Slight delay after text starts
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

    // OPTIMIZACIÓN ROBUSTA: Observer simplificado solo para Playback (Pause cuando no se ve)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Intentar reproducir inmediatamente si es posible (AutoPlay nativo a veces falla si no está en viewport)
        // El observer se encargará de gestionar esto.

        const playbackObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Entra en pantalla -> Intentar reproducir con manejo de promesa
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise
                                .then(() => {
                                    // Reproducción comenzó exitosamente
                                })
                                .catch(error => {
                                    console.warn("Autoplay preventivo:", error);
                                    // Si falla autoplay, mostramos controles o dejamos el poster (fallback natural)
                                });
                        }
                    } else {
                        // Sale de pantalla -> Pausar para ahorrar recursos
                        video.pause();
                    }
                });
            },
            { threshold: 0.1 } // 10% visible
        );

        playbackObserver.observe(visorRef.current);

        return () => {
            playbackObserver.disconnect();
        };
    }, []);

    return (
        <div ref={sectionRef} className="relative z-50 bg-white w-full snap-start -mt-1">
            {/* White Curtain (Fixed Background) */}
            <div ref={curtainRef} className="fixed inset-0 bg-white z-40 pointer-events-none opacity-0" />

            <section className="h-[100dvh] w-full flex flex-col py-2 md:py-4 bg-white relative z-50 overflow-hidden">

                {/* Styles for this component */}
                <style jsx>{`
                    /* Animación de Flotación (Floating) - GPU Optimized */
                    @keyframes float {
                        0%, 100% { transform: translate3d(0, 0, 0); }
                        50% { transform: translate3d(0, -15px, 0); }
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
                    <div className="absolute -top-20 -right-20 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(239,246,255,0.8)_0%,transparent_70%)] transform-gpu"></div>
                    <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(250,245,255,0.6)_0%,transparent_70%)] transform-gpu"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full h-full flex flex-col justify-center">

                    {/* 1. HEADER */}
                    <div ref={headerRef} className="text-center mb-1 md:mb-2 shrink-0 relative">

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
                    <div
                        ref={visorRef}
                        className="relative w-full max-w-3xl mx-auto flex flex-col items-center opacity-0 translate-y-[300px] will-change-transform transform-gpu"
                        style={{ backfaceVisibility: 'hidden' }}
                    >

                        {/* SVG Definition for Visor Shape (Goggle with Nose Notch) */}
                        <svg width="0" height="0" className="absolute">
                            <defs>
                                <clipPath id="visor-shape" clipPathUnits="objectBoundingBox">
                                    <path d="M 0.08, 0.15 Q 0.5, 0.05 0.92, 0.15 Q 1, 0.15 1, 0.5 Q 1, 0.85 0.92, 0.85 L 0.6, 0.85 Q 0.5, 0.65 0.4, 0.85 L 0.08, 0.85 Q 0, 0.85 0, 0.5 Q 0, 0.15 0.08, 0.15 Z" />
                                </clipPath>
                            </defs>
                        </svg>

                        {/* Wrapper for Visor + Shadow */}
                        <div className="relative w-full aspect-[16/9] md:aspect-[2/1] animate-float" style={{ backfaceVisibility: 'hidden' }}>

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
                                    style={{ clipPath: 'url(#visor-shape)', WebkitClipPath: 'url(#visor-shape)', transform: 'translateZ(0)' }}
                                >
                                    {/* Video Screen (Inside) */}
                                    <div
                                        className="absolute inset-x-[3%] inset-y-[10%] bg-slate-900 overflow-hidden shadow-inner"
                                        style={{ clipPath: 'url(#visor-shape)', WebkitClipPath: 'url(#visor-shape)', transform: 'translateZ(0)' }}
                                    >
                                        <div
                                            className="w-full h-full"
                                            ref={(el) => {
                                                // MANUAL REF BINDING for Nuclear Option
                                                if (el) {
                                                    const videoElement = el.querySelector('video');
                                                    if (videoElement) {
                                                        videoRef.current = videoElement;
                                                    }
                                                }
                                            }}
                                            dangerouslySetInnerHTML={{
                                                __html: `
                                                <video
                                                    class="w-full h-full object-cover transition-opacity duration-700 opacity-0"
                                                    src="/videos/TeaserWeb.mp4"
                                                    poster="/img/poster-visor.jpg"
                                                    preload="auto"
                                                    autoplay
                                                    loop
                                                    muted
                                                    playsinline
                                                    webkit-playsinline
                                                    style="transform: translateZ(0); display: block;"
                                                ></video>
                                                `
                                            }}
                                        />

                                        {/* Poster Manual Fallback (Overlay gestionado por React) */}
                                        <div
                                            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${isPlaying ? 'opacity-0' : 'opacity-100'} pointer-events-none`}
                                            style={{ backgroundImage: 'url(/img/poster-visor.jpg)', transform: 'translateZ(0)' }}
                                        />

                                        {/* BOTÓN DE RESCATE (Solo si isError es true - Autoplay bloqueado) */}
                                        {isError && !isPlaying && (
                                            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        attemptPlay();
                                                    }}
                                                    className="group flex flex-col items-center gap-2 cursor-pointer transform hover:scale-105 transition-transform"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-white/20 border border-white/50 backdrop-blur-md flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                                                        <Play className="w-5 h-5 text-white fill-white ml-1" />
                                                    </div>
                                                    <span className="text-[10px] font-['Share_Tech_Mono'] uppercase tracking-[0.2em] text-white font-bold drop-shadow-md">
                                                        Iniciar Vuelo
                                                    </span>
                                                </button>
                                            </div>
                                        )}

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

            {/* PATCH: Independent White Canvas - Massive patch to ensure no gaps */}
            <div className="absolute top-[50%] left-0 w-full h-[200vh] z-[-50] pointer-events-none" style={{ backgroundColor: '#FFFFFF' }}></div>
        </div>
    );
}
