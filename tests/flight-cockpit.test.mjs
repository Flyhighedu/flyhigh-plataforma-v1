import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aboveSurface, surfaceEnvelope, tuneControls, virtualLimits, DEFAULT_PROFILES, createFlightProfiles, sanitizeProfile, TUNING_FIELDS, advanceGimbal, QUALITY, joystickInput } from '../src/lib/flight-cockpit.mjs';
import { advanceFlight } from '../src/lib/flight-rehearsal.mjs';

test('coarse LOD cannot lower the known takeoff surface', () => {
    const ground = surfaceEnvelope(1750, 1690);
    assert.equal(ground, 1750);
    assert.deepEqual(aboveSurface(24, 1750, ground), { height: 1774, altitude: 24, clearance: 24 });
    assert.equal(surfaceEnvelope(undefined, NaN), undefined);
    assert.equal(aboveSurface(24, undefined, 1750), null);
});
test('new higher geometry lifts a stationary camera, never drops it when LOD regresses', () => {
    let surface = surfaceEnvelope(1750, 1800);
    let camera = aboveSurface(24, 1750, surface);
    assert.equal(camera.height, 1808);
    assert.equal(camera.altitude, 58);
    surface = surfaceEnvelope(surface, 1720);
    camera = aboveSurface(camera.altitude, 1750, surface);
    assert.equal(camera.height, 1808);
    assert.ok(aboveSurface(0, 1750, surface).clearance >= 8);
});
test('virtual ceiling unlock does not change the default limits', () => {
    for (const mode of ['slow', 'normal', 'fast']) {
        const limits = virtualLimits(mode, 500);
        assert.equal(advanceFlight({ latitude: 19, longitude: -102, altitude: 121, heading: 0 }, { climb: 1 }, .1, limits).altitude > 121, true);
        assert.equal(advanceFlight({ latitude: 19, longitude: -102, altitude: 500, heading: 0 }, { climb: 1 }, .1, limits).altitude, 500);
    }
    assert.equal(virtualLimits('normal').maximumAltitudeMeters, 120);
    assert.equal(virtualLimits('normal', 10000).maximumAltitudeMeters, 500);
});
test('three Expo curves independently preserve neutral, signs and full-stick bounds', () => {
    const input = { forward: .5, strafe: -.5, climb: 0, yaw: 1 };
    const linear = { ...DEFAULT_PROFILES.normal, expoHorizontal: .5, expoVertical: .5, expoYaw: .5, yawSmoothness: 0, braking: 150 };
    assert.deepEqual(tuneControls(input, {}, linear), input);
    const soft = tuneControls(input, {}, { ...linear, expoHorizontal: .1 });
    const responsive = tuneControls(input, {}, { ...linear, expoHorizontal: .9 });
    assert.ok(soft.forward < .5 && responsive.forward > .5);
    assert.equal(soft.strafe, -soft.forward);
    assert.equal(soft.yaw, 1); assert.equal(soft.climb, 0);
    const equal = { forward: .5, strafe: .5, climb: .5, yaw: .5 };
    for (const [key, affected] of [['expoHorizontal', ['forward', 'strafe']], ['expoVertical', ['climb']], ['expoYaw', ['yaw']]]) {
        const result = tuneControls(equal, {}, { ...linear, [key]: .1 });
        for (const axis of Object.keys(equal)) assert.equal(result[axis] < .5, affected.includes(axis), `${key} changes only its axes`);
    }
});
test('yaw smoothness and brake sensitivity have separate measurable effects', () => {
    const tuning = { ...DEFAULT_PROFILES.normal, yawSmoothness: 60, braking: 10 };
    let value = tuneControls({ yaw: 1 }, {}, tuning, .1);
    assert.ok(value.yaw > 0 && value.yaw < 1);
    const before = value.yaw;
    value = tuneControls({}, value, tuning, .1);
    assert.ok(value.yaw < before && value.yaw > 0);
    for (let i = 0; i < 80; i++) value = tuneControls({}, value, tuning, .1);
    assert.equal(value.yaw, 0);
    const softBrake = tuneControls({}, { forward: 1 }, tuning, .1);
    const hardBrake = tuneControls({}, { forward: 1 }, { ...tuning, braking: 150 }, .1);
    assert.ok(softBrake.forward > hardBrake.forward);
    assert.equal(hardBrake.forward, 0);
});
test('each of three modes owns eleven controls; edit/reset cannot mutate another mode', () => {
    const profiles = createFlightProfiles();
    assert.equal(TUNING_FIELDS.length, 11);
    assert.equal(new Set(Object.values(profiles)).size, 3);
    profiles.slow.horizontal = 2;
    profiles.fast.yawRate = 190;
    assert.equal(profiles.normal.horizontal, 12);
    profiles.slow = { ...DEFAULT_PROFILES.slow };
    assert.equal(profiles.fast.yawRate, 190);
    assert.equal(DEFAULT_PROFILES.fast.yawRate, 120);
    for (const field of TUNING_FIELDS) {
        assert.equal(sanitizeProfile({ [field.key]: field.max + 100 })[field.key], field.max);
        assert.equal(sanitizeProfile({ [field.key]: field.min - 100 })[field.key], field.min);
    }
});
test('horizontal/ascent/descent/yaw speed sliders drive distinct flight rates', () => {
    const profiles = createFlightProfiles();
    profiles.normal = { ...profiles.normal, horizontal: 4, ascent: 8, descent: 2, yawRate: 50 };
    const limits = virtualLimits('normal', 500, profiles);
    const start = { latitude: 19, longitude: -102, altitude: 50, heading: 0 };
    assert.equal(advanceFlight(start, { climb: 1 }, .1, limits).altitude, 50.8);
    assert.equal(advanceFlight(start, { climb: -1 }, .1, limits).altitude, 49.8);
    assert.equal(advanceFlight(start, { yaw: 1 }, .1, limits).heading, 5);
    assert.equal(limits.horizontalMetersPerSecond, 4);
    assert.equal(virtualLimits('fast', 500, profiles).horizontalMetersPerSecond, 21);
});
test('gimbal speed and smoothness affect actual angle, obey rates, and reach endpoints', () => {
    const start = { angle: -90, velocity: 0 };
    const slow = { ...DEFAULT_PROFILES.normal, gimbalSpeed: 10, gimbalSmoothness: 0 };
    const fast = { ...slow, gimbalSpeed: 100 };
    const a = advanceGimbal(start, 0, slow, .1);
    const b = advanceGimbal(start, 0, fast, .1);
    assert.ok(b.angle - start.angle > a.angle - start.angle);
    assert.ok(advanceGimbal(start, 0, { ...fast, gimbalSmoothness: 30 }, .1).angle < b.angle);
    for (const profile of [slow, fast, { ...fast, gimbalSmoothness: 30 }]) {
        let state = start;
        for (let i = 0; i < 200; i++) {
            const next = advanceGimbal(state, 0, profile, .1);
            assert.ok(Math.abs(next.angle - state.angle) <= profile.gimbalSpeed * .1 + 1e-8);
            assert.ok(next.angle >= -90 && next.angle <= 0);
            state = next;
        }
        assert.equal(state.angle, 0);
        for (let i = 0; i < 200; i++) state = advanceGimbal(state, -90, profile, .1);
        assert.equal(state.angle, -90);
    }
});
test('higher quality requests finer geometry and more display pixels within bounded memory', () => {
    assert.ok(QUALITY.high.error < QUALITY.balanced.error);
    assert.ok(QUALITY.high.pixels > QUALITY.balanced.pixels);
    assert.ok(QUALITY.high.memory <= 384);
});
test('floating sticks have a continuous dead zone and longer travel in both orientations', () => {
    assert.deepEqual(joystickInput(8, 0), { x: 0, y: 0 });
    assert.ok(joystickInput(10, 0).x < .02);
    assert.ok(joystickInput(35, 0).x < .42);
    assert.equal(joystickInput(72, 0).x, 1);
    assert.equal(joystickInput(0, -100).y, 1);
    assert.ok(Math.hypot(...Object.values(joystickInput(100, 100))) <= 1.000001);
    for (const profile of Object.values(DEFAULT_PROFILES)) {
        assert.ok(tuneControls({ yaw: .4 }, {}, profile).yaw < .1);
    }
});
test('telemetry has no panel background, border or box shadow', () => {
    const css = readFileSync(new URL('../src/components/staff/preparation/FlightRehearsalScreen.module.css', import.meta.url), 'utf8');
    const base = css.match(/^\.telemetry \{([^}]+)\}/m)[1];
    assert.match(base, /background: transparent/);
    assert.match(base, /border: 0/);
    assert.match(base, /box-shadow: none/);
    for (const rule of css.matchAll(/\.googleLayout \.telemetry \{([^}]+)\}/g)) assert.doesNotMatch(rule[1], /background|box-shadow|border/);
});
