'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, CheckCircle, Star, ChevronRight, X, RotateCw, ThumbsUp, ThumbsDown, Trophy } from 'lucide-react';

// ═══ FLIGHT PATH NODE ═══
function PathNode({ poi, index, total, status, onTap }) {
    const isCompleted = status === 'completed';
    const isCurrent = status === 'current';
    const isLocked = status === 'locked';

    // Zigzag positioning
    const offsetX = index % 2 === 0 ? -40 : 40;

    return (
        <div className="relative flex flex-col items-center" style={{ transform: `translateX(${offsetX}px)` }}>
            {/* Connecting line to next node */}
            {index < total - 1 && (
                <div className="absolute top-[52px] left-1/2 w-[3px] h-[60px] -translate-x-1/2 z-0"
                    style={{
                        background: isCompleted
                            ? 'linear-gradient(to bottom, #10b981, #10b981)'
                            : 'linear-gradient(to bottom, #e2e8f0, #e2e8f0)'
                    }}
                />
            )}

            <button
                onClick={() => !isLocked && onTap(poi, index)}
                disabled={isLocked}
                className={`relative z-10 w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isCompleted
                        ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-[0_4px_20px_rgba(16,185,129,0.4)] text-white'
                        : isCurrent
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_4px_25px_rgba(99,102,241,0.5)] text-white ring-4 ring-blue-200 animate-pulse'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
                {isCompleted ? (
                    <CheckCircle size={24} strokeWidth={3} />
                ) : isCurrent ? (
                    <Star size={24} strokeWidth={3} className="drop-shadow-md" />
                ) : (
                    <Lock size={18} strokeWidth={3} />
                )}
            </button>

            {/* Label */}
            <div className={`mt-2 text-center max-w-[100px] ${isLocked ? 'opacity-40' : ''}`}>
                <p className={`text-[10px] font-black uppercase tracking-wide leading-tight ${
                    isCompleted ? 'text-emerald-600' : isCurrent ? 'text-indigo-600' : 'text-slate-400'
                }`}>
                    {poi.name}
                </p>
            </div>
        </div>
    );
}

// ═══ 3D FLASHCARD ═══
function FlashCard3D({ poi, onSwipeLeft, onSwipeRight, onClose }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [exitDir, setExitDir] = useState(null);
    const cardRef = useRef(null);

    const handleSwipe = (dir) => {
        setExitDir(dir);
        setTimeout(() => {
            if (dir === 'right') onSwipeRight();
            else onSwipeLeft();
        }, 400);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Close button */}
            <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all z-50">
                <X size={20} />
            </button>

            {/* Card container */}
            <div
                ref={cardRef}
                className={`w-full max-w-[340px] transition-all duration-500 ${
                    exitDir === 'left' ? 'translate-x-[-120%] rotate-[-20deg] opacity-0'
                    : exitDir === 'right' ? 'translate-x-[120%] rotate-[20deg] opacity-0'
                    : ''
                }`}
                style={{ perspective: '1200px' }}
            >
                <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="relative w-full cursor-pointer transition-transform duration-700"
                    style={{
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        minHeight: '420px'
                    }}
                >
                    {/* ── FRONT ── */}
                    <div
                        className="absolute inset-0 rounded-[28px] overflow-hidden shadow-2xl"
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent)]" />
                        <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 text-center text-white">
                            <div className="text-6xl mb-6 drop-shadow-lg">{poi.emoji || '📍'}</div>
                            <h2 className="text-2xl font-black tracking-tight mb-2 drop-shadow">{poi.name}</h2>
                            <p className="text-sm font-medium text-white/70 mb-8 line-clamp-2">{poi.description}</p>
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20">
                                <RotateCw size={14} className="animate-spin-slow" />
                                <span className="text-xs font-bold tracking-wider uppercase">Toca para voltear</span>
                            </div>
                        </div>
                    </div>

                    {/* ── BACK ── */}
                    <div
                        className="absolute inset-0 rounded-[28px] overflow-hidden shadow-2xl bg-white"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        <div className="flex flex-col h-full p-7">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="text-2xl">{poi.emoji || '📍'}</div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">{poi.name}</h3>
                            </div>

                            <div className="flex-1 space-y-4">
                                {poi.dato_clave_1 && (
                                    <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Dato Clave 1</p>
                                        <p className="text-sm font-bold text-indigo-900 leading-relaxed">{poi.dato_clave_1}</p>
                                    </div>
                                )}
                                {poi.dato_clave_2 && (
                                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">Dato Clave 2</p>
                                        <p className="text-sm font-bold text-emerald-900 leading-relaxed">{poi.dato_clave_2}</p>
                                    </div>
                                )}
                                {poi.pregunta_interaccion && (
                                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 mb-1">Pregunta</p>
                                        <p className="text-sm font-bold text-amber-900 leading-relaxed">{poi.pregunta_interaccion}</p>
                                    </div>
                                )}
                            </div>

                            <p className="text-[10px] font-bold text-slate-300 text-center mt-4">Toca para volver al frente</p>
                        </div>
                    </div>
                </div>

                {/* ═══ SWIPE BUTTONS ═══ */}
                {isFlipped && !exitDir && (
                    <div className="flex items-center justify-center gap-6 mt-6">
                        <button
                            onClick={e => { e.stopPropagation(); handleSwipe('left'); }}
                            className="w-16 h-16 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 flex items-center justify-center active:scale-90 transition-all hover:shadow-red-500/60"
                        >
                            <ThumbsDown size={26} strokeWidth={3} />
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); handleSwipe('right'); }}
                            className="w-16 h-16 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 flex items-center justify-center active:scale-90 transition-all hover:shadow-emerald-500/60"
                        >
                            <ThumbsUp size={26} strokeWidth={3} />
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 3s linear infinite; }
            `}</style>
        </div>
    );
}

