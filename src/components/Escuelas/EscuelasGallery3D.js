'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { School } from 'lucide-react';
import { supabaseNew } from '@/lib/supabaseClientNew';

export default function EscuelasGallery3D() {
    // 1. Zero-Jitter Manual Engine Refs
    const containerRef = useRef(null);
    const middleColumnRef = useRef(null);
    const scrollData = useRef({
        currentY: 0,
        targetY: 0,
        lerp: 0.1 // Smoothness factor
    });

    // 2. High-Performance Manual Loop (Bypass React for Scroll)
    useEffect(() => {
        let rafId;

        const updateParallax = () => {
            if (!containerRef.current || !middleColumnRef.current) {
                rafId = requestAnimationFrame(updateParallax);
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Calculate entry/pivot point
            const centerPoint = rect.top + rect.height / 2;
            const screenCenter = viewportHeight / 2;
            const diff = (centerPoint - screenCenter) * -0.12; // Direction and intensity

            // Clamp and set target
            scrollData.current.targetY = Math.max(-25, Math.min(25, diff));

            // Smooth Lerp (Linear Interpolation)
            scrollData.current.currentY += (scrollData.current.targetY - scrollData.current.currentY) * scrollData.current.lerp;

            // Direct DOM update (The secret to Zero-Jitter)
            // Fixes Safari rounding errors by using toFixed(2)
            middleColumnRef.current.style.transform = `translate3d(0, ${scrollData.current.currentY.toFixed(2)}px, 0) translateZ(1px)`;

            rafId = requestAnimationFrame(updateParallax);
        };

        rafId = requestAnimationFrame(updateParallax);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    const column1 = [
        "/img/Estoy viendo la fabrica.png",
        "/img/EDU Patrocinios.png",
        "/img/Patio altamirano.png",
    ];
    const column2 = [
        "/img/EDU Patrocinios(1).png",
        "/img/Portada Altamirano Uruapan.jpg",
        "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=400&fit=crop",
    ];
    const column3 = [
        "/img/Firefly_Vertical mobile wallpaper, bright blue sky with soft white clouds, shallow depth of f 704566.jpg",
        "/img/Portada 2 niños.jpg",
        "/img/EDU Patrocinios11.png",
    ];

    const [schools, setSchools] = useState([]);
    const [animationReady, setAnimationReady] = useState(false);

    const sanitizeSchoolName = (name) => {
        if (!name) return "";
        let cleanName = name;
        cleanName = cleanName.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm|hrs|horas)?\b/gi, '');
        cleanName = cleanName.replace(/\b(matutino|vespertino|turno|horario)\b/gi, '');
        cleanName = cleanName.replace(/[-|]/g, '');
        return cleanName.replace(/\s+/g, ' ').trim();
    };

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const { data: scheduledData } = await supabaseNew.from('proximas_escuelas').select('nombre_escuela');
                const { data: extrasData } = await supabaseNew.from('escuelas_extras').select('nombre');
                const allNames = new Set();
                (scheduledData || []).forEach(item => {
                    const clean = sanitizeSchoolName(item.nombre_escuela);
                    if (clean && clean.length > 2) allNames.add(clean);
                });
                (extrasData || []).forEach(item => {
                    const clean = sanitizeSchoolName(item.nombre);
                    if (clean && clean.length > 2) allNames.add(clean);
                });
                const namesArray = Array.from(allNames);
                setSchools(namesArray);
                if (namesArray.length > 0) {
                    setTimeout(() => setAnimationReady(true), 50);
                }
            } catch (err) {
                console.error("Error fetching schools:", err);
            }
        };
        fetchSchools();
    }, []);

    // Base card styling for stability
    const cardStyle = {
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        WebkitTransformStyle: 'preserve-3d',
        transformStyle: 'preserve-3d',
        transform: 'translate3d(0,0,0)'
    };

    return (
        <section ref={containerRef} className="relative w-full overflow-hidden z-20" style={{ contain: 'layout paint' }}>
            {/* Container */}
            <div className="relative h-[680px] md:h-[880px] w-full flex justify-center pt-12">
                {/* 3D Masonry Grid */}
                <div className="flex justify-center gap-3 md:gap-6 w-[140%] md:w-full max-w-[1700px] px-0 md:px-12 transform origin-top"
                    style={{ transform: 'perspective(1200px) rotateX(10deg) rotateZ(-3deg)' }}>

                    {/* Column 1 (Static) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl">
                        {column1.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100" style={cardStyle}>
                                <Image src={src} fill className="object-cover" alt="Gallery" sizes="(max-width: 768px) 33vw, 25vw" priority decoding="async" />
                            </div>
                        ))}
                    </div>

                    {/* Column 2 (Parallax Middle) - DIRECT DOM ACCESS */}
                    <div ref={middleColumnRef} className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl" style={{ willChange: 'transform' }}>
                        {column2.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100" style={cardStyle}>
                                <Image src={src} fill className="object-cover" alt="Gallery" sizes="(max-width: 768px) 33vw, 25vw" priority decoding="async" />
                            </div>
                        ))}
                    </div>

                    {/* Column 3 (Static) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl">
                        {column3.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100" style={cardStyle}>
                                <Image src={src} fill className="object-cover" alt="Gallery" sizes="(max-width: 768px) 33vw, 25vw" decoding="async" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Marquee Section (Preserved) */}
                <div className="absolute top-[400px] md:top-[550px] left-0 w-full h-[600px] flex flex-col justify-start z-20 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white via-70% to-transparent"></div>
                    <div className="relative z-30 w-full pt-32" style={{ perspective: '1000px' }}>
                        <div className="text-center mb-6">
                            <span className="inline-block text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">Ellos ya volaron</span>
                        </div>
                        <div className={`relative w-full overflow-hidden pointer-events-auto transition-opacity duration-1000 ease-out ${animationReady ? 'opacity-100' : 'opacity-0'}`} style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}>
                            <div className={`flex whitespace-nowrap gap-12 md:gap-24 items-center px-4 w-max ${animationReady ? 'animate-marquee' : ''}`} style={{ WebkitTransform: 'translate3d(0,0,0)', transform: 'translate3d(0,0,0)', willChange: 'transform' }}>
                                {[...schools, ...schools, ...schools].map((school, idx) => (
                                    <div key={idx} className="flex items-center gap-4 md:gap-6 shrink-0 group" style={{ WebkitFontSmoothing: 'antialiased', backfaceVisibility: 'hidden' }}>
                                        <School className="w-8 h-8 md:w-10 md:h-10 text-blue-600/40 group-hover:text-blue-600 transition-colors duration-500" />
                                        <h4 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight uppercase">{school}</h4>
                                    </div>
                                ))}
                            </div>
                            <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-white to-transparent z-40"></div>
                            <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-white to-transparent z-40"></div>
                        </div>
                        <div className="mt-8 text-center px-4">
                            <p className="text-xs md:text-sm tracking-[0.2em] text-slate-400 uppercase font-medium">Únete a las instituciones que están <span className="font-black text-slate-900 opacity-80">redefiniendo el futuro.</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
