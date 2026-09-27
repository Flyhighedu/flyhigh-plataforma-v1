import { coordinates } from './narration-preparation.mjs';
import { buildCulturalPoiQuery, parseCulturalPois, radarBounds } from './cultural-pois.mjs';
import { distanceMeters } from './flight-rehearsal.mjs';

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
export function mapContextRequest(params) {
    const kind = params.get('kind');
    const lat = params.get('lat'), lng = params.get('lng');
    if (!['pois', 'streets'].includes(kind) || !lat?.trim() || !lng?.trim() || !coordinates(Number(lat), Number(lng))) throw new Error('Zona no válida');
    const center = { latitude: Math.round(Number(lat) * 1000) / 1000, longitude: Math.round(Number(lng) * 1000) / 1000 };
    return { kind, center, key: `${kind}:${center.latitude}:${center.longitude}` };
}
export function streetQuery(center) {
    const b = radarBounds(center, 1800);
    return `[out:json][timeout:12][maxsize:8388608];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"]["name"](${b.south},${b.west},${b.north},${b.east});out geom 180;`;
}
export function parseStreets(elements, center) {
    if (!Array.isArray(elements)) throw new Error('Calles no disponibles');
    return elements.flatMap(way => {
        if (way.type !== 'way' || !Number.isFinite(way.id) || !way.tags?.name || !Array.isArray(way.geometry)) return [];
        const geometry = way.geometry.filter(p => coordinates(p.lat, p.lon));
        if (geometry.length < 2 || geometry.length > 500) return [];
        const nearest = geometry.reduce((best, p) => distanceMeters(center, { latitude: p.lat, longitude: p.lon }) < distanceMeters(center, { latitude: best.lat, longitude: best.lon }) ? p : best);
        if (distanceMeters(center, { latitude: nearest.lat, longitude: nearest.lon }) > 2000) return [];
        return [{ id: `street_${way.id}`, name: String(way.tags.name).slice(0, 120), latitude: nearest.lat, longitude: nearest.lon, geometry, source: 'osm-street' }];
    }).sort((a, b) => distanceMeters(center, a) - distanceMeters(center, b)).slice(0, 120);
}

// Only public OSM data, bounded RAM cache. Never a Google imagery cache or DB write.
export function createMapContextLoader(fetcher = fetch, now = Date.now) {
    const cache = new Map();
    return async function load(request) {
        const existing = cache.get(request.key);
        if (existing && existing.expires > now()) return existing.promise;
        if (existing) cache.delete(request.key);
        if (cache.size >= 24) cache.delete(cache.keys().next().value);
        const entry = { expires: now() + 10 * 60 * 1000 };
        entry.promise = (async () => {
            const query = request.kind === 'streets' ? streetQuery(request.center) : buildCulturalPoiQuery(radarBounds(request.center));
            for (const endpoint of OVERPASS_ENDPOINTS) {
                try {
                    const response = await fetcher(endpoint, { method: 'POST', headers: { 'User-Agent': 'FlyHigh-LocalReview/1.0 (interactive school-visit map preview)', Accept: 'application/json' }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(16000), cache: 'no-store', redirect: 'error' });
                    if (!response.ok) { await response.body?.cancel(); continue; }
                    const data = await response.json();
                    if (data.remark || !Array.isArray(data.elements)) continue;
                    return { items: request.kind === 'streets' ? parseStreets(data.elements, request.center) : parseCulturalPois(data.elements, request.center), center: request.center };
                } catch { /* One bounded fallback, not an endless retry loop. */ }
            }
            entry.expires = now() + 30000;
            throw new Error('Los servidores del mapa están ocupados. Intenta de nuevo en unos momentos.');
        })();
        cache.set(request.key, entry);
        return entry.promise;
    };
}
