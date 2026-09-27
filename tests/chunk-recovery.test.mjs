import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError, recoverChunkLoad } from '../src/lib/chunk-recovery.mjs';

const chunkError = new Error('Loading chunk app/staff/narraciones/page failed. (missing: http://localhost/_next/static/chunks/app/staff/narraciones/page.js)');

function browserFixture() {
    const storage = new Map();
    let reloads = 0;
    return {
        navigator: { onLine: true },
        location: { pathname: '/staff/narraciones', reload() { reloads++; } },
        sessionStorage: {
            getItem: key => storage.get(key),
            setItem: (key, value) => storage.set(key, value),
        },
        get reloads() { return reloads; },
    };
}

test('recognizes the reported missing chunk and browser import failures', () => {
    for (const error of [chunkError, { name: 'ChunkLoadError' },
        new Error('Loading CSS chunk 12 failed.'),
        new TypeError('Failed to fetch dynamically imported module: /module.js'),
        new TypeError('Importing a module script failed.')]) {
        assert.equal(isChunkLoadError(error), true);
    }
    for (const error of [undefined, new Error('Failed to fetch'), new Error('Invalid narration')]) {
        assert.equal(isChunkLoadError(error), false);
    }
});

test('reloads a missing chunk only once, including remounts and repeated failures', () => {
    const browser = browserFixture();
    assert.equal(recoverChunkLoad(chunkError, browser), true);
    assert.equal(recoverChunkLoad(chunkError, browser), false);
    assert.equal(recoverChunkLoad(new Error('Loading chunk 42 failed.'), browser), false);
    assert.equal(browser.reloads, 1);
    browser.location.pathname = '/staff/dashboard';
    assert.equal(recoverChunkLoad(chunkError, browser), true);
    assert.equal(browser.reloads, 2);
});

test('keeps offline and ordinary errors available for manual retry', () => {
    const browser = browserFixture();
    assert.equal(recoverChunkLoad(new Error('Invalid narration'), browser), false);
    browser.navigator.onLine = false;
    assert.equal(recoverChunkLoad(chunkError, browser), false);
    assert.equal(browser.reloads, 0);
    browser.navigator.onLine = true;
    assert.equal(recoverChunkLoad(chunkError, browser), true);
});

test('does not reload if storage is unavailable or the guard cannot be saved', () => {
    for (const method of ['getItem', 'setItem']) {
        const browser = browserFixture();
        browser.sessionStorage[method] = () => { throw new Error('Storage blocked'); };
        assert.equal(recoverChunkLoad(chunkError, browser), false);
        assert.equal(browser.reloads, 0);
    }
});

test('persists the loop guard before starting navigation', () => {
    const browser = browserFixture();
    browser.location.reload = () => {
        assert.equal(recoverChunkLoad(chunkError, browser), false);
    };
    assert.equal(recoverChunkLoad(chunkError, browser), true);
});
