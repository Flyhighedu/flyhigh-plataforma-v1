'use client';

import { useState, useEffect } from 'react';
import MissionSelector from '@/components/staff/MissionSelector';
import FlightLogger from '@/components/staff/FlightLogger';
import { LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function StaffDashboard() {
    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Try to restore mission from localStorage on mount
        const savedMission = localStorage.getItem('flyhigh_staff_mission');
        if (savedMission) {
            try {
                setCurrentMission(JSON.parse(savedMission));
            } catch (e) {
                console.error("Failed to restore mission", e);
            }
        }
        setIsRestoring(false);
    }, []);

    const handleSelectMission = (mission) => {
        setCurrentMission(mission);
        localStorage.setItem('flyhigh_staff_mission', JSON.stringify(mission));
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('flyhigh_staff_mission'); // Optional: Clear session context
        router.push('/staff/login');
    };

    const handleCloseMission = () => {
        // This would trigger the End of Day flow usually, 
        // but for dev purposes allows re-selecting
        if (confirm("¿Seguro que quieres cerrar la misión actual?")) {
            setCurrentMission(null);
            localStorage.removeItem('flyhigh_staff_mission');
        }
    };

    if (isRestoring) return null; // Avoid hydration mismatch

    if (!currentMission) {
        return (
            <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MissionSelector onSelect={handleSelectMission} />

                <div className="mt-12 text-center">
                    <button onClick={handleLogout} className="text-sm text-slate-400 underline hover:text-slate-600 flex items-center justify-center gap-2 mx-auto">
                        <LogOut size={14} /> Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    // IF MISSION SELECTED -> SHOW FLIGHT LOGGER DASHBOARD
    return (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
            {/* Header Context */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 sticky top-14 bg-slate-50 z-10 pt-2 transition-all">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 leading-tight">{currentMission.school_name}</h1>
                    <p className="text-xs text-slate-500">Operación Activa</p>
                </div>
                <button onClick={handleCloseMission} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium hover:bg-slate-200">
                    Cambiar
                </button>
            </div>

            <FlightLogger onFlightComplete={(data) => {
                const existingLogs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
                const newLog = { ...data, mission_id: currentMission.id, id: Date.now() };
                localStorage.setItem('flyhigh_flight_logs', JSON.stringify([...existingLogs, newLog]));
                alert("¡Vuelo registrado! Total hoy: " + (existingLogs.length + 1));
            }} />

            <div className="pt-8 pb-4 border-t border-slate-200">
                <button
                    onClick={() => router.push('/staff/closure')}
                    className="w-full py-4 text-center rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-colors"
                >
                    CERRAR MISIÓN (Fin del día)
                </button>
            </div>
        </div>
    );
}
