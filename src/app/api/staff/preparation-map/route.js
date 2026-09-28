import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createClient } from '@/utils/supabase/server';
import { signTilePermit, tileCoordinates, validTilePermit, viewportParameters } from '@/lib/preparation-map-tiles.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (message, status) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

let keyPromise;
async function readMapKey() {
    if (process.env.GOOGLE_MAP_TILES_API_KEY) return process.env.GOOGLE_MAP_TILES_API_KEY;
    try { return parseEnv(await readFile(path.join(process.cwd(), '.env.local'), 'utf8')).GOOGLE_MAP_TILES_API_KEY; }
    catch { return null; }
}
function mapKey() { return keyPromise ??= readMapKey(); }

async function authorizedStaff() {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return false;
    const { data: profile } = await db.from('staff_profiles').select('role, is_active').eq('user_id', user.id).single();
    return Boolean(profile?.is_active && ['pilot', 'assistant'].includes(profile.role));
}

export async function GET(request) {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return fail('Origen no permitido.', 403);
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind');
    if (!['session', 'tile', 'viewport'].includes(kind)) return fail('Solicitud de mapa inválida.', 400);
    // The session endpoint authenticates the staff member. Subsequent tile and
    // attribution requests use a short-lived, session-scoped HMAC capability.
    if (kind === 'session' && !(await authorizedStaff())) return fail('Inicia sesión como piloto o auxiliar.', 403);
    const key = await mapKey();
    if (!key) return fail('La vista satelital aún no está configurada.', 503);

    if (kind === 'session') {
        try {
            const upstream = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapType: 'satellite', language: 'es-MX', region: 'MX', imageFormat: 'jpeg' }),
                cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
            });
            if (!upstream.ok) { await upstream.body?.cancel(); return fail('Google no habilitó la imagen satelital. Se mostrará el mapa alternativo.', 502); }
            const data = await upstream.json();
            const expires = Math.min(Number(data.expiry) * 1000, Date.now() + 6 * 60 * 60 * 1000);
            if (!data.session || !Number.isFinite(expires) || expires <= Date.now() || ![256, 512].includes(data.tileWidth))
                return fail('Google devolvió una sesión de mapa inválida.', 502);
            return Response.json({ session: data.session, expires, permit: signTilePermit(data.session, expires, key), tileSize: data.tileWidth },
                { headers: { 'Cache-Control': 'private, no-store' } });
        } catch { return fail('No se pudo conectar con Google Maps.', 502); }
    }

    const session = url.searchParams.get('session');
    const expires = url.searchParams.get('expires');
    const permit = url.searchParams.get('permit');
    if (!validTilePermit(session, expires, permit, key)) return fail('La sesión del mapa expiró.', 403);

    if (kind === 'tile') {
        const point = tileCoordinates(url.searchParams.get('z'), url.searchParams.get('x'), url.searchParams.get('y'));
        if (!point) return fail('Mosaico inválido.', 400);
        const target = new URL(`https://tile.googleapis.com/v1/2dtiles/${point.zoom}/${point.column}/${point.row}`);
        target.search = new URLSearchParams({ session, key }).toString();
        try {
            const upstream = await fetch(target, { cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
            if (!upstream.ok) { await upstream.body?.cancel(); return fail('No se pudo cargar la imagen satelital.', 502); }
            return new Response(upstream.body, { headers: {
                'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            } });
        } catch { return fail('No se pudo cargar la imagen satelital.', 502); }
    }

    const bounds = viewportParameters(url.searchParams);
    if (!bounds) return fail('Área de mapa inválida.', 400);
    const target = new URL('https://tile.googleapis.com/tile/v1/viewport');
    target.search = new URLSearchParams({ session, key, ...Object.fromEntries(Object.entries(bounds).map(([name, value]) => [name, String(value)])) }).toString();
    try {
        const upstream = await fetch(target, { cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
        if (!upstream.ok) { await upstream.body?.cancel(); return fail('No se pudieron cargar los créditos del mapa.', 502); }
        const data = await upstream.json();
        return Response.json({ copyright: String(data.copyright || '') }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch { return fail('No se pudieron cargar los créditos del mapa.', 502); }
}
