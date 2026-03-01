'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Loader2 } from 'lucide-react';

export default function StartDemoFab({ onDemoStarted }) {
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
                method: 'POST',
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al iniciar demo');
            }

            const data = await response.json();
            console.log('Demo started:', data);

            if (onDemoStarted) onDemoStarted();

            // Force a UI update just in case
            setLoading(false);
            alert('Escuela Demo iniciada. Esperando sincronización...');

        } catch (error) {
            console.error('Error starting demo:', error);
            alert(`Error: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
            {/* Instruction tooltip */}
            <div className={`
                bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-xl
                transition-all duration-300 ease-out transform
                ${isHolding ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
            `}>
                Mantén presionado para iniciar
            </div>

            <button
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={startHold}
                onTouchEnd={stopHold}
                onContextMenu={(e) => e.preventDefault()}
                disabled={loading}
                className={`
                    relative group flex items-center justify-center p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)]
                    transition-all duration-300 select-none overflow-hidden border border-slate-100
                    ${loading ? 'bg-slate-50 scale-95' : 'bg-white hover:scale-105 active:scale-95'}
                    ${isHolding ? 'scale-105 ring-0' : ''}
                `}
                title="Mantén presionado para iniciar Demo"
            >
                {/* Clean Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-100"></div>

                {/* Progress Fill (Background) */}
                <div
                    className="absolute bottom-0 left-0 w-full bg-[#137fec]/10 transition-all duration-75 ease-linear"
                    style={{ height: `${progress}%` }}
                ></div>

                {/* Button Content */}
                <div className="relative z-10 flex items-center gap-3 px-1">
                    <div className="flex items-center justify-center">
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-[#137fec]" />
                        ) : (
                            <Play className={`w-6 h-6 fill-[#137fec] text-[#137fec] transition-transform ${isHolding ? 'scale-125' : ''}`} />
                        )}
                    </div>

                    <div className="text-left hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Modo Prueba</p>
                        <p className="text-sm font-bold text-slate-900 leading-none">Iniciar Demo</p>
                    </div>

                    {/* Mobile Text (Alternative) */}
                    <span className="text-sm font-bold text-slate-700 sm:hidden">
                        {loading ? 'Iniciando...' : 'Demo'}
                    </span>
                </div>

                {/* Progress Border (Optional detailed ring) */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none opacity-0 sm:opacity-100">
                    <rect
                        x="1" y="1" width="100%" height="100%" rx="16"
                        fill="none"
                        stroke="#137fec"
                        strokeWidth="3"
                        strokeDasharray="300" // approx circumference
                        strokeDashoffset={300 - (300 * progress) / 100}
                        className={`transition-all duration-75 ${progress > 0 ? 'opacity-100' : 'opacity-0'}`}
                    />
                </svg>
            </button>
        </div>
    );
}
