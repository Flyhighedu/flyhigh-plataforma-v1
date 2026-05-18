'use client';

// =====================================================
// OperationUI.js — Pure Presentational Component
// =====================================================
// This is the "dumb" component in the Smart/Dumb pattern.
// It renders the entire flight operation interface but
// contains ZERO business logic, ZERO Supabase calls,
// and ZERO localStorage access.
//
// All behavior is injected via props (callbacks).
// Used by:
//   - StaffOperationLegacy.js (production, real Supabase)
//   - SimulationContainer.js (academia, mock handlers)
// =====================================================

import { useState, useRef, useCallback, memo } from 'react';
import { MoreVertical, RotateCcw, Clock, Pause, LogOut } from 'lucide-react';
import FlightLogger from '@/components/staff/FlightLogger';
import TodayFlightList from '@/components/staff/TodayFlightList';
import PauseMenu from '@/components/staff/PauseMenu';
import PauseActiveOverlay from '@/components/staff/PauseActiveOverlay';
import ResumeProtocolModal from '@/components/staff/ResumeProtocolModal';
import CopilotOrbUI from '@/components/staff/CopilotOrbUI';
import FlightMiniPlayer from '@/components/staff/FlightMiniPlayer';

function formatTime(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const MemoizedFlightLogger = memo(FlightLogger);
const MemoizedTodayFlightList = memo(TodayFlightList);

export default function OperationUI({
    // ── Mission Data ──
    missionInfo = null,

    // ── Flight State ──
    activeFlight = null,
    missionFlights = [],
    nextFlightNumber = 1,
    activeFlightNumber = null,

    // ── Pause State ──
    activePause = null,
    completedPauses = [],

    // ── Timers ──
    operationElapsedSeconds = 0,
    showOperationTimer = false,
    interFlightElapsedSeconds = 0,
    showInterFlightTimer = false,
    totalStudentsFlown = 0,

    // ── Sync Badge ──
    pendingSyncCount = 0,

    // ── Callbacks: Flight ──
    onFlightStart,
    onFlightComplete,
    onFlightCancel,

    // ── Callbacks: Pause ──
    onStartPause,
    onRequestResume,
    onConfirmResume,

    // ── Callbacks: Close Day ──
    onCloseOperation,

    // ── Callbacks: Flight Edit ──
    onRequestEditFlight = null,

    // ── Callbacks: Navigation ──
    onChangeSchool = null,
    onViewHistory = null,
    onViewPOI = null,
    onLogout = null,

    // ── UI Flags ──
    hideMenu = false,
    isSimulation = false,
    canEditCompletedFlights = false,

    // ── Pilot Audio Props (pass-through to FlightLogger) ──
    pilotRecording = false,
    pilotMicPermission = null,
    pilotMicSupported = false,
    onRetryMicPermission = null,
    currentRole = null,

    // ── Custom Header (SyncHeader, etc.) ──
    headerSlot = null,

    // ── Escuadrón slots (optional overlays injected by smart container) ──
    escuadronSlot = null,

    // ── Voice AI Props (pass-through to VoiceSimulatorWidget) ──
    pois = [],
    voiceIsActive = false,
    voiceSetIsActive = null,
    voicePlayingPoiId = null,
    voiceSetPlayingPoiId = null,

    // ── Flight Audio Ecosystem Props ──
    flightPhase = 'cold',
    onPrepareCabin = null,
    flightAudioCurrentTrack = null,
    flightAudioIsPlaying = false,
    flightAudioIsLoading = false,
    flightAudioHasError = false,
    flightAudioHasSoundtracks = false,
    onFlightAudioTogglePlayPause = null,
    onFlightAudioSkipTrack = null,
    onCopilotVoiceStateChange = null,
}) {
    // ── Audio ref for VoiceSimulatorWidget ──
    const voiceAudioRef = useRef(null);
    const copilotRef = useRef(null);

    // ── Local UI-only state (no business logic) ──
    const [showMenu, setShowMenu] = useState(false);
    const [showPauseMenu, setShowPauseMenu] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [closeHoldProgress, setCloseHoldProgress] = useState(0);
    const [isClosingOperation, setIsClosingOperation] = useState(false);
    const [closeOperationError, setCloseOperationError] = useState(null);

    // ── Peripheral Vision State ──
    const [peripheralState, setPeripheralState] = useState('off');
    
    const handleVoiceStateChange = useCallback((newState) => {
        setPeripheralState(newState);
        // Forward copilot voice state to parent for auto-ducking
        if (typeof onCopilotVoiceStateChange === 'function') {
            onCopilotVoiceStateChange(newState);
        }
    }, [onCopilotVoiceStateChange]);

    // ── Close Day Hold (2s long-press) ──
    const CLOSE_DAY_HOLD_MS = 2000;
    const closeHoldStartedAtRef = { current: 0 };
    const closeHoldRafRef = { current: null };
    const closeHoldTriggeredRef = { current: false };

    const resetCloseDayHold = () => {
        if (closeHoldRafRef.current !== null) {
            window.cancelAnimationFrame(closeHoldRafRef.current);
            closeHoldRafRef.current = null;
        }
        closeHoldStartedAtRef.current = 0;
        closeHoldTriggeredRef.current = false;
        setCloseHoldProgress(0);
        setIsClosingOperation(false);
        setCloseOperationError(null);
    };

    const openCloseConfirmModal = () => {
        setShowMenu(false);
        setShowCloseConfirmModal(true);
        resetCloseDayHold();
    };

    const closeCloseConfirmModal = () => {
        setShowCloseConfirmModal(false);
        resetCloseDayHold();
    };

    const finalizeCloseDay = async () => {
        if (closeHoldTriggeredRef.current) return;
        closeHoldTriggeredRef.current = true;
        setCloseHoldProgress(100);
        setIsClosingOperation(true);
        setCloseOperationError(null);
        try {
            if (typeof onCloseOperation === 'function') {
                await onCloseOperation();
            }
        } catch (err) {
            setCloseOperationError(err?.message || 'Error al cerrar la operación.');
            closeHoldTriggeredRef.current = false;
            setIsClosingOperation(false);
        }
    };

    const handleCloseHoldStart = (event) => {
        if (closeHoldTriggeredRef.current) return;
        if (event?.cancelable) event.preventDefault();

        if (closeHoldRafRef.current !== null) {
            window.cancelAnimationFrame(closeHoldRafRef.current);
            closeHoldRafRef.current = null;
        }

        closeHoldStartedAtRef.current = performance.now();
        setCloseHoldProgress(1);

        const tick = (now) => {
            const elapsed = Math.max(0, now - closeHoldStartedAtRef.current);
            const progress = Math.min(100, (elapsed / CLOSE_DAY_HOLD_MS) * 100);
            setCloseHoldProgress(progress);

            if (progress >= 100) {
                closeHoldRafRef.current = null;
                finalizeCloseDay();
                return;
            }
            closeHoldRafRef.current = window.requestAnimationFrame(tick);
        };

        closeHoldRafRef.current = window.requestAnimationFrame(tick);
    };

    const handleCloseHoldCancel = () => {
        if (closeHoldTriggeredRef.current) return;
        if (closeHoldRafRef.current !== null) {
            window.cancelAnimationFrame(closeHoldRafRef.current);
            closeHoldRafRef.current = null;
        }
        setCloseHoldProgress(0);
    };

    const handleOpenPauseMenu = () => {
        setShowMenu(false);
        setShowPauseMenu(true);
    };

    const handleStartPauseInternal = (pauseData) => {
        setShowPauseMenu(false);
        if (typeof onStartPause === 'function') {
            onStartPause(pauseData);
        }
    };

    const handleRequestResumeInternal = () => {
        setShowResumeModal(true);
        if (typeof onRequestResume === 'function') {
            onRequestResume();
        }
    };

    const handleConfirmResumeInternal = (checklist) => {
        setShowResumeModal(false);
        if (typeof onConfirmResume === 'function') {
            onConfirmResume(checklist);
        }
    };

    // ═══════════════════════════════════════════════════
    // PERIPHERAL VISION CLASSES
    // ═══════════════════════════════════════════════════
    const isPeripheralActive = peripheralState === 'wake' || peripheralState === 'matched' || peripheralState === 'success' || peripheralState === 'playing';
    
    let peripheralClass = "bg-slate-50"; // default
    let headerBgClass = "bg-white/95 border-slate-100";
    let textPrimaryClass = "text-slate-900";
    let textSecondaryClass = "text-green-600";
    let iconClass = "text-slate-600 hover:bg-slate-100 active:bg-slate-200";

    if (peripheralState === 'wake') {
        peripheralClass = "bg-amber-500 text-white transition-colors duration-500";
        headerBgClass = "bg-transparent border-transparent";
        textPrimaryClass = "text-white";
        textSecondaryClass = "text-amber-100";
        iconClass = "text-white hover:bg-white/10 active:bg-white/20";
    }
    if (peripheralState === 'matched' || peripheralState === 'success') {
        peripheralClass = "bg-emerald-500 text-white transition-colors duration-500";
        headerBgClass = "bg-transparent border-transparent";
        textPrimaryClass = "text-white";
        textSecondaryClass = "text-emerald-100";
        iconClass = "text-white hover:bg-white/10 active:bg-white/20";
    }
    if (peripheralState === 'playing') {
        peripheralClass = "bg-blue-500 text-white transition-colors duration-500";
        headerBgClass = "bg-transparent border-transparent";
        textPrimaryClass = "text-white";
        textSecondaryClass = "text-blue-100";
        iconClass = "text-white hover:bg-white/10 active:bg-white/20";
    }

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className={`min-h-screen ${peripheralClass} transition-colors duration-500`}>
            {/* ── Custom Header Slot (SyncHeader in prod, Sim banner in sim) ── */}
            {headerSlot}

            {/* ── Legacy Sticky Header ── */}
            {!hideMenu && !headerSlot && (
                <div className={`sticky top-0 backdrop-blur-md z-40 shadow-sm border-b transition-all ${headerBgClass}`}>
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0 pr-2">
                            <h1 className={`text-base font-bold leading-tight truncate transition-colors ${textPrimaryClass}`}>{missionInfo?.school_name || 'Operación'}</h1>
                            <p className={`text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 mt-0.5 transition-colors ${textSecondaryClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPeripheralActive ? 'bg-white' : 'bg-green-500'}`}></span>
                                {isSimulation ? 'En Operación' : 'En Operación'}
                            </p>
                        </div>

                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className={`p-2 -mr-2 rounded-full transition-colors ${iconClass}`}
                        >
                            <MoreVertical size={24} />
                        </button>
                    </div>

                    {showMenu && (
                        <div className="absolute top-full right-4 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <div className="p-2 space-y-1">
                                <button
                                    onClick={handleOpenPauseMenu}
                                    className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-lg flex items-center gap-3 text-amber-600 text-sm font-medium"
                                >
                                    <Pause size={18} /> Iniciar Pausa
                                </button>
                                {onChangeSchool && (
                                    <button
                                        onClick={() => { setShowMenu(false); onChangeSchool(); }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium"
                                    >
                                        <RotateCcw size={18} /> Cambiar Escuela
                                    </button>
                                )}
                                {onViewHistory && (
                                    <button
                                        onClick={() => { setShowMenu(false); onViewHistory(); }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium border-t border-slate-100"
                                    >
                                        <Clock size={18} /> Historial de Misiones
                                    </button>
                                )}
                                {onViewPOI && (
                                    <button
                                        onClick={() => { setShowMenu(false); onViewPOI(); }}
                                        className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg flex items-center gap-3 text-blue-600 text-sm font-medium border-t border-slate-100"
                                    >
                                        <span style={{ fontSize: 16 }}>📍</span> Puntos de Interés
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className={`mx-auto w-full max-w-lg space-y-2 px-4 pb-4 pt-[10px] transition-colors duration-500`}>
                
                {/* ── TIEMPO TOTAL DE OPERACIÓN (Plain text, Topmost) ── */}
                {showOperationTimer && (
                    <div className="flex items-center justify-center gap-2 pt-0 pb-1">
                        <p className={`text-[9px] font-bold uppercase tracking-[0.1em] transition-colors ${isPeripheralActive ? 'text-white/50' : 'text-slate-400'}`}>
                            Tiempo total de operación:
                        </p>
                        <p className={`text-[11px] font-black tabular-nums tracking-wider transition-colors ${isPeripheralActive ? 'text-white/80' : 'text-slate-700'}`}>
                            {(() => {
                                const total = Math.max(0, Math.floor(operationElapsedSeconds || 0));
                                const mins = Math.floor(total / 60).toString().padStart(2, '0');
                                const secs = (total % 60).toString().padStart(2, '0');
                                return `${mins}:${secs}`;
                            })()}
                        </p>
                    </div>
                )}

                {/* ── Sistema de Narración (Copiloto) ── */}
                {voiceSetIsActive && (
                    <CopilotOrbUI
                        ref={copilotRef}
                        pois={pois}
                        audioRef={voiceAudioRef}
                        playingPoiId={voicePlayingPoiId}
                        setPlayingPoiId={voiceSetPlayingPoiId}
                        isActive={voiceIsActive}
                        setIsActive={voiceSetIsActive}
                        onStateChange={handleVoiceStateChange}
                        isPeripheralActive={isPeripheralActive}
                    />
                )}

                {/* ── Flight Mini-Player (below Copilot Orb) ── */}
                <FlightMiniPlayer
                    flightPhase={flightPhase}
                    currentTrack={flightAudioCurrentTrack}
                    isPlaying={flightAudioIsPlaying}
                    isLoading={flightAudioIsLoading}
                    hasError={flightAudioHasError}
                    onTogglePlayPause={onFlightAudioTogglePlayPause}
                    onSkipTrack={onFlightAudioSkipTrack}
                    isPeripheralActive={isPeripheralActive}
                />

                {/* ── Preparar Cabina Button (First Touch — unlocks AudioContext) ── */}
                {flightPhase === 'cold' && flightAudioHasSoundtracks && !activeFlight && (
                    <div className="w-full max-w-[280px] mx-auto mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <button
                            type="button"
                            onClick={onPrepareCabin}
                            className={`w-full py-3.5 rounded-2xl text-sm font-extrabold tracking-wide flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.97] ${
                                isPeripheralActive
                                    ? 'bg-white/15 hover:bg-white/25 text-white/90 border border-white/20 backdrop-blur-md'
                                    : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50'
                            }`}
                        >
                            <span style={{ fontSize: '16px' }}>🎧</span>
                            Preparar Cabina
                        </button>
                    </div>
                )}

                {/* ── Flight Logger (core instrument) ── */}
                <div className="pt-4">
                    <MemoizedFlightLogger
                        key={activeFlight?.flightId ? `active-${activeFlight.flightId}` : 'idle-flight-logger'}
                        onFlightComplete={(data) => {
                            if (voiceSetIsActive && copilotRef.current) {
                                copilotRef.current.stopListening();
                            }
                            if (typeof onFlightComplete === 'function') {
                                return onFlightComplete(data);
                            }
                        }}
                        onFlightStart={(payload) => {
                            if (voiceSetIsActive && copilotRef.current) {
                                copilotRef.current.startListening();
                            }
                            if (typeof onFlightStart === 'function') {
                                return onFlightStart(payload);
                            }
                        }}
                        onFlightCancel={onFlightCancel}
                        initialActiveFlight={activeFlight}
                        nextFlightNumber={nextFlightNumber}
                        activeFlightNumber={activeFlightNumber}
                        showInterFlightTimer={showInterFlightTimer}
                        interFlightElapsedSeconds={interFlightElapsedSeconds}
                        totalStudentsFlown={totalStudentsFlown}
                        totalOperationElapsedSeconds={operationElapsedSeconds}
                        showTotalOperationTimer={showOperationTimer}
                        disabled={!!activePause}
                        pilotRecording={currentRole === 'pilot' && pilotRecording}
                        pilotMicPermission={currentRole === 'pilot' ? pilotMicPermission : null}
                        pilotMicSupported={currentRole === 'pilot' ? pilotMicSupported : false}
                        onRetryMicPermission={currentRole === 'pilot' ? onRetryMicPermission : null}
                        isPeripheralActive={isPeripheralActive}
                    />
                </div>


                {/* ── Pending Sync Badge ── */}
                {pendingSyncCount > 0 && (
                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3 animate-in fade-in duration-300">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <RotateCcw size={16} className="text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-amber-800 m-0">
                                {pendingSyncCount} vuelo{pendingSyncCount !== 1 ? 's' : ''} pendiente{pendingSyncCount !== 1 ? 's' : ''} de sincronizar
                            </p>
                            <p className="text-[10px] text-amber-600 m-0 mt-0.5">
                                Reintentando automáticamente cada 30 segundos...
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Today's Flight List (Pushed below the fold) ── */}
                <div className="mt-32 pt-8 border-t border-slate-200">
                    <TodayFlightList
                        flights={missionFlights}
                        pauses={completedPauses.filter(p => p.mission_id === missionInfo?.id)}
                        activeFlight={activeFlight}
                        onRequestEditFlight={canEditCompletedFlights ? onRequestEditFlight : null}
                        isPeripheralActive={isPeripheralActive}
                    />
                </div>

                {/* ── Close Operation Section ── */}
                <section className={`rounded-2xl border px-4 py-4 shadow-xl transition-all ${isPeripheralActive ? 'border-white/20 bg-white/10 backdrop-blur-md' : 'border-blue-200 bg-white shadow-[0_18px_36px_-24px_rgba(30,64,175,0.35)]'}`}>
                    <p className={`m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] transition-colors ${isPeripheralActive ? 'text-white/70' : 'text-slate-500'}`}>
                        {isSimulation ? 'Fin de simulación' : 'Cierre operativo'}
                    </p>
                    <p className={`mt-1 text-sm font-semibold transition-colors ${isPeripheralActive ? 'text-white' : 'text-slate-700'}`}>
                        {isSimulation
                            ? 'Cuando termines de practicar, cierra el simulador.'
                            : 'Cuando todo el registro de vuelos esté completo, cierra la operación de hoy.'}
                    </p>
                    <button
                        type="button"
                        onClick={openCloseConfirmModal}
                        className={`mt-3 w-full rounded-2xl px-4 py-3.5 text-sm font-extrabold tracking-wide text-white transition active:scale-[0.99] ${isPeripheralActive ? 'bg-white/20 hover:bg-white/30 backdrop-blur-md' : 'bg-blue-600 hover:bg-blue-700 shadow-[0_16px_28px_-18px_rgba(37,99,235,0.6)]'}`}
                    >
                        {isSimulation ? 'Finalizar simulación' : 'Operación finalizada'}
                    </button>
                </section>
            </div>

            {/* ── Overlay to close menu ── */}
            {!headerSlot && showMenu && (
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>
            )}

            {/* ── Close Confirmation Modal ── */}
            {showCloseConfirmModal && (
                <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-[2px] px-4 py-6 flex items-end justify-center sm:items-center">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_36px_72px_-34px_rgba(15,23,42,0.65)]">
                        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                            {isSimulation ? 'Confirmar salida' : 'Confirmar cierre'}
                        </p>
                        <h3 className="mt-1 text-xl font-black text-slate-900">
                            {isSimulation
                                ? '¿Salir del simulador?'
                                : '¿Seguro que deseas finalizar la operación?'}
                        </h3>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                            {isSimulation
                                ? 'Regresarás a la Academia. Ningún dato fue guardado.'
                                : 'Esta acción te llevará al flujo de cierre. Para evitar cierres accidentales, mantén presionado 2 segundos.'}
                        </p>

                        {closeOperationError && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                                <p className="text-xs font-bold text-red-700 m-0">Error</p>
                                <p className="text-xs text-red-600 m-0 mt-0.5">{closeOperationError}</p>
                            </div>
                        )}

                        <div className="mt-5 grid grid-cols-1 gap-2.5">
                            {isSimulation ? (
                                /* Simulation: simple tap, no hold needed */
                                <button
                                    type="button"
                                    onClick={finalizeCloseDay}
                                    disabled={isClosingOperation}
                                    className="relative overflow-hidden rounded-2xl bg-blue-600 px-4 py-3.5 text-center text-white shadow-[0_18px_30px_-18px_rgba(37,99,235,0.65)] transition active:scale-[0.99] text-sm font-extrabold tracking-wide disabled:opacity-60"
                                >
                                    Salir del simulador
                                </button>
                            ) : isClosingOperation ? (
                                <div className="relative overflow-hidden rounded-2xl bg-blue-700 px-4 py-4 text-center text-white shadow-[0_18px_30px_-18px_rgba(37,99,235,0.65)]">
                                    <span className="inline-flex items-center gap-2 text-sm font-extrabold tracking-wide">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Procesando...
                                    </span>
                                    <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                                        <span className="block h-full w-full rounded-full bg-white" />
                                    </span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onMouseDown={handleCloseHoldStart}
                                    onMouseUp={handleCloseHoldCancel}
                                    onMouseLeave={handleCloseHoldCancel}
                                    onTouchStart={handleCloseHoldStart}
                                    onTouchEnd={handleCloseHoldCancel}
                                    onTouchCancel={handleCloseHoldCancel}
                                    onTouchMove={(e) => e.preventDefault()}
                                    style={{ touchAction: 'none' }}
                                    className="relative overflow-hidden rounded-2xl bg-blue-600 px-4 py-3.5 text-left text-white shadow-[0_18px_30px_-18px_rgba(37,99,235,0.65)] transition active:scale-[0.99]"
                                >
                                    <span className="block text-sm font-extrabold tracking-wide">
                                        {closeOperationError ? 'Reintentar' : 'Operación finalizada'}
                                    </span>
                                    <span className="mt-0.5 block text-xs font-semibold text-blue-100">
                                        Mantén presionado por 2s para confirmar
                                    </span>
                                    <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                                        <span
                                            className="block h-full rounded-full bg-white transition-[width] duration-75"
                                            style={{ width: `${closeHoldProgress}%` }}
                                        />
                                    </span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={closeCloseConfirmModal}
                                disabled={isClosingOperation}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Pause Menu Modal ── */}
            <PauseMenu
                isOpen={showPauseMenu}
                onClose={() => setShowPauseMenu(false)}
                onStartPause={handleStartPauseInternal}
            />

            {/* ── Pause Active Overlay ── */}
            {activePause && (
                <PauseActiveOverlay
                    pauseData={activePause}
                    onRequestResume={handleRequestResumeInternal}
                />
            )}

            {/* ── Resume Protocol Modal ── */}
            <ResumeProtocolModal
                isOpen={showResumeModal}
                onClose={() => setShowResumeModal(false)}
                onConfirmResume={handleConfirmResumeInternal}
            />

            {/* ── Escuadrón Slot (overlays injected by smart container) ── */}
            {escuadronSlot}
        </div>
    );
}
