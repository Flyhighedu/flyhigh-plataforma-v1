// =====================================================
// Dependency Transition Copy Mapping
// Maps mission_state transitions to human-readable copy
// for the DependencyTransitionOverlay.
//
// Important:
// - Only returns copy for EXTERNAL dependency transitions
// - Filters out self-initiated transitions by role
// =====================================================

const RESET_STATES = new Set(['prep', 'PILOT_PREP']);

const STAFF_ROLE_LABELS = {
    pilot: 'Piloto',
    teacher: 'Docente',
    assistant: 'Auxiliar'
};

function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'auxiliar' || value === 'aux') return 'assistant';
    return value;
}

function firstNameOrFallback(fullName, fallback) {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

function buildStaffDirectory(staffNames) {
    return {
        pilot: firstNameOrFallback(staffNames.pilot_name, 'Piloto'),
        teacher: firstNameOrFallback(staffNames.teacher_name, 'Docente'),
        assistant: firstNameOrFallback(staffNames.aux_name, 'Auxiliar')
    };
}

const TRANSITION_RULES = [
    {
        id: 'pilot-prep-complete',
        nextStates: ['PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK'],
        actorRole: 'pilot',
        actionText: 'termino su preparacion.',
        nextPhaseText: 'Momento de cargar'
    },
    {
        id: 'aux-load-complete',
        nextStates: ['AUX_CONTAINERS_DONE'],
        actorRole: 'assistant',
        actionText: 'termino la carga del vehiculo.',
        nextPhaseText: 'Iniciar ruta'
    },
    {
        id: 'aux-route-started',
        nextStates: ['IN_ROUTE', 'ROUTE_IN_PROGRESS', 'ROUTE_READY'],
        prevStates: ['AUX_CONTAINERS_DONE', 'PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK', 'ROUTE_READY'],
        actorRole: 'assistant',
        actionText: 'inicio la ruta.',
        nextPhaseText: 'En ruta'
    },
    {
        id: 'teacher-arrival-photo',
        nextStates: ['waiting_unload_assignment'],
        prevStates: ['IN_ROUTE', 'ROUTE_IN_PROGRESS', 'ROUTE_READY'],
        actorRole: 'teacher',
        actionText: 'confirmo la llegada (foto registrada).',
        nextPhaseText: 'Asignacion de descarga',
        hasEvidence: true
    },
    {
        id: 'teacher-dropzone-assignment',
        nextStates: ['waiting_dropzone'],
        prevStates: ['waiting_unload_assignment', 'IN_ROUTE', 'ROUTE_IN_PROGRESS'],
        actorRole: 'teacher',
        actionText: 'indico el punto de descarga.',
        nextPhaseText: 'Acomodar vehiculo'
    },
    {
        id: 'aux-vehicle-positioned',
        nextStates: ['unload'],
        prevStates: ['waiting_dropzone'],
        actorRole: 'assistant',
        actionText: 'acomodo el vehiculo en zona de descarga.',
        nextPhaseText: 'Descarga'
    },
    {
        id: 'aux-unload-confirmed',
        nextStates: ['seat_deployment'],
        prevStates: ['unload'],
        actorRole: 'assistant',
        actionText: 'confirmo la descarga del vehiculo.',
        nextPhaseText: 'Logistica final'
    }
];

/**
 * Build transition copy from a state change.
 * @param {string} newState - The new mission_state
 * @param {string} prevState - The previous mission_state
 * @param {string} userRole - Current user's role ('pilot'|'teacher'|'assistant')
 * @param {Object} staffNames - { pilot_name, teacher_name, aux_name }
 * @returns {Object|null} - Transition data or null if no overlay should show
 */
export function getTransitionCopy(newState, prevState, userRole, staffNames = {}) {
    const next = String(newState || '').trim();
    const prev = String(prevState || '').trim();
    const receiverRole = normalizeRole(userRole);

    if (!next) return null;
    if (RESET_STATES.has(next)) return null;
    if (next === prev) return null;

    const staff = buildStaffDirectory(staffNames);

    const rule = TRANSITION_RULES.find((entry) => {
        const nextMatches = entry.nextStates.includes(next);
        if (!nextMatches) return false;

        if (!entry.prevStates || entry.prevStates.length === 0) {
            return true;
        }

        return entry.prevStates.includes(prev);
    });

    if (!rule) return null;

    // External-only: do not show when user is the one who pressed CTA.
    if (rule.actorRole && normalizeRole(rule.actorRole) === receiverRole) {
        return null;
    }

    const actorRole = normalizeRole(rule.actorRole);
    const triggerRole = STAFF_ROLE_LABELS[actorRole] || 'Equipo';
    const triggerName = staff[actorRole] || triggerRole;

    return {
        triggerName,
        triggerRole,
        actionText: rule.actionText,
        nextPhaseText: rule.nextPhaseText,
        hasEvidence: Boolean(rule.hasEvidence),
        transitionKey: `${rule.id}:${prev}->${next}`
    };
}
