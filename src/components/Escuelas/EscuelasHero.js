"use client";
import React from 'react';
import { ArrowDown, Sparkles, Plane, School, LogIn } from 'lucide-react';

export default function EscuelasHero() {
    const scrollToContent = () => {
        const nextSection = document.getElementById('escuelas-content');
        if (nextSection) {
            nextSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <header className="relative w-full h-[100dvh] overflow-hidden font-sans z-0">
            {/* Background Video */}
            <div className="absolute inset-0 z-0">
                <video
                    className="w-full h-full object-cover"
                    src="/img/portada escuelas.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                />
                {/* Overlay Gradients - Cinematic look */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/90" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* Central Block (Title + CTA) - Perfectly Centered z-20 */}
            <div className="relative z-20 w-full h-full flex flex-col items-center justify-center px-4 pb-20 sm:pb-0">

                {/* Badge */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 mb-10 sm:mb-14 transform -translate-y-6 sm:-translate-y-10">
                    <span className="inline-flex items-center gap-2 sm:gap-3 text-white drop-shadow-lg font-black uppercase tracking-[0.3em] text-sm sm:text-lg">
                        <School size={20} className="text-white sm:w-6 sm:h-6" />
                        Portal Escolar
                    </span>
                </div>

                {/* Main Titles */}
                <div className="space-y-4 max-w-5xl mx-auto text-center transform translate-y-8 sm:translate-y-12">
                    <h1 className="text-4xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter uppercase leading-[0.9] drop-shadow-2xl animate-in zoom-in-50 duration-1000 ease-out">
                        El Futuro <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Aterriza en tu Patio</span>
                    </h1>
                    <p className="mt-4 text-base sm:text-2xl text-slate-200 font-medium max-w-xl sm:max-w-2xl mx-auto leading-relaxed text-balance drop-shadow-lg opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-forwards px-2">
                        Transforme su escuela en una plataforma de despegue.
                        Impulse a sus alumnos con una experiencia educativa <span className="text-white font-bold italic">inolvidable y subsidiada.</span>
                    </p>
                </div>

                {/* CTA Buttons - Vertical Stack for "Decision Unit" */}
                <div className="mt-16 sm:mt-20 flex flex-col items-center justify-center gap-4 opacity-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700 fill-mode-forwards w-full relative top-12 sm:top-20">
                    <button
                        onClick={scrollToContent}
                        className="w-full sm:w-auto px-10 py-5 bg-white hover:bg-slate-50 text-blue-700 rounded-full font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_50px_-10px_rgba(255,255,255,0.6)] flex items-center justify-center gap-3 z-20"
                    >
                        <School className="w-5 h-5 flex-shrink-0" />
                        Registrar mi escuela
                    </button>

                    <div className="w-full flex justify-center">
                        <button
                            className="group flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 z-10 bg-transparent border-none"
                        >
                            <img
                                src="/img/login icono saludando.gif"
                                alt="Login"
                                className="w-5 h-5 object-contain flex-shrink-0"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' }}
                            />
                            <span className="font-bold text-xs text-white uppercase tracking-widest border-b border-white/30 group-hover:border-white pb-0.5 transition-colors text-center shadow-black drop-shadow-md">
                                Ya tengo cuenta. Iniciar Sesión.
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TRUST FOOTER - ABSOLUTE BOTTOM with Gradient */}
            <div className="absolute bottom-0 left-0 w-full z-30 flex flex-col items-center justify-end pb-6 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none space-y-4 animate-in fade-in duration-1000">

                {/* Authority Logos - Watermark Style */}
                <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 px-4 pointer-events-auto mb-3">
                    <img
                        src="/img/logo secretaria cultura y turismo.png"
                        alt="Secretaría de Cultura"
                        className="h-8 sm:h-10 w-auto object-contain brightness-0 invert opacity-50 hover:opacity-100 transition-opacity duration-500"
                    />
                    <img
                        src="/img/logo parque.png"
                        alt="Parque Nacional Barranca del Cupatitzio"
                        className="h-8 sm:h-10 w-auto object-contain brightness-0 invert opacity-50 hover:opacity-100 transition-opacity duration-500"
                    />
                    <img
                        src="/img/logo ccfdsp.png"
                        alt="Centro Cultural Fábrica de San Pedro"
                        className="h-8 sm:h-10 w-auto object-contain brightness-0 invert opacity-50 hover:opacity-100 transition-opacity duration-500"
                    />
                    <img
                        src="/img/logo huatapera.png"
                        alt="Museo de la Guatapera"
                        className="h-8 sm:h-10 w-auto object-contain brightness-0 invert opacity-50 hover:opacity-100 transition-opacity duration-500"
                    />
                    <img
                        src="/img/museo del agua azul png.png"
                        alt="Museo del Agua (IURHEKUA)"
                        className="h-8 sm:h-10 w-auto object-contain brightness-0 invert opacity-50 hover:opacity-100 transition-opacity duration-500"
                    />
                </div>

                {/* Scroll Indicator - Text & Icon Only */}
                <div
                    className="flex items-center gap-2 cursor-pointer group pointer-events-auto opacity-60 hover:opacity-100 transition-all duration-500"
                    onClick={scrollToContent}
                >
                    <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/90">Conoce más</span>
                    <ArrowDown className="text-white w-3 h-3 animate-bounce" strokeWidth={1.5} />
                </div>
            </div>
        </header>
    );
}
