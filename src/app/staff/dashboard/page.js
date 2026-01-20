'use client';

import { useState, useEffect } from 'react';
import TodayFlightList from '@/components/staff/TodayFlightList';
import FlightLogger from '@/components/staff/FlightLogger';
import { syncFlightLog } from '@/utils/staff/sync';
import { LogOut, MoreVertical, RotateCcw, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import MissionSelector from '@/components/staff/MissionSelector';

export default function StaffDashboard() {
    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const [flightLogs, setFlightLogs] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Try to restore mission from localStorage on mount
        const savedMission = localStorage.getItem('flyhigh_staff_mission');
        const savedLogs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');

        if (savedMission) {
            try {
                setCurrentMission(JSON.parse(savedMission));
                setFlightLogs(savedLogs);
            } catch (e) {
                console.error("Failed to restore mission", e);
            }
        }
        setIsRestoring(false);
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
                <FlightLogger onFlightComplete={handleFlightComplete} />

                <div className="pt-4 border-t border-slate-200">
                    <TodayFlightList flights={flightLogs} />
                </div>
            </div>

            {/* Overlay to close menu */}
            {showMenu && (
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>
            )}
        </div>
    );
}
