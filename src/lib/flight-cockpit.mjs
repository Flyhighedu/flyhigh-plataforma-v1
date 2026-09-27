import { clamp, flightLimitsForSpeed } from './flight-rehearsal.mjs';

// Same families of controls as DJI Fly's Gain & Expo menu. The response model
// and starting values below belong to the rehearsal, not DJI flight firmware.
export const FLIGHT_MODES = Object.freeze([
    { id: 'slow', label: 'Cine', code: 'C' },
    { id: 'normal', label: 'Normal', code: 'N' },
    { id: 'fast', label: 'Sport', code: 'S' },
]);
export const TUNING_FIELDS = Object.freeze([
    { key: 'horizontal', label: 'Velocidad horizontal máxima', min: 1, max: 21, step: .5, unit: 'm/s', group: 'Aeronave' },
    { key: 'ascent', label: 'Velocidad máxima de ascenso', min: 1, max: 10, step: .5, unit: 'm/s', group: 'Aeronave' },
    { key: 'descent', label: 'Velocidad máxima de descenso', min: 1, max: 10, step: .5, unit: 'm/s', group: 'Aeronave' },
    { key: 'yawRate', label: 'Velocidad angular máxima', min: 20, max: 200, step: 5, unit: '°/s', group: 'Aeronave' },
    { key: 'yawSmoothness', label: 'Suavidad de giro', min: 0, max: 100, step: 1, unit: '', group: 'Aeronave' },
    { key: 'braking', label: 'Sensibilidad de frenado', min: 10, max: 150, step: 5, unit: '', group: 'Aeronave' },
    { key: 'expoVertical', label: 'Expo · Ascenso / descenso', min: .1, max: .9, step: .01, unit: '', group: 'Expo' },
    { key: 'expoYaw', label: 'Expo · Giro', min: .1, max: .9, step: .01, unit: '', group: 'Expo' },
    { key: 'expoHorizontal', label: 'Expo · Avance / traslación', min: .1, max: .9, step: .01, unit: '', group: 'Expo' },
    { key: 'gimbalSpeed', label: 'Velocidad máxima de inclinación', min: 1, max: 100, step: 1, unit: '°/s', group: 'Gimbal' },
    { key: 'gimbalSmoothness', label: 'Suavidad de inclinación', min: 0, max: 30, step: 1, unit: '', group: 'Gimbal' },
]);
const common = { yawSmoothness: 10, braking: 100, expoVertical: .5, expoYaw: .5, expoHorizontal: .5, gimbalSpeed: 50, gimbalSmoothness: 10 };
export const DEFAULT_PROFILES = Object.freeze({
    slow: Object.freeze({ ...common, horizontal: 6, ascent: 3, descent: 3, yawRate: 45, yawSmoothness: 30, gimbalSpeed: 25, gimbalSmoothness: 20 }),
    normal: Object.freeze({ ...common, horizontal: 12, ascent: 6, descent: 6, yawRate: 90 }),
    fast: Object.freeze({ ...common, horizontal: 21, ascent: 10, descent: 10, yawRate: 150, yawSmoothness: 0, gimbalSpeed: 80, gimbalSmoothness: 0 }),
});
export function createFlightProfiles() {
    return Object.fromEntries(Object.entries(DEFAULT_PROFILES).map(([id, value]) => [id, { ...value }]));
}
export function sanitizeProfile(value = {}) {
    return Object.fromEntries(TUNING_FIELDS.map(field => [field.key, clamp(Number.isFinite(value[field.key]) ? value[field.key] : DEFAULT_PROFILES.normal[field.key], field.min, field.max)]));
}
export const SURFACE_CLEARANCE = 8;
export const QUALITY = Object.freeze({
    balanced: { error: 12, pixels: 1, memory: 128 },
    high: { error: 6, pixels: 1.5, memory: 192 },
});

export function virtualLimits(mode, maximumAltitude = 120, profiles = DEFAULT_PROFILES) {
    const profile = sanitizeProfile(profiles[mode] || profiles.normal);
    return { ...flightLimitsForSpeed(mode), horizontalMetersPerSecond: profile.horizontal, climbMetersPerSecond: profile.ascent, descentMetersPerSecond: profile.descent, yawDegreesPerSecond: profile.yawRate, maximumAltitudeMeters: clamp(maximumAltitude, 30, 500) };
}

// These are simulator response curves, not copies of DJI flight firmware.
export function tuneControls(input, previous, tuning = DEFAULT_PROFILES.normal, dt = .03) {
    const profile = sanitizeProfile(tuning);
    return Object.fromEntries(['forward', 'strafe', 'climb', 'yaw'].map(axis => {
        const expo = axis === 'climb' ? profile.expoVertical : axis === 'yaw' ? profile.expoYaw : profile.expoHorizontal;
        const exponent = 2 ** ((.5 - expo) * 3);
        const value = clamp(input[axis], -1, 1);
        const target = Math.sign(value) * Math.abs(value) ** exponent;
        const braking = Math.abs(target) < Math.abs(previous[axis] || 0) || target * (previous[axis] || 0) < 0;
        const tau = axis === 'yaw' ? profile.yawSmoothness / 100 * .8 : braking ? (150 - profile.braking) / 140 * .6 : 0;
        const blend = tau > 0 ? 1 - Math.exp(-clamp(dt, 0, .1) / tau) : 1;
        const filtered = (previous[axis] || 0) + (target - (previous[axis] || 0)) * blend;
        return [axis, Math.abs(filtered) < .001 ? 0 : filtered];
    }));
}

export function advanceGimbal(state, target, tuning, dt) {
    const profile = sanitizeProfile(tuning);
    const elapsed = clamp(dt, 0, .1);
    const difference = clamp(target, -90, 0) - state.angle;
    if (Math.abs(difference) < .02) return { angle: clamp(target, -90, 0), velocity: 0 };
    const wanted = clamp(difference * 8, -profile.gimbalSpeed, profile.gimbalSpeed);
    const tau = profile.gimbalSmoothness / 30 * .45;
    const blend = tau ? 1 - Math.exp(-elapsed / tau) : 1;
    const velocity = state.velocity + (wanted - state.velocity) * blend;
    const step = velocity * elapsed;
    if (Math.sign(step) === Math.sign(difference) && Math.abs(step) >= Math.abs(difference)) return { angle: clamp(target, -90, 0), velocity: 0 };
    return { angle: clamp(state.angle + step, -90, 0), velocity };
}

// At the SAME location, a coarse visible LOD must never invalidate a higher
// surface already measured there. Samples from another location are excluded.
export function surfaceEnvelope(...heights) {
    const valid = heights.filter(Number.isFinite);
    return valid.length ? Math.max(...valid) : undefined;
}

export function aboveSurface(relativeAltitude, takeoffHeight, surfaceHeight) {
    if (!Number.isFinite(takeoffHeight) || !Number.isFinite(surfaceHeight)) return null;
    const height = Math.max(takeoffHeight + Math.max(0, relativeAltitude), surfaceHeight + SURFACE_CLEARANCE);
    return { height, altitude: height - takeoffHeight, clearance: height - surfaceHeight };
}
