'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { PREP_CHECKLISTS, getGroupedItems } from '@/config/prepChecklistConfig';
import { AUX_LOAD_GROUPS, TEACHER_TEAM_CHECK_TYPES, PILOT_PREP_BLOCKS, PILOT_BLOCK_CHECK_MAP } from '@/config/operationalChecklists';
import {
    buildFlightSnapshotMap,
    buildSchoolMapById,
    formatDateAndTime,
    missionDateTimeFromClosure,
    resolveHistorySchoolName,
} from '@/utils/missionHistory';

/* ═══════════════ CONSTANTS ═══════════════ */
const ROLE_ORDER = ['pilot', 'teacher', 'assistant'];
const ACTIVE_MS = 5 * 60 * 1000;

const ROLE_META = {
    pilot: { label: 'Piloto', icon: 'flight' },
    teacher: { label: 'Docente', icon: 'school' },
    assistant: { label: 'Auxiliar', icon: 'support_agent' },
};

const PHASES = [
    { id: 'prep', label: 'Preparación', states: ['prep', 'PILOT_PREP', 'MISSION_BRIEF', 'CHECKIN_DONE', 'PREP_DONE', 'AUX_PREP_DONE', 'TEACHER_SUPPORTING_PILOT', 'PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK', 'AUX_CONTAINERS_DONE', 'ROUTE_READY'] },
    { id: 'route', label: 'En Ruta', states: ['ROUTE_IN_PROGRESS', 'IN_ROUTE'] },
    { id: 'operation', label: 'Operación', states: ['ARRIVAL_PHOTO_DONE', 'waiting_unload_assignment', 'waiting_dropzone', 'unload', 'post_unload_coordination', 'seat_deployment', 'OPERATION', 'PILOT_OPERATION'] },
    { id: 'closure', label: 'Cierre', states: ['SHUTDOWN', 'POST_MISSION_REPORT', 'CLOSURE', 'report', 'closed'] },
];

const AUX_LOAD = AUX_LOAD_GROUPS[0] || { items: [], photos: [] };

