'use client';

import { useState, useEffect, useRef } from 'react';
import { StopCircle, Clock, Plane, AlertTriangle, XCircle } from 'lucide-react';
import CounterData from './CounterData';
import IncidentReporter from './IncidentReporter';

function buildInitialFlightState(initialActiveFlight) {
    if (!initialActiveFlight || typeof initialActiveFlight !== 'object') {
        return {
            status: 'idle',
            startTime: null,
            elapsed: 0,
            students: 0,
            staff: 0,
            incidents: [],
            activeFlightId: null,
            activeFlightNumber: null
        };
    }

    const startedAt = initialActiveFlight.startedAt || initialActiveFlight.start_time || null;
    const startedAtMs = startedAt
        ? new Date(startedAt).getTime()
        : Number(initialActiveFlight.startTime || initialActiveFlight.startTimeMs || 0);

    if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
        return {
            status: 'idle',
            startTime: null,
            elapsed: 0,
            students: 0,
            staff: 0,
            incidents: [],
            activeFlightId: null,
            activeFlightNumber: null
        };
    }

    const initialFlightNumber = Number(initialActiveFlight.flightNumber || initialActiveFlight.flight_number || 0);

    return {
        status: 'active',
        startTime: startedAtMs,
        elapsed: Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
        students: Number(initialActiveFlight.studentCount) || 0,
        staff: Number(initialActiveFlight.staffCount) || 0,
        incidents: Array.isArray(initialActiveFlight.incidents) ? initialActiveFlight.incidents : [],
        activeFlightId: initialActiveFlight.flightId || null,
        activeFlightNumber: Number.isFinite(initialFlightNumber) && initialFlightNumber > 0 ? initialFlightNumber : null
    };
}

