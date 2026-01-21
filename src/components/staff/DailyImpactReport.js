'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Trash2, AlertTriangle, CheckCircle, Clock, Users, User, ArrowRight, FileText, Calendar, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DailyImpactReport({ missionId, onExit, allowDelete = true }) {
    // ... (rest of state)

    // ... (useEffect and logic)

    // ... (in JSX, footer section)
    <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
        <button
            onClick={onExit}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg"
        >
            {allowDelete ? 'Salir al Dashboard' : 'Volver al Historial'} <ArrowRight size={18} />
        </button>

        {allowDelete && (
            <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-2 text-xs text-red-400 font-bold hover:text-red-600 transition-colors flex items-center justify-center gap-1 opacity-60 hover:opacity-100"
            >
                <Trash2 size={12} /> ELIMINAR REGISTROS (MODO TEST)
            </button>
        )}
    </div>
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [missionData, setMissionData] = useState(null);
    const [currentDate, setCurrentDate] = useState("");
    const router = useRouter();

    useEffect(() => {
        setCurrentDate(new Date().toLocaleDateString());
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            const supabase = createClient();

            // 1. Fetch Mission Details (School Name)
            // Try fetching from DB first to be accurate for History mode
            let schoolName = "Escuela Desconocida";
            let missionDate = new Date().toLocaleDateString();

            if (missionId && !missionId.startsWith('manual-')) {
                const { data: schoolData, error: schoolError } = await supabase
                    .from('proximas_escuelas')
                    .select('school_name, nombre_escuela, fecha_programada')
                    .eq('id', missionId)
                    .single();

                if (schoolData) {
                    schoolName = schoolData.school_name || schoolData.nombre_escuela;
                    if (schoolData.fecha_programada) {
                        missionDate = new Date(schoolData.fecha_programada).toLocaleDateString();
                    }
                }
            } else if (missionId && missionId.startsWith('manual-')) {
                // For manual missions in history, we might have lost the name unless we stored it in 'mission_data' column of flights or closure.
                // We'll rely on what we can find.
                schoolName = "Registro Manual";
            }

            // Fallback to local storage if available (for active session)
            const localMission = JSON.parse(localStorage.getItem('flyhigh_staff_mission') || '{}');
            if (localMission && localMission.id === missionId) {
                schoolName = localMission.school_name || localMission.nombre_escuela || schoolName;
            }

            setMissionData({ school_name: schoolName, date: missionDate });

            // 2. Fetch flights
            const { data: flights, error } = await supabase
                .from('bitacora_vuelos')
                .select('*')
                .eq('mission_id', missionId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching report:", error);
                setLoading(false);
                return;
            }

            // 3. Fetch Closure Data (Signature & Photo)
            const { data: closureData, error: closureError } = await supabase
                .from('cierres_mision')
                .select('signature_url, group_photo_url')
                .eq('mission_id', missionId)
                .single();

            if (closureData) {
                setStats(prev => ({
                    ...prev,
                    signature: closureData.signature_url,
                    photo: closureData.group_photo_url
                }));
            }

            // 4. Fetch Pauses
            const { data: pauses } = await supabase
                .from('bitacora_pausas')
                .select('*')
                .eq('mission_id', missionId)
                .order('start_time', { ascending: true });

            let totalKids = 0;
            let totalStaff = 0;
            let totalDuration = 0;
            let totalPauseTime = 0;
            let allIncidents = [];

            flights.forEach(f => {
                totalKids += (f.student_count || f.studentCount || 0);
                totalStaff += (f.staff_count || f.staffCount || 0);
                totalDuration += (f.duration_seconds || f.durationSeconds || 0);

                const incs = f.incidents || [];
                if (Array.isArray(incs)) {
                    allIncidents = [...allIncidents, ...incs];
                }
            });

            // Calculate total pause time
            (pauses || []).forEach(p => {
                if (p.start_time && p.end_time) {
                    const duration = Math.floor((new Date(p.end_time) - new Date(p.start_time)) / 1000);
                    totalPauseTime += duration;
                }
            });

            const avgDuration = flights.length > 0 ? Math.floor(totalDuration / flights.length) : 0;

            setStats(prev => ({
                ...prev, // Keep closure info if set above
                totalKids,
                totalStaff,
                avgDuration,
                flightCount: flights.length,
                incidents: allIncidents,
                flights: flights,
                pauses: pauses || [],
                totalPauseTime
            }));
            setLoading(false);
        };

        if (missionId) fetchStats();
    }, [missionId]);

    const handleDeleteData = async () => {
        if (deleteInput !== 'ELIMINAR') return;

        setIsDeleting(true);
        const supabase = createClient();

        // DELETE Everything for this mission
        await supabase.from('bitacora_vuelos').delete().eq('mission_id', missionId);
        await supabase.from('cierres_mision').delete().eq('mission_id', missionId);

        alert("Datos de prueba eliminados correctamente.");
        localStorage.removeItem('flyhigh_staff_mission');
        localStorage.removeItem('flyhigh_flight_logs');

        router.push('/staff/dashboard');
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Generando Informe Detallado...</div>;

    if (!stats) return <div className="p-8 text-center text-red-500">Error al cargar datos.</div>;

    return (
        <div className="animate-in zoom-in-95 duration-500 pb-20">
            {/* Document Container */}
            <div className="bg-white shadow-2xl rounded-sm overflow-hidden max-w-2xl mx-auto border border-slate-200">
                {/* Header */}
                <div className="bg-slate-900 text-white p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <FileText size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2 text-blue-400 font-bold uppercase tracking-widest text-xs">
                            <CheckCircle size={14} /> Misión Completada
                        </div>
                        <h1 className="text-3xl font-black mb-2">INFORME DE MISIÓN</h1>
                        <div className="flex flex-col gap-1 text-slate-400 text-sm">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} /> {missionData?.school_name || "Escuela Desconocida"}
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} /> {missionData?.date || currentDate}
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPIs Row */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50">
                    <div className="p-4 text-center">
                        <div className="text-3xl font-black text-slate-800">{stats.totalKids}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase mt-1">Impacto Alumnos</div>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-3xl font-black text-slate-800">{stats.totalStaff}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase mt-1">Docentes</div>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-3xl font-black text-slate-800">{formatTime(stats.avgDuration)}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase mt-1">Promedio Vuelo</div>
                    </div>
                </div>

                {/* Flight Breakdown Table */}
                <div className="p-6">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" /> Desglose de Actividad
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-3 py-3 whitespace-nowrap"># Actividad</th>
                                    <th className="px-3 py-3 whitespace-nowrap">Hora</th>
                                    <th className="px-2 py-3 text-center">Alumnos</th>
                                    <th className="px-2 py-3 text-center">Docentes</th>
                                    <th className="px-3 py-3 text-right">Duración</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Combine flights and pauses into chronological order */}
                                {(() => {
                                    const flightItems = stats.flights.map((f, idx) => ({
                                        type: 'flight',
                                        number: idx + 1,
                                        time: f.start_time || f.startTime,
                                        students: f.student_count || f.studentCount || 0,
                                        staff: f.staff_count || f.staffCount || 0,
                                        duration: f.duration_seconds || f.durationSeconds || 0,
                                        data: f
                                    }));

                                    const pauseItems = (stats.pauses || []).map(p => ({
                                        type: p.pause_type === 'receso' ? 'receso' : 'pausa',
                                        time: p.start_time,
                                        endTime: p.end_time,
                                        reason: p.reason,
                                        duration: p.end_time ? Math.floor((new Date(p.end_time) - new Date(p.start_time)) / 1000) : 0,
                                        data: p
                                    }));

                                    const allItems = [...flightItems, ...pauseItems].sort((a, b) =>
                                        new Date(a.time) - new Date(b.time)
                                    );

                                    return allItems.map((item, idx) => {
                                        if (item.type === 'flight') {
                                            return (
                                                <tr key={`flight-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-3 py-3 font-bold text-slate-700 whitespace-nowrap">Vuelo {item.number}</td>
                                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                                                        {item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                    </td>
                                                    <td className="px-2 py-3 text-center text-slate-600">{item.students}</td>
                                                    <td className="px-2 py-3 text-center text-slate-600">{item.staff}</td>
                                                    <td className="px-3 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                                                        {formatTime(item.duration)}
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            // Pause row
                                            const isReceso = item.type === 'receso';
                                            const reasonLabels = { clima: '🌧️', evento: '🎉', falla: '⚠️', otro: '📝' };
                                            return (
                                                <tr key={`pause-${idx}`} className={isReceso ? 'bg-amber-50/50' : 'bg-red-50/50'}>
                                                    <td className={`px-3 py-3 font-bold whitespace-nowrap ${isReceso ? 'text-amber-700' : 'text-red-700'}`}>
                                                        {isReceso ? '☕ Receso' : `⏸️ Pausa ${item.reason ? reasonLabels[item.reason] || '' : ''}`}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                                                        {item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                    </td>
                                                    <td className="px-2 py-3 text-center text-slate-400">—</td>
                                                    <td className="px-2 py-3 text-center text-slate-400">—</td>
                                                    <td className={`px-3 py-3 text-right font-mono whitespace-nowrap ${isReceso ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {formatTime(item.duration)}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    });
                                })()}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-slate-900">
                                <tr>
                                    <td className="px-3 py-3" colSpan={2}>TOTAL</td>
                                    <td className="px-2 py-3 text-center">{stats.totalKids}</td>
                                    <td className="px-2 py-3 text-center">{stats.totalStaff}</td>
                                    <td className="px-3 py-3 text-right text-[10px] text-slate-400 uppercase">Acumulado</td>
                                </tr>
                                {stats.totalPauseTime > 0 && (
                                    <tr className="bg-amber-50/50 text-amber-800">
                                        <td className="px-3 py-2 text-xs" colSpan={4}>⏸️ Tiempo en Pausas</td>
                                        <td className="px-3 py-2 text-right font-mono text-sm">{formatTime(stats.totalPauseTime)}</td>
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Incidents Gallery */}
                {stats.incidents.length > 0 && (
                    <div className="p-6 border-t border-slate-100 bg-red-50/30">
                        <h3 className="text-sm font-bold text-red-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertTriangle size={16} /> Reporte de Incidencias
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {stats.incidents.map((inc, i) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-red-100 shadow-sm flex flex-col gap-2">
                                    {inc.photo && (
                                        <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
                                            <img src={inc.photo} alt="Evidencia" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase">{inc.type}</span>
                                        <p className="text-xs text-slate-600 mt-1 leading-snug">{inc.notes || 'Sin detalles'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Closure Evidence (Signature & Photo) */}
                {(stats.signature || stats.photo) && (
                    <div className="p-6 border-t border-slate-200">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <CheckCircle size={16} className="text-slate-400" /> Evidencia de Cierre
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {stats.photo ? (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Foto Grupal</p>
                                    <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <img src={stats.photo} className="w-full h-full object-cover" alt="Foto Grupal" />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">Sin foto grupal</div>
                            )}

                            {stats.signature ? (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Firma Responsable</p>
                                    <div className="aspect-video rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center p-2">
                                        <img src={stats.signature} className="max-w-full max-h-full object-contain" alt="Firma" />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">Sin firma registrada</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
                    <button
                        onClick={onExit}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        {allowDelete ? 'Salir al Dashboard' : 'Volver al Historial'} <ArrowRight size={18} />
                    </button>

                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full py-2 text-xs text-red-400 font-bold hover:text-red-600 transition-colors flex items-center justify-center gap-1 opacity-60 hover:opacity-100"
                    >
                        <Trash2 size={12} /> ELIMINAR REGISTROS (MODO TEST)
                    </button>
                </div>
            </div>

            {/* DELETE MODAL (Keep Existing Logic) */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-red-600">¿ELIMINAR REGISTROS?</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Esta acción borrará permanentemente todos los vuelos y reportes de esta sesión. <br />
                                <strong className="text-slate-800">No se puede deshacer.</strong>
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Escribe "ELIMINAR" para confirmar:</label>
                            <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                placeholder="ELIMINAR"
                                className="w-full p-4 border-2 border-red-200 rounded-xl text-center font-bold text-red-600 focus:outline-none focus:border-red-500 placeholder:text-red-200 uppercase"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeleteInput(''); }}
                                className="py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteData}
                                disabled={deleteInput !== 'ELIMINAR' || isDeleting}
                                className="py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30"
                            >
                                {isDeleting ? 'Borrando...' : 'CONFIRMAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
