import { coordinates } from './narration-preparation.mjs';
import { distanceMeters } from './flight-rehearsal.mjs';

// The same categories used by the narration editor's cultural radar.
const FILTERS = [
    '["historic"]',
    '["tourism"~"museum|artwork|attraction|theme_park|zoo|aquarium|viewpoint"]',
    '["amenity"~"place_of_worship|university|college|school|library|theatre|townhall|public_building"]',
    '["aeroway"="aerodrome"]',
    '["waterway"~"dam|river|waterfall"]',
    '["natural"~"peak|volcano|water|wood|forest"]',
    '["leisure"~"park|nature_reserve|sports_centre|stadium"]',
    '["man_made"~"wastewater_plant|water_works|observatory|lighthouse|windmill|watermill|works"]',
    '["power"="plant"]', '["railway"="station"]',
    '["landuse"~"industrial|commercial|cemetery"]["name"]',
    '["amenity"~"fuel|hospital|police|fire_station|grave_yard"]["name"]',
    '["shop"="mall"]["name"]',
    '["place"~"city|town|village|suburb|municipality"]["name"]',
];

// The preparation map includes recognizable local destinations as well as cultural sites.
// Keep this separate from the narration editor's existing radar.
const PREPARATION_FILTERS = [
    ...FILTERS,
    '["amenity"~"kindergarten|arts_centre|community_centre|research_institute|cinema|fast_food"]',
    '["tourism"~"gallery|information"]',
    '["leisure"~"garden|amusement_arcade|water_park"]',
    '["building"~"church|chapel|cathedral|mosque|temple|synagogue|school|university|college"]',
    '["man_made"="bridge"]',
    '["shop"~"supermarket|department_store|mall"]',
    '["aerialway"="station"]',
];

function namedStatements(filters, bounds, types = ['node', 'way']) {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    return filters.flatMap(filter => types.map(type => `${type}${filter}["name"](${bbox});`)).join('\n');
}

export function buildCulturalPoiQuery({ south, west, north, east }) {
    if (![south, west, north, east].every(Number.isFinite)
        || !coordinates(south, west) || !coordinates(north, east) || south >= north || west >= east) {
        throw new Error('La zona de búsqueda no es válida.');
    }
    return `[out:json][timeout:12][maxsize:8388608];(${namedStatements(FILTERS, { south, west, north, east })});out center 500;`;
}

export function buildPreparationPoiQuery(center, range = 'near') {
    const point = coordinates(center?.latitude, center?.longitude);
    if (!point || !['near', 'wide'].includes(range)) {
        throw new Error('La zona de búsqueda no es válida.');
    }
    const bounds = radarBounds({ latitude: point[0], longitude: point[1] }, range === 'near' ? 1200 : 5000);
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    // Named road bridges often carry bridge:name instead of a POI name. Search
    // unnamed road crossings only in the immediate neighborhood to avoid noise.
    const crossings = range === 'near' ? `way["highway"]["bridge"~"yes|viaduct|movable"]["name"](${bbox});` : '';
    const namedBridges = `way["highway"]["bridge:name"](${bbox});`;
    const output = range === 'near' ? 'out center qt;' : 'out center qt 1500;';
    return `[out:json][timeout:15][maxsize:16777216];(${namedStatements(PREPARATION_FILTERS, bounds, ['node', 'way', 'relation'])}\n${namedBridges}\n${crossings});${output}`;
}

export function buildNearbyNamedPoiQuery({ latitude, longitude, radius = 150 }) {
    if (!coordinates(latitude, longitude) || !Number.isFinite(radius) || radius < 25 || radius > 500) {
        throw new Error('La ubicación de búsqueda no es válida.');
    }
    return `[out:json][timeout:10][maxsize:4194304];(node["name"](around:${Math.round(radius)},${latitude},${longitude});way["name"](around:${Math.round(radius)},${latitude},${longitude});relation["name"](around:${Math.round(radius)},${latitude},${longitude}););out center 100;`;
}

export function radarBounds(center, radius = 3000) {
    if (!coordinates(center?.latitude, center?.longitude)) throw new Error('Ubicación no válida.');
    const latDelta = radius / 111320;
    const lngDelta = latDelta / Math.max(0.1, Math.cos(center.latitude * Math.PI / 180));
    return { south: center.latitude - latDelta, west: center.longitude - lngDelta, north: center.latitude + latDelta, east: center.longitude + lngDelta };
}

export function parseCulturalPois(elements, center, saved = [], radius = 3000) {
    if (!Array.isArray(elements)) throw new Error('El radar no devolvió una lista de lugares.');
    const result = [];
    const seen = new Set();
    const candidates = elements.flatMap(element => {
        const point = element.type === 'node' ? element : element.center;
        const location = coordinates(point?.lat, point?.lon);
        const tags = element.tags || {};
        const bridgeName = typeof tags['bridge:name'] === 'string' ? tags['bridge:name'].trim() : '';
        const standardName = typeof tags.name === 'string' ? tags.name.trim() : '';
        const isBridge = tags['bridge:name'] || tags.man_made === 'bridge' ||
            tags.highway && /^(yes|viaduct|movable)$/.test(tags.bridge || '');
        const name = bridgeName || (isBridge && tags.highway && standardName && !/^(puente|viaducto)/i.test(standardName)
            ? `Puente en ${standardName}` : standardName);
        if (!location || !name || !['node', 'way', 'relation'].includes(element.type) || !Number.isFinite(element.id)) return [];
        const category = tags.aerialway === 'station' ? 'cableway'
            : isBridge ? 'bridge'
            : tags.amenity === 'place_of_worship' || /^(church|chapel|cathedral|mosque|temple|synagogue)$/.test(tags.building) ? 'worship'
            : /^(school|kindergarten|college|university|research_institute)$/.test(tags.amenity) || /^(school|college|university)$/.test(tags.building) ? 'education'
            : tags.amenity === 'library' ? 'library'
            : tags.amenity === 'cinema' || tags.amenity === 'theatre' || tags.leisure === 'amusement_arcade' ? 'entertainment'
            : tags.shop === 'mall' || tags.shop === 'supermarket' || tags.shop === 'department_store' ? 'shopping'
            : tags.amenity === 'fast_food' ? 'food'
            : tags.leisure || tags.natural ? 'nature'
            : tags.tourism === 'museum' || tags.tourism === 'gallery' ? 'museum' : 'landmark';
        const poi = { id: `osm_${element.type}_${element.id}`, name, category,
            latitude: location[0], longitude: location[1], source: 'osm-radar' };
        return distanceMeters(center, poi) <= radius ? [poi] : [];
    }).sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b));
    for (const poi of candidates) {
        const duplicate = [...saved, ...result].some(other => other.name?.trim().toLocaleLowerCase('es') === poi.name.toLocaleLowerCase('es') && distanceMeters(other, poi) < 75);
        if (seen.has(poi.id) || duplicate) continue;
        seen.add(poi.id);
        result.push(poi);
        if (result.length >= 200) break;
    }
    return result;
}
