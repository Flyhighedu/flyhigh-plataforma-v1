import { getClosurePhaseForStep } from './closureFlow';

export const HEADER_PHASES = [
    {
        id: 'checkin',
        label: 'Check-in',
        chipLabel: 'CHECK-IN',
        activeColor: '#22C55E',
        states: ['MISSION_BRIEF']
    },
    {
        id: 'prep_base',
        label: 'Montaje',
        chipLabel: 'MONTAJE',
        activeColor: '#38BDF8',
        states: [
            'prep',
            'PILOT_PREP',
            'CHECKIN_DONE',
            'PREP_DONE',
            'AUX_PREP_DONE',
            'TEACHER_SUPPORTING_PILOT',
            'PILOT_READY_FOR_LOAD',
            'WAITING_AUX_VEHICLE_CHECK',
            'AUX_CONTAINERS_DONE'
        ]
    },
    {
        id: 'traslado',
        label: 'Traslado a sede',
        chipLabel: 'TRASLADO',
        activeColor: '#F59E0B',
        states: ['ROUTE_READY', 'IN_ROUTE', 'ROUTE_IN_PROGRESS']
    },
    {
        id: 'instalacion',
        label: 'Instalacion en sede',
        chipLabel: 'INSTALACION',
        activeColor: '#A78BFA',
        states: [
            'waiting_dropzone',
            'waiting_unload_assignment',
            'unload',
            'post_unload_coordination',
            'seat_deployment'
        ]
    },
    {
        id: 'operacion',
        label: 'Operacion educativa',
        chipLabel: 'OPERACION',
        activeColor: '#14B8A6',
        states: [
            'ARRIVAL_PHOTO_DONE',
            'OPERATION',
            'PILOT_OPERATION',
            'operation',
            'SHUTDOWN'
        ]
    },
    {
        id: 'desmontaje',
        label: 'Desmontaje',
        chipLabel: 'DESMONTAJE',
        activeColor: '#FB923C',
        states: ['dismantling']
    },
    {
        id: 'carga_retorno',
        label: 'Carga',
        chipLabel: 'CARGA',
        activeColor: '#0EA5E9',
        states: []
    },
    {
        id: 'retorno_base',
        label: 'Retorno',
        chipLabel: 'RETORNO',
        activeColor: '#6366F1',
        states: []
    },
    {
        id: 'cierre_base',
        label: 'Cierre base',
        chipLabel: 'CIERRE BASE',
        activeColor: '#22C55E',
        states: [
            'POST_MISSION_REPORT',
            'CLOSURE',
            'report',
            'closed'
        ]
    }
];

const PHASE_INDEX_BY_STATE = new Map();

const normalizeMissionState = (value) => String(value || '').trim().toUpperCase();

const CLOSURE_PHASE_TO_HEADER_ID = Object.freeze({
    dismantling: 'desmontaje',
    loading: 'carga_retorno',
    return: 'retorno_base',
    base_closure: 'cierre_base'
});

HEADER_PHASES.forEach((phase, idx) => {
    phase.states.forEach((state) => {
        PHASE_INDEX_BY_STATE.set(normalizeMissionState(state), idx);
    });
});

function normalizeMeta(meta) {
    if (!meta) return Object.create(null);

    if (typeof meta === 'string') {
        try {
            const parsed = JSON.parse(meta);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return Object.create(null);
            }
            return parsed;
        } catch {
            return Object.create(null);
        }
    }

    if (typeof meta === 'object' && !Array.isArray(meta)) {
        return meta;
    }

    return Object.create(null);
}

function resolveDismantlingPhaseIndex(meta) {
    const safeMeta = normalizeMeta(meta);
    let closurePhase = String(safeMeta.closure_phase || '').trim().toLowerCase();

    if (!closurePhase && safeMeta.closure_step) {
        closurePhase = getClosurePhaseForStep(safeMeta.closure_step);
    }

    const targetHeaderId = CLOSURE_PHASE_TO_HEADER_ID[closurePhase] || 'desmontaje';
    const idx = HEADER_PHASES.findIndex((phase) => phase.id === targetHeaderId);
    return idx >= 0 ? idx : (PHASE_INDEX_BY_STATE.get('DISMANTLING') ?? 0);
}

export function getHeaderPhaseForState(missionState, meta = null) {
    const normalized = normalizeMissionState(missionState);

    let idx;
    if (normalized === 'DISMANTLING') {
        idx = resolveDismantlingPhaseIndex(meta);
    } else {
        idx = PHASE_INDEX_BY_STATE.has(normalized) ? PHASE_INDEX_BY_STATE.get(normalized) : 0;
    }

    const phase = HEADER_PHASES[idx] || HEADER_PHASES[0];

    return {
        ...phase,
        index: idx,
        normalizedState: normalized
    };
}
