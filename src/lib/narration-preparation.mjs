import { readNarrations } from './narrative-versions.mjs';
import { EDUCATION_PHASES } from './education-phases.mjs';

export const MAX_SEQUENCE_ITEMS = 40;

export function coordinates(lat, lng) {
    if ([lat, lng].some(value => !['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim()))) return null;
    const pair = [Number(lat), Number(lng)];
    return pair.every(Number.isFinite) && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180 ? pair : null;
}

export function distanceKm(a, b) {
    if (!a || !b) return null;
    const rad = n => n * Math.PI / 180;
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function durationLabel(seconds) {
    if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return 'Duración por confirmar';
    const value = Math.round(Number(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function snapshot(poi, phaseId = poi.phase_id || 'general') {
    if (!EDUCATION_PHASES.some(phase => phase.id === phaseId)) throw new Error('Nivel educativo inválido.');
    const version = phaseId === 'general' ? poi : readNarrations(poi)[phaseId] || {};
    return {
        ...(phaseId !== 'general' ? { phase_id: phaseId } : {}),
        id: String(poi.id), name: poi.name,
        audio_url: version.audio_url || null,
        narrative_script: version.narrative_script || null,
        audio_duration_seconds: version.audio_duration_seconds || null,
        audio_generated_at: version.audio_generated_at || null,
    };
}

export function fingerprint(item) {
    return JSON.stringify([item.id, item.name, item.audio_url || null, item.narrative_script || null, item.audio_generated_at || null, ...(item.phase_id && item.phase_id !== 'general' ? [item.phase_id] : [])]);
}

export function usableAudio(url) {
    try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
}

export function sequenceChanged(items, catalog) {
    const byId = new Map(catalog.map(p => [String(p.id), p]));
    return items.some(item => !byId.has(item.id) || fingerprint(item) !== fingerprint(snapshot(byId.get(item.id), item.phase_id || 'general')));
}

export function buildSequence(selections, catalog, status) {
    if (!Array.isArray(selections)) throw new Error('Selección inválida.');
    const ids = selections.map(item => typeof item === 'string' ? item : item?.id);
    if (!Array.isArray(ids) || ids.length > MAX_SEQUENCE_ITEMS || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
        throw new Error('La secuencia debe contener narraciones únicas (máximo 40).');
    }
    if (!['draft', 'ready'].includes(status)) throw new Error('Estado de preparación inválido.');
    const byId = new Map(catalog.map(p => [String(p.id), p]));
    const items = ids.map((id, index) => {
        if (!byId.has(id)) throw new Error('Una narración ya no está disponible. Actualiza la biblioteca.');
        return snapshot(byId.get(id), typeof selections[index] === 'string' ? 'general' : selections[index].phase_id || 'general');
    });
    if (status === 'ready' && (!items.length || items.some(p => !usableAudio(p.audio_url)))) {
        throw new Error('Selecciona al menos una narración y comprueba que todas tengan audio.');
    }
    return items;
}

export function moveItem(items, index, direction) {
    const destination = index + direction;
    if (index < 0 || index >= items.length || destination < 0 || destination >= items.length) return items;
    const result = [...items];
    [result[index], result[destination]] = [result[destination], result[index]];
    return result;
}

export function visitLabel(date) {
    if (!date) return 'Fecha por confirmar';
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Pilot-selected coordinates belong to the preparation, never the school record.
export function preparationContext(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Preparación inválida.');
    const phaseId = input.phase_id || 'general';
    if (!EDUCATION_PHASES.some(phase => phase.id === phaseId)) throw new Error('Nivel educativo inválido.');
    let location = null;
    if (input.school_location != null) {
        const pair = coordinates(input.school_location.latitude, input.school_location.longitude);
        if (!pair) throw new Error('Ubicación escolar inválida.');
        location = { latitude: pair[0], longitude: pair[1], source: 'pilot' };
    }
    return { phase_id: phaseId, school_location: location, ...(input.review !== undefined ? { review: null } : {}) };
}
export function mergePreparedSources(catalog, sources) {
    return catalog.map(poi => sources.filter(item => item.id === String(poi.id)).reduce((result, item) => {
        const narration = snapshot(item, 'general');
        const source = item.model_version === 2 ? { ...result, latitude: item.location?.latitude ?? null, longitude: item.location?.longitude ?? null, is_general_topic: item.is_general_topic } : result;
        return item.phase_id && item.phase_id !== 'general'
            ? { ...source, narrative_versions: { ...source.narrative_versions, [item.phase_id]: { ...source.narrative_versions?.[item.phase_id], ...narration } } }
            : { ...source, ...narration };
    }, poi));
}
