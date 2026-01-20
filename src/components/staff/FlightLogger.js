'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, StopCircle, Clock, Send, Plane, AlertTriangle } from 'lucide-react';
import CounterData from './CounterData';
import IncidentReporter from './IncidentReporter';

export default function FlightLogger({ onFlightComplete }) {
    const [status, setStatus] = useState('idle'); // 'idle' (pre-flight), 'active' (in-flight)
    const [startTime, setStartTime] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    const [students, setStudents] = useState(0);
    const [staff, setStaff] = useState(0);
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [incidents, setIncidents] = useState([]);

    const timerRef = useRef(null);

    // Timer Effect
    useEffect(() => {
        if (status === 'active' && startTime) {
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [status, startTime]);

    const handleTakeOff = () => {
        if (students === 0 && staff === 0) {
            alert("Por favor ingresa al menos un alumno o staff antes de despegar.");
            return;
        }
        setStatus('active');
        setStartTime(Date.now());
        setElapsed(0);
        setIncidents([]);
    };

    const handleLandAndSave = () => {
        if (!confirm("¿Aterrizar y Guardar Vuelo?")) return;

        setStatus('idle');
        const finalData = {
            startTime,
            endTime: Date.now(),
            durationSeconds: elapsed,
            studentCount: students,
            staffCount: staff,
            incidents: incidents
        };

        onFlightComplete(finalData);

        // Auto-Reset Logic
        setStudents(0);
        setStaff(0);
        setIncidents([]);
        setElapsed(0);
        setStartTime(null);
        alert("¡Vuelo Registrado Exitosamente!");
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isIdle = status === 'idle';

    return (
        <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-10 duration-500">
            {/* Timer Display */}
            <div className={`transition-all duration-500 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden ${isIdle ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                {!isIdle && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500 animate-pulse"></div>}

                <div className="flex items-center gap-3 mb-1">
                    <Clock size={20} className={isIdle ? "text-slate-400" : "text-blue-400"} />
                    <span className={`uppercase tracking-widest text-xs font-bold ${isIdle ? 'text-slate-500' : 'text-blue-200'}`}>
                        {isIdle ? 'Tiempo en Tierra' : 'Tiempo de Vuelo'}
                    </span>
                </div>
                <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums">
                    {formatTime(elapsed)}
                </div>
            </div>

            {/* Counters - Always visible but maybe disabled during flight? User didn't specify, best to keep editable often but let's assume locked during flight to prevent accidents? 
               User requested logic: "The staff must FIRST input... Once entered.. enable button". 
               It implies input is a pre-requisite step. Let's leave them editable during flight just in case of correction, but emphasize PRE-flight input.
            */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${!isIdle ? 'opacity-80' : ''}`}>
                <CounterData
                    label="Alumnos"
                    value={students}
                    onChange={setStudents}
                    color="blue"
                />
                <CounterData
                    label="Personal / Maestros"
                    value={staff}
                    onChange={setStaff}
                    color="indigo"
                />
            </div>

            {/* Incidents Preview (Only Show in Active or if happened) */}
            {incidents.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-bold text-red-800 flex items-center gap-2">
                        <AlertTriangle size={16} /> Incidencias ({incidents.length})
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {incidents.map((inc, idx) => (
                            <div key={idx} className="flex-shrink-0 bg-white px-3 py-1 rounded-full border border-red-100 text-xs font-medium text-red-600 shadow-sm">
                                {inc.type}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-4">
                {isIdle ? (
                    <button
                        onClick={handleTakeOff}
                        disabled={students === 0 && staff === 0}
                        className="w-full h-24 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:text-slate-500 text-white font-black text-2xl shadow-xl shadow-green-500/30 flex items-center justify-center gap-4 transition-all active:scale-95"
                    >
                        <Plane size={32} className={students > 0 || staff > 0 ? "animate-pulse" : ""} />
                        ¡DESPEGAR!
                    </button>
                ) : (
                    <div className="grid grid-cols-4 gap-3">
                        {/* Incident Button (Small) */}
                        <button
                            onClick={() => setShowIncidentModal(true)}
                            className="col-span-1 rounded-2xl bg-red-100 text-red-600 border-2 border-red-200 flex flex-col items-center justify-center active:bg-red-200"
                        >
                            <AlertTriangle size={24} />
                            <span className="text-[10px] font-bold mt-1">FALLA</span>
                        </button>

                        {/* Land Button (Large) */}
                        <button
                            onClick={handleLandAndSave}
                            className="col-span-3 h-24 rounded-2xl bg-slate-900 text-white font-bold text-xl shadow-xl shadow-slate-900/40 flex items-center justify-center gap-3 active:scale-95 transition-all"
                        >
                            <StopCircle size={32} className="text-red-500" />
                            ITERRIZAR Y GUARDAR
                        </button>
                    </div>
                )}
            </div>

            {/* Incident Modal */}
            {showIncidentModal && (
                <IncidentReporter
                    onClose={() => setShowIncidentModal(false)}
                    onSave={(inc) => setIncidents([...incidents, inc])}
                />
            )}
        </div>
    );
}
