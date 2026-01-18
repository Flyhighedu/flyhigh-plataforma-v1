'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { School } from 'lucide-react';
import { supabaseNew } from '@/lib/supabaseClientNew';

export default function EscuelasGallery3D() {
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

    // Extreme Performance Card Style
    const cardStyle = {
        willChange: 'transform',
        WebkitTransform: 'translate3d(0,0,0)',
        transform: 'translate3d(0,0,0)',
        isolation: 'isolate',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
    };

    return (
        <section className="relative w-full z-20 overflow-hidden"
            style={{
                height: '800px', // Fixed height for parallax section
                perspective: '1px',
                overflowX: 'hidden',
                overflowY: 'auto',
                contain: 'strict',
                WebkitOverflowScrolling: 'touch' // Smooth momentum scroll in Safari
            }}>

            {/* Container */}
            <div className="relative h-full w-full flex justify-center pt-12" style={{ transformStyle: 'preserve-3d' }}>

                {/* 3D Masonry Grid */}
                <div className="flex justify-center gap-3 md:gap-6 w-[140%] md:w-full max-w-[1700px] px-0 md:px-12 transform origin-top"
                    style={{
                        transform: 'perspective(1000px) rotateX(10deg) rotateZ(-3deg)',
                        transformStyle: 'preserve-3d'
                    }}>

                    {/* Column 1 (Static Layer) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 shadow-2xl" style={{ transformStyle: 'preserve-3d' }}>
                        {column1.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100" style={cardStyle}>
                                <Image
                                    src={src}
                                    fill
                                    className="object-cover"
                                    alt="Gallery"
                                    sizes="(max-width: 768px) 33vw, 25vw"
                                    priority
                                    quality={75}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Column 2 (CSS Parallax Middle Layer) */}
                    {/* transform: translateZ(-1px) scale(2) delegates movement to GPU based on perspective */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 shadow-2xl"
                        style={{
                            transform: 'translateZ(-1px) scale(2)',
                            transformStyle: 'preserve-3d',
                            ...cardStyle
                        }}>
                        {column2.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100" style={cardStyle}>
                                <Image
                                    src={src}
                                    fill
                                    className="object-cover"
                                    alt="Gallery"
                                    sizes="(max-width: 768px) 33vw, 25vw"
                                    priority
                                    quality={75}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Column 3 (Static Layer) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 shadow-2xl" style={{ transformStyle: 'preserve-3d' }}>
                        {column3.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100" style={cardStyle}>
                                <Image
                                    src={src}
                                    fill
                                    className="object-cover"
                                    alt="Gallery"
                                    sizes="(max-width: 768px) 33vw, 25vw"
                                    quality={75}
                                />
                            </div>
                        ))}
                    </div>

                </div>

                {/* FADE & MARQUEE SECTION - STAYS FIXED IN VIEW */}
                <div className="absolute top-[400px] md:top-[550px] left-0 w-full h-[600px] flex flex-col justify-start z-20 pointer-events-none"
                    style={{ transform: 'translateZ(0)' }}>

                    {/* Hard White Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white via-70% to-transparent"></div>

                    {/* Content Layer */}
                    <div className="relative z-30 w-full pt-32" style={{ WebkitPerspective: '1000px', perspective: '1000px' }}>
                        <div className="text-center mb-6">
                            <span className="inline-block text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
                                Ellos ya volaron
                            </span>
                        </div>

                        {/* MARQUEE - ALREADY WORKING, UNTOUCHED LOGIC */}
                        <div className={`relative w-full overflow-hidden pointer-events-auto transition-opacity duration-1000 ease-out ${animationReady ? 'opacity-100' : 'opacity-0'}`}
                            style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}>
                            <div className={`flex whitespace-nowrap gap-12 md:gap-24 items-center px-4 w-max ${animationReady ? 'animate-marquee' : ''}`}
                                style={{
                                    WebkitTransform: 'translate3d(0,0,0)',
                                    transform: 'translate3d(0,0,0)',
                                    willChange: 'transform'
                                }}>
                                {[...schools, ...schools, ...schools].map((school, idx) => (
                                    <div key={idx} className="flex items-center gap-4 md:gap-6 shrink-0 group"
                                        style={{ WebkitFontSmoothing: 'antialiased', backfaceVisibility: 'hidden' }}>
                                        <School className="w-8 h-8 md:w-10 md:h-10 text-blue-600/40 group-hover:text-blue-600 transition-colors duration-500" />
                                        <h4 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight uppercase">
                                            {school}
                                        </h4>
                                    </div>
                                ))}
                            </div>

                            <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-white to-transparent z-40"></div>
                            <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-white to-transparent z-40"></div>
                        </div>

                        {/* Engagement Label */}
                        <div className="mt-8 text-center px-4">
                            <p className="text-xs md:text-sm tracking-[0.2em] text-slate-400 uppercase font-medium">
                                Únete a las instituciones que están <span className="font-black text-slate-900 opacity-80">redefiniendo el futuro.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
