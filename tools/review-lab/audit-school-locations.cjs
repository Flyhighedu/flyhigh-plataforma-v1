// READ ONLY, including when --production is supplied. No mutation method exists here.
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { readEnv, validateEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');
async function all(client, table, fields, order) {
    const rows = [];
    for (let page = 0; ; page++) {
        const { data, error } = await client.from(table).select(fields).order(order).range(page * 1000, page * 1000 + 999);
        if (error) throw new Error(table + ': ' + error.message);
        rows.push(...data);
        if (data.length < 1000) return rows;
    }
}
async function audit(production = false) {
    const { classifyMatch, normalizeCct, mayFillVisit } = await import('../../src/lib/school-locations.mjs');
    const env = readEnv(path.join(root, production ? '.env.local' : '.env.review.local'));
    if (!production) validateEnvironment(env, readEnv(path.join(root, '.env.local')));
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const [projects, sources, catalog, visits, journeys, closures] = await Promise.all([
        all(client, 'intel_projects', 'id,name', 'id'),
        all(client, 'intel_schools', 'id,project_id,cct,nombre,turno,municipio,latitud,longitud', 'id'),
        all(client, 'catalogo_escuelas', '*', 'cct'),
        all(client, 'proximas_escuelas', 'id,cct,turno,fecha_programada,estatus,is_archived,archived_at,ubicacion_lat,ubicacion_lng', 'id'),
        all(client, 'staff_journeys', 'id,school_id', 'id'),
        all(client, 'cierres_mision', 'id,school_id', 'id'),
    ]);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const linked = new Set([...journeys, ...closures].filter(r => r.school_id != null).map(r => String(r.school_id)));
    const byProject = projects.map(project => {
        const rows = sources.filter(row => row.project_id === project.id);
        const index = new Map();
        for (const row of rows) { const key = normalizeCct(row.cct); index.set(key, [...(index.get(key) || []), row]); }
        const matches = catalog.map(row => {
            const match = classifyMatch(row, index.get(normalizeCct(row.cct)) || []);
            return { cct: row.cct, name: row.nombre_escuela, turn: row.turno, status: match.status,
                ...(match.source ? { sourceId: match.source.id, sourceName: match.source.nombre, lat: match.source.latitud, lng: match.source.longitud } : {}) };
        });
        const eligibleVisits = visits.filter(v => mayFillVisit(v, today, linked)).map(v => ({ id: v.id, cct: v.cct, date: v.fecha_programada, status: classifyMatch(v, index.get(normalizeCct(v.cct)) || []).status }));
        return { ...project, sourceRows: rows.length, duplicates: [...index.values()].filter(r => r.length > 1).length,
            counts: matches.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}), matches, eligibleVisits };
    });
    const report = { readOnly: true, environment: production ? 'production-read-only' : 'local', at: new Date().toISOString(), today,
        counts: { catalog: catalog.length, visits: visits.length, journeys: journeys.length, closures: closures.length,
            eligibleFutureMissingLocation: visits.filter(v => mayFillVisit(v, today, linked)).length }, projects: byProject };
    const dir = path.join(root, '.review-lab'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `school-location-audit-${production ? 'production' : 'local'}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ file, readOnly: true, counts: report.counts, projects: byProject.map(({ matches, eligibleVisits, ...p }) => ({ ...p, futureVisits: eligibleVisits.length })) }, null, 2));
    return report;
}
if (require.main === module) audit(process.argv.includes('--production')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { audit, all };
