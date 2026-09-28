import { buildSequence, coordinates, fingerprint, preparationContext, snapshot, usableAudio } from './narration-preparation.mjs';
import { readNarrations } from './narrative-versions.mjs';

export const PREPARATION_MODEL_VERSION = 2;
export function hasCreatedNarration(poi) {
    if (!poi || poi.source === 'osm-radar') return false;
    return Object.values(readNarrations(poi)).some(version => Boolean(version.narrative_script?.trim() || usableAudio(version.audio_url)));
}
export function poiLocation(poi) {
    const pair = coordinates(poi?.latitude, poi?.longitude);
    return pair ? { latitude: pair[0], longitude: pair[1] } : null;
}
export function poiBehavior(value = 'route') {
    if (!['route', 'reference'].includes(value)) throw new Error('Comportamiento del lugar inválido.');
    return value;
}
// The server supplies geography and narration; a selection only supplies intent.
export function preparationItem(poi, phase = 'general', behavior = 'route') {
    return { ...snapshot(poi, phase), model_version: PREPARATION_MODEL_VERSION,
        behavior: poiBehavior(behavior), location: poi.is_general_topic ? null : poiLocation(poi),
        is_general_topic: Boolean(poi.is_general_topic) };
}
export function buildPreparationSequence(selections, catalog, status, previous = []) {
    // Preparation chooses places. The operation screen will resolve the narration
    // for the person flying, so an unfinished audio must not block a place.
    const narrations = buildSequence(selections, catalog, status === 'ready' ? 'draft' : status);
    if (status === 'ready' && !narrations.length) throw new Error('Agrega al menos un lugar antes de confirmar.');
    const byId = new Map(catalog.map(poi => [String(poi.id), poi]));
    const old = new Map(previous.map(item => [item.id, item]));
    const items = narrations.map((item, index) => preparationItem(byId.get(item.id), item.phase_id || 'general',
        selections[index]?.behavior ?? old.get(item.id)?.behavior ?? 'route'));
    if (status === 'ready' && items.some(item => !item.is_general_topic && !item.location)) throw new Error('Hay lugares sin ubicación. Completa su ubicación o quítalos antes de confirmar.');
    return items;
}
export function normalizePreparationItems(items = [], catalog = []) {
    const sources = new Map(catalog.map(poi => [String(poi.id), poi]));
    return items.map(item => {
        const source = sources.get(String(item.id));
        // Upgrade legacy metadata without silently replacing the saved narration.
        const geographic = item.model_version === 2 ? item : source || item;
        return { ...item, id: String(item.id), model_version: 2,
            behavior: poiBehavior(item.behavior), is_general_topic: Boolean(geographic.is_general_topic),
            location: geographic.is_general_topic ? null : item.model_version === 2 ? poiLocation(item.location) : poiLocation(geographic) };
    });
}
export function preparationItemFingerprint(item) {
    return JSON.stringify([String(item.id), item.name, poiBehavior(item.behavior),
        Boolean(item.is_general_topic), poiLocation(item.location)]);
}
export function preparationContentChanged(items, catalog) {
    const sources = new Map(catalog.map(poi => [String(poi.id), poi]));
    return items.some(item => {
        const source = sources.get(String(item.id));
        if (!source) return true;
        const latest = preparationItem(source, item.phase_id || 'general', item.behavior);
        // Old records did not capture location or duration in their fingerprint.
        return item.model_version === 2 ? preparationItemFingerprint(item) !== preparationItemFingerprint(latest)
            : fingerprint(item) !== fingerprint(latest);
    });
}
export function derivePreparation(items, context) {
    const home = poiLocation(context?.school_location);
    const points = items.filter(item => !item.is_general_topic && item.behavior !== 'reference' && poiLocation(item.location));
    const references = items.filter(item => !item.is_general_topic && item.behavior === 'reference');
    const missingLocations = items.filter(item => !item.is_general_topic && !poiLocation(item.location));
    // Only physical stops define the circuit. Narrative order remains in items.
    const geometry = home ? [home, ...points.map(item => item.location), home] : [];
    return { home, points, references, missingLocations, geometry,
        canConfirm: Boolean(home && items.length && !missingLocations.length) };
}
export function preparationFingerprint(items, context) {
    return JSON.stringify([preparationContext(context), items.map(preparationItemFingerprint)]);
}

// Display-only clustering: never ranks, recommends, removes or reorders a POI.
export function clusterMapPoints(points, project, cellSize = 64) {
    const cells = new Map();
    for (const point of points) {
        const pixel = project(point);
        const key = `${Math.floor(pixel.x / cellSize)}:${Math.floor(pixel.y / cellSize)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(point);
    }
    return [...cells.values()];
}

export function groupPreparationMapPoints(points, project, zoom) {
    const narrated = points.filter(hasCreatedNarration);
    const unexplored = points.filter(point => !hasCreatedNarration(point));
    return { narrated, groups: zoom >= 14
        ? unexplored.map(point => [point])
        : clusterMapPoints(unexplored, project, 80) };
}
