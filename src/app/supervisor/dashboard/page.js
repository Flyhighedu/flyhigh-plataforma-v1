'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { PREP_CHECKLISTS, getGroupedItems } from '@/config/prepChecklistConfig';
import { AUX_LOAD_GROUPS, TEACHER_TEAM_CHECK_TYPES, PILOT_PREP_BLOCKS, PILOT_BLOCK_CHECK_MAP } from '@/config/operationalChecklists';
import { CLOSURE_STEPS, CLOSURE_STEP_SEQUENCE, getClosurePhaseForStep } from '@/constants/closureFlow';
import { DISMANTLING_SCREEN_LABELS, getDismantlingFlags } from '@/utils/dismantlingRouting';
import {
    buildFlightSnapshotMap,
    buildSchoolMapById,
    formatDateAndTime,
    missionDateTimeFromClosure,
    resolveHistorySchoolName,
} from '@/utils/missionHistory';
import EvidenceViewerModal from '@/components/supervisor/EvidenceViewerModal';
import V2MissionDetails from '@/components/supervisor/V2MissionDetails';
import DeleteConfirmationModal from '@/components/supervisor/DeleteConfirmationModal';

/* ═══════════════ CONSTANTS ═══════════════ */
const ROLE_ORDER = ['pilot', 'teacher', 'assistant'];
const ACTIVE_MS = 5 * 60 * 1000;
const LIVE_COMPLETION_GRACE_MS = 25 * 60 * 1000;

const ROLE_META = {
    pilot: { label: 'Piloto', icon: 'flight' },
    teacher: { label: 'Docente', icon: 'school' },
    assistant: { label: 'Auxiliar', icon: 'support_agent' },
};

const PHASES = [
    { id: 'prep', label: 'Montaje', states: ['prep', 'PILOT_PREP', 'MISSION_BRIEF', 'CHECKIN_DONE', 'PREP_DONE', 'AUX_PREP_DONE', 'TEACHER_SUPPORTING_PILOT', 'PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK', 'AUX_CONTAINERS_DONE', 'ROUTE_READY'] },
    { id: 'route', label: 'En Ruta', states: ['ROUTE_IN_PROGRESS', 'IN_ROUTE'] },
    { id: 'operation', label: 'Operación', states: ['ARRIVAL_PHOTO_DONE', 'waiting_unload_assignment', 'waiting_dropzone', 'unload', 'post_unload_coordination', 'seat_deployment', 'OPERATION', 'PILOT_OPERATION'] },
    { id: 'closure', label: 'Cierre', states: ['SHUTDOWN', 'POST_MISSION_REPORT', 'CLOSURE', 'report', 'closed'] },
];

const AUX_LOADS = Array.isArray(AUX_LOAD_GROUPS) ? AUX_LOAD_GROUPS : [];

/* ═══════════════ LABEL MAP ═══════════════ */
const LABEL_MAP = (() => {
    const m = {};
    Object.values(PREP_CHECKLISTS).forEach(cfg => (cfg.items || []).forEach(it => { m[it.id] = it.label; }));
    AUX_LOADS.forEach((group) => {
        (group?.items || []).forEach((it) => { m[it.id] = it.label; });
        (group?.photos || []).forEach((it) => { m[it.id] = it.label; });
    });
    return m;
})();

/* ═══════════════ HELPERS ═══════════════ */
function groupBy(rows, key) {
    return rows.reduce((acc, r) => { const k = r[key]; if (k) (acc[k] || (acc[k] = [])).push(r); return acc; }, {});
}
function todayMX() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); }
function fmtClock(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });
}
function fmtDurationMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function fmtDurationBetween(a, b) {
    if (!a || !b) return null;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), sec = s % 60;
    return `${m}m ${String(sec).padStart(2, '0')}s`;
}
function fmtMMSS(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const min = String(Math.floor(safe / 60)).padStart(2, '0');
    const sec = String(safe % 60).padStart(2, '0');
    return `${min}:${sec}`;
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

function safeSchoolName(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

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
    return Number.isFinite(parsed) ? parsed : null;
}

function buildPhaseTimer(startMs, endMs, nowMs) {
    const safeStartMs = Number.isFinite(startMs) && startMs > 0 ? startMs : 0;
    if (!safeStartMs) {
        return {
            started: false,
            completed: false,
            seconds: 0,
            startedAtMs: 0,
            endedAtMs: 0
        };
    }

    const safeNowMs = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : Date.now();
    const safeEndMs = Number.isFinite(endMs) && endMs > safeStartMs ? endMs : safeNowMs;

    return {
        started: true,
        completed: Number.isFinite(endMs) && endMs > safeStartMs,
        seconds: Math.max(0, Math.floor((safeEndMs - safeStartMs) / 1000)),
        startedAtMs: safeStartMs,
        endedAtMs: safeEndMs
    };
}

function normalizeRoleKey(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'auxiliar' || normalized === 'aux') return 'assistant';
    if (normalized === 'docente') return 'teacher';
    return normalized;
}

