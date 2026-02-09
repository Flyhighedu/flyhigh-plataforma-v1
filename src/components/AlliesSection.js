import React from 'react';
import { Heart, School, Building2, Plus, ArrowRight, Sparkles } from 'lucide-react';

const AlliesSection = () => {
    // --- DATOS (MOCK DATA) ---
    const sponsors = [
        { logo: "/img/logo ccfdsp.png", name: "FÁBRICA SAN PEDRO" },
        { logo: "/img/logo parque.png", name: "PARQUE NACIONAL" },
        { logo: "/img/logo secretaria cultura y turismo.png", name: "SEC. CULTURA" },
        { logo: "/img/museo del agua azul png.png", name: "MUSEO DEL AGUA" },
        { logo: "/img/Logo Global Frut png.png", name: "GLOBAL FRUT" },
    ];

    const schools = Array(6).fill(["Instituto Santa Maria", "Instituto Morelos"]).flat();

    const donors = [
        "Hector Avila", "Alberto Avila", "Emilio Herrera", "Alejandro",
        "Carlos Bautista", "Kevin Fuentes", "Anaid Rios", "Brandon Campos",
        "David Sanchez", "Socorro Aguilar", "Rosa Rios", "Cleopatra Guerrero"
    ];

    return (
        <section
            className="relative z-[80] w-full overflow-hidden font-sans border-t border-slate-100 bg-white"
        >

            {/* CSS LOCAL: ANIMACIONES Y ESTILO CLAY */}
            <style>{`
        /* Animación Izquierda */
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        /* Animación Derecha (Inversa) */
        @keyframes scroll-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        
        .animate-scroll {
          animation: scroll 45s linear infinite;
          will-change: transform;
          transform: translate3d(0,0,0);
        }
        .animate-scroll-reverse {
          animation: scroll-reverse 50s linear infinite;
          will-change: transform;
          transform: translate3d(0,0,0);
        }
        
        .animate-scroll:hover, .animate-scroll-reverse:hover {
          animation-play-state: paused;
        }

        .animate-scroll-slow {
          animation: scroll 100s linear infinite;
          will-change: transform;
          transform: translate3d(0,0,0);
        }
        .animate-scroll-slow:hover {
          animation-play-state: paused;
        }
        
        /* Estilo Soft Clay (Compacto) */
        .clay-card {
          background-color: #ffffff;
          box-shadow: 
            inset 0 0 0 1px rgba(255, 255, 255, 1),
            inset 0 0 0 2px rgba(241, 245, 249, 0.5),
            0 4px 10px -2px rgba(236, 72, 153, 0.05); /* Sombra rosada sutil */
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .clay-card:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 
            inset 0 0 0 1px rgba(255, 255, 255, 1),
            0 12px 20px -5px rgba(236, 72, 153, 0.15); /* Resplandor rosa al hover */
        }

        /* Clay Pill para Escuelas */
        .clay-pill {
          background-color: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(4px);
          box-shadow:
             inset 1px 1px 2px rgba(255, 255, 255, 1),
             0 2px 4px rgba(0,0,0,0.03);
        }
        
        /* Máscara de degradado que coincide con el fondo */
        .mask-fade-sides {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        /* Aurora Effect */
        @keyframes aurora {
          0% { background-position: 50% 50%, 50% 50%; }
          100% { background-position: 350% 50%, 350% 50%; }
        }
        .aurora-bg {
          background-image: 
            radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.25) 0px, transparent 50%),
            radial-gradient(at 0% 0%, rgba(244, 114, 182, 0.2) 0px, transparent 50%),
            radial-gradient(at 50% 50%, rgba(255, 192, 203, 0.15) 0px, transparent 50%);
          filter: blur(30px);
          opacity: 0.7;
        }
      `}</style>

            {/* AURORA BACKGROUND */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] aurora-bg"></div>
            </div>

            {/* CONTENIDO PRINCIPAL (Compacto: py-10 en lugar de pt-20) */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16">

                {/* --- 1. ENCABEZADO COMPACTO --- */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-pink-100 text-pink-500 text-[10px] font-bold uppercase tracking-widest shadow-sm mb-3">
                        <Sparkles size={12} className="fill-pink-200" />
                        Aliados Fly High
                    </div>

                    {/* NUEVOS LOGOS CENTRALES (Strong Plastic, RV Fresh, Madobox & Bonanza) */}
                    <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10 mb-6">
                        {/* Strong Plastic */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-16 md:h-20 flex items-center justify-center">
                                <img src="/img/logo sp Negro.png" alt="Strong Plastic" className="h-full w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Patrocinador</span>
                        </div>

                        <div className="w-[1px] h-12 bg-slate-100 hidden md:block"></div>

                        {/* RV Fresh */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-16 md:h-20 flex items-center justify-center">
                                <img src="/img/logo RV Fresh.png" alt="RV Fresh" className="h-full w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-green-500 transition-colors">Patrocinador</span>
                        </div>

                        <div className="w-[1px] h-12 bg-slate-100 hidden md:block"></div>

                        {/* Madobox */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-16 md:h-20 flex items-center justify-center">
                                <img src="/img/Logo Madobox.png" alt="Madobox" className="h-full w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors">Patrocinador</span>
                        </div>

                        <div className="w-[1px] h-12 bg-slate-100 hidden md:block"></div>

                        {/* Bonanza */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-12 md:h-14 flex items-center justify-center">
                                <img src="/img/bonanza.png" alt="La Bonanza" className="h-full w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-rose-500 transition-colors">Patrocinador</span>
                        </div>

                        <div className="w-[1px] h-12 bg-slate-100 hidden md:block"></div>

                        {/* Global Frut */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-16 md:h-20 flex items-center justify-center">
                                <img src="/img/Logo Global Frut png.png" alt="Global Frut" className="h-full w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Patrocinador</span>
                        </div>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
                        Impulsado por <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-500">Gigantes y Corazones</span>
                    </h2>
                    <p className="text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
                        La unión de ciudadanos, empresas e instituciones con una sola brújula: que la niñez de Uruapan vuelva a mirar al cielo.
                    </p>
                </div>

                {/* --- 2. GRID HÍBRIDO: EMPRESAS + ESCUELAS (Layout Optimizado) --- */}
                <div className="flex flex-col gap-5">

                    {/* FILA A: EMPRESAS (Altura reducida h-20) */}
                    <div className="relative w-full overflow-hidden mask-fade-sides">
                        <div className="flex w-max animate-scroll gap-4 py-2">
                            {[...sponsors, ...sponsors].map((sponsor, idx) => (
                                <div
                                    key={idx}
                                    className="clay-card w-48 h-20 flex flex-col items-center justify-center rounded-xl cursor-pointer group border border-transparent hover:border-pink-100"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <img src={sponsor.logo} alt={sponsor.name} className="h-8 w-auto object-contain" loading="lazy" decoding="async" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-pink-500 transition-colors">{sponsor.name}</span>
                                </div>
                            ))}

                            {/* CTA INVITACIÓN */}
                            <div className="clay-card w-48 h-20 flex items-center justify-center gap-2 rounded-xl cursor-pointer border-2 border-dashed border-blue-200 bg-blue-50/20 group hover:bg-white">
                                <Plus size={16} className="text-blue-500" />
                                <span className="text-xs font-bold text-blue-600">Súmate como Empresa</span>
                            </div>
                        </div>
                    </div>

                    {/* FILA B: ESCUELAS IMPULSORAS (KPIs Integrados) */}
                    <div className="flex flex-col items-center gap-6 py-8 border-t border-slate-50 relative">
                        {/* Texto Minimalista */}
                        <div className="text-center max-w-lg mx-auto mb-2">
                            <span className="inline-block text-[10px] font-black tracking-[0.2em] text-pink-500 uppercase mb-2 bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                                Escuelas Impulsoras
                            </span>
                            <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight leading-tight">
                                Transformando su éxito en <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">oportunidades para todos.</span>
                            </h3>
                        </div>

                        {/* Chips de Escuelas con KPIs y Colores de Marca */}
                        <div className="flex flex-wrap justify-center items-center gap-6 cursor-default">
                            {/* Instituto Santa Maria - Morado/Verde */}
                            <div className="clay-pill pl-4 pr-6 py-3 rounded-[2rem] flex items-center gap-4 group hover:-translate-y-1 transition-all duration-300 border border-purple-100 bg-white shadow-sm hover:shadow-lg hover:shadow-purple-500/10">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-50 to-white flex items-center justify-center border border-purple-100 shadow-inner">
                                    <School size={18} className="text-purple-700" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-slate-800 font-black text-sm tracking-tight leading-none mb-1">Instituto Santa Maria</span>
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                                        <Sparkles size={10} className="fill-emerald-600" /> Becó a +150 niños
                                    </span>
                                </div>
                            </div>

                            {/* Instituto Morelos - Azul Marino Estilo Militar */}
                            <div className="clay-pill pl-4 pr-6 py-3 rounded-[2rem] flex items-center gap-4 group hover:-translate-y-1 transition-all duration-300 border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:shadow-blue-900/10">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-50 to-white flex items-center justify-center border border-slate-200 shadow-inner">
                                    <Building2 size={18} className="text-slate-800" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-slate-900 font-black text-sm tracking-tight leading-none mb-1">Instituto Morelos</span>
                                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                                        <Heart size={10} className="fill-blue-700" /> Becó a +150 niños
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* --- 3. TICKER DE PADRINOS (El Retorno del Rosa Vibrante) --- */}
            <div className="absolute bottom-0 w-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 py-2.5 overflow-hidden shadow-lg z-20">
                <div className="flex w-max animate-scroll-slow gap-10">
                    {[...donors, ...donors].map((donor, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-white font-medium text-xs md:text-sm whitespace-nowrap">
                            <Heart size={14} className="fill-white animate-pulse" />
                            <span className="opacity-90">Gracias a</span>
                            <span className="font-bold bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/30">
                                {donor}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

        </section>
    );
};

export default AlliesSection;