// ═══ MAIN: FLIGHT PATH (Camino de Vuelo) ═══
export default function FlightPathView({ userId }) {
    const [route, setRoute] = useState(null);
    const [pois, setPois] = useState([]);
    const [progress, setProgress] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeCard, setActiveCard] = useState(null);
    const [completedCount, setCompletedCount] = useState(0);
    const [showComplete, setShowComplete] = useState(false);

    // Fetch published route + POIs + user progress
    useEffect(() => {
        async function load() {
            try {
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();

                // Get first published route — fail gracefully if table doesn't exist
                const routeResult = await supabase
                    .from('master_routes')
                    .select('*')
                    .eq('status', 'published')
                    .order('sort_order', { ascending: true })
                    .limit(1);

                // If table doesn't exist or query fails, just bail silently
                if (routeResult.error || !routeResult.data?.length) { 
                    setLoading(false); 
                    return; 
                }
                const r = routeResult.data[0];
                setRoute(r);

                // Get route POIs
                const poisResult = await supabase
                    .from('master_route_pois')
                    .select('*')
                    .eq('route_id', r.id)
                    .order('sort_order', { ascending: true });

                if (poisResult.error) { setLoading(false); return; }
                setPois(poisResult.data || []);

                // Get user progress
                if (userId) {
                    const progResult = await supabase
                        .from('pilot_route_progress')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('route_id', r.id);

                    if (!progResult.error) {
                        const progressMap = {};
                        let count = 0;
                        (progResult.data || []).forEach(p => {
                            progressMap[p.poi_id] = p;
                            if (p.completed) count++;
                        });
                        setProgress(progressMap);
                        setCompletedCount(count);
                    }
                }
            } catch (err) {
                console.warn('FlightPath: tablas no disponibles aún', err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [userId]);

    // Determine node status
    const getNodeStatus = (poi, index) => {
        if (progress[poi.id]?.completed) return 'completed';
        // Current = first non-completed
        const firstIncomplete = pois.findIndex(p => !progress[p.id]?.completed);
        if (index === firstIncomplete) return 'current';
        return 'locked';
    };

    // Mark as completed
    const markCompleted = async (poiId) => {
        try {
            const { createClient } = await import('@/utils/supabase/client');
            const supabase = createClient();

            await supabase.from('pilot_route_progress').upsert({
                user_id: userId,
                route_id: route.id,
                poi_id: poiId,
                completed: true,
                confidence_level: 3,
                completed_at: new Date().toISOString()
            }, { onConflict: 'user_id,poi_id' });

            setProgress(prev => ({
                ...prev,
                [poiId]: { ...prev[poiId], completed: true }
            }));
            setCompletedCount(prev => prev + 1);

            // Check if route complete
            if (completedCount + 1 >= pois.length) {
                setShowComplete(true);
            }
        } catch (err) {
            console.error('Error marking progress:', err);
        }
    };

    const handleSwipeRight = () => {
        if (activeCard) {
            markCompleted(activeCard.poi.id);
            setActiveCard(null);
        }
    };

    const handleSwipeLeft = () => {
        setActiveCard(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!route || pois.length === 0) return null;

    const progressPercent = pois.length > 0 ? (completedCount / pois.length) * 100 : 0;

    return (
        <div className="w-full">
            {/* ═══ ROUTE HEADER ═══ */}
            <div className="bg-white rounded-[28px] p-5 mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{route.emoji}</span>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 tracking-tight">{route.title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ruta Maestra</p>
                        </div>
                    </div>
                    <div className="bg-indigo-50 px-3 py-1.5 rounded-full">
                        <span className="text-[12px] font-black text-indigo-600">{completedCount}<span className="text-slate-400"> / {pois.length}</span></span>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-[2px]">
                    <div
                        className="bg-gradient-to-r from-emerald-400 to-green-500 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* ═══ FLIGHT PATH ═══ */}
            <div className="relative flex flex-col items-center gap-4 py-6">
                {pois.map((poi, idx) => (
                    <PathNode
                        key={poi.id}
                        poi={{ ...poi, emoji: poi.image_url || '📍' }}
                        index={idx}
                        total={pois.length}
                        status={getNodeStatus(poi, idx)}
                        onTap={(p) => setActiveCard({ poi: p, index: idx })}
                    />
                ))}
            </div>

            {/* ═══ FLASHCARD OVERLAY ═══ */}
            {activeCard && (
                <FlashCard3D
                    poi={{ ...activeCard.poi, emoji: activeCard.poi.image_url || '📍' }}
                    onSwipeRight={handleSwipeRight}
                    onSwipeLeft={handleSwipeLeft}
                    onClose={() => setActiveCard(null)}
                />
            )}

            {/* ═══ COMPLETION CELEBRATION ═══ */}
            {showComplete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[32px] p-10 text-center max-w-sm shadow-2xl">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2">¡Ruta Completada!</h2>
                        <p className="text-sm text-slate-500 mb-6">Dominaste todos los puntos de <strong>{route.title}</strong></p>
                        <button
                            onClick={() => setShowComplete(false)}
                            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-sm shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
                        >
                            <Trophy size={16} className="inline mr-2 -mt-0.5" />
                            ¡Genial!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
