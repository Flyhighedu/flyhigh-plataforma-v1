import { createClient } from '@/utils/supabase/server';
import { buildCulturalPoiQuery, buildNearbyNamedPoiQuery } from '@/lib/cultural-pois.mjs';
import { fetchOverpassElements } from '@/lib/map-context.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body, status = 200) => Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
});

export async function POST(request) {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return reply({ error: 'Origen no permitido' }, 403);

    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return reply({ error: 'Inicia sesión para consultar el mapa.' }, 401);

    let body;
    try { body = await request.json(); }
    catch { return reply({ error: 'Solicitud de mapa no válida.' }, 400); }

    let query;
    try {
        if (body?.kind === 'cultural') {
            const bounds = body.bounds || {};
            const normalizedBounds = {
                south: Number(bounds.south),
                west: Number(bounds.west),
                north: Number(bounds.north),
                east: Number(bounds.east)
            };
            if (normalizedBounds.north - normalizedBounds.south > 1 || normalizedBounds.east - normalizedBounds.west > 1) {
                return reply({ error: 'Acerca un poco el mapa para buscar lugares.' }, 400);
            }
            query = buildCulturalPoiQuery(normalizedBounds);
        } else if (body?.kind === 'nearby-name') {
            if (body.latitude == null || body.longitude == null || body.latitude === '' || body.longitude === '') {
                return reply({ error: 'Ubicación no válida.' }, 400);
            }
            query = buildNearbyNamedPoiQuery({
                latitude: Number(body.latitude),
                longitude: Number(body.longitude),
                radius: body.radius == null ? 150 : Number(body.radius)
            });
        } else {
            return reply({ error: 'Tipo de búsqueda no válido.' }, 400);
        }
    } catch (error) {
        return reply({ error: error.message }, 400);
    }

    try {
        const elements = await fetchOverpassElements(query);
        return reply({ elements });
    } catch (error) {
        console.warn('[staff/map-search] Overpass no respondió:', error.message);
        return reply({ error: 'El mapa de lugares no respondió. Vuelve a intentarlo en unos momentos.' }, 503);
    }
}
