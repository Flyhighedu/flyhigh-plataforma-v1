'use client';
import { useState, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { parseMeta } from '@/utils/metaHelpers';

const BYPASS_PASSWORD = 'flyhigh2026';
const HOLD_MS = 1500;

/**
 * ContingencyBypassMenu — Hidden emergency menu for directors.
 * 
 * Activated by long-pressing (1.5s) the mission header area.
 * Password-protected. Allows directors to force-complete the current
 * phase when a task is completely blocked and unrecoverable.
 * 
 * Leaves an audit trail in journey metadata.
 */
export default function ContingencyBypassMenu({
    journeyId,
    userId,
    profile,
    missionState,
    missionInfo,
    onRefresh,
    children
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const holdTimerRef = useRef(null);
    const holdStartRef = useRef(0);

    const handleHoldStart = useCallback((e) => {
        if (e?.cancelable) e.preventDefault();
        holdStartRef.current = Date.now();
        holdTimerRef.current = setTimeout(() => {
            setMenuOpen(true);
            setPassword('');
            setFeedback(null);
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        }, HOLD_MS);
    }, []);

    const handleHoldEnd = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    const handleBypass = async () => {
        if (password !== BYPASS_PASSWORD) {
            setFeedback('Contraseña incorrecta.');
            return;
        }

        if (!journeyId) {
            setFeedback('No hay jornada activa.');
            return;
        }

        setIsExecuting(true);
        setFeedback(null);

        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            // Read current meta
            const { data, error: readError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            const currentMeta = parseMeta(data?.meta);
            const actorName = profile?.full_name?.split(' ')[0] || 'Director';

            // Determine next phase based on current state
            let nextMissionState = missionState;
            let bypassedTask = missionState || 'unknown';

            // Force-complete current phase by advancing to the next logical phase
            if (missionState === 'seat_deployment') {
                nextMissionState = 'OPERATION';
                bypassedTask = 'seat_deployment_phase';
            } else if (missionState === 'waiting_dropzone') {
                nextMissionState = 'OPERATION';
                bypassedTask = 'waiting_dropzone';
            } else if (missionState === 'waiting_unload_assignment') {
                nextMissionState = 'seat_deployment';
                bypassedTask = 'unload_assignment';
            } else if (missionState === 'unload') {
                nextMissionState = 'post_unload_coordination';
                bypassedTask = 'unload';
            } else if (missionState === 'post_unload_coordination') {
                nextMissionState = 'seat_deployment';
                bypassedTask = 'post_unload_coordination';
            } else if (missionState === 'dismantling') {
                nextMissionState = 'completed';
                bypassedTask = 'dismantling';
            } else {
                // Generic: advance to dismantling as a safe fallback
                nextMissionState = 'dismantling';
                bypassedTask = missionState || 'unknown_phase';
            }

            const nextMeta = {
                ...currentMeta,
                contingency_bypass: true,
                contingency_bypassed_task: bypassedTask,
                contingency_bypassed_at: now,
                contingency_bypassed_by: userId,
                contingency_bypassed_by_name: actorName,
                contingency_previous_state: missionState
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: nextMissionState,
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            // Log the bypass event
            await supabase.from('staff_events').insert({
                journey_id: journeyId,
                type: 'CONTINGENCY_BYPASS',
                actor_user_id: userId,
                payload: {
                    bypassed_task: bypassedTask,
                    previous_state: missionState,
                    next_state: nextMissionState,
                    actor_name: actorName
                }
            }).catch(() => { }); // Non-blocking

            setFeedback(`Fase saltada. Avanzado a: ${nextMissionState}`);
            if (onRefresh) onRefresh();

            // Auto-close after 2s
            setTimeout(() => {
                setMenuOpen(false);
                setFeedback(null);
            }, 2000);

        } catch (err) {
            console.error('[ContingencyBypass] Error:', err);
            setFeedback(`Error: ${err?.message || 'No se pudo ejecutar el bypass.'}`);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            onTouchCancel={handleHoldEnd}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            style={{ touchAction: 'auto' }}
        >
            {children}

            {menuOpen && (
                <div className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
                    <div className="w-full max-w-sm rounded-3xl border border-red-300 bg-white p-5 shadow-[0_36px_72px_-34px_rgba(220,38,38,0.4)]">
                        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-500">
                            Contingencia directoral
                        </p>
                        <h3 className="mt-1 text-lg font-black text-slate-900">
                            Saltar Tarea y Finalizar Fase
                        </h3>
                        <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">
                            Solo para directores. Forzará el avance de fase, saltando la tarea actual.
                            Esta acción queda registrada para auditoría.
                        </p>

                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                            <p className="text-[10px] font-bold text-amber-700 m-0">
                                Estado actual: <span className="font-mono">{missionState || 'N/A'}</span>
                            </p>
                        </div>

                        <label className="block mt-3">
                            <p className="text-[11px] font-bold text-slate-700 mb-1">Contraseña de director</p>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                disabled={isExecuting}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-red-500"
                                autoComplete="off"
                            />
                        </label>

                        {feedback && (
                            <p className={`mt-2 text-xs font-bold ${feedback.startsWith('Error') || feedback === 'Contraseña incorrecta.' ? 'text-red-600' : 'text-green-600'}`}>
                                {feedback}
                            </p>
                        )}

                        <div className="mt-4 grid grid-cols-1 gap-2">
                            <button
                                type="button"
                                onClick={handleBypass}
                                disabled={isExecuting || !password}
                                className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {isExecuting ? (
                                    <span className="inline-flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Ejecutando...
                                    </span>
                                ) : 'Saltar Tarea y Finalizar Fase'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setMenuOpen(false); setFeedback(null); }}
                                disabled={isExecuting}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
