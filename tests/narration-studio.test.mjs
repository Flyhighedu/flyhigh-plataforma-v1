import test from 'node:test';
import assert from 'node:assert/strict';
import { NARRATION_PHASES, confirmNarrations, finishNarrations, initialNarrationStep, narrationReadiness } from '../src/lib/narration-workflow.mjs';
import { readNarrations, editNarration } from '../src/lib/narrative-versions.mjs';
import { swipeDestination } from '../src/lib/narration-gestures.mjs';
import { readResearchStream } from '../src/lib/research-stream.mjs';
import { buildPhasePrompt } from '../src/lib/education-phases.mjs';

function reviewed() {
    let versions = readNarrations({ narrative_script: 'General conservada.', audio_url: 'https://example.org/general.wav' });
    for (const phase of NARRATION_PHASES) versions = editNarration(versions, phase.id, { narrative_script: 'Este es el lugar.', learning_goal: 'Reconocer el lugar.' });
    return confirmNarrations(versions);
}

test('legacy cards expose zero phases; reviewed scripts resume at audio, never look complete without audio', () => {
    const legacy = readNarrations({ narrative_script: 'Original' });
    assert.equal(narrationReadiness(legacy).label, 'Fases pendientes · 0/5');
    assert.equal(initialNarrationStep({}, legacy), 1);
    const versions = reviewed();
    assert.equal(initialNarrationStep({}, versions), 3);
    assert.equal(narrationReadiness(versions).ready, false);
});

test('finish reuses samples, retains partial success and saves only when every audio exists', async () => {
    let versions = reviewed(), fail = true;
    versions.phase_2.audio_url = 'https://example.org/sample.wav';
    const calls = [], saves = [], failures = [];
    const options = () => ({ versions, signal: new AbortController().signal, onProgress() {},
        request: async phase => { calls.push(phase.id); if (phase.id === 'phase_4' && fail) throw new Error('Offline'); return { audio_url: 'https://example.org/' + phase.id }; },
        onVersions: next => { versions = next; }, onFailure: phase => failures.push(phase.id), save: async next => saves.push(next),
    });
    await finishNarrations(options());
    assert.equal(saves.length, 0);
    assert.deepEqual(failures, ['phase_4']);
    assert.equal(calls.length, 4);
    fail = false;
    await finishNarrations(options());
    assert.equal(calls.length, 5);
    assert.equal(calls.at(-1), 'phase_4');
    assert.equal(saves.length, 1);
    assert.equal(saves[0].general.audio_url, 'https://example.org/general.wav');
    assert.equal(saves[0].phase_2.audio_url, 'https://example.org/sample.wav');
    assert.equal(narrationReadiness(saves[0]).ready, true);
    const edited = editNarration(versions, 'phase_2', { narrative_script: 'Un cambio.' });
    assert.equal(edited.phase_2.audio_url, null);
    assert.equal(edited.phase_3.audio_url, versions.phase_3.audio_url);
    await assert.rejects(finishNarrations({ ...options(), versions: edited }), /Revisa/);
});

test('failed save retries persistence without regenerating; stopping never saves', async () => {
    let versions = reviewed(), requests = 0;
    const options = { signal: new AbortController().signal, onProgress() {}, onFailure() {}, onVersions: next => { versions = next; },
        request: async () => { requests++; return { audio_url: 'https://example.org/audio' }; }, save: async () => { throw new Error('Save unavailable'); },
    };
    await assert.rejects(finishNarrations({ ...options, versions }), /Save unavailable/);
    assert.equal(requests, 5);
    let saved = false;
    await finishNarrations({ ...options, versions, save: async () => { saved = true; } });
    assert.equal(requests, 5); assert.equal(saved, true);
    const controller = new AbortController(); saved = false;
    await finishNarrations({ ...options, versions: reviewed(), signal: controller.signal,
        request: async () => { controller.abort(); return { audio_url: 'https://example.org/late' }; }, save: async () => { saved = true; },
    });
    assert.equal(saved, false);
});

test('gesture distinguishes tap, vertical reading, slow drag, flick and boundaries', () => {
    const base = { index: 2, count: 5, width: 360, dx: 0, dy: 0, elapsed: 300 };
    assert.equal(swipeDestination({ ...base, dx: 4 }), 2);
    assert.equal(swipeDestination({ ...base, dx: 90, dy: 100 }), 2);
    assert.equal(swipeDestination({ ...base, dx: -100 }), 3);
    assert.equal(swipeDestination({ ...base, dx: 40, elapsed: 40 }), 1);
    assert.equal(swipeDestination({ ...base, dx: 120, index: 0 }), 0);
    assert.equal(swipeDestination({ ...base, dx: -120, index: 4 }), 4);
});

test('research progress survives split UTF-8 chunks and rejects interrupted/error responses', async () => {
    const body = new TextEncoder().encode('{"type":"progress","message":"Organizando tu investigación"}\n{"type":"result","data":{"article":"Lista"}}\n');
    const stream = new ReadableStream({ start(controller) { for (const byte of body) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
    const messages = [];
    const result = await readResearchStream(new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } }), text => messages.push(text));
    assert.equal(result.article, 'Lista');
    assert.deepEqual(messages, ['Organizando tu investigación']);
    await assert.rejects(readResearchStream(new Response('{"type":"progress","message":"Buscando"}\n', { headers: { 'content-type': 'application/x-ndjson' } }), () => {}), /interrumpió/);
    await assert.rejects(readResearchStream(Response.json({ error: 'Sin conexión' }, { status: 503 }), () => {}), /Sin conexión/);
});

test('tour narration presents the place without inventing camera directions; topics remain separate', () => {
    const input = { poiName: 'Cupatitzio', phaseId: 'phase_2', researchArticle: 'Información verificada de fuentes del lugar. '.repeat(5) };
    const place = buildPhasePrompt(input);
    assert.match(place, /guía de un recorrido/);
    assert.match(place, /No inventes orientación/);
    assert.match(buildPhasePrompt({ ...input, isGeneralTopic: true }), /sin fingir que corresponde a un lugar visible/);
});
