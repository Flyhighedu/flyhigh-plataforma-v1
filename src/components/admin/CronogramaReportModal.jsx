'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, Download, FileText, Image as ImageIcon, Calendar, Settings, ChevronRight, MapPin, CheckCircle, Clock, TreePine, Building2, Zap } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function CronogramaReportModal({ isOpen, onClose, schools }) {
    const [daysForward, setDaysForward] = useState(7);
    const [autoDay, setAutoDay] = useState('1'); // 0 = Domingo, 1 = Lunes
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    const reportRef = useRef(null);

    useEffect(() => {
        const savedDays = localStorage.getItem('flyhigh_report_days_forward');
        const savedAutoDay = localStorage.getItem('flyhigh_report_auto_day');
        if (savedDays) setDaysForward(parseInt(savedDays));
        if (savedAutoDay) setAutoDay(savedAutoDay);
    }, []);

    const saveSettings = (days, day) => {
        setDaysForward(days);
        setAutoDay(day);
        localStorage.setItem('flyhigh_report_days_forward', days);
        localStorage.setItem('flyhigh_report_auto_day', day);
    };

    if (!isOpen) return null;

    // Filter schools
    const today = new Date();
    // Reset time for accurate day comparison
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysForward);

    const filteredSchools = schools.filter(s => {
        if (s.estatus !== 'pendiente') return false;
        const sDate = new Date(s.fecha_programada + 'T12:00:00');
        sDate.setHours(0, 0, 0, 0);
        return sDate >= today && sDate <= endDate;
    }).sort((a, b) => new Date(a.fecha_programada) - new Date(b.fecha_programada));

    const handleDownloadPNG = async () => {
        if (!reportRef.current) return;
        setIsGenerating(true);
        try {
            const htmlToImage = await import('html-to-image');
            const dataUrl = await htmlToImage.toPng(reportRef.current, { 
                pixelRatio: 3,
                backgroundColor: '#ffffff'
            });
            
            const link = document.createElement('a');
            link.download = `Cronograma_Operativo_${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
            
            // Register download to dismiss notification today
            localStorage.setItem('flyhigh_report_last_generated', new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error generating PNG:', error);
            alert('Error generando PNG: ' + (error.message || error));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!reportRef.current) return;
        setIsGenerating(true);
        try {
            const htmlToImage = await import('html-to-image');
            const dataUrl = await htmlToImage.toPng(reportRef.current, { 
                pixelRatio: 3,
                backgroundColor: '#ffffff'
            });
            
            // Calc dimension
            const img = new Image();
            img.src = dataUrl;
            await new Promise(resolve => img.onload = resolve);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (img.height * pdfWidth) / img.width;
            
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Cronograma_Operativo_${new Date().toISOString().split('T')[0]}.pdf`);
            
            // Register download to dismiss notification today
            localStorage.setItem('flyhigh_report_last_generated', new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generando PDF: ' + (error.message || error));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative animate-premium-in border border-slate-200 dark:border-slate-700">
                
                {/* Header Modal */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Calendar className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Generador de Cronograma</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Exporta tu bitácora de misiones para compartir con tu equipo.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
                    
                    {/* Panel de Configuración (Lateral) */}
                    <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 flex flex-col gap-6 shrink-0 md:overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-xs flex items-center gap-2">
                                <Settings size={14} className="text-slate-400" /> Configuración
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Alcance del Reporte (Días)</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="1" max="30" 
                                        value={daysForward} 
                                        onChange={(e) => saveSettings(parseInt(e.target.value), autoDay)}
                                        className="flex-1 accent-indigo-500" 
                                    />
                                    <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md min-w-[3rem] text-center">{daysForward} d</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Día de Generación Sugerida</label>
                                <select 
                                    value={autoDay}
                                    onChange={(e) => saveSettings(daysForward, e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
                                >
                                    <option value="0">Domingo</option>
                                    <option value="1">Lunes</option>
                                    <option value="2">Martes</option>
                                    <option value="3">Miércoles</option>
                                    <option value="4">Jueves</option>
                                    <option value="5">Viernes</option>
                                    <option value="6">Sábado</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1.5 leading-tight">Configura qué día de la semana prefieres hacer tus cortes de operación. Te recordaremos generar este reporte.</p>
                            </div>
                        </div>

                        <div className="mt-auto space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={handleDownloadPNG}
                                disabled={isGenerating || filteredSchools.length === 0}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ImageIcon size={18} /> Descargar PNG
                            </button>
                            <button 
                                onClick={handleDownloadPDF}
                                disabled={isGenerating || filteredSchools.length === 0}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <FileText size={18} /> Descargar PDF
                            </button>
                        </div>
                    </div>

                    {/* Previsualización del Reporte */}
                    <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 md:overflow-y-auto flex items-start justify-center relative min-h-[500px] md:min-h-0">
                        {isGenerating && (
                            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-bold text-indigo-900">Generando documento...</p>
                            </div>
                        )}
                        
                        <div className="transform scale-[0.7] sm:scale-[0.85] md:scale-100 origin-top transition-transform w-full flex justify-center max-w-full overflow-x-auto pb-10 md:pb-0">
                            {/* ESTE ES EL DIV QUE SE CAPTURA (Estilo móvil para compartir fácil en WhatsApp) */}
                            <div 
                                ref={reportRef} 
                                className="w-[400px] shrink-0 bg-white text-slate-800 overflow-hidden shadow-2xl relative"
                                style={{
                                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                                    borderRadius: '32px', // Very rounded like a modern phone screen
                                }}
                            >
                                {/* Header del Reporte */}
                                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 relative overflow-hidden">
                                    {/* Abstract glowing blobs */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
                                    <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none mix-blend-screen" />
                                    
                                    <div className="relative z-10 flex flex-col">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h1 className="text-2xl font-black tracking-tighter text-white leading-[1.1]">
                                                    Campaña <br/>
                                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300">
                                                        Educativa
                                                    </span>
                                                </h1>
                                                <p className="text-xs font-bold text-indigo-200/80 mt-1.5 tracking-wide">
                                                    FlyHigh Edu 2026-2027
                                                </p>
                                            </div>
                                            
                                            <div className="bg-white px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase whitespace-nowrap inline-flex items-center gap-1.5 text-indigo-700 shadow-lg shadow-white/10">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                {filteredSchools.length} Misiones
                                            </div>
                                        </div>
                                        
                                        <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-md shadow-lg shadow-white/10 w-fit">
                                            <Calendar size={13} className="text-indigo-600" /> 
                                            <span className="text-[11px] font-black text-indigo-700 tracking-wide">
                                                Próximos {daysForward} días
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Escuelas */}
                                <div className="p-5 bg-slate-50 min-h-[400px]">
                                    {filteredSchools.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                                            <Calendar size={48} className="opacity-20 mb-3" />
                                            <p className="font-bold">No hay misiones agendadas.</p>
                                            <p className="text-xs">Para el periodo seleccionado.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {filteredSchools.map((school, index) => {
                                                const date = new Date(school.fecha_programada + 'T12:00:00');
                                                const dayName = date.toLocaleDateString('es-MX', { weekday: 'long' });
                                                const dayNum = date.getDate();
                                                const month = date.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase();
                                                
                                                const isMatutino = school.turno === 'Matutino';
                                                
                                                return (
                                                    <div key={index} className="bg-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex gap-4 relative overflow-hidden">
                                                        {/* Borde Izquierdo Color */}
                                                        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isMatutino ? 'bg-blue-400' : 'bg-amber-400'}`} />
                                                        
                                                        {/* Fecha Box */}
                                                        <div className="shrink-0 flex flex-col items-center justify-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 h-fit min-w-[60px]">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{month}</span>
                                                            <span className="text-xl font-black text-slate-800">{dayNum}</span>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase">{dayName.substring(0,3)}</span>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-bold text-slate-800 text-[15px] leading-tight mb-2 truncate pr-2">{school.nombre_escuela}</h3>
                                                            
                                                            <div className="flex flex-col gap-1.5 mt-2">
                                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-bold bg-slate-50 px-2 py-1.5 rounded w-fit border border-slate-100">
                                                                    <Calendar size={12} className="text-indigo-500" />
                                                                    <span className="capitalize">{date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold bg-slate-100/50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                                        <Clock size={12} className={isMatutino ? "text-blue-500" : "text-amber-500"} />
                                                                        <span className="uppercase">{school.turno || 'Pendiente'}</span>
                                                                    </div>
                                                                    <div className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex-1 min-w-[200px]">
                                                                        <MapPin size={12} className="shrink-0 text-rose-500 mt-0.5" />
                                                                        <span className="leading-tight font-medium">{school.colonia || 'Sin dirección'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Footer del reporte */}
                                <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Zap className="text-indigo-400" size={14} />
                                        <h4 className="text-[10px] font-black text-slate-800 tracking-tighter">FLYHIGH OPS</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Documento Oficial</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
