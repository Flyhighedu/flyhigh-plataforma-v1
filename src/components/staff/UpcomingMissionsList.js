'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, MapPin, AlertCircle, School } from 'lucide-react';

export default function UpcomingMissionsList() {
    const [missions, setMissions] = useState(null);

    useEffect(() => {
        const fetchUpcoming = async () => {
            try {
                const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
                now.setHours(0,0,0,0);
                const isoToday = now.toISOString().split('T')[0];
                
                const supabase = createClient();
                const { data } = await supabase
                    .from('proximas_escuelas')
                    .select('id, fecha_programada') // Secure, anonymized
                    .gt('fecha_programada', isoToday)
                    .eq('estatus', 'pendiente')
                    .order('fecha_programada', { ascending: true })
                    .limit(5);
                
                setMissions(data || []);
            } catch (e) {
                console.error('Error fetching upcoming missions', e);
                setMissions([]);
            }
        };
        fetchUpcoming();
    }, []);

    if (missions === null) {
        return (
            <div className="w-full flex justify-center py-12">
                <RefreshCw className="animate-spin text-slate-300" size={24} />
            </div>
        );
    }

    if (missions.length === 0) {
        return (
            <div className="w-full text-center py-10 px-6 bg-slate-50/80 rounded-[2rem] border border-slate-100 shadow-[inset_0_2px_10px_rgb(0,0,0,0.02)] relative overflow-hidden transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-200/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-100/20 rounded-full blur-3xl pointer-events-none"></div>
                
                <h3 className="text-slate-400 font-extrabold tracking-tight mb-2 text-sm z-10 relative">Despejado</h3>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed z-10 relative">No hay misiones programadas registradas en el futuro cercano.</p>
            </div>
        );
    }

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day);
    };

    const getDayName = (date) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()];
    const getMonthName = (date) => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][date.getMonth()];

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 pb-2">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   <School size={14} className="text-slate-300" /> Próximas Misiones
                </h3>
                <span className="bg-slate-200 text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-full">{missions.length} RESERVADAS</span>
            </div>
            
            <div className="flex flex-col gap-3 w-full relative">
                {missions.map((m, idx) => {
                    const isNext = idx === 0;
                    const dateObj = parseLocalDate(m.fecha_programada);
                    
                    return (
                        <div key={m.id} className={'relative bg-white rounded-[22px] p-4 flex items-center gap-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ' + (isNext ? 'border-2 border-blue-600 shadow-[0_12px_30px_rgba(37,99,235,0.12)]' : 'border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]')}>
                            
                            {/* Icon Box */}
                            <div className={'w-12 h-12 shrink-0 rounded-[14px] flex items-center justify-center transition-all ' + (isNext ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-50 text-slate-300 border border-slate-100')}>
                                <div className="relative">
                                    <MapPin size={22} className={!isNext ? 'opacity-80' : ''}/>
                                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                                        <AlertCircle size={10} className={isNext ? "text-blue-500" : "text-slate-400"} />
                                    </div>
                                </div>
                            </div>

                            {/* Info Anonima */}
                            <div className="flex-1 min-w-0">
                                <h4 className={'font-extrabold text-[15px] truncate tracking-tight ' + (isNext ? 'text-slate-900' : 'text-slate-600')}>
                                    Misión Reservada
                                </h4>
                                <p className="text-slate-400 text-xs mt-0.5 font-semibold flex items-center gap-1.5">
                                    <span className={"w-1.5 h-1.5 rounded-full relative " + (isNext ? 'bg-blue-500' : 'bg-slate-300')}><span className={"absolute inset-0 rounded-full animate-ping opacity-50 " + (isNext ? 'bg-blue-500' : 'bg-slate-300')}></span></span> 
                                    Ubicación protegida
                                </p>
                            </div>

                            {/* Neumorphic Date Badge */}
                            <div className={'shrink-0 flex flex-col items-center justify-center min-w-[3.5rem] py-2 px-2 rounded-[14px] transition-all ' + (isNext ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.2)]' : 'bg-slate-50 border border-slate-100 text-slate-400')}>
                                <span className="text-[9px] font-black uppercase tracking-widest">{getMonthName(dateObj)}</span>
                                <span className="leading-none text-xl font-black my-1">{dateObj.getDate()}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest">{getDayName(dateObj)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
