"use client";
import React from 'react';
import { School, CheckCircle2 } from 'lucide-react';

export default function EscuelasShowcase() {
    const schools = [
        "Instituto Morelos", "Colegio La Paz", "ESFU #1", "ESFU #2", "Escuela Vasco de Quiroga",
        "Colegio Casa del Niño", "Escuela Manuel Perez Coronado", "Instituto Uruapan", "Colegio Michoacán"
    ];

    return (
        <section className="py-20 bg-white border-y border-slate-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 mb-4">
                    <CheckCircle2 size={12} /> Comunidad en Vuelo
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight">
                    Ellos ya son parte de la Tripulación
                </h3>
            </div>

            {/* Marquee/Slider */}
            <div className="relative w-full overflow-hidden group">
                <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-white to-transparent z-10" />
                <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-white to-transparent z-10" />

                <div className="flex gap-8 whitespace-nowrap animate-infinite-scroll group-hover:[animation-play-state:paused] w-max">
                    {[...schools, ...schools, ...schools].map((school, index) => (
                        <div key={index} className="inline-flex items-center gap-3 px-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400">
                                <School size={20} />
                            </div>
                            <span className="text-lg font-bold text-slate-600 uppercase tracking-tight">{school}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
