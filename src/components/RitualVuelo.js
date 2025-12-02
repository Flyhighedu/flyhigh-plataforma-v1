'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Rocket, Eye, Globe2 } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function RitualVuelo() {
    const sectionRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const backgroundRef = useRef(null);
    const particlesRef = useRef(null);
    const winkAnimationRef = useRef(null); // Ref para controlar la animación de guiño
    const [activeIndex, setActiveIndex] = useState(0);
    const [isSnapping, setIsSnapping] = useState(false); // Inicia desactivado para permitir la animación
    const [particles, setParticles] = useState([]);
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        const section = sectionRef.current;

        const mm = gsap.matchMedia();

        // Configuración General (Desktop y Mobile) con Scope
        mm.add({
            isDesktop: "(min-width: 768px)",
            isMobile: "(max-width: 767px)",
            reduceMotion: "(prefers-reduced-motion: reduce)"
        }, (context) => {
            const { isDesktop, isMobile } = context.conditions;

            // 1. Animación de entrada de tarjetas
            // Usamos .from() para que el estado inicial (oculto) sea manejado por GSAP.
            // Si GSAP falla, las tarjetas serán visibles por defecto (CSS classes removidas).
            if (isDesktop) {
                gsap.from('.step-card', {
                    scrollTrigger: {
                        trigger: section,
                        start: "top 60%",
                    },
                    y: 50,
                    opacity: 0,
                    scale: 0.9,
                    duration: 0.6,
                    stagger: 0.2,
                    ease: "back.out(1.7)"
                });
            } else {
                // Mobile
                const cards = gsap.utils.toArray('.step-card', section);
                gsap.from(cards, {
                    scrollTrigger: { trigger: section, start: "top 70%" },
                    y: 50,
                    opacity: 0,
                    duration: 0.8,
                    stagger: 0.2,
                    ease: "back.out(1.7)"
                });
            }

            // 2. Animación de la línea de progreso
            gsap.to("#progress-line", {
                scrollTrigger: { trigger: section, start: "top 60%", end: "bottom 80%", scrub: 1 },
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
        }, sectionRef);

        return () => mm.revert();
    }, []);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollLeft = container.scrollLeft;
            const maxScroll = container.scrollWidth - container.clientWidth;

            // Progreso del scroll (0 a 1)
            const progress = Math.min(Math.max(scrollLeft / maxScroll, 0), 1);

            // 1. Parallax Vertical del Fondo
            if (backgroundRef.current) {
                const translateY = -50 + (progress * 50);
                backgroundRef.current.style.transform = `translateY(${translateY}%)`;
            }

            // 2. Opacidad de Partículas (Polvo de Hadas)
            if (particlesRef.current) {
                const opacity = Math.max(0, (progress - 0.5) * 2);
                particlesRef.current.style.opacity = opacity;
            }

            const firstCard = container.firstElementChild;
            if (!firstCard) return;

            const cardWidth = firstCard.offsetWidth;
            const gap = 24; // gap-6

            // Usar un umbral de 0.5 para el redondeo
            const index = Math.round(scrollLeft / (cardWidth + gap));
            setActiveIndex(Math.min(Math.max(index, 0), 2));
        }
    };

    // Cancelar animación de guiño al interactuar
    const handleInteraction = () => {
        if (winkAnimationRef.current && winkAnimationRef.current.isActive()) {
            winkAnimationRef.current.kill(); // Detener animación inmediatamente
            setIsSnapping(true); // Reactivar snap
        }
    };

    return (
        <div className="relative z-10 bg-white">
            <section ref={sectionRef} id="how-it-works" className="relative w-full rounded-t-[3rem] sm:rounded-t-[5rem] pt-20 pb-16 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden min-h-screen flex flex-col justify-center bg-slate-100">

                {/* --- FONDO PARALLAX --- */}
                <div
                    ref={backgroundRef}
                    className="absolute inset-0 w-full h-[200%] -z-20 pointer-events-none transition-transform duration-100 ease-linear will-change-transform"
                    style={{
                        background: 'linear-gradient(to bottom, #0072FF 0%, #00C6FF 20%, #BFDBFE 50%, #E2E8F0 80%, #F5F7FA 100%)',
                        transform: 'translateY(-50%)' // Estado inicial: Tierra
                    }}
                ></div>

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
                            ¡El Vuelo <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] to-[#0072FF] drop-shadow-sm">Comienza!</span>
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
                            className={`flex overflow-x-auto gap-6 pb-8 hide-scroll sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible px-4 sm:px-0 pt-6 ${isSnapping ? 'snap-x snap-mandatory' : ''}`}
                        >

                            {/* PASO 1 */}
                            <div className="snap-center shrink-0 w-[85vw] sm:w-auto step-card">
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
                            <div className="snap-center shrink-0 w-[85vw] sm:w-auto step-card">
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
                            <div className="snap-center shrink-0 w-[85vw] sm:w-auto step-card">
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
        </div>
    );
}