function isTruthyFlag(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function getMetaFlag(meta = {}, keys = []) {
    return keys.some((key) => isTruthyFlag(meta?.[key]));
}

function getMetaTimestamp(meta = {}, keys = []) {
    for (const key of keys) {
        const value = meta?.[key];
        if (!value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    }
    return null;
}

function getEarliestTimestamp(values = []) {
    let winnerMs = 0;
    let winnerIso = null;

    values.forEach((value) => {
        if (!value) return;
        const ms = Date.parse(value);
        if (!Number.isFinite(ms)) return;
        if (!winnerIso || ms < winnerMs) {
            winnerMs = ms;
            winnerIso = new Date(ms).toISOString();
        }
    });

    return winnerIso;
}

function getLatestTimestamp(values = []) {
    let winnerMs = 0;
    let winnerIso = null;

    values.forEach((value) => {
        if (!value) return;
        const ms = Date.parse(value);
        if (!Number.isFinite(ms)) return;
        if (!winnerIso || ms > winnerMs) {
            winnerMs = ms;
            winnerIso = new Date(ms).toISOString();
        }
    });

    return winnerIso;
}

function getCheckoutStatusFromMeta(meta = {}) {
    const checkoutTeam =
        meta && typeof meta.closure_checkout_team === 'object' && !Array.isArray(meta.closure_checkout_team)
            ? meta.closure_checkout_team
            : Object.create(null);

    if (meta?.closure_checkout_done === true) {
        return {
            pilot: true,
            teacher: true,
            assistant: true
        };
    }

    return {
        pilot: meta?.closure_checkout_pilot_done === true || meta?.checkout_pilot_done === true || checkoutTeam.pilot === true,
        teacher: meta?.closure_checkout_teacher_done === true || meta?.checkout_teacher_done === true || checkoutTeam.teacher === true,
        assistant: meta?.closure_checkout_assistant_done === true || meta?.checkout_assistant_done === true || checkoutTeam.assistant === true
    };
}

function getCheckoutCommentsFromMeta(meta = {}) {
    const byRole = {
        pilot: null,
        teacher: null,
        assistant: null
    };

    const comments = Array.isArray(meta?.checkout_comments)
        ? meta.checkout_comments
        : [];

    comments.forEach((entry) => {
        const role = normalizeRoleKey(entry?.role);
        const message = typeof entry?.message === 'string' ? entry.message.trim() : '';
        if (!ROLE_ORDER.includes(role)) return;
        if (!message) return;
        byRole[role] = message;
    });

    return byRole;
}

const TERMINAL_REPORT_STATES = new Set(['REPORT', 'CLOSED', 'POST_MISSION_REPORT', 'CLOSURE']);

const SCHOOL_TEARDOWN_STEP_IDS = CLOSURE_STEP_SEQUENCE.filter((step) => {
    const closurePhase = getClosurePhaseForStep(step);
    return closurePhase === 'dismantling' || closurePhase === 'loading';
});

const BASE_CLOSURE_STEP_IDS = [
    CLOSURE_STEPS.EQUIPMENT_UNLOAD,
    ...CLOSURE_STEP_SEQUENCE.filter((step) => {
        return getClosurePhaseForStep(step) === 'base_closure' && step !== CLOSURE_STEPS.CHECKOUT;
    })
];

const GLOBAL_CLOSURE_TASKS = new Set([
    CLOSURE_STEPS.GLASSES_STORAGE,
    CLOSURE_STEPS.HEADPHONES_STORAGE,
    CLOSURE_STEPS.SEAT_FOLDING,
    CLOSURE_STEPS.CONTAINER_LOADING,
    CLOSURE_STEPS.RETURN_ROUTE,
    CLOSURE_STEPS.EQUIPMENT_UNLOAD
]);

const PHASE4_ROLE_STEP_FILTERS = {
    pilot: new Set([
        CLOSURE_STEPS.DRONE_STORAGE,
        CLOSURE_STEPS.GLASSES_STORAGE,
        CLOSURE_STEPS.HEADPHONES_STORAGE,
        CLOSURE_STEPS.SEAT_FOLDING,
        CLOSURE_STEPS.CONTAINER_LOADING,
        CLOSURE_STEPS.RETURN_ROUTE
    ]),
    teacher: new Set([
        CLOSURE_STEPS.GLASSES_STORAGE,
        CLOSURE_STEPS.HEADPHONES_STORAGE,
        CLOSURE_STEPS.SEAT_FOLDING,
        CLOSURE_STEPS.CONTAINER_LOADING,
        CLOSURE_STEPS.RETURN_ROUTE
    ]),
    assistant: new Set([
        CLOSURE_STEPS.AD_WALL_DISMANTLE,
        CLOSURE_STEPS.GLASSES_STORAGE,
        CLOSURE_STEPS.HEADPHONES_STORAGE,
        CLOSURE_STEPS.VEHICLE_POSITIONING,
        CLOSURE_STEPS.CONTAINER_LOADING,
        CLOSURE_STEPS.RETURN_ROUTE
    ])
};

const PHASE6_ROLE_STEP_FILTERS = {
    pilot: new Set([
        CLOSURE_STEPS.EQUIPMENT_UNLOAD,
        CLOSURE_STEPS.RETURN_INVENTORY,
        CLOSURE_STEPS.ELECTRONICS_CHARGING
    ]),
    teacher: new Set([
        CLOSURE_STEPS.EQUIPMENT_UNLOAD
    ]),
    assistant: new Set([
        CLOSURE_STEPS.EQUIPMENT_UNLOAD,
        CLOSURE_STEPS.FINAL_PARKING
    ])
};

const CLOSURE_TASK_TIME_KEYS = {
    [CLOSURE_STEPS.AD_WALL_DISMANTLE]: ['ad_wall_dismantle_done_at', 'closure_ad_wall_dismantle_done_at', 'aux_adwall_dismantled_at'],
    [CLOSURE_STEPS.DRONE_STORAGE]: ['drone_storage_done_at', 'global_drone_storage_done_at', 'pilot_drones_stored_at'],
    [CLOSURE_STEPS.GLASSES_STORAGE]: ['glasses_storage_done_at', 'global_glasses_storage_done_at', 'global_glasses_stored_at'],
    [CLOSURE_STEPS.HEADPHONES_STORAGE]: ['headphones_storage_done_at', 'global_headphones_storage_done_at', 'global_headphones_stored_at'],
    [CLOSURE_STEPS.SEAT_FOLDING]: ['seat_folding_done_at', 'global_seat_folding_done_at', 'global_seats_folded_at'],
    [CLOSURE_STEPS.VEHICLE_POSITIONING]: ['vehicle_positioning_done_at', 'closure_vehicle_positioning_done_at', 'aux_vehicle_positioned_at'],
    [CLOSURE_STEPS.CONTAINER_LOADING]: ['global_equipment_loaded_at', 'global_container_loading_done_at', 'pilot_containers_loaded_at'],
    [CLOSURE_STEPS.RETURN_ROUTE]: ['aux_return_route_started_at', 'closure_return_route_done_at'],
    [CLOSURE_STEPS.ARRIVAL_NOTIFICATION]: ['aux_arrival_notified_at', 'arrival_notified_at', 'closure_arrival_notification_done_at'],
    [CLOSURE_STEPS.EQUIPMENT_UNLOAD]: ['global_equipment_unloaded_at', 'closure_equipment_unload_done_at', 'team_unload_done_at'],
    [CLOSURE_STEPS.RETURN_INVENTORY]: ['pilot_return_inventory_done_at', 'closure_return_inventory_done_at'],
    [CLOSURE_STEPS.ELECTRONICS_CHARGING]: ['pilot_electronics_charged_at', 'closure_electronics_charging_done_at'],
    [CLOSURE_STEPS.FINAL_PARKING]: ['aux_final_parking_done_at', 'closure_final_parking_done_at', 'aux_final_parking_checklist_done_at']
};

function getClosureStepDone(flags, stepId) {
    switch (stepId) {
        case CLOSURE_STEPS.AD_WALL_DISMANTLE:
            return flags.auxAdWallDismantled;
        case CLOSURE_STEPS.DRONE_STORAGE:
            return flags.pilotDronesStored;
        case CLOSURE_STEPS.GLASSES_STORAGE:
            return flags.globalGlassesStored;
        case CLOSURE_STEPS.HEADPHONES_STORAGE:
            return flags.globalHeadphonesStored;
        case CLOSURE_STEPS.SEAT_FOLDING:
            return flags.globalSeatsFolded;
        case CLOSURE_STEPS.VEHICLE_POSITIONING:
            return flags.auxVehiclePositioned;
        case CLOSURE_STEPS.CONTAINER_LOADING:
            return flags.globalEquipmentLoaded;
        case CLOSURE_STEPS.RETURN_ROUTE:
            return flags.auxReturnRouteStarted;
        case CLOSURE_STEPS.ARRIVAL_NOTIFICATION:
            return flags.auxArrivalNotified;
        case CLOSURE_STEPS.EQUIPMENT_UNLOAD:
            return flags.globalEquipmentUnloaded;
        case CLOSURE_STEPS.RETURN_INVENTORY:
            return flags.pilotReturnInventoryDone;
        case CLOSURE_STEPS.ELECTRONICS_CHARGING:
            return flags.pilotElectronicsCharged;
        case CLOSURE_STEPS.FINAL_PARKING:
            return flags.auxFinalParkingDone;
        default:
            return false;
    }
}

function getClosureStepTimestamp(meta, stepId) {
    return getMetaTimestamp(meta, CLOSURE_TASK_TIME_KEYS[stepId] || []);
}

function getClosureTaskLabel(stepId) {
    return DISMANTLING_SCREEN_LABELS[stepId] || String(stepId || '').replaceAll('_', ' ');
}

function buildLifecycleRoleCard({
    role,
    person,
    blockLabel,
    tasks,
    forceComplete,
    activePhase,
    updatedAt
}) {
    const normalizedTasks = (tasks || []).map((task) => ({
        ...task,
        done: forceComplete ? true : Boolean(task.done)
    }));

    const firstPendingIdx = activePhase && !forceComplete
        ? normalizedTasks.findIndex((task) => !task.done)
        : -1;

    const tasksWithStatus = normalizedTasks.map((task, idx) => {
        let status = 'pending';
        if (task.done) status = 'completed';
        else if (idx === firstPendingIdx) status = 'active';
        return { ...task, status };
    });

    const doneCount = tasksWithStatus.filter((task) => task.done).length;
    const totalCount = tasksWithStatus.length;
    const completed = totalCount > 0 && doneCount === totalCount;
    const progressPct = totalCount > 0
        ? Math.round((doneCount / totalCount) * 100)
        : 0;

    const activeTask = firstPendingIdx >= 0 ? tasksWithStatus[firstPendingIdx] : null;
    const statusText = forceComplete || completed
        ? 'Finalizado'
        : activeTask
            ? `En curso: ${activeTask.label}`
            : 'Pendiente';

    return {
        role,
        person,
        blockLabel,
        tasks: tasksWithStatus,
        doneCount,
        totalCount,
        completed,
        progressPct,
        forceComplete,
        activeTask,
        statusText,
        updatedAt
    };
}

function normalizeOperationFlight(row) {
    if (!row || typeof row !== 'object') return null;

    const startTime = row.start_time || row.startTime || null;
    const endTime = row.end_time || row.endTime || null;
    const durationSeconds = Number(row.duration_seconds ?? row.durationSeconds ?? 0);
    const flightNumber = Number(row.flight_number ?? row.flightNumber ?? 0);
    const students = Number(row.student_count ?? row.studentCount ?? 0);
    const staff = Number(row.staff_count ?? row.staffCount ?? 0);
    const incidents = Array.isArray(row.incidents) ? row.incidents : [];
    const startAtMs = toMs(startTime) ?? 0;
    const endAtMs = toMs(endTime) ?? startAtMs;

    return {
        id: row.id || `${row.journey_id || row.mission_id || 'flight'}-${startAtMs}`,
        flightId: row.flight_id || row.flightId || row.id || null,
        flightNumber: Number.isFinite(flightNumber) && flightNumber > 0 ? Math.floor(flightNumber) : null,
        missionId: row.mission_id ? String(row.mission_id) : null,
        journeyId: row.journey_id || null,
        startTime,
        endTime,
        startedAtMs: startAtMs,
        endAtMs,
        durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
            ? durationSeconds
            : Math.max(0, Math.floor((endAtMs - startAtMs) / 1000)),
        studentCount: Number.isFinite(students) ? students : 0,
        staffCount: Number.isFinite(staff) ? staff : 0,
        incidents,
        incidentsCount: incidents.length,
        synced: row.synced === true,
        createdAt: row.created_at || null
    };
}

function normalizeAuxActiveFlight(raw, nowMs) {
    if (!raw || typeof raw !== 'object') return null;

    const startedAt = raw.startedAt || raw.start_time || null;
    const startedAtMs = toMs(startedAt) ?? Number(raw.startTime || raw.startTimeMs || 0);
    if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return null;

    const students = Number(raw.studentCount ?? raw.student_count ?? 0);
    const staff = Number(raw.staffCount ?? raw.staff_count ?? 0);
    const flightNumber = Number(raw.flightNumber ?? raw.flight_number ?? 0);

    return {
        flightId: raw.flightId || `flight-${startedAtMs}`,
        flightNumber: Number.isFinite(flightNumber) && flightNumber > 0 ? Math.floor(flightNumber) : null,
        startedAt: startedAt || new Date(startedAtMs).toISOString(),
        startedAtMs,
        studentCount: Number.isFinite(students) ? students : 0,
        staffCount: Number.isFinite(staff) ? staff : 0,
        createdByName: raw.createdByName || null,
        updatedAt: raw.updatedAt || null,
        elapsedSec: Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
    };
}

function normalizePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
}

function operationFlightAnchorMs(flight) {
    return flight?.startedAtMs || flight?.endAtMs || 0;
}

function buildOperationFlightsWithNumbers(flights) {
    const byStartAsc = [...(flights || [])].sort((a, b) => {
        const aAnchor = operationFlightAnchorMs(a);
        const bAnchor = operationFlightAnchorMs(b);
        if (aAnchor !== bAnchor) return aAnchor - bAnchor;
        return (a?.endAtMs || 0) - (b?.endAtMs || 0);
    });

    const numberedAsc = byStartAsc.map((flight, idx) => ({
        ...flight,
        flightNumber: normalizePositiveInt(flight.flightNumber) || (idx + 1)
    }));

    const numberedDesc = [...numberedAsc].sort((a, b) => {
        if ((b?.endAtMs || 0) !== (a?.endAtMs || 0)) return (b?.endAtMs || 0) - (a?.endAtMs || 0);
        return operationFlightAnchorMs(b) - operationFlightAnchorMs(a);
    });

    return {
        asc: numberedAsc,
        desc: numberedDesc
    };
}

function buildInterFlightItemsByNewerFlightId(flightsDesc) {
    const flightsAsc = [...(flightsDesc || [])].sort((a, b) => operationFlightAnchorMs(a) - operationFlightAnchorMs(b));
    const byNewerFlightId = new Map();

    for (let idx = 1; idx < flightsAsc.length; idx += 1) {
        const olderFlight = flightsAsc[idx - 1];
        const newerFlight = flightsAsc[idx];

        const intervalStartMs = olderFlight?.endAtMs || 0;
        const intervalEndMs = newerFlight?.startedAtMs || operationFlightAnchorMs(newerFlight);

        if (!intervalStartMs || !intervalEndMs || intervalEndMs <= intervalStartMs) continue;

        byNewerFlightId.set(newerFlight.id, {
            id: `interflight-${olderFlight.id}-${newerFlight.id}`,
            durationSeconds: Math.max(0, Math.floor((intervalEndMs - intervalStartMs) / 1000)),
            fromFlightNumber: olderFlight.flightNumber,
            toFlightNumber: newerFlight.flightNumber,
            startedAtMs: intervalStartMs,
            endedAtMs: intervalEndMs
        });
    }

    return byNewerFlightId;
}

function phaseFor(state) { return state ? PHASES.findIndex(p => p.states.includes(state)) : -1; }
function isRecent(iso, now) { if (!iso) return false; const age = now - new Date(iso).getTime(); return age >= 0 && age <= ACTIVE_MS; }
function roleOf(ev, profiles) {
    const p = profiles[ev.user_id]?.role;
    if (ROLE_ORDER.includes(p)) return p;
    const r = ev.payload?.role;
    return ROLE_ORDER.includes(r) ? r : null;
}
function initials(name) {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Per-role card content keyed by mission_state. Each entry: { emoji, title, desc, next?, showData? }
const STATE_ROLE_CARDS = {
    prep: {
        pilot: { emoji: '📋', title: 'En montaje', desc: 'Revisando checklist de vuelo y equipo.', next: 'Verificación de vehículo' },
        teacher: { emoji: '📋', title: 'En montaje', desc: 'Completando checklist docente y verificación de equipo.', next: 'Confirmación de misión' },
        assistant: { emoji: '📋', title: 'En montaje', desc: 'Revisando checklist de montaje general.', next: 'Montaje de vehículo' },
    },
    PILOT_PREP: {
        pilot: { emoji: '🧭', title: 'Montaje de vuelo', desc: 'Reconocimiento del entorno, vuelo de prueba y ruta óptima.', next: 'Listo para carga' },
        teacher: { emoji: '📋', title: 'En montaje', desc: 'Completando tareas de montaje.', next: 'Apoyo al piloto' },
        assistant: { emoji: '📋', title: 'En montaje', desc: 'Revisando equipo de montaje.', next: 'Checklist de vehículo' },
    },
    CHECKIN_DONE: {
        pilot: { emoji: '✅', title: 'Check-in completado', desc: 'Identidad verificada. Iniciando checklist de montaje.', next: 'Montaje de vuelo' },
        teacher: { emoji: '✅', title: 'Check-in completado', desc: 'Identidad verificada. Iniciando checklist docente.', next: 'Checklist docente' },
        assistant: { emoji: '✅', title: 'Check-in completado', desc: 'Identidad verificada. Iniciando montaje.', next: 'Checklist de vehículo' },
    },
    PREP_DONE: {
        pilot: { emoji: '🎯', title: 'Montaje listo', desc: 'Checklist completado. Esperando confirmación del equipo.', next: 'Carga de vehículo' },
        teacher: { emoji: '🎯', title: 'Montaje listo', desc: 'Checklist completado. Apoyando al piloto en bodega.', next: 'Apoyo al piloto' },
        assistant: { emoji: '🎯', title: 'Montaje listo', desc: 'Checklist completado. En espera de confirmación global.', next: 'Checklist de vehículo' },
    },
    AUX_PREP_DONE: {
        pilot: { emoji: '🎯', title: 'Montaje listo', desc: 'Esperando al equipo para iniciar carga.', next: 'Carga de vehículo' },
        teacher: { emoji: '🤝', title: 'Apoyando al piloto', desc: 'Asistiendo al piloto con la verificación final.', next: 'Confirmación de salida' },
        assistant: { emoji: '🎯', title: 'Montaje listo', desc: 'Checklist del auxiliar completado.', next: 'Checklist de vehículo' },
    },
    TEACHER_SUPPORTING_PILOT: {
        pilot: { emoji: '🧭', title: 'Montaje de vuelo', desc: 'Reconocimiento del entorno, vuelo de prueba y ruta óptima.', next: 'Listo para carga' },
        teacher: { emoji: '🤝', title: 'Apoyando al piloto', desc: 'Asistiendo al piloto con la verificación final en bodega.', next: 'Momento de cargar' },
        assistant: { emoji: '📋', title: 'En montaje', desc: 'Esperando indicación del piloto.', next: 'Checklist de vehículo' },
    },
    PILOT_READY_FOR_LOAD: {
        pilot: { emoji: '✅', title: 'Listo para carga', desc: 'Checklist de vuelo completado. Esperando carga del vehículo.', next: 'En ruta' },
        teacher: { emoji: '🚚', title: 'Momento de cargar', desc: 'El piloto terminó. Coordinando carga del vehículo con el auxiliar.', next: 'Confirmar salida' },
        assistant: { emoji: '⏳', title: 'Esperando indicación', desc: 'Esperando a que el piloto confirme para iniciar revisión del vehículo.', next: 'Revisión de vehículo' },
    },
    WAITING_AUX_VEHICLE_CHECK: {
        pilot: { emoji: '✅', title: 'Listo para carga', desc: 'Esperando que el auxiliar complete el checklist del vehículo.', next: 'En ruta' },
        teacher: { emoji: '🚚', title: 'Supervisando carga', desc: 'Coordinando con el auxiliar la carga del vehículo.', next: 'Confirmar salida' },
        assistant: { emoji: '🔍', title: 'Revisando vehículo', desc: 'Verificando estado del vehículo y cargando contenedores.', next: 'Confirmar contenedores' },
    },
    AUX_CONTAINERS_DONE: {
        pilot: { emoji: '✅', title: 'Carga verificada', desc: 'Vehículo listo. Esperando confirmación de salida.', next: 'En ruta' },
        teacher: { emoji: '🚀', title: 'Confirmando salida', desc: 'Verificando que todo esté listo para iniciar la ruta.', next: 'Iniciar ruta' },
        assistant: { emoji: '✅', title: 'Carga lista', desc: 'Contenedores verificados y vehículo cargado.', next: 'En ruta' },
    },
    ROUTE_READY: {
        pilot: { emoji: '🧭', title: 'Listo para salir', desc: 'Todo el equipo listo. Esperando al docente para iniciar ruta.', next: 'En ruta' },
        teacher: { emoji: '🧭', title: 'Listo para salir', desc: 'Desliza para confirmar salida e iniciar la ruta.', next: 'En ruta' },
        assistant: { emoji: '🧭', title: 'Listo para salir', desc: 'Esperando confirmación del docente para salir.', next: 'En ruta' },
    },
    ROUTE_IN_PROGRESS: {
        pilot: { emoji: '🚚', title: 'En ruta a la escuela', desc: 'Viajando hacia la escuela. Revisando plan de vuelo.', next: 'Llegada' },
        teacher: { emoji: '🚚', title: 'En ruta a la escuela', desc: 'Viajando hacia la escuela. Notificar llegada al arribar.', next: 'Foto de llegada' },
        assistant: { emoji: '🚚', title: 'En ruta a la escuela', desc: 'Conduciendo hacia el destino. Concentrado en la vía.', next: 'Llegada' },
    },
    IN_ROUTE: {
        pilot: { emoji: '🚚', title: 'En ruta a la escuela', desc: 'Viajando hacia la escuela. Revisando plan de vuelo.', next: 'Llegada' },
        teacher: { emoji: '🚚', title: 'En ruta a la escuela', desc: 'Viajando hacia la escuela. Notificar llegada al arribar.', next: 'Foto de llegada' },
        assistant: { emoji: '🚚', title: 'En ruta a la escuela', desc: 'Conduciendo hacia el destino. Concentrado en la vía.', next: 'Llegada' },
    },
    ARRIVAL_PHOTO_DONE: {
        pilot: { emoji: '📍', title: 'Identificando pista', desc: 'Está buscando el punto más seguro para despegar.', next: 'Confirmar punto de pista' },
        teacher: { emoji: '📸', title: 'Llegada confirmada', desc: 'Va a Dirección para definir la zona de descarga.', next: 'Dirección' },
        assistant: { emoji: '🏫', title: 'Esperando indicación', desc: 'Espera la indicación de Dirección para mover el vehículo.', next: 'Acomodar vehículo' },
    },
    waiting_unload_assignment: {
        pilot: { emoji: '📍', title: 'Identificando pista', desc: 'Valida un punto de despegue seguro y despejado.', next: 'Confirmar punto de pista' },
        teacher: { emoji: '🏫', title: 'En Dirección', desc: 'Define zona de descarga (dentro/fuera) y envía indicación al auxiliar.', next: 'Preparando descarga', showData: ['access', 'note', 'voice'] },
        assistant: { emoji: '⏳', title: 'Esperando zona', desc: 'En espera de indicación para acomodar el vehículo en descarga.', next: 'Acomodar vehículo' },
    },
    waiting_dropzone: {
        pilot: { emoji: '📸', title: '{name} confirma pista', desc: 'Está fijando el punto final de despegue con referencia visual.', next: 'Montaje de vuelo' },
        teacher: { emoji: '🚚', title: '{name} va a zona de descarga', desc: 'Se mueve al punto acordado para iniciar maniobra.', next: 'Descarga global', showData: ['access', 'note', 'voice'] },
        assistant: { emoji: '🚙', title: '{name} acomoda el vehículo', desc: 'Coloca el vehículo en la zona de descarga indicada.', next: 'Descarga global', showData: ['access', 'note', 'voice'] },
    },
    unload: {
        pilot: { emoji: '🧭', title: '{name} prepara el vuelo', desc: 'Está revisando entorno, prueba y ruta para un vuelo seguro.', next: 'Operación', showPrepProgress: true },
        teacher: { emoji: '🤝', title: '{name} en apoyo de descarga', desc: 'Alinea al equipo mientras avanza la descarga global.', next: 'Confirmar acto cívico', showData: ['access', 'note', 'voice'] },
        assistant: { emoji: '🤝', title: '{name} en apoyo logístico', desc: 'Apoya la descarga global y mantiene el flujo operativo.', next: 'Estacionamiento final', showData: ['access', 'note', 'voice'] },
    },
    post_unload_coordination: {
        pilot: { emoji: '🧭', title: '{name} prepara el vuelo', desc: 'Ajusta detalles finales para iniciar sin riesgo.', next: 'Operación', showPrepProgress: true },
        teacher: { emoji: '🏫', title: '{name} en Dirección', desc: 'Confirma si habrá acto cívico para liberar arranque.', next: 'Despliegue de sillas', showCivicProgress: true },
        assistant: { emoji: '🚙', title: '{name} estaciona vehículo', desc: 'Lleva el vehículo al estacionamiento final y toma evidencia.', next: 'Despliegue de sillas', showParkingProgress: true },
    },
    seat_deployment: {
        pilot: { emoji: '🧭', title: '{name} prepara el vuelo', desc: 'Últimas verificaciones antes de operar.', next: 'Operación', showPrepProgress: true },
        teacher: { emoji: '🏫', title: '{name} en Dirección', desc: 'Cierra confirmación con escuela para iniciar operación.', next: 'Operación educativa', showCivicProgress: true },
        assistant: { emoji: '🚙', title: '{name} estaciona vehículo', desc: 'Confirma estacionamiento final para liberar operación.', next: 'Operación', showParkingProgress: true },
    },
    OPERATION: {
        pilot: { emoji: '🎓', title: 'Operación en curso', desc: 'Está pilotando durante la sesión educativa.', next: 'Cierre' },
        teacher: { emoji: '🎓', title: 'Operación educativa', desc: 'Está guiando la sesión con los alumnos.', next: 'Cierre' },
        assistant: { emoji: '🎓', title: 'Operación educativa', desc: 'Está apoyando logística y seguridad en sitio.', next: 'Cierre' },
    },
    PILOT_OPERATION: {
        pilot: { emoji: '🎓', title: 'Operación en curso', desc: 'Está pilotando durante la sesión educativa.', next: 'Cierre' },
        teacher: { emoji: '🎓', title: 'Operación educativa', desc: 'Está guiando la sesión con los alumnos.', next: 'Cierre' },
        assistant: { emoji: '🎓', title: 'Operación educativa', desc: 'Está apoyando logística y seguridad en sitio.', next: 'Cierre' },
    },
    SHUTDOWN: {
        pilot: { emoji: '🔒', title: 'Cierre en curso', desc: 'Está guardando equipo de vuelo y cerrando tareas.', next: 'Reporte final' },
        teacher: { emoji: '🔒', title: 'Cierre en curso', desc: 'Está finalizando la sesión y cierre con la escuela.', next: 'Reporte final' },
        assistant: { emoji: '🔒', title: 'Cierre en curso', desc: 'Está recogiendo equipo y dejando salida lista.', next: 'Reporte final' },
    },
};

/* ═══ ROADMAP POR ROL (solo post-llegada) ═══ */
const ROUTE_STATES = ['ROUTE_IN_PROGRESS', 'IN_ROUTE'];
const ONSITE_STATES = ['ARRIVAL_PHOTO_DONE', 'waiting_unload_assignment', 'waiting_dropzone', 'unload', 'post_unload_coordination', 'seat_deployment'];
const OPERATION_STATES = ['OPERATION', 'PILOT_OPERATION'];
const CLOSURE_STATES = ['SHUTDOWN', 'POST_MISSION_REPORT', 'CLOSURE', 'report', 'closed'];
const POST_ARRIVAL_STATES = [...ONSITE_STATES, ...OPERATION_STATES, ...CLOSURE_STATES];

const ROLE_TASK_ROADMAP = {
    pilot: [
        'Identificar pista',
        'Montaje de vuelo',
        'Audio piloto',
        'Ambientación musical',
        'Coordinación global'
    ],
    teacher: [
        'Dirección: definir zona',
        'Confirmar acto cívico',
        'Confirmar 3 tandas',
        'Validar zona de espera',
        'Docente listo para iniciar'
    ],
    assistant: [
        'Acomodar vehículo (zona de descarga)',
        'Estacionamiento final (evidencia)',
        'Instalar lona publicitaria',
        'Foto final del stand',
        'Auxiliar listo para iniciar'
    ]
};

const UNLOAD_AND_AFTER_STATES = ['unload', 'post_unload_coordination', 'seat_deployment', ...OPERATION_STATES, ...CLOSURE_STATES];
const SEAT_AND_AFTER_STATES = ['seat_deployment', ...OPERATION_STATES, ...CLOSURE_STATES];
const POST_PREP_COMPLETE_STATES = [...OPERATION_STATES, ...CLOSURE_STATES, 'dismantling', 'completed', 'operation'];
const POST_PREP_COMPLETE_STATE_SET = new Set(
    POST_PREP_COMPLETE_STATES.map((state) => String(state || '').trim().toUpperCase())
);

function normalizeMissionState(missionState) {
    return String(missionState || '').trim();
}

function isMissionPastPrep(missionState) {
    const normalized = normalizeMissionState(missionState).toUpperCase();
    if (!normalized) return false;
    return POST_PREP_COMPLETE_STATE_SET.has(normalized);
}

function buildInactiveRoleRoadmap(role) {
    const iconByLabel = {
        'Identificar pista': 'location_on',
        'Montaje de vuelo': 'flight_takeoff',
        'Audio piloto': 'volume_up',
        'Ambientación musical': 'music_note',
        'Coordinación global': 'hub',
        'Dirección: definir zona': 'apartment',
        'Confirmar acto cívico': 'campaign',
        'Confirmar 3 tandas': 'groups_3',
        'Validar zona de espera': 'chair',
        'Docente listo para iniciar': 'fact_check',
        'Acomodar vehículo (zona de descarga)': 'local_shipping',
        'Estacionamiento final (evidencia)': 'local_parking',
        'Instalar lona publicitaria': 'view_sidebar',
        'Foto final del stand': 'add_a_photo',
        'Auxiliar listo para iniciar': 'task_alt'
    };
    return (ROLE_TASK_ROADMAP[role] || []).map((label, idx) => ({
        id: `${role}-task-${idx}`,
        kind: 'role',
        label,
        icon: iconByLabel[label] || 'task_alt',
        desc: 'Se activa al confirmar llegada con foto.',
        status: 'inactive'
    }));
}

function taskStatus(done, active) {
    if (done) return 'completed';
    if (active) return 'active';
    return 'pending';
}

const GLOBAL_HEADPHONES_TOTAL = 6;
const DEFAULT_GLASSES_STATIONS = 2;

function getGlobalHeadphonesProgress(meta = {}) {
    const rawChecks =
        meta && typeof meta.global_headphones_checks === 'object' && !Array.isArray(meta.global_headphones_checks)
            ? meta.global_headphones_checks
            : Object.create(null);

    const done = Object.values(rawChecks).filter((item) => item && item.confirmed === true).length;

    return {
        done: Math.min(done, GLOBAL_HEADPHONES_TOTAL),
        total: GLOBAL_HEADPHONES_TOTAL
    };
}

function getGlobalGlassesStationCount(meta = {}) {
    const raw = Number(meta.global_glasses_station_count);
    if (Number.isFinite(raw) && raw > 0) {
        return Math.max(1, Math.min(12, Math.floor(raw)));
    }

    const rawChecks =
        meta && typeof meta.global_glasses_checks === 'object' && !Array.isArray(meta.global_glasses_checks)
            ? meta.global_glasses_checks
            : Object.create(null);

    let maxSeat = 0;
    Object.keys(rawChecks).forEach((key) => {
        const match = key.match(/^seat_(\d+)_(connect_cable|confirm_image)$/);
        if (!match) return;
        const seatNumber = Number(match[1]);
        if (Number.isFinite(seatNumber) && seatNumber > maxSeat) {
            maxSeat = seatNumber;
        }
    });

    return maxSeat > 0 ? Math.max(1, Math.min(12, maxSeat)) : DEFAULT_GLASSES_STATIONS;
}

function getGlobalGlassesProgress(meta = {}) {
    const stationCount = getGlobalGlassesStationCount(meta);
    const rawChecks =
        meta && typeof meta.global_glasses_checks === 'object' && !Array.isArray(meta.global_glasses_checks)
            ? meta.global_glasses_checks
            : Object.create(null);

    const requiredKeys = [
        'block0_connect_cabinet',
        'block0_route_to_seats',
        'block1_take_from_case',
        'block1_place_on_seat'
    ];

    for (let idx = 1; idx <= stationCount; idx += 1) {
        requiredKeys.push(`seat_${idx}_connect_cable`);
        requiredKeys.push(`seat_${idx}_confirm_image`);
    }

    const done = requiredKeys.reduce((sum, key) => {
        const item = rawChecks[key];
        return sum + (item && item.confirmed === true ? 1 : 0);
    }, 0);

    return {
        done,
        total: requiredKeys.length,
        stationCount
    };
}

const GLOBAL_TASK_META_KEYS = {
    team_unload: ['global_equipment_unloaded', 'closure_equipment_unload_done', 'global_team_unload_done', 'team_unload_done'],
    seat_deployment: ['global_seat_deployment_done'],
    headphones_setup: ['global_headphones_done'],
    glasses_setup: ['global_glasses_done']
};

const GLOBAL_TASK_DONE_BY_NAME_KEYS = {
    team_unload: ['global_equipment_unloaded_by_name', 'closure_equipment_unload_done_by_name', 'global_team_unload_done_by_name'],
    seat_deployment: ['global_seat_deployment_done_by_name'],
    headphones_setup: ['global_headphones_done_by_name'],
    glasses_setup: ['global_glasses_done_by_name']
};

function getGlobalTaskDone(meta = {}, taskKey, fallbackDone = false) {
    const keys = GLOBAL_TASK_META_KEYS[taskKey] || [];
    const byMeta = keys.some((key) => meta?.[key] === true);
    return byMeta || Boolean(fallbackDone);
}

function getGlobalTaskDoneByName(meta = {}, taskKey) {
    const keys = GLOBAL_TASK_DONE_BY_NAME_KEYS[taskKey] || [];
    for (const key of keys) {
        const value = typeof meta?.[key] === 'string' ? meta[key].trim() : '';
        if (value) return value;
    }
    return null;
}

function buildTeacherTaskFlow(missionState, meta = {}, postArrivalEnabled, context = {}) {
    if (!postArrivalEnabled) return buildInactiveRoleRoadmap('teacher');

    const timeline = [];
    const nowMs = Number.isFinite(context.nowMs) ? context.nowMs : Date.now();
    const assistantName = context.assistantName || 'Auxiliar';
    const teacherDecision = meta.teacher_civic_decision || (meta.teacher_civic_notified === true ? 'yes' : null);
    const teacherHasCivic = teacherDecision === 'yes';
    const missionInOperation = isMissionPastPrep(missionState);

    const seatDeploymentDone = getGlobalTaskDone(meta, 'seat_deployment', missionInOperation);
    const headphonesDone = getGlobalTaskDone(meta, 'headphones_setup', missionInOperation);
    const glassesDone = getGlobalTaskDone(meta, 'glasses_setup', missionInOperation);

    const civicDone = Boolean(meta.teacher_civic_notified) || missionInOperation;
    const directionDone = UNLOAD_AND_AFTER_STATES.includes(missionState);
    const directionActive = ['ARRIVAL_PHOTO_DONE', 'waiting_unload_assignment', 'waiting_dropzone'].includes(missionState);
    const directionDesc = missionState === 'ARRIVAL_PHOTO_DONE'
        ? 'Camina a Direccion para definir zona de descarga.'
        : missionState === 'waiting_unload_assignment'
            ? 'Define descarga dentro/fuera y envia nota al auxiliar.'
            : missionState === 'waiting_dropzone'
                ? 'Zona definida y compartida con el equipo.'
                : 'Zona de descarga confirmada por Direccion.';

    timeline.push({
        id: 'teacher-direction',
        kind: 'role',
        label: 'Dirección: definir zona',
        icon: 'apartment',
        desc: directionDesc,
        status: taskStatus(directionDone, directionActive)
    });

    const unloadDone = getGlobalTaskDone(meta, 'team_unload', UNLOAD_AND_AFTER_STATES.includes(missionState) && missionState !== 'unload');
    const unloadActive = missionState === 'unload' && !unloadDone;
    const unloadDoneByName = getGlobalTaskDoneByName(meta, 'team_unload');
    const unloadDesc = missionState === 'unload'
        ? 'Coordina y participa en la descarga de equipo.'
        : unloadDone
            ? `Descarga global completada${unloadDoneByName ? ` por ${unloadDoneByName}` : ' con el equipo.'}`
            : 'Se habilita cuando el auxiliar confirma zona de descarga.';

    timeline.push({
        id: 'teacher-global-unload',
        kind: 'global',
        globalId: 'team_unload',
        label: 'Descarga de equipo',
        icon: 'inventory_2',
        desc: unloadDesc,
        status: taskStatus(unloadDone, unloadActive)
    });

    const civicActive = !civicDone && ['post_unload_coordination', 'seat_deployment'].includes(missionState);
    let civicDesc = 'Confirma con Direccion si habra acto civico.';
    if (civicDone) {
        if (meta.teacher_civic_decision === 'yes') {
            civicDesc = 'Acto civico confirmado con Direccion.';
        } else if (meta.teacher_civic_decision === 'no') {
            civicDesc = meta.teacher_civic_reason
                ? `No habra acto civico: ${meta.teacher_civic_reason_detail || meta.teacher_civic_reason}`
                : 'Escuela notificada: no habra acto civico.';
        } else {
            civicDesc = 'Confirmacion con Direccion completada.';
        }
    } else if (!['post_unload_coordination', 'seat_deployment'].includes(missionState)) {
        civicDesc = 'Se habilita despues de la descarga de equipo.';
    }

    timeline.push({
        id: 'teacher-civic',
        kind: 'role',
        label: 'Confirmar acto cívico',
        icon: 'campaign',
        accent: 'emerald',
        desc: civicDesc,
        status: taskStatus(civicDone, civicActive)
    });

    const teacherAudioStatus = meta.civic_parallel_teacher_audio_status || 'idle';
    const auxCivicStatus = meta.civic_parallel_aux_status || null;
    const civicParallelInProgress = meta.civic_parallel_status === 'in_progress';
    const audioRequiredSec = Math.max(1, Number(meta.civic_parallel_teacher_audio_required_sec) || 90);
    const audioDurationSecMeta = Math.max(0, Number(meta.civic_parallel_teacher_audio_duration_sec) || 0);

    let audioElapsedSec = audioDurationSecMeta;
    if (teacherAudioStatus === 'recording' && meta.civic_parallel_teacher_audio_started_at) {
        const startedAtMs = new Date(meta.civic_parallel_teacher_audio_started_at).getTime();
        if (Number.isFinite(startedAtMs) && startedAtMs > 0) {
            audioElapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
        }
    }
    const audioProgressPct = Math.min(100, Math.round((audioElapsedSec / audioRequiredSec) * 100));

    const auxEvidenceReady = auxCivicStatus === 'uploaded';
    const auxEvidenceInProcess = civicParallelInProgress && !auxEvidenceReady && (!auxCivicStatus || ['pending_recording', 'recording', 'pending_upload', 'uploading', 'failed'].includes(auxCivicStatus));

    const civicAudioApplicable = teacherHasCivic;
    const civicAudioSkipped = teacherDecision === 'no';
    const civicAudioDone = civicAudioSkipped || teacherAudioStatus === 'uploaded' || (civicAudioApplicable && missionInOperation);
    const civicAudioActive = civicAudioApplicable && !civicAudioDone && SEAT_AND_AFTER_STATES.includes(missionState) && (
        missionState === 'seat_deployment' ||
        civicParallelInProgress ||
        ['recording', 'pending_upload', 'uploading'].includes(teacherAudioStatus) ||
        Boolean(meta.civic_parallel_teacher_audio_started_at)
    );
    let civicAudioLabel = 'Acto civico - evidencia de audio';
    let civicAudioDesc = 'Se habilita si Direccion confirma acto civico.';

    if (civicAudioSkipped) {
        civicAudioLabel = 'Acto civico - audio no requerido';
        civicAudioDesc = meta.teacher_civic_reason
            ? `No aplica: ${meta.teacher_civic_reason_detail || meta.teacher_civic_reason}.`
            : 'No aplica para esta sede.';
    } else if (teacherDecision === 'yes') {
        civicAudioDesc = 'Pendiente grabar evidencia de audio del acto civico.';
        if (teacherAudioStatus === 'recording') {
            civicAudioLabel = 'Acto civico - grabando audio';
            civicAudioDesc = `Grabando evidencia de audio (${fmtMMSS(audioElapsedSec)} / ${fmtMMSS(audioRequiredSec)} · ${audioProgressPct}%).`;
        } else if (teacherAudioStatus === 'pending_upload') {
            civicAudioLabel = 'Acto civico - guardando audio';
            civicAudioDesc = 'Audio capturado. Guardando evidencia del acto civico.';
        } else if (teacherAudioStatus === 'uploading') {
            civicAudioLabel = 'Acto civico - guardando audio';
            civicAudioDesc = 'Subiendo evidencia de audio del acto civico.';
        } else if (teacherAudioStatus === 'failed') {
            civicAudioLabel = 'Acto civico - audio con incidencia';
            civicAudioDesc = 'No se pudo guardar el audio. El flujo operativo continua y el reintento queda en segundo plano.';
        } else if (civicAudioDone) {
            civicAudioLabel = 'Acto civico - audio enviado';
            civicAudioDesc = 'Evidencia de audio enviada correctamente.';
        } else if (civicParallelInProgress) {
            civicAudioDesc = 'Acto civico en curso. Iniciar grabacion de audio.';
        }

        if (auxEvidenceReady) {
            civicAudioDesc = `${civicAudioDesc} ${assistantName} ya entregó evidencia.`;
        } else if (auxEvidenceInProcess) {
            civicAudioDesc = `${civicAudioDesc} ${assistantName} está grabando evidencia.`;
        }
    }

    timeline.push({
        id: 'teacher-civic-audio',
        kind: 'role',
        label: civicAudioLabel,
        icon: 'graphic_eq',
        accent: 'emerald',
        desc: civicAudioDesc,
        audioUrl: meta.civic_parallel_teacher_audio_url || null,
        audioDurationSec: Number(meta.civic_parallel_teacher_audio_duration_sec) || null,
        audioUploadedAt: meta.civic_parallel_teacher_audio_uploaded_at || null,
        countAsBlock: false,
        status: taskStatus(civicAudioDone, civicAudioActive)
    });

    const civicAudioBlocksFlow = civicAudioApplicable && !civicAudioDone && teacherAudioStatus !== 'failed';
    const seatUnlockedByCivic = civicDone && (!civicAudioApplicable || civicAudioDone || teacherAudioStatus === 'failed' || missionInOperation);
    const seatActive =
        missionState === 'seat_deployment' &&
        seatUnlockedByCivic &&
        !seatDeploymentDone;
    const seatDesc = seatDeploymentDone
        ? 'Despliegue de asientos completado con el equipo.'
        : !civicDone
            ? 'Se habilita al confirmar acto civico.'
            : civicAudioBlocksFlow
                ? 'En espera de cerrar evidencia de acto civico.'
                : seatActive
                    ? 'Ejecuta despliegue de asientos para liberar operacion.'
                    : 'Pendiente de condiciones globales para desplegar asientos.';

    timeline.push({
        id: 'teacher-global-seat',
        kind: 'global',
        globalId: 'seat_deployment',
        label: 'Despliegue de asientos',
        icon: 'event_seat',
        desc: seatDesc,
        status: taskStatus(seatDeploymentDone, seatActive)
    });

    const headphonesProgress = getGlobalHeadphonesProgress(meta);
    const headphonesActive =
        missionState === 'seat_deployment' &&
        seatDeploymentDone &&
        !headphonesDone;
    const headphonesDoneBy = getGlobalTaskDoneByName(meta, 'headphones_setup');
    const headphonesDesc = headphonesDone
        ? `Audifonos configurados${headphonesDoneBy ? ` por ${headphonesDoneBy}` : ''}.`
        : headphonesActive
            ? `Checklist colaborativo en curso (${headphonesProgress.done}/${headphonesProgress.total} confirmados).`
            : !seatDeploymentDone
                ? 'Se habilita al terminar despliegue de asientos.'
                : 'Pendiente de iniciar configuracion de audifonos.';

    timeline.push({
        id: 'teacher-global-headphones',
        kind: 'global',
        globalId: 'headphones_setup',
        label: 'Configura audifonos',
        icon: 'headphones',
        desc: headphonesDesc,
        status: taskStatus(headphonesDone, headphonesActive)
    });

    const glassesProgress = getGlobalGlassesProgress(meta);
    const glassesActive =
        missionState === 'seat_deployment' &&
        seatDeploymentDone &&
        headphonesDone &&
        !glassesDone;
    const glassesDoneBy = getGlobalTaskDoneByName(meta, 'glasses_setup');
    const glassesDesc = glassesDone
        ? `Gafas configuradas${glassesDoneBy ? ` por ${glassesDoneBy}` : ''}.`
        : glassesActive
            ? `Checklist colaborativo en curso (${glassesProgress.done}/${glassesProgress.total} confirmados).`
            : !headphonesDone
                ? 'Se habilita al terminar configuracion de audifonos.'
                : 'Pendiente de iniciar configuracion de gafas.';

    timeline.push({
        id: 'teacher-global-glasses',
        kind: 'global',
        globalId: 'glasses_setup',
        label: 'Configuracion de gafas',
        icon: 'view_in_ar',
        desc: glassesDesc,
        status: taskStatus(glassesDone, glassesActive)
    });

    const teacherReadyChecks =
        meta && typeof meta.teacher_operation_ready_checks === 'object' && !Array.isArray(meta.teacher_operation_ready_checks)
            ? meta.teacher_operation_ready_checks
            : Object.create(null);
    const kickoffUnlocked = glassesDone;
    const batchesReadyDone = teacherReadyChecks.batches_ready === true || missionInOperation;
    const waitingZoneReadyDone = teacherReadyChecks.waiting_zone_ready === true || missionInOperation;
    const teacherReadyDone = meta.teacher_operation_ready === true || missionInOperation;

    const batchesActive = missionState === 'seat_deployment' && kickoffUnlocked && !batchesReadyDone;
    const batchesDesc = batchesReadyDone
        ? '3 tandas confirmadas (1 en vuelo, 2 en espera).'
        : kickoffUnlocked
            ? 'Pide al delegado 3 tandas: 1 en vuelo y 2 en espera.'
            : 'Se habilita al terminar la configuracion global.';

    timeline.push({
        id: 'teacher-ready-batches',
        kind: 'role',
        label: 'Confirmar 3 tandas',
        icon: 'groups_3',
        desc: batchesDesc,
        status: taskStatus(batchesReadyDone, batchesActive)
    });

    const waitingZoneActive =
        missionState === 'seat_deployment' &&
        kickoffUnlocked &&
        batchesReadyDone &&
        !waitingZoneReadyDone;
    const waitingZoneDesc = waitingZoneReadyDone
        ? 'Zona de espera validada con alumnos sentados y ordenados.'
        : kickoffUnlocked
            ? batchesReadyDone
                ? 'Confirma zona de espera lista para 2 tandas sentadas.'
                : 'Primero confirma 3 tandas para validar la zona de espera.'
            : 'Se habilita al terminar la configuracion global.';

    timeline.push({
        id: 'teacher-ready-waiting-zone',
        kind: 'role',
        label: 'Validar zona de espera',
        icon: 'chair',
        desc: waitingZoneDesc,
        status: taskStatus(waitingZoneReadyDone, waitingZoneActive)
    });

    const teacherReadyActive =
        missionState === 'seat_deployment' &&
        kickoffUnlocked &&
        batchesReadyDone &&
        waitingZoneReadyDone &&
        !teacherReadyDone;
    let teacherReadyDesc = teacherReadyDone
        ? `Docente listo para iniciar${meta.teacher_operation_ready_by_name ? ` (${meta.teacher_operation_ready_by_name})` : ''}.`
        : kickoffUnlocked
            ? 'Confirma que el flujo docente esta listo para iniciar operacion.'
            : 'Pendiente de liberar configuracion global para iniciar operacion.';

    if (!teacherReadyDone && kickoffUnlocked && meta.pilot_music_ambience_done !== true) {
        teacherReadyDesc = 'Checklist listo. Esperando ambientacion musical del piloto.';
    }

    timeline.push({
        id: 'teacher-operation-ready',
        kind: 'role',
        label: 'Docente listo para iniciar',
        icon: 'fact_check',
        desc: teacherReadyDesc,
        readyAt: meta.teacher_operation_ready_at || null,
        status: taskStatus(teacherReadyDone, teacherReadyActive)
    });

    return timeline;
}

function buildAssistantTaskFlow(missionState, meta = {}, postArrivalEnabled, context = {}) {
    if (!postArrivalEnabled) return buildInactiveRoleRoadmap('assistant');

    const timeline = [];
    const nowMs = Number.isFinite(context.nowMs) ? context.nowMs : Date.now();
    const teacherName = context.teacherName || 'Docente';
    const missionInOperation = isMissionPastPrep(missionState);
    const auxReady = Boolean(meta.aux_ready_seat_deployment);
    const parkingEvidence = Boolean(meta.aux_vehicle_evidence_url);
    const adWallEvidence = Boolean(meta.aux_ad_wall_evidence_url);
    const adWallDone =
        meta.aux_ad_wall_done === true ||
        missionInOperation;
    const seatDeploymentDone = getGlobalTaskDone(meta, 'seat_deployment', missionInOperation);
    const headphonesDone = getGlobalTaskDone(meta, 'headphones_setup', missionInOperation);
    const glassesDone = getGlobalTaskDone(meta, 'glasses_setup', missionInOperation);

    const dropzoneDone = UNLOAD_AND_AFTER_STATES.includes(missionState);
    const dropzoneActive = missionState === 'waiting_dropzone';
    const dropzoneDesc = missionState === 'waiting_unload_assignment'
        ? 'Espera indicacion de Direccion para definir zona de descarga.'
        : missionState === 'waiting_dropzone'
            ? 'Acomoda el vehiculo en la zona de descarga indicada.'
            : missionState === 'unload'
                ? 'Vehiculo acomodado. Participa en descarga global.'
                : 'Vehiculo acomodado en zona de descarga.';

    timeline.push({
        id: 'assistant-dropzone',
        kind: 'role',
        label: 'Acomodar vehículo (zona de descarga)',
        icon: 'local_shipping',
        desc: dropzoneDesc,
        status: taskStatus(dropzoneDone, dropzoneActive)
    });

    const unloadDone = getGlobalTaskDone(meta, 'team_unload', UNLOAD_AND_AFTER_STATES.includes(missionState) && missionState !== 'unload');
    const unloadActive = missionState === 'unload' && !unloadDone;
    const unloadDoneByName = getGlobalTaskDoneByName(meta, 'team_unload');
    const unloadDesc = missionState === 'unload'
        ? 'Participa en descarga de equipo y contenedores.'
        : unloadDone
            ? `Descarga global completada${unloadDoneByName ? ` por ${unloadDoneByName}` : ' con el equipo.'}`
            : 'Se habilita al confirmar zona de descarga.';

    timeline.push({
        id: 'assistant-global-unload',
        kind: 'global',
        globalId: 'team_unload',
        label: 'Descarga de equipo',
        icon: 'inventory_2',
        desc: unloadDesc,
        status: taskStatus(unloadDone, unloadActive)
    });

    const parkingDone = auxReady || missionInOperation;
    const parkingActive = !parkingDone && ['post_unload_coordination', 'seat_deployment'].includes(missionState);
    const parkingDesc = parkingDone
        ? 'Vehiculo estacionado y asegurado con evidencia.'
        : parkingEvidence
            ? 'Evidencia recibida. Falta confirmar estacionamiento final.'
            : 'Mueve el vehiculo al estacionamiento final y confirma con foto.';

    timeline.push({
        id: 'assistant-parking',
        kind: 'role',
        label: 'Estacionamiento final (evidencia)',
        icon: 'local_parking',
        desc: parkingDesc,
        status: taskStatus(parkingDone, parkingActive)
    });

    const adWallActive = missionState === 'seat_deployment' && auxReady && !adWallDone;
    const adWallDesc = adWallDone
        ? 'Lona publicitaria instalada con evidencia.'
        : adWallEvidence
            ? 'Evidencia recibida. Falta confirmar instalacion de la lona.'
            : 'Instala la lona publicitaria y registra evidencia fotografica.';

    timeline.push({
        id: 'assistant-ad-wall',
        kind: 'role',
        label: 'Instalar lona publicitaria',
        icon: 'view_sidebar',
        desc: adWallDesc,
        status: taskStatus(adWallDone, adWallActive)
    });

    const teacherDecision = meta.teacher_civic_decision || (meta.teacher_civic_notified === true ? 'yes' : null);
    const teacherHasCivic = teacherDecision === 'yes';
    const assistantCivicStatus = meta.civic_parallel_aux_status || null;
    const civicParallelInProgress = meta.civic_parallel_status === 'in_progress';
    const assistantCivicApplicable = teacherHasCivic;
    const assistantCivicSkipped = teacherDecision === 'no';
    const assistantCivicDone = assistantCivicSkipped || assistantCivicStatus === 'uploaded' || (assistantCivicApplicable && missionInOperation);
    const assistantCivicActive = assistantCivicApplicable && !assistantCivicDone && SEAT_AND_AFTER_STATES.includes(missionState) && (
        civicParallelInProgress
        || ['pending_recording', 'recording', 'pending_upload', 'uploading', 'failed'].includes(assistantCivicStatus)
        || Boolean(meta.civic_parallel_aux_started_at)
    );

    let videoElapsedSec = Math.max(0, Number(meta.civic_parallel_aux_duration_sec) || 0);
    if (assistantCivicStatus === 'recording' && meta.civic_parallel_aux_started_at) {
        const startedAtMs = new Date(meta.civic_parallel_aux_started_at).getTime();
        if (Number.isFinite(startedAtMs) && startedAtMs > 0) {
            videoElapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
        }
    }

    let civicVideoLabel = 'Evidencia de acto civico';
    let civicVideoDesc = 'Se habilita cuando el Docente confirma acto civico.';

    if (assistantCivicSkipped) {
        civicVideoLabel = 'Evidencia de acto civico - no requerida';
        civicVideoDesc = 'No aplica para esta sede.';
    } else if (teacherDecision === 'yes') {
        civicVideoDesc = `Espera a que ${teacherName} empiece a hablar y comienza a grabar (1-2 min).`;
        if (assistantCivicStatus === 'recording') {
            civicVideoLabel = 'Evidencia de acto civico - grabando video';
            civicVideoDesc = `Grabando evidencia de video (${fmtMMSS(videoElapsedSec)}).`;
        } else if (assistantCivicStatus === 'pending_upload') {
            civicVideoLabel = 'Evidencia de acto civico - guardando video';
            civicVideoDesc = 'Video capturado. Guardando evidencia del acto civico.';
        } else if (assistantCivicStatus === 'uploading') {
            civicVideoLabel = 'Evidencia de acto civico - guardando video';
            civicVideoDesc = 'Subiendo evidencia de video del acto civico.';
        } else if (assistantCivicStatus === 'failed') {
            civicVideoLabel = 'Evidencia de acto civico - reintento';
            civicVideoDesc = 'Error al subir evidencia. Reintento pendiente.';
        } else if (assistantCivicDone) {
            civicVideoLabel = 'Evidencia de acto civico - video enviado';
            civicVideoDesc = 'Evidencia de video enviada correctamente.';
        }
    }

    timeline.push({
        id: 'assistant-civic-video',
        kind: 'role',
        label: civicVideoLabel,
        icon: 'videocam',
        desc: civicVideoDesc,
        videoUrl: meta.civic_parallel_aux_video_url || null,
        videoDurationSec: Number(meta.civic_parallel_aux_duration_sec) || null,
        videoUploadedAt: meta.civic_parallel_aux_uploaded_at || null,
        countAsBlock: false,
        status: taskStatus(assistantCivicDone, assistantCivicActive)
    });

    const civicSatisfied = !assistantCivicApplicable || assistantCivicDone || assistantCivicStatus === 'failed' || missionInOperation;
    const seatActive =
        missionState === 'seat_deployment' &&
        adWallDone &&
        civicSatisfied &&
        !seatDeploymentDone;
    const seatDesc = seatDeploymentDone
        ? 'Despliegue de asientos completado con el equipo.'
        : !adWallDone
            ? 'Completa primero la instalacion de la lona publicitaria.'
            : assistantCivicApplicable && !civicSatisfied
                ? 'En evidencia de acto civico antes de liberar operacion.'
                : seatActive
                    ? 'Participa en despliegue de asientos para liberar operacion.'
                    : 'Pendiente de condiciones globales para desplegar asientos.';

    timeline.push({
        id: 'assistant-global-seat',
        kind: 'global',
        globalId: 'seat_deployment',
        label: 'Despliegue de asientos',
        icon: 'event_seat',
        desc: seatDesc,
        status: taskStatus(seatDeploymentDone, seatActive)
    });

    const headphonesProgress = getGlobalHeadphonesProgress(meta);
    const headphonesActive =
        missionState === 'seat_deployment' &&
        seatDeploymentDone &&
        !headphonesDone;
    const headphonesDoneBy = getGlobalTaskDoneByName(meta, 'headphones_setup');
    const headphonesDesc = headphonesDone
        ? `Audifonos configurados${headphonesDoneBy ? ` por ${headphonesDoneBy}` : ''}.`
        : headphonesActive
            ? `Checklist colaborativo en curso (${headphonesProgress.done}/${headphonesProgress.total} confirmados).`
            : !seatDeploymentDone
                ? 'Se habilita al terminar despliegue de asientos.'
                : 'Pendiente de iniciar configuracion de audifonos.';

    timeline.push({
        id: 'assistant-global-headphones',
        kind: 'global',
        globalId: 'headphones_setup',
        label: 'Configura audifonos',
        icon: 'headphones',
        desc: headphonesDesc,
        status: taskStatus(headphonesDone, headphonesActive)
    });

    const glassesProgress = getGlobalGlassesProgress(meta);
    const glassesActive =
        missionState === 'seat_deployment' &&
        seatDeploymentDone &&
        headphonesDone &&
        !glassesDone;
    const glassesDoneBy = getGlobalTaskDoneByName(meta, 'glasses_setup');
    const glassesDesc = glassesDone
        ? `Gafas configuradas${glassesDoneBy ? ` por ${glassesDoneBy}` : ''}.`
        : glassesActive
            ? `Checklist colaborativo en curso (${glassesProgress.done}/${glassesProgress.total} confirmados).`
            : !headphonesDone
                ? 'Se habilita al terminar configuracion de audifonos.'
                : 'Pendiente de iniciar configuracion de gafas.';

    timeline.push({
        id: 'assistant-global-glasses',
        kind: 'global',
        globalId: 'glasses_setup',
        label: 'Configuracion de gafas',
        icon: 'view_in_ar',
        desc: glassesDesc,
        status: taskStatus(glassesDone, glassesActive)
    });

    const kickoffUnlocked = glassesDone;
    const standPhotoDone = Boolean(meta.aux_operation_stand_photo_url) || missionInOperation;
    const standPhotoActive = missionState === 'seat_deployment' && kickoffUnlocked && !standPhotoDone;
    const standPhotoDesc = standPhotoDone
        ? 'Foto final del stand registrada.'
        : kickoffUnlocked
            ? 'Toma y guarda la foto final del stand.'
            : 'Se habilita al terminar la configuracion global.';

    timeline.push({
        id: 'assistant-stand-photo',
        kind: 'role',
        label: 'Foto final del stand',
        icon: 'add_a_photo',
        desc: standPhotoDesc,
        photoUrl: meta.aux_operation_stand_photo_url || null,
        photoAt: meta.aux_operation_stand_photo_at || null,
        status: taskStatus(standPhotoDone, standPhotoActive)
    });

    const auxOperationReadyDone = meta.aux_operation_ready === true || missionInOperation;
    const auxOperationReadyActive =
        missionState === 'seat_deployment' &&
        kickoffUnlocked &&
        standPhotoDone &&
        !auxOperationReadyDone;
    let auxOperationReadyDesc = auxOperationReadyDone
        ? `Auxiliar listo para iniciar${meta.aux_operation_ready_by_name ? ` (${meta.aux_operation_ready_by_name})` : ''}.`
        : kickoffUnlocked
            ? standPhotoDone
                ? 'Confirma el montaje final para iniciar operacion.'
                : 'Primero registra la foto final del stand.'
            : 'Pendiente de liberar configuracion global para iniciar operacion.';

    if (!auxOperationReadyDone && kickoffUnlocked && meta.pilot_music_ambience_done !== true) {
        auxOperationReadyDesc = 'Checklist listo. Esperando ambientacion musical del piloto.';
    }

    timeline.push({
        id: 'assistant-operation-ready',
        kind: 'role',
        label: 'Auxiliar listo para iniciar',
        icon: 'task_alt',
        desc: auxOperationReadyDesc,
        readyAt: meta.aux_operation_ready_at || null,
        status: taskStatus(auxOperationReadyDone, auxOperationReadyActive)
    });

    return timeline;
}

function buildPilotGlobalTaskFlow(missionState, meta = {}, postArrivalEnabled) {
    if (!postArrivalEnabled) return buildInactiveRoleRoadmap('pilot');

    const timeline = [];
    const spotAtMs = Date.parse(meta.pilot_spot_set_at || '');
    const prepAtMs = Date.parse(meta.pilot_prep_complete_at || '');
    const controllerAtMs = Date.parse(meta.pilot_controller_connected_at || '');
    const audioAtMs = Date.parse(meta.pilot_audio_configured_at || '');
    const checklistDoneForCurrentSpot =
        Number.isFinite(spotAtMs) &&
        Number.isFinite(prepAtMs) &&
        prepAtMs >= spotAtMs;
    const controllerConnectedForCurrentSpot =
        checklistDoneForCurrentSpot &&
        meta.pilot_controller_connected === true &&
        (!Number.isFinite(controllerAtMs) || controllerAtMs >= prepAtMs);
    const audioConfiguredForCurrentSpot =
        controllerConnectedForCurrentSpot &&
        meta.pilot_audio_configured === true &&
        (!Number.isFinite(audioAtMs) || audioAtMs >= (Number.isFinite(controllerAtMs) ? controllerAtMs : prepAtMs));
    const missionInOperation = isMissionPastPrep(missionState);
    const seatDeploymentDone = getGlobalTaskDone(meta, 'seat_deployment', missionInOperation);
    const headphonesDone = getGlobalTaskDone(meta, 'headphones_setup', missionInOperation);
    const glassesDone = getGlobalTaskDone(meta, 'glasses_setup', missionInOperation);

    const audioChecksRaw = Array.isArray(meta.pilot_audio_checks) ? meta.pilot_audio_checks : [false, false, false];
    const audioChecksDone = [Boolean(audioChecksRaw[0]), Boolean(audioChecksRaw[1]), Boolean(audioChecksRaw[2])].filter(Boolean).length;
    const audioTaskActive =
        !audioConfiguredForCurrentSpot &&
        controllerConnectedForCurrentSpot;
    const audioTaskDesc = audioConfiguredForCurrentSpot
        ? 'Audio piloto configurado y validado.'
        : audioTaskActive
            ? `Checklist de audio en curso (${audioChecksDone}/3 verificados).`
            : checklistDoneForCurrentSpot
                ? 'Pendiente conectar mando para iniciar checklist de audio.'
                : 'Se habilita al completar preparacion de vuelo.';

    timeline.push({
        id: 'pilot-audio-config',
        kind: 'role',
        label: 'Audio piloto',
        icon: 'volume_up',
        desc: audioTaskDesc,
        configuredAt: audioConfiguredForCurrentSpot ? (meta.pilot_audio_configured_at || null) : null,
        status: taskStatus(audioConfiguredForCurrentSpot, audioTaskActive)
    });

    const pilotReadyForGlobal = audioConfiguredForCurrentSpot;

    const unloadDone = getGlobalTaskDone(meta, 'team_unload', UNLOAD_AND_AFTER_STATES.includes(missionState) && missionState !== 'unload');
    const unloadActive = pilotReadyForGlobal && missionState === 'unload' && !unloadDone;
    const unloadDoneByName = getGlobalTaskDoneByName(meta, 'team_unload');
    const unloadDesc = !pilotReadyForGlobal
        ? 'Se habilita al completar audio piloto.'
        : missionState === 'unload'
            ? 'Participa en descarga de equipo y contenedores.'
            : unloadDone
                ? `Descarga global completada${unloadDoneByName ? ` por ${unloadDoneByName}` : ' con el equipo.'}`
                : 'Pendiente de iniciar descarga global.';

    timeline.push({
        id: 'pilot-global-unload',
        kind: 'global',
        globalId: 'team_unload',
        label: 'Descarga de equipo',
        icon: 'inventory_2',
        desc: unloadDesc,
        status: taskStatus(unloadDone, unloadActive)
    });

    const seatActive =
        pilotReadyForGlobal &&
        ['post_unload_coordination', 'seat_deployment'].includes(missionState) &&
        !seatDeploymentDone;
    const seatDesc = !pilotReadyForGlobal
        ? 'Se habilita al completar audio piloto.'
        : seatDeploymentDone
            ? 'Despliegue de asientos completado con el equipo.'
            : seatActive
                ? 'Participa en despliegue de asientos para liberar operacion.'
                : 'Pendiente de fase de coordinacion para iniciar despliegue.';

    timeline.push({
        id: 'pilot-global-seat',
        kind: 'global',
        globalId: 'seat_deployment',
        label: 'Despliegue de asientos',
        icon: 'event_seat',
        desc: seatDesc,
        status: taskStatus(seatDeploymentDone, seatActive)
    });

    const headphonesProgress = getGlobalHeadphonesProgress(meta);
    const headphonesActive =
        missionState === 'seat_deployment' &&
        pilotReadyForGlobal &&
        seatDeploymentDone &&
        !headphonesDone;
    const headphonesDoneBy = getGlobalTaskDoneByName(meta, 'headphones_setup');
    const headphonesDesc = headphonesDone
        ? `Audifonos configurados${headphonesDoneBy ? ` por ${headphonesDoneBy}` : ''}.`
        : headphonesActive
            ? `Checklist colaborativo en curso (${headphonesProgress.done}/${headphonesProgress.total} confirmados).`
            : !pilotReadyForGlobal
                ? 'Se habilita al completar audio piloto.'
                : !seatDeploymentDone
                    ? 'Se habilita al terminar despliegue de asientos.'
                    : 'Pendiente de iniciar configuracion de audifonos.';

    timeline.push({
        id: 'pilot-global-headphones',
        kind: 'global',
        globalId: 'headphones_setup',
        label: 'Configura audifonos',
        icon: 'headphones',
        desc: headphonesDesc,
        status: taskStatus(headphonesDone, headphonesActive)
    });

    const glassesProgress = getGlobalGlassesProgress(meta);
    const glassesActive =
        missionState === 'seat_deployment' &&
        pilotReadyForGlobal &&
        seatDeploymentDone &&
        headphonesDone &&
        !glassesDone;
    const glassesDoneBy = getGlobalTaskDoneByName(meta, 'glasses_setup');
    const glassesDesc = glassesDone
        ? `Gafas configuradas${glassesDoneBy ? ` por ${glassesDoneBy}` : ''}.`
        : glassesActive
            ? `Checklist colaborativo en curso (${glassesProgress.done}/${glassesProgress.total} confirmados).`
            : !pilotReadyForGlobal
                ? 'Se habilita al completar audio piloto.'
                : !headphonesDone
                    ? 'Se habilita al terminar configuracion de audifonos.'
                    : 'Pendiente de iniciar configuracion de gafas.';

    timeline.push({
        id: 'pilot-global-glasses',
        kind: 'global',
        globalId: 'glasses_setup',
        label: 'Configuracion de gafas',
        icon: 'view_in_ar',
        desc: glassesDesc,
        status: taskStatus(glassesDone, glassesActive)
    });

    const musicChecksRaw =
        meta && typeof meta.pilot_music_ambience_checks === 'object' && !Array.isArray(meta.pilot_music_ambience_checks)
            ? meta.pilot_music_ambience_checks
            : Object.create(null);
    const musicChecksDone = ['speaker_on', 'official_track', 'immersive_volume'].reduce((sum, key) => {
        return sum + (musicChecksRaw[key] === true ? 1 : 0);
    }, 0);
    const musicDone = meta.pilot_music_ambience_done === true || missionInOperation;
    const musicUnlocked = glassesDone;
    const musicActive =
        missionState === 'seat_deployment' &&
        musicUnlocked &&
        !musicDone;
    const musicDesc = musicDone
        ? `Ambientacion musical confirmada${meta.pilot_music_ambience_done_by_name ? ` por ${meta.pilot_music_ambience_done_by_name}` : ''}.`
        : musicUnlocked
            ? `Activa musica y confirma ambientacion (${musicChecksDone}/3 pasos).`
            : !pilotReadyForGlobal
                ? 'Se habilita al completar audio piloto.'
                : 'Se habilita al terminar configuracion global de gafas.';

    timeline.push({
        id: 'pilot-music-ambience',
        kind: 'role',
        label: 'Ambientación musical',
        icon: 'music_note',
        desc: musicDesc,
        doneAt: meta.pilot_music_ambience_done_at || null,
        status: taskStatus(musicDone, musicActive)
    });

    return timeline;
}

function getPilotFlightPhase(meta = {}) {
    const spotAtMs = Date.parse(meta?.pilot_spot_set_at || '');
    const prepAtMs = Date.parse(meta?.pilot_prep_complete_at || '');
    const controllerAtMs = Date.parse(meta?.pilot_controller_connected_at || '');
    const audioAtMs = Date.parse(meta?.pilot_audio_configured_at || '');
    const spotConfirmed = Number.isFinite(spotAtMs);
    const checklistDone =
        spotConfirmed &&
        Number.isFinite(prepAtMs) &&
        prepAtMs >= spotAtMs;
    const controllerConnected =
        checklistDone &&
        meta?.pilot_controller_connected === true &&
        (!Number.isFinite(controllerAtMs) || controllerAtMs >= prepAtMs);
    const audioConfigured =
        controllerConnected &&
        meta?.pilot_audio_configured === true &&
        (!Number.isFinite(audioAtMs) || audioAtMs >= (Number.isFinite(controllerAtMs) ? controllerAtMs : prepAtMs));

    if (checklistDone && !controllerConnected) return 'connect';
    if (controllerConnected && !audioConfigured) return 'audio';
    if (spotConfirmed) return 'prepare';
    return 'identify';
}

function cardTitleIcon(card) {
    if (card?.activeTask?.icon) return card.activeTask.icon;
    if (card?.prepProgress) return 'flight_takeoff';
    if (card?.civicProgress) return 'campaign';
    if (card?.parkingProgress) return 'local_parking';
    if (card?.role === 'pilot') return 'flight';
    if (card?.role === 'teacher') return 'school';
    if (card?.role === 'assistant') return 'support_agent';
    return 'task_alt';
}

const EVENT_HISTORY = {
    checkin: { emoji: '✅', label: 'Check-in completado' },
    prep_complete: { emoji: '🎯', label: 'Montaje completado' },
    dropzone_ready: { emoji: '🅿️', label: 'Zona de descarga confirmada' },
    departure_force: { emoji: '⚡', label: 'Salida forzada por docente' },
    ROUTE_STARTED: { emoji: '🚀', label: 'Ruta iniciada' },
    ISSUE_REPORTED: { emoji: '⚠️', label: 'Incidencia reportada' },
};
function fmtAgo(iso, nowMs) {
    if (!iso) return '';
    const diff = Math.max(0, nowMs - new Date(iso).getTime());
    if (diff < 60000) return `hace ${Math.max(1, Math.round(diff / 1000))}s`;
    if (diff < 3600000) return `hace ${Math.round(diff / 60000)}m`;
    return fmtClock(iso);
}

function stateChipText(state) {
    const map = {
        prep: 'Montaje', PILOT_PREP: 'Montaje', MISSION_BRIEF: 'Check-in', CHECKIN_DONE: 'Montaje',
        PREP_DONE: 'Montaje', AUX_PREP_DONE: 'Montaje', TEACHER_SUPPORTING_PILOT: 'Montaje',
        PILOT_READY_FOR_LOAD: 'Montaje', WAITING_AUX_VEHICLE_CHECK: 'Montaje', AUX_CONTAINERS_DONE: 'Montaje',
        ROUTE_READY: 'Listos para salir', ROUTE_IN_PROGRESS: 'En ruta', IN_ROUTE: 'En ruta',
        ARRIVAL_PHOTO_DONE: 'En operación', waiting_unload_assignment: 'En operación', waiting_dropzone: 'En operación',
        unload: 'En operación', post_unload_coordination: 'En operación', seat_deployment: 'En operación',
        OPERATION: 'En operación', PILOT_OPERATION: 'En operación',
        SHUTDOWN: 'Cierre', POST_MISSION_REPORT: 'Cierre', CLOSURE: 'Completada', report: 'Cierre', closed: 'Completada',
    };
    return map[state] || 'En curso';
}

/**
 * Derives per-role status chip from mission_state (same source operatives use).
 * Returns { emoji, text, color } or null if no chip should show.
 */
function getRoleStatusChip(role, roleSummary, missionState) {
    const allDone = roleSummary.total > 0 && roleSummary.done === roleSummary.total;
    const inProgress = roleSummary.done > 0 && roleSummary.done < roleSummary.total;
    const loadStates = ['ROUTE_READY', 'ROUTE_IN_PROGRESS', 'IN_ROUTE'];
    const isLoading = missionState === 'PILOT_READY_FOR_LOAD' || missionState === 'WAITING_AUX_VEHICLE_CHECK';
    const isPostLoad = missionState === 'AUX_CONTAINERS_DONE' || loadStates.includes(missionState);

    if (role === 'pilot') {
        if (isPostLoad) return { emoji: '🚚', text: 'Checklist completado · Cargando vehículo', color: 'text-amber-400 bg-amber-400/10' };
        if (isLoading && allDone) return { emoji: '🚚', text: 'Checklist completado · Cargando vehículo', color: 'text-amber-400 bg-amber-400/10' };
        if (allDone) return { emoji: '✅', text: 'Checklist completado · Esperando carga', color: 'text-emerald-400 bg-emerald-400/10' };
        if (inProgress) return { emoji: '🟦', text: 'Revisando equipo', color: 'text-sky-400 bg-sky-400/10' };
        return null;
    }
    if (role === 'teacher') {
        if (isPostLoad || isLoading && allDone) return { emoji: '🚚', text: 'Checklist completado · Cargando vehículo', color: 'text-amber-400 bg-amber-400/10' };
        if (allDone) return { emoji: '✅', text: 'Checklist completado · Apoyando en bodega', color: 'text-emerald-400 bg-emerald-400/10' };
        if (inProgress) return { emoji: '🟦', text: 'Checklist en progreso', color: 'text-sky-400 bg-sky-400/10' };
        return null;
    }
    if (role === 'assistant') {
        const blocks = roleSummary.blocks || 0;
        const completedBlocks = roleSummary.completedBlocks || 0;
        const hasAllBlocksDone = blocks > 0 && completedBlocks >= blocks;
        if (hasAllBlocksDone || (allDone && isPostLoad)) return { emoji: '✅', text: 'Carga verificada · Listo', color: 'text-emerald-400 bg-emerald-400/10' };
        if (isLoading && completedBlocks >= Math.max(1, blocks - 1)) return { emoji: '🟦', text: 'Carga activa · Verificando contenedores', color: 'text-sky-400 bg-sky-400/10' };
        if (completedBlocks >= 1) return { emoji: '✅', text: 'Vehículo listo · Apoyando en bodega', color: 'text-emerald-400 bg-emerald-400/10' };
        if (inProgress) return { emoji: '🟦', text: 'Checklist en progreso', color: 'text-sky-400 bg-sky-400/10' };
        return null;
    }
    return null;
}

/* ═══ TIMELINE VOICE PLAYER ═══ */
function TimelineVoicePlayer({ url, duration, onOpenViewer = null, label = 'Nota de voz' }) {
    if (!url) return null;

    const openVoice = () => {
        if (typeof onOpenViewer !== 'function') return;
        onOpenViewer(url, { label, typeHint: 'audio' });
    };

    const dur = duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '0:00';
    return (
        <button type="button" onClick={openVoice} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-800/85 hover:bg-slate-700 transition-colors text-xs">
            <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
            <span className="text-slate-200 font-semibold">Nota de voz · {dur}</span>
        </button>
    );
}

/* ═══════════════ COMPONENT ═══════════════ */
export default function SupervisorDashboard() {
    const router = useRouter();
    const supabase = useRef(createClient()).current;

    /* — state — */
    const [profile, setProfile] = useState(null);
    const [authOk, setAuthOk] = useState(false);
    const [loading, setLoading] = useState(true);
    const [schools, setSchools] = useState([]);
    const [journeys, setJourneys] = useState([]);
    const [closures, setClosures] = useState([]);
    const [prepEvents, setPrepEvents] = useState([]);
    const [staffEvents, setStaffEvents] = useState([]);
    const [prepPhotos, setPrepPhotos] = useState([]);
    const [flightLogs, setFlightLogs] = useState([]);
    const [presence, setPresence] = useState([]);
    const [staffProfiles, setStaffProfiles] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [conn, setConn] = useState('connecting');
    const [showConnBanner, setShowConnBanner] = useState(false);
    const [collapsedRoleCards, setCollapsedRoleCards] = useState({});
    const [liveChannelNonce, setLiveChannelNonce] = useState(0);
    const [dashboardTab, setDashboardTab] = useState('live');
    const [historySearch, setHistorySearch] = useState('');
    const [selectedHistoryMissionKey, setSelectedHistoryMissionKey] = useState(null);
    const [historyLogsByMission, setHistoryLogsByMission] = useState({});
    const [historyLogsLoadingMission, setHistoryLogsLoadingMission] = useState(null);
    const [historySchoolLookupMap, setHistorySchoolLookupMap] = useState({});
    const [historyFlightSnapshotLookup, setHistoryFlightSnapshotLookup] = useState({});
    const [historyNameLookupLoading, setHistoryNameLookupLoading] = useState(false);
    const [activeEvidence, setActiveEvidence] = useState(null);
    const [deleteMissionTarget, setDeleteMissionTarget] = useState(null);
    const [deleteMissionPassword, setDeleteMissionPassword] = useState('');
    const [deleteMissionError, setDeleteMissionError] = useState('');
    const [deleteMissionSubmitting, setDeleteMissionSubmitting] = useState(false);
    const hadIssue = useRef(false);
    const knownIds = useRef(new Set());
    const knownMissionIds = useRef(new Set());
    const journeysRef = useRef([]);
    const lastFlightFallbackRef = useRef(0);
    const flightRefreshInFlightRef = useRef(false);
    const journeyRefreshInFlightRef = useRef(false);
    const eventRefreshInFlightRef = useRef(false);
    const lastRealtimePulseRef = useRef(0);
    const lastWatchdogRecoveryRef = useRef(0);

    const openEvidenceViewer = useCallback((url, options = {}) => {
        const normalizedUrl = String(url || '').trim();
        if (!normalizedUrl) return;

        setActiveEvidence({
            url: normalizedUrl,
            label: String(options.label || 'Evidencia operativa').trim() || 'Evidencia operativa',
            typeHint: String(options.typeHint || '').trim().toLowerCase() || null
        });
    }, []);

    const closeEvidenceViewer = useCallback(() => {
        setActiveEvidence(null);
    }, []);

    const openDeleteMissionModal = useCallback((mission) => {
        if (!mission) return;
        setDeleteMissionTarget(mission);
        setDeleteMissionPassword('');
        setDeleteMissionError('');
    }, []);

    const closeDeleteMissionModal = useCallback(() => {
        if (deleteMissionSubmitting) return;
        setDeleteMissionTarget(null);
        setDeleteMissionPassword('');
        setDeleteMissionError('');
    }, [deleteMissionSubmitting]);

    const markRealtimePulse = useCallback(() => {
        lastRealtimePulseRef.current = Date.now();
    }, []);

    const toggleRoleCard = useCallback((cardKey) => {
        setCollapsedRoleCards((prev) => ({
            ...prev,
            [cardKey]: !prev[cardKey]
        }));
    }, []);

    /* — clock — */
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    useEffect(() => {
        journeysRef.current = journeys;
        knownIds.current = new Set(journeys.map(j => j.id));
        knownMissionIds.current = new Set(journeys.map(j => String(j.school_id)).filter(Boolean));
    }, [journeys]);

    /* — auth — */
    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const tc = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('flyhigh_test_mode') || '{}') : {};
                if (tc.active && tc.impersonatedProfile) { if (!cancel) { setProfile(tc.impersonatedProfile); setAuthOk(true); } return; }
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.push('/staff/login'); return; }
                const { data: p } = await supabase.from('staff_profiles').select('user_id, full_name, role, is_active').eq('user_id', user.id).single();
                if (!p || p.role !== 'supervisor') { router.push('/staff/login'); return; }
                if (!cancel) { setProfile(p); setAuthOk(true); }
            } catch { router.push('/staff/login'); }
        })();
        return () => { cancel = true; };
    }, [router, supabase]);

    /* — fetch — */
    const mergeFlightRows = useCallback((rowsA = [], rowsB = []) => {
        const mergedFlights = new Map();
        [...rowsA, ...rowsB].forEach((row) => {
            if (row?.id) mergedFlights.set(row.id, row);
        });
        return Array.from(mergedFlights.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const today = todayMX();
            const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
            const monthAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
            const [sR, jR, cR, pR, prR] = await Promise.all([
                supabase.from('proximas_escuelas').select('*').gte('fecha_programada', monthAgo).order('fecha_programada', { ascending: false }),
                supabase.from('staff_journeys').select('*').gte('date', weekAgo).order('updated_at', { ascending: false }),
                supabase.from('cierres_mision').select('*').order('created_at', { ascending: false }).limit(500),
                supabase.from('staff_profiles').select('user_id, full_name, role, is_active'),
                supabase.from('staff_presence').select('*'),
            ]);
            const tJ = (jR.data || []).filter(j => j.date >= today);
            const ids = tJ.map(j => j.id);
            let nP = [], nPh = [], nS = [], nF = [];
            if (ids.length) {
                const missionIds = [...new Set(tJ.map((j) => String(j.school_id || '')).filter(Boolean))];
                const [peR, phR, seR, flJourneyR, flMissionR] = await Promise.all([
                    supabase.from('staff_prep_events').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                    supabase.from('staff_prep_photos').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                    supabase.from('staff_events').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                    supabase.from('bitacora_vuelos').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                    missionIds.length > 0
                        ? supabase.from('bitacora_vuelos').select('*').in('mission_id', missionIds).order('created_at', { ascending: false })
                        : Promise.resolve({ data: [], error: null }),
                ]);

                nP = peR.data || [];
                nPh = phR.data || [];
                nS = seR.data || [];

                nF = mergeFlightRows(flJourneyR.data || [], flMissionR.data || []);
            }
            setSchools(sR.data || []); setJourneys(tJ); setClosures(cR.data || []);
            setStaffProfiles(pR.data || []); setPresence(prR.data || []);
            setPrepEvents(nP); setPrepPhotos(nPh); setStaffEvents(nS); setFlightLogs(nF);
        } catch (e) { console.error('SV fetch:', e); }
        finally { setLoading(false); }
    }, [mergeFlightRows, supabase]);

    const refreshFlightLogsOnly = useCallback(async () => {
        if (flightRefreshInFlightRef.current) return;

        const journeySnapshot = journeysRef.current;
        const ids = journeySnapshot.map((j) => j.id).filter(Boolean);
        if (ids.length === 0) return;

        const missionIds = [...new Set(journeySnapshot.map((j) => String(j.school_id || '')).filter(Boolean))];

        try {
            flightRefreshInFlightRef.current = true;

            const [flJourneyR, flMissionR] = await Promise.all([
                supabase.from('bitacora_vuelos').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                missionIds.length > 0
                    ? supabase.from('bitacora_vuelos').select('*').in('mission_id', missionIds).order('created_at', { ascending: false })
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (flJourneyR.error) {
                console.error('SV flight refresh (journey) error:', flJourneyR.error);
                return;
            }

            if (flMissionR.error) {
                console.error('SV flight refresh (mission) error:', flMissionR.error);
                return;
            }

            setFlightLogs(mergeFlightRows(flJourneyR.data || [], flMissionR.data || []));
        } catch (error) {
            console.error('SV flight refresh error:', error);
        } finally {
            flightRefreshInFlightRef.current = false;
        }
    }, [mergeFlightRows, supabase]);

    const refreshOperationalEventsOnly = useCallback(async () => {
        if (eventRefreshInFlightRef.current) return;

        const journeySnapshot = journeysRef.current;
        const ids = journeySnapshot.map((j) => j.id).filter(Boolean);
        if (ids.length === 0) return;

        try {
            eventRefreshInFlightRef.current = true;

            const [peR, phR, seR] = await Promise.all([
                supabase.from('staff_prep_events').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                supabase.from('staff_prep_photos').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
                supabase.from('staff_events').select('*').in('journey_id', ids).order('created_at', { ascending: false }),
            ]);

            if (peR.error) {
                console.error('SV event refresh (prep_events) error:', peR.error);
                return;
            }

            if (phR.error) {
                console.error('SV event refresh (prep_photos) error:', phR.error);
                return;
            }

            if (seR.error) {
                console.error('SV event refresh (staff_events) error:', seR.error);
                return;
            }

            setPrepEvents(peR.data || []);
            setPrepPhotos(phR.data || []);
            setStaffEvents(seR.data || []);
        } catch (error) {
            console.error('SV event refresh error:', error);
        } finally {
            eventRefreshInFlightRef.current = false;
        }
    }, [supabase]);

    const refreshJourneysLiveOnly = useCallback(async () => {
        if (journeyRefreshInFlightRef.current) return;

        const journeySnapshot = journeysRef.current;
        const ids = journeySnapshot.map((j) => j.id).filter(Boolean);
        if (ids.length === 0) return;

        try {
            journeyRefreshInFlightRef.current = true;

            const { data, error } = await supabase
                .from('staff_journeys')
                .select('*')
                .in('id', ids)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('SV journey refresh error:', error);
                return;
            }

            const rows = data || [];
            if (rows.length === 0) return;

            setJourneys((prev) => {
                const nextById = new Map(rows.map((row) => [row.id, row]));
                const seen = new Set();

                const merged = prev.map((row) => {
                    const next = nextById.get(row.id);
                    if (!next) return row;
                    seen.add(row.id);
                    return {
                        ...row,
                        ...next
                    };
                });

                const extras = rows.filter((row) => !seen.has(row.id));
                return extras.length > 0 ? [...merged, ...extras] : merged;
            });
        } catch (error) {
            console.error('SV journey refresh exception:', error);
        } finally {
            journeyRefreshInFlightRef.current = false;
        }
    }, [supabase]);

    const requestOperationRefresh = useCallback(() => {
        const nowMs = Date.now();
        if (nowMs - lastFlightFallbackRef.current < 900) return;
        lastFlightFallbackRef.current = nowMs;

        refreshJourneysLiveOnly();
        refreshFlightLogsOnly();
        refreshOperationalEventsOnly();
    }, [refreshFlightLogsOnly, refreshJourneysLiveOnly, refreshOperationalEventsOnly]);

    useEffect(() => { if (authOk) fetchData(); }, [authOk, fetchData]);

    useEffect(() => {
        if (!authOk) return;

        const intervalMs = conn === 'connected'
            ? (journeys.length > 0 ? 1000 : 1800)
            : 2200;
        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            requestOperationRefresh();
        };

        tick();
        const t = setInterval(tick, intervalMs);
        return () => clearInterval(t);
    }, [authOk, conn, journeys.length, requestOperationRefresh]);

    /* — real-time subscriptions — */
    useEffect(() => {
        if (!authOk) return;
        let isChannelActive = true;

        const upsert = (prev, next) => {
            if (!next?.id) return prev;
            const i = prev.findIndex(r => r.id === next.id);
            if (i === -1) return [next, ...prev];
            const c = [...prev]; c[i] = next; return c;
        };
        const rm = (prev, old) => old?.id ? prev.filter(r => r.id !== old.id) : prev;
        const known = (jid) => knownIds.current.has(jid);
        const knownMission = (missionId) => knownMissionIds.current.has(String(missionId));

        const ch = supabase.channel(`sv-live-v7-${liveChannelNonce}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_journeys' }, (p) => {
                markRealtimePulse();
                if (p.eventType === 'DELETE') {
                    setJourneys(s => rm(s, p.old));
                    requestOperationRefresh();
                    return;
                }
                if (p.new) {
                    setJourneys(s => upsert(s, p.new));
                    requestOperationRefresh();
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_prep_events' }, (p) => {
                markRealtimePulse();
                const jid = p.new?.journey_id || p.old?.journey_id;
                if (jid && !known(jid)) { fetchData(); return; }
                if (p.eventType === 'DELETE') { setPrepEvents(s => rm(s, p.old)); return; }
                if (p.new) setPrepEvents(s => upsert(s, p.new));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_prep_photos' }, (p) => {
                markRealtimePulse();
                const jid = p.new?.journey_id || p.old?.journey_id;
                if (jid && !known(jid)) { fetchData(); return; }
                if (p.eventType === 'DELETE') { setPrepPhotos(s => rm(s, p.old)); return; }
                if (p.new) setPrepPhotos(s => upsert(s, p.new));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_events' }, (p) => {
                markRealtimePulse();
                const jid = p.new?.journey_id || p.old?.journey_id;
                if (jid && !known(jid)) { fetchData(); return; }
                if (p.eventType === 'DELETE') { setStaffEvents(s => rm(s, p.old)); return; }
                if (p.new) setStaffEvents(s => upsert(s, p.new));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bitacora_vuelos' }, (p) => {
                markRealtimePulse();
                const jid = p.new?.journey_id || p.old?.journey_id;
                const missionId = p.new?.mission_id || p.old?.mission_id;
                const relevant = (jid && known(jid)) || (missionId && knownMission(missionId));

                if (!relevant) {
                    requestOperationRefresh();
                    return;
                }
                if (p.eventType === 'DELETE') { setFlightLogs(s => rm(s, p.old)); return; }
                if (p.new) setFlightLogs(s => upsert(s, p.new));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_presence' }, (p) => {
                markRealtimePulse();
                if (p.eventType === 'DELETE' && p.old?.user_id) { setPresence(s => s.filter(r => r.user_id !== p.old.user_id)); return; }
                if (p.new?.user_id) setPresence(s => [...s.filter(r => r.user_id !== p.new.user_id), p.new]);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles' }, (p) => {
                markRealtimePulse();
                if (p.eventType === 'DELETE' && p.old?.user_id) { setStaffProfiles(s => s.filter(r => r.user_id !== p.old.user_id)); return; }
                if (p.new?.user_id) setStaffProfiles(s => { const i = s.findIndex(r => r.user_id === p.new.user_id); if (i === -1) return [p.new, ...s]; const c = [...s]; c[i] = p.new; return c; });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'proximas_escuelas' }, (p) => {
                markRealtimePulse();
                if (p.eventType === 'DELETE') { setSchools(s => rm(s, p.old)); return; }
                if (p.new) setSchools(s => upsert(s, p.new));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cierres_mision' }, (p) => {
                markRealtimePulse();
                if (p.eventType === 'DELETE') { setClosures(s => rm(s, p.old)); return; }
                if (p.new) setClosures(s => upsert(s, p.new));
            })
            .subscribe((status) => {
                if (!isChannelActive) return;

                if (status === 'SUBSCRIBED') {
                    markRealtimePulse();
                    setConn('connected');
                    if (hadIssue.current) {
                        hadIssue.current = false;
                        fetchData();
                    }
                    return;
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { hadIssue.current = true; setConn('reconnecting'); return; }
                if (status === 'CLOSED') {
                    hadIssue.current = true;
                    setConn(typeof navigator !== 'undefined' && navigator.onLine ? 'reconnecting' : 'disconnected');
                }
            });

        return () => {
            isChannelActive = false;
            supabase.removeChannel(ch);
        };
    }, [authOk, fetchData, liveChannelNonce, markRealtimePulse, requestOperationRefresh, supabase]);

    /* — online/offline — */
    useEffect(() => {
        const on = () => { setConn(p => p === 'connected' ? p : 'reconnecting'); fetchData(); };
        const off = () => setConn('disconnected');
        window.addEventListener('online', on); window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, [fetchData]);

    useEffect(() => {
        if (!authOk || conn === 'connected') {
            setShowConnBanner(false);
            return;
        }

        const timerId = setTimeout(() => {
            setShowConnBanner(true);
        }, 4000);

        return () => clearTimeout(timerId);
    }, [authOk, conn]);

    /* — fallback polling — */
    useEffect(() => {
        if (!authOk || conn === 'connected') return;
        const t = setInterval(fetchData, 2000);
        return () => clearInterval(t);
    }, [authOk, conn, fetchData]);

    /* — realtime watchdog — */
    useEffect(() => {
        if (!authOk || conn !== 'connected') return;

        const STALL_MS = 45000;
        const RECOVERY_COOLDOWN_MS = 90000;

        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            if (journeysRef.current.length === 0) return;

            const nowMs = Date.now();
            const lastPulse = lastRealtimePulseRef.current || 0;
            if (!lastPulse || nowMs - lastPulse < STALL_MS) return;
            if (nowMs - lastWatchdogRecoveryRef.current < RECOVERY_COOLDOWN_MS) return;

            lastWatchdogRecoveryRef.current = nowMs;
            hadIssue.current = true;

            console.warn('SV realtime watchdog: no events detected, forcing resubscribe + refresh');

            setConn('reconnecting');
            fetchData();
            setLiveChannelNonce((prev) => prev + 1);
        };

        const timerId = setInterval(tick, 3000);
        return () => clearInterval(timerId);
    }, [authOk, conn, fetchData]);

    useEffect(() => {
        let cancelled = false;

        const loadHistoryLookups = async () => {
            if (!closures || closures.length === 0) {
                setHistorySchoolLookupMap({});
                setHistoryFlightSnapshotLookup({});
                return;
            }

            const missionIds = [...new Set(
                closures
                    .map((closure) => String(closure?.mission_id || '').trim())
                    .filter(Boolean)
            )];

            const schoolCandidates = [];
            closures.forEach((closure) => {
                const schoolIdRaw = closure?.school_id;
                if (schoolIdRaw !== null && schoolIdRaw !== undefined && schoolIdRaw !== '') {
                    const asNumber = Number(schoolIdRaw);
                    if (Number.isFinite(asNumber)) {
                        schoolCandidates.push(Math.floor(asNumber));
                    }
                }

                const missionIdRaw = String(closure?.mission_id || '').trim();
                if (/^\d+$/.test(missionIdRaw)) {
                    schoolCandidates.push(Number(missionIdRaw));
                }
            });

            const schoolIds = [...new Set(schoolCandidates)];

            setHistoryNameLookupLoading(true);
            try {
                const [schoolsRes, flightsRes] = await Promise.all([
                    schoolIds.length > 0
                        ? supabase
                            .from('proximas_escuelas')
                            .select('id, nombre_escuela')
                            .in('id', schoolIds)
                        : Promise.resolve({ data: [], error: null }),
                    missionIds.length > 0
                        ? supabase
                            .from('bitacora_vuelos')
                            .select('mission_id, mission_data, created_at')
                            .in('mission_id', missionIds)
                            .order('created_at', { ascending: true })
                        : Promise.resolve({ data: [], error: null }),
                ]);

                if (schoolsRes.error) {
                    console.warn('SV history school lookup error:', schoolsRes.error);
                }
                if (flightsRes.error) {
                    console.warn('SV history flight snapshot lookup error:', flightsRes.error);
                }

                if (cancelled) return;

                setHistorySchoolLookupMap(buildSchoolMapById(schoolsRes.data || []));
                setHistoryFlightSnapshotLookup(buildFlightSnapshotMap(flightsRes.data || []));
            } catch (error) {
                if (cancelled) return;
                console.warn('SV history lookups exception:', error);
                setHistorySchoolLookupMap({});
                setHistoryFlightSnapshotLookup({});
            } finally {
                if (!cancelled) {
                    setHistoryNameLookupLoading(false);
                }
            }
        };

        loadHistoryLookups();

        return () => {
            cancelled = true;
        };
    }, [closures, supabase]);

    /* ═══════════ COMPUTED DATA ═══════════ */
    const profileMap = useMemo(() => { const m = {}; staffProfiles.forEach(p => { m[p.user_id] = p; }); return m; }, [staffProfiles]);
    const schoolMap = useMemo(() => { const m = {}; schools.forEach(s => { m[String(s.id)] = s; }); return m; }, [schools]);
    const prepByJ = useMemo(() => groupBy(prepEvents, 'journey_id'), [prepEvents]);
    const photosByJ = useMemo(() => groupBy(prepPhotos, 'journey_id'), [prepPhotos]);
    const staffByJ = useMemo(() => groupBy(staffEvents, 'journey_id'), [staffEvents]);
    const presByJ = useMemo(() => groupBy(presence, 'journey_id'), [presence]);

    const missions = useMemo(() => {
        const today = todayMX();
        return journeys.filter(j => j.date === today).map(j => {
            const school = schoolMap[String(j.school_id)] || null;
            const jPrep = prepByJ[j.id] || [];
            const jPhotos = photosByJ[j.id] || [];
            const jStaff = staffByJ[j.id] || [];
            const jPres = presByJ[j.id] || [];
            const closureMatch = closures.find(c => c.school_id && j.school_id && String(c.school_id) === String(j.school_id));
            const isClosed = Boolean(closureMatch || ['CLOSURE', 'closed', 'report'].includes(j.mission_state) || j.status === 'closed');

            /* — check-ins — */
            const checkinByRole = {};
            const checkByItem = {};
            const missionChips = {};
            const missionChipsAt = {};
            const teamCheckByKey = {};
            const teamCheckByRT = {};
            const aux2Check = {};
            const aux2Photo = {};
            const photosByItem = {};
            const roleLastAt = {};

            const regAct = (role, at) => { if (role && at && (!roleLastAt[role] || new Date(at) > new Date(roleLastAt[role]))) roleLastAt[role] = at; };

            jPres.forEach(r => { if (ROLE_ORDER.includes(r.role)) regAct(r.role, r.last_seen_at); });
            jPhotos.forEach(ph => {
                const k = ph.item_id || '_untagged';
                (photosByItem[k] || (photosByItem[k] = [])).push(ph);
                regAct(profileMap[ph.user_id]?.role, ph.created_at);
            });
            Object.values(photosByItem).forEach(a => a.sort((x, y) => new Date(y.created_at) - new Date(x.created_at)));

            jPrep.forEach(ev => {
                const role = roleOf(ev, profileMap);
                regAct(role, ev.created_at);

                if (ev.event_type === 'checkin' && role) {
                    const prev = checkinByRole[role];
                    if (!prev || new Date(ev.created_at) > new Date(prev.created_at)) checkinByRole[role] = ev;
                }
                if (ev.event_type === 'check' && ev.payload?.item_id) {
                    const id = ev.payload.item_id, prev = checkByItem[id];
                    if (!prev || new Date(ev.created_at) > new Date(prev.at))
                        checkByItem[id] = { value: ev.payload?.value === true, at: ev.created_at };
                }
                if (ev.event_type === 'mission_chip' && ev.payload?.chip) {
                    const ch = ev.payload.chip, prev = missionChipsAt[ch];
                    if (!prev || new Date(ev.created_at) > new Date(prev)) { missionChipsAt[ch] = ev.created_at; missionChips[ch] = ev.payload?.value === true; }
                }
                if (ev.event_type === 'team_check' && ev.payload?.target_user_id && ev.payload?.check_type) {
                    const key = `${ev.payload.target_user_id}|${ev.payload.check_type}`, prev = teamCheckByKey[key];
                    if (!prev || new Date(ev.created_at) > new Date(prev.at))
                        teamCheckByKey[key] = { status: ev.payload?.status, at: ev.created_at };
                    // Resolve role from profile OR from placeholder IDs used in demo mode
                    const PLACEHOLDER_ROLES = { pilot_placeholder: 'pilot', aux_placeholder: 'assistant', teacher_placeholder: 'teacher' };
                    const tRole = profileMap[ev.payload.target_user_id]?.role || PLACEHOLDER_ROLES[ev.payload.target_user_id];
                    if (tRole && ROLE_ORDER.includes(tRole)) {
                        const rk = `${tRole}|${ev.payload.check_type}`, rp = teamCheckByRT[rk];
                        if (!rp || new Date(ev.created_at) > new Date(rp.at))
                            teamCheckByRT[rk] = { status: ev.payload?.status, at: ev.created_at };
                    }
                }
                if (ev.event_type === 'aux2_check' && ev.payload?.item_id) {
                    const id = ev.payload.item_id, prev = aux2Check[id];
                    if (!prev || new Date(ev.created_at) > new Date(prev.at))
                        aux2Check[id] = { value: ev.payload?.value === true, at: ev.created_at };
                }
                if (ev.event_type === 'aux2_photo' && ev.payload?.target_id) {
                    const id = ev.payload.target_id, prev = aux2Photo[id];
                    if (!prev || new Date(ev.created_at) > new Date(prev.at))
                        aux2Photo[id] = { done: true, at: ev.created_at, filePath: ev.payload?.file_path || null };
                }
            });
            jStaff.forEach(ev => regAct(roleOf(ev, profileMap) || profileMap[ev.actor_user_id]?.role, ev.created_at));

            /* — role people —  */
            const rolePeople = {};
            ROLE_ORDER.forEach(role => {
                const ciEv = checkinByRole[role];
                const ciUser = ciEv ? profileMap[ciEv.user_id] : null;
                const fb = staffProfiles.find(r => r.role === role && r.is_active);
                rolePeople[role] = { userId: ciUser?.user_id || fb?.user_id || null, name: ciUser?.full_name || fb?.full_name || ROLE_META[role].label };
            });

            /* — build blocks — */
            const buildBlock = (role, blockId, label, items) => {
                const done = items.filter(i => i.done).length;
                const times = items.map(i => i.at).filter(Boolean);
                const firstAt = times.length ? [...times].sort((a, b) => new Date(a) - new Date(b))[0] : null;
                const lastAt = times.length ? [...times].sort((a, b) => new Date(b) - new Date(a))[0] : null;
                return {
                    id: blockId, role, label, items, done, total: items.length,
                    completed: items.length > 0 && done === items.length,
                    inProgress: done > 0 && done < items.length,
                    firstAt, lastAt,
                    duration: items.length > 0 && done === items.length ? fmtDurationBetween(firstAt, lastAt) : null,
                    activeNow: isRecent(lastAt, now)
                };
            };
            const mapItem = (item) => {
                const chk = checkByItem[item.id] || aux2Check[item.id];
                const tablePhotos = photosByItem[item.id] || [];
                // Merge aux2_photo event evidence (from staff_prep_events) into photos
                const a2 = aux2Photo[item.id];
                const mergedEvidence = [...tablePhotos];
                if (a2?.filePath && !mergedEvidence.some(r => r.file_path === a2.filePath)) {
                    mergedEvidence.unshift({ id: `aux2-${item.id}`, file_path: a2.filePath, created_at: a2.at });
                }
                const checkedViaEvent = chk?.value === true;
                const hasPhotos = mergedEvidence.length > 0;
                const done = item.type === 'photo' ? (checkedViaEvent || hasPhotos) : checkedViaEvent;
                const at = chk?.at || a2?.at || mergedEvidence[0]?.created_at || null;
                return { id: item.id, label: item.label, done, at, reqEvidence: item.type === 'photo' && item.critical && !hasPhotos && !checkedViaEvent, evidence: mergedEvidence };
            };

            /* pilot blocks — use PILOT_PREP_BLOCKS (same source as operative) */
            const pilotBlocks = PILOT_PREP_BLOCKS.map(block => {
                const checkIds = PILOT_BLOCK_CHECK_MAP[block.id] || [];
                const blockDone = checkIds.some(cid => checkByItem[cid]?.value === true);
                const blockAt = checkIds.map(cid => checkByItem[cid]?.at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
                const items = block.items.map(it => ({
                    id: it.id, label: `${it.label} × ${it.defaultQty}`,
                    done: blockDone, at: blockAt,
                    reqEvidence: false, evidence: []
                }));
                return buildBlock('pilot', `pilot-${block.id}`, block.label, items);
            });

            /* teacher block */
            const teacherTeamItems = [];
            ROLE_ORDER.forEach(tRole => {
                const person = rolePeople[tRole];
                TEACHER_TEAM_CHECK_TYPES.forEach(ct => {
                    const exact = person.userId ? teamCheckByKey[`${person.userId}|${ct.id}`] : null;
                    const fb = teamCheckByRT[`${tRole}|${ct.id}`];
                    const st = exact || fb;
                    teacherTeamItems.push({
                        id: `team-${tRole}-${ct.id}`, label: `${ct.label} — ${person.name}`,
                        done: st?.status === 'OK' || st?.status === 'EXCEPTION', at: st?.at || null,
                        reqEvidence: false, evidence: []
                    });
                });
            });
            const missionConfirmDone = Boolean(missionChips.school && missionChips.address);
            const missionConfirmAt = [missionChipsAt.school, missionChipsAt.address].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
            const selfieEv = photosByItem.group_selfie || [];
            const teacherBlock = buildBlock('teacher', 'teacher-main', 'Montaje docente', [
                ...teacherTeamItems,
                { id: 'teacher-mission-confirm', label: 'Confirmación de misión', done: missionConfirmDone, at: missionConfirmAt, reqEvidence: false, evidence: [] },
                { id: 'group_selfie', label: LABEL_MAP.group_selfie || 'Selfie de verificación', done: selfieEv.length > 0, at: selfieEv[0]?.created_at || null, reqEvidence: true, evidence: selfieEv },
            ]);

            /* assistant blocks */
            const assistantPrepBlocks = getGroupedItems('assistant').map((group, idx) => {
                const groupItems = Array.isArray(group?.items) ? group.items : [];
                const blockName = String(group?.name || '').trim() || `Checklist auxiliar ${idx + 1}`;
                return buildBlock('assistant', `assistant-prep-${idx}-${blockName}`, blockName, groupItems.map(mapItem));
            });

            const assistantLoadBlocks = AUX_LOADS.map((group, idx) => {
                const loadItems = [
                    ...((group?.items || []).map((it) => {
                        const st = aux2Check[it.id];
                        return { id: it.id, label: it.label, done: st?.value === true, at: st?.at || null, reqEvidence: false, evidence: [] };
                    })),
                    ...((group?.photos || []).map((it) => {
                        const fromTable = photosByItem[it.id] || [];
                        const fromEvent = aux2Photo[it.id];
                        const merged = [...fromTable];
                        if (fromEvent?.filePath && !merged.some((r) => r.file_path === fromEvent.filePath)) {
                            merged.unshift({ id: `aux2-ph-${it.id}`, file_path: fromEvent.filePath, created_at: fromEvent.at, item_id: it.id });
                        }
                        return {
                            id: it.id,
                            label: it.label,
                            done: merged.length > 0 || fromEvent?.done === true,
                            at: merged[0]?.created_at || fromEvent?.at || null,
                            reqEvidence: true,
                            evidence: merged
                        };
                    })),
                ];

                const blockLabel = String(group?.label || group?.name || '').trim() || `Carga auxiliar ${idx + 1}`;
                return buildBlock('assistant', `assistant-load-${group?.id || idx}`, blockLabel, loadItems);
            });

            const roleBlocks = {
                pilot: pilotBlocks,
                teacher: [teacherBlock],
                assistant: [...assistantPrepBlocks, ...assistantLoadBlocks]
            };
            const roleSummary = ROLE_ORDER.reduce((acc, role) => {
                const blocks = roleBlocks[role] || [];
                const total = blocks.reduce((s, b) => s + b.total, 0);
                const done = blocks.reduce((s, b) => s + b.done, 0);
                const completedBlocks = blocks.filter(b => b.completed).length;
                const lastAt = blocks.map(b => b.lastAt).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
                const firstAt = blocks.map(b => b.firstAt).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null;
                acc[role] = { blocks: blocks.length, completedBlocks, total, done, activeNow: isRecent(lastAt, now), firstAt, lastAt, duration: firstAt && lastAt ? fmtDurationBetween(firstAt, lastAt) : null };
                return acc;
            }, {});

            const checkins = ROLE_ORDER.reduce((acc, role) => {
                const ci = checkinByRole[role];
                // Check-in is ONLY from explicit 'checkin' events — no fallbacks
                acc[role] = { done: Boolean(ci), at: ci?.created_at || null, name: rolePeople[role].name, userId: rolePeople[role].userId };
                return acc;
            }, {});
            const ciCount = ROLE_ORDER.filter(r => checkins[r].done).length;
            const clTotal = ROLE_ORDER.reduce((s, r) => s + roleSummary[r].total, 0);
            const clDone = ROLE_ORDER.reduce((s, r) => s + roleSummary[r].done, 0);
            const oTotal = clTotal + ROLE_ORDER.length;
            const oDone = clDone + ciCount;
            const progress = oTotal > 0 ? Math.round((oDone / oTotal) * 100) : 0;
            const firstCheckinAt = ROLE_ORDER.map(r => checkins[r].at).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null;
            const firstCheckinAtMs = toMs(firstCheckinAt) || 0;
            const elapsed = firstCheckinAt ? fmtDurationMs(Math.max(0, now - new Date(firstCheckinAt).getTime())) : '0m 0s';
            const missEvCount = ROLE_ORDER.flatMap(r => roleBlocks[r] || []).flatMap(b => b.items).filter(i => i.reqEvidence && !i.done).length;

            const meta = typeof j.meta === 'string' ? JSON.parse(j.meta || '{}') : (j.meta || {});
            const routeStartedEvent = jStaff
                .filter((ev) => ev.type === 'ROUTE_STARTED')
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0] || null;
            const routeStartedAt = j.route_started_at || routeStartedEvent?.created_at || null;
            const routeStartedAtMs = toMs(routeStartedAt) || 0;

            const journeyMissionId = String(j.school_id || '');
            const operationFlightsRaw = (flightLogs || [])
                .filter((row) => {
                    if (!row || typeof row !== 'object') return false;

                    if (row.journey_id && String(row.journey_id) === String(j.id)) {
                        return true;
                    }

                    if (!row.journey_id && journeyMissionId && String(row.mission_id || '') === journeyMissionId) {
                        const anchorTime = row.end_time || row.start_time || row.created_at;
                        if (!anchorTime) return false;
                        const anchorDate = new Date(anchorTime).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
                        return anchorDate === j.date;
                    }

                    return false;
                })
                .map((row) => normalizeOperationFlight(row))
                .filter(Boolean);

            const {
                asc: operationHistoryAsc,
                desc: operationHistory
            } = buildOperationFlightsWithNumbers(operationFlightsRaw);

            const activeAuxFlightRaw = normalizeAuxActiveFlight(meta.aux_operation_active_flight, now);
            const activeAlreadyClosed = activeAuxFlightRaw
                ? operationHistory.some((flight) => {
                    if (activeAuxFlightRaw.flightId && flight.flightId) {
                        return String(activeAuxFlightRaw.flightId) === String(flight.flightId);
                    }
                    return flight.endAtMs >= activeAuxFlightRaw.startedAtMs;
                })
                : false;
            const nextFlightNumber = operationHistoryAsc.length + 1;
            const activeAuxFlight = activeAlreadyClosed || !activeAuxFlightRaw
                ? null
                : {
                    ...activeAuxFlightRaw,
                    flightNumber: normalizePositiveInt(activeAuxFlightRaw.flightNumber) || nextFlightNumber
                };

            const lastClosedFlight = operationHistory[0] || null;
            const showInterFlightLive = !activeAuxFlight && operationHistory.length > 0 && (lastClosedFlight?.endAtMs || 0) > 0;
            const interFlightElapsedSec = showInterFlightLive
                ? Math.max(0, Math.floor((now - lastClosedFlight.endAtMs) / 1000))
                : 0;

            const operationAnchorFromMetaMs = toMs(meta.operation_started_at) || toMs(meta.aux_operation_started_at);
            const operationAnchorFromFlightsMs = operationHistoryAsc[0]?.startedAtMs || activeAuxFlight?.startedAtMs || 0;
            const operationAnchorCandidates = [operationAnchorFromMetaMs, operationAnchorFromFlightsMs]
                .filter((value) => Number.isFinite(value) && value > 0);
            const operationStartedAtMs = operationAnchorCandidates.length > 0
                ? Math.min(...operationAnchorCandidates)
                : 0;

            const operationDurationTotalSec = operationHistory.reduce((acc, flight) => acc + (flight.durationSeconds || 0), 0);
            const operationStudentsTotal = operationHistory.reduce((acc, flight) => acc + (flight.studentCount || 0), 0);
            const operationStaffTotal = operationHistory.reduce((acc, flight) => acc + (flight.staffCount || 0), 0);
            const operationIncidentsTotal = operationHistory.reduce((acc, flight) => acc + (flight.incidentsCount || 0), 0);

            // EN RUTA data
            const isEnRuta = ROUTE_STATES.includes(j.mission_state);
            const isPostRoute = POST_ARRIVAL_STATES.includes(j.mission_state);

            const teacherArrivalEvent = jStaff
                .filter(ev => ev.type === 'ARRIVAL_FACADE_PHOTO_TAKEN')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .find(ev => {
                    const actorRole = profileMap[ev.actor_user_id]?.role;
                    const payloadRole = ev.payload?.role;
                    return actorRole === 'teacher' || payloadRole === 'teacher';
                });

            const arrivalByFieldRole = profileMap[j.arrival_photo_taken_by]?.role;
            const fallbackIsTeacher = arrivalByFieldRole === 'teacher' || !j.arrival_photo_taken_by;
            const fallbackHasArrival = Boolean(j.arrival_photo_taken_at && j.arrival_photo_url && (fallbackIsTeacher || isPostRoute));

            const arrivalAnchor = {
                confirmed: Boolean(teacherArrivalEvent || fallbackHasArrival),
                at: teacherArrivalEvent?.created_at || j.arrival_photo_taken_at || null,
                photoUrl: teacherArrivalEvent?.payload?.url || j.arrival_photo_url || null
            };

            const arrivalPhotoUrl = arrivalAnchor.confirmed ? arrivalAnchor.photoUrl : null;
            const arrivalPhotoAt = arrivalAnchor.confirmed ? arrivalAnchor.at : null;
            const teacherName = rolePeople.teacher?.name || 'Docente';

            const arrivalAtMs = toMs(arrivalPhotoAt) || 0;
            const operationEndedAtMs = (() => {
                const statusKey = String(j.status || '').trim().toLowerCase();
                const missionStateKey = String(j.mission_state || '').trim().toLowerCase();
                const isOperationEnded =
                    statusKey === 'report' ||
                    statusKey === 'closed' ||
                    missionStateKey === 'dismantling' ||
                    missionStateKey === 'completed' ||
                    CLOSURE_STATES.includes(j.mission_state);

                if (!isOperationEnded) return 0;

                // Prefer dismantling_started_at from meta as the precise end-of-operation moment
                const metaDismantlingAt = toMs(meta?.dismantling_started_at);
                return metaDismantlingAt || toMs(j.updated_at) || toMs(closureMatch?.end_time) || now;
            })();

            const phaseTimers = {
                prepBase: buildPhaseTimer(firstCheckinAtMs, routeStartedAtMs, now),
                route: buildPhaseTimer(routeStartedAtMs, arrivalAtMs, now),
                prepOnsite: buildPhaseTimer(arrivalAtMs, operationStartedAtMs, now),
                operation: buildPhaseTimer(operationStartedAtMs, operationEndedAtMs, now)
            };

            const operationElapsedSec = phaseTimers.operation.seconds;
            const assistantOperation = {
                activeFlight: activeAuxFlight,
                flights: operationHistory,
                totalFlights: operationHistory.length,
                totalDurationSec: operationDurationTotalSec,
                totalStudents: operationStudentsTotal,
                totalStaff: operationStaffTotal,
                totalIncidents: operationIncidentsTotal,
                nextFlightNumber,
                showInterFlightLive,
                interFlightElapsedSec,
                operationStartedAtMs,
                operationElapsedSec
            };

            /* ══ ROLE CARDS ══ */
            const normalizedMissionState = normalizeMissionState(j.mission_state);
            const stateCards =
                STATE_ROLE_CARDS[normalizedMissionState]
                || STATE_ROLE_CARDS[normalizedMissionState.toUpperCase()]
                || STATE_ROLE_CARDS[normalizedMissionState.toLowerCase()]
                || {};
            const missionInFlightOperation = isMissionPastPrep(j.mission_state);
            const roleCards = ROLE_ORDER.map(role => {
                const card = stateCards[role] || { emoji: '⏳', title: 'Sin estado sincronizado', desc: 'Sin información de tareas para este estado.', next: null };
                const person = rolePeople[role]?.name || ROLE_META[role].label;
                const shouldForcePrepCompletion = isMissionPastPrep(j.mission_state);
                const postArrivalEnabled = arrivalAnchor.confirmed || shouldForcePrepCompletion;
                const data = {};
                // Attach evidence for roles that have showData
                if (card.showData) {
                    if (card.showData.includes('access') && meta.unload_access) data.access = meta.unload_access;
                    if (card.showData.includes('note') && meta.unload_note) data.note = meta.unload_note;
                    if (card.showData.includes('voice') && meta.unload_voice_url) { data.voiceUrl = meta.unload_voice_url; data.voiceDuration = meta.unload_voice_duration; }
                }
                // Replace name placeholders with real names
                const names = { '{name}': person, '{pilotName}': rolePeople.pilot?.name || 'El Piloto', '{teacherName}': rolePeople.teacher?.name || 'El Docente', '{auxName}': rolePeople.assistant?.name || 'El Auxiliar' };
                let rTitle = Object.entries(names).reduce((s, [k, v]) => s.replaceAll(k, v), card.title);
                let rDesc = Object.entries(names).reduce((s, [k, v]) => s.replaceAll(k, v), card.desc);
                let displayEmoji = card.emoji;
                let displayNext = card.next;
                const pilotFlightPhase = role === 'pilot' ? getPilotFlightPhase(meta) : null;

                if (role === 'pilot' && postArrivalEnabled && ONSITE_STATES.includes(j.mission_state)) {
                    if (pilotFlightPhase === 'prepare') {
                        displayEmoji = '🧭';
                        rTitle = `${person} está en preparación de vuelo`;
                        rDesc = 'Checklist de preparación de vuelo en progreso.';
                        displayNext = 'Conectar mando';
                    } else if (pilotFlightPhase === 'connect') {
                        displayEmoji = '🎮';
                        rTitle = `${person} está conectando el mando`;
                        rDesc = 'Checklist completado. Preparando paso de audio.';
                        displayNext = 'Configurar audio';
                    } else if (pilotFlightPhase === 'audio') {
                        displayEmoji = '🔊';
                        rTitle = `${person} está configurando audio`;
                        rDesc = 'Validando música y micrófono antes de operación.';
                        displayNext = 'Operación educativa';
                    }
                }

                // Pilot prep checklist progress for supervisor
                let prepProgress = null;
                const forcePilotPrepProgress = role === 'pilot' && postArrivalEnabled;
                if (card.showPrepProgress || forcePilotPrepProgress) {
                    const checksRaw = Array.isArray(meta.pilot_prep_checks) ? meta.pilot_prep_checks : [false, false, false];
                    const spotAtMs = Date.parse(meta.pilot_spot_set_at || '');
                    const prepAtMs = Date.parse(meta.pilot_prep_complete_at || '');
                    const controllerAtMs = Date.parse(meta.pilot_controller_connected_at || '');
                    const audioAtMs = Date.parse(meta.pilot_audio_configured_at || '');
                    const spotConfirmed = Number.isFinite(spotAtMs);
                    const checklistDoneForCurrentSpot =
                        spotConfirmed &&
                        Number.isFinite(prepAtMs) &&
                        prepAtMs >= spotAtMs;
                    const controllerConnectedForCurrentSpot =
                        checklistDoneForCurrentSpot &&
                        meta.pilot_controller_connected === true &&
                        (!Number.isFinite(controllerAtMs) || controllerAtMs >= prepAtMs);
                    const audioConfiguredForCurrentSpot =
                        controllerConnectedForCurrentSpot &&
                        meta.pilot_audio_configured === true &&
                        (!Number.isFinite(audioAtMs) || audioAtMs >= (Number.isFinite(controllerAtMs) ? controllerAtMs : prepAtMs));
                    const checks = spotConfirmed
                        ? [Boolean(checksRaw[0]), Boolean(checksRaw[1]), Boolean(checksRaw[2])]
                        : [false, false, false];
                    const done = checks.filter(Boolean).length;
                    const audioChecksRaw = Array.isArray(meta.pilot_audio_checks) ? meta.pilot_audio_checks : [false, false, false];
                    const audioChecks = [Boolean(audioChecksRaw[0]), Boolean(audioChecksRaw[1]), Boolean(audioChecksRaw[2])];
                    const audioDone = audioChecks.filter(Boolean).length;
                    prepProgress = {
                        done, total: 3, checks,
                        audioDone,
                        audioTotal: 3,
                        audioChecks,
                        spot: {
                            confirmed: spotConfirmed,
                            photoUrl: meta.pilot_spot_photo_url || null,
                            note: meta.pilot_spot_note || null,
                            at: meta.pilot_spot_set_at || null
                        },
                        checklistDone: checklistDoneForCurrentSpot,
                        checklistDoneAt: checklistDoneForCurrentSpot ? (meta.pilot_prep_complete_at || null) : null,
                        controllerConnected: controllerConnectedForCurrentSpot,
                        controllerConnectedAt: controllerConnectedForCurrentSpot ? (meta.pilot_controller_connected_at || null) : null,
                        audioConfigured: audioConfiguredForCurrentSpot,
                        audioConfiguredAt: audioConfiguredForCurrentSpot ? (meta.pilot_audio_configured_at || null) : null
                    };
                }
                // Teacher civic notification progress for supervisor
                let civicProgress = null;
                if (card.showCivicProgress) {
                    const notified = !!meta.teacher_civic_notified;
                    const decision = meta.teacher_civic_decision || null;
                    civicProgress = {
                        notified,
                        decision,
                        at: meta.teacher_civic_notified_at || null,
                        reason: meta.teacher_civic_reason || null,
                        reasonDetail: meta.teacher_civic_reason_detail || null,
                        audioStatus: meta.civic_parallel_teacher_audio_status || 'idle',
                        audioUploadedAt: meta.civic_parallel_teacher_audio_uploaded_at || null,
                        parallelStatus: meta.civic_parallel_status || null,
                        auxStatus: meta.civic_parallel_aux_status || null
                    };
                }
                // Assistant parking progress for supervisor
                let parkingProgress = null;
                if (card.showParkingProgress) {
                    const hasPhoto = !!meta.aux_vehicle_evidence_url;
                    const parked = !!meta.aux_ready_seat_deployment;
                    parkingProgress = {
                        hasPhoto,
                        photoUrl: meta.aux_vehicle_evidence_url || null,
                        photoAt: meta.aux_vehicle_evidence_at || null,
                        parked,
                        parkedAt: meta.aux_ready_seat_deployment_at || null
                    };
                }

                let adWallProgress = null;
                if (card.role === 'assistant' && postArrivalEnabled) {
                    const hasPhoto = !!meta.aux_ad_wall_evidence_url;
                    const installed = !!meta.aux_ad_wall_done;
                    adWallProgress = {
                        hasPhoto,
                        photoUrl: meta.aux_ad_wall_evidence_url || null,
                        photoAt: meta.aux_ad_wall_evidence_at || null,
                        installed,
                        installedAt: meta.aux_ad_wall_done_at || null
                    };
                }

                const preArrivalCopy = role === 'teacher'
                    ? {
                        title: 'En ruta a la escuela',
                        desc: 'Pendiente: confirmar llegada con foto.'
                    }
                    : {
                        title: 'En ruta a la escuela',
                        desc: 'Esperando foto de llegada del Docente.'
                    };

                const taskFlowBase = role === 'teacher'
                    ? buildTeacherTaskFlow(j.mission_state, meta, postArrivalEnabled, {
                        assistantName: rolePeople.assistant?.name || 'Auxiliar',
                        nowMs: now
                    })
                    : role === 'assistant'
                        ? buildAssistantTaskFlow(j.mission_state, meta, postArrivalEnabled, {
                            teacherName: rolePeople.teacher?.name || 'Docente',
                            nowMs: now
                        })
                        : role === 'pilot'
                            ? buildPilotGlobalTaskFlow(j.mission_state, meta, postArrivalEnabled)
                            : (!postArrivalEnabled ? buildInactiveRoleRoadmap(role) : []);

                const taskFlow = shouldForcePrepCompletion
                    ? taskFlowBase.map((task) => ({ ...task, status: 'completed' }))
                    : taskFlowBase;

                const activeTask = taskFlow.find((task) => task.status === 'active') || null;
                const activeGlobalTask = activeTask?.kind === 'global' ? activeTask : null;

                if (shouldForcePrepCompletion && prepProgress) {
                    prepProgress = {
                        ...prepProgress,
                        done: prepProgress.total,
                        checks: Array.isArray(prepProgress.checks) ? prepProgress.checks.map(() => true) : prepProgress.checks,
                        audioDone: Number.isFinite(prepProgress.audioTotal) ? prepProgress.audioTotal : prepProgress.audioDone,
                        audioChecks: Array.isArray(prepProgress.audioChecks) ? prepProgress.audioChecks.map(() => true) : prepProgress.audioChecks,
                        spot: {
                            ...(prepProgress.spot || {}),
                            confirmed: true
                        },
                        checklistDone: true,
                        controllerConnected: true,
                        audioConfigured: true
                    };
                }

                if (postArrivalEnabled && activeTask?.id === 'teacher-civic-audio') {
                    rTitle = `${person} en acto cívico`;
                    rDesc = activeTask.desc || 'Registrando evidencia de audio del acto cívico.';
                    displayEmoji = '🎙️';
                    const nextPendingTask = taskFlow.find((task) => task.status === 'pending');
                    if (nextPendingTask) displayNext = nextPendingTask.label;
                }

                if (postArrivalEnabled && activeTask?.id === 'assistant-civic-video') {
                    rTitle = `${person} graba evidencia`;
                    rDesc = activeTask.desc || 'Grabando evidencia de video del acto cívico.';
                    displayEmoji = '🎥';
                    const nextPendingTask = taskFlow.find((task) => task.status === 'pending');
                    if (nextPendingTask) displayNext = nextPendingTask.label;
                }

                if (postArrivalEnabled && activeGlobalTask) {
                    const taskLabel = activeGlobalTask.label.toLowerCase();
                    rTitle = `${person} participa en ${taskLabel}`;
                    rDesc = activeGlobalTask.desc || `Participa en ${taskLabel}.`;
                    displayEmoji = '🌐';
                    const nextPendingTask = taskFlow.find((task) => task.status === 'pending');
                    if (nextPendingTask) displayNext = nextPendingTask.label;
                }

                if (missionInFlightOperation) {
                    if (role === 'teacher') {
                        rTitle = 'Operación en curso';
                        rDesc = 'Operación en curso: Registro de vuelos.';
                        displayEmoji = '🎓';
                        displayNext = 'Bitácora de vuelos';
                    } else {
                        rTitle = 'Operación en curso';
                        rDesc = 'Operación: Pantalla en construcción.';
                        displayEmoji = '🛠️';
                        displayNext = 'Operación en sede';
                    }
                }

                return {
                    role,
                    person,
                    ...card,
                    emoji: displayEmoji,
                    title: rTitle,
                    desc: rDesc,
                    next: displayNext,
                    data: Object.keys(data).length ? data : null,
                    prepProgress,
                    civicProgress,
                    parkingProgress,
                    adWallProgress,
                    postArrivalEnabled,
                    preArrivalTitle: preArrivalCopy.title,
                    preArrivalDesc: preArrivalCopy.desc,
                    missionState: j.mission_state,
                    taskFlow,
                    activeTask,
                    updatedAt: j.updated_at || j.created_at
                };
            });

            const missionStateUpper = normalizeMissionState(j.mission_state).toUpperCase();
            const closureFlags = getDismantlingFlags(meta);
            const checkoutStatusFromMeta = getCheckoutStatusFromMeta(meta);
            const checkoutCommentsFromMeta = getCheckoutCommentsFromMeta(meta);

            const checkoutEventsByRole = {};
            jPrep.forEach((ev) => {
                if (ev.event_type !== 'checkout') return;

                const inferredRole = normalizeRoleKey(
                    roleOf(ev, profileMap)
                    || profileMap[ev.user_id]?.role
                    || ev.payload?.role
                );
                if (!ROLE_ORDER.includes(inferredRole)) return;

                const prev = checkoutEventsByRole[inferredRole];
                if (!prev || new Date(ev.created_at) > new Date(prev.created_at)) {
                    checkoutEventsByRole[inferredRole] = ev;
                }
            });

            const checkoutByRole = ROLE_ORDER.reduce((acc, role) => {
                const eventRow = checkoutEventsByRole[role] || null;
                const commentFromEvent = typeof eventRow?.payload?.checkout_comment === 'string'
                    ? eventRow.payload.checkout_comment.trim()
                    : '';
                const fallbackComment = checkoutCommentsFromMeta[role] || '';
                const doneByMeta = checkoutStatusFromMeta[role] === true;
                const doneAtFromMeta = getMetaTimestamp(meta, [
                    `closure_checkout_${role}_done_at`,
                    `checkout_${role}_done_at`
                ]);

                acc[role] = {
                    done: Boolean(eventRow) || doneByMeta,
                    at: eventRow?.created_at || doneAtFromMeta || null,
                    comment: commentFromEvent || fallbackComment || ''
                };

                return acc;
            }, {});

            const hasAnyCheckout = ROLE_ORDER.some((role) => checkoutByRole[role].done);
            const lifecycleTerminal = TERMINAL_REPORT_STATES.has(missionStateUpper) || meta.closure_checkout_done === true;
            const allCheckedOut = lifecycleTerminal || ROLE_ORDER.every((role) => checkoutByRole[role].done);

            const checkoutAtValues = ROLE_ORDER
                .map((role) => checkoutByRole[role].at)
                .filter(Boolean);
            const firstCheckoutAt = getEarliestTimestamp(checkoutAtValues);
            const allCheckoutAt = allCheckedOut
                ? (getLatestTimestamp(checkoutAtValues) || j.updated_at || j.created_at)
                : null;
            const finalCheckoutAt = allCheckedOut
                ? (getLatestTimestamp([
                    allCheckoutAt,
                    getMetaTimestamp(meta, ['closure_checkout_done_at'])
                ]) || allCheckoutAt)
                : null;
            const finalCheckoutAtMs = toMs(finalCheckoutAt) || 0;
            const liveGraceEndsAtMs = allCheckedOut && finalCheckoutAtMs > 0
                ? finalCheckoutAtMs + LIVE_COMPLETION_GRACE_MS
                : 0;
            const isInCompletionGrace = allCheckedOut && liveGraceEndsAtMs > now;
            const completionGraceRemainingMs = isInCompletionGrace
                ? Math.max(0, liveGraceEndsAtMs - now)
                : 0;

            const returnStartedRawAt = getMetaTimestamp(meta, [
                'aux_return_route_started_at',
                'closure_return_route_done_at',
                'global_equipment_loaded_at',
                'global_container_loading_done_at'
            ]);
            const returnStarted = closureFlags.auxReturnRouteStarted || Boolean(returnStartedRawAt);

            const arrivalNotifiedRawAt = getMetaTimestamp(meta, [
                'aux_arrival_notified_at',
                'arrival_notified_at',
                'closure_arrival_notification_done_at'
            ]);
            const arrivalNotified = closureFlags.auxArrivalNotified || Boolean(arrivalNotifiedRawAt);

            const closureHasStarted =
                missionStateUpper === 'DISMANTLING'
                || Boolean(meta.closure_started_at)
                || returnStarted
                || arrivalNotified
                || hasAnyCheckout
                || lifecycleTerminal;

            let lifecycleStage = 0;
            if (closureHasStarted) lifecycleStage = 4;
            if (returnStarted || arrivalNotified || hasAnyCheckout || lifecycleTerminal) lifecycleStage = 5;
            if (arrivalNotified || hasAnyCheckout || lifecycleTerminal) lifecycleStage = 6;
            if (hasAnyCheckout || lifecycleTerminal) lifecycleStage = 7;

            const phase4ForceComplete = lifecycleStage > 4 || lifecycleTerminal;
            const phase5ForceComplete = lifecycleStage > 5 || lifecycleTerminal;
            const phase6ForceComplete = lifecycleStage > 6 || lifecycleTerminal;
            const phase7ForceComplete = lifecycleTerminal;

            const stepEvidenceById = {
                [CLOSURE_STEPS.CONTAINER_LOADING]: [
                    {
                        url: meta.global_equipment_loaded_photo_containers_url || null,
                        label: 'Foto contenedores cargados',
                        typeHint: 'image'
                    },
                    {
                        url: meta.global_equipment_loaded_photo_roof_url || null,
                        label: 'Foto carga en techo',
                        typeHint: 'image'
                    }
                ].filter((item) => item.url),
                [CLOSURE_STEPS.FINAL_PARKING]: [
                    {
                        url: meta.closure_final_parking_photo_url || null,
                        label: 'Foto estacionamiento final',
                        typeHint: 'image'
                    }
                ].filter((item) => item.url)
            };

            const buildStepTask = (stepId, phaseLabel) => ({
                id: `${phaseLabel}-${stepId}`,
                stepId,
                label: getClosureTaskLabel(stepId),
                desc: phaseLabel === 'desmontaje'
                    ? 'Seguimiento en tiempo real del desmontaje y preparación de retorno.'
                    : 'Seguimiento en tiempo real del cierre en base.',
                done: getClosureStepDone(closureFlags, stepId),
                at: getClosureStepTimestamp(meta, stepId),
                global: GLOBAL_CLOSURE_TASKS.has(stepId),
                evidence: stepEvidenceById[stepId] || []
            });

            const phase4Cards = ROLE_ORDER.map((role) => {
                const stepFilter = PHASE4_ROLE_STEP_FILTERS[role] || new Set();
                const roleStepIds = SCHOOL_TEARDOWN_STEP_IDS.filter((stepId) => stepFilter.has(stepId));
                const tasks = roleStepIds.map((stepId) => buildStepTask(stepId, 'desmontaje'));

                return buildLifecycleRoleCard({
                    role,
                    person: rolePeople[role]?.name || ROLE_META[role].label,
                    blockLabel: 'Desmontaje escolar',
                    tasks,
                    forceComplete: phase4ForceComplete,
                    activePhase: lifecycleStage === 4 && !phase4ForceComplete,
                    updatedAt: j.updated_at || j.created_at
                });
            });

            const pilotSupportDone = closureFlags.pilotReturnInventoryDone && closureFlags.pilotElectronicsCharged;
            const assistantSupportDone = closureFlags.auxRecordingCharged && closureFlags.auxFinalParkingDone && closureFlags.auxKeyDropDone;

            const teacherSupportTask = {
                id: 'cierre-apoyo-bodega-teacher',
                label: 'Apoyo en bodega',
                desc: 'Coordina recepción de equipo y validaciones finales del equipo.',
                done: pilotSupportDone && assistantSupportDone,
                at: (pilotSupportDone && assistantSupportDone)
                    ? getLatestTimestamp([
                        getMetaTimestamp(meta, ['pilot_return_inventory_done_at', 'closure_return_inventory_done_at']),
                        getMetaTimestamp(meta, ['pilot_electronics_charged_at', 'closure_electronics_charging_done_at']),
                        getMetaTimestamp(meta, ['aux_recording_charging_done_at', 'closure_recording_charging_done_at']),
                        getMetaTimestamp(meta, ['aux_final_parking_done_at', 'closure_final_parking_done_at']),
                        getMetaTimestamp(meta, ['aux_key_drop_done_at', 'closure_key_drop_done_at'])
                    ])
                    : null,
                global: false,
                evidence: []
            };

            const assistantSupportTask = {
                id: 'cierre-apoyo-bodega-assistant',
                label: 'Apoyo en bodega',
                desc: 'Apoya acomodo de bodega mientras el piloto cierra inventario y estación de carga.',
                done: pilotSupportDone,
                at: pilotSupportDone
                    ? getLatestTimestamp([
                        getMetaTimestamp(meta, ['pilot_return_inventory_done_at', 'closure_return_inventory_done_at']),
                        getMetaTimestamp(meta, ['pilot_electronics_charged_at', 'closure_electronics_charging_done_at'])
                    ])
                    : null,
                global: false,
                evidence: []
            };

            const auxRecordingTask = {
                id: 'cierre-aux-recording-charging',
                label: 'Carga de Audiovisuales',
                desc: 'Conecta cámara y equipo de grabación en su estación de carga.',
                done: closureFlags.auxRecordingCharged,
                at: getMetaTimestamp(meta, ['aux_recording_charging_done_at', 'closure_recording_charging_done_at']),
                global: false,
                evidence: []
            };

            const keyDropTask = {
                id: 'cierre-key-drop',
                label: 'Resguardo de llaves',
                desc: 'Confirma entrega de llaves en sitio asignado con evidencia.',
                done: closureFlags.auxKeyDropDone,
                at: getMetaTimestamp(meta, ['aux_key_drop_done_at', 'closure_key_drop_done_at']),
                global: false,
                evidence: [
                    {
                        url: meta.aux_key_drop_photo_url || null,
                        label: 'Foto resguardo de llaves',
                        typeHint: 'image'
                    }
                ].filter((item) => item.url)
            };

            const phase6Cards = ROLE_ORDER.map((role) => {
                const stepFilter = PHASE6_ROLE_STEP_FILTERS[role] || new Set();
                const roleStepIds = BASE_CLOSURE_STEP_IDS.filter((stepId) => stepFilter.has(stepId));
                const tasks = roleStepIds.map((stepId) => buildStepTask(stepId, 'cierre'));

                if (role === 'teacher') {
                    tasks.push(teacherSupportTask);
                }

                if (role === 'assistant') {
                    tasks.push(assistantSupportTask, auxRecordingTask, keyDropTask);
                }

                return buildLifecycleRoleCard({
                    role,
                    person: rolePeople[role]?.name || ROLE_META[role].label,
                    blockLabel: 'Cierre en base',
                    tasks,
                    forceComplete: phase6ForceComplete,
                    activePhase: lifecycleStage === 6 && !phase6ForceComplete,
                    updatedAt: j.updated_at || j.created_at
                });
            });

            const teardownStepTimes = SCHOOL_TEARDOWN_STEP_IDS
                .map((stepId) => getClosureStepTimestamp(meta, stepId))
                .filter(Boolean);

            const dismantlingStartedAt = closureHasStarted
                ? (
                    getMetaTimestamp(meta, ['closure_started_at'])
                    || getEarliestTimestamp([
                        ...teardownStepTimes,
                        returnStartedRawAt,
                        arrivalNotifiedRawAt,
                        firstCheckoutAt,
                        j.updated_at,
                        j.created_at
                    ])
                )
                : null;

            const returnStartedAt = lifecycleStage >= 5
                ? (returnStartedRawAt || getEarliestTimestamp([arrivalNotifiedRawAt, firstCheckoutAt, j.updated_at]))
                : null;
            const arrivalNotifiedAt = lifecycleStage >= 6
                ? (arrivalNotifiedRawAt || getEarliestTimestamp([firstCheckoutAt, j.updated_at]))
                : null;

            const closureLifecycleTimers = {
                dismantling: buildPhaseTimer(toMs(dismantlingStartedAt) || 0, toMs(returnStartedAt) || 0, now),
                returnTransit: buildPhaseTimer(toMs(returnStartedAt) || 0, toMs(arrivalNotifiedAt) || 0, now),
                baseClosure: buildPhaseTimer(toMs(arrivalNotifiedAt) || 0, toMs(firstCheckoutAt) || 0, now),
                checkout: buildPhaseTimer(toMs(firstCheckoutAt) || 0, toMs(allCheckoutAt) || 0, now)
            };

            const closureLifecycle = {
                enabled: closureHasStarted || lifecycleTerminal,
                stage: lifecycleStage,
                phases: {
                    dismantling: {
                        forceComplete: phase4ForceComplete,
                        active: lifecycleStage === 4 && !phase4ForceComplete,
                        completed: phase4ForceComplete,
                        cards: phase4Cards,
                        timer: closureLifecycleTimers.dismantling
                    },
                    returnTransit: {
                        started: lifecycleStage >= 5,
                        forceComplete: phase5ForceComplete,
                        active: lifecycleStage === 5 && !phase5ForceComplete,
                        completed: phase5ForceComplete,
                        startedAt: returnStartedAt,
                        arrivedAt: arrivalNotifiedAt,
                        timer: closureLifecycleTimers.returnTransit
                    },
                    baseClosure: {
                        forceComplete: phase6ForceComplete,
                        active: lifecycleStage === 6 && !phase6ForceComplete,
                        completed: phase6ForceComplete,
                        cards: phase6Cards,
                        timer: closureLifecycleTimers.baseClosure
                    },
                    checkout: {
                        started: lifecycleStage >= 7,
                        forceComplete: phase7ForceComplete,
                        active: lifecycleStage === 7 && !allCheckedOut,
                        completed: allCheckedOut,
                        byRole: checkoutByRole,
                        firstAt: firstCheckoutAt,
                        endAt: allCheckoutAt,
                        timer: closureLifecycleTimers.checkout
                    }
                }
            };

            // Recent steps (from events) for "Últimos pasos" section
            const recentSteps = [];
            jPrep.forEach(ev => {
                const evMap = EVENT_HISTORY[ev.event_type];
                if (!evMap) return;
                const role = profileMap[ev.user_id]?.role;
                if (!role || !ROLE_ORDER.includes(role)) return;
                recentSteps.push({ role, emoji: evMap.emoji, label: evMap.label, at: ev.created_at, person: rolePeople[role]?.name || ROLE_META[role].label });
            });
            jStaff.forEach(ev => {
                const evMap = EVENT_HISTORY[ev.type];
                if (!evMap) return;
                const role = profileMap[ev.actor_user_id]?.role || ev.payload?.role;
                if (!role || !ROLE_ORDER.includes(role)) return;
                const extra = ev.type === 'ISSUE_REPORTED' ? ` — ${ev.payload?.description || 'sin detalle'}` : '';
                recentSteps.push({ role, emoji: evMap.emoji, label: evMap.label + extra, at: ev.created_at, person: rolePeople[role]?.name || ROLE_META[role].label });
            });
            recentSteps.sort((a, b) => new Date(b.at) - new Date(a.at));

            return {
                id: j.id, journey: j, school, isClosed,
                schoolName: school?.nombre_escuela || j.school_name || closureMatch?.school_name_snapshot || 'Escuela sin nombre',
                neighborhood: school?.colonia || '',
                stateText: stateChipText(j.mission_state),
                phaseIndex: phaseFor(j.mission_state),
                checkins, ciCount, roleBlocks, roleSummary, progress, elapsed,
                updatedAt: j.updated_at || j.created_at,
                missEvCount,
                hasAlerts: missEvCount > 0,
                isEnRuta, isPostRoute, arrivalPhotoUrl, arrivalPhotoAt, teacherName,
                phaseTimers,
                roleCards, recentSteps,
                assistantOperation,
                closureLifecycle,
                finalCheckoutAt,
                finalCheckoutAtMs,
                liveGraceEndsAtMs,
                isInCompletionGrace,
                completionGraceRemainingMs,
            };
        }).filter((m) => !m.isClosed || m.isInCompletionGrace).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }, [journeys, schoolMap, prepByJ, photosByJ, staffByJ, presByJ, closures, profileMap, staffProfiles, flightLogs, now]);

    /* — auto-select — */
    useEffect(() => {
        if (missions.length === 0) { setSelectedId(null); return; }
        if (!selectedId || !missions.some(m => m.id === selectedId)) setSelectedId(missions[0].id);
    }, [missions, selectedId]);

    const sel = useMemo(() => missions.find(m => m.id === selectedId) || null, [missions, selectedId]);

    const historySchoolMapById = useMemo(() => {
        return {
            ...buildSchoolMapById(schools),
            ...historySchoolLookupMap
        };
    }, [schools, historySchoolLookupMap]);

    const historyFlightSnapshotMap = useMemo(() => {
        return {
            ...buildFlightSnapshotMap(flightLogs),
            ...historyFlightSnapshotLookup
        };
    }, [flightLogs, historyFlightSnapshotLookup]);

    const missionHistory = useMemo(() => {
        const rows = (closures || []).map((closure, idx) => {
            const missionId = closure?.mission_id !== null && closure?.mission_id !== undefined
                ? String(closure.mission_id)
                : null;
            const key = closure?.id !== null && closure?.id !== undefined
                ? `closure-${closure.id}`
                : `mission-${missionId || 'unknown'}-${closure?.created_at || closure?.end_time || idx}`;
            const missionDateTime = missionDateTimeFromClosure(closure);
            const { date, time } = formatDateAndTime(missionDateTime);
            const resolvedSchoolName = resolveHistorySchoolName({
                closure,
                schoolMapById: historySchoolMapById,
                flightSnapshotMap: historyFlightSnapshotMap
            });
            const directSnapshotName =
                safeSchoolName(closure?.school_name_snapshot) ||
                safeSchoolName(closure?.school_name) ||
                safeSchoolName(closure?.nombre_escuela);
            const schoolName =
                resolvedSchoolName === 'Escuela no vinculada' && directSnapshotName
                    ? directSnapshotName
                    : resolvedSchoolName;

            return {
                key,
                missionId,
                journeyId: closure?.journey_id ? String(closure.journey_id) : null,
                schoolName,
                date,
                time,
                missionDateTime,
                endTime: closure?.end_time || null,
                createdAt: closure?.created_at || null,
                totalFlights: Number(closure?.total_flights || 0),
                totalStudents: Number(closure?.total_students || 0),
                checklistVerified: closure?.checklist_verified === true,
                signatureUrl: closure?.signature_url || null,
                groupPhotoUrl: closure?.group_photo_url || null,
                preloadedLogs: Array.isArray(closure?.flight_logs)
                    ? closure.flight_logs
                    : (Array.isArray(closure?.logs) ? closure.logs : []),
                raw: closure
            };
        });

        const existingMissionIds = new Set(
            rows
                .map((item) => String(item?.missionId || '').trim())
                .filter(Boolean)
        );

        (missions || []).forEach((mission) => {
            if (!mission?.closureLifecycle?.phases?.checkout?.completed) return;

            const missionId = String(mission?.journey?.school_id || '').trim();
            if (!missionId) return;

            const missionDateTime =
                mission.finalCheckoutAt
                || mission.updatedAt
                || mission?.journey?.updated_at
                || mission?.journey?.created_at
                || null;
            const { date, time } = formatDateAndTime(missionDateTime);

            const journeyMeta = (() => {
                if (!mission?.journey?.meta) return Object.create(null);
                if (typeof mission.journey.meta === 'string') {
                    try {
                        const parsed = JSON.parse(mission.journey.meta);
                        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                            ? parsed
                            : Object.create(null);
                    } catch {
                        return Object.create(null);
                    }
                }

                if (typeof mission.journey.meta === 'object' && !Array.isArray(mission.journey.meta)) {
                    return mission.journey.meta;
                }

                return Object.create(null);
            })();

            const checkinAt = getEarliestTimestamp(
                ROLE_ORDER.map((role) => mission?.checkins?.[role]?.at).filter(Boolean)
            );
            const operationStartedAt =
                Number.isFinite(mission?.assistantOperation?.operationStartedAtMs) && mission.assistantOperation.operationStartedAtMs > 0
                    ? new Date(mission.assistantOperation.operationStartedAtMs).toISOString()
                    : null;
            const dismantlingStartedAt =
                Number.isFinite(mission?.closureLifecycle?.phases?.dismantling?.timer?.startedAtMs) && mission.closureLifecycle.phases.dismantling.timer.startedAtMs > 0
                    ? new Date(mission.closureLifecycle.phases.dismantling.timer.startedAtMs).toISOString()
                    : null;
            const baseClosureStartedAt =
                Number.isFinite(mission?.closureLifecycle?.phases?.baseClosure?.timer?.startedAtMs) && mission.closureLifecycle.phases.baseClosure.timer.startedAtMs > 0
                    ? new Date(mission.closureLifecycle.phases.baseClosure.timer.startedAtMs).toISOString()
                    : null;
            const checkoutStartedAt = mission?.closureLifecycle?.phases?.checkout?.firstAt || null;
            const checkoutEndedAt = mission?.closureLifecycle?.phases?.checkout?.endAt || mission.finalCheckoutAt || null;

            const timelineSnapshot = {
                checkinAt,
                prepAt: checkinAt,
                operationAt: operationStartedAt,
                dismantlingAt: dismantlingStartedAt,
                baseClosureAt: baseClosureStartedAt,
                checkoutAt: checkoutStartedAt,
                checkoutEndAt: checkoutEndedAt
            };

            const existingIdx = rows.findIndex((row) => String(row?.missionId || '').trim() === missionId);
            if (existingIdx >= 0) {
                const existingRow = rows[existingIdx] || Object.create(null);
                const mergedPreloadedLogs = [
                    ...(Array.isArray(existingRow.preloadedLogs) ? existingRow.preloadedLogs : []),
                    ...(Array.isArray(mission?.assistantOperation?.flights) ? mission.assistantOperation.flights : [])
                ];

                rows[existingIdx] = {
                    ...existingRow,
                    journeyId: existingRow.journeyId || String(mission.id),
                    preloadedLogs: mergedPreloadedLogs,
                    checkoutByRole: mission?.closureLifecycle?.phases?.checkout?.byRole || existingRow.checkoutByRole || Object.create(null),
                    timelineSnapshot,
                    raw: {
                        ...(existingRow.raw || Object.create(null)),
                        journey_id: existingRow?.raw?.journey_id || mission.id,
                        mission_state: mission?.journey?.mission_state || existingRow?.raw?.mission_state || null,
                        meta: {
                            ...parseObject(existingRow?.raw?.meta),
                            ...journeyMeta
                        }
                    }
                };

                existingMissionIds.add(missionId);
                return;
            }

            rows.push({
                key: `journey-${mission.id}-v2`,
                missionId,
                journeyId: String(mission.id),
                schoolName: mission.schoolName || 'Escuela no vinculada',
                date,
                time,
                missionDateTime,
                endTime: missionDateTime,
                createdAt: mission?.journey?.created_at || null,
                totalFlights: Number(mission?.assistantOperation?.totalFlights || mission?.assistantOperation?.flights?.length || 0),
                totalStudents: Number(mission?.assistantOperation?.totalStudents || 0),
                checklistVerified: true,
                signatureUrl: null,
                groupPhotoUrl: null,
                preloadedLogs: Array.isArray(mission?.assistantOperation?.flights)
                    ? mission.assistantOperation.flights
                    : [],
                checkoutByRole: mission?.closureLifecycle?.phases?.checkout?.byRole || Object.create(null),
                timelineSnapshot,
                raw: {
                    source: 'journey_fallback',
                    journey_id: mission.id,
                    mission_state: mission?.journey?.mission_state || null,
                    meta: journeyMeta
                }
            });

            existingMissionIds.add(missionId);
        });

        rows.sort((a, b) => {
            const bTime = toMs(b.missionDateTime) || toMs(b.endTime) || toMs(b.createdAt) || 0;
            const aTime = toMs(a.missionDateTime) || toMs(a.endTime) || toMs(a.createdAt) || 0;
            return bTime - aTime;
        });

        return rows;
    }, [closures, historySchoolMapById, historyFlightSnapshotMap, missions]);

    const filteredMissionHistory = useMemo(() => {
        const term = String(historySearch || '').trim().toLowerCase();
        if (!term) return missionHistory;

        return missionHistory.filter((item) => {
            const school = String(item.schoolName || '').toLowerCase();
            const date = String(item.date || '').toLowerCase();
            const time = String(item.time || '').toLowerCase();
            const missionId = String(item.missionId || '').toLowerCase();
            return (
                school.includes(term) ||
                date.includes(term) ||
                time.includes(term) ||
                missionId.includes(term)
            );
        });
    }, [missionHistory, historySearch]);

    useEffect(() => {
        if (filteredMissionHistory.length === 0) {
            setSelectedHistoryMissionKey(null);
            return;
        }

        if (selectedHistoryMissionKey && !filteredMissionHistory.some((item) => item.key === selectedHistoryMissionKey)) {
            setSelectedHistoryMissionKey(null);
        }
    }, [filteredMissionHistory, selectedHistoryMissionKey]);

    const fetchHistoryMissionLogs = useCallback(async (mission) => {
        const missionKey = String(mission?.key || '').trim();
        if (!missionKey) return;
        if (historyLogsByMission[missionKey] || historyLogsLoadingMission === missionKey) return;

        setHistoryLogsLoadingMission(missionKey);
        try {
            const missionIdCandidates = [
                mission?.missionId,
                mission?.raw?.mission_id,
                mission?.raw?.missionId
            ]
                .map((value) => String(value || '').trim())
                .filter(Boolean);
            const journeyIdCandidates = [
                mission?.journeyId,
                mission?.raw?.journey_id,
                mission?.raw?.journeyId
            ]
                .map((value) => String(value || '').trim())
                .filter(Boolean);

            const missionIds = [...new Set(missionIdCandidates)];
            const journeyIds = [...new Set(journeyIdCandidates)];
            const preloadedLogs = Array.isArray(mission?.preloadedLogs) ? mission.preloadedLogs : [];

            const queries = [];
            if (missionIds.length > 0) {
                queries.push(
                    supabase
                        .from('bitacora_vuelos')
                        .select('*')
                        .in('mission_id', missionIds)
                        .order('start_time', { ascending: true })
                );
            }
            if (journeyIds.length > 0) {
                queries.push(
                    supabase
                        .from('bitacora_vuelos')
                        .select('*')
                        .in('journey_id', journeyIds)
                        .order('start_time', { ascending: true })
                );
            }

            const responses = queries.length > 0 ? await Promise.all(queries) : [];
            const logsByMission = missionIds.length > 0 ? (responses[0]?.data || []) : [];
            const missionError = missionIds.length > 0 ? responses[0]?.error : null;
            const logsByJourney = journeyIds.length > 0 ? (responses[missionIds.length > 0 ? 1 : 0]?.data || []) : [];
            const journeyError = journeyIds.length > 0 ? responses[missionIds.length > 0 ? 1 : 0]?.error : null;

            if (missionError) {
                console.warn('SV history logs mission_id query error:', missionError);
            }
            if (journeyError) {
                console.warn('SV history logs journey_id query error:', journeyError);
            }

            const mergedByKey = new Map();
            [...preloadedLogs, ...logsByMission, ...logsByJourney].forEach((row, idx) => {
                const rowId = String(row?.id || '').trim();
                const rowJourneyId = String(row?.journey_id || row?.journeyId || '').trim();
                const rowMissionId = String(row?.mission_id || row?.missionId || '').trim();
                const rowStart = row?.start_time || row?.startTime || row?.startedAt || row?.created_at || `idx-${idx}`;
                const dedupeKey = rowId || `${rowJourneyId}|${rowMissionId}|${rowStart}`;
                if (!mergedByKey.has(dedupeKey)) {
                    mergedByKey.set(dedupeKey, row);
                }
            });

            const mergedLogs = Array.from(mergedByKey.values()).sort((a, b) => {
                const aMs = toMs(a?.start_time || a?.startTime || a?.startedAt || a?.created_at) || 0;
                const bMs = toMs(b?.start_time || b?.startTime || b?.startedAt || b?.created_at) || 0;
                return aMs - bMs;
            });

            setHistoryLogsByMission((prev) => ({
                ...prev,
                [missionKey]: mergedLogs
            }));
        } catch (error) {
            console.error('SV history logs error:', error);
            setHistoryLogsByMission((prev) => ({
                ...prev,
                [missionKey]: Array.isArray(mission?.preloadedLogs) ? mission.preloadedLogs : []
            }));
        } finally {
            setHistoryLogsLoadingMission((prev) => (prev === missionKey ? null : prev));
        }
    }, [historyLogsByMission, historyLogsLoadingMission, supabase]);

    const openHistoryMissionCard = useCallback((mission) => {
        if (!mission?.key) return;

        if (selectedHistoryMissionKey === mission.key) {
            setSelectedHistoryMissionKey(null);
            return;
        }

        setSelectedHistoryMissionKey(mission.key);
        if (mission.missionId || mission.journeyId || (Array.isArray(mission.preloadedLogs) && mission.preloadedLogs.length > 0)) {
            fetchHistoryMissionLogs(mission);
        }
    }, [fetchHistoryMissionLogs, selectedHistoryMissionKey]);

    const getHistoryMissionLogs = useCallback((mission) => {
        const missionKey = String(mission?.key || '').trim();
        if (!missionKey) {
            return Array.isArray(mission?.preloadedLogs) ? mission.preloadedLogs : [];
        }
        return historyLogsByMission[missionKey] || (Array.isArray(mission?.preloadedLogs) ? mission.preloadedLogs : []);
    }, [historyLogsByMission]);

    const getHistoryMissionMetrics = useCallback((mission) => {
        const logs = getHistoryMissionLogs(mission);
        const totalStaff = logs.reduce((acc, log) => acc + Number(log?.staff_count ?? log?.staffCount ?? 0), 0);
        const totalDurationSec = logs.reduce((acc, log) => acc + Number(log?.duration_seconds ?? log?.durationSeconds ?? 0), 0);
        const totalStudentsFromLogs = logs.reduce((acc, log) => acc + Number(log?.student_count ?? log?.studentCount ?? 0), 0);
        const totalIncidents = logs.reduce((acc, log) => {
            const incidents = Array.isArray(log?.incidents) ? log.incidents : [];
            return acc + incidents.length;
        }, 0);
        const averageDurationSec = logs.length > 0 ? Math.round(totalDurationSec / logs.length) : 0;
        const sortedLogs = logs
            .map((log) => {
                const startMs = toMs(log?.start_time || log?.startTime || log?.startedAt || log?.created_at) || 0;
                const endMs = toMs(log?.end_time || log?.endTime || log?.endedAt) || 0;
                const durationSec = Number(log?.duration_seconds ?? log?.durationSeconds ?? log?.durationSec ?? 0) || 0;
                return {
                    startMs,
                    endMs: endMs > 0 ? endMs : (startMs > 0 ? startMs + (durationSec * 1000) : 0),
                };
            })
            .filter((row) => row.startMs > 0)
            .sort((a, b) => a.startMs - b.startMs);
        const interFlightGaps = [];
        for (let idx = 1; idx < sortedLogs.length; idx += 1) {
            const prevEndMs = sortedLogs[idx - 1].endMs || sortedLogs[idx - 1].startMs;
            const nextStartMs = sortedLogs[idx].startMs;
            if (nextStartMs > prevEndMs) {
                interFlightGaps.push(Math.floor((nextStartMs - prevEndMs) / 1000));
            }
        }
        const averageGapSec = interFlightGaps.length > 0
            ? Math.round(interFlightGaps.reduce((sum, gap) => sum + gap, 0) / interFlightGaps.length)
            : 0;
        const flightsFromClosure = Number(mission?.totalFlights || 0);
        const studentsFromClosure = Number(mission?.totalStudents || 0);

        return {
            totalFlights: flightsFromClosure > 0 ? flightsFromClosure : logs.length,
            totalStudents: studentsFromClosure > 0 ? studentsFromClosure : totalStudentsFromLogs,
            totalStaff,
            averageDurationSec,
            averageGapSec,
            totalIncidents,
            logs,
        };
    }, [getHistoryMissionLogs]);

    const confirmDeleteHistoryMission = useCallback(async () => {
        if (!deleteMissionTarget) return;

        const password = String(deleteMissionPassword || '').trim();
        if (!password) {
            setDeleteMissionError('Ingresa tu contrasena para confirmar.');
            return;
        }

        const journeyId = String(
            deleteMissionTarget?.journeyId ||
            deleteMissionTarget?.raw?.journey_id ||
            deleteMissionTarget?.raw?.journeyId ||
            ''
        ).trim();

        if (!journeyId) {
            setDeleteMissionError('Esta mision no tiene un journey_id vinculado para eliminar.');
            return;
        }

        setDeleteMissionSubmitting(true);
        setDeleteMissionError('');

        try {
            const { data: authData, error: authReadError } = await supabase.auth.getUser();
            if (authReadError) throw authReadError;

            const email = String(authData?.user?.email || '').trim();
            if (!email) {
                throw new Error('No fue posible validar la cuenta actual. Inicia sesion nuevamente.');
            }

            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                throw new Error('Contrasena incorrecta. Verifica e intenta nuevamente.');
            }

            const { error: deleteError } = await supabase
                .from('staff_journeys')
                .delete()
                .eq('id', journeyId);

            if (deleteError) throw deleteError;

            setJourneys((prev) => prev.filter((journey) => String(journey?.id || '') !== journeyId));
            setClosures((prev) => prev.filter((closure) => String(closure?.journey_id || '') !== journeyId));
            setHistoryLogsByMission((prev) => {
                const next = { ...prev };
                delete next[deleteMissionTarget.key];
                return next;
            });
            setSelectedHistoryMissionKey((prev) => (prev === deleteMissionTarget.key ? null : prev));

            setDeleteMissionTarget(null);
            setDeleteMissionPassword('');
            setDeleteMissionError('');

            fetchData();
        } catch (error) {
            console.error('SV delete mission error:', error);
            setDeleteMissionError(error?.message || 'No se pudo eliminar la mision.');
        } finally {
            setDeleteMissionSubmitting(false);
        }
    }, [deleteMissionPassword, deleteMissionTarget, fetchData, supabase]);

    const historyOverview = useMemo(() => {
        return missionHistory.reduce((acc, mission) => {
            acc.totalMissions += 1;
            acc.totalFlights += Number(mission.totalFlights || 0);
            acc.totalStudents += Number(mission.totalStudents || 0);
            return acc;
        }, {
            totalMissions: 0,
            totalFlights: 0,
            totalStudents: 0
        });
    }, [missionHistory]);

    const hasLiveMission = Boolean(sel);
    const effectiveTab = dashboardTab;
    const canDeleteHistoryMission = ['admin', 'supervisor'].includes(String(profile?.role || '').toLowerCase());

    /* ═══════════ RENDER ═══════════ */

    /* --- Loading --- */
    if (!authOk || loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-surface-dark border border-slate-800 shadow-xl">
                <div className="size-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-white">Cargando operaciones…</p>
                <p className="text-xs text-slate-400">Preparando panel en tiempo real</p>
            </div>
        </div>
    );

    if (effectiveTab === 'history') {
        return (
            <div className="mx-auto max-w-md min-h-screen relative flex flex-col">
                <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background-dark/95 backdrop-blur-sm border-b border-slate-800">
                    <button onClick={() => router.back()} className="flex items-center justify-center p-2 rounded-full hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-white">arrow_back_ios_new</span>
                    </button>
                    <h1 className="text-lg font-bold text-center flex-1 truncate px-2 text-white">Centro de Control</h1>
                    <div className="size-9" aria-hidden="true" />
                </header>

                <div className="px-4 py-3 border-b border-slate-800 bg-surface-darker">
                    <div className="inline-flex w-full rounded-xl border border-slate-700 bg-slate-900/60 p-1">
                        <button
                            type="button"
                            onClick={() => hasLiveMission && setDashboardTab('live')}
                            disabled={!hasLiveMission}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${effectiveTab === 'live'
                                    ? 'bg-primary text-white shadow-[0_0_12px_-4px_rgba(19,146,236,0.7)]'
                                    : hasLiveMission
                                        ? 'text-slate-300 hover:text-white'
                                        : 'text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            Misión actual
                        </button>
                        <button
                            type="button"
                            onClick={() => setDashboardTab('history')}
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${effectiveTab === 'history'
                                    ? 'bg-primary text-white shadow-[0_0_12px_-4px_rgba(19,146,236,0.7)]'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            Historial
                        </button>
                    </div>
                </div>

                <main className="flex-1 flex flex-col gap-4 p-4 pb-20">
                    <section className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-slate-800 bg-surface-dark px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Misiones</p>
                            <p className="mt-1 text-xl font-black text-white">{historyOverview.totalMissions}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-surface-dark px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vuelos</p>
                            <p className="mt-1 text-xl font-black text-primary">{historyOverview.totalFlights}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-surface-dark px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Alumnos</p>
                            <p className="mt-1 text-xl font-black text-emerald-400">{historyOverview.totalStudents}</p>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-800 bg-surface-dark px-3 py-3">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Buscar misión</label>
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-2">
                            <span className="material-symbols-outlined text-[18px] text-slate-500">search</span>
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(event) => setHistorySearch(event.target.value)}
                                placeholder="Escuela, fecha o ID"
                                className="w-full bg-transparent text-sm font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none"
                            />
                        </div>
                    </section>

                    <section className="space-y-2">
                        {historyNameLookupLoading && (
                            <div className="rounded-xl border border-slate-800 bg-surface-dark px-3 py-2 flex items-center gap-2 text-xs text-slate-400">
                                <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                Vinculando escuelas históricas...
                            </div>
                        )}

                        {filteredMissionHistory.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-700 bg-surface-dark p-5 text-center">
                                <span className="material-symbols-outlined text-3xl text-slate-600">history</span>
                                <p className="mt-2 text-sm font-bold text-slate-300">No se encontraron misiones</p>
                                <p className="text-xs text-slate-500">Prueba con otro término de búsqueda.</p>
                            </div>
                        ) : (
                            filteredMissionHistory.map((mission) => {
                                const selected = selectedHistoryMissionKey === mission.key;
                                const missionMetrics = selected ? getHistoryMissionMetrics(mission) : null;
                                const missionLogs = missionMetrics?.logs || [];
                                const loadingMissionLogs = selected && historyLogsLoadingMission === mission.key;

                                return (
                                    <article
                                        key={mission.key}
                                        className={`rounded-2xl border transition-all overflow-hidden ${selected
                                                ? 'border-primary/70 bg-primary/10 shadow-[0_0_18px_-6px_rgba(19,146,236,0.7)]'
                                                : 'border-slate-800 bg-surface-dark hover:border-slate-700'
                                            }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => openHistoryMissionCard(mission)}
                                            className="w-full text-left px-3 py-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-white truncate">{mission.schoolName}</p>
                                                    <p className="mt-0.5 text-[11px] text-slate-400">{mission.date} · {mission.time}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">ID {mission.missionId || 'N/A'}</span>
                                                    <span className={`material-symbols-outlined text-sm transition-transform ${selected ? 'text-primary rotate-180' : 'text-slate-500'}`}>expand_more</span>
                                                </div>
                                            </div>

                                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary">Vuelos: {mission.totalFlights}</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300">Alumnos: {mission.totalStudents}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission.checklistVerified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                                    {mission.checklistVerified ? 'Checklist verificado' : 'Checklist sin validar'}
                                                </span>
                                            </div>
                                        </button>

                                        {selected && (
                                            <div className="px-3 pb-3 border-t border-primary/25 bg-slate-900/35">
                                                <V2MissionDetails
                                                    mission={mission}
                                                    missionMetrics={missionMetrics}
                                                    flightLogs={missionLogs}
                                                    loadingLogs={loadingMissionLogs}
                                                    onOpenEvidence={openEvidenceViewer}
                                                />

                                                {canDeleteHistoryMission && (
                                                    <div className="pt-3">
                                                        <button
                                                            type="button"
                                                            disabled={!mission?.journeyId}
                                                            onClick={() => openDeleteMissionModal(mission)}
                                                            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wide ${mission?.journeyId ? 'border-rose-500/50 bg-rose-600/15 text-rose-200 hover:bg-rose-600/25' : 'border-slate-700 bg-slate-800/60 text-slate-500 cursor-not-allowed'}`}
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                            Eliminar Mision
                                                        </button>
                                                        {!mission?.journeyId && (
                                                            <p className="mt-1 text-[10px] text-slate-500 text-center">No hay journey vinculado para esta mision.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </section>
                </main>

                {showConnBanner && conn !== 'connected' && (
                    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg ${conn === 'disconnected' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'
                        }`}>
                        <div className={`size-2 rounded-full ${conn === 'disconnected' ? 'bg-white' : 'bg-white animate-pulse'}`} />
                        {conn === 'disconnected' ? 'Sin conexión' : 'Reconectando…'}
                    </div>
                )}

                <DeleteConfirmationModal
                    isOpen={Boolean(deleteMissionTarget)}
                    missionLabel={deleteMissionTarget ? `${deleteMissionTarget.schoolName || 'Mision'} · ID ${deleteMissionTarget.missionId || 'N/A'}` : ''}
                    password={deleteMissionPassword}
                    onPasswordChange={setDeleteMissionPassword}
                    onCancel={closeDeleteMissionModal}
                    onConfirm={confirmDeleteHistoryMission}
                    isSubmitting={deleteMissionSubmitting}
                    errorMessage={deleteMissionError}
                />

                <EvidenceViewerModal
                    isOpen={Boolean(activeEvidence)}
                    evidence={activeEvidence}
                    onClose={closeEvidenceViewer}
                />
            </div>
        );
    }

    /* --- Empty (Live Tab) --- */
    if (!sel) return (
        <div className="mx-auto max-w-md min-h-screen relative flex flex-col">
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background-dark/95 backdrop-blur-sm border-b border-slate-800">
                <button onClick={() => router.back()} className="flex items-center justify-center p-2 rounded-full hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-white">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold text-center flex-1 truncate px-2 text-white">Centro de Control</h1>
                <div className="size-9" aria-hidden="true" />
            </header>

            <div className="px-4 py-3 border-b border-slate-800 bg-surface-darker">
                <div className="inline-flex w-full rounded-xl border border-slate-700 bg-slate-900/60 p-1">
                    <button
                        type="button"
                        disabled
                        className="flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 cursor-not-allowed"
                    >
                        Misión actual
                    </button>
                    <button
                        type="button"
                        onClick={() => setDashboardTab('history')}
                        className="flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-300 hover:text-white"
                    >
                        Historial
                    </button>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4">
                <div className="flex flex-col items-center gap-3 text-center p-8 rounded-2xl bg-surface-dark border border-dashed border-slate-700">
                    <span className="material-symbols-outlined text-4xl text-slate-500">flight_takeoff</span>
                    <h2 className="text-lg font-bold text-white">Sin misiones en curso</h2>
                    <p className="text-sm text-slate-400">Puedes abrir la pestaña de historial para revisar misiones anteriores.</p>
                </div>
            </div>

            <EvidenceViewerModal
                isOpen={Boolean(activeEvidence)}
                evidence={activeEvidence}
                onClose={closeEvidenceViewer}
            />
        </div>
    );

    const strokeDash = 2 * Math.PI * 45; // ~283
    const strokeOffset = strokeDash - (strokeDash * (sel.isInCompletionGrace ? 100 : sel.progress)) / 100;
    const phaseTimers = sel.phaseTimers || {
        prepBase: { started: false, completed: false, seconds: 0 },
        route: { started: false, completed: false, seconds: 0 },
        prepOnsite: { started: false, completed: false, seconds: 0 },
        operation: { started: false, completed: false, seconds: 0 }
    };
    const assistantOperation = sel.assistantOperation || {
        activeFlight: null,
        flights: [],
        totalFlights: 0,
        totalDurationSec: 0,
        totalStudents: 0,
        totalStaff: 0,
        totalIncidents: 0,
        nextFlightNumber: 1,
        showInterFlightLive: false,
        interFlightElapsedSec: 0,
        operationStartedAtMs: 0,
        operationElapsedSec: 0
    };
    const assistantActiveFlight = assistantOperation.activeFlight || null;
    const assistantFlights = assistantOperation.flights || [];
    const operationRecorderRole = 'teacher';
    const operationRoleCard = (sel.roleCards || []).find((card) => card.role === operationRecorderRole) || null;
    const operationDisplayName = operationRoleCard?.person || 'Docente';
    const operationSectionEnabled = sel.phaseIndex >= 2 || Boolean(assistantActiveFlight) || assistantFlights.length > 0;
    const completionGraceVisible = sel.isInCompletionGrace === true;
    const completionGraceRemainingMinutes = completionGraceVisible
        ? Math.max(1, Math.ceil((sel.completionGraceRemainingMs || 0) / 60000))
        : 0;
    const completionGraceTimeLabel = sel.finalCheckoutAt ? fmtClock(sel.finalCheckoutAt) : '--:--';
    const liveProgressPct = completionGraceVisible ? 100 : sel.progress;
    const liveStateText = completionGraceVisible ? 'Cierre completado' : sel.stateText;
    const assistantInterFlightByNewerId = buildInterFlightItemsByNewerFlightId(assistantFlights);
    const assistantTimelineRows = [];

    const latestClosedAssistantFlight = assistantFlights[0] || null;
    if (assistantActiveFlight && latestClosedAssistantFlight) {
        const intervalStartMs = latestClosedAssistantFlight.endAtMs || 0;
        const intervalEndMs = assistantActiveFlight.startedAtMs || 0;

        if (intervalStartMs > 0 && intervalEndMs > intervalStartMs) {
            assistantTimelineRows.push({
                itemType: 'interflight',
                key: `interflight-live-${latestClosedAssistantFlight.id}-${assistantActiveFlight.flightId || intervalEndMs}`,
                interFlight: {
                    id: `interflight-live-${latestClosedAssistantFlight.id}-${assistantActiveFlight.flightId || intervalEndMs}`,
                    durationSeconds: Math.max(0, Math.floor((intervalEndMs - intervalStartMs) / 1000)),
                    fromFlightNumber: latestClosedAssistantFlight.flightNumber,
                    toFlightNumber: assistantActiveFlight.flightNumber || (latestClosedAssistantFlight.flightNumber + 1)
                }
            });
        }
    }

    assistantFlights.slice(0, 8).forEach((flight, idx) => {
        assistantTimelineRows.push({
            itemType: 'flight',
            key: `flight-${flight.id}-${idx}`,
            flight,
            fallbackFlightNumber: Math.max(1, assistantFlights.length - idx)
        });

        const interFlight = assistantInterFlightByNewerId.get(flight.id);
        if (interFlight) {
            assistantTimelineRows.push({
                itemType: 'interflight',
                key: interFlight.id,
                interFlight
            });
        }
    });

    const closureLifecycle = sel.closureLifecycle || {
        enabled: false,
        stage: 0,
        phases: {
            dismantling: { cards: [], forceComplete: false, active: false, completed: false, timer: { started: false, seconds: 0 } },
            returnTransit: { started: false, forceComplete: false, active: false, completed: false, startedAt: null, arrivedAt: null, timer: { started: false, seconds: 0 } },
            baseClosure: { cards: [], forceComplete: false, active: false, completed: false, timer: { started: false, seconds: 0 } },
            checkout: { started: false, forceComplete: false, active: false, completed: false, byRole: {}, firstAt: null, endAt: null, timer: { started: false, seconds: 0 } }
        }
    };

    const closurePhases = closureLifecycle.phases || {};
    const closurePhase4 = closurePhases.dismantling || { cards: [], forceComplete: false, active: false, completed: false, timer: { started: false, seconds: 0 } };
    const closurePhase5 = closurePhases.returnTransit || { started: false, forceComplete: false, active: false, completed: false, startedAt: null, arrivedAt: null, timer: { started: false, seconds: 0 } };
    const closurePhase6 = closurePhases.baseClosure || { cards: [], forceComplete: false, active: false, completed: false, timer: { started: false, seconds: 0 } };
    const closurePhase7 = closurePhases.checkout || { started: false, forceComplete: false, active: false, completed: false, byRole: {}, firstAt: null, endAt: null, timer: { started: false, seconds: 0 } };

    const phase4Enabled = closureLifecycle.enabled || closureLifecycle.stage >= 4 || closurePhase4.timer.started;
    const phase5Enabled = closureLifecycle.stage >= 5 || closurePhase5.started || closurePhase5.timer.started;
    const phase6Enabled = closureLifecycle.stage >= 6 || closurePhase6.timer.started;
    const phase7Enabled = closureLifecycle.stage >= 7 || closurePhase7.started || closurePhase7.timer.started || closurePhase7.completed;

    const checkoutPhaseByRole =
        closurePhase7.byRole && typeof closurePhase7.byRole === 'object' && !Array.isArray(closurePhase7.byRole)
            ? closurePhase7.byRole
            : Object.create(null);

    const checkoutRoleEntriesRaw = Object.entries(checkoutPhaseByRole);
    const checkoutRoleEntries = (checkoutRoleEntriesRaw.length > 0
        ? checkoutRoleEntriesRaw
        : ROLE_ORDER.map((role) => [role, Object.create(null)]))
        .sort((a, b) => {
            const idxA = ROLE_ORDER.indexOf(a[0]);
            const idxB = ROLE_ORDER.indexOf(b[0]);
            if (idxA === -1 && idxB === -1) return String(a[0]).localeCompare(String(b[0]));
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });

    const checkoutDoneCount = checkoutRoleEntries.filter(([, row]) => closurePhase7.forceComplete || row?.done === true).length;
    const checkoutTotalCount = checkoutRoleEntries.length;

    const closureRoleNameByRole = ROLE_ORDER.reduce((acc, role) => {
        const fromCheckin = safeSchoolName(sel?.checkins?.[role]?.name);
        const fromDismantling = safeSchoolName((closurePhase4.cards || []).find((card) => card.role === role)?.person);
        const fromBaseClosure = safeSchoolName((closurePhase6.cards || []).find((card) => card.role === role)?.person);
        acc[role] = fromCheckin || fromDismantling || fromBaseClosure || ROLE_META[role]?.label || role;
        return acc;
    }, {});

    const renderLifecycleRoleCards = (cards = [], sectionKey = 'closure') => (
        <div className="flex flex-col gap-3">
            {cards.map((card) => {
                const roleMeta = ROLE_META[card.role] || { label: card.role, icon: 'task_alt' };
                const statusTone = card.forceComplete || card.completed
                    ? 'text-emerald-300'
                    : card.activeTask
                        ? 'text-sky-300'
                        : 'text-slate-300';
                const cardTone = card.forceComplete || card.completed
                    ? 'border-emerald-500/35 shadow-[0_0_14px_-4px_rgba(16,185,129,0.35)]'
                    : card.activeTask
                        ? 'border-primary/50 shadow-[0_0_15px_-3px_rgba(19,146,236,0.15)] ring-1 ring-primary/20'
                        : 'border-slate-800';

                return (
                    <div key={`${sectionKey}-${card.role}`} className={`bg-surface-dark rounded-xl overflow-hidden border shadow-sm relative ${cardTone}`}>
                        <div className="px-4 py-3 border-b border-slate-800 bg-surface-darker/45">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`material-symbols-outlined text-sm ${card.forceComplete || card.completed ? 'text-emerald-500' : card.activeTask ? 'text-primary animate-pulse' : 'text-slate-400'}`}>
                                        {roleMeta.icon}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">{roleMeta.label}</h3>
                                        <p className="text-xs text-slate-400 truncate">{card.person}</p>
                                    </div>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${card.forceComplete || card.completed ? 'text-emerald-400 bg-emerald-500/10' : 'text-primary bg-primary/10'}`}>
                                    {card.doneCount}/{card.totalCount}
                                </span>
                            </div>
                            <p className={`mt-2 text-[11px] font-semibold leading-snug ${statusTone}`}>
                                {card.statusText}
                            </p>
                        </div>

                        <div className="px-4 py-3">
                            <div className="flex items-center gap-2 px-1">
                                <div className="flex-1 h-px bg-slate-700/60" />
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{card.blockLabel}</span>
                                <div className="flex-1 h-px bg-slate-700/60" />
                            </div>

                            <div className="mt-2 space-y-2">
                                {card.tasks.map((task, idx) => {
                                    const done = task.status === 'completed';
                                    const isNow = task.status === 'active';
                                    const rowTone = done
                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                        : isNow
                                            ? 'bg-sky-500/10 border border-sky-500/30'
                                            : 'bg-slate-800/40 border border-slate-700/30';
                                    const dotTone = done
                                        ? 'bg-emerald-500'
                                        : isNow
                                            ? 'bg-sky-500 animate-pulse'
                                            : 'bg-slate-700';
                                    return (
                                        <div key={task.id} className={`rounded-xl px-3 py-2.5 ${rowTone}`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${dotTone}`}>
                                                    {done ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[13px] font-bold leading-tight ${done ? 'text-emerald-400 line-through opacity-70' : isNow ? 'text-white' : 'text-slate-300'}`}>
                                                            {task.label}
                                                        </span>
                                                        {task.global && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-200">Global</span>
                                                        )}
                                                        {isNow && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-300">Ahora</span>
                                                        )}
                                                    </div>
                                                    {task.desc && <p className={`text-[11px] leading-snug mt-0.5 ${done ? 'text-emerald-400/55' : 'text-slate-500'}`}>{task.desc}</p>}
                                                    {task.at && <p className="text-[10px] text-slate-500 mt-0.5">{fmtClock(task.at)}</p>}

                                                    {Array.isArray(task.evidence) && task.evidence.length > 0 && (
                                                        <div className="mt-1.5 flex flex-wrap gap-2">
                                                            {task.evidence.map((ev, evIdx) => (
                                                                <button
                                                                    key={`${task.id}-evidence-${evIdx}`}
                                                                    type="button"
                                                                    onClick={() => openEvidenceViewer(ev.url, { label: ev.label || task.label, typeHint: ev.typeHint || 'image' })}
                                                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-700 bg-slate-800/85 hover:bg-slate-700 transition-colors text-[10px] font-semibold text-slate-200"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                                                                    {ev.label || 'Evidencia'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center justify-between text-[11px] font-semibold">
                                    <span className="text-slate-400">Progreso</span>
                                    <span className={card.progressPct >= 100 ? 'text-emerald-300' : 'text-slate-200'}>
                                        {card.doneCount}/{card.totalCount}
                                    </span>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${card.progressPct >= 100 ? 'bg-emerald-400' : 'bg-primary'}`}
                                        style={{ width: `${card.progressPct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="mx-auto max-w-md min-h-screen relative flex flex-col">

            {/* Timeline animation */}
            <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* ═══ HEADER ═══ */}
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background-dark/95 backdrop-blur-sm border-b border-slate-800">
                <button onClick={() => router.back()} className="flex items-center justify-center p-2 rounded-full hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-white">arrow_back_ios_new</span>
                </button>
                <h1 className="text-lg font-bold text-center flex-1 truncate px-2 text-white">{sel.schoolName}</h1>
                <button className="flex items-center justify-center p-2 rounded-full hover:bg-slate-800 transition-colors">
                    <span className="material-symbols-outlined text-white">more_vert</span>
                </button>
            </header>

            {/* ═══ MISSION SELECTOR (if multiple) ═══ */}
            {missions.length > 1 && (
                <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-slate-800 bg-surface-darker">
                    {missions.map(m => (
                        <button key={m.id} onClick={() => setSelectedId(m.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${m.id === selectedId ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                            {m.schoolName} — {m.progress}%
                        </button>
                    ))}
                </div>
            )}

            <div className="px-4 py-3 border-b border-slate-800 bg-surface-darker">
                <div className="inline-flex w-full rounded-xl border border-slate-700 bg-slate-900/60 p-1">
                    <button
                        type="button"
                        onClick={() => setDashboardTab('live')}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${effectiveTab === 'live'
                                ? 'bg-primary text-white shadow-[0_0_12px_-4px_rgba(19,146,236,0.7)]'
                                : 'text-slate-300 hover:text-white'
                            }`}
                    >
                        Misión actual
                    </button>
                    <button
                        type="button"
                        onClick={() => setDashboardTab('history')}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${effectiveTab === 'history'
                                ? 'bg-primary text-white shadow-[0_0_12px_-4px_rgba(19,146,236,0.7)]'
                                : 'text-slate-300 hover:text-white'
                            }`}
                    >
                        Historial
                    </button>
                </div>
            </div>

            <main className="flex-1 flex flex-col gap-6 p-4 pb-20">

                {completionGraceVisible && (
                    <section className="rounded-2xl border border-emerald-500/50 bg-emerald-900/40 text-emerald-50 p-4 mb-1 shadow-lg shadow-emerald-950/35">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-2xl text-emerald-300">verified</span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-black leading-tight">✅ Jornada terminada a las {completionGraceTimeLabel}.</p>
                                <p className="mt-1 text-xs leading-relaxed text-emerald-100/90">
                                    El informe 360° ya está seguro en el Historial. Esta vista en vivo se limpiará automáticamente en {completionGraceRemainingMinutes} minutos.
                                </p>
                            </div>
                            <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 tabular-nums">
                                {completionGraceRemainingMinutes} min
                            </span>
                        </div>
                    </section>
                )}

                {/* ═══ PROGRESS CIRCLE ═══ */}
                <section className="flex flex-col items-center justify-center py-4">
                    <div className="relative size-40 flex items-center justify-center mb-4">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#15202b" strokeWidth="8" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#1392ec" strokeWidth="8"
                                strokeDasharray={strokeDash} strokeDashoffset={strokeOffset}
                                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-extrabold text-white">{liveProgressPct}%</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                            <div className="size-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-primary text-sm font-bold uppercase tracking-wide">{liveStateText}</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium mt-2">{sel.elapsed} transcurrido</p>
                    </div>
                </section>

                {/* ═══ PHASE STEPPER ═══ */}
                <section className="px-2">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 z-0 mx-4" />
                        {PHASES.map((phase, idx) => {
                            const completed = idx < sel.phaseIndex;
                            const active = idx === sel.phaseIndex;
                            return (
                                <div key={phase.id} className="relative z-10 flex flex-col items-center gap-1">
                                    <div className={`size-6 rounded-full flex items-center justify-center text-white ring-4 ring-background-dark ${completed ? 'bg-emerald-500' : active ? 'bg-primary shadow-[0_0_10px_rgba(19,146,236,0.5)]' : 'bg-slate-700 text-slate-400'}`}>
                                        {completed
                                            ? <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                            : <span className="text-[10px] font-bold">{idx + 1}</span>}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-tight ${completed ? 'text-emerald-500' : active ? 'text-primary' : 'text-slate-600'}`}>
                                        {phase.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ═══ CHECK-IN ═══ */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white">Check-in: {sel.ciCount}/3 Completados</h2>
                    </div>
                    <div className={`grid grid-cols-1 gap-3 transition-opacity ${sel.ciCount === 3 ? 'opacity-60 hover:opacity-100' : ''}`}>
                        {ROLE_ORDER.map(role => {
                            const ci = sel.checkins[role];
                            const borderColor = ci.done ? 'border-l-emerald-500' : 'border-l-slate-600';
                            const avatarBorder = ci.done ? 'border-emerald-500' : 'border-slate-600';
                            return (
                                <div key={role} className={`flex items-center gap-3 p-3 rounded-xl bg-surface-dark border border-slate-800 shadow-sm border-l-4 ${borderColor}`}>
                                    <div className="relative shrink-0">
                                        <div className={`size-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold border-2 ${avatarBorder}`}>
                                            {initials(ci.name)}
                                        </div>
                                        {ci.done && (
                                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-surface-dark">
                                                <span className="material-symbols-outlined text-white text-[10px] font-bold block">check</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-white truncate">{ci.name} ({ROLE_META[role].label})</p>
                                            {ci.done && <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">{fmtClock(ci.at)}</span>}
                                        </div>
                                        <p className="text-xs font-medium text-slate-400">{ci.done ? 'Check-in verificado' : 'Pendiente de check-in'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ═══ CHECKLISTS POR ROL ═══ */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Montaje
                            {phaseTimers.prepBase.started && (
                                <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(phaseTimers.prepBase.seconds)})</span>
                            )}
                        </h2>
                    </div>
                    <div className={`flex flex-col gap-3 transition-opacity ${sel.isEnRuta || sel.isPostRoute ? 'opacity-60 hover:opacity-100' : ''}`}>
                        {ROLE_ORDER.map(role => {
                            const meta = ROLE_META[role];
                            const summary = sel.roleSummary[role];
                            const blocks = sel.roleBlocks[role] || [];
                            const isActive = summary.activeNow;
                            const noProgress = summary.done === 0;
                            const allDone = summary.done === summary.total && summary.total > 0;
                            const missEv = blocks.flatMap(b => b.items).filter(i => i.reqEvidence && !i.done).length;

                            return (
                                <div key={role} className={`bg-surface-dark rounded-xl overflow-hidden border shadow-sm relative
                                    ${isActive ? 'border-primary/50 shadow-[0_0_15px_-3px_rgba(19,146,236,0.15)] ring-1 ring-primary/20' : 'border-slate-800'}
                                    ${noProgress ? 'opacity-95' : allDone && !isActive && !(sel.isEnRuta || sel.isPostRoute) ? 'opacity-90' : ''}`}>

                                    {/* glow line for active */}
                                    {isActive && <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />}

                                    {/* role header */}
                                    <div className="px-4 py-3 border-b flex justify-between items-center relative overflow-hidden bg-surface-dark border-slate-800/80">
                                        <div className="flex items-center gap-2 relative z-10">
                                            <span className={`material-symbols-outlined text-sm ${isActive ? 'text-primary animate-pulse' : allDone ? 'text-emerald-500' : 'text-slate-400'}`}>{meta.icon}</span>
                                            <h3 className={`text-sm font-extrabold uppercase tracking-wide ${noProgress ? 'text-slate-400' : 'text-white'}`}>{meta.label}</h3>
                                            {isActive && <span className="ml-2 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">Activo</span>}
                                            {(() => { const chip = getRoleStatusChip(role, summary, sel.journey.mission_state); return chip ? <span className={`ml-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${chip.color} backdrop-blur-sm`}>{chip.emoji} {chip.text}</span> : null; })()}
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded relative z-10
                                            ${allDone ? 'text-emerald-500 bg-emerald-500/10' : isActive ? 'text-primary bg-primary/10' : 'text-slate-400 bg-slate-700/50'}`}>
                                            {summary.completedBlocks}/{summary.blocks} Bloques
                                        </span>
                                    </div>


                                    {/* blocks */}
                                    {blocks.map((block, bi) => {
                                        const isLast = bi === blocks.length - 1;
                                        return (
                                            <div key={block.id} className={!isLast ? 'border-b border-slate-800' : ''}>
                                                <details open={noProgress || block.inProgress || block.activeNow || undefined} className="group">
                                                    <summary className={`flex items-center justify-between p-4 cursor-pointer list-none transition-colors
                                                        ${block.inProgress || block.activeNow ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-white/5'}`}>
                                                        <div className="flex items-center gap-3">
                                                            {block.completed ? (
                                                                <div className="size-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                                                                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                                                </div>
                                                            ) : block.inProgress || block.activeNow ? (
                                                                <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                                                            ) : (
                                                                <div className="size-5 rounded-full border-2 border-slate-600 shrink-0" />
                                                            )}
                                                            <div className="flex flex-col">
                                                                <span className={`text-sm font-bold ${block.completed ? 'text-slate-200' : 'text-white'}`}>{block.label}</span>
                                                                {block.duration && (
                                                                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                                                                        <span className="material-symbols-outlined text-[12px]">timer</span>
                                                                        <span>Tiempo: {block.duration}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-medium ${block.completed ? 'text-emerald-500' : block.inProgress ? 'text-primary' : 'text-slate-400'}`}>
                                                                {block.done}/{block.total}
                                                            </span>
                                                            <span className={`material-symbols-outlined transition group-open:rotate-180 ${block.inProgress ? 'text-primary' : 'text-slate-400'}`}>expand_more</span>
                                                        </div>
                                                    </summary>
                                                    <div className={`px-4 pb-4 pl-12 space-y-2 pt-2 ${block.inProgress || block.activeNow ? 'bg-primary/5' : ''}`}>
                                                        {block.items.map(item => (
                                                            <div key={item.id}>
                                                                <div className="flex items-center gap-2 text-xs text-slate-300">
                                                                    <span className={`material-symbols-outlined text-sm ${item.done ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                        {item.done ? 'check_box' : 'check_box_outline_blank'}
                                                                    </span>
                                                                    <span className={item.done ? 'text-slate-400' : ''}>{item.label}</span>
                                                                    {item.at && <span className="ml-auto text-[10px] text-slate-500">{fmtClock(item.at)}</span>}
                                                                </div>
                                                                {item.evidence?.length > 0 && (
                                                                    <div className="mt-2 ml-6 flex gap-2 flex-wrap">
                                                                        {item.evidence.slice(0, 3).map(ev => (
                                                                            <button
                                                                                key={ev.id || ev.file_path}
                                                                                type="button"
                                                                                onClick={() => openEvidenceViewer(ev.file_path, { label: `Evidencia: ${item.label}` })}
                                                                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700"
                                                                            >
                                                                                <img src={ev.file_path} alt={`Evidencia ${item.label}`}
                                                                                    className="w-full h-full object-cover"
                                                                                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                                                                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5">
                                                                                    {fmtClock(ev.created_at)}
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {item.reqEvidence && !item.done && (
                                                                    <p className="mt-1 ml-6 text-[10px] text-slate-500 italic">Esperando evidencia...</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            </div>
                                        );
                                    })}

                                    {/* role total time */}
                                    {summary.duration && (
                                        <div className="bg-surface-darker/60 p-3 border-t border-slate-800 flex justify-center items-center">
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700">
                                                <span className="material-symbols-outlined text-slate-400 text-sm">history_toggle_off</span>
                                                <span className="text-xs font-bold text-slate-300">Tiempo Total: {summary.duration}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ═══ EN RUTA SECTION ═══ */}
                <section className={sel.isPostRoute ? 'opacity-60 hover:opacity-100 transition-opacity' : sel.isEnRuta ? '' : 'opacity-30 grayscale pointer-events-none'}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-xl">local_shipping</span>
                            Traslado a sede
                            {phaseTimers.route.started && (
                                <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(phaseTimers.route.seconds)})</span>
                            )}
                        </h2>
                        {sel.isPostRoute ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">Completado</span>
                        ) : sel.isEnRuta ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En curso
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 uppercase tracking-wide">Pendiente</span>
                        )}
                    </div>

                    <div className="bg-surface-dark rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                        {/* Route: Origin → Destination */}
                        <div className="p-4 border-b border-slate-800">
                            <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center gap-0.5 pt-1">
                                    <div className="size-3 rounded-full border-2 border-sky-400 bg-sky-400/20" />
                                    <div className="w-0.5 h-8 bg-gradient-to-b from-sky-400/40 to-emerald-400/40" />
                                    <div className="size-3 rounded-full border-2 border-emerald-400 bg-emerald-400/20" />
                                </div>
                                <div className="flex-1 flex flex-col gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Origen</p>
                                        <p className="text-sm font-bold text-white">Centro de Distribución</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Destino</p>
                                        <p className="text-sm font-bold text-white">{sel.schoolName}</p>
                                        {sel.neighborhood && <p className="text-xs text-slate-400">{sel.neighborhood}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="p-4 border-b border-slate-800">
                            {sel.isPostRoute ? (
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-400">Llegada confirmada</p>
                                        {sel.arrivalPhotoAt && <p className="text-xs text-slate-400">a las {fmtClock(sel.arrivalPhotoAt)}</p>}
                                    </div>
                                </div>
                            ) : sel.isEnRuta ? (
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary animate-pulse">navigation</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">En ruta a la escuela</p>
                                        <p className="text-xs text-slate-400">Esperando notificación de llegada por parte de {sel.teacherName}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-slate-500">schedule</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-400">Pendiente</p>
                                        <p className="text-xs text-slate-500">Se activa al finalizar la preparación</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Arrival Photo */}
                        <div className="p-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Foto de llegada</p>
                            {sel.arrivalPhotoUrl ? (
                                <button
                                    type="button"
                                    className="relative group cursor-pointer w-full text-left"
                                    onClick={() => openEvidenceViewer(sel.arrivalPhotoUrl, { label: 'Foto de llegada', typeHint: 'image' })}
                                >
                                    <img
                                        src={sel.arrivalPhotoUrl}
                                        alt="Foto de llegada"
                                        className="w-full h-40 object-cover rounded-xl border border-slate-700 transition-transform group-hover:scale-[1.02]"
                                    />
                                    <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-xs">schedule</span>
                                        {fmtClock(sel.arrivalPhotoAt)}
                                    </div>
                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-emerald-500/90 text-[10px] font-bold text-white flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">check</span>
                                        Confirmada
                                    </div>
                                </button>
                            ) : (
                                <div className={`flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed ${sel.isEnRuta ? 'border-primary/30 bg-primary/5' : 'border-slate-700 bg-slate-800/30'
                                    }`}>
                                    <span className={`material-symbols-outlined text-3xl mb-2 ${sel.isEnRuta ? 'text-primary/50' : 'text-slate-600'
                                        }`}>photo_camera</span>
                                    <p className={`text-xs font-bold ${sel.isEnRuta ? 'text-primary/70' : 'text-slate-500'
                                        }`}>
                                        {sel.isEnRuta ? 'Esperando foto de llegada…' : 'Foto de llegada (pendiente)'}
                                    </p>
                                    {sel.isEnRuta && (
                                        <p className="text-[10px] text-slate-500 mt-1">Se capturará al confirmar arribo</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ═══ ACTIVIDAD POR ROL ═══ */}
                {sel.roleCards && sel.roleCards.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    👥 Montaje
                                    {phaseTimers.prepOnsite.started && (
                                        <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(phaseTimers.prepOnsite.seconds)})</span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Estado por operativo durante la fase de montaje
                                </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En vivo
                            </span>
                        </div>

                        <div className="space-y-3">
                            {sel.roleCards.map(card => {
                                const roleLbl = ROLE_META[card.role]?.label || card.role;
                                const roleIcon = ROLE_META[card.role]?.icon || 'task_alt';
                                const isInactive = !card.postArrivalEnabled;
                                const cardKey = `${sel.id}:${card.role}`;
                                const isCollapsed = Boolean(collapsedRoleCards[cardKey]);
                                const forcePrepCompletion = isMissionPastPrep(card.missionState);
                                const currentTask = forcePrepCompletion
                                    ? null
                                    : (card.activeTask || (card.taskFlow || []).find((task) => task.status === 'active') || null);
                                const previewTask = currentTask || (!card.postArrivalEnabled
                                    ? (card.taskFlow || []).find((task) => ['active', 'pending', 'inactive'].includes(task.status))
                                    : null);
                                const flowTasks = card.taskFlow || [];
                                const flowTasksForBlocks = flowTasks.filter((task) => task.countAsBlock !== false);
                                const flowCompleted = flowTasksForBlocks.filter((task) => task.status === 'completed').length;
                                const flowTotal = flowTasksForBlocks.length;
                                const civicAudioTask = flowTasks.find((task) => task.id === 'teacher-civic-audio' && Boolean(task.audioUrl)) || null;
                                const civicVideoTask = flowTasks.find((task) => task.id === 'assistant-civic-video' && Boolean(task.videoUrl)) || null;
                                const prepTotal = card.prepProgress ? 5 : 0;
                                const prepDone = card.prepProgress
                                    ? (card.prepProgress.spot.confirmed ? 1 : 0) + card.prepProgress.done + (card.prepProgress.controllerConnected ? 1 : 0)
                                    : 0;
                                const completedTotalRaw = prepDone + flowCompleted;
                                const plannedTotal = prepTotal + flowTotal;
                                const completedTotal = forcePrepCompletion
                                    ? (plannedTotal > 0 ? plannedTotal : completedTotalRaw)
                                    : completedTotalRaw;
                                const progressPct = forcePrepCompletion
                                    ? 100
                                    : (plannedTotal > 0 ? Math.round((completedTotal / plannedTotal) * 100) : 0);
                                const flowProgressPct = flowTotal > 0 ? Math.round((flowCompleted / flowTotal) * 100) : 0;
                                const progressLabel = forcePrepCompletion
                                    ? (plannedTotal > 0 ? `${plannedTotal}/${plannedTotal} completado` : 'Montaje finalizado')
                                    : (plannedTotal > 0 ? `${completedTotal}/${plannedTotal} completado` : 'Sin tareas');
                                const taskActive = !forcePrepCompletion && previewTask?.status === 'active';
                                const cardCompleted = forcePrepCompletion || (card.postArrivalEnabled && plannedTotal > 0 && completedTotal >= plannedTotal);
                                const taskDone = forcePrepCompletion || previewTask?.status === 'completed' || (!taskActive && cardCompleted);
                                const summaryTitle = forcePrepCompletion
                                    ? 'Montaje finalizado'
                                    : previewTask?.label
                                    || (card.postArrivalEnabled
                                        ? (cardCompleted ? 'Bloques completados' : card.title)
                                        : card.preArrivalTitle || card.title);
                                const summaryDesc = forcePrepCompletion
                                    ? 'Flujo operativo completado para este rol.'
                                    : previewTask?.desc
                                    || (card.postArrivalEnabled
                                        ? (cardCompleted ? 'Flujo operativo completado para este rol.' : card.desc)
                                        : card.preArrivalDesc || card.desc);
                                const summaryIsGlobal = previewTask?.kind === 'global';
                                const summaryIsCivic = previewTask?.accent === 'emerald';
                                const currentTaskIcon = previewTask?.icon || cardTitleIcon(card);
                                const currentTaskDesc = summaryDesc || card.desc;
                                const statusText = forcePrepCompletion
                                    ? 'Montaje finalizado'
                                    : !card.postArrivalEnabled
                                        ? '🕓 Pendiente de llegada a sede'
                                        : taskActive
                                            ? `📍 Tarea actual: ${summaryTitle}`
                                            : cardCompleted
                                                ? '✅ Lista de tareas completada'
                                                : `📌 Próxima tarea: ${summaryTitle}`;
                                const statusTextTone = forcePrepCompletion
                                    ? 'text-emerald-300'
                                    : !card.postArrivalEnabled
                                        ? 'text-slate-300'
                                        : taskActive
                                            ? (summaryIsCivic ? 'text-emerald-300' : 'text-sky-300')
                                            : cardCompleted || taskDone
                                                ? 'text-emerald-300'
                                                : 'text-slate-300';
                                const summaryTitleTone = forcePrepCompletion
                                    ? 'text-emerald-300'
                                    : taskDone
                                        ? 'text-emerald-300'
                                        : summaryIsCivic
                                            ? 'text-emerald-300'
                                            : taskActive
                                                ? 'text-slate-100'
                                                : 'text-slate-300';
                                const summaryDescTone = forcePrepCompletion
                                    ? 'text-emerald-300/65'
                                    : taskDone
                                        ? 'text-emerald-300/65'
                                        : summaryIsCivic
                                            ? 'text-emerald-300/75'
                                            : taskActive
                                                ? 'text-slate-400'
                                                : 'text-slate-500';
                                const summaryDotTone = forcePrepCompletion
                                    ? 'bg-emerald-500'
                                    : taskDone
                                        ? 'bg-emerald-500'
                                        : summaryIsCivic
                                            ? 'bg-emerald-500 animate-pulse'
                                            : taskActive
                                                ? 'bg-sky-500 animate-pulse'
                                                : 'bg-slate-700';
                                const cardNoProgress = !forcePrepCompletion && completedTotal === 0;
                                const cardActive = !isInactive && taskActive;
                                const hidePrepDetails = false;
                                const cardContainerTone = isInactive
                                    ? 'bg-slate-900/45 border-slate-700/70 opacity-70 grayscale-[0.2]'
                                    : forcePrepCompletion
                                        ? 'bg-surface-dark border-emerald-500/35 shadow-[0_0_14px_-4px_rgba(16,185,129,0.35)]'
                                        : cardActive
                                            ? 'bg-surface-dark border-primary/50 shadow-[0_0_15px_-3px_rgba(19,146,236,0.15)] ring-1 ring-primary/20'
                                            : 'bg-surface-dark border-slate-800';
                                const cardCompletedTone = !isInactive && cardCompleted && !cardActive ? 'opacity-95' : '';
                                const roleIconTone = cardActive
                                    ? 'text-primary animate-pulse'
                                    : cardCompleted
                                        ? 'text-emerald-500'
                                        : 'text-slate-400';
                                const roleTitleTone = cardNoProgress || isInactive ? 'text-slate-400' : 'text-white';
                                const rolePersonTone = isInactive
                                    ? 'text-slate-600'
                                    : (cardCompleted || forcePrepCompletion)
                                        ? 'text-emerald-400/70'
                                        : 'text-slate-400';
                                return (
                                    <div key={card.role}
                                        className={`bg-surface-dark rounded-xl overflow-hidden border shadow-sm relative transition-all duration-300 ${cardContainerTone} ${cardCompletedTone}`}
                                        style={{ animation: 'fadeSlideIn 0.35s ease-out' }}
                                    >
                                        {cardActive && <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />}

                                        {/* Header */}
                                        <div className="px-4 py-3 border-b border-slate-800 bg-surface-darker/45">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`material-symbols-outlined text-sm ${roleIconTone}`}>{roleIcon}</span>
                                                    <div className="min-w-0">
                                                        <h3 className={`text-sm font-extrabold uppercase tracking-wide ${roleTitleTone}`}>{roleLbl}</h3>
                                                        <p className={`text-xs truncate ${rolePersonTone}`}>{card.person}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRoleCard(cardKey)}
                                                    className="size-7 rounded-full border border-slate-700/70 bg-slate-800/65 hover:bg-slate-700/80 transition-colors flex items-center justify-center"
                                                    aria-label={isCollapsed ? `Expandir tarjeta de ${roleLbl}` : `Plegar tarjeta de ${roleLbl}`}
                                                    title={isCollapsed ? 'Expandir detalle' : 'Plegar detalle'}
                                                >
                                                    <span className="material-symbols-outlined text-[16px] text-slate-300">{isCollapsed ? 'expand_more' : 'expand_less'}</span>
                                                </button>
                                            </div>

                                            {forcePrepCompletion ? (
                                                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                                                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                                    Montaje finalizado
                                                </div>
                                            ) : (
                                                <p className={`mt-2 text-[11px] font-semibold leading-snug ${statusTextTone}`}>
                                                    {statusText}
                                                </p>
                                            )}
                                        </div>

                                        {/* Main content */}
                                        {card.postArrivalEnabled && (
                                            <div className="px-4 pb-3">
                                                <div className="mt-3 rounded-xl border border-slate-800 bg-surface-darker/55 px-3.5 py-3.5">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`size-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${summaryDotTone}`}>
                                                            {taskDone ? (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[13px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>{currentTaskIcon}</span>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-[15px] font-bold leading-tight ${summaryTitleTone}`}>{summaryTitle}</span>
                                                            {summaryIsGlobal && (
                                                                <p className="text-[11px] font-semibold text-sky-300 mt-0.5">Tarea global</p>
                                                            )}
                                                            <p className={`text-[12px] leading-snug mt-1.5 ${summaryDescTone}`}>{currentTaskDesc}</p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="flex items-center justify-between text-[11px] font-semibold">
                                                            <span className="text-slate-400">Progreso</span>
                                                            <span className={progressPct >= 100 ? 'text-emerald-300' : 'text-slate-200'}>{progressLabel}</span>
                                                        </div>
                                                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-400' : 'bg-primary'}`}
                                                                style={{ width: `${progressPct}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {isCollapsed && card.role === 'teacher' && civicAudioTask && (
                                                        <div className="mt-2">
                                                            <TimelineVoicePlayer
                                                                url={civicAudioTask.audioUrl}
                                                                duration={civicAudioTask.audioDurationSec}
                                                                label="Evidencia de audio cívico"
                                                                onOpenViewer={openEvidenceViewer}
                                                            />
                                                        </div>
                                                    )}
                                                    {isCollapsed && card.role === 'assistant' && civicVideoTask && (
                                                        <div className="mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEvidenceViewer(civicVideoTask.videoUrl, { label: 'Evidencia de video cívico', typeHint: 'video' })}
                                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-800/85 hover:bg-slate-700 transition-colors text-xs"
                                                            >
                                                                <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>videocam</span>
                                                                <span className="text-slate-200 font-semibold">Evidencia video</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {!isCollapsed && !hidePrepDetails && (card.prepProgress ? (
                                                    <div className="mt-3 space-y-2">
                                                        {/* ── Paso previo: Pista confirmada ── */}
                                                        <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${card.prepProgress.spot.confirmed
                                                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                            : 'bg-amber-500/10 border border-amber-500/20'
                                                            }`}>
                                                            <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${card.prepProgress.spot.confirmed ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                                                }`}>
                                                                {card.prepProgress.spot.confirmed ? (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-[12px] text-white">location_on</span>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className={`text-[13px] font-bold leading-tight ${card.prepProgress.spot.confirmed ? 'text-emerald-400' : 'text-amber-300'
                                                                    }`}>
                                                                    {card.prepProgress.spot.confirmed ? 'Pista confirmada' : 'Confirmando pista...'}
                                                                </span>
                                                                {card.prepProgress.spot.confirmed && card.prepProgress.spot.at && (
                                                                    <p className="text-[10px] text-emerald-400/60 mt-0.5">a las {fmtClock(card.prepProgress.spot.at)}</p>
                                                                )}
                                                                {card.prepProgress.spot.note && (
                                                                    <p className="text-[11px] text-slate-400 mt-1 italic">Ref: &quot;{card.prepProgress.spot.note}&quot;</p>
                                                                )}
                                                                {card.prepProgress.spot.photoUrl ? (
                                                                    <button
                                                                        type="button"
                                                                        className="mt-1.5 relative group cursor-pointer inline-block"
                                                                        onClick={() => openEvidenceViewer(card.prepProgress.spot.photoUrl, { label: 'Foto de pista', typeHint: 'image' })}
                                                                    >
                                                                        <img src={card.prepProgress.spot.photoUrl} alt="Foto de pista" className="w-28 h-20 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white font-bold inline-flex items-center gap-1">
                                                                            <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                            Pista
                                                                        </div>
                                                                    </button>
                                                                ) : card.prepProgress.spot.confirmed ? (
                                                                    <p className="text-[10px] text-slate-600 mt-1">Foto de pista: no enviada</p>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        {/* ── Separador visual ── */}
                                                        <div className="flex items-center gap-2 px-1">
                                                            <div className="flex-1 h-px bg-slate-700/60" />
                                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Montaje de vuelo</span>
                                                            <div className="flex-1 h-px bg-slate-700/60" />
                                                        </div>
                                                        {[{ icon: 'visibility', title: 'Reconocimiento del entorno', desc: 'Revisa riesgos alrededor del área de vuelo.' },
                                                        { icon: 'flight', title: 'Vuelo de prueba', desc: 'Valida señal, estabilidad y altura segura.' },
                                                        { icon: 'map', title: 'Ruta óptima', desc: 'Define la ruta con mejor señal y visibilidad.' }
                                                        ].map((step, i) => {
                                                            const done = card.prepProgress.checks[i];
                                                            const canStartPrep = card.prepProgress.spot.confirmed;
                                                            const isNow = canStartPrep && !done && card.prepProgress.checks.slice(0, i).every(Boolean);
                                                            return (
                                                                <div key={i} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${done ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                    : isNow ? 'bg-sky-500/10 border border-sky-500/30'
                                                                        : 'bg-slate-800/40 border border-slate-700/30'
                                                                    }`}>
                                                                    <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? 'bg-emerald-500'
                                                                        : isNow ? 'bg-sky-500 animate-pulse'
                                                                            : 'bg-slate-700'
                                                                        }`}>
                                                                        {done ? (
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                        ) : (
                                                                            <span className="text-[9px] font-bold text-white">{i + 1}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[13px] font-bold leading-tight ${done ? 'text-emerald-400 line-through opacity-70'
                                                                                : isNow ? 'text-white'
                                                                                    : 'text-slate-500'
                                                                                }`}>
                                                                                <span className="inline-flex items-center gap-1.5">
                                                                                    <span className="material-symbols-outlined text-[14px] align-middle">{step.icon}</span>
                                                                                    {step.title}
                                                                                </span>
                                                                            </span>
                                                                            {isNow && (
                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-300 flex-shrink-0">Ahora</span>
                                                                            )}
                                                                        </div>
                                                                        <p className={`text-[11px] leading-snug mt-0.5 ${done ? 'text-emerald-400/50' : isNow ? 'text-slate-400' : 'text-slate-600'
                                                                            }`}>{step.desc}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="flex items-center gap-2 mt-1 px-1">
                                                            <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-500 ${card.prepProgress.done >= 3 ? 'bg-emerald-400' : 'bg-sky-400'}`} style={{ width: `${(card.prepProgress.done / card.prepProgress.total) * 100}%` }} />
                                                            </div>
                                                            <span className={`text-[10px] font-bold ${card.prepProgress.done >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>{card.prepProgress.done} de {card.prepProgress.total}</span>
                                                        </div>

                                                        {/* ── Separador: Conexión del mando (siempre visible) ── */}
                                                        <div className="flex items-center gap-2 px-1">
                                                            <div className="flex-1 h-px bg-slate-700/60" />
                                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Conexión del mando</span>
                                                            <div className="flex-1 h-px bg-slate-700/60" />
                                                        </div>
                                                        {(() => {
                                                            const connected = card.prepProgress.controllerConnected;
                                                            const active = card.prepProgress.checklistDone && !connected;
                                                            return (
                                                                <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${connected
                                                                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                    : active
                                                                        ? 'bg-sky-500/10 border border-sky-500/30'
                                                                        : 'bg-slate-800/40 border border-slate-700/30'
                                                                    }`}>
                                                                    <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${connected ? 'bg-emerald-500'
                                                                        : active ? 'bg-sky-500 animate-pulse'
                                                                            : 'bg-slate-700'
                                                                        }`}>
                                                                        {connected ? (
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                        ) : (
                                                                            <span className="material-symbols-outlined text-[11px] text-white">sports_esports</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[13px] font-bold leading-tight ${connected ? 'text-emerald-400'
                                                                                : active ? 'text-white'
                                                                                    : 'text-slate-500'
                                                                                }`}>
                                                                                {connected ? 'Mando conectado' : active ? 'Conectando mando al gabinete...' : 'Conectar mando al gabinete'}
                                                                            </span>
                                                                            {active && (
                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-300 flex-shrink-0">Ahora</span>
                                                                            )}
                                                                        </div>
                                                                        <p className={`text-[11px] leading-snug mt-0.5 ${connected ? 'text-emerald-400/50'
                                                                            : active ? 'text-slate-400'
                                                                                : 'text-slate-600'
                                                                            }`}>
                                                                            {connected
                                                                                ? 'Control remoto conectado correctamente.'
                                                                                : active
                                                                                    ? 'Conectando el control remoto al gabinete.'
                                                                                    : 'Pendiente: se realizará al terminar el checklist.'}
                                                                        </p>
                                                                        {card.prepProgress.controllerConnectedAt && (
                                                                            <p className="text-[10px] text-emerald-400/60 mt-0.5">a las {fmtClock(card.prepProgress.controllerConnectedAt)}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {card.taskFlow?.length > 0 && (
                                                            <>
                                                                <div className="flex items-center gap-2 px-1 mt-1">
                                                                    <div className="flex-1 h-px bg-slate-700/60" />
                                                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Linea operativa</span>
                                                                    <div className="flex-1 h-px bg-slate-700/60" />
                                                                </div>
                                                                {card.taskFlow.map((task, i) => {
                                                                    const done = task.status === 'completed';
                                                                    const isNow = task.status === 'active';
                                                                    const isGlobal = task.kind === 'global';
                                                                    const icon = task.icon || 'task_alt';
                                                                    const rowTone = done
                                                                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                        : isNow
                                                                            ? 'bg-sky-500/10 border border-sky-500/30'
                                                                            : 'bg-slate-800/40 border border-slate-700/30';
                                                                    const dotTone = done
                                                                        ? 'bg-emerald-500'
                                                                        : isNow
                                                                            ? 'bg-sky-500 animate-pulse'
                                                                            : 'bg-slate-700';
                                                                    const titleTone = done
                                                                        ? 'text-emerald-400 line-through opacity-70'
                                                                        : isNow
                                                                            ? 'text-white'
                                                                            : 'text-slate-500';
                                                                    const descTone = done
                                                                        ? 'text-emerald-400/50'
                                                                        : isNow
                                                                            ? 'text-slate-400'
                                                                            : 'text-slate-600';
                                                                    return (
                                                                        <div key={task.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${rowTone}`}>
                                                                            <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${dotTone}`}>
                                                                                {done ? (
                                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                                ) : isGlobal ? (
                                                                                    <span className="material-symbols-outlined text-[11px] text-white">{icon}</span>
                                                                                ) : (
                                                                                    <span className="text-[9px] font-bold text-white">{i + 1}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className={`text-[13px] font-bold leading-tight ${titleTone}`}>{task.label}</span>
                                                                                    {isGlobal && (
                                                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-200">Global</span>
                                                                                    )}
                                                                                    {isNow && (
                                                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest flex-shrink-0 bg-sky-500/20 text-sky-300">Ahora</span>
                                                                                    )}
                                                                                </div>
                                                                                <p className={`text-[11px] leading-snug mt-0.5 ${descTone}`}>{task.desc}</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : card.role !== 'pilot' ? (
                                                    <div className="mt-3 space-y-2">
                                                        <div className="flex items-center gap-2 px-1 pt-1">
                                                            <div className="flex-1 h-px bg-slate-700/60" />
                                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Línea operativa</span>
                                                            <div className="flex-1 h-px bg-slate-700/60" />
                                                        </div>

                                                        {(card.taskFlow || []).map((task, i) => {
                                                            const done = task.status === 'completed';
                                                            const isNow = task.status === 'active';
                                                            const isGlobal = task.kind === 'global';
                                                            const isInactiveTask = task.status === 'inactive';
                                                            const isCivicTask = task.id === 'teacher-civic' || task.id === 'teacher-civic-audio';
                                                            const icon = task.icon || 'task_alt';
                                                            const desc = task.desc || 'Pendiente por ejecutar.';

                                                            let rowTone = isGlobal
                                                                ? done
                                                                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                    : isNow
                                                                        ? 'bg-sky-500/10 border border-sky-500/30'
                                                                        : isInactiveTask
                                                                            ? 'bg-slate-800/25 border border-slate-700/20'
                                                                            : 'bg-slate-800/40 border border-slate-700/30'
                                                                : done
                                                                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                    : isNow
                                                                        ? 'bg-sky-500/10 border border-sky-500/30'
                                                                        : isInactiveTask
                                                                            ? 'bg-slate-800/25 border border-slate-700/20'
                                                                            : 'bg-slate-800/40 border border-slate-700/30';

                                                            let dotTone = isGlobal
                                                                ? done
                                                                    ? 'bg-emerald-500'
                                                                    : isNow
                                                                        ? 'bg-sky-500 animate-pulse'
                                                                        : 'bg-slate-700'
                                                                : done
                                                                    ? 'bg-emerald-500'
                                                                    : isNow
                                                                        ? 'bg-sky-500 animate-pulse'
                                                                        : 'bg-slate-700';

                                                            let titleTone = isGlobal
                                                                ? done
                                                                    ? 'text-emerald-400 line-through opacity-70'
                                                                    : isNow
                                                                        ? 'text-white'
                                                                        : 'text-slate-500'
                                                                : done
                                                                    ? 'text-emerald-400 line-through opacity-70'
                                                                    : isNow
                                                                        ? 'text-white'
                                                                        : 'text-slate-500';

                                                            let descTone = isGlobal
                                                                ? done
                                                                    ? 'text-emerald-400/50'
                                                                    : isNow
                                                                        ? 'text-slate-400'
                                                                        : 'text-slate-600'
                                                                : done
                                                                    ? 'text-emerald-400/50'
                                                                    : isNow
                                                                        ? 'text-slate-400'
                                                                        : 'text-slate-600';

                                                            if (isCivicTask) {
                                                                rowTone = done
                                                                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                    : isNow
                                                                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                                                                        : isInactiveTask
                                                                            ? 'bg-slate-800/25 border border-slate-700/20'
                                                                            : 'bg-slate-800/40 border border-slate-700/30';
                                                                dotTone = done
                                                                    ? 'bg-emerald-500'
                                                                    : isNow
                                                                        ? 'bg-emerald-500 animate-pulse'
                                                                        : 'bg-emerald-700/80';
                                                                titleTone = done
                                                                    ? 'text-emerald-400 line-through opacity-70'
                                                                    : isNow
                                                                        ? 'text-emerald-200'
                                                                        : 'text-emerald-400';
                                                                descTone = done
                                                                    ? 'text-emerald-400/50'
                                                                    : isNow
                                                                        ? 'text-emerald-300/80'
                                                                        : 'text-slate-500';
                                                            }

                                                            return (
                                                                <div key={task.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${rowTone}`}>
                                                                    <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${dotTone}`}>
                                                                        {done ? (
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                        ) : isGlobal ? (
                                                                            <span className="material-symbols-outlined text-[11px] text-white">{icon}</span>
                                                                        ) : (
                                                                            <span className="text-[9px] font-bold text-white">{i + 1}</span>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`text-[13px] font-bold leading-tight ${titleTone}`}>
                                                                                <span className="inline-flex items-center gap-1.5">
                                                                                    {!isGlobal && <span className="material-symbols-outlined text-[14px] align-middle">{icon}</span>}
                                                                                    {task.label}
                                                                                </span>
                                                                            </span>
                                                                            {isGlobal && (
                                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-200">Global</span>
                                                                            )}
                                                                            {isNow && (
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest flex-shrink-0 ${isGlobal ? 'bg-sky-500/20 text-sky-200' : 'bg-sky-500/20 text-sky-300'}`}>Ahora</span>
                                                                            )}
                                                                        </div>

                                                                        <p className={`text-[11px] leading-snug mt-0.5 ${descTone}`}>{desc}</p>

                                                                        {task.id === 'teacher-civic' && done && card.civicProgress?.at && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">a las {fmtClock(card.civicProgress.at)}</p>
                                                                        )}

                                                                        {task.id === 'teacher-civic-audio' && done && task.audioUploadedAt && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">audio enviado a las {fmtClock(task.audioUploadedAt)}</p>
                                                                        )}

                                                                        {task.id === 'teacher-civic-audio' && task.audioUrl && (
                                                                            <div className="mt-2">
                                                                                <TimelineVoicePlayer
                                                                                    url={task.audioUrl}
                                                                                    duration={task.audioDurationSec}
                                                                                    label="Evidencia de audio cívico"
                                                                                    onOpenViewer={openEvidenceViewer}
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {task.id === 'teacher-operation-ready' && done && task.readyAt && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">confirmado a las {fmtClock(task.readyAt)}</p>
                                                                        )}

                                                                        {task.id === 'assistant-civic-video' && done && task.videoUploadedAt && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">video enviado a las {fmtClock(task.videoUploadedAt)}</p>
                                                                        )}

                                                                        {task.id === 'assistant-civic-video' && task.videoUrl && (
                                                                            <div className="mt-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openEvidenceViewer(task.videoUrl, { label: 'Evidencia de video cívico', typeHint: 'video' })}
                                                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-800/85 hover:bg-slate-700 transition-colors text-xs"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                                                                                    <span className="text-slate-200 font-semibold">Ver evidencia de video</span>
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {task.id === 'assistant-parking' && done && card.parkingProgress?.parkedAt && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">a las {fmtClock(card.parkingProgress.parkedAt)}</p>
                                                                        )}

                                                                        {task.id === 'assistant-parking' && card.parkingProgress?.hasPhoto && (
                                                                            <div className="mt-2 flex items-start gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    className="relative group cursor-pointer flex-shrink-0"
                                                                                    onClick={() => openEvidenceViewer(card.parkingProgress.photoUrl, { label: 'Evidencia de vehículo', typeHint: 'image' })}
                                                                                >
                                                                                    <img src={card.parkingProgress.photoUrl} alt="Evidencia vehículo" className="w-24 h-16 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold inline-flex items-center">
                                                                                        <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                                    </div>
                                                                                </button>
                                                                                <div className="pt-0.5">
                                                                                    <p className="text-[10px] font-bold text-emerald-400/70">Evidencia recibida</p>
                                                                                    {card.parkingProgress.photoAt && (
                                                                                        <p className="text-[9px] text-slate-600">a las {fmtClock(card.parkingProgress.photoAt)}</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {task.id === 'assistant-ad-wall' && done && card.adWallProgress?.installedAt && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">a las {fmtClock(card.adWallProgress.installedAt)}</p>
                                                                        )}

                                                                        {task.id === 'assistant-ad-wall' && card.adWallProgress?.hasPhoto && (
                                                                            <div className="mt-2 flex items-start gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    className="relative group cursor-pointer flex-shrink-0"
                                                                                    onClick={() => openEvidenceViewer(card.adWallProgress.photoUrl, { label: 'Evidencia lona publicitaria', typeHint: 'image' })}
                                                                                >
                                                                                    <img src={card.adWallProgress.photoUrl} alt="Evidencia lona publicitaria" className="w-24 h-16 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold inline-flex items-center">
                                                                                        <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                                    </div>
                                                                                </button>
                                                                                <div className="pt-0.5">
                                                                                    <p className="text-[10px] font-bold text-emerald-400/70">Evidencia recibida</p>
                                                                                    {card.adWallProgress.photoAt && (
                                                                                        <p className="text-[9px] text-slate-600">a las {fmtClock(card.adWallProgress.photoAt)}</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {task.id === 'assistant-stand-photo' && task.photoUrl && (
                                                                            <div className="mt-2 flex items-start gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    className="relative group cursor-pointer flex-shrink-0"
                                                                                    onClick={() => openEvidenceViewer(task.photoUrl, { label: 'Foto final del stand', typeHint: 'image' })}
                                                                                >
                                                                                    <img src={task.photoUrl} alt="Foto final del stand" className="w-24 h-16 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                                    <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold inline-flex items-center">
                                                                                        <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                                    </div>
                                                                                </button>
                                                                                <div className="pt-0.5">
                                                                                    <p className="text-[10px] font-bold text-emerald-400/70">Foto registrada</p>
                                                                                    {task.photoAt && (
                                                                                        <p className="text-[9px] text-slate-600">a las {fmtClock(task.photoAt)}</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {task.id === 'assistant-operation-ready' && done && task.readyAt && (
                                                                            <p className="text-[10px] text-slate-600 mt-0.5">confirmado a las {fmtClock(task.readyAt)}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        <div className="flex items-center gap-2 mt-1 px-1">
                                                            <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-500 bg-sky-400"
                                                                    style={{ width: `${flowProgressPct}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-500">
                                                                {`${flowCompleted} de ${flowTotal}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : null)}
                                            </div>
                                        )}

                                        {!card.postArrivalEnabled && !hidePrepDetails && (
                                            <div className="px-4 pb-3">
                                                <h3 className="text-base font-bold text-slate-300 leading-tight">{card.preArrivalTitle}</h3>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.preArrivalDesc}</p>

                                                <div className="mt-2 rounded-xl border border-slate-700/40 bg-slate-800/35 px-3 py-2.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[13px] font-bold leading-tight text-slate-300">{summaryTitle}</span>
                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-slate-700/70 text-slate-400">Próxima</span>
                                                    </div>
                                                    <p className="text-[11px] leading-snug mt-1 text-slate-500">{summaryDesc}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Ruta de tareas inactiva (solo pre-llegada) */}
                                        {!card.postArrivalEnabled && !hidePrepDetails && !isCollapsed && card.taskFlow?.length > 0 && (
                                            <div className={`mx-4 mb-3 p-3 rounded-xl border space-y-2 ${isInactive ? 'bg-slate-900/25 border-slate-700/40' : 'bg-slate-900/35 border-slate-700/50'}`}>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    Tareas al llegar
                                                </p>
                                                <p className="text-[10px] text-slate-600">Se activan cuando el Docente notifica llegada con foto.</p>
                                                <div className="space-y-1.5">
                                                    {card.taskFlow.map((task) => {
                                                        const isDone = task.status === 'completed';
                                                        const isActive = task.status === 'active';
                                                        const isInactive = task.status === 'inactive';
                                                        return (
                                                            <div key={task.id} className="flex items-center gap-2.5">
                                                                {isInactive ? (
                                                                    <span className="material-symbols-outlined text-[14px] text-slate-600">radio_button_unchecked</span>
                                                                ) : isDone ? (
                                                                    <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                                                                ) : isActive ? (
                                                                    <span className="material-symbols-outlined text-[14px] text-primary animate-pulse">radio_button_checked</span>
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-[14px] text-slate-600">radio_button_unchecked</span>
                                                                )}

                                                                <span className={`text-[12px] ${isInactive
                                                                        ? 'text-slate-500'
                                                                        : isDone
                                                                            ? 'text-emerald-300/90'
                                                                            : isActive
                                                                                ? 'text-white font-semibold'
                                                                                : 'text-slate-500'
                                                                    }`}>
                                                                    {task.label}
                                                                </span>

                                                                {card.postArrivalEnabled && isActive && (
                                                                    <span className="ml-auto px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-primary/20 text-primary">Ahora</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Data block */}
                                        {card.postArrivalEnabled && !isCollapsed && card.data && (
                                            <div className="mx-4 mb-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-2">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Datos clave</p>
                                                {card.data.access && (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${card.data.access === 'inside' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                                            {card.data.access === 'inside' ? 'Acceso: DENTRO' : 'Acceso: AFUERA'}
                                                        </span>
                                                    </div>
                                                )}
                                                {card.data.note && (
                                                    <p className="text-xs text-slate-300 bg-slate-700/40 rounded-lg px-3 py-2 italic">
                                                        &quot;{card.data.note}&quot;
                                                    </p>
                                                )}
                                                {card.data.voiceUrl && (
                                                    <TimelineVoicePlayer
                                                        url={card.data.voiceUrl}
                                                        duration={card.data.voiceDuration}
                                                        onOpenViewer={openEvidenceViewer}
                                                        label="Nota de voz operativa"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        {card.postArrivalEnabled && (
                                            <div className="px-4 py-2.5 border-t border-slate-800 bg-surface-darker/55 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-600">
                                                    Actualizado {fmtAgo(card.updatedAt, now)}
                                                </span>
                                                {!isCollapsed && card.next && !hidePrepDetails && (
                                                    <span className="text-[10px] text-slate-600">
                                                        Siguiente: <span className="text-slate-500 font-medium">{card.next}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ═══ OPERACIÓN EN SEDE ═══ */}
                <section className={operationSectionEnabled ? '' : 'opacity-35 grayscale pointer-events-none'}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>flight</span>
                                Operación en sede
                                {phaseTimers.operation.started && (
                                    <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(phaseTimers.operation.seconds)})</span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Registro operativo en tiempo real (primera etapa: Docente)</p>
                        </div>
                        {assistantActiveFlight ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En vuelo
                            </span>
                        ) : operationSectionEnabled ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">Actualizado</span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 uppercase tracking-wide">Pendiente</span>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className={`bg-surface-dark rounded-xl overflow-hidden border shadow-sm relative transition-all duration-300 ${assistantActiveFlight
                            ? 'border-primary/50 shadow-[0_0_15px_-3px_rgba(19,146,236,0.15)] ring-1 ring-primary/20'
                            : 'border-slate-800'
                            }`}>
                            {assistantActiveFlight && <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />}

                            <div className="px-4 py-3 border-b border-slate-800 bg-surface-darker/45">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`material-symbols-outlined text-sm ${assistantActiveFlight ? 'text-primary animate-pulse' : 'text-emerald-500'}`}>school</span>
                                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">Registro de vuelos</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{operationDisplayName}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${assistantActiveFlight ? 'text-primary bg-primary/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                                        {assistantOperation.totalFlights} vuelos
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {assistantActiveFlight ? (
                                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-bold text-primary uppercase tracking-wide">
                                                    Vuelo #{assistantActiveFlight.flightNumber || assistantOperation.nextFlightNumber} en curso
                                                </p>
                                                <p className="text-xs text-slate-300">Despegue: {fmtClock(assistantActiveFlight.startedAt)}</p>
                                            </div>
                                            <p className="text-xl font-black text-primary tabular-nums">{fmtMMSS(assistantActiveFlight.elapsedSec)}</p>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300">Alumnos: {assistantActiveFlight.studentCount}</span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300">Personal: {assistantActiveFlight.staffCount}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/35 px-3 py-3">
                                        <p className="text-sm font-bold text-slate-300">Sin vuelo activo</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Próximo despegue: Vuelo #{assistantOperation.nextFlightNumber}</p>
                                        {assistantOperation.showInterFlightLive && (
                                            <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-2 flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tiempo entre vuelos</span>
                                                <span className="text-sm font-black text-slate-200 tabular-nums">{fmtMMSS(assistantOperation.interFlightElapsedSec)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/70 text-slate-300">Vuelos cerrados: {assistantOperation.totalFlights}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 tabular-nums">Tiempo en vuelo: {fmtMMSS(assistantOperation.totalDurationSec)}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300">Alumnos: {assistantOperation.totalStudents}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300">Personal: {assistantOperation.totalStaff}</span>
                                    {assistantOperation.totalIncidents > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300">Incidencias: {assistantOperation.totalIncidents}</span>
                                    )}
                                </div>

                                <div className="pt-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Bitácora de vuelos recientes</p>
                                    {assistantFlights.length > 0 ? (
                                        <div className="space-y-2">
                                            {assistantTimelineRows.map((row) => {
                                                if (row.itemType === 'interflight') {
                                                    const item = row.interFlight;
                                                    return (
                                                        <div key={row.key} className="mx-2 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-1.5 flex items-center justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tiempo entre vuelos</p>
                                                                <p className="text-[10px] text-slate-500">Entre vuelo #{item.fromFlightNumber} y vuelo #{item.toFlightNumber}</p>
                                                            </div>
                                                            <p className="text-xs font-black text-slate-300 tabular-nums">{fmtMMSS(item.durationSeconds)}</p>
                                                        </div>
                                                    );
                                                }

                                                const flight = row.flight;
                                                const flightNumber = flight.flightNumber || row.fallbackFlightNumber;

                                                return (
                                                    <div key={row.key} className="rounded-lg border border-slate-700/40 bg-slate-800/40 px-3 py-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-xs font-bold text-slate-200">Vuelo #{flightNumber}</p>
                                                            <p className="text-xs font-bold text-emerald-300 tabular-nums">{fmtMMSS(flight.durationSeconds)}</p>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                                                            <span>Hora: {fmtClock(flight.endTime || flight.startTime)}</span>
                                                            <span className="text-slate-600">•</span>
                                                            <span>Alumnos: {flight.studentCount}</span>
                                                            <span className="text-slate-600">•</span>
                                                            <span>Personal: {flight.staffCount}</span>
                                                            {flight.incidentsCount > 0 && (
                                                                <>
                                                                    <span className="text-slate-600">•</span>
                                                                    <span className="text-rose-300">Incidencias: {flight.incidentsCount}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500">Aún no hay vuelos guardados para esta misión.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-surface-dark rounded-xl border border-dashed border-slate-700/70 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-slate-500">school</span>
                                    <p className="text-sm font-bold text-slate-300">Docente (próximamente)</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Espacio reservado para registro operativo docente.</p>
                            </div>
                            <div className="bg-surface-dark rounded-xl border border-dashed border-slate-700/70 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm text-slate-500">flight</span>
                                    <p className="text-sm font-bold text-slate-300">Piloto (próximamente)</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Espacio reservado para registro operativo del piloto.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ FASE 4: DESMONTAJE ═══ */}
                <section className={phase4Enabled ? '' : 'opacity-30 grayscale pointer-events-none'}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl">construction</span>
                                Desmontaje
                                {closurePhase4.timer.started && (
                                    <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(closurePhase4.timer.seconds)})</span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Desarme y preparación de retorno del equipo en sede escolar.</p>
                        </div>
                        {closurePhase4.completed ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">Completado</span>
                        ) : closurePhase4.active ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En curso
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 uppercase tracking-wide">Pendiente</span>
                        )}
                    </div>

                    {renderLifecycleRoleCards(closurePhase4.cards, 'desmontaje')}
                </section>

                {/* ═══ FASE 5: RETORNO A BASE ═══ */}
                <section className={phase5Enabled ? '' : 'opacity-30 grayscale pointer-events-none'}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl">local_shipping</span>
                                Retorno a base
                                {closurePhase5.timer.started && (
                                    <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(closurePhase5.timer.seconds)})</span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Traslado del equipo desde la escuela al Centro de Distribución.</p>
                        </div>
                        {closurePhase5.completed ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">Completado</span>
                        ) : closurePhase5.active || closurePhase5.started ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En curso
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 uppercase tracking-wide">Pendiente</span>
                        )}
                    </div>

                    <div className="bg-surface-dark rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                        <div className="p-4 border-b border-slate-800">
                            <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center gap-0.5 pt-1">
                                    <div className="size-3 rounded-full border-2 border-sky-400 bg-sky-400/20" />
                                    <div className="w-0.5 h-8 bg-gradient-to-b from-sky-400/40 to-emerald-400/40" />
                                    <div className="size-3 rounded-full border-2 border-emerald-400 bg-emerald-400/20" />
                                </div>
                                <div className="flex-1 flex flex-col gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Origen</p>
                                        <p className="text-sm font-bold text-white">{sel.schoolName}</p>
                                        {sel.neighborhood && <p className="text-xs text-slate-400">{sel.neighborhood}</p>}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Destino</p>
                                        <p className="text-sm font-bold text-white">Centro de Distribución</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-b border-slate-800">
                            {closurePhase5.completed ? (
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-400">Arribo a base confirmado</p>
                                        {closurePhase5.arrivedAt && <p className="text-xs text-slate-400">{fmtExactDateTime(closurePhase5.arrivedAt)}</p>}
                                    </div>
                                </div>
                            ) : closurePhase5.active || closurePhase5.started ? (
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary animate-pulse">navigation</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">En traslado al Centro de Distribución</p>
                                        <p className="text-xs text-slate-400">Monitoreando confirmación de arribo.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-slate-500">schedule</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-400">Pendiente</p>
                                        <p className="text-xs text-slate-500">Se activa cuando finaliza desmontaje.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Cronología</p>
                            <div className="space-y-2">
                                <div className={`rounded-lg border px-3 py-2 ${closurePhase5.startedAt ? 'border-sky-500/30 bg-sky-500/10' : 'border-slate-700/50 bg-slate-800/35'}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Salida de escuela</p>
                                    <p className={`text-xs mt-1 ${closurePhase5.startedAt ? 'text-slate-100' : 'text-slate-500'}`}>
                                        {closurePhase5.startedAt ? fmtExactDateTime(closurePhase5.startedAt) : 'Pendiente de registro'}
                                    </p>
                                </div>
                                <div className={`rounded-lg border px-3 py-2 ${closurePhase5.arrivedAt ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/50 bg-slate-800/35'}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Arribo a base</p>
                                    <p className={`text-xs mt-1 ${closurePhase5.arrivedAt ? 'text-slate-100' : 'text-slate-500'}`}>
                                        {closurePhase5.arrivedAt ? fmtExactDateTime(closurePhase5.arrivedAt) : 'Pendiente de registro'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ FASE 6: CIERRE EN BASE ═══ */}
                <section className={phase6Enabled ? '' : 'opacity-30 grayscale pointer-events-none'}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl">warehouse</span>
                                Cierre en base
                                {closurePhase6.timer.started && (
                                    <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(closurePhase6.timer.seconds)})</span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Validaciones finales, resguardo y cierre operativo en Centro de Distribución.</p>
                        </div>
                        {closurePhase6.completed ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">Completado</span>
                        ) : closurePhase6.active ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En curso
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 uppercase tracking-wide">Pendiente</span>
                        )}
                    </div>

                    {renderLifecycleRoleCards(closurePhase6.cards, 'cierre')}
                </section>

                {/* ═══ FASE 7: CHECK-OUT ═══ */}
                <section className={phase7Enabled ? '' : 'opacity-30 grayscale pointer-events-none'}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl">flag</span>
                                Check-out
                                {closurePhase7.timer.started && (
                                    <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(closurePhase7.timer.seconds)})</span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Confirmación final individual de cierre por cada operativo.</p>
                        </div>
                        {closurePhase7.completed ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">Completado</span>
                        ) : closurePhase7.active || closurePhase7.started ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary uppercase tracking-wide flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                En curso
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 uppercase tracking-wide">Pendiente</span>
                        )}
                    </div>

                    <div className="bg-surface-dark rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                        <div className="px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800/70 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-base text-emerald-400">verified</span>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Cierre operativo final</p>
                                    <p className="text-[11px] text-slate-500 truncate">Registro por rol con hora exacta y observaciones.</p>
                                </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700/60 text-slate-200">
                                {checkoutDoneCount}/{checkoutTotalCount}
                            </span>
                        </div>

                        <div className="p-4 grid grid-cols-1 gap-3">
                            {checkoutRoleEntries.map(([role, row]) => {
                                const roleMeta = ROLE_META[role] || { label: role, icon: 'task_alt' };
                                const done = closurePhase7.forceComplete || row?.done === true;
                                const comment = typeof row?.comment === 'string' && row.comment.trim().length > 0
                                    ? row.comment.trim()
                                    : 'Sin comentarios';
                                const operativeName = closureRoleNameByRole[role] || roleMeta.label;
                                const checkoutAt = row?.at ? fmtExactDateTime(row.at) : '--';

                                return (
                                    <div
                                        key={`checkout-${role}`}
                                        className={`rounded-xl border px-3.5 py-3 ${done ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700/60 bg-slate-900/40'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${done ? 'text-emerald-300' : 'text-slate-500'}`}>
                                                    {roleMeta.label}
                                                </p>
                                                <p className="text-sm font-bold text-white truncate">{operativeName}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/60 text-slate-300'}`}>
                                                {done ? 'Confirmado' : 'Pendiente'}
                                            </span>
                                        </div>

                                        <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-800/35 px-2.5 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Hora de check-out</p>
                                            <p className={`mt-1 text-xs tabular-nums ${done ? 'text-slate-100' : 'text-slate-400'}`}>{checkoutAt}</p>
                                        </div>

                                        <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-800/35 px-2.5 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Comentario</p>
                                            <p className={`mt-1 text-xs leading-relaxed ${comment === 'Sin comentarios' ? 'text-slate-500 italic' : 'text-slate-200'}`}>
                                                {comment}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="px-4 py-3 border-t border-slate-800 bg-surface-darker/55 flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-slate-500">Primer check-out: <span className="text-slate-300 tabular-nums">{closurePhase7.firstAt ? fmtExactDateTime(closurePhase7.firstAt) : '--'}</span></span>
                            <span className="text-slate-500">Cierre total: <span className="text-slate-300 tabular-nums">{closurePhase7.endAt ? fmtExactDateTime(closurePhase7.endAt) : '--'}</span></span>
                        </div>
                    </div>
                </section>
            </main>

            {/* ═══ CONN STATUS ═══ */}
            {showConnBanner && conn !== 'connected' && (
                <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg
                    ${conn === 'disconnected' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                    <div className={`size-2 rounded-full ${conn === 'disconnected' ? 'bg-white' : 'bg-white animate-pulse'}`} />
                    {conn === 'disconnected' ? 'Sin conexión' : 'Reconectando…'}
                </div>
            )}

            <EvidenceViewerModal
                isOpen={Boolean(activeEvidence)}
                evidence={activeEvidence}
                onClose={closeEvidenceViewer}
            />
        </div>
    );
}
