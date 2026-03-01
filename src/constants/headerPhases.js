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
        label: 'Preparacion en base',
        chipLabel: 'PREP BASE',
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
            'SHUTDOWN',
            'POST_MISSION_REPORT',
            'CLOSURE',
            'report',
            'closed'
        ]
    }
];

const PHASE_INDEX_BY_STATE = new Map();

const normalizeMissionState = (value) => String(value || '').trim().toUpperCase();

HEADER_PHASES.forEach((phase, idx) => {
    phase.states.forEach((state) => {
        PHASE_INDEX_BY_STATE.set(normalizeMissionState(state), idx);
    });
});

export function getHeaderPhaseForState(missionState) {
    const normalized = normalizeMissionState(missionState);
    const idx = PHASE_INDEX_BY_STATE.has(normalized) ? PHASE_INDEX_BY_STATE.get(normalized) : 0;
    const phase = HEADER_PHASES[idx] || HEADER_PHASES[0];

    return {
        ...phase,
        index: idx,
        normalizedState: normalized
    };
}
