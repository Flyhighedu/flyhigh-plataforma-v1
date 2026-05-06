import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — List all official POIs (from published master routes)
export async function GET() {
    try {
        const supabase = getAdminClient();

        // Get ONLY the "Directorio Global" route — single source of truth
        // This matches the same route the admin panel (MasterRouteStudio) uses
        const { data: routes, error: routeError } = await supabase
            .from('master_routes')
            .select('id, title')
            .eq('title', 'Directorio Global')
            .eq('status', 'published');

        if (routeError) throw routeError;

        if (!routes || routes.length === 0) {
            return NextResponse.json({ pois: [] });
        }

        const routeIds = routes.map(r => r.id);

        // Get all POIs from published routes
        const { data: pois, error: poiError } = await supabase
            .from('master_route_pois')
            .select('*')
            .in('route_id', routeIds)
            .order('sort_order', { ascending: true });

        if (poiError) throw poiError;

        // Mark all as official, normalize column names to match pilot_pois schema
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r.title]));
        const enrichedPois = (pois || []).map(p => ({
            ...p,
            is_official: true,
            route_name: routeMap[p.route_id] || '',
            // Normalize lat/lng → latitude/longitude (pilot_pois uses latitude/longitude)
            latitude: p.lat ?? p.latitude ?? null,
            longitude: p.lng ?? p.longitude ?? null,
        }));

        return NextResponse.json({ pois: enrichedPois });
    } catch (error) {
        console.error('Error fetching official POIs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
