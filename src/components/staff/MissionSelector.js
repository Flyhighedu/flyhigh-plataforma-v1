'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { MapPin, Calendar, ArrowRight, CheckCircle2, PlusCircle, Search } from 'lucide-react';

export default function MissionSelector({ onSelect }) {
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isManual, setIsManual] = useState(false);
    const [manualName, setManualName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function fetchMissions() {
            setLoading(true);
            const supabase = createClient();

            try {
                // Fetch schools from 'proximas_escuelas'
                const { data, error } = await supabase
                    .from('proximas_escuelas')
                    .select('*')
                    .or('estatus.eq.pendiente,estatus.eq.confirmado') // Mostrar pendientes y confirmadas
                    .order('fecha_programada', { ascending: true }); // Las más próximas primero

                if (error) {
                    if (error.code !== 'PGRST116') console.error("Error fetching missions", error);
                    // Fallback to empty if table issue, user can use manual
                    setMissions([]);
                } else {
                    setMissions(data || []);
                }

            } catch (error) {
                console.error("Error fetching missions", error);
            } finally {
                setLoading(false);
            }
        }

        fetchMissions();
    }, []);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualName.trim()) {
            onSelect({
                id: `manual-${Date.now()}`,
                school_name: manualName, // Adapted to match schema (nombre_escuela mapped below)
                nombre_escuela: manualName,
                colonia: 'Registro Manual',
                isManual: true
            });
        }
    };

    const filteredMissions = missions.filter(m =>
        m.nombre_escuela?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.colonia?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
                <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
            </div>
        );
    }

    if (isManual) {
        return (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Entrada Manual</h2>
                    <p className="text-slate-500">Ingresa el nombre de la escuela.</p>
                </div>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Escuela</label>
                        <input
                            type="text"
                            required
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Ej. Escuela Benito Juárez"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                    >
                        Confirmar Misión <ArrowRight size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsManual(false)}
                        className="w-full py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl"
                    >
                        Cancelar
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Misión del Día</h2>
                <p className="text-slate-500">Selecciona la escuela donde operarás hoy.</p>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar escuela..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredMissions.length > 0 ? (
                    filteredMissions.map((mission) => (
                        <button
                            key={mission.id}
                            onClick={() => onSelect({
                                ...mission,
                                school_name: mission.nombre_escuela // Map to consistent prop if needed
                            })}
                            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
                        >
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-800 group-hover:text-blue-700 text-sm md:text-base">
                                    {mission.nombre_escuela}
                                </h3>
                                <div className="flex flex-col md:flex-row md:items-center text-xs text-slate-500 gap-1 md:gap-3">
                                    <span className="flex items-center gap-1"><MapPin size={12} /> {mission.colonia || 'Sin ubicación'}</span>
                                    {mission.fecha_programada && (
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <Calendar size={12} /> {new Date(mission.fecha_programada).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-slate-300 group-hover:text-blue-500 pl-2">
                                <ArrowRight size={20} />
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="text-center py-8 text-slate-400">
                        <p>No se encontraron escuelas.</p>
                    </div>
                )}
            </div>

            <div className="pt-2 border-t border-slate-100">
                <button
                    onClick={() => setIsManual(true)}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                    <PlusCircle size={18} />
                    ¿No aparece? Ingresar nombre manualmente
                </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-sm text-amber-800">
                <CheckCircle2 className="flex-shrink-0 text-amber-600" size={18} />
                <p>Verifica que tienes el material completo antes de iniciar.</p>
            </div>
        </div>
    );
}
