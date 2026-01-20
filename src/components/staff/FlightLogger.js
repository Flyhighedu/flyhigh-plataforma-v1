'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, StopCircle, Clock, Users, UserCheck, AlertTriangle } from 'lucide-react';
import CounterData from './CounterData';
import IncidentReporter from './IncidentReporter';

export default function FlightLogger({ onFlightComplete }) {
    const [status, setStatus] = useState('idle'); // idle, active
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

    const handleStartFlight = () => {
        setStatus('active');
        setStartTime(Date.now());
        setElapsed(0);
        setIncidents([]);
        // Keep counters if they represent the group, or reset? 
        // User request: "limpia los contadores para el siguiente grupo" implies reset AFTER flight.
        // So we start fresh or keep previous if needed? Assuming fresh flight = fresh counters usually, 
        // but maybe group setup is pre-flight. Let's assume reset on start for now or manual set.
        setStudents(0);
        setStaff(0);
    };

    const handleEndFlight = () => {
        if (!confirm("¿Finalizar vuelo y guardar registro?")) return;

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

        // Reset for next
        setStudents(0);
        setStaff(0);
        setIncidents([]);
        setElapsed(0);
        setStartTime(null);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // IDLE STATE
    if (status === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <button
                    onClick={handleStartFlight}
                    className="group relative w-64 h-64 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-2xl shadow-blue-500/40 flex flex-col items-center justify-center text-white transition-transform active:scale-95 hover:scale-105"
                >
                    <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-pulse"></div>
                    <Play size={64} fill="currentColor" className="mb-2 ml-2" />
                    <span className="text-xl font-bold tracking-wider">AGREGAR VUELO</span>
                </button>
                <p className="text-slate-500 text-sm font-medium">Listo para iniciar operación</p>
            </div>
        );
    }

    // ACTIVE STATE
    return (
        <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-10 duration-500">
            {/* Timer Display */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500 animate-pulse"></div>
                <div className="flex items-center gap-3 mb-1">
                    <Clock size={20} className="text-blue-400" />
                    <span className="uppercase tracking-widest text-xs font-bold text-blue-200">Tiempo de Vuelo</span>
                </div>
                <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums">
                    {formatTime(elapsed)}
                </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Incidents Preview */}
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

            {/* Actions Footer */}
            <div className="grid grid-cols-2 gap-4 mt-4">
                <button
                    onClick={() => setShowIncidentModal(true)}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-red-200 rounded-xl shadow-sm text-red-600 font-bold active:bg-red-50 transition-colors"
                >
                    <AlertTriangle size={24} />
                    <span>REPORTAR FALLA</span>
                </button>

                <button
                    onClick={handleEndFlight}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 font-bold active:bg-slate-900 transition-colors"
                >
                    <StopCircle size={24} />
                    <span>FINALIZAR VUELO</span>
                </button>
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
