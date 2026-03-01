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

            if (onDemoStarted) onDemoStarted();

            // Force a UI update just in case
            setLoading(false);
            alert(isDemoMode ? 'Saliendo de modo demo. Regresando a misión real...' : 'Escuela Demo iniciada. Esperando sincronización...');

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
                    relative group flex items-center justify-center p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                    transition-all duration-300 select-none overflow-hidden border border-slate-100
                    ${loading ? 'bg-slate-50 scale-95' : 'bg-white hover:scale-105 active:scale-95'}
                    ${isHolding ? 'scale-105 ring-0' : ''}
                `}
                style={{ touchAction: 'none' }}
                title={isDemoMode ? "Mantén para Salir" : "Mantén para iniciar Demo"}
            >
                {/* Clean Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-100"></div>

                {/* Progress Fill (Background) */}
                <div
                    className={`absolute bottom-0 left-0 w-full transition-all duration-75 ease-linear ${isDemoMode ? 'bg-red-500/10' : 'bg-[#137fec]/10'}`}
                    style={{ height: `${progress}%` }}
                ></div>

                {/* Button Content */}
                <div className="relative z-10 flex items-center gap-3 px-1">
                    <div className="flex items-center justify-center">
                        {loading ? (
                            <Loader2 className={`w-6 h-6 animate-spin ${isDemoMode ? 'text-red-600' : 'text-[#137fec]'}`} />
                        ) : isDemoMode ? (
                            <LogOut className={`w-6 h-6 text-red-600 transition-transform ${isHolding ? 'scale-125' : ''}`} />
                        ) : (
                            <Play className={`w-6 h-6 fill-[#137fec] text-[#137fec] transition-transform ${isHolding ? 'scale-125' : ''}`} />
                        )}
                    </div>

                    <div className="text-left hidden sm:block">
                        <p className={`text-[10px] font-bold uppercase tracking-widest leading-none mb-0.5 ${isDemoMode ? 'text-red-400' : 'text-slate-400'}`}>
                            {isDemoMode ? 'Modo Demo Activo' : 'Modo Prueba'}
                        </p>
                        <p className={`text-sm font-bold leading-none ${isDemoMode ? 'text-red-700' : 'text-slate-900'}`}>
                            {isDemoMode ? 'Salir de Modo Demo' : 'Iniciar Demo'}
                        </p>
                    </div>

                    {/* Mobile Text (Alternative) */}
                    <span className={`text-sm font-bold sm:hidden ${isDemoMode ? 'text-red-600' : 'text-slate-700'}`}>
                        {loading ? '...' : isDemoMode ? 'Salir' : 'Demo'}
                    </span>
                </div>

                {/* Progress Border (Optional detailed ring) */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none opacity-0 sm:opacity-100">
                    <rect
                        x="1" y="1" width="100%" height="100%" rx="16"
                        fill="none"
                        stroke={isDemoMode ? "#dc2626" : "#137fec"}
                        strokeWidth="3"
                        strokeDasharray="300" // approx circumference
                        strokeDashoffset={300 - (300 * progress) / 100}
                        className={`transition-all duration-75 ${progress > 0 ? 'opacity-100' : 'opacity-0'}`}
                    />
                </svg>
            </button>
        </div >
    );
}
