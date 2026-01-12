"use client";
import React from 'react';
import { Atom, Cpu, Rocket, Palette, Sigma } from 'lucide-react';

export default function EscuelasMethodology() {
    const steamCards = [
        {
            letter: "S",
            word: "Science",
            title: "Física en Acción",
            desc: "No es teoría, es realidad. Los alumnos experimentan las leyes de Newton, aerodinámica y propulsión en tiempo real. Ven sus cálculos cobrar vida en el firmamento.",
            icon: <Atom className="w-8 h-8" />,
            color: "text-blue-500",
            bg: "bg-blue-50",
            border: "border-blue-100",
            colSpan: "col-span-12 md:col-span-4"
        },
        {
            letter: "T",
            word: "Technology",
            title: "Telemetría y Datos",
            desc: "Uso de altímetros y software de seguimiento para analizar el apogeo y la velocidad. Transformamos el lanzamiento en una mina de datos para analizar en clase.",
            icon: <Cpu className="w-8 h-8" />,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            border: "border-emerald-100",
            colSpan: "col-span-12 md:col-span-4"
        },
        {
            letter: "E",
            word: "Engineering",
            title: "Diseño y Construcción",
            desc: "Desde el fuselaje hasta las aletas. Los estudiantes iteran sus diseños para maximizar la estabilidad y minimizar la resistencia. Ingeniería pura aplicada.",
            icon: <Rocket className="w-8 h-8" />,
            color: "text-fuchsia-500",
            bg: "bg-fuchsia-50",
            border: "border-fuchsia-100",
            colSpan: "col-span-12 md:col-span-4"
        },
        {
            letter: "A",
            word: "Arts",
            title: "Identidad de Misión",
            desc: "La creatividad es el combustible de la innovación. Diseñan parches de misión, nombres de cohetes y la narrativa de su viaje al espacio.",
            icon: <Palette className="w-8 h-8" />,
            color: "text-orange-500",
            bg: "bg-orange-50",
            border: "border-orange-100",
            colSpan: "col-span-12 md:col-span-6"
        },
        {
            letter: "M",
            word: "Mathematics",
            title: "Cálculo de Trayectoria",
            desc: "Trigonometría y álgebra con un propósito. Calculan alturas teóricas vs. reales, márgenes de error y proyecciones de vuelo.",
            icon: <Sigma className="w-8 h-8" />,
            color: "text-indigo-500",
            bg: "bg-indigo-50",
            border: "border-indigo-100",
            colSpan: "col-span-12 md:col-span-6"
        }
    ];

    return (
        <section className="pt-[120px] pb-24 bg-slate-50 relative overflow-hidden z-10">
            {/* Background Blobs */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                {/* Header Removed as per user request */}

                {/* Bento Grid */}
                <div className="grid grid-cols-12 gap-6">
                    {steamCards.map((card, idx) => (
                        <div
                            key={idx}
                            className={`${card.colSpan} group relative bg-white rounded-3xl p-8 shadow-sm border ${card.border} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}
                        >
                            <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500 ${card.color}`}>
                                {card.icon}
                            </div>

                            <div className="relative z-10">
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-6 ${card.bg} ${card.color}`}>
                                    <span className="font-black text-xl">{card.letter}</span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{card.word}</h4>
                                <h3 className="text-2xl font-black text-slate-800 mb-3">{card.title}</h3>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    {card.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
