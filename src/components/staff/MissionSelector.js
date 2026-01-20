'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { MapPin, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function MissionSelector({ onSelect }) {
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMissions() {
            setLoading(true);
            const supabase = createClient();

            // Fetch active missions for today or current assignments
            // Assuming a table 'missions' exists. If not, we fall back to placeholders for demo.

            try {
                // Example query: from('missions').select('*').eq('status', 'active')
                // For now, we simulate data to ensure UI works without DB dependencies yet
                await new Promise(resolve => setTimeout(resolve, 800));

                // MOCK DATA
                const mockMissions = [
                    { id: 1, school_name: 'Escuela Primaria Benito Juárez', location: 'Morelia, Centro', date: '2026-01-20' },
                    { id: 2, school_name: 'Colegio Salesiano Anáhuac', location: 'Morelia, Chapultepec', date: '2026-01-20' },
                ];
                setMissions(mockMissions);

            } catch (error) {
                console.error("Error fetching missions", error);
            } finally {
                setLoading(false);
            }
        }

        fetchMissions();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
                <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Misión del Día</h2>
                <p className="text-slate-500">Selecciona la escuela donde operarás hoy.</p>
            </div>

            <div className="space-y-3">
                {missions.map((mission) => (
                    <button
                        key={mission.id}
                        onClick={() => onSelect(mission)}
                        className="w-full flex items-center justify-between p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50 transition-all group"
                    >
                        <div className="text-left space-y-1">
                            <h3 className="font-bold text-slate-800 group-hover:text-blue-700">{mission.school_name}</h3>
                            <div className="flex items-center text-xs text-slate-500 gap-3">
                                <span className="flex items-center gap-1"><MapPin size={12} /> {mission.location}</span>
                                <span className="flex items-center gap-1"><Calendar size={12} /> Hoy</span>
                            </div>
                        </div>
                        <div className="text-slate-300 group-hover:text-blue-500">
                            <ArrowRight />
                        </div>
                    </button>
                ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-sm text-amber-800">
                <CheckCircle2 className="flex-shrink-0 text-amber-600" size={18} />
                <p>Verifica que tienes el material completo antes de iniciar.</p>
            </div>
        </div>
    );
}
