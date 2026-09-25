const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readEnv, validateEnvironment } = require('./core.cjs');
async function verify() {
    const root = path.resolve(__dirname, '../..');
    validateEnvironment(readEnv(path.join(root, '.env.review.local')), readEnv(path.join(root, '.env.local')));
    const db = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres' });
    await db.connect();
    try {
        await db.query('BEGIN');
        const project = randomUUID(), sourceId = randomUUID(), cct = 'TEST-' + randomUUID();
        const historyHash = async () => (await db.query(`SELECT (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) FROM public.staff_journeys t) journeys, (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) FROM public.cierres_mision t) closures`)).rows[0];
        const originalHistory = await historyHash();
        await db.query('INSERT INTO intel_projects(id,name) VALUES($1,$2)', [project, 'Transactional test']);
        await db.query('INSERT INTO intel_schools(id,project_id,cct,nombre,turno,latitud,longitud) VALUES($1,$2,$3,$4,$5,19.4,-102.05)', [sourceId, project, cct, 'Source name must NOT replace archive name', 'Matutino']);
        await db.query('INSERT INTO catalogo_escuelas(cct,nombre_escuela,turno,visitada,estado_pipeline,ninos) VALUES($1,$2,$3,true,$4,77)', [cct, 'Preserved commercial name', 'Matutino', 'visitada']);
        const original = (await db.query('SELECT * FROM catalogo_escuelas WHERE cct=$1', [cct])).rows[0];
        const expected = (await db.query('SELECT project_id,cct,nombre,turno,latitud,longitud FROM intel_schools WHERE id=$1', [sourceId])).rows[0];
        await db.query('SELECT review_confirm_school_location($1,$2)', [sourceId, expected]);
        const updated = (await db.query('SELECT * FROM catalogo_escuelas WHERE cct=$1', [cct])).rows[0];
        for (const key of Object.keys(original).filter(k => !k.startsWith('ubicacion_'))) assert.deepEqual(updated[key], original[key], 'Catalog field changed: ' + key);
        assert.equal(updated.ubicacion_lat, 19.4);
        async function refuses(sql, args, regex) {
            await db.query('SAVEPOINT rejected_write');
            await assert.rejects(db.query(sql, args), regex);
            await db.query('ROLLBACK TO SAVEPOINT rejected_write');
        }
        await refuses('SELECT review_confirm_school_location($1,$2)', [sourceId, expected], /se conserva/);
        await refuses('SELECT review_confirm_school_location($1,$2)', [sourceId, { ...expected, latitud: 20 }], /fuente cambió/);
        const makeVisit = async (dateOffset, status = 'pendiente', archived = false, lat = null, turn = 'Matutino') => (await db.query(`INSERT INTO proximas_escuelas(cct,nombre_escuela,colonia,fecha_programada,estatus,is_archived,ubicacion_lat,turno) VALUES($1,'Local test','Lab',(now() AT TIME ZONE 'America/Mexico_City')::date + $2::int,$3,$4,$5,$6) RETURNING *`, [cct, dateOffset, status, archived, lat, turn])).rows[0];
        const safe = await makeVisit(3);
        await db.query('SELECT review_fill_visit_location($1)', [safe.id]);
        const changed = (await db.query('SELECT * FROM proximas_escuelas WHERE id=$1', [safe.id])).rows[0];
        for (const key of Object.keys(safe).filter(k => !k.startsWith('ubicacion_'))) assert.deepEqual(changed[key], safe[key], 'Visit field changed: ' + key);
        assert.equal(changed.ubicacion_lng, -102.05);
        for (const args of [[-1], [0], [3, 'completada'], [3, 'cancelada'], [3, 'en_progreso'], [3, 'pendiente', true], [3, 'pendiente', false, 10], [3, 'pendiente', false, null, 'Vespertino']]) {
            const protectedVisit = await makeVisit(...args);
            await refuses('SELECT review_fill_visit_location($1)', [protectedVisit.id], /Visita excluida|turno no coincide/);
            assert.deepEqual((await db.query('SELECT * FROM proximas_escuelas WHERE id=$1', [protectedVisit.id])).rows[0], protectedVisit);
        }
        assert.deepEqual(await historyHash(), originalHistory, 'Historical rows changed');
        const linked = await makeVisit(5);
        await db.query(`INSERT INTO staff_journeys(date,school_id,school_name) VALUES(current_date + 5,$1,'Test')`, [linked.id]);
        await refuses('SELECT review_fill_visit_location($1)', [linked.id], /Visita excluida/);
        await db.query('INSERT INTO intel_schools(project_id,cct,turno,latitud,longitud) VALUES($1,$2,$3,19.4,-102)', [project, cct, 'Matutino']);
        await refuses('SELECT review_confirm_school_location($1,$2)', [sourceId, expected], /duplicado/);
        assert.equal((await db.query(`SELECT has_function_privilege('anon', 'review_confirm_school_location(uuid,jsonb)', 'EXECUTE') allowed`)).rows[0].allowed, false);
        console.log('PASS: catalog identity/commercial fields preserved; future visit location only; past/today/archived/started/partial coordinates/turn mismatch/duplicates rejected; historical hashes unchanged; anon denied. All test rows rolled back.');
    } finally { await db.query('ROLLBACK'); await db.end(); }
}
if (require.main === module) verify().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { verify };
