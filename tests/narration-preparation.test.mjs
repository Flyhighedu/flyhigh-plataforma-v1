import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence, coordinates, distanceKm, moveItem, snapshot, sequenceChanged, durationLabel } from '../src/lib/narration-preparation.mjs';
import { advanceFlight, closestPoi, distanceMeters, fallbackZoom, flightCamera, normalizeHeading } from '../src/lib/flight-rehearsal.mjs';

const catalog = [
    { id: 'official_a', name: 'Museo', audio_url: 'https://example.test/a.wav', narrative_script: 'Museo original' },
    { id: 'official_b', name: 'Parque', audio_url: 'https://example.test/b.wav' },
    { id: 'personal_c', name: 'Sin audio' },
];
test('The selected order survives confirmation, without catalog ordering', () => {
    assert.deepEqual(buildSequence(['official_b', 'official_a'], catalog, 'ready').map(p => p.id), ['official_b', 'official_a']);
});
test('A draft may be empty but a confirmed sequence must have playable sources', () => {
    assert.deepEqual(buildSequence([], catalog, 'draft'), []);
    assert.throws(() => buildSequence([], catalog, 'ready'));
    assert.throws(() => buildSequence(['personal_c'], catalog, 'ready'));
    assert.throws(() => buildSequence(['x'], catalog, 'draft'));
    assert.throws(() => buildSequence(['official_a', 'official_a'], catalog, 'draft'));
    assert.throws(() => buildSequence(['official_a'], catalog, 'unknown'));
});
test('Reordering does not mutate the existing sequence and respects boundaries', () => {
    const original = ['a', 'b', 'c'];
    assert.deepEqual(moveItem(original, 2, -1), ['a', 'c', 'b']);
    assert.deepEqual(original, ['a', 'b', 'c']);
    assert.equal(moveItem(original, 0, -1), original);
    assert.equal(moveItem(original, 2, 1), original);
});
test('Deleted or edited source content invalidates a confirmed snapshot', () => {
    const items = [snapshot(catalog[0])];
    assert.equal(sequenceChanged(items, catalog), false);
    assert.equal(sequenceChanged(items, catalog.slice(1)), true);
    assert.equal(sequenceChanged(items, [{ ...catalog[0], narrative_script: 'Nuevo guion' }]), true);
    assert.equal(sequenceChanged(items, [{ ...catalog[0], audio_url: 'https://example.test/new.wav' }]), true);
});
test('Missing coordinates never turn into a real map marker at zero', () => {
    assert.equal(coordinates(null, null), null);
    assert.equal(coordinates('', ''), null);
    assert.equal(coordinates(100, 0), null);
    assert.deepEqual(coordinates(0, 0), [0, 0]);
    assert.equal(distanceKm(null, [1, 1]), null);
    assert.ok(Math.abs(distanceKm([0, 0], [0, 1]) - 111.195) < 0.01);
});

test('Mode 3 controls move, rotate and climb without exceeding flight limits', () => {
    const start = { latitude: 19.4326, longitude: -99.1332, altitude: 24, heading: 0 };
    const moved = advanceFlight(start, { forward: 1, strafe: 0, climb: 1, yaw: 1 }, 1);
    assert.ok(moved.latitude > start.latitude);
    assert.ok(moved.altitude > start.altitude);
    assert.ok(moved.heading > start.heading);
    const limited = advanceFlight({ ...start, altitude: 119.9 }, { climb: 1 }, 1);
    assert.equal(limited.altitude, 120);
    assert.equal(normalizeHeading(-10), 350);
});

test('The nearest POI is derived without mutating the flight state', () => {
    const position = { latitude: 19.4326, longitude: -99.1332 };
    const pois = [
        { id: 'far', latitude: 19.45, longitude: -99.15 },
        { id: 'near', latitude: 19.4327, longitude: -99.1332 },
    ];
    assert.ok(distanceMeters(position, pois[1]) < 20);
    assert.equal(closestPoi(position, pois, 100)?.poi.id, 'near');
    assert.equal(closestPoi(position, pois, 5), null);
});
test('The compatible map represents gimbal tilt with a bounded zoom range', () => {
    assert.equal(fallbackZoom(-20), 15.5);
    assert.equal(fallbackZoom(-90), 17.5);
    assert.ok(fallbackZoom(-40) > fallbackZoom(-20));
});

test('Altitude and gimbal independently drive the camera and remain finite at ground level', () => {
    const state = { latitude: 19.4326, longitude: -99.1332, altitude: 24, heading: 15 };
    const map = { calculateCameraOptionsFromCameraLngLatAltRotation: (...args) => args };
    assert.deepEqual(flightCamera(map, state, -40), [[-99.1332, 19.4326], 24, 15, 50]);
    assert.equal(flightCamera(map, { ...state, altitude: 0 }, -90)[1], 1);
    assert.equal(flightCamera(map, state, -90)[3], 0);
    assert.equal(fallbackZoom(-40, 24) - fallbackZoom(-40, 48), 1);
    assert.ok(Number.isFinite(fallbackZoom(-40, 0)));
});
test('Duration distinguishes unknown from a playable length', () => {
    assert.equal(durationLabel(null), 'Duración por confirmar');
    assert.equal(durationLabel(65), '1:05');
});
