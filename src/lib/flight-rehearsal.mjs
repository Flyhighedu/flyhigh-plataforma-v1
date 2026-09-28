const EARTH_RADIUS_METERS = 6371000;

export const FLIGHT_LIMITS = Object.freeze({
    horizontalMetersPerSecond: 18,
    climbMetersPerSecond: 6,
    yawDegreesPerSecond: 70,
    maximumAltitudeMeters: 120,
});

export const FLIGHT_SPEEDS = Object.freeze([
    Object.freeze({ id: 'slow', label: 'Lenta', horizontalMetersPerSecond: 3, climbMetersPerSecond: 2, yawDegreesPerSecond: 35 }),
    Object.freeze({ id: 'normal', label: 'Normal', horizontalMetersPerSecond: 8, climbMetersPerSecond: 4, yawDegreesPerSecond: 50 }),
    Object.freeze({ id: 'fast', label: 'Rápida', horizontalMetersPerSecond: 18, climbMetersPerSecond: 6, yawDegreesPerSecond: 70 }),
]);

export const FLIGHT_POI_RADIUS_METERS = 5000;
export const MAX_FLIGHT_POI_MARKERS = 48;

export function flightLimitsForSpeed(id) {
    return { ...FLIGHT_LIMITS, ...(FLIGHT_SPEEDS.find(speed => speed.id === id) || FLIGHT_SPEEDS[1]) };
}

export function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

export function normalizeHeading(value) {
    return ((Number(value) % 360) + 360) % 360;
}

export function fallbackZoom(gimbalAngle, altitude = 24) {
    return clamp(15.5 + ((-Number(gimbalAngle) - 20) / 70) * 2 - Math.log2(Math.max(1, altitude) / 24), 12, 22);
}

// Flat ground is zero in this rehearsal (no terrain/elevation dataset).
// Avoid the singularity at ground level while preserving the displayed height.
export function flightCamera(map, state, gimbalAngle) {
    // Looking exactly at the horizon raises the focus plane in MapLibre.
    // Restore the known flat ground before solving the next camera position.
    if (map.getCenterElevation?.() !== 0) map.setCenterElevation?.(0);
    return map.calculateCameraOptionsFromCameraLngLatAltRotation(
        [state.longitude, state.latitude], Math.max(1, state.altitude),
        state.heading, clamp(90 + gimbalAngle, 0, 90),
    );
}

export function advanceFlight(state, controls, elapsedSeconds, limits = FLIGHT_LIMITS) {
    const elapsed = clamp(elapsedSeconds, 0, 0.1);
    const heading = normalizeHeading(state.heading + clamp(controls?.yaw, -1, 1) * limits.yawDegreesPerSecond * elapsed);
    const altitude = clamp(
        state.altitude + clamp(controls?.climb, -1, 1) * (controls?.climb < 0 ? limits.descentMetersPerSecond ?? limits.climbMetersPerSecond : limits.climbMetersPerSecond) * elapsed,
        0,
        limits.maximumAltitudeMeters,
    );
    const radians = heading * Math.PI / 180;
    const forwardInput = clamp(controls?.forward, -1, 1);
    const strafeInput = clamp(controls?.strafe, -1, 1);
    const magnitude = Math.max(1, Math.hypot(forwardInput, strafeInput));
    const forward = forwardInput / magnitude * limits.horizontalMetersPerSecond * elapsed;
    const strafe = strafeInput / magnitude * limits.horizontalMetersPerSecond * elapsed;
    const northMeters = forward * Math.cos(radians) - strafe * Math.sin(radians);
    const eastMeters = forward * Math.sin(radians) + strafe * Math.cos(radians);
    const latitudeRadians = Number(state.latitude) * Math.PI / 180;
    const latitude = Number(state.latitude) + northMeters / EARTH_RADIUS_METERS * 180 / Math.PI;
    const longitude = Number(state.longitude) + eastMeters / (EARTH_RADIUS_METERS * Math.max(0.01, Math.cos(latitudeRadians))) * 180 / Math.PI;
    return { latitude, longitude, altitude, heading };
}

export function distanceMeters(a, b) {
    if (!a || !b) return Infinity;
    const radians = value => Number(value) * Math.PI / 180;
    const deltaLatitude = radians(b.latitude - a.latitude);
    const deltaLongitude = radians(b.longitude - a.longitude);
    const latitudeA = radians(a.latitude);
    const latitudeB = radians(b.latitude);
    const h = Math.sin(deltaLatitude / 2) ** 2
        + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
    return EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function closestPoi(position, pois, maximumDistanceMeters = Infinity) {
    let match = null;
    let bestDistance = maximumDistanceMeters;
    for (const poi of pois || []) {
        const distance = distanceMeters(position, poi);
        if (distance < bestDistance) {
            match = poi;
            bestDistance = distance;
        }
    }
    return match ? { poi: match, distance: bestDistance } : null;
}

export function selectFlightPois(pois, center, { radius = FLIGHT_POI_RADIUS_METERS, limit = MAX_FLIGHT_POI_MARKERS } = {}) {
    if (!center || !Number.isFinite(Number(center.latitude)) || !Number.isFinite(Number(center.longitude))) return [];
    const maximum = Math.max(1, Math.floor(Number(limit) || MAX_FLIGHT_POI_MARKERS));
    return (pois || [])
        .filter(poi => Number.isFinite(Number(poi?.latitude)) && Number.isFinite(Number(poi?.longitude)))
        .map(poi => ({ poi, distance: distanceMeters(center, poi) }))
        .filter(entry => Number.isFinite(entry.distance) && entry.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maximum)
        .map(entry => entry.poi);
}
