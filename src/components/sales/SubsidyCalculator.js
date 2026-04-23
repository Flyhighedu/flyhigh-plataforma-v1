'use client';

import React from 'react';

export default function SubsidyCalculator({ cuota, numNinos, turno }) {
    const costoReal = 100;
    const subsidio = Math.max(0, costoReal - cuota);
    
    // Neuroventas logic: Calculate operational days based on 68 kids/hour.
    // Public schools (vespertino, matutino, etc) usually 4.5 hrs. Private (completo, etc) maybe 6 hrs.
    // We'll use 4.5 hrs (306 kids/day) as baseline unless "completo" is in turno.
    const isPrivateOrFullTime = turno && turno.toLowerCase().includes('completo');
    const kidsPerDay = isPrivateOrFullTime ? 408 : 306; // 6 * 68 vs 4.5 * 68
    
    let daysRequired = 1;
    let validNinos = parseInt(numNinos, 10);
    
    if (!isNaN(validNinos) && validNinos > 0) {
        daysRequired = Math.ceil(validNinos / kidsPerDay);
    } else {
        validNinos = 0;
    }

    return (
        <div className="w-full mt-6 bg-slate-50 rounded-[28px] p-6 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] border border-slate-200/50">
            <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                💰 Desglose de Inversión
            </h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center text-slate-500">
                    <span className="text-sm font-medium">Costo real de la experiencia</span>
                    <span className="text-sm font-bold line-through decoration-red-400/50">${costoReal}</span>
                </div>
                
                <div className="flex justify-between items-center text-slate-700">
                    <span className="text-sm font-bold">Cuota de la familia</span>
                    <span className="text-lg font-black text-emerald-600">${cuota}</span>
                </div>
                
                <div className="h-px w-full bg-slate-200 my-2" />
                
                <div className="bg-sky-100/50 rounded-2xl p-4 border border-sky-200">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-black text-sky-800 uppercase tracking-wide flex items-center gap-2">
                            ✨ Subsidio
                        </span>
                        <span className="text-xl font-black text-sky-600">${subsidio}</span>
                    </div>
                    <p className="text-[10px] font-bold text-sky-600/80 uppercase tracking-wider text-right">
                        Cubierto por nuestros patrocinadores
                    </p>
                </div>

                {validNinos > 0 && (
                    <div className="mt-6 bg-emerald-50 rounded-2xl p-5 border border-emerald-200 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-5">
                            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 22h20L12 2z" />
                            </svg>
                        </div>
                        <p className="text-xs text-emerald-800 font-medium leading-relaxed relative z-10">
                            Por la cantidad aproximada que tiene su escuela: <strong className="text-2xl font-black text-emerald-600 block my-1">{validNinos} alumnos</strong>
                            Su escuela fácilmente puede ser cubierta en <strong className="font-black text-emerald-700 bg-emerald-200/50 px-2 py-0.5 rounded">{daysRequired} {daysRequired === 1 ? 'día' : 'días'}</strong> de operación.
                        </p>
                    </div>
                )}
                
                {!validNinos && (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-slate-400 font-medium italic">
                            Selecciona una escuela para ver la estimación operativa.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
