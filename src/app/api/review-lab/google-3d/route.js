import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import { isLocal3dReview, rewriteTileset, verifyTileResource } from '@/lib/google-3d-proxy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (message, status) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request) {
    if (!isLocal3dReview(process.env)) return new Response(null, { status: 404 });
    if (request.headers.get('sec-fetch-site') === 'cross-site') return fail('Origen no permitido.', 403);
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return fail('Inicia sesión en la Mesa de revisión.', 401);
    const { data: profile } = await db.from('staff_profiles').select('role, is_active').eq('user_id', user.id).single();
    if (!profile?.is_active || !['pilot', 'assistant'].includes(profile.role)) return fail('Perfil no autorizado.', 403);

    // Explicit, user-authorized exception for this isolated preview only. Read
    // only the dedicated map key: never forward the normal environment to Next.
    let key = process.env.GOOGLE_MAP_TILES_API_KEY;
    if (!key) {
        try { key = parseEnv(await readFile(path.join(process.cwd(), '.env.local'), 'utf8')).GOOGLE_MAP_TILES_API_KEY; }
        catch { /* Missing key is an actionable configuration error below. */ }
    }
    if (!key) return fail('Falta GOOGLE_MAP_TILES_API_KEY en .env.local.', 503);
    const secret = createHmac('sha256', key).update('FlyHigh isolated 3D resource signing v1').digest();
    const params = new URL(request.url).searchParams;
    let target;
    let expires = Date.now() + 150 * 60 * 1000;
    if (params.has('resource')) {
        try { const verified = verifyTileResource(params.get('resource'), user.id, secret); target = verified.url; expires = verified.expires; }
        catch { return fail('La sesión 3D expiró o el recurso no es válido. Vuelve a abrir la prueba.', 403); }
    } else {
        if (params.get('mode') !== 'free') {
        const visit = params.get('visit');
        if (!/^\d+$/.test(visit || '')) return fail('Visita inválida.', 400);
        const { data } = await db.from('proximas_escuelas').select('id').eq('id', visit).eq('is_archived', false).maybeSingle();
        if (!data) return fail('Visita no disponible.', 404);
        }
        target = new URL('https://tile.googleapis.com/v1/3dtiles/root.json');
    }
    target.searchParams.set('key', key);
    try {
        const upstream = await fetch(target, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]), cache: 'no-store', redirect: 'error' });
        if (!upstream.ok) {
            // Never forward Google's diagnostic body or request URL with key.
            await upstream.body?.cancel();
            return fail(upstream.status === 403 ? 'Google rechazó el acceso. Revisa Map Tiles API y las restricciones de la clave.' : upstream.status === 429 ? 'Se alcanzó la cuota de Google Maps. Intenta más tarde.' : 'Google no pudo cargar este sector 3D. Intenta de nuevo.', upstream.status === 429 ? 429 : 502);
        }
        if (target.pathname.endsWith('.json')) {
            const document = rewriteTileset(await upstream.json(), target.href, user.id, secret, expires);
            return Response.json(document, { headers: { 'Cache-Control': 'private, no-store' } });
        }
        const headers = new Headers({ 'Content-Type': upstream.headers.get('content-type') || 'model/gltf-binary', 'X-Content-Type-Options': 'nosniff' });
        // No persistent server cache. Preserve Google's browser cache directives.
        headers.set('Cache-Control', upstream.headers.get('cache-control') || 'private, no-store');
        if (upstream.headers.get('etag')) headers.set('ETag', upstream.headers.get('etag'));
        return new Response(upstream.body, { headers });
    } catch { return fail('No se pudo conectar con Google 3D. Comprueba la conexión.', 502); }
}