export default function FlightLogger({
    onFlightComplete,
    onFlightStart,
    onFlightCancel,
    initialActiveFlight = null,
    disabled = false,
    nextFlightNumber = 1,
    activeFlightNumber = null,
    showInterFlightTimer = false,
    interFlightElapsedSeconds = 0,
    totalStudentsFlown = 0,
    totalOperationElapsedSeconds = 0,
    showTotalOperationTimer = false
}) {
    const initialState = buildInitialFlightState(initialActiveFlight);
    const [status, setStatus] = useState(() => initialState.status); // 'idle' (pre-flight), 'active' (in-flight)
    const [startTime, setStartTime] = useState(() => initialState.startTime);
    const [elapsed, setElapsed] = useState(() => initialState.elapsed);
    const [students, setStudents] = useState(() => initialState.students);
    const [staff, setStaff] = useState(() => initialState.staff);
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [incidents, setIncidents] = useState(() => initialState.incidents);
    const [activeFlightId, setActiveFlightId] = useState(() => initialState.activeFlightId);
    const [activeFlightNumberState, setActiveFlightNumberState] = useState(() => {
        const fromInitial = Number(initialState.activeFlightNumber || 0);
        if (Number.isFinite(fromInitial) && fromInitial > 0) return fromInitial;

        const fromProp = Number(activeFlightNumber || 0);
        return Number.isFinite(fromProp) && fromProp > 0 ? fromProp : null;
    });
    const [isLanding, setIsLanding] = useState(false);

    const timerRef = useRef(null);
    const isLandingRef = useRef(false);
    const lastCompletedFlightIdRef = useRef(null);

    const parsedNextFlightNumber = Number(nextFlightNumber || 0);
    const safeNextFlightNumber = Number.isFinite(parsedNextFlightNumber) && parsedNextFlightNumber > 0
        ? Math.floor(parsedNextFlightNumber)
        : 1;

    const parsedActiveFlightNumber = Number(activeFlightNumberState || activeFlightNumber || 0);
    const safeActiveFlightNumber = Number.isFinite(parsedActiveFlightNumber) && parsedActiveFlightNumber > 0
        ? Math.floor(parsedActiveFlightNumber)
        : safeNextFlightNumber;

    const shouldShowInterFlightTimer = status === 'idle' && showInterFlightTimer;
    const safeTotalStudentsFlown = Number.isFinite(Number(totalStudentsFlown))
        ? Math.max(0, Math.floor(Number(totalStudentsFlown)))
        : 0;
    const safeOperationElapsedSeconds = Number.isFinite(Number(totalOperationElapsedSeconds))
        ? Math.max(0, Math.floor(Number(totalOperationElapsedSeconds)))
        : 0;
    const shouldShowOperationTimer = showTotalOperationTimer || safeOperationElapsedSeconds > 0;

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
        if (isLandingRef.current) return;

        if (students === 0 && staff === 0) {
            alert("Por favor ingresa al menos un alumno o staff antes de despegar.");
            return;
        }
        const takeOffMs = Date.now();
        const nextFlightId = `flight-${takeOffMs}-${Math.random().toString(36).slice(2, 8)}`;
        const takeOffFlightNumber = safeNextFlightNumber;

        setActiveFlightId(nextFlightId);
        setActiveFlightNumberState(takeOffFlightNumber);
        setIsLanding(false);
        setStatus('active');
        setStartTime(takeOffMs);
        setElapsed(0);
        setIncidents([]);
        lastCompletedFlightIdRef.current = null;

        if (typeof onFlightStart === 'function') {
            onFlightStart({
                flightId: nextFlightId,
                flightNumber: takeOffFlightNumber,
                startTime: takeOffMs,
                startedAt: new Date(takeOffMs).toISOString(),
                studentCount: students,
                staffCount: staff,
                incidents: []
            });
        }
    };

    const handleLandAndSave = () => {
        if (status !== 'active' || !startTime) return;

        const currentFlightId = activeFlightId || `flight-${startTime}`;

        if (isLandingRef.current) return;
        if (lastCompletedFlightIdRef.current && String(lastCompletedFlightIdRef.current) === String(currentFlightId)) {
            return;
        }

        if (!confirm("¿Aterrizar y Guardar Vuelo?")) return;

        isLandingRef.current = true;
        setIsLanding(true);

        const endTime = Date.now();
        const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

        clearInterval(timerRef.current);
        setStatus('idle');

        const finalData = {
            flightId: currentFlightId,
            flightNumber: safeActiveFlightNumber,
            startTime,
            endTime,
            durationSeconds,
            studentCount: students,
            staffCount: staff,
            incidents: incidents
        };

        const completionResult = typeof onFlightComplete === 'function'
            ? onFlightComplete(finalData)
            : null;

        Promise.resolve(completionResult)
            .catch((error) => {
                console.warn('No se pudo confirmar el guardado del vuelo en callback:', error);
            })
            .finally(() => {
                lastCompletedFlightIdRef.current = currentFlightId;

                // Auto-Reset Logic
                setStudents(0);
                setStaff(0);
                setIncidents([]);
                setElapsed(0);
                setStartTime(null);
                setActiveFlightId(null);
                setActiveFlightNumberState(null);
                setIsLanding(false);
                isLandingRef.current = false;
                alert("¡Vuelo Registrado Exitosamente!");
            });
    };

    const handleCancelFlight = () => {
        if (isLandingRef.current) return;

        if (confirm("¿Cancelar este vuelo? No se guardará nada.")) {
            if (typeof onFlightCancel === 'function') {
                onFlightCancel({
                    flightId: activeFlightId || null,
                    flightNumber: safeActiveFlightNumber,
                    startTime,
                    elapsed,
                    studentCount: students,
                    staffCount: staff
                });
            }
            setStatus('idle');
            setStudents(0);
            setStaff(0);
            setIncidents([]);
            setElapsed(0);
            setStartTime(null);
            setActiveFlightId(null);
            setActiveFlightNumberState(null);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isIdle = status === 'idle';

    // Show disabled state when paused
    if (disabled) {
        return (
            <div className="space-y-6 pb-20 animate-in fade-in duration-500">
                <div className="rounded-2xl p-8 bg-amber-50 border-2 border-amber-200 text-center">
                    <div className="text-4xl mb-3">⏸️</div>
                    <h3 className="text-lg font-bold text-amber-800 mb-1">Operación en Pausa</h3>
                    <p className="text-sm text-amber-600">Los vuelos están deshabilitados durante la pausa</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-10 duration-500">
            {/* Timer Display */}
            <div className={`transition-all duration-500 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg relative overflow-hidden ${isIdle ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                {!isIdle && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500 animate-pulse"></div>}
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${isIdle
                        ? 'bg-white border-slate-200 text-slate-600'
                        : 'bg-white/10 border-white/20 text-blue-100'
                    }`}>
                    {isIdle ? `Siguiente vuelo #${safeNextFlightNumber}` : `Vuelo #${safeActiveFlightNumber} en curso`}
                </div>

                <div className="flex items-center gap-3 mb-1">
                    <Clock size={20} className={isIdle ? "text-slate-400" : "text-blue-400"} />
                    <span className={`uppercase tracking-widest text-xs font-bold ${isIdle ? 'text-slate-500' : 'text-blue-200'}`}>
                        {isIdle ? 'Tiempo en Tierra' : 'Tiempo de Vuelo'}
                    </span>
                </div>
                <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums">
                    {formatTime(elapsed)}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${isIdle ? 'bg-white border border-slate-200 text-slate-600' : 'bg-sky-500/15 border border-sky-400/30 text-sky-100'}`}>
                        Niños volados: {safeTotalStudentsFlown}
                    </span>
                    {shouldShowOperationTimer && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide tabular-nums ${isIdle ? 'bg-white border border-emerald-200 text-emerald-700' : 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-100'}`}>
                            Operación total: {formatTime(safeOperationElapsedSeconds)}
                        </span>
                    )}
                </div>
            </div>

            {shouldShowInterFlightTimer && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tiempo entre vuelos</p>
                        <p className="text-[11px] text-slate-500">Se detiene al iniciar el siguiente despegue.</p>
                    </div>
                    <p className="text-lg font-black text-slate-700 tabular-nums">{formatTime(Math.max(0, Math.floor(interFlightElapsedSeconds || 0)))}</p>
                </div>
            )}

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
                        disabled={isLanding || (students === 0 && staff === 0)}
                        className="w-full h-24 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:text-slate-500 text-white font-black text-2xl shadow-xl shadow-green-500/30 flex items-center justify-center gap-4 transition-all active:scale-95"
                    >
                        <Plane size={32} className={!isLanding && (students > 0 || staff > 0) ? "animate-pulse" : ""} />
                        {isLanding ? 'GUARDANDO...' : '¡DESPEGAR!'}
                    </button>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                            {/* Incident Button (Small) */}
                            <button
                                onClick={() => setShowIncidentModal(true)}
                                disabled={isLanding}
                                className="col-span-1 rounded-2xl bg-red-100 text-red-600 border-2 border-red-200 flex flex-col items-center justify-center active:bg-red-200"
                            >
                                <AlertTriangle size={24} />
                                <span className="text-[10px] font-bold mt-1">FALLA</span>
                            </button>

                            {/* Land Button (Large) */}
                            <button
                                onClick={handleLandAndSave}
                                disabled={isLanding}
                                className="col-span-3 h-24 rounded-2xl bg-slate-900 text-white font-bold text-xl shadow-xl shadow-slate-900/40 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <StopCircle size={32} className="text-red-500" />
                                ATERRIZAR Y GUARDAR
                            </button>
                        </div>

                        {/* Cancel Flight Button */}
                        <button
                            onClick={handleCancelFlight}
                            disabled={isLanding}
                            className="w-full h-11 rounded-xl border border-red-200 bg-red-50/70 text-red-600 text-sm font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <XCircle size={16} /> ABORTAR VUELO ACTUAL
                        </button>
                        <p className="text-[11px] text-center text-slate-400">Cancela sin guardar y conserva el número de vuelo actual.</p>
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
