'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Navigation, Truck } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'assistant' || normalized === 'auxiliar' || normalized === 'aux') return 'assistant';
    if (normalized === 'teacher' || normalized === 'docente') return 'teacher';
    if (normalized === 'pilot') return 'pilot';
    return normalized;
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [head] = normalized.split(/\s+/);
    return head || fallback;
}

function resolveArrivalMeta(meta) {
    return {
        notified: meta.aux_arrival_notified === true || meta.arrival_notified === true || meta.closure_arrival_notification_done === true,
        byName: String(meta.aux_arrival_notified_by_name || meta.arrival_notified_by_name || meta.closure_arrival_notification_done_by_name || '')
    };
}

export default function ReturnRouteScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const normalizedRole = useMemo(() => normalizeRole(profile?.role), [profile?.role]);
    const isTeacher = normalizedRole === 'teacher';

    const initialMeta = parseMeta(missionInfo?.meta);
    const initialArrival = resolveArrivalMeta(initialMeta);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [arrivalNotified, setArrivalNotified] = useState(initialArrival.notified);
    const [arrivalByName, setArrivalByName] = useState(initialArrival.byName);

    const firstNameLabel = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextArrival = resolveArrivalMeta(meta);
        setArrivalNotified((prev) => (prev === nextArrival.notified ? prev : nextArrival.notified));
        setArrivalByName((prev) => (prev === nextArrival.byName ? prev : nextArrival.byName));
    }, [missionInfo?.meta, missionState]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(''), 2600);
        return () => clearTimeout(timer);
    }, [feedback]);

    const handleNotifyArrival = async () => {
        if (!isTeacher || !journeyId || !userId || isSubmitting || arrivalNotified) return;

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data, error: readError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            const currentMeta = parseMeta(data?.meta);
            const latestArrival = resolveArrivalMeta(currentMeta);

            if (latestArrival.notified) {
                setArrivalNotified(true);
                setArrivalByName(latestArrival.byName);
                onRefresh && onRefresh();
                return;
            }

            const nextMeta = {
                ...currentMeta,
                arrival_notified: true,
                arrival_notified_at: now,
                arrival_notified_by: userId,
                arrival_notified_by_name: firstNameLabel,
                aux_arrival_notified: true,
                aux_arrival_notified_at: now,
                aux_arrival_notified_by: userId,
                aux_arrival_notified_by_name: firstNameLabel,
                closure_arrival_notification_done: true,
                closure_arrival_notification_done_at: now,
                closure_arrival_notification_done_by: userId,
                closure_arrival_notification_done_by_name: firstNameLabel,
                closure_phase: 'return'
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'dismantling',
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setArrivalNotified(true);
            setArrivalByName(firstNameLabel);
            setFeedback('Llegada notificada. Iniciando descarga en base.');
            onRefresh && onRefresh();
        } catch (error) {
            console.error('No se pudo notificar llegada a base:', error);
            alert('No se pudo notificar llegada. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-sky-500 text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -right-20 top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -left-16 bottom-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            </div>

            <SyncHeader
                firstName={firstNameLabel}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load"
                onDemoStart={onRefresh}
            />

            <main className="relative z-10 mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-5 pb-28 pt-8">
                <div className="w-full overflow-hidden rounded-[34px] bg-white text-slate-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)]">
                    <div className="border-b border-slate-100 px-7 pb-5 pt-7">
                        <p className="m-0 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-sky-700">
                            <Truck size={13} />
                            Retorno
                        </p>

                        <h2 className="mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-slate-900">
                            En camino a base
                        </h2>

                        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                            El equipo mantiene el traslado coordinado hasta el punto de descarga final.
                        </p>
                    </div>

                    <div className="space-y-4 px-7 py-5">
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                                    <Navigation size={16} />
                                </div>
                                <div>
                                    <p className="m-0 text-sm font-bold text-slate-800">Comunicacion en trayecto</p>
                                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                                        El docente confirma llegada para desbloquear la fase de descarga.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {feedback ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700">
                                {feedback}
                            </div>
                        ) : null}

                        {arrivalNotified ? (
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                                Llegada notificada{arrivalByName ? ` por ${arrivalByName}` : ''}
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-bold text-slate-600">
                                Esperando confirmacion del docente...
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {isTeacher ? (
                <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-sky-500 via-sky-500/95 to-transparent px-5 pb-5 pt-4">
                    <div className="mx-auto w-full max-w-[420px]">
                        <button
                            type="button"
                            onClick={handleNotifyArrival}
                            disabled={arrivalNotified || isSubmitting}
                            className={getPrimaryCtaClasses(arrivalNotified || isSubmitting)}
                        >
                            {isSubmitting ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 size={17} className="animate-spin" />
                                    Notificando...
                                </span>
                            ) : (
                                'Notificar llegada a base'
                            )}
                        </button>

                        <p className="mt-2 text-center text-[11px] font-semibold text-white/80">
                            Esta accion habilita la fase de descarga para todo el equipo.
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
