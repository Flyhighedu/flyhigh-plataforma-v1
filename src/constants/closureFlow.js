export const CLOSURE_STEPS = Object.freeze({
    AD_WALL_DISMANTLE: 'ad_wall_dismantle',
    DRONE_STORAGE: 'drone_storage',
    GLASSES_STORAGE: 'glasses_storage',
    HEADPHONES_STORAGE: 'headphones_storage',
    SEAT_FOLDING: 'seat_folding',
    VEHICLE_POSITIONING: 'vehicle_positioning',
    CONTAINER_LOADING: 'container_loading',
    RETURN_ROUTE: 'return_route',
    ARRIVAL_NOTIFICATION: 'arrival_notification',
    EQUIPMENT_UNLOAD: 'equipment_unload',
    RETURN_INVENTORY: 'return_inventory',
    ELECTRONICS_CHARGING: 'electronics_charging',
    FINAL_PARKING: 'final_parking',
    CHECKOUT: 'checkout'
});

export const CLOSURE_STEP_SEQUENCE = Object.freeze([
    CLOSURE_STEPS.AD_WALL_DISMANTLE,
    CLOSURE_STEPS.DRONE_STORAGE,
    CLOSURE_STEPS.GLASSES_STORAGE,
    CLOSURE_STEPS.HEADPHONES_STORAGE,
    CLOSURE_STEPS.SEAT_FOLDING,
    CLOSURE_STEPS.VEHICLE_POSITIONING,
    CLOSURE_STEPS.CONTAINER_LOADING,
    CLOSURE_STEPS.RETURN_ROUTE,
    CLOSURE_STEPS.ARRIVAL_NOTIFICATION,
    CLOSURE_STEPS.EQUIPMENT_UNLOAD,
    CLOSURE_STEPS.RETURN_INVENTORY,
    CLOSURE_STEPS.ELECTRONICS_CHARGING,
    CLOSURE_STEPS.FINAL_PARKING,
    CLOSURE_STEPS.CHECKOUT
]);

export const DEFAULT_CLOSURE_STEP = CLOSURE_STEPS.AD_WALL_DISMANTLE;

const CLOSURE_STEP_SET = new Set(CLOSURE_STEP_SEQUENCE);

const CLOSURE_PHASE_BY_STEP = Object.freeze({
    [CLOSURE_STEPS.AD_WALL_DISMANTLE]: 'dismantling',
    [CLOSURE_STEPS.DRONE_STORAGE]: 'dismantling',
    [CLOSURE_STEPS.GLASSES_STORAGE]: 'dismantling',
    [CLOSURE_STEPS.HEADPHONES_STORAGE]: 'dismantling',
    [CLOSURE_STEPS.SEAT_FOLDING]: 'dismantling',
    [CLOSURE_STEPS.VEHICLE_POSITIONING]: 'loading',
    [CLOSURE_STEPS.CONTAINER_LOADING]: 'loading',
    [CLOSURE_STEPS.RETURN_ROUTE]: 'loading',
    [CLOSURE_STEPS.ARRIVAL_NOTIFICATION]: 'return',
    [CLOSURE_STEPS.EQUIPMENT_UNLOAD]: 'return',
    [CLOSURE_STEPS.RETURN_INVENTORY]: 'base_closure',
    [CLOSURE_STEPS.ELECTRONICS_CHARGING]: 'base_closure',
    [CLOSURE_STEPS.FINAL_PARKING]: 'base_closure',
    [CLOSURE_STEPS.CHECKOUT]: 'base_closure'
});

function parseMetaLike(meta) {
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

export function normalizeClosureStep(step) {
    const normalized = String(step || '').trim().toLowerCase();
    if (!normalized || !CLOSURE_STEP_SET.has(normalized)) {
        return DEFAULT_CLOSURE_STEP;
    }
    return normalized;
}

export function getCurrentClosureStep(meta) {
    const parsedMeta = parseMetaLike(meta);
    return normalizeClosureStep(parsedMeta.closure_step);
}

export function getNextClosureStep(currentStep) {
    const normalized = normalizeClosureStep(currentStep);
    const currentIndex = CLOSURE_STEP_SEQUENCE.indexOf(normalized);
    if (currentIndex < 0 || currentIndex >= CLOSURE_STEP_SEQUENCE.length - 1) {
        return null;
    }
    return CLOSURE_STEP_SEQUENCE[currentIndex + 1];
}

export function isFinalClosureStep(step) {
    return normalizeClosureStep(step) === CLOSURE_STEPS.CHECKOUT;
}

export function getClosurePhaseForStep(step) {
    const normalized = normalizeClosureStep(step);
    return CLOSURE_PHASE_BY_STEP[normalized] || 'dismantling';
}

export function getClosureProgress(step) {
    const normalized = normalizeClosureStep(step);
    const currentIndex = CLOSURE_STEP_SEQUENCE.indexOf(normalized);
    if (currentIndex < 0) {
        return {
            index: 0,
            total: CLOSURE_STEP_SEQUENCE.length,
            percent: 0
        };
    }

    const total = CLOSURE_STEP_SEQUENCE.length;
    return {
        index: currentIndex,
        total,
        percent: Math.round(((currentIndex + 1) / total) * 100)
    };
}
