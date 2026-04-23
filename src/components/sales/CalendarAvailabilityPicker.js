'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * CalendarAvailabilityPicker
 * A premium neumorphic calendar that shows mission availability.
 */
export default function CalendarAvailabilityPicker({ selectedDate, onChange, occupiedMissions = [] }) {
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // Generate days for the current view
    const daysInMonth = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const days = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        const result = [];
        // Padding for the first week
        for (let i = 0; i < firstDay; i++) {
            result.push({ day: null, dateStr: null });
        }
        
        for (let d = 1; d <= days; d++) {
            const date = new Date(currentYear, currentMonth, d);
            // Format to YYYY-MM-DD local style (compensating timezone)
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            // Check availability
            const dayMissions = occupiedMissions.filter(m => m.fecha_programada === dateStr);
            const isFull = dayMissions.length >= 2;
            const hasMatutino = dayMissions.some(m => m.turno?.toLowerCase().includes('matutino'));
            const hasVespertino = dayMissions.some(m => m.turno?.toLowerCase().includes('vespertino'));
            
            result.push({ 
                day: d, 
                dateStr,
                missions: dayMissions.length,
                hasMatutino,
                hasVespertino,
                isFull,
                isToday: new Date().toDateString() === date.toDateString()
            });
        }
        return result;
    }, [currentMonth, currentYear, occupiedMissions]);

    const handlePrev = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNext = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    return (
        <div className="w-full bg-white/40 backdrop-blur-md rounded-[28px] p-5 shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] border border-white/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shadow-sm">
                        <CalendarIcon size={16} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                        {MONTHS[currentMonth]} {currentYear}
                    </h3>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handlePrev}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] transition-all text-slate-500"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button 
                        onClick={handleNext}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] transition-all text-slate-500"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Days Weekday Legend */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-2">
                {daysInMonth.map((item, idx) => {
                    if (!item.day) return <div key={`empty-${idx}`} />;
                    
                    const isSelected = selectedDate === item.dateStr;
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isPast = item.dateStr < todayStr;
                    
                    // Dynamic styling based on status
                    let statusClasses = '';
                    let isStrikeThrough = false;
                    
                    if (isPast) {
                        statusClasses = 'bg-transparent text-slate-300 pointer-events-none';
                    } else if (isSelected) {
                        statusClasses = 'bg-sky-600 text-white shadow-[0_8px_16px_rgba(2,132,199,0.5)] scale-110 z-10 ring-4 ring-sky-200';
                    } else if (item.isFull) {
                        statusClasses = 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60';
                        isStrikeThrough = true;
                    } else if (item.missions === 1) {
                        // 1 Turno
                        statusClasses = 'bg-orange-500 text-white shadow-md hover:bg-orange-400';
                    } else {
                        // Libre
                        statusClasses = 'bg-emerald-500 text-white shadow-md hover:bg-emerald-400';
                    }
                    
                    return (
                        <button
                            key={item.dateStr}
                            onClick={() => onChange(item.dateStr)}
                            disabled={(item.isFull || isPast) && !isSelected}
                            className={`
                                relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-300
                                ${statusClasses}
                                ${!isSelected && !isPast && !item.isFull ? 'hover:scale-105 active:scale-95' : ''}
                                ${item.isToday && !isSelected && !isPast ? 'ring-2 ring-slate-800 ring-offset-2' : ''}
                            `}
                        >
                            <span className={`text-sm font-black ${isStrikeThrough ? 'line-through decoration-2' : ''}`}>
                                {item.day}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Legend - Foolproof */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-md bg-emerald-500 shadow-sm" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Totalmente Libre</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-md bg-orange-500 shadow-sm" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">1 Turno Disponible</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-md bg-slate-200 flex items-center justify-center">
                            <span className="text-[8px] line-through text-slate-400 font-bold">X</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Lleno (No Disponible)</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
                    <Info size={10} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Sincronizado</span>
                </div>
            </div>
        </div>
    );
}
