'use client';

import React from 'react';

const sponsors = [
    { src: "/flyers/Logo-Global-Frut-png.png", alt: "Global Frut" },
    { src: "/flyers/Logo-La-Bonanza-Avocados-pdf.png", alt: "La Bonanza" },
    { src: "/flyers/Logo-Madobox.png", alt: "Madobox" },
    { src: "/flyers/logo-RV-Fresh.png", alt: "RV Fresh" },
    { src: "/flyers/logo-Strong-plastic-pdf.png", alt: "Strong Plastic" },
    { src: "/flyers/Diseno-sin-tituloww.png", alt: "Círculo" },
    { src: "/flyers/51d89e34-3d94-448c-9b34-16abb3360127.png", alt: "Aztecavo" },
];

const allies = [
    { src: "/flyers/logo-ccfdsp.png", alt: "Fábrica de San Pedro" },
    { src: "/flyers/logo-parque.png", alt: "Parque Nacional" },
    { src: "/flyers/logo-secretaria-cultura-y-turismo.png", alt: "Secretaría de Cultura" },
];

export default function SponsorLegitimacyGrid() {
    return (
        <div className="w-full mt-8 bg-white/40 backdrop-blur-md rounded-[28px] p-6 shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] border border-white/50">
            <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">
                Legitimidad de la Campaña
            </h3>
            
            <div className="space-y-6">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
                        Patrocinadores Privados
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-4">
                        {sponsors.map((sponsor, i) => (
                            <div key={`sponsor-${i}`} className="w-[60px] h-[40px] flex items-center justify-center">
                                <img 
                                    src={sponsor.src} 
                                    alt={sponsor.alt} 
                                    className="max-w-full max-h-full object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-200/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">
                        Aliados Institucionales
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-6">
                        {allies.map((ally, i) => (
                            <div key={`ally-${i}`} className="w-[80px] h-[40px] flex items-center justify-center">
                                <img 
                                    src={ally.src} 
                                    alt={ally.alt} 
                                    className="max-w-full max-h-full object-contain mix-blend-multiply opacity-70 hover:opacity-100 transition-opacity duration-300"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="mt-6 text-center">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Estas instituciones garantizan la transparencia y respaldan el impacto educativo del programa en Uruapan.
                </p>
            </div>
        </div>
    );
}
