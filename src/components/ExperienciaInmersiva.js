'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

const cards = [
    {
        id: 1,
        title: "FÁBRICA\nSAN PEDRO",
        subtitle: "Acceso Exclusivo",
        video: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/clip-fsp.mp4",
        logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-ccfdsp.png"
    },
    {
        id: 2,
        title: "PARQUE\nNACIONAL",
        subtitle: "Acceso Exclusivo",
        video: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/capsula-parque-presentacion-web-1.mp4",
        logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-parque.png"
    },
    {
        id: 3,
        title: "SECRETARÍA\nDE CULTURA",
        subtitle: "Acceso Exclusivo",
        video: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/capsula-secretaria-de-cultura-presentacion-web-1.mp4",
        logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-secretaria-cultura-y-turismo.png"
    },
    {
        id: 4,
        title: "MUSEO\nDEL AGUA",
        subtitle: "Acceso Exclusivo",
        video: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/clip-museo-del-agua-8s.mp4",
        logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/logo-museo-del-agua-png.png"
    },
    {
        id: 5,
        title: "FÁBRICA\nSAN PEDRO",
        subtitle: "Acceso Exclusivo",
        video: "https://flyhighedu.com.mx/wp-content/uploads/2025/11/clip-fsp.mp4",
        logo: "https://flyhighedu.com.mx/wp-content/uploads/2025/10/logo-ccfdsp.png"
    }
];