/* ═══════════════ LABEL MAP ═══════════════ */
const LABEL_MAP = (() => {
    const m = {};
    Object.values(PREP_CHECKLISTS).forEach(cfg => (cfg.items || []).forEach(it => { m[it.id] = it.label; }));
    (AUX_LOAD.items || []).forEach(it => { m[it.id] = it.label; });
    (AUX_LOAD.photos || []).forEach(it => { m[it.id] = it.label; });
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

function safeSchoolName(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
        pilot: { emoji: '📋', title: 'En preparación', desc: 'Revisando checklist de vuelo y equipo.', next: 'Verificación de vehículo' },
        teacher: { emoji: '📋', title: 'En preparación', desc: 'Completando checklist docente y verificación de equipo.', next: 'Confirmación de misión' },
        assistant: { emoji: '📋', title: 'En preparación', desc: 'Revisando checklist de preparación general.', next: 'Preparación de vehículo' },
    },
    PILOT_PREP: {
        pilot: { emoji: '🧭', title: 'Preparación de vuelo', desc: 'Reconocimiento del entorno, vuelo de prueba y ruta óptima.', next: 'Listo para carga' },
        teacher: { emoji: '📋', title: 'En preparación', desc: 'Completando tareas de preparación.', next: 'Apoyo al piloto' },
        assistant: { emoji: '📋', title: 'En preparación', desc: 'Revisando equipo de preparación.', next: 'Checklist de vehículo' },
    },
    CHECKIN_DONE: {
        pilot: { emoji: '✅', title: 'Check-in completado', desc: 'Identidad verificada. Iniciando checklist de preparación.', next: 'Preparación de vuelo' },
        teacher: { emoji: '✅', title: 'Check-in completado', desc: 'Identidad verificada. Iniciando checklist docente.', next: 'Checklist docente' },
        assistant: { emoji: '✅', title: 'Check-in completado', desc: 'Identidad verificada. Iniciando preparación.', next: 'Checklist de vehículo' },
    },
    PREP_DONE: {
        pilot: { emoji: '🎯', title: 'Preparación lista', desc: 'Checklist completado. Esperando confirmación del equipo.', next: 'Carga de vehículo' },
        teacher: { emoji: '🎯', title: 'Preparación lista', desc: 'Checklist completado. Apoyando al piloto en bodega.', next: 'Apoyo al piloto' },
        assistant: { emoji: '🎯', title: 'Preparación lista', desc: 'Checklist completado. Esperando siguiente fase.', next: 'Checklist de vehículo' },
    },
    AUX_PREP_DONE: {
        pilot: { emoji: '🎯', title: 'Preparación lista', desc: 'Esperando al equipo para iniciar carga.', next: 'Carga de vehículo' },
        teacher: { emoji: '🤝', title: 'Apoyando al piloto', desc: 'Asistiendo al piloto con la verificación final.', next: 'Confirmación de salida' },
        assistant: { emoji: '🎯', title: 'Preparación lista', desc: 'Checklist del auxiliar completado.', next: 'Checklist de vehículo' },
    },
    TEACHER_SUPPORTING_PILOT: {
        pilot: { emoji: '🧭', title: 'Preparación de vuelo', desc: 'Reconocimiento del entorno, vuelo de prueba y ruta óptima.', next: 'Listo para carga' },
        teacher: { emoji: '🤝', title: 'Apoyando al piloto', desc: 'Asistiendo al piloto con la verificación final en bodega.', next: 'Momento de cargar' },
        assistant: { emoji: '📋', title: 'En preparación', desc: 'Esperando indicación del piloto.', next: 'Checklist de vehículo' },
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
        pilot: { emoji: '📸', title: '{name} confirma pista', desc: 'Está fijando el punto final de despegue con referencia visual.', next: 'Preparación de vuelo' },
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
        'Preparación de vuelo',
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

function buildInactiveRoleRoadmap(role) {
    const iconByLabel = {
        'Identificar pista': 'location_on',
        'Preparación de vuelo': 'flight_takeoff',
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

function buildTeacherTaskFlow(missionState, meta = {}, postArrivalEnabled, context = {}) {
    if (!postArrivalEnabled) return buildInactiveRoleRoadmap('teacher');

    const timeline = [];
    const nowMs = Number.isFinite(context.nowMs) ? context.nowMs : Date.now();
    const assistantName = context.assistantName || 'Auxiliar';
    const teacherDecision = meta.teacher_civic_decision || (meta.teacher_civic_notified === true ? 'yes' : null);
    const teacherHasCivic = teacherDecision === 'yes';
    const missionInOperation = OPERATION_STATES.includes(missionState) || CLOSURE_STATES.includes(missionState);

    const seatDeploymentDone =
        meta.global_seat_deployment_done === true ||
        missionInOperation;
    const headphonesDone =
        meta.global_headphones_done === true ||
        missionInOperation;
    const glassesDone =
        meta.global_glasses_done === true ||
        missionInOperation;

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

    const showTeamUnload = UNLOAD_AND_AFTER_STATES.includes(missionState);
    if (showTeamUnload) {
        timeline.push({
            id: 'teacher-global-unload',
            kind: 'global',
            globalId: 'team_unload',
            label: 'Descarga de equipo',
            icon: 'inventory_2',
            desc: missionState === 'unload'
                ? 'Coordina y participa en la descarga de equipo.'
                : 'Descarga global completada con el equipo.',
            status: taskStatus(missionState !== 'unload', missionState === 'unload')
        });
    }

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

    const civicAudioDone = teacherAudioStatus === 'uploaded';
    const civicAudioApplicable = teacherHasCivic && SEAT_AND_AFTER_STATES.includes(missionState);
    const civicAudioActive = civicAudioApplicable && !civicAudioDone && (
        missionState === 'seat_deployment' ||
        civicParallelInProgress ||
        ['recording', 'pending_upload', 'uploading'].includes(teacherAudioStatus) ||
        Boolean(meta.civic_parallel_teacher_audio_started_at)
    );
    const civicAudioVisible = civicAudioApplicable && (
        civicAudioActive ||
        civicAudioDone ||
        teacherAudioStatus === 'failed' ||
        Boolean(meta.civic_parallel_teacher_audio_started_at) ||
        Boolean(meta.civic_parallel_teacher_audio_url)
    );

    if (civicAudioVisible) {
        let civicAudioLabel = 'Acto civico - evidencia de audio';
        let civicAudioDesc = 'Pendiente grabar evidencia de audio del acto civico.';

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
    }

    const showSeatDeployment = Boolean(meta.teacher_civic_notified) && SEAT_AND_AFTER_STATES.includes(missionState);
    const civicAudioBlocksFlow = civicAudioVisible && !civicAudioDone && teacherAudioStatus !== 'failed';
    if (showSeatDeployment) {
        const seatActive =
            missionState === 'seat_deployment' &&
            !civicAudioBlocksFlow &&
            !seatDeploymentDone;
        const seatDesc = seatDeploymentDone
            ? 'Despliegue de asientos completado con el equipo.'
            : seatActive
                ? 'Ejecuta despliegue de asientos para liberar operacion.'
                : civicAudioBlocksFlow
                    ? 'En espera de cerrar evidencia de acto civico.'
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
        const headphonesDoneBy = meta.global_headphones_done_by_name || null;
        const headphonesDesc = headphonesDone
            ? `Audifonos configurados${headphonesDoneBy ? ` por ${headphonesDoneBy}` : ''}.`
            : headphonesActive
                ? `Checklist colaborativo en curso (${headphonesProgress.done}/${headphonesProgress.total} confirmados).`
                : 'Se habilita al terminar despliegue de asientos.';

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
        const glassesDoneBy = meta.global_glasses_done_by_name || null;
        const glassesDesc = glassesDone
            ? `Gafas configuradas${glassesDoneBy ? ` por ${glassesDoneBy}` : ''}.`
            : glassesActive
                ? `Checklist colaborativo en curso (${glassesProgress.done}/${glassesProgress.total} confirmados).`
                : 'Se habilita al terminar configuracion de audifonos.';

        timeline.push({
            id: 'teacher-global-glasses',
            kind: 'global',
            globalId: 'glasses_setup',
            label: 'Configuracion de gafas',
            icon: 'view_in_ar',
            desc: glassesDesc,
            status: taskStatus(glassesDone, glassesActive)
        });
    }

    const teacherReadyChecks =
        meta && typeof meta.teacher_operation_ready_checks === 'object' && !Array.isArray(meta.teacher_operation_ready_checks)
            ? meta.teacher_operation_ready_checks
            : Object.create(null);
    const kickoffWindow = SEAT_AND_AFTER_STATES.includes(missionState);
    const kickoffUnlocked = glassesDone;
    const batchesReadyDone = teacherReadyChecks.batches_ready === true || missionInOperation;
    const waitingZoneReadyDone = teacherReadyChecks.waiting_zone_ready === true || missionInOperation;
    const teacherReadyDone = meta.teacher_operation_ready === true || missionInOperation;

    if (kickoffWindow) {
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
    }

    return timeline;
}

function buildAssistantTaskFlow(missionState, meta = {}, postArrivalEnabled, context = {}) {
    if (!postArrivalEnabled) return buildInactiveRoleRoadmap('assistant');

    const timeline = [];
    const nowMs = Number.isFinite(context.nowMs) ? context.nowMs : Date.now();
    const teacherName = context.teacherName || 'Docente';
    const missionInOperation = OPERATION_STATES.includes(missionState) || CLOSURE_STATES.includes(missionState);
    const auxReady = Boolean(meta.aux_ready_seat_deployment);
    const parkingEvidence = Boolean(meta.aux_vehicle_evidence_url);
    const adWallEvidence = Boolean(meta.aux_ad_wall_evidence_url);
    const adWallDone =
        meta.aux_ad_wall_done === true ||
        missionInOperation;
    const seatDeploymentDone =
        meta.global_seat_deployment_done === true ||
        missionInOperation;
    const headphonesDone =
        meta.global_headphones_done === true ||
        missionInOperation;
    const glassesDone =
        meta.global_glasses_done === true ||
        missionInOperation;

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

    const showTeamUnload = UNLOAD_AND_AFTER_STATES.includes(missionState);
    if (showTeamUnload) {
        timeline.push({
            id: 'assistant-global-unload',
            kind: 'global',
            globalId: 'team_unload',
            label: 'Descarga de equipo',
            icon: 'inventory_2',
            desc: missionState === 'unload'
                ? 'Participa en descarga de equipo y contenedores.'
                : 'Descarga global completada con el equipo.',
            status: taskStatus(missionState !== 'unload', missionState === 'unload')
        });
    }

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
    const assistantCivicDone = assistantCivicStatus === 'uploaded';
    const assistantCivicApplicable = teacherHasCivic && SEAT_AND_AFTER_STATES.includes(missionState);
    const assistantCivicActive = assistantCivicApplicable && !assistantCivicDone && (
        civicParallelInProgress
        || ['pending_recording', 'recording', 'pending_upload', 'uploading', 'failed'].includes(assistantCivicStatus)
        || Boolean(meta.civic_parallel_aux_started_at)
    );
    const assistantCivicVisible = assistantCivicApplicable && (
        assistantCivicActive
        || assistantCivicDone
        || Boolean(meta.civic_parallel_aux_video_url)
        || Boolean(meta.civic_parallel_aux_started_at)
    );

    if (assistantCivicVisible) {
        let videoElapsedSec = Math.max(0, Number(meta.civic_parallel_aux_duration_sec) || 0);
        if (assistantCivicStatus === 'recording' && meta.civic_parallel_aux_started_at) {
            const startedAtMs = new Date(meta.civic_parallel_aux_started_at).getTime();
            if (Number.isFinite(startedAtMs) && startedAtMs > 0) {
                videoElapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
            }
        }

        let civicVideoLabel = 'Evidencia de acto civico';
        let civicVideoDesc = `Espera a que ${teacherName} empiece a hablar y comienza a grabar (1-2 min).`;

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
    }

    const showSeatDeployment = auxReady && SEAT_AND_AFTER_STATES.includes(missionState);
    if (showSeatDeployment) {
        const seatActive =
            missionState === 'seat_deployment' &&
            adWallDone &&
            (!assistantCivicVisible || assistantCivicDone) &&
            !seatDeploymentDone;
        const seatDesc = seatDeploymentDone
            ? 'Despliegue de asientos completado con el equipo.'
            : !adWallDone
                ? 'Completa primero la instalacion de la lona publicitaria.'
                : seatActive
                ? 'Participa en despliegue de asientos para liberar operacion.'
                : 'En evidencia de acto civico antes de liberar operacion.';
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
        const headphonesDoneBy = meta.global_headphones_done_by_name || null;
        const headphonesDesc = headphonesDone
            ? `Audifonos configurados${headphonesDoneBy ? ` por ${headphonesDoneBy}` : ''}.`
            : headphonesActive
                ? `Checklist colaborativo en curso (${headphonesProgress.done}/${headphonesProgress.total} confirmados).`
                : 'Se habilita al terminar despliegue de asientos.';

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
        const glassesDoneBy = meta.global_glasses_done_by_name || null;
        const glassesDesc = glassesDone
            ? `Gafas configuradas${glassesDoneBy ? ` por ${glassesDoneBy}` : ''}.`
            : glassesActive
                ? `Checklist colaborativo en curso (${glassesProgress.done}/${glassesProgress.total} confirmados).`
                : 'Se habilita al terminar configuracion de audifonos.';

        timeline.push({
            id: 'assistant-global-glasses',
            kind: 'global',
            globalId: 'glasses_setup',
            label: 'Configuracion de gafas',
            icon: 'view_in_ar',
            desc: glassesDesc,
            status: taskStatus(glassesDone, glassesActive)
        });
    }

    const kickoffWindow = SEAT_AND_AFTER_STATES.includes(missionState);
    const kickoffUnlocked = glassesDone;
    const standPhotoDone = Boolean(meta.aux_operation_stand_photo_url) || missionInOperation;
    const standPhotoActive = missionState === 'seat_deployment' && kickoffUnlocked && !standPhotoDone;
    const standPhotoDesc = standPhotoDone
        ? 'Foto final del stand registrada.'
        : kickoffUnlocked
            ? 'Toma y guarda la foto final del stand.'
            : 'Se habilita al terminar la configuracion global.';

    if (kickoffWindow) {
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
    }

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
    const missionInOperation = OPERATION_STATES.includes(missionState) || CLOSURE_STATES.includes(missionState);
    const seatDeploymentDone =
        meta.global_seat_deployment_done === true ||
        missionInOperation;
    const headphonesDone =
        meta.global_headphones_done === true ||
        missionInOperation;
    const glassesDone =
        meta.global_glasses_done === true ||
        missionInOperation;

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
            : 'Se habilita al terminar configuracion global de gafas.';

    if (SEAT_AND_AFTER_STATES.includes(missionState)) {
        timeline.push({
            id: 'pilot-music-ambience',
            kind: 'role',
            label: 'Ambientación musical',
            icon: 'music_note',
            desc: musicDesc,
            doneAt: meta.pilot_music_ambience_done_at || null,
            status: taskStatus(musicDone, musicActive)
        });
    }

    const pilotReadyForGlobal =
        audioConfiguredForCurrentSpot;

    if (pilotReadyForGlobal && UNLOAD_AND_AFTER_STATES.includes(missionState)) {
        timeline.push({
            id: 'pilot-global-unload',
            kind: 'global',
            globalId: 'team_unload',
            label: 'Descarga de equipo',
            icon: 'inventory_2',
            desc: missionState === 'unload'
                ? 'Participa en descarga de equipo y contenedores.'
                : 'Descarga global completada con el equipo.',
            status: taskStatus(missionState !== 'unload', missionState === 'unload')
        });
    }

    const pilotSeatWindow = ['post_unload_coordination', ...SEAT_AND_AFTER_STATES];
    if (pilotReadyForGlobal && pilotSeatWindow.includes(missionState)) {
        const seatActive =
            ['post_unload_coordination', 'seat_deployment'].includes(missionState) &&
            !seatDeploymentDone;
        timeline.push({
            id: 'pilot-global-seat',
            kind: 'global',
            globalId: 'seat_deployment',
            label: 'Despliegue de asientos',
            icon: 'event_seat',
            desc: seatActive
                ? 'Participa en despliegue de asientos para liberar operacion.'
                : 'Despliegue de asientos completado con el equipo.',
            status: taskStatus(seatDeploymentDone, seatActive)
        });

        const headphonesProgress = getGlobalHeadphonesProgress(meta);
        const headphonesActive =
            missionState === 'seat_deployment' &&
            seatDeploymentDone &&
            !headphonesDone;
        const headphonesDoneBy = meta.global_headphones_done_by_name || null;
        const headphonesDesc = headphonesDone
            ? `Audifonos configurados${headphonesDoneBy ? ` por ${headphonesDoneBy}` : ''}.`
            : headphonesActive
                ? `Checklist colaborativo en curso (${headphonesProgress.done}/${headphonesProgress.total} confirmados).`
                : 'Se habilita al terminar despliegue de asientos.';

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
            seatDeploymentDone &&
            headphonesDone &&
            !glassesDone;
        const glassesDoneBy = meta.global_glasses_done_by_name || null;
        const glassesDesc = glassesDone
            ? `Gafas configuradas${glassesDoneBy ? ` por ${glassesDoneBy}` : ''}.`
            : glassesActive
                ? `Checklist colaborativo en curso (${glassesProgress.done}/${glassesProgress.total} confirmados).`
                : 'Se habilita al terminar configuracion de audifonos.';

        timeline.push({
            id: 'pilot-global-glasses',
            kind: 'global',
            globalId: 'glasses_setup',
            label: 'Configuracion de gafas',
            icon: 'view_in_ar',
            desc: glassesDesc,
            status: taskStatus(glassesDone, glassesActive)
        });
    }

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
    prep_complete: { emoji: '🎯', label: 'Preparación completada' },
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
        prep: 'Preparación', PILOT_PREP: 'Preparación', MISSION_BRIEF: 'Check-in', CHECKIN_DONE: 'Preparación',
        PREP_DONE: 'Preparación', AUX_PREP_DONE: 'Preparación', TEACHER_SUPPORTING_PILOT: 'Preparación',
        PILOT_READY_FOR_LOAD: 'Preparación', WAITING_AUX_VEHICLE_CHECK: 'Preparación', AUX_CONTAINERS_DONE: 'Preparación',
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
        // Assistant has 2 blocks: vehicle prep + load
        const blocks = roleSummary.blocks || 0;
        const completedBlocks = roleSummary.completedBlocks || 0;
        if (completedBlocks >= 2 || (allDone && isPostLoad)) return { emoji: '✅', text: 'Carga verificada · Listo', color: 'text-emerald-400 bg-emerald-400/10' };
        if (isLoading && completedBlocks >= 1) return { emoji: '🟦', text: 'Carga activa · Verificando contenedores', color: 'text-sky-400 bg-sky-400/10' };
        if (completedBlocks >= 1) return { emoji: '✅', text: 'Vehículo listo · Apoyando en bodega', color: 'text-emerald-400 bg-emerald-400/10' };
        if (inProgress) return { emoji: '🟦', text: 'Checklist en progreso', color: 'text-sky-400 bg-sky-400/10' };
        return null;
    }
    return null;
}

/* ═══ TIMELINE VOICE PLAYER ═══ */
function TimelineVoicePlayer({ url, duration }) {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef(null);
    const toggle = () => {
        if (!audioRef.current) { audioRef.current = new Audio(url); audioRef.current.onended = () => setPlaying(false); }
        if (playing) { audioRef.current.pause(); setPlaying(false); }
        else { audioRef.current.play().then(() => setPlaying(true)).catch(() => { }); }
    };
    const dur = duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '0:00';
    return (
        <button onClick={toggle} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs">
            <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{playing ? 'pause' : 'play_arrow'}</span>
            <span className="text-slate-300 font-medium">Nota de voz · {dur}</span>
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
            const teacherBlock = buildBlock('teacher', 'teacher-main', 'Preparación docente', [
                ...teacherTeamItems,
                { id: 'teacher-mission-confirm', label: 'Confirmación de misión', done: missionConfirmDone, at: missionConfirmAt, reqEvidence: false, evidence: [] },
                { id: 'group_selfie', label: LABEL_MAP.group_selfie || 'Selfie de verificación', done: selfieEv.length > 0, at: selfieEv[0]?.created_at || null, reqEvidence: true, evidence: selfieEv },
            ]);

            /* assistant blocks */
            const aGroups = getGroupedItems('assistant');
            const vehGroup = aGroups.find(g => g.name.toLowerCase().includes('veh')) || aGroups[0] || { name: 'Preparación del vehículo', items: [] };
            const loadGroup = aGroups.find(g => g.name.toLowerCase().includes('carga')) || aGroups[1] || { name: 'Checklist de carga', items: [] };
            const aVehBlock = buildBlock('assistant', 'assistant-veh', vehGroup.name, vehGroup.items.map(mapItem));
            const loadItems = [
                ...loadGroup.items.map(mapItem),
                ...(AUX_LOAD.items || []).map(it => {
                    const st = aux2Check[it.id];
                    return { id: it.id, label: it.label, done: st?.value === true, at: st?.at || null, reqEvidence: false, evidence: [] };
                }),
                ...(AUX_LOAD.photos || []).map(it => {
                    const fromTable = photosByItem[it.id] || [];
                    const fromEvent = aux2Photo[it.id];
                    const merged = [...fromTable];
                    if (fromEvent?.filePath && !merged.some(r => r.file_path === fromEvent.filePath))
                        merged.unshift({ id: `aux2-ph-${it.id}`, file_path: fromEvent.filePath, created_at: fromEvent.at, item_id: it.id });
                    return { id: it.id, label: it.label, done: merged.length > 0 || fromEvent?.done === true, at: merged[0]?.created_at || fromEvent?.at || null, reqEvidence: true, evidence: merged };
                }),
            ];
            const aLoadBlock = buildBlock('assistant', 'assistant-load', loadGroup.name || 'Checklist de carga', loadItems);

            const roleBlocks = { pilot: pilotBlocks, teacher: [teacherBlock], assistant: [aVehBlock, aLoadBlock] };
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
                const isOperationEnded =
                    statusKey === 'report' ||
                    statusKey === 'closed' ||
                    CLOSURE_STATES.includes(j.mission_state);

                if (!isOperationEnded) return 0;

                return toMs(j.updated_at) || toMs(closureMatch?.end_time) || now;
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
            const stateCards = STATE_ROLE_CARDS[j.mission_state] || {};
            const roleCards = ROLE_ORDER.map(role => {
                const card = stateCards[role] || { emoji: '⏳', title: 'En espera', desc: 'Esperando siguiente fase.', next: null };
                const person = rolePeople[role]?.name || ROLE_META[role].label;
                const postArrivalEnabled = arrivalAnchor.confirmed;
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

                const taskFlow = role === 'teacher'
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

                const activeTask = taskFlow.find((task) => task.status === 'active') || null;
                const activeGlobalTask = activeTask?.kind === 'global' ? activeTask : null;

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
            };
        }).filter(m => !m.isClosed).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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
                raw: closure
            };
        });

        rows.sort((a, b) => {
            const bTime = toMs(b.missionDateTime) || toMs(b.endTime) || toMs(b.createdAt) || 0;
            const aTime = toMs(a.missionDateTime) || toMs(a.endTime) || toMs(a.createdAt) || 0;
            return bTime - aTime;
        });

        return rows;
    }, [closures, historySchoolMapById, historyFlightSnapshotMap]);

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

    const fetchHistoryMissionLogs = useCallback(async (missionId) => {
        const missionKey = String(missionId || '').trim();
        if (!missionKey) return;
        if (historyLogsByMission[missionKey] || historyLogsLoadingMission === missionKey) return;

        setHistoryLogsLoadingMission(missionKey);
        try {
            const { data, error } = await supabase
                .from('bitacora_vuelos')
                .select('*')
                .eq('mission_id', missionKey)
                .order('start_time', { ascending: true });

            if (error) throw error;
            setHistoryLogsByMission((prev) => ({
                ...prev,
                [missionKey]: data || []
            }));
        } catch (error) {
            console.error('SV history logs error:', error);
            setHistoryLogsByMission((prev) => ({
                ...prev,
                [missionKey]: []
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
        if (mission.missionId) {
            fetchHistoryMissionLogs(mission.missionId);
        }
    }, [fetchHistoryMissionLogs, selectedHistoryMissionKey]);

    const getHistoryMissionLogs = useCallback((missionId) => {
        const missionKey = String(missionId || '').trim();
        if (!missionKey) return [];
        return historyLogsByMission[missionKey] || [];
    }, [historyLogsByMission]);

    const getHistoryMissionMetrics = useCallback((mission) => {
        const logs = getHistoryMissionLogs(mission?.missionId);
        const totalStaff = logs.reduce((acc, log) => acc + Number(log?.staff_count ?? log?.staffCount ?? 0), 0);
        const totalDurationSec = logs.reduce((acc, log) => acc + Number(log?.duration_seconds ?? log?.durationSeconds ?? 0), 0);
        const totalStudentsFromLogs = logs.reduce((acc, log) => acc + Number(log?.student_count ?? log?.studentCount ?? 0), 0);
        const totalIncidents = logs.reduce((acc, log) => {
            const incidents = Array.isArray(log?.incidents) ? log.incidents : [];
            return acc + incidents.length;
        }, 0);
        const averageDurationSec = logs.length > 0 ? Math.round(totalDurationSec / logs.length) : 0;
        const flightsFromClosure = Number(mission?.totalFlights || 0);
        const studentsFromClosure = Number(mission?.totalStudents || 0);

        return {
            totalFlights: flightsFromClosure > 0 ? flightsFromClosure : logs.length,
            totalStudents: studentsFromClosure > 0 ? studentsFromClosure : totalStudentsFromLogs,
            totalStaff,
            averageDurationSec,
            totalIncidents,
            logs,
        };
    }, [getHistoryMissionLogs]);

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
    const effectiveTab = hasLiveMission ? dashboardTab : 'history';

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
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                                effectiveTab === 'live'
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
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                                effectiveTab === 'history'
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
                                const missionIdKey = String(mission.missionId || '').trim();
                                const loadingMissionLogs = selected && Boolean(missionIdKey) && historyLogsLoadingMission === missionIdKey;

                                return (
                                    <article
                                        key={mission.key}
                                        className={`rounded-2xl border transition-all overflow-hidden ${
                                            selected
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
                                            <div className="px-3 pb-3 border-t border-primary/25 bg-slate-900/35 space-y-3">
                                                <div className="pt-3 grid grid-cols-2 gap-2">
                                                    <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Vuelos</p>
                                                        <p className="text-lg font-black text-white">{missionMetrics.totalFlights}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Alumnos</p>
                                                        <p className="text-lg font-black text-emerald-300">{missionMetrics.totalStudents}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Docentes</p>
                                                        <p className="text-lg font-black text-sky-300">{missionMetrics.totalStaff}</p>
                                                    </div>
                                                    <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">Promedio vuelo</p>
                                                        <p className="text-lg font-black text-amber-300 tabular-nums">{fmtMMSS(missionMetrics.averageDurationSec)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission.checklistVerified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                                        {mission.checklistVerified ? 'Checklist de cierre verificado' : 'Checklist de cierre pendiente'}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission.groupPhotoUrl ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-700/60 text-slate-400'}`}>
                                                        {mission.groupPhotoUrl ? 'Foto grupal: disponible' : 'Foto grupal: no registrada'}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mission.signatureUrl ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-slate-700/60 text-slate-400'}`}>
                                                        {mission.signatureUrl ? 'Firma: disponible' : 'Firma: no registrada'}
                                                    </span>
                                                    {missionMetrics.totalIncidents > 0 && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300">Incidencias: {missionMetrics.totalIncidents}</span>
                                                    )}
                                                </div>

                                                {(mission.groupPhotoUrl || mission.signatureUrl) && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {mission.groupPhotoUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(mission.groupPhotoUrl, '_blank')}
                                                                className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900/50"
                                                            >
                                                                <img src={mission.groupPhotoUrl} alt="Foto grupal" className="h-24 w-full object-cover" />
                                                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white">Foto grupal</span>
                                                            </button>
                                                        )}
                                                        {mission.signatureUrl && (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(mission.signatureUrl, '_blank')}
                                                                className="relative rounded-lg overflow-hidden border border-slate-700 bg-white"
                                                            >
                                                                <img src={mission.signatureUrl} alt="Firma docente" className="h-24 w-full object-contain" />
                                                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white">Firma</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Bitácora de vuelos</p>
                                                    {loadingMissionLogs ? (
                                                        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-3 flex items-center gap-2 text-slate-400 text-xs">
                                                            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                            Cargando vuelos históricos...
                                                        </div>
                                                    ) : missionLogs.length > 0 ? (
                                                        <div className="mt-2 space-y-1.5">
                                                            {missionLogs.slice(0, 18).map((log, idx) => {
                                                                const students = Number(log?.student_count ?? log?.studentCount ?? 0);
                                                                const staff = Number(log?.staff_count ?? log?.staffCount ?? 0);
                                                                const durationSec = Number(log?.duration_seconds ?? log?.durationSeconds ?? 0);
                                                                const incidents = Array.isArray(log?.incidents) ? log.incidents : [];
                                                                const anchorTime = log?.start_time || log?.startTime || log?.created_at;

                                                                return (
                                                                    <div key={log?.id || `${mission.key}-log-${idx}`} className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className="text-xs font-bold text-slate-200">Vuelo #{idx + 1}</p>
                                                                            <p className="text-xs font-black text-emerald-300 tabular-nums">{fmtMMSS(durationSec)}</p>
                                                                        </div>
                                                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                                                                            <span>Hora: {fmtClock(anchorTime)}</span>
                                                                            <span className="text-slate-600">•</span>
                                                                            <span>Alumnos: {students}</span>
                                                                            <span className="text-slate-600">•</span>
                                                                            <span>Docentes: {staff}</span>
                                                                            {incidents.length > 0 && (
                                                                                <>
                                                                                    <span className="text-slate-600">•</span>
                                                                                    <span className="text-rose-300">Incidencias: {incidents.length}</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/35 px-3 py-3 text-xs text-slate-500">
                                                            No hay vuelos guardados para esta misión.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </section>
                </main>

                {showConnBanner && conn !== 'connected' && (
                    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg ${
                        conn === 'disconnected' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'
                    }`}>
                        <div className={`size-2 rounded-full ${conn === 'disconnected' ? 'bg-white' : 'bg-white animate-pulse'}`} />
                        {conn === 'disconnected' ? 'Sin conexión' : 'Reconectando…'}
                    </div>
                )}
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
        </div>
    );

    const strokeDash = 2 * Math.PI * 45; // ~283
    const strokeOffset = strokeDash - (strokeDash * sel.progress) / 100;
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
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                            effectiveTab === 'live'
                                ? 'bg-primary text-white shadow-[0_0_12px_-4px_rgba(19,146,236,0.7)]'
                                : 'text-slate-300 hover:text-white'
                            }`}
                    >
                        Misión actual
                    </button>
                    <button
                        type="button"
                        onClick={() => setDashboardTab('history')}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                            effectiveTab === 'history'
                                ? 'bg-primary text-white shadow-[0_0_12px_-4px_rgba(19,146,236,0.7)]'
                                : 'text-slate-300 hover:text-white'
                            }`}
                    >
                        Historial
                    </button>
                </div>
            </div>

            <main className="flex-1 flex flex-col gap-6 p-4 pb-20">

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
                            <span className="text-4xl font-extrabold text-white">{sel.progress}%</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                            <div className="size-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-primary text-sm font-bold uppercase tracking-wide">{sel.stateText}</span>
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
                            Preparación en base
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
                                    ${noProgress ? 'opacity-50 grayscale-[0.5]' : allDone && !isActive && !(sel.isEnRuta || sel.isPostRoute) ? 'opacity-90' : ''}`}>

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
                                        if (noProgress) {
                                            return (
                                                <div key={block.id} className={`flex items-center justify-between p-4 cursor-not-allowed ${!isLast ? 'border-b border-slate-800' : ''}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-5 rounded-full border-2 border-slate-600 shrink-0" />
                                                        <span className="text-sm font-medium text-slate-500">{block.label}</span>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-400">{block.done}/{block.total}</span>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={block.id} className={!isLast ? 'border-b border-slate-800' : ''}>
                                                <details open={block.inProgress || block.activeNow || undefined} className="group">
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
                                                                            <div key={ev.id || ev.file_path} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700">
                                                                                <img src={ev.file_path} alt={`Evidencia ${item.label}`}
                                                                                    className="w-full h-full object-cover"
                                                                                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                                                                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5">
                                                                                    {fmtClock(ev.created_at)}
                                                                                </div>
                                                                            </div>
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
                                <div className="relative group cursor-pointer" onClick={() => window.open(sel.arrivalPhotoUrl, '_blank')}>
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
                                </div>
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
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
                                    Preparación en sede
                                    {phaseTimers.prepOnsite.started && (
                                        <span className="text-sm font-semibold text-slate-400 tabular-nums">({fmtMMSS(phaseTimers.prepOnsite.seconds)})</span>
                                    )}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">Pantalla actual y participación global por operativo</p>
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
                                const currentTask = card.activeTask || (card.taskFlow || []).find((task) => task.status === 'active') || null;
                                const previewTask = currentTask || (!card.postArrivalEnabled
                                    ? (card.taskFlow || []).find((task) => ['active', 'pending', 'inactive'].includes(task.status))
                                    : null);
                                const flowTasks = card.taskFlow || [];
                                const flowTasksForBlocks = flowTasks.filter((task) => task.countAsBlock !== false);
                                const flowCompleted = flowTasksForBlocks.filter((task) => task.status === 'completed').length;
                                const flowTotal = flowTasksForBlocks.length;
                                const globalTasks = flowTasks.filter((task) => task.kind === 'global');
                                const globalCompleted = globalTasks.filter((task) => task.status === 'completed').length;
                                const globalTotal = globalTasks.length;
                                const civicAudioTask = flowTasks.find((task) => task.id === 'teacher-civic-audio' && Boolean(task.audioUrl)) || null;
                                const civicVideoTask = flowTasks.find((task) => task.id === 'assistant-civic-video' && Boolean(task.videoUrl)) || null;
                                const prepTotal = card.prepProgress ? 5 : 0;
                                const prepDone = card.prepProgress
                                    ? (card.prepProgress.spot.confirmed ? 1 : 0) + card.prepProgress.done + (card.prepProgress.controllerConnected ? 1 : 0)
                                    : 0;
                                const completedTotal = prepDone + flowCompleted;
                                const plannedTotal = prepTotal + flowTotal;
                                const progressPct = plannedTotal > 0 ? Math.round((completedTotal / plannedTotal) * 100) : 0;
                                const flowProgressPct = flowTotal > 0 ? Math.round((flowCompleted / flowTotal) * 100) : 0;
                                const completedLabel = plannedTotal > 0 ? `${completedTotal}/${plannedTotal} completadas` : 'Sin tareas';
                                const taskActive = previewTask?.status === 'active';
                                const cardCompleted = card.postArrivalEnabled && plannedTotal > 0 && completedTotal >= plannedTotal;
                                const taskDone = previewTask?.status === 'completed' || (!taskActive && cardCompleted);
                                const summaryTitle = previewTask?.label
                                    || (card.postArrivalEnabled
                                        ? (cardCompleted ? 'Bloques completados' : card.title)
                                        : card.preArrivalTitle || card.title);
                                const summaryDesc = previewTask?.desc
                                    || (card.postArrivalEnabled
                                        ? (cardCompleted ? 'Flujo operativo completado para este rol.' : card.desc)
                                        : card.preArrivalDesc || card.desc);
                                const summaryIsGlobal = previewTask?.kind === 'global';
                                const summaryIsCivic = previewTask?.accent === 'emerald';
                                const civicAudioEvidence = flowTasks.some((task) => task.id === 'teacher-civic-audio' && Boolean(task.audioUrl)) ? 1 : 0;
                                const civicVideoEvidence = flowTasks.some((task) => task.id === 'assistant-civic-video' && Boolean(task.videoUrl)) ? 1 : 0;
                                const standPhotoEvidence = flowTasks.some((task) => task.id === 'assistant-stand-photo' && Boolean(task.photoUrl)) ? 1 : 0;
                                const evidenceCount = (card.prepProgress?.spot?.photoUrl ? 1 : 0)
                                    + (card.parkingProgress?.hasPhoto ? 1 : 0)
                                    + (card.adWallProgress?.hasPhoto ? 1 : 0)
                                    + (card.data?.voiceUrl ? 1 : 0)
                                    + civicAudioEvidence
                                    + civicVideoEvidence
                                    + standPhotoEvidence;
                                const currentTaskIcon = previewTask?.icon || cardTitleIcon(card);
                                const currentTaskDesc = summaryDesc || card.desc;
                                const statusChipText = !card.postArrivalEnabled
                                    ? 'Pendiente de activacion'
                                    : previewTask?.id === 'teacher-civic-audio' && taskActive
                                        ? 'Acto civico · Audio en curso'
                                        : previewTask?.id === 'assistant-civic-video' && taskActive
                                            ? 'Acto civico · Video en curso'
                                            : taskActive && summaryIsGlobal
                                                ? 'Coordinacion global en curso'
                                            : taskActive
                                                    ? 'Accion operativa en curso'
                                                : cardCompleted
                                                    ? 'Bloques completados'
                                                : taskDone
                                                    ? 'Ultima accion completada'
                                                    : 'Siguiente accion pendiente';
                                const statusChipTone = !card.postArrivalEnabled
                                    ? 'bg-slate-700/55 text-slate-300'
                                    : taskActive
                                            ? summaryIsCivic
                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                : 'bg-sky-500/15 text-sky-300'
                                        : taskDone
                                            ? 'bg-emerald-500/15 text-emerald-300'
                                            : 'bg-slate-700/55 text-slate-300';
                                const statusDotTone = !card.postArrivalEnabled
                                    ? 'bg-slate-500'
                                    : taskDone
                                        ? 'bg-emerald-400'
                                    : taskActive
                                            ? summaryIsCivic
                                                ? 'bg-emerald-400 animate-pulse'
                                                : 'bg-sky-400 animate-pulse'
                                            : 'bg-slate-500';
                                const blocksLabel = plannedTotal > 0 ? `${completedTotal}/${plannedTotal} Bloques` : 'Sin bloques';
                                const blocksTone = cardCompleted
                                    ? 'bg-emerald-500/12 text-emerald-300'
                                    : taskActive
                                        ? 'bg-primary/12 text-primary'
                                        : 'bg-slate-700/55 text-slate-300';
                                const summaryTitleTone = taskDone
                                    ? 'text-emerald-300'
                                    : summaryIsCivic
                                        ? 'text-emerald-300'
                                    : taskActive
                                        ? 'text-slate-100'
                                        : 'text-slate-300';
                                const summaryDescTone = taskDone
                                    ? 'text-emerald-300/65'
                                    : summaryIsCivic
                                        ? 'text-emerald-300/75'
                                    : taskActive
                                        ? 'text-slate-400'
                                        : 'text-slate-500';
                                const summaryDotTone = taskDone
                                    ? 'bg-emerald-500'
                                    : summaryIsCivic
                                        ? 'bg-emerald-500 animate-pulse'
                                    : taskActive
                                        ? 'bg-sky-500 animate-pulse'
                                        : 'bg-slate-700';
                                const cardNoProgress = completedTotal === 0;
                                const cardActive = !isInactive && taskActive;
                                const cardContainerTone = isInactive
                                    ? 'bg-slate-900/45 border-slate-700/70 opacity-70 grayscale-[0.2]'
                                    : cardActive
                                        ? 'bg-surface-dark border-primary/50 shadow-[0_0_15px_-3px_rgba(19,146,236,0.15)] ring-1 ring-primary/20'
                                        : 'bg-surface-dark border-slate-800';
                                const cardCompletedTone = !isInactive && cardCompleted && !cardActive ? 'opacity-90' : '';
                                const roleIconTone = cardActive
                                    ? 'text-primary animate-pulse'
                                    : cardCompleted
                                        ? 'text-emerald-500'
                                        : 'text-slate-400';
                                const roleTitleTone = cardNoProgress || isInactive ? 'text-slate-400' : 'text-white';
                                const rolePersonTone = isInactive
                                    ? 'text-slate-600'
                                    : cardCompleted
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

                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${statusChipTone}`}>
                                                    <span className={`size-1.5 rounded-full ${statusDotTone}`} />
                                                    {statusChipText}
                                                </span>
                                                <span className={`ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold ${blocksTone}`}>
                                                    {blocksLabel}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Main content */}
                                        {card.postArrivalEnabled && (
                                            <div className="px-4 pb-3">
                                                <div className="mt-3 rounded-xl border border-slate-800 bg-surface-darker/55 px-3 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`size-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${summaryDotTone}`}>
                                                            {taskDone ? (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[13px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>{currentTaskIcon}</span>
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-[15px] font-bold leading-tight ${summaryTitleTone}`}>{summaryTitle}</span>
                                                                {summaryIsGlobal && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-sky-500/20 text-sky-200">Global</span>
                                                                )}
                                                                {previewTask?.status === 'active' && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-primary/20 text-primary">Ahora</span>
                                                                )}
                                                            </div>
                                                            <p className={`text-[12px] leading-snug mt-1 ${summaryDescTone}`}>{currentTaskDesc}</p>
                                                        </div>

                                                        <span className={`text-[11px] font-bold ${progressPct >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>{progressPct}%</span>
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-700/70 text-slate-300">{completedLabel}</span>
                                                        {summaryIsGlobal && globalTotal > 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/15 text-sky-300">Global {globalCompleted}/{globalTotal}</span>
                                                        ) : evidenceCount > 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300">{evidenceCount} evidencias</span>
                                                        ) : null}
                                                    </div>

                                                    <div className="mt-1.5 h-1 rounded-full bg-slate-700/80 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-emerald-400' : 'bg-primary'}`}
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>

                                                    {isCollapsed && card.role === 'teacher' && civicAudioTask && (
                                                        <div className="mt-2">
                                                            <TimelineVoicePlayer url={civicAudioTask.audioUrl} duration={civicAudioTask.audioDurationSec} />
                                                        </div>
                                                    )}
                                                    {isCollapsed && card.role === 'assistant' && civicVideoTask && (
                                                        <div className="mt-2">
                                                            <button
                                                                onClick={() => window.open(civicVideoTask.videoUrl, '_blank')}
                                                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs"
                                                            >
                                                                <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>videocam</span>
                                                                <span className="text-slate-300 font-medium">Evidencia video</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {!isCollapsed && (card.prepProgress ? (
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
                                                                <div className="mt-1.5 relative group cursor-pointer inline-block" onClick={() => window.open(card.prepProgress.spot.photoUrl, '_blank')}>
                                                                    <img src={card.prepProgress.spot.photoUrl} alt="Foto de pista" className="w-28 h-20 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white font-bold inline-flex items-center gap-1">
                                                                        <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                        Pista
                                                                    </div>
                                                                </div>
                                                            ) : card.prepProgress.spot.confirmed ? (
                                                                <p className="text-[10px] text-slate-600 mt-1">Foto de pista: no enviada</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    {/* ── Separador visual ── */}
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="flex-1 h-px bg-slate-700/60" />
                                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Preparación de vuelo</span>
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
                                                                            <TimelineVoicePlayer url={task.audioUrl} duration={task.audioDurationSec} />
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
                                                                                onClick={() => window.open(task.videoUrl, '_blank')}
                                                                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs"
                                                                            >
                                                                                <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                                                                                <span className="text-slate-300 font-medium">Ver evidencia de video</span>
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {task.id === 'assistant-parking' && done && card.parkingProgress?.parkedAt && (
                                                                        <p className="text-[10px] text-slate-600 mt-0.5">a las {fmtClock(card.parkingProgress.parkedAt)}</p>
                                                                    )}

                                                                    {task.id === 'assistant-parking' && card.parkingProgress?.hasPhoto && (
                                                                        <div className="mt-2 flex items-start gap-2">
                                                                            <div className="relative group cursor-pointer flex-shrink-0" onClick={() => window.open(card.parkingProgress.photoUrl, '_blank')}>
                                                                                <img src={card.parkingProgress.photoUrl} alt="Evidencia vehículo" className="w-24 h-16 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                                <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold inline-flex items-center">
                                                                                    <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                                </div>
                                                                            </div>
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
                                                                            <div className="relative group cursor-pointer flex-shrink-0" onClick={() => window.open(card.adWallProgress.photoUrl, '_blank')}>
                                                                                <img src={card.adWallProgress.photoUrl} alt="Evidencia lona publicitaria" className="w-24 h-16 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                                <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold inline-flex items-center">
                                                                                    <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                                </div>
                                                                            </div>
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
                                                                            <div className="relative group cursor-pointer flex-shrink-0" onClick={() => window.open(task.photoUrl, '_blank')}>
                                                                                <img src={task.photoUrl} alt="Foto final del stand" className="w-24 h-16 object-cover rounded-lg border border-emerald-500/30 group-hover:scale-105 transition-transform" />
                                                                                <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold inline-flex items-center">
                                                                                    <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                                                                                </div>
                                                                            </div>
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

                                        {!card.postArrivalEnabled && (
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
                                        {!card.postArrivalEnabled && !isCollapsed && card.taskFlow?.length > 0 && (
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

                                                                <span className={`text-[12px] ${
                                                                    isInactive
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
                                                    <TimelineVoicePlayer url={card.data.voiceUrl} duration={card.data.voiceDuration} />
                                                )}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        {card.postArrivalEnabled && (
                                            <div className="px-4 py-2.5 border-t border-slate-800 bg-surface-darker/55 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-600">
                                                    Actualizado {fmtAgo(card.updatedAt, now)}
                                                </span>
                                                {!isCollapsed && card.next && (
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

                {/* Tareas globales integradas dentro de cada tarjeta por rol */}

                {/* ═══ FUTURE SECTIONS ═══ */}
                {sel.phaseIndex < 2 && (
                    <section className="opacity-30 grayscale pointer-events-none">
                        {[{ icon: 'cast_for_education', title: 'Operación Educativa', sub: 'Sesiones con alumnos' },
                        { icon: 'flag', title: 'Cierre de Misión', sub: 'Check-out y reporte final' }].map(card => (
                            <div key={card.title} className="bg-surface-dark rounded-xl p-4 border border-dashed border-slate-700 shadow-none mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                                        <span className="material-symbols-outlined">{card.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-400">{card.title}</h3>
                                        <p className="text-xs text-slate-500">{card.sub}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </main>

            {/* ═══ CONN STATUS ═══ */}
            {showConnBanner && conn !== 'connected' && (
                <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg
                    ${conn === 'disconnected' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                    <div className={`size-2 rounded-full ${conn === 'disconnected' ? 'bg-white' : 'bg-white animate-pulse'}`} />
                    {conn === 'disconnected' ? 'Sin conexión' : 'Reconectando…'}
                </div>
            )}
        </div>
    );
}
