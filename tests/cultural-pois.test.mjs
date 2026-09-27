import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCulturalPoiQuery, buildNearbyNamedPoiQuery, parseCulturalPois, radarBounds } from '../src/lib/cultural-pois.mjs';

const center = { latitude: 19.4, longitude: -102.1 };
test('Shared radar query includes the editor categories and validates bounds', () => {
    const query = buildCulturalPoiQuery(radarBounds(center));
    for (const type of ['historic', 'tourism', 'amenity', 'aeroway', 'waterway', 'natural', 'leisure', 'man_made', 'power', 'railway', 'landuse', 'shop', 'place']) {
        assert.ok(query.includes(`node["${type}"`));
        assert.ok(query.includes(`way["${type}"`));
    }
    assert.throws(() => buildCulturalPoiQuery({ south: '19;bad', north: 20, west: -103, east: -102 }));
    assert.throws(() => radarBounds({ latitude: null, longitude: null }));
});
test('Nearby-name query accepts only bounded coordinates and radius', () => {
    const query = buildNearbyNamedPoiQuery({ latitude: 19.4169, longitude: -102.0555, radius: 150 });
    assert.ok(query.includes('(around:150,19.4169,-102.0555)'));
    assert.ok(query.includes('relation["name"]'));
    assert.throws(() => buildNearbyNamedPoiQuery({ latitude: 100, longitude: 0, radius: 150 }));
    assert.throws(() => buildNearbyNamedPoiQuery({ latitude: 19, longitude: -102, radius: 5000 }));
});
test('Radar keeps nearby named places, avoids catalog duplicates and never conflates OSM types', () => {
    const node = (id, name, lat = 19.4, lon = -102.1) => ({ type: 'node', id, lat, lon, tags: { name } });
    const elements = [node(1, 'Museo'), node(2, 'Parque'), node(3, ''), node(4, 'Lejos', 20), node(5, 'Inválido', null),
        { type: 'way', id: 2, center: { lat: 19.405, lon: -102.1 }, tags: { name: 'Templo' } }, node(2, 'Parque')];
    const original = structuredClone(elements);
    const result = parseCulturalPois(elements, center, [{ name: 'Museo', ...center }]);
    assert.deepEqual(result.map(poi => poi.id), ['osm_node_2', 'osm_way_2']);
    assert.ok(result.every(poi => poi.source === 'osm-radar' && !poi.audio_url));
    assert.deepEqual(elements, original);
    assert.throws(() => parseCulturalPois(null, center));
    assert.deepEqual(parseCulturalPois([], center), []);
});
