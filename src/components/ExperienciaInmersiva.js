'use client';

import React, { useState, useEffect, useRef } from 'react';

const cards = [
    {
        id: 1,
        title: "FÁBRICA\nSAN PEDRO",
        subtitle: "Acceso Exclusivo",
        video: "/videos/Capsula FabricaSanPedro.mp4",
        logo: "/img/logo ccfdsp.png"
    },
    {
        id: 2,
        title: "PARQUE\nNACIONAL",
        subtitle: "Acceso Exclusivo",
        video: "/videos/capsula parque presentacion web (1).mp4",
        logo: "/img/logo parque.png"
    },
    {
        id: 3,
        title: "SECRETARÍA\nDE CULTURA",
        subtitle: "Acceso Exclusivo",
        video: "/videos/capsula secretaria de cultura presentacion web (1).mp4",
        logo: "/img/logo secretaria cultura y turismo.png"
    },
    {
        id: 4,
        title: "MUSEO\nDEL AGUA",
        subtitle: "Acceso Exclusivo",
        video: "/videos/CapsulaMuseodelAgua.mp4",
        logo: "/img/museo del agua azul png.png"
    }
];

const VideoCard = ({ card, isActive, onVideoEnded }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isActive) {
            // Play when active
            video.play().catch(() => { });
        } else {
            // Pause and reset to start when inactive (acting as a cover)
            video.pause();
            video.currentTime = 0;
        }
    }, [isActive]);

    return (
        <div
            data-index={card.index}
            className="carousel-item snap-center shrink-0 w-[85vw] md:w-[400px] transition-transform duration-500 ease-out"
            style={{
                transform: isActive ? 'scale(1)' : 'scale(0.9)',
                opacity: isActive ? 1 : 0.6
            }}
        >
            <div className="relative h-[60vh] md:h-[550px] rounded-[2.5rem] overflow-hidden bg-slate-900 shadow-2xl">

                {/* VIDEO AS COVER: Always rendered, paused if inactive */}
                <video
                    ref={videoRef}
                    src={card.video}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onEnded={onVideoEnded}
                />

                {/* OVERLAYS (Always Visible) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none"></div>

                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-10 pointer-events-none">
                    <div className="flex flex-col text-left">
                        <span className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-1">{card.subtitle}</span>
                        <span className="text-white font-['Outfit',sans-serif] font-black text-xl leading-none tracking-tight whitespace-pre-line">{card.title}</span>
                    </div>
                    <div className="w-16 h-16 flex items-center justify-center">
                        <img src={card.logo} alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default function ExperienciaInmersiva() {
    const [activeIndex, setActiveIndex] = useState(0);
    const carouselRef = useRef(null);

    // 1. SCROLL OBSERVER: Detect Active Slide (More robust than IntersectionObserver)
    const handleScroll = () => {
        const container = carouselRef.current;
        if (!container) return;

        // Calculate center of the visible carousel area
        const containerCenter = container.scrollLeft + (container.clientWidth / 2);

        let closestIndex = activeIndex;
        let minDistance = Number.MAX_VALUE;

        const items = container.querySelectorAll('.carousel-item');
        items.forEach((item) => {
            const index = parseInt(item.getAttribute('data-index'), 10);
            if (isNaN(index)) return;

            // Calculate center of the item relative to the container
            // item.offsetLeft is relative to the offsetParent (the container, if positioned)
            const itemCenter = item.offsetLeft + (item.offsetWidth / 2);

            const distance = Math.abs(containerCenter - itemCenter);

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        if (closestIndex !== activeIndex) {
            setActiveIndex(closestIndex);
        }
    };

    // 2. AUTO-ADVANCE LOGIC
    const handleVideoEnded = () => {
        const nextIndex = (activeIndex + 1) % cards.length;
        scrollToIndex(nextIndex);
    };

    const scrollToIndex = (index) => {
        const carousel = carouselRef.current;
        if (!carousel) return;

        const items = carousel.querySelectorAll('.carousel-item');
        const targetItem = items[index];

        if (targetItem) {
            // Calculate position to center the item
            const containerWidth = carousel.clientWidth;
            const itemWidth = targetItem.offsetWidth;
            const itemLeft = targetItem.offsetLeft;

            const newScrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);

            carousel.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section id="experiencia-inmersiva" className="min-h-screen w-full flex flex-col justify-center relative z-[60] py-20 bg-[linear-gradient(180deg,#FFFFFF_0%,#FFFBF0_100%)]">

            {/* Custom Styles for Hide Scrollbar */}
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
            `}</style>

            {/* WATERMARK GIGANTE (Profundidad 3D) */}
            <div className="absolute top-0 left-[-5%] w-full pointer-events-none select-none z-0 flex justify-center">
                <span className="watermark-text text-[15vw] md:text-[18vw] opacity-40">INMERSIÓN</span>
            </div>

            {/* HEADER */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full text-center mb-10">
                <div className="inline-flex items-center gap-3 bg-slate-900 px-8 py-3 rounded-full mb-8 shadow-2xl">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                    <span className="text-purple-300 font-bold tracking-[0.2em] text-sm uppercase">Experiencia Inmersiva</span>
                </div>
                <h3 className="font-['Outfit',sans-serif] font-black text-5xl md:text-8xl text-slate-900 leading-[0.9] tracking-tighter mb-6">
                    EXPEDICIÓN <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">INMERSIVA.</span>
                </h3>
                <p className="text-slate-500 text-base md:text-xl leading-relaxed max-w-3xl mx-auto text-pretty px-4 mb-4">
                    Al aterrizar los espera una experiencia inmersiva que preparamos con nuestras instituciones aliadas.
                </p>

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

            {/* CAROUSEL CONTAINER */}
            <div className="relative w-full max-w-[1400px] mx-auto">
                <div
                    ref={carouselRef}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory hide-scroll gap-6 px-[5vw] md:px-[calc(50%-200px)] pb-12"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {cards.map((card, index) => (
                        <VideoCard
                            key={card.id + '-' + index}
                            card={{ ...card, index }}
                            isActive={index === activeIndex}
                            onVideoEnded={handleVideoEnded}
                        />
                    ))}
                </div>

                {/* DOT INDICATORS */}
                <div className="flex justify-center gap-3 mt-4">
                    {cards.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => scrollToIndex(index)}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === activeIndex ? 'bg-purple-600 w-8' : 'bg-slate-300 hover:bg-slate-400'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
