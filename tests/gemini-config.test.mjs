import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { geminiApiKey } from '../src/lib/gemini-config.mjs';

test('Gemini remains available in the normal app; review uses only its explicit local key and refreshes it per request', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'flyhigh-gemini-'));
    const file = path.join(root, '.env.review.local');
    const normal = { NODE_ENV: 'production', GEMINI_API_KEY: 'normal-key' };
    const lab = { ...normal, NODE_ENV: 'development', FLYHIGH_REVIEW_LAB: '1', FLYHIGH_REVIEW_ENVIRONMENT: 'isolated-test' };
    try {
        assert.equal(geminiApiKey(normal, root), 'normal-key');
        assert.equal(geminiApiKey(lab, root), '', 'never silently inherit a normal key');
        writeFileSync(file, 'FLYHIGH_REVIEW_ENVIRONMENT=isolated-test\nGEMINI_API_KEY=review-key\n');
        assert.equal(geminiApiKey(lab, root), 'review-key');
        assert.equal(geminiApiKey(normal, root), 'normal-key');
        assert.equal(geminiApiKey({ ...lab, NODE_ENV: 'production' }, root), '');
        assert.equal(geminiApiKey({ ...lab, FLYHIGH_REVIEW_ENVIRONMENT: '' }, root), '');
        writeFileSync(file, 'FLYHIGH_REVIEW_ENVIRONMENT=isolated-test\nGEMINI_API_KEY=replacement\n');
        assert.equal(geminiApiKey(lab, root), 'replacement');
        writeFileSync(file, 'GEMINI_API_KEY=unmarked-environment\n');
        assert.equal(geminiApiKey(lab, root), '');
        writeFileSync(file, 'FLYHIGH_REVIEW_ENVIRONMENT=isolated-test\nGEMINI_API_KEY=\n');
        assert.equal(geminiApiKey(lab, root), '');
    } finally { unlinkSync(file); rmdirSync(root); }
});
