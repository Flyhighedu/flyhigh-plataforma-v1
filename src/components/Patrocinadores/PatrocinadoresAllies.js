'use client';

import React from 'react';

export default function PatrocinadoresAllies() {
    return (
        <section id="allies" className="py-32 px-8 bg-black text-white rounded-t-[50px] relative z-10 -mt-10">
            <div className="reveal-node mb-20 text-center">
                <h2 className="text-[10px] font-bold tracking-[0.5em] text-blue-400 uppercase mb-6">Custodios del Patrimonio</h2>
                <p className="text-3xl font-black leading-tight mb-8">El vuelo no tendría rumbo sin la raíz de nuestra historia.</p>
                <div className="h-1 w-12 bg-blue-600 mx-auto"></div>
            </div>

            <div className="grid grid-cols-2 gap-10 reveal-node max-w-2xl mx-auto">
                {/* Ally 1 */}
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 p-2 hover:bg-white/10 transition-colors duration-300">
                        <img src="/img/logo secretaria cultura y turismo.png" alt="Secretaría de Cultura" className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100" />
                    </div>
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest text-center">Sec. de Cultura</span>
                </div>
                {/* Ally 2 */}
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 p-2 hover:bg-white/10 transition-colors duration-300">
                        <img src="/img/logo parque.png" alt="Parque Nacional" className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100" />
                    </div>
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest text-center">Pque. Nacional</span>
                </div>
                {/* Ally 3 */}
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 p-2 hover:bg-white/10 transition-colors duration-300">
                        <img src="/img/logo ccfdsp.png" alt="Fábrica San Pedro" className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100" />
                    </div>
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest text-center">Fábrica San Pedro</span>
                </div>
                {/* Ally 4 */}
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 p-2 hover:bg-white/10 transition-colors duration-300">
                        <img src="/img/museo del agua azul png.png" alt="Museo del Agua" className="w-full h-full object-contain filter grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100" />
                    </div>
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest text-center">Museo del Agua</span>
                </div>
            </div>

            <div className="mt-24 text-center reveal-node">
                <p className="text-[10px] text-gray-600 italic leading-relaxed">
                    "Porque un niño que conoce su ciudad desde el cielo, jamás permitirá que su futuro se quede en el suelo."
                </p>
                <div className="mt-12 flex flex-col items-center opacity-30">
                    <span className="text-xs font-black tracking-tighter uppercase mb-2">FLY HIGH EDU 2025</span>
                </div>
            </div>
        </section>
    );
}
