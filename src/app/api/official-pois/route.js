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
        // Note: No status filter — the global route may have been created as 'draft'
        // before the auto-publish logic existed. There's only one global route.
        const { data: routes, error: routeError } = await supabase
            .from('master_routes')
            .select('id, title')
            .eq('title', 'Directorio Global');

        if (routeError) throw routeError;

        if (!routes || routes.length === 0) {
            return NextResponse.json({ pois: [] });
        }

        const routeIds = routes.map(r => r.id);

        // Get all POIs from the global route
        const { data: pois, error: poiError } = await supabase
            .from('master_route_pois')
            .select('*')
            .in('route_id', routeIds)
            .order('sort_order', { ascending: true });

        if (poiError) throw poiError;

        // Mark all as official, normalize column names to match pilot_pois schema
        // NOTE: Do NOT filter by coordinates here — POIs without coords are still
        // valid in the Academia (flashcard study). The map component (TacticalMapLeaflet)
        // already has a null-guard that skips markers with null coords.
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r.title]));
        const enrichedPois = (pois || []).map(p => ({
            ...p,
            id: `official_${p.id}`,
            is_official: true,
            route_name: routeMap[p.route_id] || '',
            // Normalize lat/lng → latitude/longitude (pilot_pois uses latitude/longitude)
            latitude: p.lat ?? p.latitude ?? null,
            longitude: p.lng ?? p.longitude ?? null,
            // Ensure ficha fields are passed to the PWA
            dato_clave_1: p.dato_clave_1 || null,
            dato_clave_2: p.dato_clave_2 || null,
            dato_clave_3: p.dato_clave_3 || null,
            pregunta_estudio_1: p.pregunta_estudio_1 || null,
            pregunta_estudio_2: p.pregunta_estudio_2 || null,
            pregunta_estudio_3: p.pregunta_estudio_3 || null,
            pregunta_interaccion: p.pregunta_interaccion || null,
            // Narrative Factory fields — SOLO datos reales, CERO placeholders
            narrative_script: p.narrative_script || null,
            audio_url: p.audio_url || null,
            audio_duration_seconds: p.audio_duration_seconds || null,
            audio_generated_at: p.audio_generated_at || null,
            research_article: p.research_article || null,
            // General Topics fields
            is_general_topic: p.is_general_topic || false,
            trigger_keywords: p.trigger_keywords || [],
        }));

        return NextResponse.json({ pois: enrichedPois });
    } catch (error) {
        console.error('Error fetching official POIs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
