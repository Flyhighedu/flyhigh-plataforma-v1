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

export function buildCulturalPoiQuery({ south, west, north, east }) {
    if (![south, west, north, east].every(Number.isFinite)
        || !coordinates(south, west) || !coordinates(north, east) || south >= north || west >= east) {
        throw new Error('La zona de búsqueda no es válida.');
    }
    const bbox = `${south},${west},${north},${east}`;
    return `[out:json][timeout:12][maxsize:8388608];(${FILTERS.flatMap(filter => ['node', 'way'].map(type => `${type}${filter}["name"](${bbox});`)).join('\n')});out center 500;`;
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
        const name = typeof element.tags?.name === 'string' ? element.tags.name.trim() : '';
        if (!location || !name || !['node', 'way'].includes(element.type) || !Number.isFinite(element.id)) return [];
        const poi = { id: `osm_${element.type}_${element.id}`, name, latitude: location[0], longitude: location[1], source: 'osm-radar' };
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
