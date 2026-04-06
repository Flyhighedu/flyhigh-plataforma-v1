'use client';

import React, { useEffect, useState } from 'react';
import { School } from 'lucide-react';
import { supabaseNew } from '@/lib/supabaseClientNew';

export default function SchoolMarquee() {
    const [schools, setSchools] = useState([]);
    const [animationReady, setAnimationReady] = useState(false);

    // Función de limpieza de nombres
    const sanitizeSchoolName = (name) => {
        if (!name) return "";
        let cleanName = name;

        // Eliminar horarios, turnos y caracteres extra
        cleanName = cleanName.replace(/\b\d{1,2}(:\d{2})?\s*(am|pm|hrs|horas)?\b/gi, '');
        cleanName = cleanName.replace(/\b(matutino|vespertino|turno|horario)\b/gi, '');
        cleanName = cleanName.replace(/[-|]/g, '');
        return cleanName.replace(/\s+/g, ' ').trim();
    };

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                // Fetch completed missions
                const { data: closedMissions, error } = await supabaseNew
                    .from('cierres_mision')
                    .select('school_name_snapshot');

                if (error) {
                    console.error('Error fetching closed missions:', error);
                    return;
                }

                const allNames = new Set();
                (closedMissions || []).forEach(item => {
                    const clean = sanitizeSchoolName(item.school_name_snapshot);
                    if (clean && clean.length > 2) allNames.add(clean);
                });

                // Si no hay misiones en BD, ponemos placeholders para que no se vea vacío el demo
                const namesArray = Array.from(allNames);
                if (namesArray.length === 0) {
                    namesArray.push("Escuela Otilio Montaño", "Primaria Altamirano", "Colegio Uruapan", "Escuela Vasco de Quiroga");
                }

                setSchools(namesArray);

                if (namesArray.length > 0) {
                    setTimeout(() => setAnimationReady(true), 50);
                }
            } catch (err) {
                console.error("Unexpected error fetching schools:", err);
            }
        };

        fetchSchools();
    }, []);

    // Necesitamos CSS keyframes dinámicos para esto si no están globales
    return (
        <section className="relative w-full py-12 bg-white overflow-hidden border-t border-slate-100/50">
            <style jsx>{`
                @keyframes marquee-scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-33.333333%); } /* Triplicated content */
                }
                .animate-marquee-custom {
                    animation: marquee-scroll 40s linear infinite;
                }
                .animate-marquee-custom:hover {
                    animation-play-state: paused;
                }
            `}</style>
            
            <div className="text-center mb-8 px-4">
                <span className="inline-block text-[10px] md:text-xs font-black tracking-[0.3em] uppercase text-violet-600 bg-violet-50 px-3 py-1 rounded-full border border-violet-100">
                    Ellos ya volaron
                </span>
            </div>

            <div 
                className={`relative w-full overflow-hidden pointer-events-auto transition-opacity duration-700 ease-out ${animationReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden', WebkitOverflowScrolling: 'touch' }}
            >
                <div 
                    className={`flex whitespace-nowrap gap-12 md:gap-24 items-center px-4 w-max ${animationReady ? 'animate-marquee-custom' : ''}`}
                    style={{ WebkitTransform: 'translate3d(0,0,0)', transform: 'translate3d(0,0,0)', willChange: 'transform' }}
                >
                    {/* Triplicamos los datos para asegurar el bucle infinito suave */}
                    {[...schools, ...schools, ...schools].map((school, idx) => (
                        <div key={idx} className="flex items-center gap-4 md:gap-6 shrink-0 group" style={{ WebkitFontSmoothing: 'antialiased', WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}>
                            <School className="w-6 h-6 md:w-8 md:h-8 text-fuchsia-600/30 group-hover:text-fuchsia-600 transition-colors duration-500" />
                            <h4 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight uppercase">
                                {school}
                            </h4>
                        </div>
                    ))}
                </div>

                {/* Degrades en los bordes para un look limpio */}
                <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
                <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
            </div>
        </section>
    );
}
