'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Rocket, Eye, Globe2 } from 'lucide-react';
import { motion, useScroll, useTransform, useMotionTemplate } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function RitualVuelo() {
    const scrollContainerRef = useRef(null);
    const backgroundRef = useRef(null);
    const particlesRef = useRef(null);
    const winkAnimationRef = useRef(null); // Ref para controlar la animación de guiño
    const [activeIndex, setActiveIndex] = useState(0);
    const [isSnapping, setIsSnapping] = useState(false); // Inicia desactivado para permitir la animación
    const [particles, setParticles] = useState([]);

    // Framer Motion Scroll Hook for the container
    const { scrollXProgress } = useScroll({ container: scrollContainerRef });

    // Transform scroll progress to brightness (1 -> 0.5)
    const brightness = useTransform(scrollXProgress, [0, 1], [1, 0.5]);
    const filter = useMotionTemplate`brightness(${brightness})`;

    useEffect(() => {
        // Generar partículas solo en el cliente
        const newParticles = Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 1}px`,
            height: `${Math.random() * 4 + 1}px`,
            opacity: Math.random() * 0.7 + 0.3,
            duration: `${Math.random() * 3 + 2}s`
        }));
        setParticles(newParticles);

        const container = scrollContainerRef.current;
        const mm = gsap.matchMedia();

        // Configuración General (Desktop y Mobile) dentro del contexto de limpieza
        mm.add({
            isDesktop: "(min-width: 768px)",
            isMobile: "(max-width: 767px)",
            reduceMotion: "(prefers-reduced-motion: reduce)"
        }, (context) => {
            const { isDesktop, isMobile } = context.conditions;

            // 1. Animación de entrada de tarjetas
            if (isDesktop) {
                gsap.fromTo('.step-card',
                    { y: 50, opacity: 0, scale: 0.9 },
                    {
                        scrollTrigger: {
                            trigger: "#how-it-works",
                            start: "top 60%",
                        },
                        y: 0,
                        opacity: 1,
                        scale: 1,
                        duration: 0.6,
                        stagger: 0.2,
                        ease: "back.out(1.7)"
                    }
                );
            } else {
                gsap.utils.toArray('.step-card').forEach((card, i) => {
                    gsap.to(card, {
                        scrollTrigger: { trigger: "#how-it-works", start: "top 70%" },
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        delay: i * 0.2,
                        ease: "back.out(1.7)"
                    });
                });
            }

            // 2. Animación de la línea de progreso
            gsap.to("#progress-line", {
                scrollTrigger: { trigger: "#how-it-works", start: "top 60%", end: "bottom 80%", scrub: 1 },
                width: "100%",
                ease: "none"
            });

            // 3. Animación "Peek" (Solo móvil)
            if (isMobile && container) {
                winkAnimationRef.current = gsap.to(container, {
                    scrollLeft: container.offsetWidth * 0.25,
                    duration: 1.5,
                    ease: "power2.inOut",
                    yoyo: true,
                    repeat: 1,
                    delay: 0.5,
                    scrollTrigger: {
                        trigger: container,
                        start: "top 70%",
                        toggleActions: "play none none none",
                        onEnter: () => setIsSnapping(false),
                        onComplete: () => setIsSnapping(true)
                    },
                    onComplete: () => setIsSnapping(true)
                });
            } else {
                setIsSnapping(true); // Desktop: activar snap inmediatamente
            }
        });

        return () => mm.revert(); // Limpieza total al desmontar
    }, []);

    // Optimizado: Usar refs para evitar re-renders innecesarios
    const lastActiveIndexRef = useRef(0);
    const rafIdRef = useRef(null);

    const handleScroll = () => {
        // Cancelar cualquier frame pendiente para evitar acumulación
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = requestAnimationFrame(() => {
            if (!scrollContainerRef.current) return;

            const container = scrollContainerRef.current;
            const scrollLeft = container.scrollLeft;
            const maxScroll = container.scrollWidth - container.clientWidth;

            // Progreso del scroll (0 a 1)
            const progress = Math.min(Math.max(scrollLeft / maxScroll, 0), 1);

            // 1. Parallax Vertical del Fondo (GPU accelerated)
            if (backgroundRef.current) {
                const translateY = -50 + (progress * 50);
                backgroundRef.current.style.transform = `translateY(${translateY}%) translateZ(0)`;
            }

            // 2. Opacidad de Partículas
            if (particlesRef.current) {
                const opacity = Math.max(0, (progress - 0.5) * 2);
                particlesRef.current.style.opacity = opacity;
            }

            // 3. Calcular índice activo sin causar re-render innecesario
            const cardWidth = container.firstElementChild?.offsetWidth || 280;
            const gap = 24;
            const newIndex = Math.min(Math.max(Math.round(scrollLeft / (cardWidth + gap)), 0), 2);

            // Solo actualizar estado si cambió el índice
            if (newIndex !== lastActiveIndexRef.current) {
                lastActiveIndexRef.current = newIndex;
                setActiveIndex(newIndex);
            }
        });
    };

    // Cancelar animación de guiño al interactuar
    const handleInteraction = () => {
        if (winkAnimationRef.current && winkAnimationRef.current.isActive()) {
            winkAnimationRef.current.kill(); // Detener animación inmediatamente
            setIsSnapping(true); // Reactivar snap
        }
    };

    // 3. Opacity Layers Logic (GPU Optimized)
    const opacityLayer2 = useTransform(scrollXProgress, [0.2, 0.5], [0, 1]);
    const opacityLayer3 = useTransform(scrollXProgress, [0.5, 0.8], [0, 1]);

    return (
        <section id="how-it-works" className="relative z-10 w-full rounded-t-[3rem] sm:rounded-t-[5rem] pt-20 pb-16 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden min-h-[100svh] flex flex-col justify-center bg-slate-100" style={{ contain: 'layout paint' }}>

            {/* --- FONDO PARALLAX (CAPAS DE OPACIDAD - GPU OPTIMIZED) --- */}
            <div
                ref={backgroundRef}
                className="absolute inset-0 w-full h-[200%] -z-20 pointer-events-none will-change-transform"
                style={{ transform: 'translateY(-50%) translateZ(0)' }} // Force GPU
            >
                {/* Capa 1 (Base): Cyan/Blue (Paso 1) */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#00C6FF_0%,#BFDBFE_50%,#F5F7FA_100%)]"></div>

                {/* Capa 2: Blue/Indigo (Paso 2) */}
                <motion.div
                    style={{ opacity: opacityLayer2 }}
                    className="absolute inset-0 bg-[linear-gradient(to_bottom,#0072FF_0%,#BFDBFE_50%,#F5F7FA_100%)]"
                ></motion.div>

                {/* Capa 3: Night Blue (Paso 3 - Con Estrellas - Balanceado) */}
                <motion.div
                    style={{ opacity: opacityLayer3 }}
                    className="absolute inset-0 bg-[linear-gradient(to_bottom,#0f172a_0%,#1e3a8a_50%,#0f172a_100%)]"
                ></motion.div>
            </div>

            {/* --- PARTÍCULAS (POLVO DE HADAS) --- */}
            <div
                ref={particlesRef}
                className="absolute inset-0 w-full h-full -z-10 pointer-events-none opacity-0 transition-opacity duration-300"
            >
                {particles.map((p) => (
                    <div
                        key={p.id}
                        className="absolute bg-white rounded-full animate-pulse"
                        style={{
                            top: p.top,
                            left: p.left,
                            width: p.width,
                            height: p.height,
                            opacity: p.opacity,
                            animationDuration: p.duration
                        }}
                    />
                ))}
            </div>

            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="text-center max-w-3xl mx-auto mb-10">
                    <h2 className="font-['Outfit',sans-serif] font-extrabold text-3xl sm:text-5xl text-slate-900 mb-4 tracking-tight leading-tight">
                        ¡El Vuelo <motion.span style={{ filter }} className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] to-[#0072FF] drop-shadow-sm">Comienza!</motion.span>
                    </h2>
                    <p className="text-slate-500 text-base sm:text-lg font-medium max-w-xl mx-auto leading-relaxed">
                        Transformamos tu patio escolar en una plataforma de despegue.
                    </p>
                </div>

                <div className="relative">
                    <div className="hidden md:block absolute top-[100px] left-[10%] w-[80%] h-1 bg-slate-200 -z-10 rounded-full border-t border-white/50"></div>
                    <div className="hidden md:block absolute top-[100px] left-[10%] w-0 h-1 bg-gradient-to-r from-[#00C6FF] to-[#0072FF] shadow-[0_0_15px_#00C6FF] -z-10 rounded-full" id="progress-line"></div>

                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        onTouchStart={handleInteraction}
                        onMouseDown={handleInteraction}
                        className={`flex overflow-x-auto gap-6 pb-8 hide-scroll sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible px-4 sm:px-0 pt-6 will-change-transform transform-gpu ${isSnapping ? 'snap-x snap-mandatory' : ''}`}
                    >

                        {/* PASO 1 */}
                        <div className="snap-center shrink-0 w-[85vw] sm:w-auto step-card opacity-0 translate-y-12 will-change-transform transform-gpu">
                            <div className="group relative bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 border border-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-500 hover:-translate-y-3">
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-100 flex items-center justify-center font-['Outfit',sans-serif] font-bold text-lg text-[#00C6FF] shadow-md border border-white z-10 group-hover:scale-110 transition-transform">1</div>
                                <div className="w-full aspect-square bg-blue-50/50 rounded-2xl mb-6 flex items-center justify-center h-48">
                                    <Rocket className="w-20 h-20 text-[#00C6FF] stroke-1 group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-slate-900 mb-3 text-center">La Mirada se Eleva</h3>
                                <p className="text-slate-500 text-center font-medium leading-relaxed text-sm">Nuestros pilotos certificados instalan el dron en el centro del patio. Los alumnos presencian el despegue en vivo mientras la aeronave asciende hacia las nubes.</p>
                            </div>
                        </div>

                        {/* PASO 2 */}
                        <div className="snap-center shrink-0 w-[85vw] sm:w-auto step-card opacity-0 translate-y-12 will-change-transform transform-gpu">
                            <div className="group relative bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 border border-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-500 hover:-translate-y-3">
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-100 flex items-center justify-center font-['Outfit',sans-serif] font-bold text-lg text-[#0072FF] shadow-md border border-white z-10 group-hover:scale-110 transition-transform">2</div>
                                <div className="w-full aspect-square bg-indigo-50/50 rounded-2xl mb-6 flex items-center justify-center h-48">
                                    <Eye className="w-20 h-20 text-[#0072FF] stroke-1 group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-slate-900 mb-3 text-center">Ojos en las Nubes</h3>
                                <p className="text-slate-500 text-center font-medium leading-relaxed text-sm">La cámara del dron transmite video de alta definición en tiempo real. La señal llega sin retraso a las pantallas gigantes y visores VR en tierra.</p>
                            </div>
                        </div>

                        {/* PASO 3 */}
                        <div className="snap-center shrink-0 w-[85vw] sm:w-auto step-card opacity-0 translate-y-12 will-change-transform transform-gpu">
                            <div className="group relative bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 border border-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-500 hover:-translate-y-3">
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-100 flex items-center justify-center font-['Outfit',sans-serif] font-bold text-lg text-pink-500 shadow-md border border-white z-10 group-hover:scale-110 transition-transform">3</div>
                                <div className="w-full aspect-square bg-pink-50/50 rounded-2xl mb-6 flex items-center justify-center h-48">
                                    <Globe2 className="w-20 h-20 text-pink-500 stroke-1 group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-slate-900 mb-3 text-center">Dueños de la Ciudad</h3>
                                <p className="text-slate-500 text-center font-medium leading-relaxed text-sm">Redescubren su hogar desde las alturas. Al ver la magnitud real de Uruapan, nace en ellos un nuevo sentido de orgullo: esta gran ciudad también es suya.</p>
                            </div>
                        </div>

                    </div>

                    {/* INDICADORES DE PUNTITOS (SOLO MÓVIL) */}
                    <div className="flex justify-center gap-2 mt-4 md:hidden">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full transition-all duration-300 ${activeIndex === i ? "w-6 bg-[#00C6FF]" : "w-2 bg-slate-300"}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <style jsx>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>
        </section>
    );
}
