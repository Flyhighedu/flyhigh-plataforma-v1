'use client';

import {
    AudioLines,
    ChevronRight,
    CircleCheck,
    Clock3,
    LogOut,
    MapPin,
    Plane,
    Radio,
    User
} from 'lucide-react';
import { MiniAvatar } from '@/components/ui/MiniAvatar';
import Link from 'next/link';
import { planLabel, usePreparationData } from './preparation/PreparationUI';

function PreparationSummary({ visitId }) {
    const { data } = usePreparationData(visitId);
    if (!data?.visits[0]) return null;
    return <p className="mt-3 text-xs font-semibold text-slate-500">{planLabel(data.plans.find(p => p.visit_id === visitId), data.visits[0])}</p>;
}

function missionDateLabel(date) {
    if (!date) return '';
    return new Date(`${date}T00:00:00`).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short'
    });
}

function isMissionToday(mission, today) {
    return mission?.fecha === today;
}

export default function PilotHomeLobby({
    profile,
    missions = [],
    onSelectMission,
    onOpenNarrations,
    onOpenProfile,
    onLogout
}) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const nextMission = missions.find((mission) => mission.estatus === 'pendiente' || mission.estatus === 'en_progreso') || missions[0];
    const isCompleted = nextMission && ['completada', 'cerrada'].includes(nextMission.estatus);
    const isNotToday = nextMission && !isMissionToday(nextMission, today);
    const missionDisabled = isCompleted || isNotToday;
    const firstName = profile?.full_name?.split(' ')[0] || 'Piloto';

    return (
        <main
            className="min-h-[100svh] overflow-hidden bg-[#f3f7fb] text-[#071a33]"
            data-review-screen="pilot-home"
        >
            <section className="relative overflow-hidden rounded-b-[2rem] bg-[#06182c] px-5 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" aria-hidden="true" />
                <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />

                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-cyan-200">
                            <Plane size={18} strokeWidth={2.2} />
                        </div>
                        <div>
                            <p className="m-0 text-[15px] font-extrabold tracking-[-0.02em]">
                                FlyHigh<span className="text-cyan-300">Ops</span>
                            </p>
                            <p className="m-0 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Centro de vuelo
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onLogout}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white active:scale-95"
                        aria-label="Cerrar sesión"
                        title="Cerrar sesión"
                    >
                        <LogOut size={16} strokeWidth={2.2} />
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onOpenProfile}
                    className="relative mt-7 flex w-full items-center gap-3 rounded-2xl text-left transition active:scale-[0.99]"
                >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                        {profile?.avatar_config ? (
                            <MiniAvatar config={profile.avatar_config} border={false} size={58} />
                        ) : (
                            <User className="h-6 w-6 text-slate-300" />
                        )}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-200">
                            Piloto
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                        </span>
                        <span className="mt-0.5 block truncate text-[1.65rem] font-extrabold tracking-[-0.04em] text-white">
                            Hola, {firstName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-400">
                            Ver perfil <ChevronRight size={13} />
                        </span>
                    </span>
                </button>
            </section>

            <div className="relative mx-auto -mt-16 w-full max-w-md space-y-4 px-4 pb-[max(6rem,env(safe-area-inset-bottom))]">
                <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(4,24,48,0.45)]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                                <Plane size={21} strokeWidth={2.3} />
                            </div>
                            <div>
                                <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.17em] text-slate-400">
                                    Próxima misión
                                </p>
                                <p className="m-0 mt-0.5 text-xs font-semibold text-slate-500">
                                    {nextMission && isMissionToday(nextMission, today) ? 'Tu jornada de hoy' : nextMission ? missionDateLabel(nextMission.fecha) : 'Consulta tus próximas visitas'}
                                </p>
                            </div>
                        </div>

                        {nextMission && (
                            <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.13em] ${
                                nextMission.estatus === 'en_progreso'
                                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                    : isCompleted
                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                            }`}>
                                {nextMission.estatus === 'en_progreso'
                                    ? 'En progreso'
                                    : isCompleted
                                        ? 'Finalizada'
                                        : isNotToday
                                            ? missionDateLabel(nextMission.fecha)
                                            : 'Programada'}
                            </span>
                        )}
                    </div>

                    {nextMission ? (
                        <>
                            <h1 className="mt-5 text-[1.65rem] font-black leading-[1.08] tracking-[-0.035em] text-[#071a33]">
                                {nextMission.school_name}
                            </h1>
                            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                                <MapPin size={14} className="text-blue-500" />
                                {nextMission.colonia || 'Ubicación por confirmar'}
                            </p>

                            <PreparationSummary visitId={nextMission.id} />
                            <Link href={`/staff/visitas/${nextMission.id}`} className={`mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold ${isNotToday ? 'bg-blue-600 text-white' : 'border border-blue-100 bg-blue-50 text-blue-700'}`}>
                                Preparar visita <ChevronRight size={17} />
                            </Link>

                            {!isNotToday && <button
                                type="button"
                                onClick={() => !missionDisabled && onSelectMission(nextMission)}
                                disabled={missionDisabled}
                                className={`mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold transition active:scale-[0.99] ${
                                    missionDisabled
                                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                                        : 'bg-blue-600 text-white shadow-[0_12px_28px_-14px_rgba(37,99,235,0.75)] hover:bg-blue-500'
                                }`}
                            >
                                {isCompleted ? 'Misión finalizada' : isNotToday ? 'Aún no es la fecha' : 'Hacer check-in'}
                                {!missionDisabled && <ChevronRight size={17} strokeWidth={2.8} />}
                            </button>}
                        </>
                    ) : (
                        <div className="py-7 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <Clock3 size={21} />
                            </div>
                            <h1 className="mt-3 text-lg font-extrabold text-slate-800">Agenda despejada</h1>
                            <p className="mt-1 text-sm text-slate-500">No tienes próximas visitas en este momento.</p>
                        </div>
                    )}

                    <Link href="/staff/cronograma" className="mt-4 flex min-h-11 items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold text-blue-700"><span>Ver cronograma</span><ChevronRight size={17} /></Link>
                </section>

                <section className="relative overflow-hidden rounded-[1.75rem] bg-[#1264b8] p-5 text-white shadow-[0_16px_36px_-24px_rgba(18,100,184,0.7)]">

                    <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-white">
                                <AudioLines size={24} strokeWidth={2.2} />
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e55337] px-2.5 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.13em] text-white">
                                <Radio size={11} /> Acceso directo
                            </span>
                        </div>

                        <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.19em] text-white">
                            Cabina del piloto
                        </p>
                        <h2 className="mt-1 text-[1.75rem] font-black tracking-[-0.035em]">Narraciones</h2>
                        <p className="mt-2 max-w-[18rem] text-[13px] font-medium leading-relaxed text-white/90">
                            Explora el mapa, elige el grado y escucha la narración adecuada.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold text-white">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5">
                                <CircleCheck size={12} className="text-white" /> Explorar
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5">
                                <CircleCheck size={12} className="text-white" /> Escuchar
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1.5">
                                <CircleCheck size={12} className="text-white" /> Revisar
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={onOpenNarrations}
                            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-[#1264b8] shadow-[0_12px_30px_-18px_rgba(0,0,0,0.5)] transition active:scale-[0.99]"
                        >
                            Abrir narraciones <ChevronRight size={17} strokeWidth={2.8} />
                        </button>
                    </div>
                </section>

                <p className="px-3 pt-1 text-center text-[11px] font-medium leading-relaxed text-slate-400">
                    Narraciones permanece disponible aunque otras tareas de la jornada sigan pendientes.
                </p>
            </div>
        </main>
    );
}
