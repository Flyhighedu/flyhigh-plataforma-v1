'use client';

import { useMemo } from 'react';

const ROLE_ORDER = ['pilot', 'teacher', 'assistant'];
const ROLE_LABELS = {
    pilot: 'Piloto',
    teacher: 'Docente',
    assistant: 'Auxiliar'
};

function parseObject(value) {
    if (!value) return Object.create(null);

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed
                : Object.create(null);
        } catch {
            return Object.create(null);
        }
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }

    return Object.create(null);
}

function toMs(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function asNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function fmtClock(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Mexico_City'
    });
}

function fmtTime(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Mexico_City'
    });
}

function fmtExactDateTime(iso) {
    if (!iso) return '--';
    return new Date(iso).toLocaleString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Mexico_City'
    });
}

function fmtDuration(startIso, endIso) {
    const startMs = toMs(startIso);
    const endMs = toMs(endIso);
    if (!startMs || !endMs || endMs <= startMs) return null;
    const totalMin = Math.round((endMs - startMs) / 60000);
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${h}h`;
}

function fmtMMSS(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const min = String(Math.floor(safe / 60)).padStart(2, '0');
    const sec = String(safe % 60).padStart(2, '0');
    return `${min}:${sec}`;
}

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'aux' || normalized === 'auxiliar') return 'assistant';
    if (normalized === 'docente') return 'teacher';
    return normalized;
}

function mergeFlightRows(...sources) {
    const map = new Map();

    sources.forEach((rows) => {
        if (!Array.isArray(rows)) return;
        rows.forEach((row, idx) => {
            const rowId = String(row?.id || '').trim();
            const missionId = String(row?.mission_id || row?.missionId || '').trim();
            const journeyId = String(row?.journey_id || row?.journeyId || '').trim();
            const startAt = row?.start_time || row?.startTime || row?.startedAt || row?.created_at || `idx-${idx}`;
            const key = rowId || `${journeyId}|${missionId}|${startAt}`;
            if (!map.has(key)) map.set(key, row);
        });
    });

    return Array.from(map.values());
}

function normalizeFlightRows(rows = []) {
    return rows
        .map((row, idx) => {
            const startIso = row?.start_time || row?.startTime || row?.startedAt || row?.created_at || null;
            const startMs = toMs(startIso);
            const durationSec = asNumber(row?.duration_seconds ?? row?.durationSeconds ?? row?.durationSec);
            const endIso = row?.end_time || row?.endTime || row?.endedAt || (startMs > 0 && durationSec > 0 ? new Date(startMs + (durationSec * 1000)).toISOString() : null);
            const endMs = toMs(endIso) || (startMs > 0 && durationSec > 0 ? startMs + (durationSec * 1000) : 0);

            return {
                key: String(row?.id || `flight-${idx}-${startMs || 'unknown'}`),
                startIso,
                startMs,
                endIso,
                endMs,
                durationSec,
                students: asNumber(row?.student_count ?? row?.studentCount ?? row?.students_count),
                staff: asNumber(row?.staff_count ?? row?.staffCount),
                incidents: Array.isArray(row?.incidents)
                    ? row.incidents
                    : (asNumber(row?.incidentsCount) > 0 ? [{ type: 'incidencia', description: `${asNumber(row.incidentsCount)} registradas` }] : []),
                raw: row
            };
        })
        .filter((row) => row.startMs > 0)
        .sort((a, b) => a.startMs - b.startMs);
}

function extractMissionMeta(mission, extraJourneyMeta) {
    const raw = mission?.raw || Object.create(null);
    const payload = parseObject(raw?.payload);

    const merged = {
        ...parseObject(mission?.metaSnapshot),
        ...parseObject(raw?.meta),
        ...parseObject(raw?.journey_meta),
        ...parseObject(raw?.journeyMeta),
        ...parseObject(payload?.meta),
        ...payload,
        ...parseObject(extraJourneyMeta),
    };

    return merged;
}

function pickFirstTimestamp(meta = {}, keys = []) {
    for (const key of keys) {
        const value = meta?.[key];
        const ms = toMs(value);
        if (ms > 0) return new Date(ms).toISOString();
    }
    return null;
}

function extractCheckoutComments(meta = {}, mission) {
    const byRole = ROLE_ORDER.reduce((acc, role) => {
        acc[role] = null;
        return acc;
    }, {});

    const lifecycleByRole =
        mission?.checkoutByRole && typeof mission.checkoutByRole === 'object' && !Array.isArray(mission.checkoutByRole)
            ? mission.checkoutByRole
            : Object.create(null);

    ROLE_ORDER.forEach((role) => {
        const comment = typeof lifecycleByRole?.[role]?.comment === 'string'
            ? lifecycleByRole[role].comment.trim()
            : '';
        if (comment) byRole[role] = comment;
    });

    const commentEntries = Array.isArray(meta?.checkout_comments) ? meta.checkout_comments : [];
    commentEntries.forEach((entry) => {
        const role = normalizeRole(entry?.role);
        const message = typeof entry?.message === 'string' ? entry.message.trim() : '';
        if (!ROLE_ORDER.includes(role) || !message) return;
        byRole[role] = message;
    });

    ROLE_ORDER.forEach((role) => {
        if (byRole[role]) return;
        const key = role === 'assistant' ? 'aux' : role;
        const direct = typeof meta?.[`closure_checkout_${key}_comment`] === 'string'
            ? meta[`closure_checkout_${key}_comment`].trim()
            : '';
        if (direct) byRole[role] = direct;
    });

    return byRole;
}

function buildPhaseTimeline(mission, meta, normalizedLogs, checkinEvents) {
    const snapshot = parseObject(mission?.timelineSnapshot);

    const firstFlightStart = normalizedLogs[0]?.startIso || null;
    const lastFlight = normalizedLogs.length > 0 ? normalizedLogs[normalizedLogs.length - 1] : null;
    const lastFlightEnd = lastFlight?.endIso || lastFlight?.startIso || null;

    const checkinAt =
        snapshot.checkinAt ||
        pickFirstTimestamp(meta, ['first_checkin_at', 'checkin_at', 'checkin_started_at', 'check_in_at']);
    const prepAt =
        snapshot.prepAt ||
        pickFirstTimestamp(meta, ['prep_started_at', 'montaje_started_at', 'prep_base_started_at', 'pilot_prep_complete_at', 'teacher_operation_ready_at', 'aux_operation_ready_at']);
    const operationAt =
        snapshot.operationAt ||
        pickFirstTimestamp(meta, ['operation_started_at', 'aux_operation_started_at']) ||
        firstFlightStart;
    const dismantlingAt =
        snapshot.dismantlingAt ||
        pickFirstTimestamp(meta, ['closure_started_at', 'dismantling_started_at']);
    const returnRouteAt =
        pickFirstTimestamp(meta, ['aux_return_route_started_at', 'closure_return_route_done_at']);
    const baseClosureAt =
        snapshot.baseClosureAt ||
        pickFirstTimestamp(meta, ['closure_base_started_at', 'arrival_notified_at', 'aux_arrival_notified_at', 'closure_arrival_notification_done_at']);
    const checkoutAt =
        snapshot.checkoutAt ||
        pickFirstTimestamp(meta, ['closure_checkout_started_at', 'closure_checkout_pilot_done_at', 'closure_checkout_teacher_done_at', 'closure_checkout_assistant_done_at']);
    const checkoutEndAt =
        snapshot.checkoutEndAt ||
        pickFirstTimestamp(meta, ['closure_checkout_done_at']) ||
        mission?.endTime ||
        mission?.missionDateTime ||
        null;

    // Per-person check-in details
    const checkinDetails = Array.isArray(checkinEvents) && checkinEvents.length > 0
        ? checkinEvents.map(e => ({
            name: e.full_name || e.name || 'Desconocido',
            role: ROLE_LABELS[normalizeRole(e.role)] || e.role,
            at: e.created_at || e.at
        })).sort((a, b) => toMs(a.at) - toMs(b.at))
        : null;

    // Per-person checkout details
    const checkoutDetails = [];
    const pilotCheckoutAt = pickFirstTimestamp(meta, ['closure_checkout_pilot_done_at']);
    const teacherCheckoutAt = pickFirstTimestamp(meta, ['closure_checkout_teacher_done_at']);
    const auxCheckoutAt = pickFirstTimestamp(meta, ['closure_checkout_assistant_done_at']);
    if (pilotCheckoutAt) checkoutDetails.push({ name: meta.closure_checkout_pilot_done_by_name || 'Piloto', role: 'Piloto', at: pilotCheckoutAt });
    if (teacherCheckoutAt) checkoutDetails.push({ name: meta.closure_checkout_teacher_done_by_name || 'Docente', role: 'Docente', at: teacherCheckoutAt });
    if (auxCheckoutAt) checkoutDetails.push({ name: meta.closure_checkout_assistant_done_by_name || 'Auxiliar', role: 'Auxiliar', at: auxCheckoutAt });
    checkoutDetails.sort((a, b) => toMs(a.at) - toMs(b.at));

    return [
        {
            id: 'checkin', label: 'Check-in', at: checkinAt, icon: 'how_to_reg',
            details: checkinDetails,
        },
        {
            id: 'prep', label: 'Montaje', at: prepAt, icon: 'construction',
            startAt: prepAt,
            endAt: operationAt,
            duration: fmtDuration(prepAt, operationAt),
        },
        {
            id: 'operation', label: 'Operación', at: operationAt, icon: 'flight_takeoff',
            firstFlightAt: firstFlightStart,
            lastFlightAt: lastFlightEnd,
            totalDuration: fmtDuration(firstFlightStart, lastFlightEnd),
        },
        {
            id: 'dismantling', label: 'Desmontaje', at: dismantlingAt, icon: 'handyman',
            startAt: dismantlingAt,
            endAt: returnRouteAt,
            duration: fmtDuration(dismantlingAt, returnRouteAt),
        },
        { id: 'base_closure', label: 'Cierre', at: baseClosureAt, icon: 'warehouse' },
        {
            id: 'checkout', label: 'Check-out', at: checkoutEndAt || checkoutAt, icon: 'flag',
            details: checkoutDetails.length > 0 ? checkoutDetails : null,
        },
    ];
}

export default function V2MissionDetails({
    mission,
    missionMetrics,
    flightLogs,
    loadingLogs = false,
    onOpenEvidence = null,
    checkinEvents = null,
    journeyMeta = null
}) {
    const mergedLogs = useMemo(() => {
        return mergeFlightRows(
            flightLogs,
            missionMetrics?.logs,
            mission?.preloadedLogs
        );
    }, [flightLogs, missionMetrics?.logs, mission?.preloadedLogs]);

    const normalizedLogs = useMemo(() => normalizeFlightRows(mergedLogs), [mergedLogs]);

    const totalDurationSec = normalizedLogs.reduce((acc, row) => acc + row.durationSec, 0);
    const totalStudentsFromLogs = normalizedLogs.reduce((acc, row) => acc + row.students, 0);
    const totalStaffFromLogs = normalizedLogs.reduce((acc, row) => acc + row.staff, 0);

    const averageDurationSec = normalizedLogs.length > 0
        ? Math.round(totalDurationSec / normalizedLogs.length)
        : asNumber(missionMetrics?.averageDurationSec);

    const interFlightGaps = [];
    for (let idx = 1; idx < normalizedLogs.length; idx += 1) {
        const prevEndMs = normalizedLogs[idx - 1].endMs || normalizedLogs[idx - 1].startMs;
        const nextStartMs = normalizedLogs[idx].startMs;
        if (nextStartMs > prevEndMs) {
            interFlightGaps.push(Math.floor((nextStartMs - prevEndMs) / 1000));
        }
    }
    const averageGapSec = interFlightGaps.length > 0
        ? Math.round(interFlightGaps.reduce((sum, gap) => sum + gap, 0) / interFlightGaps.length)
        : asNumber(missionMetrics?.averageGapSec);

    const totalFlights = asNumber(missionMetrics?.totalFlights) > 0
        ? asNumber(missionMetrics.totalFlights)
        : normalizedLogs.length;
    const totalStudents = asNumber(missionMetrics?.totalStudents) > 0
        ? asNumber(missionMetrics.totalStudents)
        : totalStudentsFromLogs;
    const totalStaff = asNumber(missionMetrics?.totalStaff) > 0
        ? asNumber(missionMetrics.totalStaff)
        : totalStaffFromLogs;
    const totalIncidents = asNumber(missionMetrics?.totalIncidents) > 0
        ? asNumber(missionMetrics.totalIncidents)
        : normalizedLogs.reduce((acc, row) => acc + row.incidents.length, 0);

    const missionMeta = useMemo(() => extractMissionMeta(mission, journeyMeta), [mission, journeyMeta]);
    const phaseTimeline = useMemo(() => buildPhaseTimeline(mission, missionMeta, normalizedLogs, checkinEvents), [mission, missionMeta, normalizedLogs, checkinEvents]);
    const checkoutComments = useMemo(() => extractCheckoutComments(missionMeta, mission), [missionMeta, mission]);
    const bitacoraRows = useMemo(() => {
        const rows = [];

        normalizedLogs.forEach((log, idx) => {
            rows.push({
                type: 'flight',
                key: `flight-${log.key}-${idx}`,
                log,
                number: idx + 1
            });

            const next = normalizedLogs[idx + 1];
            if (!next) return;

            const currentEndMs = log.endMs || (log.startMs + (log.durationSec * 1000));
            const nextStartMs = next.startMs;
            const gapSec = nextStartMs > currentEndMs
                ? Math.floor((nextStartMs - currentEndMs) / 1000)
                : 0;

            rows.push({
                type: 'gap',
                key: `gap-${log.key}-${next.key}`,
                gapSec,
                fromIso: log.endIso || log.startIso,
                toIso: next.startIso
            });
        });

        return rows;
    }, [normalizedLogs]);

    return (
        <div className="space-y-3 pt-3">
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-900/35 via-emerald-800/25 to-slate-900/45 px-3.5 py-3 shadow-[0_8px_22px_-14px_rgba(16,185,129,0.5)]">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/80">Informe 360 · V2</p>
                        <p className="mt-1 text-sm font-black text-emerald-50">Resumen ejecutivo de jornada</p>
                        <p className="mt-0.5 text-[11px] text-emerald-100/80">Cierre registrado: {mission?.date} · {mission?.time}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-400/20 text-emerald-100 border border-emerald-300/35">
                        Historial seguro
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Vuelos</p>
                    <p className="text-lg font-black text-white">{totalFlights}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Alumnos</p>
                    <p className="text-lg font-black text-emerald-300">{totalStudents}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Docentes</p>
                    <p className="text-lg font-black text-sky-300">{totalStaff}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Promedio vuelo</p>
                    <p className="text-lg font-black text-amber-300 tabular-nums">{fmtMMSS(averageDurationSec)}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2 col-span-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Promedio entre vuelos</p>
                        <p className="text-sm font-black text-cyan-300 tabular-nums">{fmtMMSS(averageGapSec)}</p>
                    </div>
                </div>
            </div>

            <section className="rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Linea de Tiempo Operativa</p>
                <div className="mt-3 space-y-1">
                    {phaseTimeline.map((phase, idx) => {
                        const hasTimestamp = Boolean(phase.at);
                        const isLast = idx === phaseTimeline.length - 1;
                        const hasDetails = Array.isArray(phase.details) && phase.details.length > 0;
                        const hasDuration = Boolean(phase.duration);
                        const isOperation = phase.id === 'operation';
                        const hasSubInfo = hasDetails || hasDuration || isOperation;

                        return (
                            <div key={phase.id} className="flex items-start gap-2.5">
                                <div className="flex flex-col items-center pt-0.5">
                                    <div className={`size-4 rounded-full border-2 ${hasTimestamp ? 'border-emerald-400 bg-emerald-400/20' : 'border-slate-600 bg-slate-800'}`} />
                                    {!isLast && <div className={`w-0.5 bg-slate-700/80 ${hasSubInfo ? 'min-h-[2.5rem]' : 'h-5'}`} style={hasSubInfo ? { flexGrow: 1 } : {}} />}
                                </div>
                                <div className="flex-1 min-w-0 pb-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-black text-slate-200 uppercase tracking-wide">{phase.label}</p>
                                        {!hasSubInfo && (
                                            <span className={`text-[11px] font-semibold tabular-nums ${hasTimestamp ? 'text-emerald-300' : 'text-slate-500'}`}>
                                                {hasTimestamp ? fmtTime(phase.at) : 'Pendiente'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Per-person details (check-in, checkout) */}
                                    {hasDetails && (
                                        <div className="mt-1 space-y-0.5">
                                            {phase.details.map((d, dIdx) => (
                                                <div key={dIdx} className="flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="text-slate-400">{d.name} <span className="text-slate-600">({d.role})</span></span>
                                                    <span className="font-semibold text-emerald-300/80 tabular-nums">{fmtTime(d.at)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Duration phases (montaje, desmontaje) */}
                                    {hasDuration && !isOperation && (
                                        <div className="mt-1 space-y-0.5">
                                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                                <span className="text-slate-400">Inicio</span>
                                                <span className="font-semibold text-emerald-300/80 tabular-nums">{fmtTime(phase.startAt)}</span>
                                            </div>
                                            {phase.endAt && (
                                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="text-slate-400">Fin</span>
                                                    <span className="font-semibold text-emerald-300/80 tabular-nums">{fmtTime(phase.endAt)}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                                <span className="text-slate-400">Duración</span>
                                                <span className="font-bold text-amber-300 tabular-nums">{phase.duration}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Operation stats (first/last flight, total time) */}
                                    {isOperation && hasTimestamp && (
                                        <div className="mt-1 space-y-0.5">
                                            {phase.firstFlightAt && (
                                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="text-slate-400">Primer vuelo</span>
                                                    <span className="font-semibold text-emerald-300/80 tabular-nums">{fmtTime(phase.firstFlightAt)}</span>
                                                </div>
                                            )}
                                            {phase.lastFlightAt && (
                                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="text-slate-400">Último vuelo</span>
                                                    <span className="font-semibold text-emerald-300/80 tabular-nums">{fmtTime(phase.lastFlightAt)}</span>
                                                </div>
                                            )}
                                            {phase.totalDuration && (
                                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="text-slate-400">Tiempo total</span>
                                                    <span className="font-bold text-amber-300 tabular-nums">{phase.totalDuration}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Fallback: show Pendiente for phases without sub-info that have no timestamp */}
                                    {!hasTimestamp && !hasDetails && !hasDuration && !isOperation && (
                                        <span className="text-[11px] text-slate-500">Pendiente</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="flex flex-wrap gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission?.checklistVerified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    {mission?.checklistVerified ? 'Checklist de cierre verificado' : 'Checklist de cierre pendiente'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission?.groupPhotoUrl ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-700/60 text-slate-400'}`}>
                    {mission?.groupPhotoUrl ? 'Foto grupal: disponible' : 'Foto grupal: no registrada'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission?.signatureUrl ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-slate-700/60 text-slate-400'}`}>
                    {mission?.signatureUrl ? 'Firma: disponible' : 'Firma: no registrada'}
                </span>
                {totalIncidents > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300">Incidencias: {totalIncidents}</span>
                )}
            </div>

            {(mission?.groupPhotoUrl || mission?.signatureUrl) && (
                <div className="grid grid-cols-2 gap-2">
                    {mission?.groupPhotoUrl && (
                        <button
                            type="button"
                            onClick={() => typeof onOpenEvidence === 'function' && onOpenEvidence(mission.groupPhotoUrl, { label: 'Foto grupal de cierre', typeHint: 'image' })}
                            className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900/50"
                        >
                            <img src={mission.groupPhotoUrl} alt="Foto grupal" className="h-24 w-full object-cover" />
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white">Foto grupal</span>
                        </button>
                    )}
                    {mission?.signatureUrl && (
                        <button
                            type="button"
                            onClick={() => typeof onOpenEvidence === 'function' && onOpenEvidence(mission.signatureUrl, { label: 'Firma de cierre', typeHint: 'image' })}
                            className="relative rounded-lg overflow-hidden border border-slate-700 bg-white"
                        >
                            <img src={mission.signatureUrl} alt="Firma docente" className="h-24 w-full object-contain" />
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white">Firma</span>
                        </button>
                    )}
                </div>
            )}

            {(() => {
                const EVIDENCE_DEFS = [
                    { key: 'pilot_spot_photo_url', label: 'Foto pista de aterrizaje', role: 'Piloto', type: 'image', color: 'sky' },
                    { key: 'civic_parallel_teacher_audio_url', label: 'Audio acto cívico', role: 'Docente', type: 'audio', color: 'amber' },
                    { key: 'unload_voice_url', label: 'Nota de voz estacionamiento', role: 'Docente', type: 'audio', color: 'amber' },
                    { key: 'aux_vehicle_evidence_url', label: 'Foto estacionamiento vehículo', role: 'Auxiliar', type: 'image', color: 'emerald' },
                    { key: 'aux_operation_stand_photo_url', label: 'Foto stand operación', role: 'Auxiliar', type: 'image', color: 'emerald' },
                ];

                const items = EVIDENCE_DEFS
                    .map((def) => {
                        const url = typeof missionMeta?.[def.key] === 'string' && missionMeta[def.key].trim() ? missionMeta[def.key].trim() : null;
                        return url ? { ...def, url } : null;
                    })
                    .filter(Boolean);

                if (items.length === 0) return null;

                const ROLE_COLORS = {
                    sky: { border: 'border-sky-500/30', bg: 'bg-sky-500/10', text: 'text-sky-300', badge: 'bg-sky-500/20 text-sky-200' },
                    amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-200' },
                    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-200' },
                };

                return (
                    <section className="rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidencias Operativas</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {items.map((item) => {
                                const palette = ROLE_COLORS[item.color] || ROLE_COLORS.sky;
                                const isAudio = item.type === 'audio';

                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => typeof onOpenEvidence === 'function' && onOpenEvidence(item.url, { label: `${item.label} — ${item.role}`, typeHint: item.type })}
                                        className={`relative rounded-lg overflow-hidden border ${palette.border} ${isAudio ? palette.bg : 'bg-slate-900/50'} text-left transition-transform active:scale-[0.97]`}
                                    >
                                        {isAudio ? (
                                            <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-4">
                                                <span className="material-symbols-outlined text-[28px]" style={{ color: 'inherit', fontVariationSettings: "'FILL' 1, 'wght' 600" }}>
                                                    graphic_eq
                                                </span>
                                                <p className={`text-[10px] font-black uppercase tracking-wide ${palette.text}`}>Audio</p>
                                            </div>
                                        ) : (
                                            <img src={item.url} alt={item.label} className="h-24 w-full object-cover" loading="lazy" />
                                        )}
                                        <div className="px-1.5 py-1 flex items-center gap-1 bg-slate-950/70">
                                            <span className={`shrink-0 px-1 py-px rounded text-[8px] font-black uppercase tracking-wide ${palette.badge}`}>{item.role}</span>
                                            <p className="text-[9px] font-bold text-slate-300 truncate">{item.label}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                );
            })()}

            <section>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Bitacora de Vuelos</p>
                {loadingLogs ? (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-3 flex items-center gap-2 text-slate-400 text-xs">
                        <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Cargando vuelos historicos...
                    </div>
                ) : normalizedLogs.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                        {bitacoraRows.slice(0, 48).map((row) => {
                            if (row.type === 'gap') {
                                return (
                                    <div
                                        key={row.key}
                                        className="rounded-lg border border-cyan-700/35 bg-cyan-500/10 px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                            <p className="font-bold uppercase tracking-wide text-cyan-200">Tiempo entre vuelos</p>
                                            <p className="font-black tabular-nums text-cyan-100">{fmtMMSS(row.gapSec)}</p>
                                        </div>
                                        <p className="mt-1 text-[10px] text-cyan-100/70">
                                            {fmtClock(row.fromIso)} → {fmtClock(row.toIso)}
                                        </p>
                                    </div>
                                );
                            }

                            const log = row.log;
                            return (
                                <div key={row.key} className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-bold text-slate-200">Vuelo #{row.number}</p>
                                        <p className="text-xs font-black text-emerald-300 tabular-nums">{fmtMMSS(log.durationSec)}</p>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                                        <span>Hora: {fmtClock(log.startIso)}</span>
                                        <span className="text-slate-600">•</span>
                                        <span>Alumnos: {log.students}</span>
                                        <span className="text-slate-600">•</span>
                                        <span>Docentes: {log.staff}</span>
                                        {log.incidents.length > 0 && (
                                            <>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-rose-300">Incidencias: {log.incidents.length}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/35 px-3 py-3 text-xs text-slate-500">
                        No hay vuelos guardados para esta mision.
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/45 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Comentarios del Equipo</p>
                <div className="mt-3 space-y-2">
                    {ROLE_ORDER.map((role) => {
                        const comment = checkoutComments[role];
                        const hasComment = typeof comment === 'string' && comment.trim().length > 0;
                        return (
                            <div key={`comment-${role}`} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{ROLE_LABELS[role]}</p>
                                <p className={`mt-1 text-xs leading-relaxed ${hasComment ? 'text-slate-200' : 'text-slate-500 italic'}`}>
                                    {hasComment ? comment : 'Sin comentarios'}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
