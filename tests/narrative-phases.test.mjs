import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EDUCATION_PHASES, educationPhase, curriculumReference, buildPhasePrompt, hasUsableResearch } from '../src/lib/education-phases.mjs';
import { editNarration, emptyNarration, readNarrations, serializeNarrations, narrationStatus, validateNarrativeVersions } from '../src/lib/narrative-versions.mjs';

const article = 'El parque se encuentra en Uruapan, Michoacán. En él nacen manantiales que forman el río Cupatitzio. Fuente: CONANP.';
const saved = { ...emptyNarration(), narrative_script: 'Guion original de esta fase.', learning_goal: 'Reconocer un río.', reviewed_at: '2026-09-27T12:00:00Z', audio_url: 'https://example.org/audio.wav', audio_duration_seconds: 15, audio_generated_at: '2026-09-27T12:00:00Z' };

test('curriculum covers preschool through secondary with explicit grade scope', () => {
    assert.deepEqual(EDUCATION_PHASES.filter(p => p.number).map(p => p.number), [2, 3, 4, 5, 6]);
    assert.equal(educationPhase('phase_1'), undefined);
    assert.match(educationPhase('phase_4').label, /3.º y 4.º de primaria/);
    assert.match(curriculumReference('phase_6', 'nature').scope, /Geografía, 1.º de secundaria/);
    assert.match(curriculumReference('phase_3').summary, /pendiente de revisión pedagógica/);
    assert.equal(curriculumReference('general'), null);
    for (const p of EDUCATION_PHASES.filter(p => p.number)) assert.equal(new URL(curriculumReference(p.id).sourceUrl).hostname, 'educacionbasica.sep.gob.mx');
});

test('phase prompts refuse missing research and distinguish facts from educational guidance', () => {
    assert.equal(hasUsableResearch('No fue posible investigar. ' + 'x'.repeat(200)), false);
    assert.throws(() => buildPhasePrompt({ phaseId: 'general', researchArticle: article }));
    assert.throws(() => buildPhasePrompt({ phaseId: 'phase_2', researchArticle: '' }));
    const prompt = buildPhasePrompt({ phaseId: 'phase_6', focus: 'nature', poiName: 'Cupatitzio', researchArticle: article });
    assert.match(prompt, /Geografía, 1.º de secundaria/);
    assert.match(prompt, /ÚNICA base factual/);
    assert.match(prompt, /no requisitos de la SEP/);
    assert.match(prompt, /no demuestra que se alcanzó un aprendizaje/);
});

test('editing one phase clears only its obsolete review and audio', () => {
    const original = readNarrations({ narrative_script: 'General heredado', audio_url: 'https://example.org/general.wav', narrative_versions: { phase_2: saved, phase_3: saved } });
    const changed = editNarration(original, 'phase_2', { narrative_script: 'Otra narración.' });
    assert.equal(changed.phase_2.audio_url, null);
    assert.equal(changed.phase_2.audio_duration_seconds, null);
    assert.equal(changed.phase_2.reviewed_at, null);
    assert.deepEqual(changed.phase_3, saved);
    assert.deepEqual(changed.general, original.general);
    assert.equal(original.phase_2.audio_url, saved.audio_url);
    const serialized = serializeNarrations(changed);
    assert.equal(serialized.narrative_script, 'General heredado');
    assert.equal(serialized.audio_url, 'https://example.org/general.wav');
    assert.equal(serialized.narrative_versions.general, undefined);
    assert.deepEqual(readNarrations(serialized), changed);
});

test('changing educational intent requires review; selecting or reusing identical text preserves audio', () => {
    const versions = { phase_2: saved };
    const same = editNarration(versions, 'phase_2', { narrative_script: saved.narrative_script });
    assert.deepEqual(same.phase_2, saved);
    const changed = editNarration(versions, 'phase_2', { learning_goal: 'Observar el agua.' });
    assert.equal(changed.phase_2.reviewed_at, null);
    assert.equal(changed.phase_2.audio_url, saved.audio_url);
    assert.equal(narrationStatus(changed.phase_2, 'phase_2'), 'Borrador');
    assert.equal(narrationStatus(saved, 'phase_2'), 'Con audio');
    assert.equal(narrationStatus(emptyNarration(), 'phase_3'), 'Sin crear');
});

