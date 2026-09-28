import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCulturalPoiQuery, buildNearbyNamedPoiQuery, buildPreparationPoiQuery, parseCulturalPois, radarBounds } from '../src/lib/cultural-pois.mjs';
import { discoverEducationalPlaces } from '../src/lib/educational-place-search.mjs';

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
test('Preparation scans the school vicinity before a geographically spread 5 km search', () => {
    const near = buildPreparationPoiQuery(center, 'near');
    const wide = buildPreparationPoiQuery(center, 'wide');
    for (const query of [near, wide]) {
        for (const tag of ['place_of_worship', 'school', 'cinema', 'fast_food', 'supermarket', 'department_store', 'bridge:name', 'aerialway']) {
            assert.ok(query.includes(tag), `${tag} must be discoverable`);
        }
        assert.ok(query.includes('relation["amenity"'));
    }
    assert.ok(near.includes('way["highway"]["bridge"~"yes|viaduct|movable"]["name"]'));
    assert.ok(near.endsWith('out center qt;'));
    assert.ok(wide.endsWith('out center qt 1500;'));
    assert.ok(!wide.includes('way["highway"]["bridge"~"yes|viaduct|movable"]["name"]'));
    assert.equal(buildPreparationPoiQuery({ latitude: '19.4', longitude: '-102.1' }, 'near'), near);
    assert.throws(() => buildPreparationPoiQuery({ latitude: 100, longitude: 0 }));
    assert.throws(() => buildPreparationPoiQuery(center, 'unbounded'));
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
test('Preparation places retain their kind and use the bridge name when available', () => {
    const elements = [
        { type: 'way', id: 11, center: { lat: 19.4, lon: -102.1 }, tags: { highway: 'primary', bridge: 'yes', name: 'Avenida Central', 'bridge:name': 'Puente Vehicular Central' } },
        { type: 'node', id: 12, lat: 19.401, lon: -102.1, tags: { name: 'Parroquia', amenity: 'place_of_worship' } },
        { type: 'node', id: 13, lat: 19.402, lon: -102.1, tags: { name: 'Cinépolis', amenity: 'cinema' } },
        { type: 'node', id: 14, lat: 19.403, lon: -102.1, tags: { name: "McDonald's", amenity: 'fast_food' } },
        { type: 'relation', id: 15, center: { lat: 19.404, lon: -102.1 }, tags: { name: 'Centro Comercial', shop: 'mall' } },
        { type: 'node', id: 16, lat: 19.405, lon: -102.1, tags: { name: 'Estación Centro', aerialway: 'station' } },
    ];
    const places = parseCulturalPois(elements, center);
    assert.deepEqual(places.map(poi => [poi.name, poi.category]), [
        ['Puente Vehicular Central', 'bridge'], ['Parroquia', 'worship'],
        ['Cinépolis', 'entertainment'], ["McDonald's", 'food'], ['Centro Comercial', 'shopping'],
        ['Estación Centro', 'cableway']
    ]);
});
test('Staff preparation and admin can share nearby and wide discovery without losing partial results', async () => {
    const ranges = [];
    const fetcher = async (_, options) => {
        const { range } = JSON.parse(options.body);
        ranges.push(range);
        return { ok: range === 'near', json: async () => range === 'near'
            ? { elements: [{ type: 'node', id: 21, lat: 19.401, lon: -102.1, tags: { name: 'Cinépolis', amenity: 'cinema' } }] }
            : { error: 'Overpass unavailable' } };
    };
    const partial = [];
    const result = await discoverEducationalPlaces(center, [], { fetcher, onPartial: places => partial.push(places.map(poi => poi.name)) });
    assert.deepEqual(ranges, ['near', 'wide']);
    assert.deepEqual(partial, [['Cinépolis']]);
    assert.equal(result.partial, true);
    assert.deepEqual(result.places.map(poi => poi.category), ['entertainment']);
});
