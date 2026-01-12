'use client';

import React, { useEffect, useRef } from 'react';
import { School } from 'lucide-react';

export default function EscuelasGallery3D() {
    // Parallax Ref
    const middleColumnRef = useRef(null);

    // Simple scroll parallax effect
    useEffect(() => {
        const handleScroll = () => {
            if (middleColumnRef.current) {
                const scrolled = window.scrollY;
                // Move middle column opposite to scroll direction slightly
                middleColumnRef.current.style.transform = `translateY(${scrolled * 0.05}px)`;
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
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

    const schools = [
        "Instituto Morelos", "Colegio La Paz", "ESFU #1", "ESFU #2", "Escuela Vasco de Quiroga",
        "Colegio Casa del Niño", "Escuela Manuel Perez", "Instituto Uruapan", "Colegio Michoacán",
        "Prepa UNAM", "Tec de Monterrey", "Universidad La Salle", "Instituto Piaget",
        "Colegio Salesiano", "Escuela Benito Juárez", "Instituto Kolob", "Colegio Sor Juana",
        "Escuela Mártires", "Instituto Tecnológico", "Colegio Reforma"
    ];

    return (
        <section className="relative w-full bg-white overflow-hidden rounded-b-[40px] md:rounded-b-[80px] shadow-[0_40px_40px_-10px_rgba(0,0,0,0.4)] mb-[-80px] z-20 mt-[-20px] md:mt-[-40px]">

            {/* Container */}
            <div className="relative h-[680px] md:h-[880px] w-full flex justify-center pt-12">

                {/* 3D Masonry Grid - STATIC with bleeding edges */}
                <div className="flex justify-center gap-3 md:gap-6 w-[140%] md:w-full max-w-[1700px] px-0 md:px-12 transform origin-top"
                    style={{ transform: 'perspective(1000px) rotateX(10deg) rotateZ(-3deg)' }}>

                    {/* Column 1 (Static) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl">
                        {column1.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100">
                                <img src={src} className="w-full h-full object-cover" alt="Gallery" />
                            </div>
                        ))}
                    </div>

                    {/* Column 2 (Parallax Middle) - Ref for scroll effect */}
                    <div ref={middleColumnRef} className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl mt-8 md:mt-12 transition-transform duration-75 ease-out will-change-transform">
                        {column2.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100">
                                <img src={src} className="w-full h-full object-cover" alt="Gallery" />
                            </div>
                        ))}
                    </div>

                    {/* Column 3 (Static) */}
                    <div className="flex flex-col gap-3 md:gap-6 w-1/3 opacity-100 shadow-2xl">
                        {column3.map((src, i) => (
                            <div key={i} className="relative aspect-[3/4] w-full rounded-lg md:rounded-2xl overflow-hidden bg-slate-100">
                                <img src={src} className="w-full h-full object-cover" alt="Gallery" />
                            </div>
                        ))}
                    </div>

                </div>

                {/* FADE & LOGO SECTION */}
                <div className="absolute top-[400px] md:top-[550px] left-0 w-full h-[600px] flex flex-col justify-start z-20 pointer-events-none">

                    {/* Hard White Gradient - The "Floor" */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white via-70% to-transparent"></div>

                    {/* Content Layer */}
                    <div className="relative z-30 w-full pt-32">
                        <div className="text-center mb-6">
                            <span className="inline-block text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100">
                                Ellos ya volaron
                            </span>
                        </div>

                        {/* HIGH SPEED MARQUEE */}
                        <div className="relative w-full overflow-hidden pointer-events-auto">
                            <div className="flex animate-marquee whitespace-nowrap gap-12 md:gap-24 items-center px-4 w-max">
                                {[...schools, ...schools].map((school, idx) => (
                                    <div key={idx} className="flex items-center gap-4 md:gap-6 shrink-0 group">
                                        <School className="w-8 h-8 md:w-10 md:h-10 text-blue-600/40 group-hover:text-blue-600 transition-colors duration-500" />
                                        <h4 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight uppercase">
                                            {school}
                                        </h4>
                                    </div>
                                ))}
                            </div>

                            {/* Side Fades */}
                            <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-white to-transparent z-40"></div>
                            <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-white to-transparent z-40"></div>
                        </div>

                        {/* Engagement Label (Refined) */}
                        <div className="mt-4 text-center px-4">
                            <p className="text-[10px] md:text-xs tracking-[0.2em] text-slate-400 uppercase font-medium">
                                Únete a las instituciones que están <span className="font-black text-slate-900 opacity-80">redefiniendo el futuro.</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
