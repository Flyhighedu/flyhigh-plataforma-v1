import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signAdminToken } from '../src/lib/adminAuth.js';

test('shared map search accepts signed admins and staff sessions, rejects unsigned callers and bounds abuse', async () => {
    const originalFetch = globalThis.fetch;
    const oldSecret = process.env.ADMIN_AUTH_SECRET;
    process.env.ADMIN_AUTH_SECRET = 'local-unit-test-only';
    globalThis.__mapSearchTest = { cookie: null, user: null, calls: 0, fail: false };
    let source = readFileSync(new URL('../src/app/api/staff/map-search/route.js', import.meta.url), 'utf8');
    source = source.replace("import { createClient } from '@/utils/supabase/server';", 'const createClient = async () => ({ auth: { getUser: async () => ({ data: { user: globalThis.__mapSearchTest.user } }) } });')
        .replace("import { cookies } from 'next/headers';", 'const cookies = async () => ({ get: () => ({ value: globalThis.__mapSearchTest.cookie }) });')
        .replace("import { fetchOverpassElements } from '@/lib/map-context.mjs';", 'const fetchOverpassElements = async () => { globalThis.__mapSearchTest.calls++; if (globalThis.__mapSearchTest.fail) throw new Error("Provider timeout"); return [{ type: "node", id: 1, tags: { name: "Parque" } }]; };');
    for (const [alias, file] of [['cultural-pois.mjs', 'cultural-pois.mjs'], ['map-location-search.mjs', 'map-location-search.mjs'], ['adminAuth', 'adminAuth.js']]) source = source.replace(`from '@/lib/${alias}'`, `from '${new URL('../src/lib/' + file, import.meta.url).href}'`);
    const { POST } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const body = { kind: 'cultural', bounds: { south: 19.4, west: -102.1, north: 19.5, east: -102 } };
    const request = (data = body, headers = {}) => new Request('http://localhost/api/staff/map-search', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) });
    try {
        assert.equal((await POST(request())).status, 401);
        globalThis.__mapSearchTest.cookie = 'forged';
        assert.equal((await POST(request())).status, 401);
        globalThis.__mapSearchTest.cookie = await signAdminToken({ role: 'admin', exp: Date.now() + 10000 });
        assert.equal((await POST(request())).status, 200);
        assert.equal((await POST(request(body, { 'sec-fetch-site': 'cross-site' }))).status, 403);
        assert.equal((await POST(request({ ...body, bounds: { ...body.bounds, north: 21 } }))).status, 400);
        assert.equal(globalThis.__mapSearchTest.calls, 1);
        globalThis.__mapSearchTest.cookie = null;
        globalThis.__mapSearchTest.user = { id: 'pilot-test' };
        assert.equal((await POST(request())).status, 200);
        assert.equal((await POST(request({ kind:'place-search', query:'a' }))).status,400);
        globalThis.fetch = async url => { assert.ok(String(url).includes('q=Uruapan')); return Response.json([{place_id:1, display_name:'Uruapan, Michoacán', lat:'19.4', lon:'-102.0'}]); };
        const places = await POST(request({kind:'place-search',query:'Uruapan'}));
        assert.equal(places.status,200);
        assert.deepEqual((await places.json()).locations,[{id:'1',name:'Uruapan, Michoacán',lat:19.4,lng:-102}]);
        globalThis.fetch = async () => { throw new Error('timeout'); };
        assert.equal((await POST(request({kind:'place-search',query:'Uruapan'}))).status,503);
        globalThis.__mapSearchTest.fail = true;
        assert.equal((await POST(request())).status, 503);
    } finally {
        globalThis.fetch = originalFetch;
        delete globalThis.__mapSearchTest;
        if (oldSecret === undefined) delete process.env.ADMIN_AUTH_SECRET; else process.env.ADMIN_AUTH_SECRET = oldSecret;
    }
});
