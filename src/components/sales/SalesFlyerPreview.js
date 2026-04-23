'use client';

import React, { useRef, useState } from 'react';
import FlyerNinos from '@/components/flyers/FlyerNinos';
import FlyerPadres from '@/components/flyers/FlyerPadres';
import CircularDigital from '@/components/flyers/CircularDigital';
import { formatFlyerDate, formatMoney, captureAsPDF, captureAsPNG, downloadAll } from '@/utils/flyerUtils';
import { CheckCircle, Share2, Download, ArrowRight, ArrowLeft } from 'lucide-react';

export default function SalesFlyerPreview({ data, onBack, onProceed }) {
    const ninosRef = useRef(null);
    const padresRef = useRef(null);
    const digitalRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const flyerProps = {
        escuela: data.school.nombre_escuela.toUpperCase(),
        fecha: formatFlyerDate(data.fecha),
        monto: formatMoney(data.cuota),
        valorReal: formatMoney(100),
        subsidio: formatMoney(data.subsidio),
    };

    const handleShare = async () => {
        setIsDownloading(true);
        try {
            // Reusing existing download mechanism which is safe across all platforms.
            // On iOS, this will trigger the native download prompt for each file,
            // which the user can then share to WhatsApp.
            await downloadAll(ninosRef, padresRef, digitalRef, flyerProps.escuela);
            
            // Note: Web Share API with files generated client-side is very unstable on iOS Safari.
            // The direct download approach is the most robust fallback.
        } catch (error) {
            console.error('Error downloading flyers:', error);
            alert('Error al generar los archivos. Intenta nuevamente.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col pb-24 animate-in fade-in slide-in-from-right-4 duration-500">
            
            <div className="flex items-center mb-6">
                <button 
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/40 text-slate-600 hover:bg-white/60 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="flex-1 text-center text-lg font-black text-slate-800 tracking-tight pr-10">
                    Material Generado
                </h2>
            </div>

            {/* Neuroventas Summary Card */}
            <div className="bg-sky-500 rounded-[28px] p-6 mb-6 shadow-[0_12px_24px_rgba(14,165,233,0.3)] relative overflow-hidden text-white">
                <div className="absolute -right-10 -top-10 opacity-10">
                    <CheckCircle size={150} />
                </div>
                
                <h3 className="text-[10px] font-black text-sky-200 uppercase tracking-widest mb-1 relative z-10">
                    Resumen de la Propuesta
                </h3>
                <h4 className="text-xl font-black mb-4 leading-tight relative z-10">
                    {flyerProps.escuela}
                </h4>

                <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-center bg-sky-600/50 rounded-xl p-3">
                        <span className="text-xs font-bold text-sky-100">Fecha del Evento</span>
                        <span className="text-sm font-black">{flyerProps.fecha}</span>
                    </div>

                    <div className="flex justify-between items-center bg-emerald-500/80 rounded-xl p-3 shadow-inner border border-emerald-400/50">
                        <span className="text-xs font-bold text-emerald-100">Inversión Familiar</span>
                        <span className="text-lg font-black text-white">{flyerProps.monto} <span className="text-[10px] font-medium text-emerald-100">x alumno</span></span>
                    </div>

                    <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-bold text-sky-200 uppercase tracking-wider">Subsidio Cubierto</span>
                        <span className="text-sm font-black text-white">{flyerProps.subsidio} x alumno</span>
                    </div>
                </div>
            </div>

            {/* Mini Carousel / Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-3 shadow-sm border border-white/50">
                    <p className="text-[10px] font-bold text-slate-500 text-center mb-2">Flyer Niños</p>
                    <div className="w-full h-32 bg-slate-200 rounded-xl overflow-hidden flex justify-center items-start">
                        <div className="origin-top scale-[0.14] pointer-events-none">
                            <FlyerNinos {...flyerProps} />
                        </div>
                    </div>
                </div>
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-3 shadow-sm border border-white/50">
                    <p className="text-[10px] font-bold text-slate-500 text-center mb-2">Flyer Padres</p>
                    <div className="w-full h-32 bg-slate-200 rounded-xl overflow-hidden flex justify-center items-start">
                        <div className="origin-top scale-[0.14] pointer-events-none">
                            <FlyerPadres {...flyerProps} />
                        </div>
                    </div>
                </div>
                <div className="col-span-2 bg-white/40 backdrop-blur-md rounded-2xl p-3 shadow-sm border border-white/50">
                    <p className="text-[10px] font-bold text-slate-500 text-center mb-2">Circular WhatsApp</p>
                    <div className="w-full h-40 bg-slate-800 rounded-xl overflow-hidden flex justify-center items-start">
                        <div className="origin-top scale-[0.25] pointer-events-none">
                            <CircularDigital {...flyerProps} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
                <button
                    onClick={handleShare}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-sky-600 font-black py-4 rounded-full shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] hover:scale-[1.02] active:scale-95 transition-all"
                >
                    {isDownloading ? (
                        <span className="flex items-center gap-2">
                            <span className="animate-spin inline-block">⏳</span> Preparando archivos...
                        </span>
                    ) : (
                        <>
                            <Download size={18} /> Descargar Archivos para Compartir
                        </>
                    )}
                </button>

                <p className="text-[10px] text-center text-slate-400 px-4">
                    Descarga los archivos a tu dispositivo para enviarlos fácilmente al director vía WhatsApp.
                </p>

                <div className="h-6" /> {/* Spacer */}

                <button
                    onClick={onProceed}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 text-white font-black py-4 rounded-full shadow-[0_8px_24px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <CheckCircle size={20} /> ¡El director aceptó! Registrar Escuela
                </button>
            </div>

            {/* Hidden actual size flyers for html2canvas to capture */}
            <div className="fixed left-[-9999px] top-0 opacity-1 pointer-events-none -z-50">
                <FlyerNinos ref={ninosRef} {...flyerProps} />
                <FlyerPadres ref={padresRef} {...flyerProps} />
                <CircularDigital ref={digitalRef} {...flyerProps} />
            </div>

        </div>
    );
}
