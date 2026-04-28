// ═══════════════════════════════════════════════════════════════════
// contingencyPilotConfig.js — Configuration for "No Pilot" Contingency
//
// Maps pilot tasks to substitute roles (Supervisor/Auxiliar).
// Used exclusively by /staff/contingencia-piloto.
// Does NOT modify any existing logic.
// ═══════════════════════════════════════════════════════════════════

/**
 * Tasks that the Auxiliar absorbs when pilot is absent.
 * The Auxiliar is the only team member who can physically fly the drone.
 */
export const AUX_ABSORBS_PILOT_TASKS = Object.freeze([
    'prep_flight',        // PilotPrepareFlightScreen (spot, checklist, controller, audio)
    'music_ambience',     // PilotMusicAmbienceScreen
    'fly_drone',          // Physical drone operation during OPERATION
    'drone_storage',      // DroneStorageScreen (closure)
]);

/**
 * Tasks that the Supervisor absorbs when pilot is absent.
 * These are logistics/inventory tasks the supervisor can handle.
 */
export const SUPERVISOR_ABSORBS_PILOT_TASKS = Object.freeze([
    'kit_checklist',        // PilotPrepChecklist (verifying drone kit in bodega)
    'return_inventory',     // ReturnInventoryScreen (closure)
    'electronics_charging', // ChargingStationScreen (closure)
]);

/**
 * Meta flags written to staff_journeys.meta when contingency is activated.
 */
export const CONTINGENCY_META_FLAGS = Object.freeze({
    FLAG_KEY: 'contingency_no_pilot',
    ACTIVATED_AT_KEY: 'contingency_no_pilot_activated_at',
    ACTIVATED_BY_KEY: 'contingency_no_pilot_activated_by',
    ACTIVATED_BY_NAME_KEY: 'contingency_no_pilot_activated_by_name',
});

/**
 * The contingency route path.
 */
export const CONTINGENCY_PILOT_ROUTE = '/staff/contingencia-piloto';

/**
 * Phases of the contingency wizard.
 * Linear progression — no branching.
 */
export const CONTINGENCY_PHASES = Object.freeze({
    BRIEF: 'brief',
    PREP: 'prep',
    LOADING: 'loading',
    EN_ROUTE: 'en_route',
    ARRIVAL: 'arrival',
    SITE_SETUP: 'site_setup',
    OPERATION: 'operation',
    DISMANTLING: 'dismantling',
});

/**
 * Barrier sync only needs these 2 roles (pilot is absent).
 */
export const CONTINGENCY_BARRIER_ROLES = Object.freeze(['teacher', 'assistant']);

/**
 * Dismantling task overrides for contingency mode.
 * Maps original pilot tasks to the role that handles them.
 */
export const DISMANTLING_TASK_OVERRIDES = Object.freeze({
    drone_storage: 'assistant',      // Aux stores the drone instead of pilot
    return_inventory: 'teacher',     // Teacher/Supervisor does inventory instead of pilot
    electronics_charging: 'teacher', // Teacher/Supervisor charges electronics instead of pilot
});

/**
 * Checks if a journey is in "no pilot" contingency mode.
 * @param {Object} meta - The journey's meta object
 * @returns {boolean}
 */
export function isNoPilotContingency(meta) {
    if (!meta) return false;
    const parsed = typeof meta === 'string' ? (() => {
        try { return JSON.parse(meta); } catch { return null; }
    })() : meta;
    return parsed?.contingency_no_pilot === true;
}
