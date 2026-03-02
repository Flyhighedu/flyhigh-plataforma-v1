// =====================================================
// Dependency Transition Copy Mapping
// Maps mission_state transitions to human-readable copy
// for the DependencyTransitionOverlay.
//
// Important:
// - Only returns copy for EXTERNAL dependency transitions
// - Filters out self-initiated transitions by role
// =====================================================

import {
    DISMANTLING_ROUTE_IDS,
    DISMANTLING_SCREEN_LABELS,
    getDismantlingFlags,
    normalizeDismantlingRole,
    resolveDismantlingRoute
} from './dismantlingRouting.js';

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

const CLOSURE_FLAG_PRIORITY = [
    {
        key: 'globalEquipmentLoaded',
        actorRole: 'assistant',
        completedTask: 'Carga global',
        doneByKeys: ['global_equipment_loaded_by', 'global_container_loading_done_by']
    },
    {
        key: 'auxArrivalNotified',
        actorRole: 'teacher',
        completedTask: 'Notificacion de llegada a base',
        doneByKeys: ['aux_arrival_notified_by', 'closure_arrival_notification_done_by', 'arrival_notified_by']
    },
    {
        key: 'globalEquipmentUnloaded',
        actorRole: null,
        completedTask: 'Descarga de equipo',
        doneByKeys: ['global_equipment_unloaded_by', 'closure_equipment_unload_done_by'],
        roleAgnostic: true
    },
    {
        key: 'pilotReturnInventoryDone',
        actorRole: 'pilot',
        completedTask: 'Inventario de Retorno',
        doneByKeys: ['pilot_return_inventory_done_by', 'closure_return_inventory_done_by']
    },
    {
        key: 'pilotElectronicsCharged',
        actorRole: 'pilot',
        completedTask: 'Estacion de Carga',
        doneByKeys: ['pilot_electronics_charged_by', 'closure_electronics_charging_done_by']
    },
    {
        key: 'auxRecordingCharged',
        actorRole: 'assistant',
        completedTask: 'Carga de Audiovisuales',
        doneByKeys: ['aux_recording_charging_done_by', 'closure_recording_charging_done_by']
    },
    {
        key: 'auxKeyDropDone',
        actorRole: 'assistant',
        completedTask: 'Resguardo de llaves',
        doneByKeys: ['aux_key_drop_done_by', 'closure_key_drop_done_by']
    },
    {
        key: 'auxFinalParkingDone',
        actorRole: 'assistant',
        completedTask: 'Estacionamiento final',
        doneByKeys: ['aux_final_parking_done_by', 'closure_final_parking_done_by']
    },
    {
        key: 'globalSeatsFolded',
        actorRole: null,
        completedTask: 'Pliegue de asientos',
        doneByKeys: ['global_seats_folded_by', 'global_seat_folding_done_by']
    },
    {
        key: 'globalHeadphonesStored',
        actorRole: 'pilot',
        completedTask: 'Resguardo de audifonos',
        doneByKeys: ['global_headphones_stored_by', 'global_headphones_storage_done_by']
    },
    {
        key: 'globalGlassesStored',
        actorRole: 'pilot',
        completedTask: 'Resguardo de gafas',
        doneByKeys: ['global_glasses_stored_by', 'global_glasses_storage_done_by']
    },
    {
        key: 'auxVehiclePositioned',
        actorRole: 'assistant',
        completedTask: 'Acomodar vehiculo',
        doneByKeys: ['aux_vehicle_positioned_by', 'closure_vehicle_positioning_done_by']
    }
];

function parseTaskKey(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.startsWith('closure:') ? normalized.slice('closure:'.length) : normalized;
}

function resolveRouteLabel(route) {
    if (!route || route.kind !== 'screen') return '';
    return DISMANTLING_SCREEN_LABELS[route.screen] || route.screen;
}

function isSelfTriggered(doneByKeys, nextMeta, currentUserId) {
    const normalizedUserId = String(currentUserId || '').trim();
    if (!normalizedUserId || !Array.isArray(doneByKeys) || doneByKeys.length === 0) return false;
    return doneByKeys.some((key) => String(nextMeta?.[key] || '').trim() === normalizedUserId);
}

function pickDismantlingFlagTransition(prevMeta, nextMeta) {
    const prevFlags = getDismantlingFlags(prevMeta);
    const nextFlags = getDismantlingFlags(nextMeta);

    for (const item of CLOSURE_FLAG_PRIORITY) {
        if (prevFlags[item.key] !== true && nextFlags[item.key] === true) {
            return item;
        }
    }

    return null;
}

function buildDismantlingTransitionCopy({
    userRole,
    beforeVisibleTaskKey,
    afterVisibleTaskKey,
    beforeMeta,
    afterMeta,
    currentUserId
}) {
    const receiverRole = normalizeDismantlingRole(userRole);
    if (!receiverRole) return null;

    const beforeTaskKey = parseTaskKey(beforeVisibleTaskKey);
    const afterTaskKey = parseTaskKey(afterVisibleTaskKey);
    if (!beforeTaskKey || !afterTaskKey || beforeTaskKey === afterTaskKey) return null;

    const beforeRoute = resolveDismantlingRoute(receiverRole, beforeMeta);
    const afterRoute = resolveDismantlingRoute(receiverRole, afterMeta);
    if (afterRoute.kind !== 'screen') return null;

    const changedFlag = pickDismantlingFlagTransition(beforeMeta, afterMeta);
    if (!changedFlag) return null;

    if (isSelfTriggered(changedFlag.doneByKeys, afterMeta, currentUserId)) {
        return null;
    }

    const actorRole = normalizeDismantlingRole(changedFlag.actorRole);
    if (actorRole && actorRole === receiverRole) {
        return null;
    }

    const nextTask = resolveRouteLabel(afterRoute);
    if (!nextTask) return null;

    const cameFromWaitOrSupport =
        beforeRoute.kind === 'wait' ||
        beforeRoute.screen === DISMANTLING_ROUTE_IDS.APOYO_BODEGA ||
        beforeRoute.screen === DISMANTLING_ROUTE_IDS.RETURN_ROUTE ||
        beforeRoute.screen === DISMANTLING_ROUTE_IDS.GLOBAL_LOADING ||
        beforeRoute.screen === DISMANTLING_ROUTE_IDS.CONTAINER_LOADING ||
        beforeRoute.screen === DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD;

    if (!cameFromWaitOrSupport) return null;

    const headlineText = changedFlag.roleAgnostic
        ? `${changedFlag.completedTask} confirmada.`
        : `${STAFF_ROLE_LABELS[actorRole] || 'Equipo'} confirmo ${changedFlag.completedTask}.`;

    return {
        headlineText,
        nextActionText: nextTask,
        transitionKey: `closure:${beforeTaskKey}->${afterTaskKey}:${changedFlag.key}`
    };
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
        actionText: 'termino su montaje.',
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
export function getTransitionCopy(newState, prevState, userRole, staffNames = {}, context = {}) {
    const next = String(newState || '').trim();
    const prev = String(prevState || '').trim();
    const receiverRole = normalizeRole(userRole);

    if (!next) return null;
    if (RESET_STATES.has(next)) return null;

    if (next === 'dismantling') {
        const closureCopy = buildDismantlingTransitionCopy({
            userRole,
            beforeVisibleTaskKey: context.beforeVisibleTaskKey,
            afterVisibleTaskKey: context.afterVisibleTaskKey,
            beforeMeta: context.beforeMeta,
            afterMeta: context.afterMeta,
            currentUserId: context.currentUserId
        });
        if (closureCopy) return closureCopy;
    }

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
