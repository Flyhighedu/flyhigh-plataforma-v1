'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useElapsedTimer from '@/hooks/useElapsedTimer';
import { StopCircle, Clock, Plane, AlertTriangle, XCircle, Mic, MicOff, Settings, RefreshCw } from 'lucide-react';
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
    showTotalOperationTimer = false,
    pilotRecording = false,
    pilotMicPermission = null,
    pilotMicSupported = false,
    onRetryMicPermission = null,
    isPeripheralActive = false
}) {
    const [micBannerDismissed, setMicBannerDismissed] = useState(false);
    const [micRetrying, setMicRetrying] = useState(false);
    const [micRetryResult, setMicRetryResult] = useState(null); // 'success' | 'failed' | null

    // Detect platform and execution context for instructions
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    const isStandalone = typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator?.standalone === true
    );

    const micIsDenied = pilotMicPermission === 'denied';
    const micIsPrompt = pilotMicPermission === 'prompt';
    const micNeedsAttention = (micIsDenied || (pilotMicSupported && micIsPrompt)) && !micBannerDismissed;

    const handleRetryMic = useCallback(async () => {
        if (!onRetryMicPermission || micRetrying) return;
        setMicRetrying(true);
        setMicRetryResult(null);
        try {
            const ok = await onRetryMicPermission();
            setMicRetryResult(ok ? 'success' : 'failed');
            if (ok) {
                // Auto-dismiss banner after success
                setTimeout(() => setMicBannerDismissed(true), 1500);
            }
        } catch {
            setMicRetryResult('failed');
        } finally {
            setMicRetrying(false);
        }
    }, [onRetryMicPermission, micRetrying]);

    // Reset banner dismiss when permission changes to granted
    useEffect(() => {
        if (pilotMicPermission === 'granted') {
            setMicBannerDismissed(false);
            setMicRetryResult(null);
        }
    }, [pilotMicPermission]);
    const initialState = buildInitialFlightState(initialActiveFlight);
    const [status, setStatus] = useState(() => initialState.status); // 'idle' (pre-flight), 'active' (in-flight)
    const [startTime, setStartTime] = useState(() => initialState.startTime);
    // [PERF FIX] Use useElapsedTimer instead of manual setInterval to avoid
    // a redundant re-render cycle every second.
    const elapsed = useElapsedTimer(startTime, status === 'active');
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
    const [showLandConfirm, setShowLandConfirm] = useState(false);


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

    // [PERF FIX] Timer is now handled by useElapsedTimer hook above.
    // No manual setInterval needed — the hook ticks internally.

    const handleTakeOff = () => {
        if (isLandingRef.current) return;

        if (students === 0 && staff === 0) {
            alert("Por favor ingresa al menos un alumno o staff antes de despegar.");
            return;
        }

        // Haptic feedback (Takeoff)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]); // Strong double pulse
        }

        const takeOffMs = Date.now();
        const nextFlightId = `flight-${takeOffMs}-${Math.random().toString(36).slice(2, 8)}`;
        const takeOffFlightNumber = safeNextFlightNumber;

        setActiveFlightId(nextFlightId);
        setActiveFlightNumberState(takeOffFlightNumber);
        setIsLanding(false);
        setStatus('active');
        setStartTime(takeOffMs);
        // elapsed is now computed by useElapsedTimer (auto-resets when startTime changes)
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

    const handleLandRequest = () => {
        if (status !== 'active' || !startTime) return;
        if (isLandingRef.current) return;
        const currentFlightId = activeFlightId || `flight-${startTime}`;
        if (lastCompletedFlightIdRef.current && String(lastCompletedFlightIdRef.current) === String(currentFlightId)) {
            return;
        }

        // Haptic feedback (Landing button tap)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50); // Light pulse
        }

        setShowLandConfirm(true);
    };

    const handleLandAndSave = () => {
        if (status !== 'active' || !startTime) return;

        const currentFlightId = activeFlightId || `flight-${startTime}`;

        if (isLandingRef.current) return;
        if (lastCompletedFlightIdRef.current && String(lastCompletedFlightIdRef.current) === String(currentFlightId)) {
            return;
        }

        // Haptic feedback (Confirm landing)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([80, 40, 80]); // Confirm double pulse
        }

        setShowLandConfirm(false);
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
                // We intentionally do NOT reset students and staff here so they persist for the next flight
                setIncidents([]);
                setElapsed(0);
                setStartTime(null);
                setActiveFlightId(null);
                setActiveFlightNumberState(null);
                setIsLanding(false);
                isLandingRef.current = false;
            });
    };

    const handleCancelFlight = () => {
        if (isLandingRef.current) return;

        if (confirm("¿Cancelar este vuelo? No se guardará nada.")) {
            // Haptic feedback (Cancel)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(200); // Long single pulse for destructive action
            }

            // Timer is now managed by useElapsedTimer — no manual cleanup needed

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
            // We intentionally do NOT reset students and staff here so they persist
            setIncidents([]);
            // elapsed auto-resets via useElapsedTimer when startTime is set to null
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
        <div className="space-y-2 pb-1 animate-in slide-in-from-bottom-10 duration-500 flex flex-col justify-center">
            {/* Timer Display (No Container) */}
            <div className={`transition-colors duration-500 flex flex-col items-center justify-center relative ${isPeripheralActive ? 'text-white' : 'text-slate-800'}`}>

                {/* Flight Number Pill */}
                <div className="flex justify-center mb-1">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isPeripheralActive ? 'bg-white/20 text-white' : isIdle ? 'bg-slate-200/50 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
                        {isIdle ? `SIGUIENTE VUELO #${safeNextFlightNumber}` : `VUELO #${safeActiveFlightNumber} (EN AIRE)`}
                    </span>
                </div>

                {/* The Timer */}
                <div className={`text-[64px] sm:text-[72px] font-mono font-black tracking-tighter tabular-nums leading-none mb-1 transition-colors ${!isIdle && !isPeripheralActive ? 'text-blue-600' : ''}`}>
                    {formatTime(elapsed)}
                </div>

                {/* ── SECONDARY METRICS ROW ── */}
                <div className="flex items-center justify-center gap-8 mb-2">
                    {shouldShowInterFlightTimer && (
                        <div className="text-center">
                            <p className={`text-[9px] font-bold uppercase tracking-[0.2em] opacity-40`}>
                                Entre vuelos
                            </p>
                            <p className={`text-sm font-bold tabular-nums tracking-wider opacity-60`}>
                                {formatTime(Math.max(0, Math.floor(interFlightElapsedSeconds || 0)))}
                            </p>
                        </div>
                    )}
                    <div className="text-center">
                        <p className={`text-[9px] font-bold uppercase tracking-[0.2em] opacity-40`}>
                            Niños volados
                        </p>
                        <p className={`text-sm font-bold tabular-nums tracking-wider opacity-60`}>
                            {safeTotalStudentsFlown}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-center">
                    {!isIdle && pilotRecording && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-400/30 text-[10px] font-black uppercase tracking-widest text-red-200">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                            Grabando
                        </span>
                    )}
                    {!isIdle && !pilotRecording && micIsDenied && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-black uppercase tracking-widest text-amber-200">
                            <MicOff size={10} />
                            Sin audio
                        </span>
                    )}
                </div>
            </div>

            {/* Inter-flight timer moved to pill above */}
            {/* Counters - Always visible but maybe disabled during flight? User didn't specify, best to keep editable often but let's assume locked during flight to prevent accidents?
               User requested logic: "The staff must FIRST input... Once entered.. enable button".
               It implies input is a pre-requisite step. Let's leave them editable during flight just in case of correction, but emphasize PRE-flight input.
            */}

            {/* ── Microphone Permission Banner ── */}
            {isIdle && micNeedsAttention && pilotMicPermission !== 'granted' && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3 shadow-sm animate-in fade-in duration-300">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <MicOff size={20} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-amber-800 mb-0.5">
                                {micIsDenied ? '🎙️ Micrófono Bloqueado' : '🎙️ Micrófono No Activado'}
                            </h4>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                {micIsDenied
                                    ? 'Tu narración de vuelo no se podrá grabar. Necesitas activar el micrófono manualmente.'
                                    : 'Activa el micrófono para que tu narración se grabe automáticamente en cada vuelo.'
                                }
                            </p>
                        </div>
                    </div>

                    {micIsDenied && (
                        <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
                            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                                {isStandalone
                                    ? (isIOS ? '📱 Pasos en iPhone (app instalada):' : isAndroid ? '📱 Pasos en Android (app instalada):' : '📱 Cómo activarlo:')
                                    : (isIOS ? '🌐 Pasos en Safari:' : isAndroid ? '🌐 Pasos en Chrome:' : '🌐 Cómo activarlo:')
                                }
                            </p>
                            {isAndroid && isStandalone ? (
                                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                                    <li>Abre <strong>Ajustes</strong> de tu teléfono</li>
                                    <li>Ve a <strong>Apps → &quot;FlyHigh&quot;</strong> (o Chrome)</li>
                                    <li>Toca <strong>Permisos → Micrófono</strong></li>
                                    <li>Selecciona <strong>&quot;Permitir&quot;</strong></li>
                                    <li>Regresa aquí y toca el botón de abajo</li>
                                </ol>
                            ) : isAndroid && !isStandalone ? (
                                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                                    <li>Toca el ícono <strong>🔒</strong> en la barra de dirección (arriba)</li>
                                    <li>Toca <strong>&quot;Permisos&quot;</strong> o <strong>&quot;Configuración del sitio&quot;</strong></li>
                                    <li>Activa <strong>Micrófono</strong></li>
                                    <li>Toca el botón de abajo para verificar</li>
                                </ol>
                            ) : isIOS && isStandalone ? (
                                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                                    <li>Abre <strong>Ajustes</strong> del iPhone</li>
                                    <li>Ve a <strong>Safari</strong></li>
                                    <li>Toca <strong>Micrófono → Permitir</strong></li>
                                    <li>Regresa aquí y toca el botón de abajo</li>
                                </ol>
                            ) : isIOS && !isStandalone ? (
                                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                                    <li>Toca <strong>&quot;aA&quot;</strong> en la barra de dirección</li>
                                    <li>Toca <strong>&quot;Configuración del sitio web&quot;</strong></li>
                                    <li>Activa <strong>Micrófono</strong></li>
                                    <li>Toca el botón de abajo para verificar</li>
                                </ol>
                            ) : (
                                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                                    <li>Abre los <strong>Ajustes</strong> de tu dispositivo</li>
                                    <li>Busca la app del navegador o &quot;FlyHigh&quot;</li>
                                    <li>Activa el permiso de <strong>Micrófono</strong></li>
                                    <li>Regresa aquí y toca el botón de abajo</li>
                                </ol>
                            )}
                        </div>
                    )}

                    {micRetryResult === 'success' && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
                            <Mic size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-700">¡Micrófono activado correctamente! ✅</span>
                        </div>
                    )}

                    {micRetryResult === 'failed' && (
                        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
                            <MicOff size={14} className="text-red-500" />
                            <span className="text-xs font-bold text-red-600">Aún no se detecta el micrófono. Sigue los pasos de arriba.</span>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleRetryMic}
                            disabled={micRetrying || micRetryResult === 'success'}
                            className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:active:scale-100"
                        >
                            {micRetrying ? (
                                <><RefreshCw size={14} className="animate-spin" /> Verificando...</>
                            ) : micRetryResult === 'success' ? (
                                <><Mic size={14} /> Activado ✅</>
                            ) : (
                                <><RefreshCw size={14} /> {micIsDenied ? 'Ya lo activé, verificar' : 'Activar micrófono'}</>
                            )}
                        </button>
                        <button
                            onClick={() => setMicBannerDismissed(true)}
                            className="px-4 h-11 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors active:scale-95"
                        >
                            Omitir
                        </button>
                    </div>
                </div>
            )}
            <div className={`grid grid-cols-2 gap-4 w-full max-w-md mx-auto px-4 mt-2 transition-opacity ${!isIdle ? 'opacity-90' : ''}`}>
                <CounterData
                    label="Alumnos"
                    value={students}
                    onChange={setStudents}
                    color="blue"
                    isPeripheralActive={isPeripheralActive}
                />
                <CounterData
                    label="Maestros"
                    value={staff}
                    onChange={setStaff}
                    color="indigo"
                    isPeripheralActive={isPeripheralActive}
                />
            </div>

            {/* Incidents Preview (Only Show in Active or if happened) */}
            {incidents.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2 mb-20">
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

            {/* Action Buttons (Inline Flow) */}
            <div className="mt-4 flex justify-center w-full px-4">
                <div className="w-full max-w-sm">
                    {isIdle ? (
                        <button
                            onClick={handleTakeOff}
                            disabled={isLanding || (students === 0 && staff === 0)}
                            className="w-full py-4 rounded-[20px] bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-[0_8px_30px_rgb(15,23,42,0.2)]"
                        >
                            <Plane size={24} className={!isLanding && (students > 0 || staff > 0) ? "animate-pulse" : ""} />
                            {isLanding ? 'GUARDANDO...' : '¡DESPEGAR!'}
                        </button>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => setShowIncidentModal(true)}
                                    disabled={isLanding}
                                    className="px-6 py-4 rounded-[20px] bg-red-100 text-red-600 flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm"
                                >
                                    <AlertTriangle size={20} />
                                    <span className="text-[12px] font-black tracking-widest">FALLA</span>
                                </button>

                                <button
                                    onClick={handleLandRequest}
                                    disabled={isLanding}
                                    className="flex-1 py-4 rounded-[20px] bg-slate-900 hover:bg-slate-800 text-white font-black text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-[0_8px_30px_rgb(15,23,42,0.3)]"
                                >
                                    <StopCircle size={24} className="text-red-500" />
                                    {isLanding ? 'GUARDANDO...' : 'ATERRIZAR'}
                                </button>
                            </div>
                            
                            <button
                                onClick={handleCancelFlight}
                                disabled={isLanding}
                                className="px-6 py-2 rounded-full bg-red-50/70 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <XCircle size={14} /> Abortar Vuelo
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Incident Modal */}
            {showIncidentModal && (
                <IncidentReporter
                    onClose={() => setShowIncidentModal(false)}
                    onSave={(inc) => setIncidents([...incidents, inc])}
                />
            )}

            {/* Land Confirmation Modal */}
            {showLandConfirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="animate-in zoom-in-95 duration-200" style={{ backgroundColor: 'white', borderRadius: 24, padding: 28, width: '100%', maxWidth: 340, textAlign: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <StopCircle size={28} style={{ color: '#EF4444' }} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>¿Aterrizar y Guardar?</h3>
                        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>Se cerrará el vuelo actual y se registrará en la bitácora.</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowLandConfirm(false)}
                                style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLandAndSave}
                                style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: '#0f172a', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.3)' }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
