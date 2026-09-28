import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMapResource, signTilePermit, tileCoordinates, validTilePermit, viewportParameters } from './preparation-map-tiles.mjs';

test('the tile permit only admits its own session before expiration', () => {
    const key = 'test-key';
    const session = 'abcDEF_12345678901234567890';
    const expires = 2000000000000;
    const permit = signTilePermit(session, expires, key);
    assert.equal(validTilePermit(session, expires, permit, key, expires - 1), true);
    assert.equal(validTilePermit(session, expires, permit, key, expires), false);
    assert.equal(validTilePermit('other-12345678901234567890', expires, permit, key, expires - 1), false);
    assert.equal(validTilePermit(session, expires, permit, 'another-key', expires - 1), false);
});

test('tile and viewport requests reject invalid coordinates', () => {
    assert.deepEqual(tileCoordinates('15', '6294', '13288'), { zoom: 15, column: 6294, row: 13288 });
    assert.equal(tileCoordinates('15', '-1', '5'), null);
    assert.equal(tileCoordinates('20', '1', '1'), null);
    assert.equal(tileCoordinates('4', '16', '1'), null);
    assert.deepEqual(viewportParameters(new URLSearchParams('zoom=15&north=20&south=19&east=-101&west=-103')),
        { zoom: 15, north: 20, south: 19, east: -101, west: -103 });
    assert.equal(viewportParameters(new URLSearchParams('zoom=15&north=19&south=20&east=-101&west=-103')), null);
});

test('temporary imagery failures retry without retrying denied access', async () => {
    let calls = 0;
    const recovered = await fetchMapResource(async () => {
        calls++;
        return { ok: calls === 3, status: calls === 3 ? 200 : 503, body: { cancel: async () => {} } };
    }, null, async () => {});
    assert.equal(recovered.status, 200);
    assert.equal(calls, 3);
    calls = 0;
    const denied = await fetchMapResource(async () => { calls++; return { ok: false, status: 403 }; }, null, async () => {});
    assert.equal(denied.status, 403);
    assert.equal(calls, 1);
});
