'use client';

import { useState } from 'react';
import { Menu, X, LogOut, Clock, Plane } from 'lucide-react';
import StartDemoFab from './StartDemoFab';
import ResetProcessButton from './ResetProcessButton';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function HeaderHamburgerMenu({ journeyId, schoolId, onDemoStart, role = null }) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const normalizedRole = role ? String(role).toLowerCase() : null;
    const canSeeHistory = !normalizedRole || ['pilot', 'teacher', 'assistant', 'auxiliar', 'operativo', 'admin'].includes(normalizedRole);
    const canGoDirectToOperation = ['pilot', 'teacher', 'assistant', 'auxiliar'].includes(normalizedRole || '');
    const directOperationHint = normalizedRole === 'teacher'
        ? 'Abrir registro de vuelos'
        : 'Abrir panel de operación';

    const handleDirectOperation = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('flyhigh:direct-operation', {
                detail: { role: normalizedRole || null, source: 'header_hamburger' }
            }));
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

                        <p className="px-4 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 border-t border-slate-100 mt-1">
                            Acciones de prueba
                        </p>

                        {canGoDirectToOperation && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    handleDirectOperation();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors rounded-lg text-blue-700 group"
                            >
                                <div className="p-2 bg-blue-50 rounded-lg transition-colors group-hover:bg-blue-100">
                                    <Plane size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Ir directo a operación</p>
                                    <p className="text-[10px] text-blue-500/80 font-medium tracking-tight">{directOperationHint}</p>
                                </div>
                            </button>
                        )}

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
