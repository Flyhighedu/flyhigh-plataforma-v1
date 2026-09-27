import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCommand } from '../src/lib/normalize-command.mjs';

test('normalization keeps the existing narration voice labels', () => {
    assert.equal(normalizeCommand('Parque Nacional Barranca del Cupatitzio'), 'parque nacional barranca del cupatitzio');
    assert.equal(normalizeCommand('Cerro del Águila'), 'cerro del aguila');
    assert.equal(normalizeCommand('¿Qué?'), 'que');
    assert.equal(normalizeCommand(''), '');
});
