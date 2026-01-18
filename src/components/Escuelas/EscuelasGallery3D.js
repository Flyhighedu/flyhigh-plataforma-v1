'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { School } from 'lucide-react';
import { supabaseNew } from '@/lib/supabaseClientNew';

export default function EscuelasGallery3D() {
    // Parallax Ref
    const middleColumnRef = useRef(null);

    // Unified parallax effect with RAF for performance
    useEffect(() => {
        let rafId;
        const handleScroll = () => {
            // Basic check to avoid errors if ref is null
            if (middleColumnRef.current) {
                rafId = requestAnimationFrame(() => {
                    if (!middleColumnRef.current) return;
                    const rect = middleColumnRef.current.parentElement.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    const distanceFromCenter = rect.top + rect.height / 2 - viewportHeight / 2;

                    // GPU Accelerated transform using translate3d for z-axis promotion
                    middleColumnRef.current.style.transform = `translate3d(0, ${distanceFromCenter * 0.1}px, 0)`;
                });
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
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

    // Función de limpieza de nombres
    const sanitizeSchoolName = (name) => {
        if (!name) return "";
        let cleanName = name;

        // 1. Eliminar horarios (ej: 9:00 am, 10:30am, 900 hrs)
        cleanName = cleanName.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm|hrs|horas)?\b/gi, '');

        // 2. Eliminar turnos y palabras clave de irrelevancia
        cleanName = cleanName.replace(/\b(matutino|vespertino|turno|horario)\b/gi, '');

        // 3. Limpiar caracteres extra y espacios
        cleanName = cleanName.replace(/[-|]/g, ''); // Eliminar guiones o pipes sueltos
        return cleanName.replace(/\s+/g, ' ').trim();
    };

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                // 1. Fetch Scheduled/Completed Schools from proximas_escuelas
                const { data: scheduledData, error: scheduledError } = await supabaseNew
                    .from('proximas_escuelas')
                    .select('nombre_escuela');

                if (scheduledError) console.error('Error fetching scheduled schools:', scheduledError);

                // 2. Fetch Extra/Historical Schools from escuelas_extras
                const { data: extrasData, error: extrasError } = await supabaseNew
                    .from('escuelas_extras')
                    .select('nombre');

                if (extrasError) console.error('Error fetching extra schools:', extrasError);

                // 3. Combine and Dedup with Sanitation
                const allNames = new Set();

                // Add scheduled
                (scheduledData || []).forEach(item => {
                    const clean = sanitizeSchoolName(item.nombre_escuela);
                    if (clean && clean.length > 2) allNames.add(clean);
                });

                // Add extras
                (extrasData || []).forEach(item => {
                    const clean = sanitizeSchoolName(item.nombre);
                    if (clean && clean.length > 2) allNames.add(clean);
                });

                // 4. Update State and trigger animation activation
                const namesArray = Array.from(allNames);
                setSchools(namesArray);

                // Forzar un micro-delay para que Safari registre el cambio de DOM antes de animar
                if (namesArray.length > 0) {
                    setTimeout(() => setAnimationReady(true), 50);
                }

            } catch (err) {
                console.error("Unexpected error fetching schools:", err);
            }
        };

        fetchSchools();
    }, []);

    return (
        <section className="relative w-full overflow-hidden z-20">

            {/* Container */}
            <div className="relative h-[680px] md:h-[880px] w-full flex justify-center pt-12">

                {/* 3D Masonry Grid - STATIC with bleeding edges */}
                <div className="flex justify-center gap-3 md:gap-6 w-[140%] md:w-full max-w-[1700px] px-0 md:px-12 transform origin-top"
                    style={{ transform: 'perspective(1000px) rotateX(10deg) rotateZ(-3deg)' }}>

                    {/* Column 1 (Static) - Priority LCP */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl will-change-transform">
                        {column1.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100">
                                <Image
                                    src={src}
                                    fill
                                    className="object-cover"
                                    alt="Gallery"
                                    sizes="(max-width: 768px) 33vw, 25vw"
                                    priority
                                />
                            </div>
                        ))}
                    </div>

                    {/* Column 2 (Parallax Middle) - GPU Accelerated */}
                    <div ref={middleColumnRef} className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl will-change-transform">
                        {column2.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100">
                                <Image
                                    src={src}
                                    fill
                                    className="object-cover"
                                    alt="Gallery"
                                    sizes="(max-width: 768px) 33vw, 25vw"
                                    priority
                                />
                            </div>
                        ))}
                    </div>

                    {/* Column 3 (Static) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl will-change-transform">
                        {column3.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100">
                                <Image
                                    src={src}
                                    fill
                                    className="object-cover"
                                    alt="Gallery"
                                    sizes="(max-width: 768px) 33vw, 25vw"
                                />
                            </div>
                        ))}
                    </div>

                </div>

                {/* FADE & LOGO SECTION */}
                <div className="absolute top-[400px] md:top-[550px] left-0 w-full h-[600px] flex flex-col justify-start z-20 pointer-events-none">

                    {/* Hard White Gradient - The "Floor" */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white via-70% to-transparent"></div>

                    {/* Content Layer */}
                    <div className="relative z-30 w-full pt-32" style={{ perspective: '1000px' }}>
                        <div className="text-center mb-6">
                            <span className="inline-block text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
                                Ellos ya volaron
                            </span>
                        </div>

                        {/* HIGH SPEED MARQUEE with Safari Fixes */}
                        <div className={`relative w-full overflow-hidden pointer-events-auto transition-opacity duration-700 ease-out ${animationReady ? 'opacity-100' : 'opacity-0'}`}
                            style={{
                                WebkitBackfaceVisibility: 'hidden',
                                backfaceVisibility: 'hidden',
                                WebkitOverflowScrolling: 'touch'
                            }}>

                            {/* Inyectamos la clase de animación solo cuando los datos están listos */}
                            <div className={`flex whitespace-nowrap gap-12 md:gap-24 items-center px-4 w-max ${animationReady ? 'animate-marquee' : ''}`}
                                style={{
                                    WebkitTransform: 'translate3d(0,0,0)',
                                    transform: 'translate3d(0,0,0)',
                                    willChange: 'transform'
                                }}>

                                {/* Triplicamos los datos para asegurar que el bucle sea infinito e invisible en cualquier pantalla */}
                                {[...schools, ...schools, ...schools].map((school, idx) => (
                                    <div key={idx} className="flex items-center gap-4 md:gap-6 shrink-0 group"
                                        style={{
                                            WebkitFontSmoothing: 'antialiased',
                                            WebkitBackfaceVisibility: 'hidden',
                                            backfaceVisibility: 'hidden'
                                        }}>
                                        <School className="w-8 h-8 md:w-10 md:h-10 text-blue-600/40 group-hover:text-blue-600 transition-colors duration-500" />
                                        <h4 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight uppercase">
                                            {school}
                                        </h4>
                                    </div>
                                ))}
                            </div>

                            {/* Side Fades */}
                            <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-white to-transparent z-40 pointer-events-none"></div>
                            <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-white to-transparent z-40 pointer-events-none"></div>
                        </div>

                        {/* Engagement Label (Refined) */}
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
