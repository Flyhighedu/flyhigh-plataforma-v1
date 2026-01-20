'use client';

import { useState, useEffect } from 'react';
import TodayFlightList from '@/components/staff/TodayFlightList';

export default function StaffDashboard() {
    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const [flightLogs, setFlightLogs] = useState([]);
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

    const handleCloseMission = () => {
        if (confirm("¿Seguro que quieres cambiar de escuela?")) {
            setCurrentMission(null);
            localStorage.removeItem('flyhigh_staff_mission');
        }
    };

    const handleFlightComplete = (data) => {
        const existingLogs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
        const newLog = { ...data, mission_id: currentMission.id, id: Date.now() };
        const updatedLogs = [...existingLogs, newLog];

        localStorage.setItem('flyhigh_flight_logs', JSON.stringify(updatedLogs));
        setFlightLogs(updatedLogs); // Update state to trigger re-render

        // Removed intrusive alert
        // alert("¡Vuelo registrado! Total hoy: " + (existingLogs.length + 1)); 
    };

    if (isRestoring) return null;

    if (!currentMission) {
        return (
            <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4">
                <MissionSelector onSelect={handleSelectMission} />

                <div className="mt-12 text-center pb-8">
                    <button onClick={handleLogout} className="text-sm text-slate-400 underline hover:text-slate-600 flex items-center justify-center gap-2 mx-auto p-4">
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in zoom-in-95 duration-300 pb-20">
            {/* Improved Header Context */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-30 pt-4 px-4 shadow-sm">
                <div className="flex-1 min-w-0 pr-4">
                    <h1 className="text-lg font-bold text-slate-900 leading-tight truncate">{currentMission.school_name}</h1>
                    <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Operación Activa
                    </p>
                </div>
                <button
                    onClick={handleCloseMission}
                    className="flex-shrink-0 text-xs bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold hover:bg-slate-200 active:bg-slate-300 transition-colors"
                >
                    Cambiar
                </button>
            </div>

            <div className="px-4 space-y-8">
                <FlightLogger onFlightComplete={handleFlightComplete} />

                <TodayFlightList flights={flightLogs} />

                <div className="pt-8 pb-4 border-t border-slate-200">
                    <div className="bg-slate-50 rounded-2xl p-6 text-center space-y-4">
                        <p className="text-sm text-slate-500">¿Terminaste por hoy?</p>
                        <button
                            onClick={() => router.push('/staff/closure')}
                            className="w-full py-4 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-200 hover:border-slate-400 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={20} /> IR AL CIERRE DE MISIÓN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
