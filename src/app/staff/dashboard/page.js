'use client';

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

export default function StaffDashboard() {
    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const [flightLogs, setFlightLogs] = useState([]);
    const [showMenu, setShowMenu] = useState(false);

    // Pause State
    const [showPauseMenu, setShowPauseMenu] = useState(false);
    const [activePause, setActivePause] = useState(null); // { type, reason, startTime, pauseId }
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [completedPauses, setCompletedPauses] = useState([]); // Track finished pauses for timeline

    const router = useRouter();

    useEffect(() => {
        // Try to restore mission from localStorage on mount
        const savedMission = localStorage.getItem('flyhigh_staff_mission');
        const savedLogs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
        const savedPause = localStorage.getItem('flyhigh_active_pause');
        const savedCompletedPauses = JSON.parse(localStorage.getItem('flyhigh_completed_pauses') || '[]');

        if (savedMission) {
            try {
                setCurrentMission(JSON.parse(savedMission));
                setFlightLogs(savedLogs);
            } catch (e) {
                console.error("Failed to restore mission", e);
            }
        }

        // Restore active pause if exists
        if (savedPause) {
            try {
                setActivePause(JSON.parse(savedPause));
            } catch (e) {
                console.error("Failed to restore pause", e);
            }
        }

        // Restore completed pauses
        setCompletedPauses(savedCompletedPauses);

        setIsRestoring(false);
    }, []);

    // Keep session alive with periodic refresh + reconnection handler
    useEffect(() => {
        const supabase = createClient();

        // Refresh session immediately on mount
        supabase.auth.refreshSession();

        // Refresh session every 10 minutes to prevent expiry
        const intervalId = setInterval(() => {
            if (navigator.onLine) {
                supabase.auth.refreshSession().then(({ error }) => {
                    if (error) console.warn("Session refresh failed:", error);
                    else console.log("Session refreshed successfully");
                });
            }
        }, 10 * 60 * 1000); // 10 minutes

        // Refresh session immediately when internet connection is restored
        const handleOnline = () => {
            console.log("🌐 Conexión restaurada. Refrescando sesión...");
            supabase.auth.refreshSession().then(({ error }) => {
                if (error) {
                    console.warn("Session refresh after reconnect failed:", error);
                } else {
                    console.log("✅ Sesión refrescada exitosamente tras reconexión");
                }
            });
        };

        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    const handleSelectMission = (mission) => {
        setCurrentMission(mission);
        localStorage.setItem('flyhigh_staff_mission', JSON.stringify(mission));
        // Load logs for this mission potentially? For now simple local storage.
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('flyhigh_staff_mission');
        router.push('/staff/login');
    };

    const handleChangeSchool = () => {
        if (confirm("¿Seguro que quieres cambiar de escuela?")) {
            setCurrentMission(null);
            localStorage.removeItem('flyhigh_staff_mission');
            setShowMenu(false);
        }
    };

    const handleCloseDay = () => {
        router.push('/staff/closure');
        setShowMenu(false);
    };

    const handleOpenPauseMenu = () => {
        setShowMenu(false);
        setShowPauseMenu(true);
    };

    const handleStartPause = async (pauseData) => {
        // Sync pause start to DB
        const result = await syncPauseStart({
            ...pauseData,
            mission_id: currentMission.id
        });

        // Set active pause state
        setActivePause({
            type: pauseData.type,
            reason: pauseData.reason,
            startTime: new Date().toISOString(),
            pauseId: result.pauseId || `local-${Date.now()}`
        });

        // Save to localStorage for persistence
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
        if (activePause?.pauseId) {
            await syncPauseEnd(activePause.pauseId, resumeChecklist);
        }

        // Save completed pause to timeline (with mission_id for filtering)
        const completedPause = {
            ...activePause,
            mission_id: currentMission?.id,
            endTime: new Date().toISOString(),
            resumeChecklist
        };
        const updatedPauses = [...completedPauses, completedPause];
        setCompletedPauses(updatedPauses);
        localStorage.setItem('flyhigh_completed_pauses', JSON.stringify(updatedPauses));

        // Clear active pause state
        setActivePause(null);
        setShowResumeModal(false);
        localStorage.removeItem('flyhigh_active_pause');
    };

    const handleFlightComplete = async (data) => {
        // 1. Save Local (Optimistic)
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

        // 2. Try Sync
        if (navigator.onLine) {
            const success = await syncFlightLog(newLog);
            if (success) {
                // Update local log to marked as synced
                newLog.synced = true;
                const syncedLogs = updatedLogs.map(l => l.id === newLog.id ? newLog : l);
                localStorage.setItem('flyhigh_flight_logs', JSON.stringify(syncedLogs));
                setFlightLogs(syncedLogs);
            } else {
                // Sync failed
                alert("⚠️ AVISO: El vuelo se guardó en tu dispositivo, pero falló la sincronización con la nube.\n\nPosibles causas:\n1. No tienes internet.\n2. Tu sesión expiró (Modo Test sin login).\n\nPor favor, verifica tu conexión o vuelve a iniciar sesión si persiste.");
            }
        }
    };

    if (isRestoring) return null;

    if (!currentMission) {
        return (
            <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4">
                <MissionSelector onSelect={handleSelectMission} />

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
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Improved Sticky Header */}
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

                {/* Dropdown Menu */}
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
