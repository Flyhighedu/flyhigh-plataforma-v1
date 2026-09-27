import test from 'node:test';
import assert from 'node:assert/strict';
import { mapContextRequest, createMapContextLoader, parseStreets, streetQuery } from '../src/lib/map-context.mjs';
const area = mapContextRequest(new URLSearchParams({ kind: 'pois', lat: '19.4169', lng: '-102.0555' }));
test('map context validates kinds/coordinates and uses bounded named-road queries', () => {
    for (const query of ['kind=streets&lat=&lng=0', 'kind=bad&lat=1&lng=1', 'kind=pois&lat=100&lng=1', 'kind=pois&lat=NaN&lng=1']) assert.throws(() => mapContextRequest(new URLSearchParams(query)));
    assert.ok(streetQuery(area.center).includes('out geom 180'));
    const way = { type: 'way', id: 1, tags: { name: 'Calle real' }, geometry: [{ lat: 19.417, lon: -102.055 }, { lat: 19.418, lon: -102.055 }] };
    assert.equal(parseStreets([way], area.center)[0].name, 'Calle real');
    assert.equal(parseStreets([{ ...way, geometry: [{ lat: null, lon: 1 }] }], area.center).length, 0);
});
test('provider failure falls back once, identifies app, and cached concurrent callers reuse results', async () => {
    let calls = 0;
    const load = createMapContextLoader(async (_url, options) => {
        calls++;
        assert.ok(options.headers['User-Agent'].startsWith('FlyHigh/'));
        assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded;charset=UTF-8');
        return calls === 1 ? new Response('', { status: 503 }) : Response.json({ elements: [] });
    });
    const result = await Promise.all([load(area), load(area)]);
    assert.equal(calls, 2); assert.deepEqual(result[0], result[1]);
    await load(area); assert.equal(calls, 2);
});
test('incomplete responses fail over; errors back off and never become false empty success', async () => {
    let now = 1, calls = 0;
    const load = createMapContextLoader(async () => { calls++; return Response.json({ remark: 'timeout', elements: [] }); }, () => now);
    await assert.rejects(load(area)); await assert.rejects(load(area)); assert.equal(calls, 2);
    now += 31000; await assert.rejects(load(area)); assert.equal(calls, 4);
});
