import test from 'node:test';
import assert from 'node:assert/strict';
import { NARRATION_PHASES, initialNarrationStep, confirmNarrations, missingPhases, pendingReviews, pendingAudios, runNarrationBatch } from '../src/lib/narration-workflow.mjs';
import { editNarration, readNarrations } from '../src/lib/narrative-versions.mjs';

const research = 'Información del lugar verificada en sus fuentes oficiales. '.repeat(4);
const draft = { narrative_script: 'Conozcamos este lugar.', learning_goal: 'Reconocer el lugar.' };

test('entry resumes research, missing versions or review without choosing an audience', () => {
    const original = readNarrations({ narrative_script: 'Original', audio_url: 'https://example.org/original.wav' });
    assert.equal(initialNarrationStep({}, original), 1);
    assert.equal(initialNarrationStep({ research_article: research }, original), 1);
    let complete = original;
    for (const phase of NARRATION_PHASES) complete = editNarration(complete, phase.id, draft);
    assert.equal(initialNarrationStep({}, complete), 2);
    assert.equal(pendingReviews(complete).length, 5);
});

test('batch continues after failure; retry only fills missing versions and preserves originals', async () => {
    const original = { narrative_script: 'Original', audio_url: 'https://example.org/original.wav' };
    let versions = editNarration(readNarrations(original), 'phase_3', { ...draft, audio_url: 'https://example.org/existing.wav' });
    // An existing saved audio is independent of generation for missing phases.
    versions.phase_3.audio_url = 'https://example.org/existing.wav';
    const existing = versions.phase_3;
    const calls = [], failures = [];
    let fail = true;
    const batch = () => runNarrationBatch({ phases: missingPhases(versions), signal: new AbortController().signal,
        onProgress() {}, request: async phase => { calls.push(phase.id); if (phase.id === 'phase_4' && fail) throw new Error('Offline'); return draft; },
        onResult: (phase, result) => { versions = editNarration(versions, phase.id, result); },
        onFailure: phase => failures.push(phase.id),
    });
    await batch();
    assert.deepEqual(calls, ['phase_2', 'phase_4', 'phase_5', 'phase_6']);
    assert.deepEqual(failures, ['phase_4']);
    assert.deepEqual(missingPhases(versions).map(phase => phase.id), ['phase_4']);
    fail = false;
    await batch();
    assert.equal(calls.at(-1), 'phase_4');
    assert.equal(calls.length, 5);
    assert.equal(versions.phase_3, existing);
    assert.equal(versions.general.audio_url, original.audio_url);
    assert.equal(missingPhases(versions).length, 0);
});

test('stopping a batch keeps completed results and discards late responses', async () => {
    const controller = new AbortController();
    const completed = [], calls = [];
    await runNarrationBatch({ phases: NARRATION_PHASES, signal: controller.signal, onProgress() {},
        request: async phase => { calls.push(phase.id); if (calls.length === 2) controller.abort(); return draft; },
        onResult: phase => completed.push(phase.id), onFailure: () => assert.fail('Cancellation is not a generation error'),
    });
    assert.deepEqual(completed, ['phase_2']);
    assert.deepEqual(calls, ['phase_2', 'phase_3']);
});

test('only reviewed scripts with a learning purpose and no audio enter audio generation', () => {
    const versions = {
        phase_2: { ...draft },
        phase_3: { ...draft, reviewed_at: '2026-09-27T00:00:00Z' },
        phase_4: { ...draft, reviewed_at: '2026-09-27T00:00:00Z', audio_url: 'https://example.org/audio.wav' },
        phase_5: { ...draft, reviewed_at: '2026-09-27T00:00:00Z', learning_goal: '' },
    };
    assert.deepEqual(pendingAudios(versions).map(phase => phase.id), ['phase_3']);
    assert.deepEqual(pendingReviews(versions).map(phase => phase.id), ['phase_2', 'phase_5']);
});


test('one explicit confirmation reviews the complete set and preserves existing timestamps and audio', () => {
    let versions = readNarrations({ narrative_script: 'Original', audio_url: 'https://example.org/original.wav' });
    assert.throws(() => confirmNarrations(versions), /Completa/);
    for (const phase of NARRATION_PHASES) versions = editNarration(versions, phase.id, draft);
    versions.phase_3 = { ...versions.phase_3, reviewed_at: '2026-09-01T00:00:00Z', audio_url: 'https://example.org/3.wav' };
    const original = versions.general, existing = versions.phase_3;
    const confirmed = confirmNarrations(versions, '2026-09-27T00:00:00Z');
    assert.equal(pendingReviews(confirmed).length, 0);
    assert.equal(pendingReviews(versions).length, 4);
    assert.equal(confirmed.general, original);
    assert.equal(confirmed.phase_3, existing);
    assert.equal(confirmed.phase_2.reviewed_at, '2026-09-27T00:00:00Z');
    const edited = editNarration(confirmed, 'phase_2', { narrative_script: 'Texto corregido.' });
    assert.deepEqual(pendingReviews(edited).map(p => p.id), ['phase_2']);
    assert.throws(() => confirmNarrations(editNarration(edited, 'phase_2', { learning_goal: '' })), /propósito/);
});
