'use client';

import { useState, useRef } from 'react';
import {
    School,
    Map as MapIcon,
    Compass,
    Check,
    Clock,
    UserCheck,
    MapPin,
    Menu,
    X,
    LogOut,
    Plane,
    GraduationCap,
    HandHeart,
    User,
    UserX,
    AlertTriangle,
    ChevronDown
} from 'lucide-react';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import ResetProcessButton from '@/components/staff/ResetProcessButton';
import StartDemoFab from '@/components/staff/StartDemoFab';
import HeaderOperativo from '@/components/staff/HeaderOperativo';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

/**
 * Helper para avatares (Iconos por Rol)
 */
function Avatar({ role }) {
    // Colores de fondo para avatares (basado en rol para consistencia)
    const bgColors = {
        pilot: 'bg-blue-100 text-blue-600',
        teacher: 'bg-emerald-100 text-emerald-600',
        assistant: 'bg-purple-100 text-purple-600',
        default: 'bg-slate-100 text-slate-500'
    };

    const colorClass = bgColors[role] || bgColors.default;

    let Icon = User;
    if (role === 'pilot') Icon = Plane;
    if (role === 'teacher') Icon = GraduationCap;
    if (role === 'assistant') Icon = HandHeart;

    return (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${colorClass} overflow-hidden border-2 border-white shadow-sm`}>
            <Icon size={20} strokeWidth={2} />
        </div>
    );
}

/**
 * Helper para Status Chip
 */
function StatusChip({ status }) {
    const isReady = status === 'en_sitio' || status === 'ready' || status === 'LISTO';

    if (isReady) {
        return (
            <div className="px-3 py-1 rounded-full flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm text-white">
                <Check size={12} strokeWidth={3} />
                <span className="text-[10px] font-black tracking-wider">LISTO</span>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1 text-slate-500">
            <Clock size={12} />
            <span className="text-[10px] font-black tracking-wider">PENDIENTE</span>
        </div>
    );
}

export default function MissionBriefUI({
    profile, // { full_name, role, ... }
    school, // { school_name, colonia, address... }
    teamStatus, // { pilot: 'pending'|'en_sitio', teacher:..., assistant:... }
    distance, // number (meters)
    locationStatus, // 'idle' | 'locating' | 'success' | 'error' | 'denied'
    isWithinRange, // boolean
    checking, // boolean (loading)
    onCheckIn, // fn
    onLogout, // fn
    onViewMap, // fn
    journeyId, // [NEW] for Reset Process
    userId, // [NEW] for emergency sync
    onDemoStart, // [NEW] for Demo Fab
    avatarConfig,
    children // [NEW] Content (Fallback)
}) {
    const router = useRouter();
    // Helpers de formato
    const firstName = profile?.full_name?.split(' ')[0] || 'Staff';
    const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || 'Staff';
    const normalizedRole = String(profile?.role || '').toLowerCase();
    const canGoDirectToOperation = ['pilot', 'teacher', 'assistant', 'auxiliar'].includes(normalizedRole);
    const directOperationHint = normalizedRole === 'teacher'
        ? 'Saltar directo a vuelos'
        : 'Saltar directo a panel';

    const handleDirectOperation = async () => {
        // Local event (fallback/immediate UI switch)
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('flyhigh:direct-operation', {
                detail: { role: normalizedRole || null, source: 'mission_brief_emergency' }
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

                console.log('🚨 Emergency Direct Operation fired from Mission Brief. Sync sent.');
            } catch (err) {
                console.error('Failed to broadcast emergency operation state:', err);
            }
        }
    };

    // ── Contingencia Sin Piloto ──
    const handleNoPilotContingency = async () => {
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const actorName = profile?.full_name?.split(' ')[0] || 'Operativo';
            const resolvedSchoolId = school?.id;

            if (journeyId && userId) {
                // Journey exists — flag it
                const { data: currentData } = await supabase
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();
                const currentMeta = currentData?.meta || {};
                await supabase.from('staff_journeys').update({
                    meta: { ...currentMeta, contingency_no_pilot: true, contingency_no_pilot_activated_at: now, contingency_no_pilot_activated_by: userId, contingency_no_pilot_activated_by_name: actorName },
                    updated_at: now,
                }).eq('id', journeyId);
                await supabase.from('staff_events').insert({
                    journey_id: journeyId,
                    type: 'CONTINGENCY_NO_PILOT',
                    actor_user_id: userId,
                    payload: { by_name: actorName },
                });
            } else if (resolvedSchoolId) {
                // No journey yet — find or create
                const { data: { user } } = await supabase.auth.getUser();
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
                const { data: existingJourney } = await supabase
                    .from('staff_journeys')
                    .select('id, meta')
                    .eq('date', today)
                    .eq('school_id', resolvedSchoolId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (existingJourney) {
                    const existingMeta = existingJourney.meta || {};
                    await supabase.from('staff_journeys').update({
                        meta: { ...existingMeta, contingency_no_pilot: true, contingency_no_pilot_activated_at: now, contingency_no_pilot_activated_by: user?.id, contingency_no_pilot_activated_by_name: actorName },
                        updated_at: now,
                    }).eq('id', existingJourney.id);
                } else {
                    await supabase.from('staff_journeys').insert({
                        date: today,
                        school_id: resolvedSchoolId,
                        school_name: school?.school_name || 'Escuela',
                        status: 'active',
                        mission_state: 'prep',
                        meta: { contingency_no_pilot: true, contingency_no_pilot_activated_at: now, contingency_no_pilot_activated_by: user?.id, contingency_no_pilot_activated_by_name: actorName },
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
            console.log('🚨 No-Pilot Contingency activated from Check-In screen');
        } catch (err) {
            console.error('Failed to activate no-pilot contingency:', err);
        }
        window.location.href = '/staff/contingencia-piloto';
    };

    // Fecha actual (UI Only)
    const todayDate = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const capitalizedDate = todayDate.charAt(0).toUpperCase() + todayDate.slice(1);

    // UI State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [directOpProgress, setDirectOpProgress] = useState(false);
    const directOpTimerRef = useRef(null);
    const [showContingencyPanel, setShowContingencyPanel] = useState(false);
    const [noPilotProgress, setNoPilotProgress] = useState(false);
    const noPilotTimerRef = useRef(null);
    // Determinar estado del botón
    const canCheckIn = (isWithinRange && locationStatus === 'success') || locationStatus === 'error' || locationStatus === 'denied'; // Permitir si hay error (fallback) o si está en rango
    const isOfflineOrError = locationStatus === 'error' || locationStatus === 'denied';

    // Texto del botón
    let buttonText = "HACER CHECK-IN";
    let subText = distance ? `(a ${distance}m de la oficina)` : "(Buscando ubicación...)";

    if (checking) {
        buttonText = "REGISTRANDO...";
        subText = "Por favor espera";
    } else if (locationStatus === 'denied' || locationStatus === 'error') {
        buttonText = "MODO MANUAL";
        subText = "(Usa las opciones de arriba)";
    } else if (!isWithinRange && distance) {
        subText = `(Estás lejos: ${distance}m)`;
    }

    // Equipo (Hardcoded roles structure, dynamic status)
    // Nota: Nombres reales no disponibles en 'teamStatus' simple, usamos placeholders o roles si no info.
    // Asumiremos que si el ID existe en 'school' intentamos mostrar algo, pero por ahora Roles.
    const teamMembers = [
        { role: 'pilot', label: 'Piloto', name: school?.pilot_name, status: teamStatus.pilot },
        { role: 'teacher', label: 'Docente', name: school?.teacher_name, status: teamStatus.teacher },
        { role: 'assistant', label: 'Auxiliar', name: school?.aux_name || school?.assistant_name, status: teamStatus.assistant },
    ];

    const headerActions = (
        <div className="relative">
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white active:scale-95 transition-transform"
                aria-label="Abrir menú"
            >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {isMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="absolute top-12 right-0 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 flex flex-col gap-1 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                        <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Acciones
                        </p>

                        <div className="relative">
                            <StartDemoFab
                                onDemoStarted={() => { onDemoStart && onDemoStart(); setIsMenuOpen(false); }}
                                minimal={true}
                                schoolId={school?.id}
                            />
                        </div>

                        {journeyId && (
                            <div className="relative border-t border-slate-50 pt-1 mt-1">
                                <ResetProcessButton journeyId={journeyId} minimal={true} />
                            </div>
                        )}

                        <p className="px-4 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 border-t border-slate-100 mt-1 flex items-center gap-1.5 text-red-500">
                            <span className="shrink-0 size-2 rounded-full bg-red-500 animate-pulse" /> Contingencia
                        </p>

                        {canGoDirectToOperation && (
                            <button
                                onMouseDown={() => {
                                    setDirectOpProgress(true);
                                    directOpTimerRef.current = setTimeout(() => {
                                        setIsMenuOpen(false);
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
                                        setIsMenuOpen(false);
                                        setDirectOpProgress(false);
                                        handleDirectOperation();
                                    }, 2000);
                                }}
                                onTouchEnd={() => {
                                    clearTimeout(directOpTimerRef.current);
                                    setDirectOpProgress(false);
                                }}
                                className="relative w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors rounded-lg text-red-600 group overflow-hidden select-none border-t border-slate-50 mt-1"
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
                            @keyframes emergencyFill {
                                from { transform: scaleX(0); }
                                to { transform: scaleX(1); }
                            }
                        `}</style>

                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                router.push('/staff/history');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg text-slate-700 border-t border-slate-50 mt-1"
                        >
                            <div className="p-2 bg-slate-50 rounded-lg transition-colors">
                                <Clock size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Historial de Misiones</p>
                                <p className="text-[10px] text-slate-400 font-medium">Ver reportes e informes</p>
                            </div>
                        </button>

                        <button
                            onClick={onLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg text-slate-600 hover:text-red-500 group border-t border-slate-50 mt-1"
                        >
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-red-50 transition-colors">
                                <LogOut size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Cerrar Sesión</p>
                                <p className="text-[10px] text-slate-400 font-medium">Salir de la cuenta</p>
                            </div>
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-white pb-0">
            {/* --- HEADER --- */}
            <HeaderOperativo
                firstName={firstName}
                roleLabel={roleLabel}
                missionState="MISSION_BRIEF"
                dateLabel={capitalizedDate}
                actionsSlot={headerActions}
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
                avatarConfig={avatarConfig}
            />

            {/* --- BODY --- */}
            <div className="flex-1 px-6 mt-4 md:mt-6 space-y-5 z-20 overflow-y-auto pb-32">

                {/* Mission Card */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-xl shadow-blue-600/30">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-white/10">
                                Misión de hoy
                            </span>
                            <School className="text-white/80" size={24} />
                        </div>

                        <h3 className="text-2xl font-bold leading-tight mb-1">
                            {school?.school_name || 'Cargando escuela...'}
                        </h3>

                        <p className="text-blue-100 text-sm mb-6 flex items-center gap-1">
                            <MapPin size={14} className="opacity-70" />
                            {school?.colonia || 'Dirección pendiente'}
                        </p>

                        <button
                            onClick={onViewMap}
                            className="inline-flex items-center gap-2 bg-white text-blue-600 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:bg-blue-50 transition-all active:scale-95"
                        >
                            <MapIcon size={16} />
                            Ver mapa
                        </button>
                    </div>

                    <div className="absolute bottom-[-10px] right-[-10px] opacity-10 pointer-events-none text-white">
                        <Compass size={120} strokeWidth={1} />
                    </div>
                </div>

                {/* Team Section */}
                <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                        Equipo de Misión
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                        {teamMembers.map((member) => (
                            <div key={member.role} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Avatar role={member.role} />
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">
                                            {member.label}
                                        </p>
                                        <p className={`text-sm font-bold leading-tight ${member.name ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                                            {member.name || 'Por asignar'}
                                        </p>
                                    </div>
                                </div>
                                <StatusChip status={member.status} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Contingency: ¿Un miembro no se presentó? ── */}
                <div className="pt-1">
                    <button
                        onClick={() => setShowContingencyPanel(!showContingencyPanel)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300 ${
                            showContingencyPanel
                                ? 'bg-orange-50 border-orange-200 shadow-sm'
                                : 'bg-white border-slate-100 hover:border-orange-200 hover:bg-orange-50/50'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl transition-colors ${
                                showContingencyPanel ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                                <AlertTriangle size={18} />
                            </div>
                            <div className="text-left">
                                <p className={`text-sm font-bold transition-colors ${
                                    showContingencyPanel ? 'text-orange-700' : 'text-slate-600'
                                }`}>¿Un miembro no se presentó?</p>
                                <p className="text-[10px] text-slate-400 font-medium">Activar modo contingencia</p>
                            </div>
                        </div>
                        <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-300 ${
                                showContingencyPanel ? 'rotate-180 text-orange-500' : ''
                            }`}
                        />
                    </button>

                    {/* Expandable Contingency Options */}
                    {showContingencyPanel && (
                        <div className="mt-2 bg-gradient-to-b from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-start gap-2 text-orange-700">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <p className="text-xs font-medium leading-relaxed">
                                    Si un miembro del equipo no llegará, puedes continuar la misión redistribuyendo sus tareas.
                                </p>
                            </div>

                            {/* Sin Piloto — Long press 3s */}
                            <button
                                onMouseDown={() => {
                                    setNoPilotProgress(true);
                                    noPilotTimerRef.current = setTimeout(() => {
                                        setNoPilotProgress(false);
                                        handleNoPilotContingency();
                                    }, 3000);
                                }}
                                onMouseUp={() => { clearTimeout(noPilotTimerRef.current); setNoPilotProgress(false); }}
                                onMouseLeave={() => { clearTimeout(noPilotTimerRef.current); setNoPilotProgress(false); }}
                                onTouchStart={() => {
                                    setNoPilotProgress(true);
                                    noPilotTimerRef.current = setTimeout(() => {
                                        setNoPilotProgress(false);
                                        handleNoPilotContingency();
                                    }, 3000);
                                }}
                                onTouchEnd={() => { clearTimeout(noPilotTimerRef.current); setNoPilotProgress(false); }}
                                className="relative w-full flex items-center gap-3 px-4 py-4 bg-white rounded-xl border border-orange-200 hover:border-orange-300 transition-all overflow-hidden select-none group active:scale-[0.98] shadow-sm"
                            >
                                {/* Progress bar fill */}
                                {noPilotProgress && (
                                    <div
                                        className="absolute inset-0 bg-orange-100/80 origin-left"
                                        style={{ animation: 'contingencyFill 3s linear forwards' }}
                                    />
                                )}
                                <div className="relative p-2.5 bg-orange-100 rounded-xl text-orange-600 group-hover:bg-orange-200 transition-colors">
                                    <UserX size={20} className={noPilotProgress ? 'animate-pulse' : ''} />
                                </div>
                                <div className="relative flex-1 text-left">
                                    <p className="text-sm font-bold text-orange-700">Continuar sin Piloto</p>
                                    <p className="text-[10px] text-orange-500 font-semibold">
                                        {noPilotProgress ? '⏳ Mantén presionado 3s...' : 'Mantén presionado para activar'}
                                    </p>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                    noPilotProgress
                                        ? 'bg-orange-500 text-white scale-110'
                                        : 'bg-orange-100 text-orange-400'
                                }`}>
                                    <Plane size={14} className={noPilotProgress ? 'animate-bounce' : ''} />
                                </div>
                            </button>

                            <style jsx>{`
                                @keyframes contingencyFill {
                                    from { transform: scaleX(0); }
                                    to { transform: scaleX(1); }
                                }
                            `}</style>
                        </div>
                    )}
                </div>

                {/* --- FALLBACK COMPONENT INJECTION --- */}
                {children}

            </div>

            {/* --- FOOTER CTA --- */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
                <button
                    onClick={() => onCheckIn(null)}
                    disabled={(!canCheckIn && !isOfflineOrError) || checking}
                    className={`
                        w-full h-16 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-300 active:scale-[0.98]
                        ${(!canCheckIn && !isOfflineOrError)
                            ? 'bg-slate-300 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-500/30'
                        }
                    `}
                >
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                            <UserCheck size={20} strokeWidth={3} />
                            <span className="text-base font-black tracking-tight uppercase">
                                {buttonText}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold opacity-80">
                            {subText}
                        </span>
                    </div>
                </button>
                <button
                    onClick={() => onCheckIn({ force: true, bypass_reason: 'test_mode_remote' })}
                    disabled={checking}
                    className="mt-3 w-full text-center text-xs text-gray-400 underline"
                >
                    Modo Prueba: Forzar Check-in
                </button>
            </div>

        </div>
    );
}
