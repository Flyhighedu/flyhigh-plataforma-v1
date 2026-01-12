"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Plane, Tent, GraduationCap, Ticket, Laptop, Puzzle } from 'lucide-react';

export default function EscuelasAllies() {
    const [progress, setProgress] = useState(0); // For the LINE filler (continuous)
    const [activeStep, setActiveStep] = useState(1); // For the ICON anchor (discrete)

    const sectionRef = useRef(null);
    const containerRef = useRef(null);

    // Precise Tracking Logic
    useEffect(() => {
        const handleScroll = () => {
            if (sectionRef.current && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                const windowHeight = window.innerHeight;

                // --- CONTINUOUS LINE LOGIC ---
                // Start filling when container top hits center
                const startTrigger = windowHeight * 0.6;
                const totalScrollableDistance = containerRect.height;
                const currentScroll = startTrigger - containerRect.top;
                let rawProgress = (currentScroll / totalScrollableDistance) * 100;
                rawProgress = Math.max(0, Math.min(100, rawProgress));
                setProgress(rawProgress);

                // --- DISCRETE ANCHOR LOGIC ---
                // We calculate which section is the "Active Master" based on deeper thresholds
                // We want to hold Step 1 until Step 2 is VERY visible

                // Let's define the "Center Point" of our viewport
                const viewportCenter = windowHeight / 2;

                // Define step boundaries relative to the container progress
                // Step 1: 0% - 35% visually
                // Step 2: 35% - 75% visually
                // Step 3: > 75% visually

                // However, user wants "Desanclaje" only when next section is prominent.
                // We switch to Step 2 only when rawProgress > 40 (approx)
                // We switch to Step 3 only when rawProgress > 80 (approx)

                let nextStep = 1;
                if (rawProgress > 35) nextStep = 2; // Jump to Earth
                if (rawProgress > 75) nextStep = 3; // Jump to Aula

                setActiveStep(nextStep);
            }
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        handleScroll();
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, []);

    // Determine Traveler State based on ACTIVE STEP (Fixed Anchors)
    const getTravelerState = (step) => {
        switch (step) {
            case 1: return { icon: Plane, color: 'bg-blue-600', gradient: 'from-blue-600 to-cyan-400', top: '10%' };
            case 2: return { icon: Tent, color: 'bg-emerald-500', gradient: 'from-emerald-600 to-green-400', top: '50%' };
            case 3: return { icon: Laptop, color: 'bg-indigo-600', gradient: 'from-indigo-600 to-purple-400', top: '90%' };
            default: return { icon: Plane, color: 'bg-blue-600', gradient: 'from-blue-600 to-cyan-400', top: '10%' };
        }
    };

    const traveler = getTravelerState(activeStep);
    const TravelerIcon = traveler.icon;

    const allies = [
        { name: "Cultura", logo: "/img/logo secretaria cultura y turismo.png", bg: "bg-fuchsia-100" },
        { name: "Parque", logo: "/img/logo parque.png", bg: "bg-green-100" },
        { name: "Fábrica", logo: "/img/logo ccfdsp.png", bg: "bg-orange-100" },
        { name: "Agua", logo: "/img/museo del agua azul png.png", bg: "bg-cyan-100" },
        { name: "Guatápera", logo: "/img/logo huatapera.png", bg: "bg-amber-100" }
    ];

    return (
        <section ref={sectionRef} className="py-24 bg-white relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

                {/* Header */}
                <div className="text-center mb-16">
                    <span className="inline-block py-1 px-3 rounded-full bg-slate-100 text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">
                        La Jornada
                    </span>
                    <h2 className="text-5xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-6">
                        Una Experiencia <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                            Inolvidable
                        </span>
                    </h2>
                </div>

                {/* Timeline Container */}
                <div ref={containerRef} className="relative max-w-4xl mx-auto py-10 min-h-[1000px]">

                    {/* The Rail */}
                    <div className="absolute left-[28px] md:left-1/2 top-0 bottom-0 w-1.5 bg-slate-100 -translate-x-1/2 rounded-full"></div>

                    {/* The Progress Fill (Continuous) */}
                    <div
                        className="absolute left-[28px] md:left-1/2 top-0 w-1.5 bg-gradient-to-b from-blue-500 via-emerald-500 to-indigo-600 -translate-x-1/2 rounded-full transition-all duration-75 ease-out"
                        style={{ height: `${progress}%` }}
                    ></div>

                    {/* THE TRAVELER ICON (Discrete Steps) */}
                    <div
                        className={`absolute left-[48px] md:left-1/2 -translate-x-1/2 z-30 flex items-center justify-center w-20 h-20 rounded-full text-white shadow-2xl ring-8 ring-white transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${traveler.color}`}
                        style={{ top: traveler.top, transform: 'translate(-50%, -50%) scale(1.1)' }}
                    >
                        <TravelerIcon className="w-8 h-8 md:w-10 md:h-10 animate-pulse" />
                    </div>


                    {/* STATION 1: CIELO */}
                    <div className="relative flex md:justify-end items-center mb-64" style={{ marginTop: '5%' }}>
                        {/* Text Container - ALWAYS LEFT ALIGNED relative to image on desktop */}
                        <div className={`relative pl-20 pr-4 md:pl-0 md:pr-24 md:w-1/2 text-left transition-all duration-700 ${activeStep >= 1 ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4 grayscale'}`}>



                            {/* Illustration */}
                            <img
                                src="/img/clay_sky.gif"
                                alt="Niños volando animación"
                                className="relative z-10 w-full max-w-sm md:max-w-md ml-0 mr-auto md:ml-auto md:mr-0 mb-6 animate-in fade-in zoom-in duration-1000 [mask-image:linear-gradient(to_right,transparent_2%,black_15%,black_85%,transparent_98%),linear-gradient(to_bottom,transparent_2%,black_8%,black_85%,transparent_100%)] [mask-composite:intersect]"
                            />
                            <div className="relative z-10 text-left">
                                <h3 className={`text-4xl md:text-5xl font-black mb-4 transition-colors duration-500 ${activeStep === 1 ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500' : 'text-slate-400'}`}>
                                    Primero, el Cielo
                                </h3>
                                <p className="text-slate-600 text-lg font-medium leading-relaxed mb-6">
                                    Despegamos hacia una experiencia inolvidable. Volarán sobre ríos, montañas y arquitectura icónica, redescubriendo su ciudad desde una perspectiva única.
                                </p>


                            </div>
                        </div>
                    </div>


                    {/* STATION 2: TIERRA */}
                    <div className="relative flex md:justify-start items-center mb-64" style={{ marginTop: '10%' }}>
                        <div className={`relative pl-24 md:pl-24 md:w-1/2 text-left transition-all duration-700 ${activeStep >= 2 ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4 grayscale'}`}>



                            {/* Illustration */}
                            <img
                                src="/img/clay_fair.png"
                                alt="Feria Educativa"
                                className="relative z-10 w-full max-w-sm md:max-w-md ml-0 mr-auto mb-6 drop-shadow-xl animate-in fade-in zoom-in duration-1000 delay-200"
                            />
                            <div className="relative z-10 text-left">
                                <h3 className={`text-4xl md:text-5xl font-black mb-4 transition-colors duration-500 ${activeStep === 2 ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500' : 'text-slate-400'}`}>
                                    Luego, la Tierra
                                </h3>
                                <p className="text-slate-600 text-lg font-medium leading-relaxed mb-6">
                                    Aterrizamos en su propio patio, directamente a una feria interactiva donde nuestras instituciones aliadas los reciben.
                                </p>

                                {/* Inline Logos */}
                                <div className={`flex flex-wrap gap-3 mb-6 transition-all duration-500 ${activeStep >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                    {allies.map((ally, idx) => (
                                        <div key={idx} className={`w-14 h-14 flex items-center justify-center p-2 rounded-xl bg-white ${ally.bg} shadow-sm border border-slate-100 hover:scale-110 transition-transform`}>
                                            <img
                                                src={ally.logo}
                                                alt={ally.name}
                                                className="w-full h-full object-contain mix-blend-multiply"
                                            />
                                        </div>
                                    ))}
                                </div>


                            </div>
                        </div>
                    </div>


                    {/* STATION 3: AULA */}
                    <div className="relative flex md:justify-end items-center pb-20" style={{ marginTop: '10%' }}>
                        <div className={`relative pl-20 pr-4 md:pl-0 md:pr-24 md:w-1/2 text-left transition-all duration-700 ${activeStep >= 3 ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4 grayscale'}`}>



                            {/* Illustration */}
                            <img
                                src="/img/clay_classroom.png"
                                alt="Niños en el aula"
                                className="relative z-10 w-full max-w-sm md:max-w-md ml-0 mr-auto md:ml-auto md:mr-0 mb-6 drop-shadow-xl animate-in fade-in zoom-in duration-1000 delay-300"
                            />
                            <div className="relative z-10 text-left">
                                <h3 className={`text-4xl md:text-5xl font-black mb-4 transition-colors duration-500 ${activeStep === 3 ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500' : 'text-slate-400'}`}>
                                    Por último, el Aula
                                </h3>
                                <p className="text-slate-600 text-lg font-medium leading-relaxed mb-6">
                                    Del patio al pupitre. Otorgamos acceso a una <strong>plataforma STEAM exclusiva</strong> para mantener viva la curiosidad todo el ciclo escolar.
                                </p>


                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
