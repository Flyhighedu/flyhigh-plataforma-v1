import { EDUCATION_PHASES } from './education-phases.mjs';

export const NARRATION_PHASES = EDUCATION_PHASES.filter(phase => phase.number);
export const hasScript = version => !!version?.narrative_script?.trim();
export const missingPhases = versions => NARRATION_PHASES.filter(phase => !hasScript(versions[phase.id]));
export const pendingReviews = versions => NARRATION_PHASES.filter(phase => hasScript(versions[phase.id]) && (!versions[phase.id].reviewed_at || !versions[phase.id].learning_goal?.trim()));
export const pendingAudios = versions => NARRATION_PHASES.filter(phase => hasScript(versions[phase.id]) && versions[phase.id].reviewed_at && versions[phase.id].learning_goal?.trim() && !versions[phase.id].audio_url);
export function initialNarrationStep(_poi, versions) {
    return missingPhases(versions).length ? 1 : 2;
}

// Explicit confirmation of the complete set, never inferred from navigation.
export function confirmNarrations(versions, now = new Date().toISOString()) {
    if (missingPhases(versions).length) throw new Error('Completa los guiones que faltan antes de continuar.');
    if (NARRATION_PHASES.some(phase => !versions[phase.id].learning_goal?.trim())) throw new Error('Añade el propósito de aprendizaje del guion indicado.');
    return { ...versions, ...Object.fromEntries(pendingReviews(versions).map(phase => [phase.id, { ...versions[phase.id], reviewed_at: now }])) };
}

// Continue after a single failure, retaining each completed result. A retry is
// planned from the updated versions and therefore cannot overwrite successes.
export async function runNarrationBatch({ phases, signal, request, onProgress, onResult, onFailure }) {
    for (let index = 0; index < phases.length; index++) {
        if (signal.aborted) return;
        const phase = phases[index];
        onProgress(phase, index, phases.length);
        try {
            const result = await request(phase, signal);
            if (signal.aborted) return;
            onResult(phase, result);
        } catch (error) {
            if (signal.aborted || error.name === 'AbortError') return;
            onFailure(phase, error);
        }
    }
}
