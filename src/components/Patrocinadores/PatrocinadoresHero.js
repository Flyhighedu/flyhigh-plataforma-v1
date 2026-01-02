'use client';

import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FloatingButton from './FloatingButton';

export default function PatrocinadoresHero({ onScrollToSponsors, onOpenPortal }) {
    const containerRef = useRef(null);
    const fabRef = useRef(null);

    useLayoutEffect(() => {
        gsap.registerPlugin(ScrollTrigger);
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: "expo.out", duration: 1.8 } });

            // Establecer estado inicial SIN tocar yPercent (lo maneja CSS)
            gsap.set("#mask-window", {
                scale: 0.8,
                opacity: 0,
                x: 100
            });

            // Animación de la Ventana (hacia estado final)
            tl.to("#mask-window", {
                scale: 1,
                opacity: 1,
                x: 0,
                duration: 2,
                ease: "power4.inOut"
            })
                // Animación del Título y Textos
                .to(".reveal-element", {
                    opacity: 1,
                    y: 0,
                    stagger: 0.15,
                    duration: 1.5
                }, "-=1.5");

            // Animación de Salida del Botón Flotante (Sincronizada con Scroll)
            gsap.to(fabRef.current, {
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: "top top", // Empieza al iniciar scroll
                    end: "20% top", // Termina rápido (en el primer 20% del scroll)
                    scrub: 1,
                },
                x: 100,
                y: 300, // Traslación agresiva hacia abajo para esconder el corte plano
                opacity: 0,
                ease: "power1.in"
            });

            // NOTA: La animación del marquee ahora es 100% CSS para evitar conflictos con React/GSAP re-renders.
        }, containerRef);

        return () => ctx.revert();
    }, []);

    const logos = [
        { logo: "/img/logo sp Negro.png", name: "STRONG PLASTIC" },
        { logo: "/img/bonanza.png", name: "LA BONANZA" },
        { logo: "/img/Logo Madobox.png", name: "MADOBOX" },
        { logo: "/img/logo RV Fresh.png", name: "RV FRESH" },
    ];

    // Multiplicamos la lista de logos para asegurar un scroll infinito fluido sin saltos visuales
    const infiniteLogos = [...logos, ...logos, ...logos, ...logos, ...logos, ...logos];

    return (
        <section ref={containerRef} className="hero-container px-6 md:px-16 lg:px-24 overflow-hidden bg-white text-black relative">
            <style jsx>{`
                :global(:root) {
                    --steam-blue: #0055FF;
                    --steam-purple: #7000FF;
                    --steam-orange: #FF3D00;
                }
                
                .font-syne { font-family: 'Syne', sans-serif; }

                /* Contenedor del Hero - Responsive Height */
                .hero-container {
                    height: 100vh;
                    height: 100svh; /* Modern mobile viewport fix */
                    display: flex;
                    align-items: flex-start; /* Alinear arriba */
                    justify-content: center; /* CENTRAR horizontalmente */
                    position: relative;
                    padding-top: 80px; /* Tagline más cerca del header */
                    /* Removed padding-bottom to ensure button stays on screen */
                }

                /* Título de Impacto */
                .hero-title {
                    font-size: clamp(2rem, 6vw, 4.5rem);
                    line-height: 0.85;
                    letter-spacing: -0.05em;
                    text-transform: uppercase;
                    position: relative;
                    z-index: 20;
                    pointer-events: none;
                    width: 100%;
                    white-space: nowrap; 
                }

                @media (max-width: 640px) {
                    .hero-title {
                        font-size: 6vw; /* FIX: Reducido de 10vw para que coincida con desktop */
                        white-space: normal; 
                        word-break: keep-all; 
                    }
                }

                /* Ventana de Destino */
                .window-destiny {
                    position: absolute;
                    right: -5%; /* Movido más a la derecha para no chocar con el texto */
                    top: 25%; /* SUBIDO: De 30% a 25% */
                    transform: translateY(-50%);
                    width: 35vw;
                    height: 70vh;
                    border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; 
                    overflow: hidden;
                    z-index: 5; /* Reducido para estar DETRÁS del título (z-index: 20) */
                    background: #000;
                    box-shadow: 0 50px 100px rgba(0,0,0,0.1);
                    animation: soapBubble 12s ease-in-out infinite; 
                    will-change: border-radius;
                }

                @keyframes soapBubble {
                    0% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
                    25% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
                    50% { border-radius: 50% 60% 30% 60% / 40% 70% 30% 60%; }
                    75% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; }
                    100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
                }

                /* ANIMACIÓN MARQUEE CSS PURO ROBUSTO */
                @keyframes scroll-infinite {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); } /* Movemos solo 50% porque duplicamos el contenido */
                }
                
                .marquee-track {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem; /* space-x-6 equivalente */
                    width: max-content; /* Obligatorio para que no se colapse */
                    animation: scroll-infinite 25s linear infinite;
                    will-change: transform;
                }
                
                /* ELIMINADO: Pausa suave al hover para mantener movimiento continuo */

                .window-destiny video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .window-destiny:hover img {
                    filter: grayscale(0%);
                }

                /* Revelado */
                .reveal-element {
                    opacity: 0;
                    transform: translateY(30px);
                }

                /* Tablet Landscape & Small Laptops */
                @media (min-width: 769px) and (max-width: 1024px) {
                    .window-destiny {
                        width: 45vw;
                        height: 50vh;
                        right: 2%; 
                        top: 20%; /* SUBIDO: De 25% a 20% */
                    }
                    .hero-title {
                        font-size: 4rem;
                    }
                }

                @media (max-width: 768px) {
                    .window-destiny {
                        width: 90vw;
                        height: 35vh; /* Reduced height to avoid crowding */
                        right: 5vw; 
                        top: 20%; /* SUBIDO: De 25% a 20% */
                        opacity: 0.4;
                    }
                    .hero-title {
                        font-size: clamp(2.5rem, 10vw, 4rem); /* More responsive mobile type */
                        text-align: left;
                        line-height: 0.9;
                    }
                }
            `}</style>

            {/* Ventana de Destino */}
            <div className="window-destiny reveal-element" id="mask-window">
                <video
                    className="w-full h-full object-cover"
                    src="/videos/Videoportada.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                />
            </div>

            <div className="container mx-auto relative z-20">
                <div className="max-w-4xl mx-auto">

                    {/* Título Principal */}
                    <h1 className="hero-title font-syne font-black pt-20 mb-0 reveal-element">
                        EL<br />
                        CIELO<br />
                        DE<br />
                        URUAPAN<br />
                        TIENE<br />
                        <span className="text-white md:text-black" style={{ textShadow: "2px 2px 8px rgba(0,0,0,0.4)" }}>NOMBRE.</span>
                    </h1>

                </div>
            </div>

            {/* Coordenadas */}
            <div className="absolute bottom-12 left-10 hidden lg:block reveal-element">
                <div className="flex flex-col space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-gray-300">ESTÁNDAR DE ÉLITE</span>
                    <span className="text-[9px] font-black tracking-widest text-gray-200 uppercase">Uruapan, Michoacán</span>
                </div>
            </div>

            {/* Smart Sponsor Button (Harmonious Glass Design - Larger Logos V2) */}
            <div className="absolute bottom-20 md:bottom-36 left-4 md:left-12 z-50 reveal-element w-[calc(100%-2rem)] md:w-auto max-w-[420px] flex flex-col gap-2 items-center">

                {/* Subtítulo - MOVED HERE FOR ANCHORING */}
                <div className="max-w-md">
                    <p className="text-gray-500 text-sm md:text-base font-medium leading-relaxed tracking-tight text-center">
                        Las <strong className="font-semibold text-gray-700">empresas</strong> que decidieron apostar por <strong className="font-semibold text-gray-700">nuestra infancia</strong> para que toda una generación comience a <strong className="font-semibold" style={{ background: "linear-gradient(90deg, #0055FF, #00AAFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>conquistar el cielo</strong>.
                    </p>
                </div>

                <button
                    onClick={() => setTimeout(onScrollToSponsors, 200)}
                    className="group relative flex items-center h-14 w-full md:w-auto rounded-full overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_30px_rgba(0,102,255,0.2)] hover:-translate-y-0.5 active:scale-[0.95] active:translate-y-1 active:shadow-none transition-all duration-200 ease-out active:duration-75"
                >
                    {/* SECCIÓN 1: La Acción (Azul Sólido) - "The Kinetic Split" */}
                    <div className="relative h-full px-8 flex items-center justify-center bg-[#0066FF] z-20 shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)] group-active:shadow-[inset_0_0_0_rgba(0,0,0,0.2)] transition-all duration-200 group-active:duration-75">
                        <span className="font-syne font-black text-[11px] tracking-widest text-white whitespace-nowrap">CONÓCELOS</span>
                    </div>


                    <div className="relative h-full flex-1 flex items-center bg-white px-2 min-w-0">

                        {/* Body: Micro-Marquee (Clean White) */}
                        <div className="relative flex-1 h-full flex items-center overflow-hidden min-w-0 md:min-w-[280px]">
                            {/* Máscaras de suavidad Light */}
                            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white/80 to-transparent z-10 pointer-events-none"></div>
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent z-10 pointer-events-none"></div>

                            <div className="marquee-track pl-2">
                                {infiniteLogos.map((ally, i) => (
                                    <img
                                        key={i}
                                        src={ally.logo}
                                        alt={ally.name}
                                        className={`${ally.name === "LA BONANZA" ? 'h-10 md:h-12' : 'h-14 md:h-16'} w-auto object-contain opacity-90 transition-all duration-300`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Botón Flotante (True Quarter-Circle Corner) */}
            <div ref={fabRef} className="absolute -bottom-[2px] -right-[2px] z-[60]">
                <FloatingButton
                    onClick={onOpenPortal}
                    className="w-20 h-20 md:w-28 md:h-28" // Proporciones corregidas (más discreto)
                />
            </div>

        </section>
    );
}
