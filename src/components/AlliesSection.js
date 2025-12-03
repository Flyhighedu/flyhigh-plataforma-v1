import React from 'react';
import { Heart, School, Building2, Plus, ArrowRight, Sparkles } from 'lucide-react';

const AlliesSection = () => {
    // --- DATOS (MOCK DATA) ---
    const sponsors = [
        { logo: "/img/logo ccfdsp.png", name: "FÁBRICA SAN PEDRO" },
        { logo: "/img/logo parque.png", name: "PARQUE NACIONAL" },
        { logo: "/img/logo secretaria cultura y turismo.png", name: "SEC. CULTURA" },
        { logo: "/img/museo del agua azul png.png", name: "MUSEO DEL AGUA" },
    ];

    const schools = Array(10).fill("Escuela Impulsora");

    const donors = [
        "Hector Avila", "Alberto Avila", "Emilio Herrera", "Alejandro",
        "Carlos Bautista", "Kevin Fuentes", "Anaid Rios", "Brandon Campos",
        "David Sanchez", "Socorro Aguilar", "Rosa Rios", "Cleopatra Guerrero"
    ];

    return (
        <section className="relative w-full overflow-hidden font-sans border-t border-slate-100 bg-white">

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
        }
        .animate-scroll-reverse {
          animation: scroll-reverse 50s linear infinite;
        }
        
        .animate-scroll:hover, .animate-scroll-reverse:hover {
          animation-play-state: paused;
        }

        .animate-scroll-slow {
          animation: scroll 100s linear infinite;
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
          filter: blur(60px);
          opacity: 0.9;
          animation: aurora 60s linear infinite;
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

                    {/* NUEVOS LOGOS CENTRALES (Strong Plastic & Bonanza) */}
                    <div className="flex justify-center items-start gap-8 mb-6">
                        {/* Strong Plastic */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-20 flex items-center justify-center">
                                <img src="/img/logo sp Negro.png" alt="Strong Plastic" className="h-20 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Patrocinador Oficial</span>
                        </div>

                        {/* Divider */}
                        <div className="w-[1px] h-16 bg-slate-200 mt-3"></div>

                        {/* Bonanza */}
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="h-20 flex items-center justify-center">
                                <img src="/img/bonanza.png" alt="La Bonanza" className="h-12 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Patrocinador Oficial</span>
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
                            {[...sponsors, ...sponsors, ...sponsors].map((sponsor, idx) => (
                                <div
                                    key={idx}
                                    className="clay-card w-48 h-20 flex flex-col items-center justify-center rounded-xl cursor-pointer group border border-transparent hover:border-pink-100"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <img src={sponsor.logo} alt={sponsor.name} className="h-8 w-auto object-contain transition-all duration-300" />
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

                    {/* FILA B: ESCUELAS (Píldoras compactas) */}
                    <div className="relative w-full overflow-hidden mask-fade-sides">
                        <div className="flex w-max animate-scroll-reverse gap-3 py-1">
                            {[...schools, ...schools, ...schools].map((school, idx) => (
                                <div
                                    key={idx}
                                    className="clay-pill px-4 py-2 rounded-full flex items-center gap-2 cursor-default group hover:scale-105 transition-transform border border-slate-100"
                                >
                                    <School size={14} className="text-pink-400" />
                                    <span className="text-slate-600 font-bold text-xs whitespace-nowrap">{school}</span>
                                </div>
                            ))}

                            {/* CTA ESCUELAS */}
                            <div className="clay-pill px-4 py-2 rounded-full flex items-center gap-2 cursor-pointer border border-pink-200 bg-pink-50 group hover:bg-pink-100">
                                <span className="text-pink-600 font-bold text-xs whitespace-nowrap flex items-center gap-1">
                                    Postula tu Escuela <ArrowRight size={12} />
                                </span>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* --- 3. TICKER DE PADRINOS (El Retorno del Rosa Vibrante) --- */}
            <div className="absolute bottom-0 w-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 py-2.5 overflow-hidden shadow-lg z-20">
                <div className="flex w-max animate-scroll-slow gap-10">
                    {[...donors, ...donors, ...donors, ...donors].map((donor, idx) => (
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
