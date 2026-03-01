export const PILOT_READY_SOURCE = 'pilot_prepare_flight_v1';

export function parseMeta(meta) {
    console.log('🔧 parseMeta called with:', meta, 'type:', typeof meta);

    const toPlainObject = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return Object.create(null);
        }

        const plain = Object.create(null);
        for (const [key, val] of Object.entries(value)) {
            plain[key] = val;
        }

        return plain;
    };

    if (!meta) {
        console.log('🔧 parseMeta: meta is falsy, returning {}');
        return Object.create(null);
    }

    if (typeof meta === 'string') {
        try {
            const parsed = JSON.parse(meta);
            const safeParsed = toPlainObject(parsed);
            console.log('🔧 parseMeta: parsed string to:', safeParsed);
            return safeParsed;
        } catch (e) {
            console.warn('⚠️ Failed to parse meta string:', meta);
            return Object.create(null);
        }
    }

    if (typeof meta === 'object') {
        const result = toPlainObject(meta);
        console.log('🔧 parseMeta: cloned object:', result);
        return result;
    }

    console.log('🔧 parseMeta: unexpected type, returning {}');
    return Object.create(null);
}

export function isPilotReady(meta, arrivalPhotoTakenAt = null) {
    const parsed = parseMeta(meta);
    const hasOwnPilotReady = Object.prototype.hasOwnProperty.call(parsed, 'pilot_ready');
    const hasOwnPilotReadySource = Object.prototype.hasOwnProperty.call(parsed, 'pilot_ready_source');
    const hasOwnPilotReadyAt = Object.prototype.hasOwnProperty.call(parsed, 'pilot_ready_at');
    const hasValidReadySource = hasOwnPilotReadySource && parsed.pilot_ready_source === PILOT_READY_SOURCE;

    let hasValidReadyTiming = true;
    if (arrivalPhotoTakenAt) {
        const arrivalAtMs = Date.parse(arrivalPhotoTakenAt);
        const pilotReadyAtMs = hasOwnPilotReadyAt ? Date.parse(parsed.pilot_ready_at) : NaN;
        hasValidReadyTiming = Number.isFinite(arrivalAtMs)
            ? Number.isFinite(pilotReadyAtMs) && pilotReadyAtMs >= arrivalAtMs
            : true;
    }

    const result = hasOwnPilotReady && parsed.pilot_ready === true && hasValidReadySource && hasValidReadyTiming;

    console.log('🔧 isPilotReady:', {
        input: meta,
        arrivalPhotoTakenAt,
        parsed: parsed,
        hasOwnPilotReady,
        hasOwnPilotReadySource,
        hasOwnPilotReadyAt,
        hasValidReadySource,
        hasValidReadyTiming,
        'parsed.pilot_ready': parsed.pilot_ready,
        'parsed.pilot_ready_at': parsed.pilot_ready_at,
        'parsed.pilot_ready_source': parsed.pilot_ready_source,
        'result (=== true)': result
    });

    return result;
}

export function mergeMeta(prevMeta, newMeta) {
    const prev = parseMeta(prevMeta);
    const next = parseMeta(newMeta);

    const criticalFlags = ['unload_note', 'dropzone_note'];
    const merged = { ...prev, ...next };

    criticalFlags.forEach(flag => {
        if (prev[flag] !== undefined && next[flag] === undefined) {
            merged[flag] = prev[flag];
        }
    });

    console.log('🔧 mergeMeta:', { prev, next, merged });

    return merged;
}

export function shouldLockPilot(role, missionState, meta, arrivalPhotoTakenAt = null) {
    if (role !== 'pilot') {
        return false;
    }

    const operationalStates = [
        'ARRIVAL_PHOTO_DONE',
        'waiting_unload_assignment',
        'waiting_dropzone',
        'unload',
        'post_unload_coordination',
        'seat_deployment',
        'OPERATION'
    ];

    const isOperational = operationalStates.includes(missionState);
    const hasArrivalEvidence = !isOperational || Boolean(arrivalPhotoTakenAt);
    const pilotReady = isPilotReady(meta, arrivalPhotoTakenAt);
    const shouldLock = isOperational && (!pilotReady || !hasArrivalEvidence);

    console.log('🔧 shouldLockPilot:', {
        role,
        missionState,
        arrivalPhotoTakenAt,
        isOperational,
        hasArrivalEvidence,
        pilotReady,
        shouldLock
    });

    return shouldLock;
}