export default function ExperienciaInmersiva() {
    const carouselRef = React.useRef(null);
    const [isAutoplay, setIsAutoplay] = React.useState(true);
    const isAutoplayRef = React.useRef(true); // Ref for immediate access in loop

    // Triple the cards for infinite scroll illusion
    const displayCards = [...cards, ...cards, ...cards];

    // Stop autoplay on interaction
    const stopAutoplay = () => {
        if (isAutoplayRef.current) {
            setIsAutoplay(false);
            isAutoplayRef.current = false;
        }
    };

    // Autoplay Scroll Logic
    React.useEffect(() => {
        const carousel = carouselRef.current;
        let animationFrameId;
        let scrollSpeed = 0.5; // Pixels per frame

        // Initialize scroll position to the middle set (Start of Set B)
        if (carousel) {
            // We need to wait for layout to be stable, but this is a decent attempt
            // A better way is to check if scrollLeft is 0 and we have width
            if (carousel.scrollLeft === 0 && carousel.scrollWidth > 0) {
                carousel.scrollLeft = carousel.scrollWidth / 3;
            }
        }

        const animateScroll = () => {
            // Stop immediately if autoplay is disabled
            if (!carousel || !isAutoplayRef.current) return;

            const oneSetWidth = carousel.scrollWidth / 3;

            // Infinite Scroll Reset Logic
            // If we've scrolled past the second set (Start of Set C), reset to Start of Set B
            if (carousel.scrollLeft >= oneSetWidth * 2) {
                carousel.scrollLeft = oneSetWidth;
            } else {
                carousel.scrollLeft += scrollSpeed;
            }
            animationFrameId = requestAnimationFrame(animateScroll);
        };

        if (isAutoplay) {
            animationFrameId = requestAnimationFrame(animateScroll);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isAutoplay]);

    // Handle Manual Infinite Scroll Reset
    const handleScroll = () => {
        if (isAutoplay) return; // Handled by animation loop

        const carousel = carouselRef.current;
        if (!carousel) return;

        const oneSetWidth = carousel.scrollWidth / 3;

        // If we reach the start of Set C, jump back to start of Set B
        if (carousel.scrollLeft >= oneSetWidth * 2) {
            carousel.scrollLeft = oneSetWidth;
        }
        // If we reach the start of Set A (0), jump forward to start of Set B
        else if (carousel.scrollLeft <= 0) {
            carousel.scrollLeft = oneSetWidth;
        }
    };

    // Intersection Observer for Video Playback
    React.useEffect(() => {
        const isDesktop = window.matchMedia('(min-width: 768px)').matches;

        const options = isDesktop
            ? { rootMargin: '0px -45% 0px -45%', threshold: 0.1 } // Desktop: Only center strip activates
            : { threshold: 0.5 }; // Mobile: Standard visibility

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target;
                    if (entry.isIntersecting) {
                        video.play().catch(() => { }); // Ignore autoplay errors
                    } else {
                        video.pause();
                        video.currentTime = 0; // Optional: Reset video when out of focus
                    }
                });
            },
            options
        );

        const videos = document.querySelectorAll('.monolith-video');
        videos.forEach((video) => observer.observe(video));

        return () => {
            videos.forEach((video) => observer.unobserve(video));
        };
    }, [displayCards]); // Re-run when cards change

    return (
        <section id="experiencia-inmersiva" className="min-h-screen w-full snap-start flex flex-col justify-center relative overflow-x-hidden py-20 bg-[linear-gradient(180deg,#F8FAFC_0%,#FFFBF0_100%)]">

            {/* Custom Styles */}
            <style jsx>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                
                /* Watermark Text Effect */
                .watermark-text {
                    -webkit-text-stroke: 2px rgba(203, 213, 225, 0.3);
                    color: transparent;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 900;
                    line-height: 0.8;
                }

                /* Animaciones Monolito */
                .monolith-card { 
                    transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
                    transform: translateZ(0); /* Force GPU layer to fix overflow clipping */
                    will-change: transform;
                }
                .monolith-card:hover { transform: translateY(-15px) translateZ(0); }
                .monolith-video { transition: transform 1.5s ease; }
                .monolith-card:hover .monolith-video { transform: scale(1.1); }
            `}</style>

            {/* WATERMARK GIGANTE (Profundidad 3D) */}
            <div className="absolute top-0 left-[-5%] w-full pointer-events-none select-none z-0 flex justify-center">
                <span className="watermark-text text-[15vw] md:text-[18vw] opacity-40">INMERSIÓN</span>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full">

                {/* Header Centrado con Botón Estilo Píldora */}
                <div className="flex flex-col items-center text-center mb-6 md:mb-10 pt-0 relative">

                    {/* Botón Experiencia */}
                    <div className="inline-flex items-center gap-3 bg-slate-900 px-8 py-3 rounded-full mb-8 shadow-2xl z-20 hover:scale-105 transition-transform duration-300">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                        <span className="text-purple-300 font-bold tracking-[0.2em] text-sm uppercase">Experiencia Inmersiva</span>
                    </div>

                    {/* Título Centrado */}
                    <div className="max-w-4xl mx-auto z-10">
                        <h3 className="font-['Outfit',sans-serif] font-black text-5xl md:text-8xl text-slate-900 leading-[0.9] tracking-tighter mb-6">
                            EXPEDICIÓN <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">INMERSIVA.</span>
                        </h3>
                        <p className="text-slate-500 text-base md:text-xl leading-relaxed max-w-3xl mx-auto text-pretty px-4 mb-4">
                            Al aterrizar los espera una experiencia inmersiva que preparamos con nuestras instituciones aliadas.
                        </p>
                    </div>

                    {/* DATA POINTS */}
                    <div className="grid grid-cols-2 gap-4 md:flex md:flex-row md:gap-16 mt-2 justify-center px-4">
                        <div className="flex flex-col items-center gap-2 group text-center">
                            <div className="h-1 w-12 bg-purple-200 group-hover:bg-purple-600 transition-colors rounded-full mb-2"></div>
                            <p className="font-bold text-slate-900 text-lg leading-tight">Acceso Total</p>
                            <p className="text-slate-500 text-xs md:text-sm max-w-[150px] md:max-w-[200px] leading-snug">All Access incluido.</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 group text-center">
                            <div className="h-1 w-12 bg-pink-200 group-hover:bg-pink-600 transition-colors rounded-full mb-2"></div>
                            <p className="font-bold text-slate-900 text-lg leading-tight">Tecnología Inmersiva</p>
                            <p className="text-slate-500 text-xs md:text-sm max-w-[150px] md:max-w-[200px] leading-snug">Vuela dentro de la historia sin límites.</p>
                        </div>
                    </div>
                </div>

                {/* CARRUSEL DE MONOLITOS (VIDEO) */}
                <div
                    ref={carouselRef}
                    className={`flex overflow-x-auto gap-6 md:gap-8 pb-12 hide-scroll px-4 -mx-4 md:mx-0 pt-4 ${isAutoplay ? '' : 'snap-x snap-mandatory'}`}
                    style={{ scrollBehavior: 'auto' }}
                    onMouseEnter={stopAutoplay}
                    onTouchStart={stopAutoplay}
                    onClick={stopAutoplay}
                    onScroll={handleScroll}
                >
                    {displayCards.map((card, index) => (
                        <div key={index} className="snap-center shrink-0 w-[85vw] md:w-[400px]">
                            <div className={`monolith-card relative h-[60vh] md:h-[550px] rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)_inset] cursor-pointer group bg-slate-900 ${index % 2 !== 0 ? 'md:-mt-12' : ''}`}>
                                <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative z-0 transform-gpu">
                                    <video
                                        src={card.video}
                                        className="monolith-video absolute inset-0 w-full h-full object-cover opacity-90"
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        preload="metadata"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>

                                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-10">
                                        <div className="flex flex-col">
                                            <span className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-1">{card.subtitle}</span>
                                            <span className="text-white font-['Outfit',sans-serif] font-black text-xl leading-none tracking-tight whitespace-pre-line">{card.title}</span>
                                        </div>
                                        <div className="w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <img src={card.logo} alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
