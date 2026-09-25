import { createClient } from '@supabase/supabase-js';
import { localSchoolLocationsEnabled, locationAdminAuthorized } from '@/lib/school-locations-server';
import { mayFillVisit, normalizeCct, classifyMatch, sourceLocation } from '@/lib/school-locations.mjs';

export const dynamic = 'force-dynamic';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function guard(request) {
    if (!localSchoolLocationsEnabled()) return json({ error: 'Disponible solo en la Mesa local.' }, 404);
    if (!await locationAdminAuthorized(request)) return json({ error: 'Inicia sesión administrativa.' }, 401);
}
const must = result => { if (result.error) throw new Error(result.error.message); return result.data; };
export async function GET(request) {
    const denied = await guard(request); if (denied) return denied;
    try {
        const client = db();
        const params = new URL(request.url).searchParams;
        const projects = must(await client.from('intel_projects').select('id,name').order('name'));
        const project = params.get('project');
        const cct = normalizeCct(params.get('cct'));
        if (!project || !cct) return json({ projects, candidates: [], visits: [] });
        if (!projects.some(p => p.id === project) || cct.length > 40 || !/^[A-Z0-9-]+$/.test(cct)) return json({ error: 'Selecciona un proyecto y escribe el CCT completo.' }, 400);
        // Match case-insensitively, without wildcard input. Legacy whitespace is
        // reported by the offline audit; never silently rewrite identity here.
        const sources = must(await client.from('intel_schools').select('id,project_id,cct,nombre,turno,municipio,latitud,longitud').eq('project_id', project).ilike('cct', cct));
        const catalogRows = must(await client.from('catalogo_escuelas').select('*').ilike('cct', cct));
        const catalog = catalogRows.length === 1 ? catalogRows[0] : null;
        const visits = must(await client.from('proximas_escuelas').select('id,cct,turno,nombre_escuela,fecha_programada,estatus,is_archived,archived_at,ubicacion_lat,ubicacion_lng').ilike('cct', cct));
        const ids = visits.map(v => v.id);
        const linked = new Set();
        if (ids.length) {
            for (const table of ['staff_journeys', 'cierres_mision']) {
                const rows = must(await client.from(table).select('school_id').in('school_id', ids));
                rows.forEach(row => linked.add(String(row.school_id)));
            }
        }
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        return json({ projects, catalog, candidates: sources.map(source => ({ ...source,
            status: catalogRows.length > 1 ? 'ambiguous' : catalog ? classifyMatch(catalog, sources).status : sources.length !== 1 ? 'ambiguous' : sourceLocation(source) && source.turno?.trim() ? 'candidate' : 'invalid_coordinates' })),
            visits: visits.filter(v => mayFillVisit(v, today, linked)) });
    } catch (error) { return json({ error: error.message }, 503); }
}
export async function POST(request) {
    const denied = await guard(request); if (denied) return denied;
    try {
        const body = await request.json();
        if (body.confirmed !== true) return json({ error: 'Confirma primero la revisión de CCT, turno y mapa.' }, 400);
        let result;
        if (body.action === 'confirm-catalog' && /^[0-9a-f-]{36}$/i.test(body.sourceId || '')) {
            result = await db().rpc('review_confirm_school_location', { p_source_id: body.sourceId, p_expected: body.expected || null });
        } else if (body.action === 'fill-visit' && Number.isSafeInteger(body.visitId) && body.visitId > 0) {
            result = await db().rpc('review_fill_visit_location', { p_visit_id: body.visitId });
        } else return json({ error: 'Solicitud inválida.' }, 400);
        if (result.error) return json({ error: result.error.message }, 409);
        return json({ data: result.data });
    } catch { return json({ error: 'No se pudo completar la operación local.' }, 500); }
}
