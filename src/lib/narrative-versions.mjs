import { educationPhase } from './education-phases.mjs';

export function emptyNarration() {
    return { narrative_script: '', learning_goal: '', custom_instructions: '', curriculum_focus: 'context', review_note: '', reviewed_at: null, audio_url: null, audio_duration_seconds: null, audio_generated_at: null };
}

export function readNarrations(poi = {}) {
    const versions = { general: { ...emptyNarration(), narrative_script: poi.narrative_script || '', audio_url: poi.audio_url || null, audio_duration_seconds: poi.audio_duration_seconds || null, audio_generated_at: poi.audio_generated_at || null } };
    for (const [key, value] of Object.entries(poi.narrative_versions || {})) {
        if (educationPhase(key)?.number && value && typeof value === 'object') versions[key] = { ...emptyNarration(), ...value };
    }
    return versions;
}

export function editNarration(versions, phaseId, changes) {
    const previous = versions[phaseId] || emptyNarration();
    const next = { ...previous, ...changes };
    const scriptChanged = changes.narrative_script !== undefined && changes.narrative_script !== previous.narrative_script;
    const intentChanged = ['learning_goal', 'curriculum_focus'].some(key => changes[key] !== undefined && changes[key] !== previous[key]);
    if (scriptChanged) { next.audio_url = null; next.audio_duration_seconds = null; next.audio_generated_at = null; }
    if (scriptChanged || intentChanged) next.reviewed_at = null;
    return { ...versions, [phaseId]: next };
}

export function narrationStatus(version, phaseId) {
    if (!version?.narrative_script?.trim()) return 'Sin crear';
    if (phaseId !== 'general' && !version.reviewed_at) return 'Borrador';
    return version.audio_url ? 'Con audio' : 'Sin audio';
}

export function serializeNarrations(versions) {
    const general = versions.general || emptyNarration();
    return {
        narrative_script: general.narrative_script || null,
        audio_url: general.audio_url || null,
        audio_duration_seconds: general.audio_duration_seconds || null,
        audio_generated_at: general.audio_generated_at || null,
        narrative_versions: Object.fromEntries(Object.entries(versions).filter(([key]) => educationPhase(key)?.number)),
    };
}

export function validateNarrativeVersions(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(value).every(([key, item]) => educationPhase(key)?.number && item && typeof item === 'object' && !Array.isArray(item) &&
        typeof item.narrative_script === 'string' && item.narrative_script.length <= 10000 &&
        (item.curriculum_focus === 'context' || item.curriculum_focus === 'nature') &&
        Object.entries({ learning_goal: 220, custom_instructions: 5000, review_note: 2000 }).every(([field, limit]) => typeof item[field] === 'string' && item[field].length <= limit) &&
        ['reviewed_at', 'audio_generated_at'].every(field => item[field] == null || (typeof item[field] === 'string' && Number.isFinite(Date.parse(item[field])))) &&
        (item.audio_duration_seconds == null || (Number.isFinite(item.audio_duration_seconds) && item.audio_duration_seconds >= 0)) &&
        (!item.audio_url || (typeof item.audio_url === 'string' && /^https?:\/\//.test(item.audio_url))));
}
