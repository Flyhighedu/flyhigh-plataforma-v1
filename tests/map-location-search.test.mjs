import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinateSearchResult } from '../src/lib/map-location-search.mjs';

test('coordinate search accepts an exact map location and rejects invalid latitude or longitude', () => {
    assert.deepEqual(coordinateSearchResult('19.4169, -102.0555'), {
        id: 'coordinates:19.4169,-102.0555', name: '19.4169, -102.0555',
        lat: 19.4169, lng: -102.0555, zoom: 17
    });
    assert.equal(coordinateSearchResult('91, -102'), null);
    assert.equal(coordinateSearchResult('19.4, -181'), null);
    assert.equal(coordinateSearchResult('Calle 19, Uruapan'), null);
});
