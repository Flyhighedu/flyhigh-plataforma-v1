import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCct, validCoordinates, classifyMatch, mayFillVisit, locationSnapshot } from '../src/lib/school-locations.mjs';
const catalog = { cct: '16DPR0001A', turno: 'Matutino' };
const source = { id: 'source', ...catalog, latitud: 19.42, longitud: -102.06 };
test('CCT normalizes only case and surrounding whitespace', () => {
    assert.equal(normalizeCct(' 16dpr0001a '), catalog.cct);
    assert.notEqual(normalizeCct('16 DPR0001A'), catalog.cct);
});
test('only unique exact CCT and turn produce a candidate, never fuzzy school names', () => {
    assert.equal(classifyMatch(catalog, [source]).status, 'candidate');
    assert.equal(classifyMatch(catalog, [{ ...source, cct: '16DPR0002A' }]).status, 'not_found');
    assert.equal(classifyMatch(catalog, [source, { ...source, id: 'duplicate' }]).status, 'ambiguous');
    assert.equal(classifyMatch({ ...catalog, turno: '' }, [source]).status, 'turn_review');
    assert.equal(classifyMatch(catalog, [{ ...source, turno: 'Vespertino' }]).status, 'turn_review');
});
test('invalid, incomplete, swapped and outside-country coordinates are not candidates', () => {
    for (const [latitud, longitud] of [[null, -102], ['', -102], ['19', -102], [NaN, -102], [Infinity, -102], [0, 0], [-102, 19], [50, 30]]) {
        assert.equal(classifyMatch(catalog, [{ ...source, latitud, longitud }]).status, 'invalid_coordinates');
    }
    assert.equal(validCoordinates(19, -102), true);
});
test('even partial or invalid existing locations are preserved for manual review', () => {
    for (const location of [{ ubicacion_lat: 0 }, { ubicacion_lng: -102 }, { ubicacion_lat: 500, ubicacion_lng: 800 }]) {
        assert.equal(classifyMatch({ ...catalog, ...location }, [source]).status, 'preserve_location');
    }
});
const future = { id: 1, fecha_programada: '2026-09-27', estatus: 'pendiente', is_archived: false, ubicacion_lat: null, ubicacion_lng: null };
test('history, today, archived, started and any linked journeys/closures never qualify', () => {
    const today = '2026-09-25';
    assert.equal(mayFillVisit(future, today), true);
    for (const changes of [{ fecha_programada: today }, { fecha_programada: '2020-01-01' }, { fecha_programada: '' }, { is_archived: true }, { is_archived: null }, { archived_at: today }, { estatus: 'completada' }, { estatus: 'cancelada' }, { estatus: 'en_progreso' }, { estatus: null }, { ubicacion_lat: 19 }]) {
        assert.equal(mayFillVisit({ ...future, ...changes }, today), false, JSON.stringify(changes));
    }
    assert.equal(mayFillVisit(future, today, new Set(['1'])), false);
});
test('new visits receive coordinates only from a reviewed catalog with the same turn', () => {
    const located = { ...catalog, ubicacion_lat: 19, ubicacion_lng: -102, ubicacion_fuente: { kind: 'intelligence' }, ubicacion_verificada_at: '2026-09-25T12:00:00Z' };
    assert.deepEqual(locationSnapshot(located, 'Vespertino'), {});
    assert.deepEqual(locationSnapshot({ ...located, ubicacion_verificada_at: null }, 'Matutino'), {});
    assert.equal(locationSnapshot(located, 'Matutino').ubicacion_lat, 19);
    assert.equal(locationSnapshot(located, 'Matutino').cct, undefined);
});
