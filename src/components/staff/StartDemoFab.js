'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Loader2, LogOut } from 'lucide-react';
import { TEST_SCHOOL_ID } from '@/utils/testModeUtils';

export default function StartDemoFab({ onDemoStarted, minimal = false, schoolId }) {
    const isDemoMode = String(schoolId) === String(TEST_SCHOOL_ID);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const intervalRef = useRef(null);
    const HOLD_DURATION = 3000; // 3 seconds

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const startHold = () => {
        if (loading) return;
        setIsHolding(true);
        setProgress(0);

        const startTime = Date.now();
        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                completeHold();
            }
        }, 50);
    };

    const stopHold = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsHolding(false);
        setProgress(0);
    };

    const completeHold = async () => {
        stopHold();
        setLoading(true);

        try {
            const response = await fetch('/api/staff/deploy-demo', {
                method: isDemoMode ? 'DELETE' : 'POST',
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Error al ${isDemoMode ? 'salir de' : 'iniciar'} demo`);
            }

            const data = await response.json();
            console.log('Demo action completed:', data);

            // Save mission ID so refreshMission auto-selects it (prevents race condition)
            if (!isDemoMode) {
                localStorage.setItem('flyhigh_selected_mission_id', String(TEST_SCHOOL_ID));
                if (onDemoStarted) onDemoStarted();
                setLoading(false);
            } else {
                // EXIT DEMO: clean everything and redirect to lobby
                localStorage.removeItem('flyhigh_selected_mission_id');
                localStorage.removeItem('flyhigh_staff_mission');
                localStorage.removeItem('flyhigh_active_journey_id');
                localStorage.removeItem('flyhigh_test_mode');
                window.location.href = '/staff/dashboard';
                return; // Don't continue — page is navigating
            }

        } catch (error) {
            console.error('Error in demo action:', error);
            alert(`Error: ${error.message}`);
            setLoading(false);
        }
    };

    if (minimal) {
        return (
            <button
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onContextMenu={(e) => e.preventDefault()}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors relative overflow-hidden group select-none ${isDemoMode ? 'text-red-600' : ''}`}
                title={isDemoMode ? "Mantén presionado para Salir de Modo Demo" : "Mantén presionado para iniciar Demo"}
            >
                {/* Progress Fill Background */}
                <div
                    className={`absolute inset-0 transition-all duration-75 ease-linear origin-left ${isDemoMode ? 'bg-red-50/50' : 'bg-blue-50/50'}`}
                    style={{ width: `${progress}%` }}
                />

                <div className={`p-2 rounded-lg relative z-10 box-border ${loading ? 'bg-slate-100' : isDemoMode ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : isDemoMode ? <LogOut size={18} /> : <Play size={18} className={isDemoMode ? '' : 'fill-blue-600'} />}
                </div>

                <div className="relative z-10">
                    <p className={`text-sm font-semibold leading-tight ${loading ? 'text-slate-700' : isDemoMode ? 'text-red-700 group-hover:text-red-900' : 'text-slate-700 group-hover:text-slate-900'}`}>
                        {loading ? 'Procesando...' : isDemoMode ? 'Salir de Modo Demo' : 'Iniciar Demo'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight">Mantén presionado 3s</p>
                </div>
            </button>
        );
    }

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
            {/* Instruction tooltip */}
            <div className={`
                ${isDemoMode ? 'bg-red-900' : 'bg-slate-900'} text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-xl
                transition-all duration-300 ease-out transform
                ${isHolding ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
            `}>
                {isDemoMode ? 'Mantén para salir' : 'Mantén para iniciar'}
            </div>

            <button
                onPointerDown={(e) => {
                    console.log('pointerdown startHold');
                    startHold();
                }}
                onPointerUp={(e) => {
                    console.log('pointerup stopHold');
                    stopHold();
                }}
                onPointerLeave={(e) => {
                    console.log('pointerleave stopHold');
                    stopHold();
                }}
                onContextMenu={(e) => e.preventDefault()}
                disabled={loading}
                className={`
                    relative group flex items-center justify-center p-3.5 pr-6 rounded-full 
                    transition-all duration-300 select-none overflow-hidden
                    ${loading ? 'bg-slate-50 shadow-[inset_4px_4px_10px_#d1d5db,inset_-4px_-4px_10px_#ffffff] scale-95' : 
                             'bg-slate-50 shadow-[6px_6px_16px_#cbd5e1,-6px_-6px_16px_#ffffff] hover:shadow-[4px_4px_12px_#cbd5e1,-4px_-4px_12px_#ffffff] active:shadow-[inset_4px_4px_10px_#cbd5e1,inset_-4px_-4px_10px_#ffffff] hover:-translate-y-0.5'}
                    ${isHolding ? 'shadow-[inset_4px_4px_10px_#cbd5e1,inset_-4px_-4px_10px_#ffffff] translate-y-0' : ''}
                `}
                style={{ touchAction: 'none' }}
                title={isDemoMode ? "Mantén para Salir" : "Mantén para iniciar Demo"}
            >
                {/* Clean Background */}
                <div className="absolute inset-0 bg-slate-50 opacity-100"></div>

                {/* Progress Fill (Background) - Subtle fill */}
                <div
                    className={`absolute bottom-0 left-0 w-full transition-all duration-75 ease-linear ${isDemoMode ? 'bg-red-500/10' : 'bg-blue-600/10'}`}
                    style={{ height: `${progress}%` }}
                ></div>

                {/* Button Content */}
                <div className="relative z-10 flex items-center gap-4 px-1">
                    <div className="flex items-center justify-center">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-[inset_3px_3px_8px_#cbd5e1,inset_-3px_-3px_8px_#ffffff] bg-slate-50 ${isDemoMode ? 'text-red-600' : 'text-blue-600'}`}>
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isDemoMode ? (
                                <LogOut className={`w-5 h-5 transition-transform ${isHolding ? 'scale-125' : ''}`} />
                            ) : (
                                <Play className={`w-5 h-5 fill-blue-600 transition-transform ${isHolding ? 'scale-125' : 'ml-0.5'}`} />
                            )}
                        </div>
                    </div>

                    <div className="text-left hidden sm:block">
                        <p className={`text-[9.5px] font-extrabold uppercase tracking-widest leading-none mb-1 ${isDemoMode ? 'text-red-400' : 'text-slate-400'}`}>
                            {isDemoMode ? 'Entrenamiento' : 'Simulador'}
                        </p>
                        <p className={`text-[15px] font-black tracking-tight leading-none ${isDemoMode ? 'text-red-600' : 'text-slate-600 group-hover:text-blue-600 transition-colors'}`}>
                            {isDemoMode ? 'Finalizar Demo' : 'Modo Pruebas'}
                        </p>
                    </div>

                {/* Mobile Text (Alternative) */}
                <span className={`text-[15px] font-black tracking-tight sm:hidden ${isDemoMode ? 'text-red-600' : 'text-slate-600'}`}>
                    {loading ? '...' : isDemoMode ? 'Finalizar' : 'Demo'}
                </span>
                </div>
            </button>
        </div >
    );
}
