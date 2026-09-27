const EARTH_RADIUS_METERS = 6371000;

export const FLIGHT_LIMITS = Object.freeze({
    horizontalMetersPerSecond: 18,
    climbMetersPerSecond: 6,
    yawDegreesPerSecond: 70,
    maximumAltitudeMeters: 120,
});

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
    return map.calculateCameraOptionsFromCameraLngLatAltRotation(
        [state.longitude, state.latitude], Math.max(1, state.altitude),
        state.heading, clamp(90 + gimbalAngle, 0, 70),
    );
}

export function advanceFlight(state, controls, elapsedSeconds, limits = FLIGHT_LIMITS) {
    const elapsed = clamp(elapsedSeconds, 0, 0.1);
    const heading = normalizeHeading(state.heading + clamp(controls?.yaw, -1, 1) * limits.yawDegreesPerSecond * elapsed);
    const altitude = clamp(
        state.altitude + clamp(controls?.climb, -1, 1) * limits.climbMetersPerSecond * elapsed,
        0,
        limits.maximumAltitudeMeters,
    );
    const radians = heading * Math.PI / 180;
    const forward = clamp(controls?.forward, -1, 1) * limits.horizontalMetersPerSecond * elapsed;
    const strafe = clamp(controls?.strafe, -1, 1) * limits.horizontalMetersPerSecond * elapsed;
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
