'use client';

import React from 'react';

export default function Manifiesto() {
    return (
        <section className="relative w-full min-h-screen bg-slate-50 flex flex-col lg:flex-row">
            <div className="relative w-full lg:w-1/2 h-[50vh] lg:h-auto min-h-[400px] lg:order-1">
                <img
                    src="https://flyhighedu.com.mx/wp-content/uploads/2025/11/Diseno-sin-titulo-1.png"
                    className="absolute inset-0 w-full h-full object-cover"
                    alt="Niño mirando al cielo"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>
                <div className="absolute bottom-8 left-6 lg:bottom-16 lg:left-16 max-w-md">
                    <div className="h-1 w-10 bg-[#00C6FF] mb-3"></div>
                    <p className="text-white font-['Outfit',sans-serif] font-medium text-xl lg:text-3xl leading-tight drop-shadow-lg">
                        "La mirada de quien descubre el mundo por primera vez."
                    </p>
                </div>
            </div>

            <div className="relative w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:p-24 xl:p-32 bg-white lg:order-2 z-10">
                <div className="relative lg:-ml-40 mb-8 group">
                    <h2 className="font-['Outfit',sans-serif] font-black text-4xl sm:text-5xl xl:text-7xl text-slate-900 leading-[0.9] tracking-tighter mix-blend-hard-light lg:mix-blend-normal">
                        Cambiar su <br />perspectiva es <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] to-[#0072FF]">cambiar su destino.</span>
                    </h2>
                </div>

                <div className="prose prose-base prose-slate text-slate-500 font-light leading-relaxed mb-10 max-w-lg">
                    <p className="mb-3">
                        Una inyección de posibilidades. Al elevarlos sobre su propia ciudad, les demostramos físicamente que <span className="font-bold text-slate-700">el mundo es mucho más grande que su entorno diario.</span>
                    </p>
                    <p>
                        Queremos despertar nuevas pasiones, curiosidad por la tecnología y la certeza de que pueden <span className="font-bold text-slate-700">llegar tan alto como se atrevan a mirar.</span>
                    </p>
                </div>

                <div className="flex items-center gap-3 border-t border-slate-100 pt-6 w-full max-w-md">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                        <span className="text-white font-['Outfit',sans-serif] font-bold text-[10px] tracking-wider">FH</span>
                    </div>
                    <div>
                        <p className="text-slate-900 font-bold text-xs uppercase tracking-widest">Compromiso Fly High</p>
                        <p className="text-slate-400 text-[10px] mt-0.5">Misión Educativa 2025</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
