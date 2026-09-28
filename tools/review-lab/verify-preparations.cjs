// Integration tests against the isolated review server. Creates one temporary
// visit and removes only that visit and its own plans in finally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const { readEnv, validateEnvironment } = require('./core.cjs');
const { seedPreparationVisits, todayMexico } = require('./setup-local.cjs');
const root = path.resolve(__dirname, '../..');

async function main() {
    const env = readEnv(path.join(root, '.env.review.local'));
    const { baseURL } = validateEnvironment(env, readEnv(path.join(root, '.env.local')));
    const accounts = JSON.parse(fs.readFileSync(path.join(root, '.review-lab/test-accounts.json'), 'utf8'));
    const runtime = JSON.parse(fs.readFileSync(path.join(root, '.review-lab/runtime.json'), 'utf8'));
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await seedPreparationVisits(admin);
    async function session(role) {
        let jar = [];
        const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookieOptions: { name: `sb-${new URL(runtime.publicBackendURL).hostname.split('.')[0]}-auth-token` }, cookies: { getAll: () => jar, setAll: values => { jar = values; } } });
        const result = await client.auth.signInWithPassword(accounts[role]);
        assert.ifError(result.error);
        return { client, user: result.data.user, cookie: jar.map(c => `${c.name}=${c.value}`).join('; ') };
    }
    const pilot = await session('pilot');
    const assistant = await session('assistant');
    const teacher = await session('teacher');
    async function call(who, method = 'GET', body, suffix = '') {
        const response = await fetch(baseURL + '/api/staff/preparation' + suffix, { method, headers: { ...(who ? { Cookie: who.cookie } : {}), 'Content-Type': 'application/json', Origin: baseURL }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
    }
    assert.equal((await call(null)).status, 401);
    assert.equal((await call(teacher)).status, 403);
    const loaded = await call(pilot);
    assert.equal(loaded.status, 200, JSON.stringify(loaded.body));
    assert.ok(loaded.body.visits.some(v => v.fecha_programada > todayMexico()), 'Future visits should be visible');
    const playable = loaded.body.catalog.filter(p => p.audio_url).slice(0, 2);
    assert.equal(playable.length, 2, 'Import at least two narrations first');
    const { fingerprint } = await import('../../src/lib/narration-preparation.mjs');
    const { data: visit, error } = await admin.from('proximas_escuelas').insert({ nombre_escuela: 'PRUEBA AUTOMATIZADA TEMPORAL', colonia: 'Local', fecha_programada: todayMexico(), cct: 'AUTO-' + randomUUID(), estatus: 'pendiente', registrado_via: 'review-lab' }).select('id, fecha_programada').single();
    assert.ifError(error);
    try {
        const ids = playable.map(p => String(p.id)).reverse();
        let body = { visitId: visit.id, visitDate: visit.fecha_programada, revision: 0, ids, status: 'draft' };
        let result = await call(pilot, 'PUT', body);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.deepEqual(result.body.plan.items.map(p => p.id), ids);
        assert.equal(result.body.plan.status, 'draft');
        assert.equal((await call(pilot, 'PUT', body)).status, 409, 'Stale creation must not overwrite');
        body = { ...body, revision: result.body.plan.revision, status: 'ready', fingerprints: result.body.plan.items.map(fingerprint) };
        assert.equal((await call(pilot, 'PUT', body)).status, 400, 'Legacy requests cannot confirm without a school');
        body.context = { phase_id: 'general', school_location: { latitude: 19.417, longitude: -102.055 } };
        result = await call(pilot, 'PUT', body);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(result.body.plan.status, 'ready');
        const { preparationItemFingerprint } = await import('../../src/lib/preparation-model.mjs');
        const physical = playable.find(p => !p.is_general_topic && p.latitude != null && p.longitude != null);
        assert.ok(physical, 'Test requires a geographic POI');
        const oldPreference = await admin.from('pilot_poi_preferences').select('*').eq('user_id', pilot.user.id).eq('poi_id', String(physical.id)).maybeSingle();
        assert.ifError(oldPreference.error);
        try {
            assert.equal((await call(pilot, 'PATCH', { poiId: String(physical.id), behavior: 'reference' })).status, 200);
            assert.equal((await call(pilot, 'PATCH', { poiId: String(physical.id), behavior: 'unknown' })).status, 400);
            const privateRead = await assistant.client.from('pilot_poi_preferences').select('*').eq('user_id', pilot.user.id);
            assert.ifError(privateRead.error); assert.deepEqual(privateRead.data, []);
            const directWrite = await pilot.client.from('pilot_poi_preferences').upsert({user_id:pilot.user.id,poi_id:String(physical.id),behavior:'route'});
            assert.ok(directWrite.error, 'Preferences cannot bypass the authenticated API');
            const selections = ids.map(id => ({id,behavior:id===String(physical.id)?'reference':'route'}));
            const changed = await call(pilot, 'PUT', {...body, modelVersion:2, ids:undefined, selections, status:'draft', revision:result.body.plan.revision});
            assert.equal(changed.status,200,JSON.stringify(changed.body));
            assert.equal(changed.body.plan.items.find(p=>p.id===String(physical.id)).behavior,'reference');
            assert.equal(changed.body.plan.preparation_context.review,null);
            const overridden = await call(pilot,'PUT',{...body,modelVersion:2,ids:undefined,selections:selections.map(p=>({...p,behavior:'route'})),status:'draft',revision:changed.body.plan.revision});
            assert.equal(overridden.status,200);
            const habit = await admin.from('pilot_poi_preferences').select('behavior').eq('user_id',pilot.user.id).eq('poi_id',String(physical.id)).single();
            assert.equal(habit.data.behavior,'reference','Per-visit override must not overwrite habit');
            result = await call(pilot,'PUT',{...body,modelVersion:2,revision:overridden.body.plan.revision,status:'ready',fingerprints:overridden.body.plan.items.map(preparationItemFingerprint)});
            assert.equal(result.status,200,JSON.stringify(result.body));
        } finally {
            if(oldPreference.data) await admin.from('pilot_poi_preferences').upsert(oldPreference.data);
            else await admin.from('pilot_poi_preferences').delete().eq('user_id',pilot.user.id).eq('poi_id',String(physical.id));
        }
        const readBack = await call(pilot, 'GET', null, '?visit=' + visit.id);
        assert.deepEqual(readBack.body.plans.find(p => p.visit_id === visit.id).items.map(p => p.id), ids);
        assert.equal((await call(assistant)).body.plans.some(p => p.user_id === pilot.user.id), false, 'Plans must be private to their owner');
        const direct = await assistant.client.from('visit_narration_plans').select('*').eq('user_id', pilot.user.id);
        assert.ifError(direct.error); assert.deepEqual(direct.data, []);
        const bypass = await pilot.client.from('visit_narration_plans').update({ status: 'ready' }).eq('visit_id', visit.id);
        assert.ok(bypass.error, 'Direct client mutations must be denied');
        body = { ...body, revision: result.body.plan.revision, ids: [...ids].reverse(), status: 'draft' };
        result = await call(pilot, 'PUT', body);
        assert.equal(result.status, 200);
        assert.equal(result.body.plan.status, 'draft');
        assert.equal(result.body.plan.confirmed_at, null);
        body.revision = result.body.plan.revision;
        assert.equal((await call(pilot, 'PUT', { ...body, ids: [], status: 'ready' })).status, 400);
        assert.equal((await call(pilot, 'PUT', { ...body, ids: ['missing'], status: 'draft' })).status, 400);
        assert.equal((await call(pilot, 'PUT', { ...body, status: 'ready', fingerprints: [] })).status, 409);
        const [raceA, raceB] = await Promise.all([call(pilot, 'PUT', body), call(pilot, 'PUT', body)]);
        assert.deepEqual([raceA.status, raceB.status].sort(), [200, 409], 'Concurrent edits must not overwrite each other');
        const { data: journeys } = await admin.from('staff_journeys').select('id').eq('school_id', visit.id);
        assert.deepEqual(journeys, [], 'Preparing and confirming must not create a journey');
        for (const route of ['/staff/cronograma', '/staff/narraciones', '/staff/visitas/' + visit.id]) {
            const response = await fetch(baseURL + route, { headers: { Cookie: pilot.cookie }, redirect: 'manual' });
            assert.equal(response.status, 200, route);
        }
        console.log('PASS: auth, future visits, legacy school validation, v2 route/reference, private preferences and visit override, ordered save/read, confirmation, draft after edit, RLS, optimistic concurrency, invalid content, no operational writes, 3 routes.');
    } finally {
        const removed = await admin.from('proximas_escuelas').delete().eq('id', visit.id).eq('registrado_via', 'review-lab');
        assert.ifError(removed.error);
        console.log('Removed only the temporary automated-test visit and its dependent plans.');
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
