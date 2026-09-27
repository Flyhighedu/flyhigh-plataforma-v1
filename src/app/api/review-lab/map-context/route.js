import { createClient } from '@/utils/supabase/server';
import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';
import { createMapContextLoader, mapContextRequest } from '@/lib/map-context.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const load = createMapContextLoader();
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request) {
    if (!isLocal3dReview(process.env)) return new Response(null, { status: 404 });
    if (request.headers.get('sec-fetch-site') === 'cross-site') return reply({ error: 'Origen no permitido' }, 403);
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return reply({ error: 'Inicia sesión en la Mesa' }, 401);
    const { data: profile } = await db.from('staff_profiles').select('role, is_active').eq('user_id', user.id).single();
    if (!profile?.is_active || !['pilot', 'assistant'].includes(profile.role)) return reply({ error: 'Perfil no autorizado' }, 403);
    let area;
    try { area = mapContextRequest(new URL(request.url).searchParams); }
    catch { return reply({ error: 'Zona no válida' }, 400); }
    try { return reply(await load(area)); }
    catch { return reply({ error: 'El mapa de lugares no respondió. Vuelve a intentarlo.' }, 503); }
}
