'use client';

import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { MapPin, PlayCircle, ArrowDown } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function PlanVuelo() {
    const sectionRef = useRef(null);
    const visorRef = useRef(null);
    const videoRef = useRef(null); // Reference for the video element
    const buttonRef = useRef(null);
    const curtainRef = useRef(null);
    const headerRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false); // State to control poster visibility

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

    // OPTIMIZACIÓN ROBUSTA: Observer de Visibilidad + Fallback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Intentar reproducir de forma AGRESIVA
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(error => {
                                console.log("Auto-play prevented (trying again muted):", error);
                                // Fallback: Force mute just in case
                                video.muted = true;
                                video.play().catch(e => console.error("Force play failed:", e));
                            });
                        }
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.1, rootMargin: "50%" } // Cargar MUCHO ANTES (50% viewport height)
        );

        if (visorRef.current) observer.observe(visorRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    // FALLBACK NUCLEAR: Reproducir video al primer toque/click del usuario en CUALQUIER parte
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const forcePlayOnInteraction = () => {
            if (video.paused) {
                video.muted = true;
                video.play().then(() => {
                    setIsPlaying(true);
                    // Una vez que funcionó, remover listeners
                    document.removeEventListener('touchstart', forcePlayOnInteraction);
                    document.removeEventListener('click', forcePlayOnInteraction);
                }).catch(() => { });
            }
        };

        document.addEventListener('touchstart', forcePlayOnInteraction, { once: true, passive: true });
        document.addEventListener('click', forcePlayOnInteraction, { once: true });

        return () => {
            document.removeEventListener('touchstart', forcePlayOnInteraction);
            document.removeEventListener('click', forcePlayOnInteraction);
        };
    }, []);


    return (
        <div ref={sectionRef} className="relative z-10 bg-white w-full snap-start -mt-1">
            {/* White Curtain (Fixed Background) */}
            <div ref={curtainRef} className="fixed inset-0 bg-white z-40 pointer-events-none opacity-0" />

            <section
                className="h-[100dvh] w-full flex flex-col py-2 md:py-4 bg-white relative z-50 overflow-hidden"
                style={{
                    contentVisibility: 'auto',
                    containIntrinsicSize: '0 100vh'
                }}
            >

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

                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full h-full flex flex-col justify-center gap-4 md:gap-6">

                    {/* 1. HEADER */}
                    <div ref={headerRef} className="text-center shrink-0 relative">

                        <div className="inline-flex items-center gap-2 px-4 py-1.5 md:px-5 md:py-2 rounded-full bg-slate-900 text-white mb-3 md:mb-4 shadow-lg">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F0FF]"></span>
                            </span>
                            <span className="text-[10px] md:text-xs font-bold tracking-[0.15em] uppercase text-[#00F0FF]">Experiencia Aérea</span>
                        </div>

                        {/* TÍTULO - Más compacto en móvil */}
                        <h2 className="font-['Outfit',sans-serif] font-black text-[2.5rem] md:text-7xl lg:text-8xl text-slate-900 tracking-tighter leading-[0.9] mb-2 md:mb-4 max-w-5xl mx-auto">
                            ¡Aventura por el <br className="md:hidden" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] via-cyan-400 to-[#00C6FF]">cielo de Uruapan!</span>
                        </h2>

                        <p className="text-slate-500 text-sm md:text-lg leading-relaxed max-w-md md:max-w-xl mx-auto text-center">
                            Vuelo inmersivo <span className="text-slate-800 font-semibold">en tiempo real</span> sobre los puntos más emblemáticos de Uruapan.
                        </p>
                    </div>

                    {/* 2. LA ATRACCIÓN (Pure CSS VR Visor) */}
                    <div
                        ref={visorRef}
                        className="relative w-full max-w-[90vw] md:max-w-3xl mx-auto flex flex-col items-center opacity-0 translate-y-[300px] will-change-transform transform-gpu"
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

                            {/* SEPARATED SHADOW ELEMENT */}
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
                                        {/* Fallback Poster Image */}
                                        <img
                                            src="/img/poster-visor.jpg"
                                            className={`absolute inset-0 w-full h-full object-cover z-20 transition-opacity duration-700 ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                            alt="Visor Poster"
                                        />

                                        <video
                                            ref={videoRef}
                                            src="/videos/TeaserWeb.mp4"
                                            className="w-full h-full object-cover opacity-90 relative z-10"
                                            preload="auto"
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            webkit-playsinline="true"
                                            x5-playsinline="true"
                                            suppressHydrationWarning={true}
                                            onLoadedData={() => setIsPlaying(true)}
                                            onCanPlay={() => setIsPlaying(true)}
                                            onTimeUpdate={(e) => {
                                                if (e.target.currentTime > 0.05 && !isPlaying) {
                                                    setIsPlaying(true);
                                                }
                                            }}
                                            style={{ transform: 'translateZ(0)' }}
                                        />

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

        </div>
    );
}
