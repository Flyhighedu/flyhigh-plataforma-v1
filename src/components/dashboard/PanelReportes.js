"use client";

import { useState, useRef, useEffect } from 'react';

// Custom MROG100% Period Selector inside Dossier
function DossierPeriodSelector({ filter, setFilter }) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState('mes'); // mes, semana, dia
    
    // Quick action: This week
    const applyThisWeek = () => {
        const now = new Date();
        const start = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        const end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
        setFilter({ type: 'custom', start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
        setIsOpen(false);
    };

    const handleApply = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const val = fd.get('dateval');
        if (!val) return;
        
        if (mode === 'dia') {
            setFilter({ type: 'custom', start: val, end: val });
        } else if (mode === 'mes') {
            const [y, m] = val.split('-');
            setFilter({ type: 'month', year: parseInt(y), month: parseInt(m) });
        } else if (mode === 'semana') {
            const [y, w] = val.split('-W');
            const simple = new Date(y, 0, 1 + (w - 1) * 7);
            const dow = simple.getDay();
            const start = simple;
            if (dow <= 4) start.setDate(simple.getDate() - simple.getDay() + 1);
            else start.setDate(simple.getDate() + 8 - simple.getDay());
            
            const startStr = start.toISOString().slice(0, 10);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            const endStr = end.toISOString().slice(0, 10);
            setFilter({ type: 'custom', start: startStr, end: endStr });
        }
        setIsOpen(false);
    };

    const triggerLabel = () => {
        if (filter.type === 'month') return `Mes: ${filter.year}-${String(filter.month).padStart(2, '0')}`;
        if (filter.type === 'custom') {
            if (filter.start === filter.end) return `Día: ${filter.start}`;
            return `${filter.start} al ${filter.end}`;
        }
        if (filter.type === 'all') return 'Histórico Global';
        return 'Seleccionar Fecha...';
    };

    return (
        <div className="relative mb-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                Filtro de Tiempo
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-primary bg-primary/5 text-sm font-black text-primary hover:bg-primary/10 transition-colors shadow-sm"
            >
                <div>
                    {triggerLabel()}
                </div>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-4">
                    <div className="space-y-4">
                        <button onClick={applyThisWeek} className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            Última Semana (Actual)
                        </button>
                        
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-2">
                            <div className="grid grid-cols-3 gap-1 mb-3 bg-gray-200/50 p-1 rounded-lg">
                                <button onClick={() => setMode('mes')} className={`py-1.5 text-xs font-bold rounded-md transition-colors ${mode==='mes'?'bg-white text-black shadow-sm':'text-gray-500 hover:text-gray-800'}`}>Mes</button>
                                <button onClick={() => setMode('semana')} className={`py-1.5 text-xs font-bold rounded-md transition-colors ${mode==='semana'?'bg-white text-black shadow-sm':'text-gray-500 hover:text-gray-800'}`}>Semana</button>
                                <button onClick={() => setMode('dia')} className={`py-1.5 text-xs font-bold rounded-md transition-colors ${mode==='dia'?'bg-white text-black shadow-sm':'text-gray-500 hover:text-gray-800'}`}>Día</button>
                            </div>
                            
                            <form onSubmit={handleApply} className="flex flex-col gap-3">
                                {mode === 'mes' && <input type="month" name="dateval" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary" required />}
                                {mode === 'semana' && <input type="week" name="dateval" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary" required />}
                                {mode === 'dia' && <input type="date" name="dateval" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary" required />}
                                <button type="submit" className="w-full bg-gray-200 hover:bg-gray-300 text-black py-2 rounded-lg text-xs font-bold transition-colors">Aplicar Selección</button>
                            </form>
                        </div>
                        
                        <button onClick={() => { setFilter({ type: 'all' }); setIsOpen(false); }} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl text-xs font-bold transition-colors">Ver Todo el Histórico</button>
                    </div>
                </div>
            )}
        </div>
    );
}


export default function PanelReportes({ data, filter, setFilter, loading }) {
    const [selectedSponsor, setSelectedSponsor] = useState('all');
    const [showFinances, setShowFinances] = useState(true);
    const [showOperation, setShowOperation] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const [editableData, setEditableData] = useState(null);

    useEffect(() => {
        if (data) {
            let initialTotalBecados = data.impacto?.totalBecados || 0;
            const schoolsInit = (data.impacto?.schoolTotals || []).map(s => {
                // If becados is 0 (from old DB records without the column), fallback to 40%
                const ab = s.becados > 0 ? s.becados : Math.floor(s.students * 0.4);
                // If flights is 0 (old DB without tracking), assume roughly 5 kids per flight
                const flights = s.flights > 0 ? s.flights : Math.ceil(s.students / 5);
                
                return {
                    ...s,
                    flights: flights,
                    becados: ab,
                    investment: ab * 450
                };
            });
            
            // Fallback estimation
            if (initialTotalBecados === 0) {
                initialTotalBecados = schoolsInit.reduce((sum, s) => sum + s.becados, 0);
            }
            
            const targetTotalImpact = data.impacto?.totalStudents || 0;

            setEditableData({
                totalImpacted: targetTotalImpact,
                totalEscuelas: schoolsInit.length,
                subsidioConsumido: initialTotalBecados * 450,
                totalBecados: initialTotalBecados,
                aportacionSimbolica: Math.max(0, targetTotalImpact - initialTotalBecados),
                totalFlights: data.impacto?.totalFlights || schoolsInit.reduce((sum, s) => sum + s.flights, 0),
                avgStudentsPerHour: data.operacion?.avgStudentsPerHour 

                    ? Math.round(data.operacion.avgStudentsPerHour / (data.operacion.avgStudentsPerFlight || 1)) 
                    : 0,
                puntualidad: 94,
                schools: schoolsInit
            });
        }
    }, [data]);

    const handleGlobalEdit = (field, textValue) => {
        if (!editableData) return;
        
        let value;
        if (field === 'puntualidad') {
            value = parseFloat(textValue.replace(/[^0-9.]/g, '')) || 0;
        } else {
            value = parseInt(textValue.replace(/[^0-9-]/g, '')) || 0;
        }

        setEditableData(prev => {
            const next = { ...prev, [field]: value };
            
            if (field === 'totalImpacted' || field === 'totalBecados') {
                next.aportacionSimbolica = Math.max(0, next.totalImpacted - next.totalBecados);
                if (field === 'totalBecados') {
                    next.subsidioConsumido = next.totalBecados * 450;
                }
            }
            return next;
        });
    };

    const handleSchoolEdit = (idx, field, textValue) => {
        if (!editableData) return;
        
        setEditableData(prev => {
            const nextSchools = [...prev.schools];
            const oldRow = nextSchools[idx];
            let nextRow = { ...oldRow };
            
            if (field === 'name') {
                nextRow.name = textValue.trim();
            } else {
                nextRow[field] = parseInt(textValue.replace(/[^0-9-]/g, '')) || 0;
            }

            const nextState = { ...prev, schools: nextSchools };

            if (field === 'becados') {
                nextRow.investment = nextRow.becados * 450;
                const diffBecados = nextRow.becados - oldRow.becados;
                nextState.totalBecados = prev.totalBecados + diffBecados;
                nextState.subsidioConsumido = nextState.totalBecados * 450;
                nextState.aportacionSimbolica = Math.max(0, nextState.totalImpacted - nextState.totalBecados);
            }
            if (field === 'students') {
                const diffStudents = nextRow.students - oldRow.students;
                nextState.totalImpacted = prev.totalImpacted + diffStudents;
                nextState.aportacionSimbolica = Math.max(0, nextState.totalImpacted - nextState.totalBecados);
            }
            if (field === 'investment') {
                // Permit custom manual investment per school, detaching it from normal 450 multiplier
                const diffInvestment = nextRow.investment - oldRow.investment;
                nextState.subsidioConsumido = prev.subsidioConsumido + diffInvestment;
            }

            nextSchools[idx] = nextRow;
            return nextState;
        });
    };

    const reportRef = useRef(null);

    if (!editableData) return null;

    const sponsors = data.patrocinios?.sponsors || [];

    const getReportDateLabel = () => {
        if (filter.type === 'month') return `MES: ${filter.year}-${String(filter.month).padStart(2, '0')}`;
        if (filter.type === 'custom') return `FECHAS: ${filter.start} A ${filter.end}`;
        return 'REPORTE GLOBAL HISTÓRICO';
    };

    const handlePrint = () => {
        window.print();
    };

    // --- PAGINATION LOGIC ---
    const allSchools = editableData.schools;
    // La primera hoja aguanta exactamente 5 escuelas junto con los gráficos gigantes sin romperse en el physical print
    const firstPageSchools = allSchools.slice(0, 5);
    // Las hojas extras aguantan 16 escuelas completas
    const remainingSchools = allSchools.slice(5);
    const extraPages = [];
    for (let i = 0; i < remainingSchools.length; i += 16) {
        extraPages.push(remainingSchools.slice(i, i + 16));
    }

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        try {
            const { toJpeg } = await import('html-to-image');
            const { jsPDF } = await import('jspdf');

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Select all physical pages rendered natively on screen
            const pages = document.querySelectorAll('.print-area-wrapper .pdf-page');
            
            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i];
                
                // Usar html-to-image que soporta colores CSS modernos (oklch, lab de Tailwind v4)
                const imgData = await toJpeg(pageEl, {
                    quality: 1,
                    pixelRatio: 2,
                    backgroundColor: '#ffffff',
                    fontParsingErrorLogger: () => {} // Evita que Next.js lance un overlay rojo al atrapar el console.error interno de html-to-image
                });
                
                // A4 dimensions in mm: 210 x 297
                const pdfWidth = 210;
                // Calculamos el alto para no deformar la imagen
                // Como html-to-image usa el tamaño exacto del DOM, tomamos las medidas del nodo
                const rect = pageEl.getBoundingClientRect();
                const pdfHeight = (rect.height * pdfWidth) / rect.width;
                
                if (i > 0) {
                    pdf.addPage();
                }
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }
            
            const filenameDate = filter.type === 'custom' 
                ? `${filter.start}_al_${filter.end}` 
                : `${filter.year}_${filter.month}`;

            pdf.save(`Reporte_Impacto_${filenameDate}.pdf`);
        } catch (error) {
            console.error('Error html2canvas/jspdf:', error);
            alert('Falló: ' + error.message);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    return (
        <div className="grid grid-cols-12 gap-8 h-[calc(100vh-120px)] relative">
            
            {/* ── LEFT RAIL: Controls ── */}
            <div className="col-span-12 xl:col-span-3 flex flex-col gap-6 hide-on-print overflow-y-auto pr-2 pb-10">
                <div className="neu-list-item p-6">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        Estudio de Dossier
                    </h3>
                    
                    <DossierPeriodSelector filter={filter} setFilter={setFilter} />

                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Dirigido A</label>
                            <select 
                                value={selectedSponsor} 
                                onChange={(e) => setSelectedSponsor(e.target.value)}
                                className="w-full bg-white dark:bg-black border-2 border-border rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-0 focus:border-primary outline-none transition-colors"
                            >
                                <option value="all">Fondo General</option>
                                {sponsors.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <hr className="border-border" />

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Composición Opcional</label>
                            
                            <label className="flex items-center justify-between mb-4 cursor-pointer group">
                                <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Datos Financieros</span>
                                <input type="checkbox" className="sr-only peer" checked={showFinances} onChange={() => setShowFinances(!showFinances)} />
                                <div className="w-10 h-6 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full relative"></div>
                            </label>

                            <label className="flex items-center justify-between cursor-pointer group">
                                <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Excelencia Operativa</span>
                                <input type="checkbox" className="sr-only peer" checked={showOperation} onChange={() => setShowOperation(!showOperation)} />
                                <div className="w-10 h-6 bg-border rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full relative"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-4">
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className={`w-full bg-primary text-primary-foreground py-4 rounded-xl font-black text-sm shadow-xl hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 ${isGeneratingPDF ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isGeneratingPDF ? (
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        )}
                        {isGeneratingPDF ? 'DIBUJANDO PDF...' : 'DESCARGAR PDF'}
                    </button>
                    
                    <button 
                        onClick={handlePrint}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-sm shadow-xl hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir Alta Calidad
                    </button>
                </div>
            </div>

            {/* ── RIGHT RAIL: The A4 Pages Container ── */}
            <div className="print-area-wrapper col-span-12 xl:col-span-9 bg-[#e8eaed] dark:bg-[#1a1c1e] rounded-3xl p-8 flex flex-col items-center overflow-y-auto gap-8 shadow-inner">
                
                {/* PAGE 1 */}
                <div className="pdf-page bg-white text-black w-full max-w-[850px] shadow-2xl rounded-sm p-14 relative overflow-hidden" style={{ minHeight: '1202px' }}>
                    
                    {/* Watermark / Decor */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-[100px] pointer-events-none"></div>

                    {/* Header */}
                    <div className="flex justify-between items-end border-b-[5px] border-black pb-5 mb-10 relative z-10">
                        <div>
                            <h1 className="text-[42px] font-black uppercase tracking-tighter text-gray-900 leading-none outline-none" contentEditable suppressContentEditableWarning>Impact Dossier</h1>
                            <p className="text-sm font-extrabold text-primary mt-2 uppercase tracking-[0.2em] outline-none" contentEditable suppressContentEditableWarning>{getReportDateLabel()}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-black text-gray-900 outline-none" contentEditable suppressContentEditableWarning>
                                {selectedSponsor === 'all' ? 'REPORTE GLOBAL' : sponsors.find(s => s.id === selectedSponsor)?.name?.toUpperCase()}
                            </h2>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest outline-none" contentEditable suppressContentEditableWarning>Fly High Org.</p>
                        </div>
                    </div>

                    {/* Executive Summary (Three massive numbers) */}
                    <div className="grid grid-cols-3 gap-6 mb-12">
                        <div className="bg-pink-600 p-6 pt-12 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-end text-white" style={{ containerType: 'inline-size' }}>
                            <div className="absolute top-5 right-5 text-white pointer-events-none">
                                <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                                </svg>
                            </div>
                            <p className="text-[10px] font-black text-pink-200 uppercase tracking-[0.15em] mb-2 relative z-10" contentEditable suppressContentEditableWarning>Total Alumnos</p>
                            <p className="font-black tracking-tighter relative z-10 outline-none break-words leading-none" style={{ fontSize: 'clamp(1.5rem, 12cqi, 40px)' }} contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('totalImpacted', e.target.innerText)}>{editableData.totalImpacted.toLocaleString()}</p>
                        </div>
                        <div className="bg-orange-500 p-6 pt-12 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-end text-white" style={{ containerType: 'inline-size' }}>
                            <div className="absolute top-5 right-5 text-white pointer-events-none">
                                <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 3L1 9h2v12h5v-5h8v5h5V9h2L12 3zm0 2.15l5.5 3.35H6.5L12 5.15zM12 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                            </div>
                            <p className="text-[10px] font-black text-orange-200 uppercase tracking-[0.15em] mb-2 relative z-10" contentEditable suppressContentEditableWarning>Escuelas Visitadas</p>
                            <p className="font-black tracking-tighter relative z-10 outline-none break-words leading-none" style={{ fontSize: 'clamp(1.5rem, 12cqi, 40px)' }} contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('totalEscuelas', e.target.innerText)}>{editableData.totalEscuelas}</p>
                        </div>
                        <div className="bg-emerald-500 p-6 pt-12 rounded-3xl shadow-lg relative overflow-hidden text-white flex flex-col justify-end" style={{ containerType: 'inline-size' }}>
                            <div className="absolute top-5 right-5 text-white pointer-events-none">
                                <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7l10 15 10-15L12 2zm0 2.8L18.4 7H5.6L12 4.8zm-1.8 3.5v9l-5.6-8.4h5.6zm3.6 0h5.6l-5.6 8.4v-9zm-1.8 10L9.4 9h5.2l-2.6 9.3z"/>
                                </svg>
                            </div>
                            <p className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.15em] mb-2 relative z-10" contentEditable suppressContentEditableWarning>Subsidio Ejecutado</p>
                            <p className="font-black tracking-tighter relative z-10 outline-none break-words leading-none" style={{ fontSize: 'clamp(1rem, 12cqi, 40px)' }} contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('subsidioConsumido', e.target.innerText)}>${Math.round(editableData.subsidioConsumido).toLocaleString('en-US')}</p>
                        </div>
                    </div>

                    {/* Content Rules: Dynamic Modules */}
                    <div className={`grid ${showOperation ? 'grid-cols-2' : 'grid-cols-1'} gap-10 mb-12`}>
                        
                        {/* Module: Distribución Sociológica */}
                        <div>
                            <h3 className="text-[15px] font-black text-gray-900 uppercase tracking-widest border-b-[3px] border-gray-200 pb-2 mb-6 outline-none" contentEditable suppressContentEditableWarning>Alcance Demográfico</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[13px] font-bold text-gray-600 outline-none" contentEditable suppressContentEditableWarning>Becados (Fondo)</span>
                                        <span className="text-xl font-black text-gray-900 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('totalBecados', e.target.innerText)}>{editableData.totalBecados.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div className="bg-blue-600 h-3 rounded-full shadow-inner transition-all duration-500" style={{ width: `${Math.min(100, (editableData.totalBecados/editableData.totalImpacted)*100 || 0)}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[13px] font-bold text-gray-600 outline-none" contentEditable suppressContentEditableWarning>Aportación Simbólica</span>
                                        <span className="text-xl font-black text-gray-900 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('aportacionSimbolica', e.target.innerText)}>{editableData.aportacionSimbolica.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div className="bg-amber-500 h-3 rounded-full shadow-inner transition-all duration-500" style={{ width: `${Math.min(100, (editableData.aportacionSimbolica/editableData.totalImpacted)*100 || 0)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Module: Excelencia Operativa */}
                        {showOperation && (
                            <div>
                                <h3 className="text-[15px] font-black text-gray-900 uppercase tracking-widest border-b-[3px] border-gray-200 pb-2 mb-6 outline-none" contentEditable suppressContentEditableWarning>Rendimiento Operativo</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 outline-none" contentEditable suppressContentEditableWarning>Vuelos</p>
                                        <p className="text-3xl font-black text-gray-900 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('totalFlights', e.target.innerText)}>{editableData.totalFlights}</p>
                                    </div>
                                    <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 outline-none" contentEditable suppressContentEditableWarning>Cadencia</p>
                                        <p className="text-3xl font-black text-gray-900 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('avgStudentsPerHour', e.target.innerText)}>{editableData.avgStudentsPerHour} <span className="text-sm font-bold text-gray-400" contentEditable={false}>/hr</span></p>
                                    </div>
                                    <div className="col-span-2 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex justify-between items-center">
                                        <p className="text-[12px] font-black text-indigo-900 uppercase tracking-widest outline-none" contentEditable suppressContentEditableWarning>Puntualidad en Logística</p>
                                        <p className="text-3xl font-black text-indigo-700 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleGlobalEdit('puntualidad', e.target.innerText)}>{editableData.puntualidad}%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Module: Desglose por Escuela (Tabla Financiera PENDIENTE PÁGINA 1) */}
                    <div className="flex-1">
                        <h3 className="text-[15px] font-black text-gray-900 uppercase tracking-widest border-b-[3px] border-black pb-2 mb-4 outline-none" contentEditable suppressContentEditableWarning>Resumen Escolar: Hoja 1</h3>
                        
                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-3 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-300 pb-3 mb-3">
                                <div className="col-span-1 text-center">No.</div>
                                <div className="col-span-5">Institución</div>
                                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                    <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
                                    Vuelos
                                </div>
                                <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                    <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                    Impacto
                                </div>
                                {showFinances && <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                                    Inversión
                                </div>}
                            </div>
                            
                            <div className="space-y-0.5">
                                {firstPageSchools.map((escuela, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-3 py-3 text-[13px] border-b border-dashed border-gray-200 items-center hover:bg-gray-50 transition-colors">
                                        <div className="col-span-1 text-center font-bold text-gray-400">{idx + 1}</div>
                                        <div className="col-span-5 font-black text-gray-800 truncate pr-2 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(idx, 'name', e.target.innerText)}>{escuela.name}</div>
                                        <div className="col-span-2 text-center font-bold text-gray-600 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(idx, 'flights', e.target.innerText)}>{escuela.flights}</div>
                                        <div className="col-span-2 text-right font-bold text-gray-800 flex items-center justify-end gap-1">
                                            <span className="outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(idx, 'students', e.target.innerText)}>{escuela.students}</span>
                                            <span className="text-[10px] text-gray-500 font-bold ml-0.5 lowercase" contentEditable={false}>niños</span>
                                        </div>
                                        {showFinances && (
                                            <div className="col-span-2 text-right font-black text-emerald-600 outline-none flex items-center justify-end" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(idx, 'investment', e.target.innerText)}>
                                                ${escuela.investment.toLocaleString('en-US')}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {firstPageSchools.length === 0 && <p className="text-gray-400 text-sm text-center py-10 font-medium">No hay registros en este periodo.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- EXTRA PAGES IF LIST EXCEEDS MAX SCHOOLS --- */}
                {extraPages.map((pageSchools, pIndex) => (
                    <div key={pIndex} className="pdf-page bg-white text-black w-full max-w-[850px] shadow-2xl rounded-sm p-14 relative overflow-hidden" style={{ minHeight: '1202px' }}>
                        {/* Compact Header for Extra Pages */}
                        <div className="flex justify-between items-end border-b-[3px] border-black pb-4 mb-8 relative z-10">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-tighter text-gray-900 outline-none" contentEditable suppressContentEditableWarning>Resumen Escolar ({pIndex + 2})</h1>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{getReportDateLabel()}</p>
                            </div>
                        </div>

                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-3 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-300 pb-3 mb-3">
                                <div className="col-span-1 text-center">No.</div>
                                <div className="col-span-5">Institución</div>
                                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                    <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
                                    Vuelos
                                </div>
                                <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                    <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                    Impacto
                                </div>
                                {showFinances && <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                                    Inversión
                                </div>}
                            </div>
                            
                            <div className="space-y-0.5">
                                {pageSchools.map((escuela, idx) => {
                                    const absoluteIdx = (pIndex * 16) + 5 + idx;
                                    return (
                                        <div key={idx} className="grid grid-cols-12 gap-3 py-3 text-[13px] border-b border-dashed border-gray-200 items-center hover:bg-gray-50 transition-colors">
                                            <div className="col-span-1 text-center font-bold text-gray-400">{absoluteIdx + 1}</div>
                                            <div className="col-span-5 font-black text-gray-800 truncate pr-2 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(absoluteIdx, 'name', e.target.innerText)}>{escuela.name}</div>
                                            <div className="col-span-2 text-center font-bold text-gray-600 outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(absoluteIdx, 'flights', e.target.innerText)}>{escuela.flights}</div>
                                            <div className="col-span-2 text-right font-bold text-gray-800 flex items-center justify-end gap-1">
                                                <span className="outline-none" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(absoluteIdx, 'students', e.target.innerText)}>{escuela.students}</span>
                                                <span className="text-[10px] text-gray-500 font-bold ml-0.5 lowercase" contentEditable={false}>niños</span>
                                            </div>
                                            {showFinances && (
                                                <div className="col-span-2 text-right font-black text-emerald-600 outline-none flex items-center justify-end" contentEditable suppressContentEditableWarning onBlur={(e) => handleSchoolEdit(absoluteIdx, 'investment', e.target.innerText)}>
                                                    ${escuela.investment.toLocaleString('en-US')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer on last page */}
                        {pIndex === extraPages.length - 1 && (
                            <div className="mt-auto pt-8 border-t border-gray-200 text-center w-full">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest outline-none" contentEditable suppressContentEditableWarning>Reporte Analítico Oficial - FlyHigh Intelligence</p>
                                <p className="text-[9px] text-gray-300 mt-1 uppercase">Impreso por sistema el {new Date().toLocaleDateString('es-MX')}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Print CSS Injection */}
            <style dangerouslySetInnerHTML={{__html: `
                .pdf-page {
                    font-family: 'Inter', sans-serif;
                }

                @media print {
                    /* Forzar que los colores de fondo y bordes (rosas, naranjas, degradados) se impriman siempre */
                    html, body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        background: white !important;
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    /* Ocultar elementos de UI globales (como un sidebar principal o navbar) */
                    nav, header, aside, [role="navigation"] {
                        display: none !important;
                    }

                    /* Quitar scrolls que mutilan la impresión */
                    * {
                        overflow: visible !important;
                        height: auto !important;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .hide-on-print {
                        display: none !important;
                    }

                    .pdf-page, .pdf-page * {
                        visibility: visible;
                    }

                    /* 
                       Desenganchamos por completo el wrapper padre de la maqueta principal 
                       para que ocupe todo el espacio y no comprima a sus hijos.
                    */
                    .print-area-wrapper {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        min-width: 790px !important;
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: transparent !important;
                        visibility: visible !important;
                    }

                    .pdf-page {
                        position: relative !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: auto !important; /* Elimina la altura forzada de 1200px para que no brinque una página en blanco entera */
                        height: auto !important;
                        margin: 0 auto !important;
                        padding: 10mm 15mm !important;
                        box-shadow: none !important;
                        border: none !important;
                        page-break-after: always !important;
                        transform: none !important;
                    }

                    /* Forzar que las grillas de Tailwind no se colapsen a textos verticales */
                    .grid {
                        display: grid !important;
                    }

                    /* Última página no requiere salto de línea forzoso */
                    .pdf-page:last-child {
                        page-break-after: auto !important;
                    }

                    @page {
                        margin: 0; /* Controlamos márgenes desde .pdf-page en vez de @page para evitar recortes raros */
                        size: auto;
                    }
                }
            `}} />
        </div>
    );
}
