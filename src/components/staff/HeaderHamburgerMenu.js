'use client';

import { useState, useRef } from 'react';
import { Menu, X, LogOut, Clock, Plane, Repeat } from 'lucide-react';
import StartDemoFab from './StartDemoFab';
import ResetProcessButton from './ResetProcessButton';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function HeaderHamburgerMenu({ journeyId, schoolId, onDemoStart, role = null, userId = null, profile = null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [changeMissionProgress, setChangeMissionProgress] = useState(false);
    const [directOpProgress, setDirectOpProgress] = useState(false);
    const changeMissionTimerRef = useRef(null);
    const directOpTimerRef = useRef(null);
    const router = useRouter();
    const normalizedRole = role ? String(role).toLowerCase() : null;
    const canSeeHistory = !normalizedRole || ['pilot', 'teacher', 'assistant', 'auxiliar', 'operativo', 'admin'].includes(normalizedRole);
    const canGoDirectToOperation = ['pilot', 'teacher', 'assistant', 'auxiliar'].includes(normalizedRole || '');
    const directOperationHint = normalizedRole === 'teacher'
        ? 'Saltar directo a vuelos'
        : 'Saltar directo a panel';

    const handleDirectOperation = async () => {
        // Local event (fallback/immediate UI switch)
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('flyhigh:direct-operation', {
                detail: { role: normalizedRole || null, source: 'header_hamburger_emergency' }
            }));
        }

        // Global sync (Supabase write)
        if (journeyId && userId) {
            try {
                const supabase = createClient();
                const now = new Date().toISOString();
                const actorName = profile?.full_name?.split(' ')[0] || 'Operativo';
                
                // Read current meta to preserve it
                const { data: currentData } = await supabase
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();
                
                const currentMeta = currentData?.meta || {};
                
                // Force state to OPERATION and flag contingency
                const nextMeta = {
                    ...currentMeta,
                    contingency_direct_operation: true,
                    contingency_direct_operation_at: now,
                    contingency_direct_operation_by: userId,
                    contingency_direct_operation_by_name: actorName
                };

                await supabase.from('staff_journeys')
                    .update({ 
                        mission_state: 'OPERATION',
                        meta: nextMeta,
                        updated_at: now
                    })
                    .eq('id', journeyId);

                // Log audit event
                await supabase.from('staff_events').insert({
                    journey_id: journeyId,
                    type: 'CONTINGENCY_DIRECT_OPERATION',
                    actor_user_id: userId,
                    payload: { by_name: actorName }
                });

                console.log('🚨 Emergency Direct Operation fired. Sync sent.');
            } catch (err) {
                console.error('Failed to broadcast emergency operation state:', err);
            }
        }
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('flyhigh_staff_mission');
        router.push('/staff/login');
        router.refresh();
    };

    return (
        <div className="relative">
            {/* Menu Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white active:scale-95 transition-all shadow-lg overflow-hidden group"
                aria-label="Abrir menú"
            >
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
                    {isOpen ? <X size={20} /> : <Menu size={20} />}
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop for closing */}
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu Content */}
                    <div className="absolute top-12 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[70] flex flex-col gap-1 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                        <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Acciones
                        </p>

                        {canSeeHistory && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push('/staff/history');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg text-slate-700 group"
                            >
                                <div className="p-2 bg-slate-50 rounded-lg transition-colors">
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Historial de Misiones</p>
                                    <p className="text-[10px] text-slate-400 font-medium tracking-tight">Ver reportes e informes</p>
                                </div>
                            </button>
                        )}

                        <p className="px-4 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 border-t border-slate-100 mt-1 flex items-center gap-1.5 text-red-500">
                            <span className="shrink-0 size-2 rounded-full bg-red-500 animate-pulse" /> Contingencia
                        </p>

                        {canGoDirectToOperation && (
                            <button
                                onMouseDown={() => {
                                    setDirectOpProgress(true);
                                    directOpTimerRef.current = setTimeout(() => {
                                        setIsOpen(false);
                                        setDirectOpProgress(false);
                                        handleDirectOperation();
                                    }, 2000); // 2 seconds hold for emergency
                                }}
                                onMouseUp={() => {
                                    clearTimeout(directOpTimerRef.current);
                                    setDirectOpProgress(false);
                                }}
                                onMouseLeave={() => {
                                    clearTimeout(directOpTimerRef.current);
                                    setDirectOpProgress(false);
                                }}
                                onTouchStart={() => {
                                    setDirectOpProgress(true);
                                    directOpTimerRef.current = setTimeout(() => {
                                        setIsOpen(false);
                                        setDirectOpProgress(false);
                                        handleDirectOperation();
                                    }, 2000);
                                }}
                                onTouchEnd={() => {
                                    clearTimeout(directOpTimerRef.current);
                                    setDirectOpProgress(false);
                                }}
                                className="relative w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors rounded-lg text-red-600 group overflow-hidden select-none"
                            >
                                {/* Progress bar fill */}
                                {directOpProgress && (
                                    <div
                                        className="absolute inset-0 bg-red-100/70 origin-left"
                                        style={{ animation: 'emergencyFill 2s linear forwards' }}
                                    />
                                )}
                                <div className="relative p-2 bg-red-50 rounded-lg transition-colors group-hover:bg-red-100">
                                    <Plane size={18} className={directOpProgress ? 'animate-bounce' : ''} />
                                </div>
                                <div className="relative">
                                    <p className="text-sm font-bold">Ir directo a operación</p>
                                    <p className="text-[10px] text-red-500 font-semibold tracking-tight">
                                        {directOpProgress ? 'Mantén 2s para activar...' : directOperationHint}
                                    </p>
                                </div>
                            </button>
                        )}
                        <style jsx>{`
                            @keyframes changeMissionFill {
                                from { transform: scaleX(0); }
                                to { transform: scaleX(1); }
                            }
                            @keyframes emergencyFill {
                                from { transform: scaleX(0); }
                                to { transform: scaleX(1); }
                            }
                        `}</style>

                        {/* Demo Start */}
                        <div className="relative">
                            <StartDemoFab
                                onDemoStarted={() => { onDemoStart && onDemoStart(); setIsOpen(false); }}
                                minimal={true}
                                schoolId={schoolId}
                            />
                        </div>

                        {/* Reset Process */}
                        {journeyId && (
                            <div className="relative border-t border-slate-50 pt-1 mt-1">
                                <ResetProcessButton journeyId={journeyId} minimal={true} />
                            </div>
                        )}

                        {/* Change Mission (Escape Hatch — 3s long press) */}
                        <button
                            onMouseDown={() => {
                                setChangeMissionProgress(true);
                                changeMissionTimerRef.current = setTimeout(() => {
                                    setIsOpen(false);
                                    setChangeMissionProgress(false);
                                    localStorage.removeItem('flyhigh_selected_mission_id');
                                    localStorage.removeItem('flyhigh_staff_mission');
                                    window.location.reload();
                                }, 3000);
                            }}
                            onMouseUp={() => {
                                clearTimeout(changeMissionTimerRef.current);
                                setChangeMissionProgress(false);
                            }}
                            onMouseLeave={() => {
                                clearTimeout(changeMissionTimerRef.current);
                                setChangeMissionProgress(false);
                            }}
                            onTouchStart={() => {
                                setChangeMissionProgress(true);
                                changeMissionTimerRef.current = setTimeout(() => {
                                    setIsOpen(false);
                                    setChangeMissionProgress(false);
                                    localStorage.removeItem('flyhigh_selected_mission_id');
                                    localStorage.removeItem('flyhigh_staff_mission');
                                    window.location.reload();
                                }, 3000);
                            }}
                            onTouchEnd={() => {
                                clearTimeout(changeMissionTimerRef.current);
                                setChangeMissionProgress(false);
                            }}
                            className="relative w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50 transition-colors rounded-lg text-amber-700 group border-t border-slate-50 mt-1 overflow-hidden select-none"
                        >
                            {/* Progress bar fill */}
                            {changeMissionProgress && (
                                <div
                                    className="absolute inset-0 bg-amber-100/70 origin-left"
                                    style={{ animation: 'changeMissionFill 3s linear forwards' }}
                                />
                            )}
                            <div className="relative p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                                <Repeat size={18} className={changeMissionProgress ? 'animate-spin' : ''} />
                            </div>
                            <div className="relative">
                                <p className="text-sm font-semibold">Cambiar de Misión</p>
                                <p className="text-[10px] text-amber-500/80 font-medium tracking-tight">
                                    {changeMissionProgress ? 'Mantén presionado 3s...' : 'Mantener presionado para cambiar'}
                                </p>
                            </div>
                        </button>
                        <style jsx>{`
                            @keyframes changeMissionFill {
                                from { transform: scaleX(0); }
                                to { transform: scaleX(1); }
                            }
                        `}</style>

                        {/* Logout Option */}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg text-slate-600 hover:text-red-500 group border-t border-slate-50 mt-1"
                        >
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-red-50 transition-colors">
                                <LogOut size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Cerrar Sesión</p>
                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">Salir de la cuenta</p>
                            </div>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
