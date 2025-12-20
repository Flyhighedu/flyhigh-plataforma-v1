"use client";
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Play, X, ArrowRight, Quote, Plane, Wind, MapPin } from 'lucide-react';

/*
  MASTERPIECE REFACTOR: "HISTORIAS EN VUELO"
  ------------------------------------------
  AWWWARDS SUBMISSION - SITE OF THE MONTH
  
  ARCHITECTURE: 3-LAYER Z-AXIS PARALLAX
  1. BACKGROUND LAYER (Speed 0.2x): Grain + "HISTORIAS"
  2. CANVAS LAYER (Speed 0.5x): Kinetic Typography (Quotes)
  3. FOREGROUND LAYER (Speed 1.0x): Media Cards (Drifting)
  
  PHYSICS:
  - Damping: 0.06 (Heavy/Premium)
  - Drift: Subtle rotation based on velocity (illusion of floating)
*/

// --- CONTENT DATA ---
const QUOTES = [
    {
        id: 'q1',
        text: "¡Había una alegría que se sentía en todo el patio! Los niños hacían todo lo que les pedíamos porque se morían de ganas de que ya les tocara volar.",
        author: "Mtra. Lucina",
        role: "Directora General",
        offset: "left-[150vw] md:left-[60vw] top-[15vh]", // Canvas Coordinate
    },
    {
        id: 'q2',
        text: "Verlos tan concentrados siguiendo el vuelo en tiempo real nos sorprendió; tienen una chispa increíble y solo necesitaban ver algo diferente.",
        author: "Mtra. Xatziri",
        role: "Docente Primaria",
        offset: "left-[350vw] md:left-[140vw] top-[10vh]", // Canvas Coordinate
    },
    {
        id: 'q3',
        text: "Es algo de verdad maravilloso; ver cómo lo que parecía imposible hoy es una herramienta real para que los niños imaginen su futuro.",
        author: "Mtra. Karina",
        role: "Coordinadora",
        offset: "left-[550vw] md:left-[220vw] top-[20vh]", // Canvas Coordinate
    }
];

const MEDIA = [
    {
        id: 'santi',
        type: 'video',
        title: "SANTI",
        location: "Volcán Paricutín",
        src: "https://assets.mixkit.co/videos/preview/mixkit-little-boy-wearing-a-superhero-cape-standing-in-a-field-28499-large.mp4",
        thumb: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=800&fit=crop",
        aspect: 'vertical',
        offset: "left-[90vw] md:left-[35vw] top-[5vh]", // Forground Coordinate
        rotation: 2 // Initial tilt
    },
    {
        id: 'mateo',
        type: 'image',
        title: "MATEO",
        location: "Parque Nacional",
        src: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&h=600&fit=crop",
        aspect: 'horizontal',
        offset: "left-[280vw] md:left-[110vw] top-[30vh]",
        rotation: -2
    },
    {
        id: 'valeria',
        type: 'video',
        title: "VALERIA",
        location: "Centro Histórico",
        src: "https://assets.mixkit.co/videos/preview/mixkit-girl-playing-with-a-paper-plane-in-the-sun-33066-large.mp4",
        thumb: "https://images.unsplash.com/photo-1627916574483-c5a47672224d?w=600&h=800&fit=crop",
        aspect: 'vertical',
        offset: "left-[480vw] md:left-[190vw] top-[10vh]",
        rotation: 3
    },
    {
        id: 'diego',
        type: 'image',
        title: "DIEGO",
        location: "La Tzararacua",
        src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
        aspect: 'vertical',
        offset: "left-[680vw] md:left-[270vw] top-[25vh]",
        rotation: -1
    }
];

// --- PHYSICS CONSTANTS ---
const PHYSICS_DAMPING = 0.06;
const lerp = (start, end, factor) => start + (end - start) * factor;

// --- SUB-COMPONENTS ---

const FilmGrain = () => (
    <svg className="film-grain w-full h-full pointer-events-none fixed inset-0 z-50 opacity-[0.04] mix-blend-overlay">
        <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
);

