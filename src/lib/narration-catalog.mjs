import { narrationReadiness } from './narration-workflow.mjs';
import { readNarrations } from './narrative-versions.mjs';
export function catalogStatus(poi) {
    const readiness = narrationReadiness(readNarrations(poi));
    return { ...readiness, label: !readiness.scripts && (poi.narrative_script || poi.audio_url) ? 'Solo narración general' : readiness.label };
}
export function filterNarrations(pois, { query = '', source = 'all', kind = 'all', pending = false } = {}) {
    const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    return pois.filter(poi => normalize(poi.name).includes(normalize(query))
        && (source === 'all' || (source === 'official' ? poi.is_official : !poi.is_official))
        && (kind === 'all' || (kind === 'topics' ? poi.is_general_topic : !poi.is_general_topic))
        && (!pending || !catalogStatus(poi).ready));
}
export function catalogAudio(poi, phaseId) {
    const version = readNarrations(poi)[phaseId];
    return version?.audio_url ? { ...version, id: String(poi.id) + ':' + phaseId, name: poi.name } : null;
}

export function findExistingPlace(pois, candidate) {
    const lat = Number(candidate.latitude), lng = Number(candidate.longitude);
    if (candidate.latitude == null || candidate.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return pois.find(poi => !poi.is_general_topic && (poi.latitude ?? poi.lat) != null && (poi.longitude ?? poi.lng) != null && normalize(poi.name) === normalize(candidate.name) && Math.abs(Number(poi.latitude ?? poi.lat)-lat) < .002 && Math.abs(Number(poi.longitude ?? poi.lng)-lng) < .002) || null;
}
