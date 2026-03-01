'use client';

import { useState, useEffect } from 'react';
import { Pause, Play, Clock, Coffee, AlertTriangle } from 'lucide-react';

export default function PauseActiveOverlay({ pauseData, onRequestResume }) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!pauseData?.startTime) return;

        // Calculate initial elapsed time
        const startTime = new Date(pauseData.startTime).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - startTime) / 1000));

        // Update every second
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setElapsedSeconds(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [pauseData?.startTime]);

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const isReceso = pauseData?.type === 'receso';
    const bgColor = isReceso ? 'from-amber-500 to-orange-600' : 'from-red-500 to-red-700';
    const Icon = isReceso ? Coffee : AlertTriangle;

    const reasonLabels = {
        clima: '🌧️ Clima',
        evento: '🎉 Evento Escolar',
        falla: '⚠️ Falla Técnica',
        otro: '📝 Otro'
    };

    return (
        <div className={`fixed inset-0 z-50 bg-gradient-to-br ${bgColor} flex flex-col items-center justify-center p-6 animate-in fade-in duration-500`}>
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '32px 32px'
                }} />
            </div>

            {/* Content */}
            <div className="relative z-10 text-center text-white space-y-8 max-w-sm">
                {/* Icon */}
                <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Icon size={48} />
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-wider mb-2">
                        {isReceso ? 'Receso Activo' : 'Pausa Activa'}
                    </h1>
                    {!isReceso && pauseData?.reason && (
                        <p className="text-white/80 text-lg font-medium">
                            {reasonLabels[pauseData.reason] || pauseData.reason}
                        </p>
                    )}
                </div>

                {/* Timer */}
                <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Clock size={24} className="text-white/60" />
                        <span className="text-white/60 font-bold uppercase tracking-widest text-sm">
                            Tiempo de Pausa
                        </span>
                    </div>
                    <div className="text-6xl font-black tabular-nums">
                        {formatTime(elapsedSeconds)}
                    </div>
                </div>

                {/* Resume Button */}
                <button
                    onClick={onRequestResume}
                    className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    <Play size={24} fill="currentColor" />
                    REANUDAR OPERACIÓN
                </button>

                {/* Footer Note */}
                <p className="text-white/50 text-xs font-medium">
                    Los vuelos están deshabilitados durante la pausa
                </p>
            </div>
        </div>
    );
}