const PlayButton = () => (
    <div className="relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24">
        {/* Heartbeat only visible on touch/hover to keep UI clean but accessible */}
        <div className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-60 md:hidden" />
        <div className="relative z-10 w-full h-full bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center transition-transform duration-500 hover:scale-110">
            <Play fill="white" size={32} className="ml-1" />
        </div>
    </div>
);

// --- MAIN COMPONENT ---
const HorizontalGallery = ({ onOpen }) => {
    const containerRef = useRef(null);
    const [targetProgress, setTargetProgress] = useState(0);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [maxTranslate, setMaxTranslate] = useState(0);
    const requestRef = useRef(null);

    // Initial Resize Logic
    useLayoutEffect(() => {
        const handleResize = () => {
            // Estimate total travel distance based on content spread
            // Foreground moves fastest (1.0x), so it defines the max range.
            // Approx 350vw (Desktop) / 800vw (Mobile)
            const isMobile = window.innerWidth < 768;
            setMaxTranslate(isMobile ? window.innerWidth * 8 : window.innerWidth * 3.5);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Scroll Listener
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const { top, height } = containerRef.current.getBoundingClientRect();
            const maxScroll = height - window.innerHeight;
            // Calculate 0-1 progress
            let p = -top / maxScroll;
            setTargetProgress(Math.max(0, Math.min(1, p)));
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Physics Loop
    useLayoutEffect(() => {
        const animate = () => {
            setCurrentProgress(prev => {
                const diff = targetProgress - prev;
                if (Math.abs(diff) < 0.00001) return targetProgress;
                return lerp(prev, targetProgress, PHYSICS_DAMPING);
            });
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [targetProgress]);

    return (
        <section ref={containerRef} className="relative h-[600vh] bg-[#F8F9FA] text-[#0F172A] selection:bg-fuchsia-200 overflow-visible">
            {/* INJECT MONTSERRAT */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;900&display=swap');
            `}</style>

            <FilmGrain />

            {/* STICKY VIEWPORT */}
            <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center">

                {/* --- LAYER 0: BACKGROUND (0.2x Speed) --- */}
                <div
                    className="absolute inset-x-0 h-full flex items-center justify-center pointer-events-none select-none z-0"
                    style={{ transform: `translateX(-${currentProgress * maxTranslate * 0.2}px)` }}
                >
                    <h1
                        className="text-[25vw] md:text-[20vw] leading-none text-transparent stroke-text opacity-[0.03] whitespace-nowrap pl-[10vw]"
                        style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, WebkitTextStroke: '2px #0f172a' }}
                    >
                        HISTORIAS EN VUELO
                    </h1>
                </div>

                {/* --- LAYER 1: CANVAS - TEXT (0.5x Speed) --- */}
                {/* Z-INDEX: 10 (Behind Media, but floating) */}
                <div
                    className="absolute top-0 left-0 h-full w-full pointer-events-none z-10 will-change-transform"
                    style={{ transform: `translateX(-${currentProgress * maxTranslate * 0.5}px)` }}
                >
                    {/* TITLE BLOCK */}
                    <div className="absolute top-[20vh] left-[5vw] md:left-[10vw]">
                        <div className="w-20 h-2 bg-fuchsia-600 mb-6" />
                        <h2 className="text-[12vw] md:text-[5vw] leading-[0.8] tracking-tighter" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900 }}>
                            VOCES <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-blue-600">DEL VIENTO</span>
                        </h2>
                        <p className="mt-8 max-w-md text-slate-500 font-medium text-lg leading-relaxed">
                            Una colección editorial de momentos que cambiaron la perspectiva de una generación.
                        </p>
                    </div>

                    {/* QUOTES */}
                    {QUOTES.map((q) => (
                        <div key={q.id} className={`absolute ${q.offset} w-[90vw] md:w-[45vw] opacity-0 transition-opacity duration-1000`}
                            style={{ opacity: currentProgress > 0.05 ? 1 : 0 }}
                        >
                            <Quote size={80} className="text-slate-200 mb-4 opacity-50" fill="currentColor" strokeWidth={0} />
                            <p
                                className="text-[#0F172A] relative"
                                style={{
                                    fontFamily: 'Montserrat, sans-serif',
                                    fontWeight: 900,
                                    // FLUID TYPOGRAPHY CLAMP
                                    fontSize: 'clamp(2rem, 3.5vw, 4rem)',
                                    lineHeight: '1.0',
                                    letterSpacing: '-0.02em'
                                }}
                            >
                                {q.text}
                            </p>
                            <div className="mt-8 flex items-center gap-3">
                                <div className="h-[1px] w-12 bg-slate-400" />
                                <div>
                                    <h4 className="text-sm font-bold uppercase tracking-widest text-[#0F172A]">{q.author}</h4>
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{q.role}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* CTA */}
                    <div className="absolute top-[30vh] left-[750vw] md:left-[350vw] w-[90vw] md:w-[40vw] flex flex-col items-center text-center">
                        <h3 className="text-[10vw] md:text-[6vw] font-black leading-none mb-6" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900 }}>
                            TU TURNO <br /> DE VOLAR
                        </h3>
                        <div className="w-24 h-24 rounded-full border-2 border-[#0F172A] flex items-center justify-center">
                            <ArrowRight size={40} className="-rotate-45" />
                        </div>
                    </div>
                </div>

                {/* --- LAYER 2: FOREGROUND - MEDIA (1.0x Speed) --- */}
                {/* Z-INDEX: 20 (Overlaps Text) */}
                <div
                    className="absolute top-0 left-0 h-full w-full z-20 will-change-transform"
                    style={{ transform: `translateX(-${currentProgress * maxTranslate}px)` }}
                >
                    {MEDIA.map((m) => (
                        <div
                            key={m.id}
                            className={`
                                group absolute overflow-hidden shadow-2xl cursor-pointer bg-slate-200
                                transform transition-transform duration-700
                                ${m.offset}
                                ${m.aspect === 'vertical' ? 'w-[85vw] h-[60vh] md:w-[28vw] md:h-[65vh] rounded-[2rem] md:rounded-[4rem]' : 'w-[85vw] h-[40vh] md:w-[40vw] md:h-[50vh] rounded-[2rem] md:rounded-[3rem]'}
                            `}
                            // DRIFT EFFECT: Rotate + Hover Lift
                            style={{
                                transform: `rotate(${m.rotation}deg) translateY(${currentProgress * 50}px)`, // Parallax Y-axis drift
                            }}
                            onClick={() => m.type === 'video' && onOpen(m.id)}
                        >
                            <div className="absolute inset-0 bg-slate-900/10 z-[5]" />
                            <img src={m.thumb || m.src} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-110" alt={m.title} />

                            {/* Play Button */}
                            {m.type === 'video' && (
                                <div className="absolute inset-0 flex items-center justify-center z-30">
                                    <PlayButton />
                                </div>
                            )}

                            {/* Caption */}
                            <div className="absolute bottom-6 left-8 z-30 text-white">
                                <span className="block text-[10px] uppercase tracking-[0.3em] font-bold mb-1 opacity-80">{m.location}</span>
                                <h3 className="text-3xl font-black italic tracking-tighter" style={{ fontFamily: 'Montserrat, sans-serif' }}>{m.title}</h3>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};

// --- FLY PLAYER (Modal) ---
const FlyPlayer = ({ isOpen, onClose, initialId }) => {
    const item = MEDIA.find(i => i.id === initialId);
    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
            <button onClick={onClose} className="absolute top-6 right-6 p-4 bg-white/10 rounded-full hover:bg-white/20 text-white z-50">
                <X size={24} />
            </button>
            <div className="w-full h-full md:w-[90vw] md:h-[90vh] bg-black relative border border-white/10 overflow-hidden md:rounded-[2rem]">
                <video src={item.src} className="w-full h-full object-contain" autoPlay controls />
            </div>
        </div>
    );
};

// --- EXPORT WRAPPER ---
export default function HorizontalGalleryWrapper() {
    const [playerOpen, setPlayerOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const openPlayer = (id) => {
        setSelectedId(id);
        setPlayerOpen(true);
    };

    return (
        <>
            <HorizontalGallery onOpen={openPlayer} />
            <FlyPlayer isOpen={playerOpen} onClose={() => setPlayerOpen(false)} initialId={selectedId} />
        </>
    );
}
