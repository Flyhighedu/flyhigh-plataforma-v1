import { EDUCATION_PHASES, hasUsableResearch } from './education-phases.mjs';

export const NARRATION_PHASES = EDUCATION_PHASES.filter(phase => phase.number);
export const hasScript = version => !!version?.narrative_script?.trim();
export const missingPhases = versions => NARRATION_PHASES.filter(phase => !hasScript(versions[phase.id]));
export const pendingReviews = versions => NARRATION_PHASES.filter(phase => hasScript(versions[phase.id]) && (!versions[phase.id].reviewed_at || !versions[phase.id].learning_goal?.trim()));
export const pendingAudios = versions => NARRATION_PHASES.filter(phase => hasScript(versions[phase.id]) && versions[phase.id].reviewed_at && versions[phase.id].learning_goal?.trim() && !versions[phase.id].audio_url);
export function initialNarrationStep(poi, versions) {
    if (!missingPhases(versions).length) return 3;
    return hasUsableResearch(poi.research_article) ? 2 : 1;
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
