'use client';

// =====================================================
// StaffOperationLegacy.js
// Componente extraído del dashboard original de staff.
// Preserva TODA la funcionalidad existente de vuelos, pausas y menú.
// Acepta props opcionales para integración con el nuevo stepper.
// =====================================================

import { useState, useEffect } from 'react';
import TodayFlightList from '@/components/staff/TodayFlightList';
import FlightLogger from '@/components/staff/FlightLogger';
import { syncFlightLog, syncPauseStart, syncPauseEnd } from '@/utils/staff/sync';
import { LogOut, MoreVertical, RotateCcw, Clock, Pause } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import MissionSelector from '@/components/staff/MissionSelector';
import PauseMenu from '@/components/staff/PauseMenu';
import PauseActiveOverlay from '@/components/staff/PauseActiveOverlay';
import ResumeProtocolModal from '@/components/staff/ResumeProtocolModal';

export default function StaffOperationLegacy({ initialMission = null, onCloseDay = null, hideMenu = false, preview = false }) {
    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const [flightLogs, setFlightLogs] = useState([]);
    const [showMenu, setShowMenu] = useState(false);

    // Pause State
    const [showPauseMenu, setShowPauseMenu] = useState(false);
    const [activePause, setActivePause] = useState(null);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [completedPauses, setCompletedPauses] = useState([]);

    const router = useRouter();

    useEffect(() => {
        // Si viene una misión inicial (auto-detectada), usarla
        if (initialMission) {
            setCurrentMission({
                ...initialMission,
                school_name: initialMission.school_name || initialMission.nombre_escuela
            });
        }

        // Preview: no restaurar localStorage
        if (preview) {
            setIsRestoring(false);
            return;
        }

        // Restaurar desde localStorage
        const savedMission = localStorage.getItem('flyhigh_staff_mission');
        const savedLogs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
        const savedPause = localStorage.getItem('flyhigh_active_pause');
        const savedCompletedPauses = JSON.parse(localStorage.getItem('flyhigh_completed_pauses') || '[]');

        if (!initialMission && savedMission) {
            try {
                setCurrentMission(JSON.parse(savedMission));
                setFlightLogs(savedLogs);
            } catch (e) {
                console.error("Failed to restore mission", e);
            }
        } else {
            setFlightLogs(savedLogs);
        }

        if (savedPause) {
            try { setActivePause(JSON.parse(savedPause)); } catch (e) { console.error("Failed to restore pause", e); }
        }

        setCompletedPauses(savedCompletedPauses);
        setIsRestoring(false);
    }, [initialMission, preview]);

    // Keep session alive (skip in preview)
    useEffect(() => {
        if (preview) return;
        const supabase = createClient();
        supabase.auth.refreshSession();

        const intervalId = setInterval(() => {
            if (navigator.onLine) {
                supabase.auth.refreshSession().then(({ error }) => {
                    if (error) console.warn("Session refresh failed:", error);
                });
            }
        }, 10 * 60 * 1000);

        const handleOnline = () => {
            supabase.auth.refreshSession();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, [preview]);

    const handleSelectMission = (mission) => {
        setCurrentMission(mission);
        if (!preview) localStorage.setItem('flyhigh_staff_mission', JSON.stringify(mission));
    };

    const handleLogout = async () => {
        if (preview) return;
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('flyhigh_staff_mission');
        router.push('/staff/login');
    };

    const handleChangeSchool = () => {
        if (preview) { setCurrentMission(null); setShowMenu(false); return; }
        if (confirm("¿Seguro que quieres cambiar de escuela?")) {
            setCurrentMission(null);
            localStorage.removeItem('flyhigh_staff_mission');
            setShowMenu(false);
        }
    };

    const handleCloseDay = () => {
        if (onCloseDay) {
            onCloseDay();
        } else {
            router.push('/staff/closure');
        }
        setShowMenu(false);
    };

    const handleOpenPauseMenu = () => {
        setShowMenu(false);
        setShowPauseMenu(true);
    };

    const handleStartPause = async (pauseData) => {
        // Preview: solo actualizar UI, no sincronizar
        if (preview) {
            setActivePause({
                type: pauseData.type,
                reason: pauseData.reason,
                startTime: new Date().toISOString(),
                pauseId: `preview-${Date.now()}`
            });
            return;
        }

        const result = await syncPauseStart({
            ...pauseData,
            mission_id: currentMission.id
        });

        setActivePause({
            type: pauseData.type,
            reason: pauseData.reason,
            startTime: new Date().toISOString(),
            pauseId: result.pauseId || `local-${Date.now()}`
        });

        localStorage.setItem('flyhigh_active_pause', JSON.stringify({
            type: pauseData.type,
            reason: pauseData.reason,
            startTime: new Date().toISOString(),
            pauseId: result.pauseId || `local-${Date.now()}`
        }));
    };

    const handleRequestResume = () => {
        setShowResumeModal(true);
    };

    const handleConfirmResume = async (resumeChecklist) => {
        // Preview: solo actualizar UI
        if (preview) {
            const completedPause = { ...activePause, endTime: new Date().toISOString(), resumeChecklist };
            setCompletedPauses(prev => [...prev, completedPause]);
            setActivePause(null);
            setShowResumeModal(false);
            return;
        }

        if (activePause?.pauseId) {
            await syncPauseEnd(activePause.pauseId, resumeChecklist);
        }

        const completedPause = {
            ...activePause,
            mission_id: currentMission?.id,
            endTime: new Date().toISOString(),
            resumeChecklist
        };
        const updatedPauses = [...completedPauses, completedPause];
        setCompletedPauses(updatedPauses);
        localStorage.setItem('flyhigh_completed_pauses', JSON.stringify(updatedPauses));

        setActivePause(null);
        setShowResumeModal(false);
        localStorage.removeItem('flyhigh_active_pause');
    };

    const handleFlightComplete = async (data) => {
        // Preview: solo actualizar UI local, no guardar en localStorage ni sincronizar
        if (preview) {
            const newLog = { ...data, id: Date.now(), synced: false };
            setFlightLogs(prev => [...prev, newLog]);
            return;
        }

        const existingLogs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
        const newLog = {
            ...data,
            mission_id: currentMission.id,
            mission_data: currentMission,
            id: Date.now(),
            synced: false
        };
        const updatedLogs = [...existingLogs, newLog];

        localStorage.setItem('flyhigh_flight_logs', JSON.stringify(updatedLogs));
        setFlightLogs(updatedLogs);

        if (navigator.onLine) {
            const success = await syncFlightLog(newLog);
            if (success) {
                newLog.synced = true;
                const syncedLogs = updatedLogs.map(l => l.id === newLog.id ? newLog : l);
                localStorage.setItem('flyhigh_flight_logs', JSON.stringify(syncedLogs));
                setFlightLogs(syncedLogs);
            } else {
                alert("⚠️ AVISO: El vuelo se guardó en tu dispositivo, pero falló la sincronización con la nube.\n\nPor favor, verifica tu conexión o vuelve a iniciar sesión si persiste.");
            }
        }
    };

    if (isRestoring) return null;

    if (!currentMission) {
        return (
            <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4">
                <MissionSelector onSelect={handleSelectMission} />

                {!hideMenu && (
                    <div className="mt-12 text-center pb-8 border-t border-slate-100 pt-8 space-y-4">
                        <button
                            onClick={() => router.push('/staff/history')}
                            className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
                        >
                            <Clock size={18} /> Ver Historial de Misiones
                        </button>

                        <button onClick={handleLogout} className="text-sm text-slate-400 underline hover:text-slate-600 flex items-center justify-center gap-2 mx-auto p-4">
                            <LogOut size={16} /> Cerrar Sesión Staff
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Sticky Header */}
            {!hideMenu && (
                <div className="sticky top-0 bg-white/95 backdrop-blur-md z-40 shadow-sm border-b border-slate-100 transition-all">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0 pr-2">
                            <h1 className="text-base font-bold text-slate-900 leading-tight truncate">{currentMission.school_name}</h1>
                            <p className="text-[10px] text-green-600 font-bold tracking-wide uppercase flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                En Operación
                            </p>
                        </div>

                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-full active:bg-slate-200"
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
                                <button
                                    onClick={handleChangeSchool}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium"
                                >
                                    <RotateCcw size={18} /> Cambiar Escuela
                                </button>
                                <button
                                    onClick={handleCloseDay}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium"
                                >
                                    <LogOut size={18} /> Cerrar Día / Misión
                                </button>
                                <button
                                    onClick={() => router.push('/staff/history')}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium border-t border-slate-100"
                                >
                                    <Clock size={18} /> Historial de Misiones
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="px-4 py-6 space-y-8 max-w-lg mx-auto">
                <FlightLogger onFlightComplete={handleFlightComplete} disabled={!!activePause} />

                <div className="pt-4 border-t border-slate-200">
                    <TodayFlightList
                        flights={flightLogs}
                        pauses={completedPauses.filter(p => p.mission_id === currentMission?.id)}
                    />
                </div>
            </div>

            {/* Overlay to close menu */}
            {showMenu && (
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>
            )}

            {/* Pause Menu Modal */}
            <PauseMenu
                isOpen={showPauseMenu}
                onClose={() => setShowPauseMenu(false)}
                onStartPause={handleStartPause}
            />

            {/* Pause Active Overlay */}
            {activePause && (
                <PauseActiveOverlay
                    pauseData={activePause}
                    onRequestResume={handleRequestResume}
                />
            )}

            {/* Resume Protocol Modal */}
            <ResumeProtocolModal
                isOpen={showResumeModal}
                onClose={() => setShowResumeModal(false)}
                onConfirmResume={handleConfirmResume}
            />
        </div>
    );
}
