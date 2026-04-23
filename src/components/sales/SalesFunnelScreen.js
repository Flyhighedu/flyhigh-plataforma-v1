'use client';

import React, { useState } from 'react';
import SchoolCombobox from '@/components/admin/SchoolCombobox';
import SubsidyCalculator from './SubsidyCalculator';
import SponsorLegitimacyGrid from './SponsorLegitimacyGrid';
import CalendarAvailabilityPicker from './CalendarAvailabilityPicker';
import { Calendar, School as SchoolIcon, DollarSign, ArrowRight, AlertCircle } from 'lucide-react';

const QUOTAS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

export default function SalesFunnelScreen({ onComplete }) {
    const [school, setSchool] = useState(null);
    const [fecha, setFecha] = useState('');
    const [cuota, setCuota] = useState(50);
    const [isGenerating, setIsGenerating] = useState(false);
    const [catalogoEscuelas, setCatalogoEscuelas] = useState([]);
    const [catalogoLoading, setCatalogoLoading] = useState(false);
    const [occupiedMissions, setOccupiedMissions] = useState([]);

    React.useEffect(() => {
        const fetchData = async () => {
            setCatalogoLoading(true);
            try {
                // Fetch catalog
                const resCat = await fetch('/api/admin/catalogo-escuelas');
                const resultCat = await resCat.json();
                if (resCat.ok) setCatalogoEscuelas(resultCat.data || []);

                // Fetch occupied dates
                const resOcc = await fetch('/api/admin/list-schools');
                const resultOcc = await resOcc.json();
                if (resOcc.ok) setOccupiedMissions(resultOcc.data || []);
            } catch (err) {
                console.error('Error fetching sales data:', err);
            } finally {
                setCatalogoLoading(false);
            }
        };
        fetchData();
    }, []);

    const isBusy = React.useMemo(() => {
        if (!fecha || !school?.turno) return false;
        const selectedShift = school.turno.toLowerCase();
        return occupiedMissions.some(m => {
            const mDate = m.fecha_programada;
            const mShift = m.turno?.toLowerCase() || '';
            // Match date exactly and check if shift overlaps (e.g. "matutino" in both)
            return mDate === fecha && (
                (selectedShift.includes('matutino') && mShift.includes('matutino')) ||
                (selectedShift.includes('vespertino') && mShift.includes('vespertino'))
            );
        });
    }, [fecha, school, occupiedMissions]);

    const handleGenerate = () => {
        if (!school || !fecha || !cuota) return;
        setIsGenerating(true);
        // Simulate a small delay for premium feel
        setTimeout(() => {
            onComplete({
                school,
                fecha,
                cuota,
                subsidio: Math.max(0, 100 - cuota),
                numNinos: school.ninos,
                turno: school.turno,
                cct: school.cct
            });
            setIsGenerating(false);
        }, 800);
    };

    const isReady = school && fecha && cuota;

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col min-h-[80vh] pb-24">
            
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 text-sky-600 mb-4 shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff]">
                    <SchoolIcon size={32} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Simulador de Propuesta</h1>
                <p className="text-sm font-medium text-slate-500 mt-2">Configura la experiencia para la escuela</p>
            </div>

            <div className="space-y-6">
                {/* 1. School Selection */}
                <div className="bg-white/40 backdrop-blur-md rounded-[28px] p-6 shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] border border-white/50 relative z-50">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                        <SchoolIcon size={14} /> 1. Selecciona la Escuela
                    </label>
                    <SchoolCombobox 
                        schools={catalogoEscuelas}
                        loading={catalogoLoading}
                        selectedSchool={school} 
                        onChange={setSchool} 
                        placeholder="Buscar por Nombre o CCT..."
                    />
                    {school && (
                        <div className="mt-4 flex gap-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {school.turno || 'Turno N/A'}
                            </span>
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {school.ninos ? `${school.ninos} Niños aprox.` : 'Niños N/A'}
                            </span>
                        </div>
                    )}
                </div>

                {/* 2. Date Selection (Custom Calendar) */}
                <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-2">
                        <Calendar size={14} /> 2. Fecha Propuesta (Cronograma Real)
                    </label>
                    
                    <CalendarAvailabilityPicker 
                        selectedDate={fecha}
                        onChange={setFecha}
                        occupiedMissions={occupiedMissions}
                    />

                    {isBusy && (
                        <div className="mx-2 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(239,68,68,0.3)]">
                                <AlertCircle size={18} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[11px] font-black text-red-600 uppercase tracking-tight">Turno No Disponible</p>
                                <p className="text-[10px] text-red-500 font-medium">Ya existe una misión agendada para el turno {school?.turno} este día.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Quota Selection */}
                <div className="bg-white/40 backdrop-blur-md rounded-[28px] p-6 shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] border border-white/50 relative z-30">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                        <DollarSign size={14} /> 3. Cuota por Alumno
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                        {QUOTAS.map(q => (
                            <button
                                key={q}
                                onClick={() => setCuota(q)}
                                className={`py-3 rounded-xl font-black text-sm transition-all duration-200 ${
                                    cuota === q 
                                    ? 'bg-sky-500 text-white shadow-[0_4px_12px_rgba(14,165,233,0.4)] scale-105' 
                                    : 'bg-slate-50 text-slate-500 shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:text-sky-600'
                                }`}
                            >
                                ${q}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Calculator & Grid */}
                <SubsidyCalculator 
                    cuota={cuota} 
                    numNinos={school?.ninos} 
                    turno={school?.turno} 
                />

                <SponsorLegitimacyGrid />
            </div>

            {/* Floating Action Button for Next Stage */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-50 pointer-events-none">
                <div className="max-w-lg mx-auto flex justify-end">
                    <button
                        onClick={handleGenerate}
                        disabled={!isReady || isGenerating}
                        className={`pointer-events-auto flex items-center gap-3 px-8 py-4 rounded-full font-black text-white transition-all duration-300 shadow-[0_8px_24px_rgba(14,165,233,0.4)] ${
                            !isReady 
                            ? 'bg-slate-300 shadow-none scale-95 opacity-50 cursor-not-allowed' 
                            : isGenerating
                                ? 'bg-sky-600 scale-95'
                                : 'bg-sky-500 hover:bg-sky-400 hover:scale-105 active:scale-95'
                        }`}
                    >
                        {isGenerating ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin inline-block">⏳</span> Generando...
                            </span>
                        ) : (
                            <>
                                Generar Propuesta <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
