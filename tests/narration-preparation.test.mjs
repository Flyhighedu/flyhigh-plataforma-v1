import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence, coordinates, distanceKm, moveItem, snapshot, sequenceChanged, durationLabel } from '../src/lib/narration-preparation.mjs';

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
test('Duration distinguishes unknown from a playable length', () => {
    assert.equal(durationLabel(null), 'Duración por confirmar');
    assert.equal(durationLabel(65), '1:05');
});
