// =====================================================
// triggerAudioAudit.js
//
// Fire-and-forget utility to trigger AI quality analysis
// on a recorded audio clip. Called AFTER the audio has
// been successfully uploaded to Supabase Storage.
//
// SAFETY: This function is fully non-blocking.
//         - It catches all errors silently.
//         - It never throws.
//         - It never blocks the caller's UI or workflow.
//         - ISA can continue operating even if this fails.
//
// RETURNS: The scorecard object if analysis succeeds and
//          score < threshold, or null otherwise.
// =====================================================

const LOW_SCORE_THRESHOLD = 60;

/**
 * Triggers an async audio quality audit via the backend.
 *
 * @param {object} params
 * @param {string} params.audioUrl      - Public URL of the uploaded audio
 * @param {string} params.journeyId     - Current journey/mission ID
 * @param {number} [params.flightNumber] - Tanda/flight number
 * @param {string} [params.source]      - 'bitacora' (default) or 'civic'
 * @param {string} [params.userId]      - ID of the person who recorded
 * @param {number} [params.durationSeconds] - Recording duration in seconds
 * @param {function} [params.onFeedback] - Callback if ISA needs feedback (score < threshold)
 *
 * @returns {Promise<object|null>} Scorecard if low score, null otherwise
 */
export async function triggerAudioAudit({
    audioUrl,
    journeyId,
    flightNumber,
    source = 'bitacora',
    userId,
    durationSeconds,
    onFeedback
}) {
    try {
        if (!audioUrl || !journeyId) return null;

        const res = await fetch('/api/staff/analyze-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audioUrl,
                journeyId,
                flightNumber,
                source,
                userId,
                durationSeconds
            })
        });

        if (!res.ok) {
            console.warn('⚠️ Audio audit request failed:', res.status);
            return null;
        }

        const data = await res.json();

        if (!data.ok) {
            console.warn('⚠️ Audio audit returned error:', data.error);
            return null;
        }

        // Always notify ISA with the results if callback is provided
        if (
            data.score !== undefined &&
            typeof onFeedback === 'function'
        ) {
            // Determine strikes based on checklist
            const strikes = [];
            if (data.menciona_nombre_equipo === false) strikes.push('Faltó el nombre del equipo');
            if (data.menciona_destino === false) strikes.push('Faltó mencionar el destino');
            if (data.dinamica_sube_sube === false) strikes.push('Faltó la dinámica ¡Sube Sube!');
            if (data.participacion_ninos_audible === false) strikes.push('Faltó participación de los niños');

            onFeedback({
                score: data.score,
                feedback: data.feedback_para_isa,
                auditId: data.auditId,
                strikes: strikes
            });
        }

        return data;
    } catch (err) {
        // Fully silent — never disrupt ISA's workflow
        console.warn('⚠️ triggerAudioAudit error (non-blocking):', err?.message || err);
        return null;
    }
}
