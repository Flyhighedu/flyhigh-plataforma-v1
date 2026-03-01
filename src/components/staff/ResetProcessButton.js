'use client';

import { useState, useRef, useEffect } from 'react';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { clearJourneyLocalOperationalData } from '@/utils/staff/resetJourneyLocalData';

/**
 * ResetProcessButton
 * 
 * Botón temporal para pruebas de campo.
 * Funcionalidad:
 * 1. Mantener presionado 2 segundos (Hold).
 * 2. Confirmar acción.
 * 3. Reinicia la jornada actual (borra eventos y resetea estado).
 */
export default function ResetProcessButton({ journeyId, minimal = false }) {
    const [holding, setHolding] = useState(false);
    const [progress, setProgress] = useState(0);
    const [resetting, setResetting] = useState(false);

    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const progressFrameRef = useRef(null);

    const HOLD_DURATION = 2000; // 2 segundos

    const handleMouseDown = () => {
        if (!journeyId || resetting) return;
        setHolding(true);
        startTimeRef.current = Date.now();

        // Animación de progreso
        const animate = () => {
            const elapsed = Date.now() - startTimeRef.current;
            const pct = Math.min(100, (elapsed / HOLD_DURATION) * 100);
            setProgress(pct);

            if (pct < 100) {
                progressFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Completado
                triggerConfirmation();
            }
        };
        progressFrameRef.current = requestAnimationFrame(animate);
    };

    const handleMouseUp = () => {
        cancelHold();
    };

    const handleMouseLeave = () => {
        cancelHold();
    };

    const cancelHold = () => {
        setHolding(false);
        setProgress(0);
        if (progressFrameRef.current) cancelAnimationFrame(progressFrameRef.current);
    };

    const triggerConfirmation = async () => {
        cancelHold();

        // Pequeño delay para UX
        setTimeout(async () => {
            const confirmed = window.confirm("⚠️ ¿REINICIAR PROCESO DE PRUEBA?\n\nEsto borrará todo el progreso actual de la jornada y recargará la página para todos.");
            if (confirmed) {
                await executeReset();
            }
        }, 100);
    };

    const executeReset = async () => {
        setResetting(true);
        try {
            const response = await fetch('/api/debug/reset-journey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ journeyId })
            });

            let result;
            try {
                result = await response.json();
            } catch (err) {
                // If JSON fails, it might be HTML (404/500)
                const text = await response.text().catch(() => '');
                throw new Error(`Invalid JSON response: ${text.substring(0, 50)}`);
            }

            if (response.ok) {
                console.log('Reset Success:', result);

                const cacheCleanup = clearJourneyLocalOperationalData(journeyId);
                console.log('Local journey cache cleanup:', cacheCleanup);

                // Clear state to force "No Mission" or fresh fetch

                // [CRITICAL] Do NOT clear localStorage if we want to "reset" but keep the mission assignment.
                // The user said: "reiniciar la jornada actual".
                // If I clear 'flyhigh_staff_mission', the user loses the mission assignment entirely and sees "No School Today".
                // Is that what we want? The user said "Reinicia la jornada actual (borra eventos y resetea estado)".
                // Usually "Reset Process" means "Start Over", not "Unassign Mission".
                // BUT the previous code did: localStorage.removeItem('flyhigh_staff_mission');
                // I will keep the previous behavior to be safe unless the user says otherwise.
                // Wait, if I clear the mission, they have to re-select it?
                // The user said "Regresa al estado inicial".
                // If I keep 'flyhigh_staff_mission', the Dashboard will see the mission and load the journey.
                // Since we reset the journey to 'prep', it will load in Step 0.
                // This seems better UX.
                // However, I will stick to what the code was doing to avoid "changing flows".
                // PREVIOUS CODE: localStorage.removeItem('flyhigh_staff_mission');

                // Let's comment this out and see if it feels better?
                // "Prohibido: Cambiar UI... No mejoras."
                // OK, I will stick to the previous code logic exactly, just robust parsing.

                localStorage.removeItem('flyhigh_staff_mission');
                // localStorage.removeItem('flyhigh_test_mode'); // User might want to stay in test mode

                // Forzar recarga completa
                window.location.reload();
            } else {
                console.error('Reset API Error:', result);
                alert(`Error al reiniciar: ${result.error || 'Unknown error'}`);
                setResetting(false);
            }
        } catch (e) {
            console.error('Network/Logic Error:', e);
            alert("Error al reiniciar: " + e.message);
            setResetting(false);
        }
    };

    if (journeyId === undefined) return null; // Safety check

    // Render minimal version for Menu (no fixed pos, list item style)
    if (minimal) {
        return (
            <button
                onPointerDown={handleMouseDown}
                onPointerUp={handleMouseUp}
                onPointerLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                style={{ touchAction: 'none' }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors relative overflow-hidden group"
            >
                {/* Progress Overlay */}
                {holding && (
                    <div
                        className="absolute inset-0 bg-red-100/50 transition-all duration-75 ease-linear origin-left"
                        style={{ width: `${progress}%` }}
                    />
                )}

                <div className={`p-2 rounded-lg ${resetting ? 'bg-slate-100' : 'bg-red-50 text-red-600'} relative z-10`}>
                    {resetting ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                </div>
                <div className="relative z-10">
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                        {resetting ? 'Reiniciando...' : 'Reset Jornada'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">Mantén presionado 2s</p>
                </div>
            </button>
        );
    }

    // Default Fixed Button
    return (
        <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            style={{
                position: 'fixed',
                top: 10,
                right: 10,
                zIndex: 9999,
                backgroundColor: resetting ? '#374151' : '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'transform 0.1s'
            }}
            className="active:scale-95"
        >
            {/* Fondo de progreso */}
            {holding && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${progress}%`,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    transition: 'height 0.1s linear'
                }} />
            )}

            {resetting ? (
                <Loader2 size={20} className="animate-spin" />
            ) : (
                <RefreshCw size={20} />
            )}
        </button>
    );
}
