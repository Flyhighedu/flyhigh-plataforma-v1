'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Calendar, MapPin, ChevronRight, FileText, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DailyImpactReport from '@/components/staff/DailyImpactReport';

export default function HistoryPage() {
    const router = useRouter();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMission, setSelectedMission] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            const supabase = createClient();

            // Fetch closures
            const { data: closures, error } = await supabase
                .from('cierres_mision')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching history:", error);
                setLoading(false);
                return;
            }

            // Fetch school names for these missions
            // We can do this efficiently by getting all unique mission_ids (which should map to schools?)
            // Actually, in our schema: mission_id usually links to 'proximas_escuelas.id'

            const missionIds = closures.map(c => c.mission_id);
            const { data: schools } = await supabase
                .from('proximas_escuelas')
                .select('id, school_name')
                .in('id', missionIds);

            const schoolMap = {};
            schools?.forEach(s => {
                schoolMap[s.id] = s.school_name;
            });

            const enrichedHistory = closures.map(c => ({
                ...c,
                schoolName: schoolMap[c.mission_id] || 'Escuela Desconocida / Borrada',
                date: new Date(c.created_at).toLocaleDateString(),
                time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            setHistory(enrichedHistory);
            setLoading(false);
        };

        fetchHistory();
    }, []);

    const filteredHistory = history.filter(h =>
        h.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.date.includes(searchTerm)
    );

    if (selectedMission) {
        return (
            <div className="min-h-screen bg-slate-100">
                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                    <button onClick={() => setSelectedMission(null)} className="p-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <span className="font-bold text-slate-800">Volver al Historial</span>
                </div>
                <div className="p-4">
                    <DailyImpactReport
                        missionId={selectedMission}
                        onExit={() => setSelectedMission(null)}
                        allowDelete={false}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 animate-in fade-in duration-500">
            {/* Header */}
            <div className="sticky top-0 bg-white z-10 border-b border-slate-200 px-6 py-4 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.push('/staff/dashboard')} className="p-2 -ml-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <h1 className="text-xl font-black text-slate-900">Historial de Misiones</h1>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por escuela o fecha..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">Cargando historial...</div>
                ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">No se encontraron misiones.</div>
                ) : (
                    filteredHistory.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedMission(item.mission_id)}
                            className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <Calendar size={12} /> {item.date} • {item.time}
                                </div>
                                <div className="bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 p-1.5 rounded-full transition-colors">
                                    <ChevronRight size={16} />
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 mb-1 leading-tight">{item.schoolName}</h3>

                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-3">
                                <div className="flex items-center gap-1.5">
                                    <FileText size={14} />
                                    <span className="font-bold text-slate-700">{item.total_flights || 0}</span> Vuelos
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    <span className="font-bold text-slate-700">{item.total_students || 0}</span> Alumnos
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
