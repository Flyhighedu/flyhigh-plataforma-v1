import { createClient } from '@/utils/supabase/server';
import { buildCulturalPoiQuery, buildNearbyNamedPoiQuery, buildPreparationPoiQuery } from '@/lib/cultural-pois.mjs';
import { fetchOverpassElements } from '@/lib/map-context.mjs';
import { coordinateSearchResult } from '@/lib/map-location-search.mjs';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body, status = 200) => Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' }
});

export async function POST(request) {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return reply({ error: 'Origen no permitido' }, 403);

    // Admin uses a signed session cookie, while pilots use Supabase sessions.
    // Both entry points share the same bounded, read-only map query.
    const admin = await verifyAdminToken((await cookies()).get('flyhigh_admin_auth')?.value);
    if (!admin) {
        const db = await createClient();
        const { data: { user } } = await db.auth.getUser();
        if (!user) return reply({ error: 'Inicia sesión para consultar el mapa.' }, 401);
    }

    let body;
    try { body = await request.json(); }
    catch { return reply({ error: 'Solicitud de mapa no válida.' }, 400); }

    if (body?.kind === 'place-search') {
        const search = typeof body.query === 'string' ? body.query.trim() : '';
        if (search.length < 3 || search.length > 160) return reply({ error: 'Escribe entre 3 y 160 caracteres.' }, 400);
        const exact = coordinateSearchResult(search);
        if (exact) return reply({ locations: [exact] });
        try {
            const params = new URLSearchParams({ q: search, format: 'jsonv2', limit: '5', 'accept-language': 'es' });
            const response = await fetch('https://nominatim.openstreetmap.org/search?' + params, { headers: { 'User-Agent': 'FlyHigh-Narraciones/1.0' }, signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
            if (!response.ok) throw new Error('Place provider unavailable');
            const locations = (await response.json()).filter(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon))).map(item => ({ id: String(item.place_id), name: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }));
            return reply({ locations });
        } catch { return reply({ error: 'No se pudo buscar el lugar. Intenta de nuevo.' }, 503); }
    }

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
        } else if (body?.kind === 'preparation-cultural') {
            query = buildPreparationPoiQuery(body.center, body.range);
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