test('drafts without audio are valid; malformed phases, metadata and payloads are rejected', () => {
    assert.equal(validateNarrativeVersions({ phase_2: { ...emptyNarration(), narrative_script: 'Borrador' } }), true);
    assert.equal(validateNarrativeVersions({ phase_3: saved }), true);
    for (const input of [null, [], { general: saved }, { phase_1: saved }, { phase_2: { ...saved, audio_url: 'javascript:alert(1)' } }, { phase_2: { ...saved, audio_duration_seconds: -1 } }, { phase_2: { ...saved, reviewed_at: 'yesterday' } }, { phase_2: { ...saved, learning_goal: 'x'.repeat(221) } }]) assert.equal(validateNarrativeVersions(input), false);
});

// Exercise the real route implementation with only its external services replaced.
async function loadRoute(name, replacements) {
    let source = readFileSync(new URL(`../src/app/api/${name}/route.js`, import.meta.url), 'utf8');
    source = source.replace("import { NextResponse } from 'next/server';", 'const NextResponse = Response;')
        .replace("from '@/lib/education-phases.mjs'", `from '${new URL('../src/lib/education-phases.mjs', import.meta.url).href}'`);
    for (const [from, to] of replacements) source = source.replace(from, to);
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const request = body => new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('script API validates phase, research and model output before returning a proposal', async () => {
    const old = process.env.GEMINI_API_KEY;
    let modelOutput;
    let prompt;
    globalThis.__phaseTestModel = class { getGenerativeModel() { return { generateContent: async value => { prompt = value; return { response: { text: () => modelOutput } }; } }; } };
    try {
        const { POST } = await loadRoute('poi-generate-script', [["import { GoogleGenerativeAI } from '@google/generative-ai';", 'const GoogleGenerativeAI = globalThis.__phaseTestModel;']]);
        const valid = { poiName: 'Cupatitzio', phaseId: 'phase_2', researchArticle: article, curriculumFocus: 'nature' };
        assert.equal((await POST(request({ ...valid, phaseId: 'phase_7' }))).status, 400);
        assert.equal((await POST(request({ ...valid, researchArticle: 'Error' }))).status, 400);
        delete process.env.GEMINI_API_KEY;
        assert.equal((await POST(request(valid))).status, 503);
        process.env.GEMINI_API_KEY = 'mock-only';
        for (modelOutput of ['not JSON', 'null', '{}']) assert.equal((await POST(request(valid))).status, 502);
        modelOutput = JSON.stringify({ error: 'Faltan datos del lugar.' });
        assert.equal((await POST(request(valid))).status, 422);
        modelOutput = JSON.stringify({ script: 'Cupatitzio tiene manantiales que forman un río.', learning_goal: 'Observar el agua.', review_note: 'Revisar el contexto del grupo.' });
        const result = await POST(request(valid));
        assert.equal(result.status, 200);
        assert.equal((await result.json()).phaseId, 'phase_2');
        assert.match(prompt, /Preescolar/);
    } finally { delete globalThis.__phaseTestModel; if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; }
});

test('audio API keeps phase files separate and measures duration from actual PCM bytes', async () => {
    const oldKey = process.env.GEMINI_API_KEY, oldFetch = globalThis.fetch;
    const paths = [];
    const buffers = [];
    globalThis.__phaseTestStorage = () => ({ storage: { from: () => ({ upload: async (path, buffer) => { paths.push(path); buffers.push(buffer); return {}; }, getPublicUrl: path => ({ data: { publicUrl: `https://example.org/${path}` } }) }) } });
    try {
        const { POST } = await loadRoute('poi-generate-audio', [["import { createClient } from '@supabase/supabase-js';", 'const createClient = globalThis.__phaseTestStorage;']]);
        const input = { poiId: 'local-point', narrativeScript: 'Un texto de prueba.', phaseId: 'phase_2' };
        delete process.env.GEMINI_API_KEY;
        assert.equal((await POST(request(input))).status, 503);
        assert.equal((await POST(request({ ...input, poiId: '../../other' }))).status, 400);
        assert.equal((await POST(request({ ...input, narrativeScript: '  ' }))).status, 400);
        process.env.GEMINI_API_KEY = 'mock-only';
        globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.alloc(48000 * 7).toString('base64') } }] } }] });
        for (const phaseId of ['phase_2', 'phase_3', 'phase_2']) {
            const result = await POST(request({ ...input, phaseId }));
            assert.equal(result.status, 200);
            assert.equal((await result.json()).audio_duration_seconds, 7);
        }
        assert.match(paths[0], /local-point\/phase_2\//);
        assert.match(paths[1], /local-point\/phase_3\//);
        assert.equal(new Set(paths).size, 3);
        assert.equal(buffers[0].subarray(0, 4).toString(), 'RIFF');
        assert.equal(buffers[0].length, 48000 * 7 + 44);
    } finally { globalThis.fetch = oldFetch; delete globalThis.__phaseTestStorage; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
});
