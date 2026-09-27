import test from 'node:test';
import assert from 'node:assert/strict';
import { poiCategory } from '../src/lib/poi-presentation.mjs';

test('conserva iconos para lugares y distingue temas', () => {
    assert.deepEqual(poiCategory({ name: 'Museo del Ferrocarril', latitude: 19, longitude: -102 }), { emoji: '🏛️', label: 'Museo' });
    assert.deepEqual(poiCategory({ name: 'Historia del agua', is_general_topic: true }), { emoji: '💡', label: 'Tema' });
    assert.deepEqual(poiCategory({ name: 'Sitio sin categoría', latitude: 19, longitude: -102 }), { emoji: '📍', label: 'Lugar' });
});
