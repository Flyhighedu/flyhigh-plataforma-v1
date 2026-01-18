'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { School } from 'lucide-react';
import { supabaseNew } from '@/lib/supabaseClientNew';

export default function EscuelasGallery3D() {
    // 1. Zero-Reflow Manual Engine Refs
    const containerRef = useRef(null);
    const middleColumnRef = useRef(null);

    // Cached values to avoid layout thrashing during scroll
    const layout = useRef({
        top: 0,
        height: 0,
        active: false,
        lastScrollY: 0,
        ticking: false
    });

    // Capture initial layout once and on resize
    useEffect(() => {
        const updateLayout = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                layout.current.top = rect.top + window.scrollY;
                layout.current.height = rect.height;
            }
        };

        const timer = setTimeout(updateLayout, 800);
        window.addEventListener('resize', updateLayout, { passive: true });
        window.addEventListener('load', updateLayout);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateLayout);
            window.removeEventListener('load', updateLayout);
        };
    }, []);

    // 2. Ultra-Stable Passive Scroll Listener
    useEffect(() => {
        const onScroll = () => {
            const scrollY = window.pageYOffset;

            if (!layout.current.ticking) {
                window.requestAnimationFrame(() => {
                    if (!middleColumnRef.current) {
                        layout.current.ticking = false;
                        return;
                    }

                    const viewportHeight = window.innerHeight;
                    const containerMiddle = layout.current.top + (layout.current.height / 2);
                    const viewportMiddle = scrollY + (viewportHeight / 2);

                    // SUPER STABLE FACTOR: Minimum travel to prevent hardware fatigue
                    const diff = (containerMiddle - viewportMiddle) * -0.08;

                    // Clamp to just 15px for maximum stability
                    const y = Math.max(-15, Math.min(15, diff));

                    // FLATTENED TRANSFORM: No nesting rotations, no rounding errors
                    middleColumnRef.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;

                    layout.current.ticking = false;
                });
                layout.current.ticking = true;
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
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

    // Base card styling - Extreme Simplification
    const cardStyle = {
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        transform: 'translate3d(0,0,0)'
    };

    return (
        <section ref={containerRef} className="relative w-full overflow-hidden z-20" style={{ contain: 'paint' }}>
            {/* Container */}
            <div className="relative h-[600px] md:h-[800px] w-full flex justify-center pt-8">

                {/* 
                  FLATTENED GRID: Removed rotateX and rotateZ to eliminate Safari jump artifact.
                  The "look" is now achieved with simple offsets and clean proportions.
                */}
                <div className="flex justify-center gap-3 md:gap-6 w-full max-w-[1400px] px-4 md:px-12 origin-center">

                    {/* Column 1 - Static */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 pt-12 md:pt-20">
                        {column1.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100 shadow-lg" style={cardStyle}>
                                <Image src={src} fill className="object-cover" alt="Gallery" sizes="(max-width: 768px) 33vw, 25vw" priority decoding="async" />
                            </div>
                        ))}
                    </div>

                    {/* Column 2 - Stable Parallax */}
                    <div ref={middleColumnRef} className="flex flex-col gap-3 md:gap-6 w-1/3" style={{ willChange: 'transform' }}>
                        {column2.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100 shadow-xl" style={cardStyle}>
                                <Image src={src} fill className="object-cover" alt="Gallery" sizes="(max-width: 768px) 33vw, 25vw" priority decoding="async" />
                            </div>
                        ))}
                    </div>

                    {/* Column 3 - Static */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 pt-6 md:pt-10">
                        {column3.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100 shadow-lg" style={cardStyle}>
                                <Image src={src} fill className="object-cover" alt="Gallery" sizes="(max-width: 768px) 33vw, 25vw" decoding="async" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Marquee Section (Stable Stacking) */}
                <div className="absolute top-[400px] md:top-[500px] left-0 w-full h-[600px] flex flex-col justify-start z-30 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white via-60% to-transparent"></div>
                    <div className="relative z-30 w-full pt-24 text-center">
                        <div className="mb-6">
                            <span className="inline-block text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">Ellos ya volaron</span>
                        </div>

                        <div className={`relative w-full overflow-hidden transition-opacity duration-1000 ${animationReady ? 'opacity-100' : 'opacity-0'}`}>
                            <div className={`flex whitespace-nowrap gap-12 md:gap-24 items-center px-4 w-max ${animationReady ? 'animate-marquee' : ''}`} style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}>
                                {[...schools, ...schools, ...schools].map((school, idx) => (
                                    <div key={idx} className="flex items-center gap-4 md:gap-6 shrink-0" style={{ backfaceVisibility: 'hidden' }}>
                                        <School className="w-8 h-8 md:w-10 md:h-10 text-blue-600/40" />
                                        <h4 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight uppercase">{school}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8">
                            <p className="text-[10px] md:text-sm tracking-[0.2em] text-slate-400 uppercase font-medium">Únete a las instituciones que están <span className="font-black text-slate-900 opacity-80">redefiniendo el futuro.</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
