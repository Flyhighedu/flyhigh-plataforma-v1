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

// GET — List all POIs for a route
export async function GET(request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const routeId = searchParams.get('route_id');

        if (!routeId) {
            return NextResponse.json({ error: 'route_id es requerido' }, { status: 400 });
        }

        const { data: pois, error } = await supabase
            .from('master_route_pois')
            .select('*')
            .eq('route_id', routeId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ pois: pois || [] });
    } catch (error) {
        console.error('Error fetching route POIs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create a new POI in a route
export async function POST(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        
        const { route_id, name, description, image_url, sort_order,
            dato_clave_1, dato_clave_2, dato_clave_3,
            pregunta_estudio_1, pregunta_estudio_2, pregunta_estudio_3,
            pregunta_interaccion, ai_context } = body;

        // Accept both lat/lng and latitude/longitude aliases
        const lat = body.lat ?? body.latitude ?? null;
        const lng = body.lng ?? body.longitude ?? null;

        if (!route_id) {
            return NextResponse.json({ error: 'route_id es requerido' }, { status: 400 });
        }

        // Get current max sort_order for auto-increment
        const { data: existing } = await supabase
            .from('master_route_pois')
            .select('sort_order')
            .eq('route_id', route_id)
            .order('sort_order', { ascending: false })
            .limit(1);

        const nextOrder = sort_order ?? ((existing?.[0]?.sort_order ?? -1) + 1);

        const insertPayload = {
            route_id,
            name: name || 'Nuevo Punto',
            description: description || '',
            image_url: image_url || '',
            lat,
            lng,
            sort_order: nextOrder
        };

        // Include ficha fields if provided
        if (dato_clave_1 !== undefined) insertPayload.dato_clave_1 = dato_clave_1;
        if (dato_clave_2 !== undefined) insertPayload.dato_clave_2 = dato_clave_2;
        if (dato_clave_3 !== undefined) insertPayload.dato_clave_3 = dato_clave_3;
        if (pregunta_estudio_1 !== undefined) insertPayload.pregunta_estudio_1 = pregunta_estudio_1;
        if (pregunta_estudio_2 !== undefined) insertPayload.pregunta_estudio_2 = pregunta_estudio_2;
        if (pregunta_estudio_3 !== undefined) insertPayload.pregunta_estudio_3 = pregunta_estudio_3;
        if (pregunta_interaccion !== undefined) insertPayload.pregunta_interaccion = pregunta_interaccion;
        if (ai_context !== undefined) insertPayload.ai_context = ai_context;

        const { data, error } = await supabase
            .from('master_route_pois')
            .insert(insertPayload)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ poi: data });
    } catch (error) {
        console.error('Error creating route POI:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — Update a route POI
export async function PATCH(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        // Normalize latitude/longitude aliases → lat/lng (DB column names)
        if (updates.latitude !== undefined) { updates.lat = updates.latitude; delete updates.latitude; }
        if (updates.longitude !== undefined) { updates.lng = updates.longitude; delete updates.longitude; }

        const allowed = [
            'name', 'description', 'image_url', 'lat', 'lng',
            'dato_clave_1', 'dato_clave_2', 'dato_clave_3',
            'pregunta_estudio_1', 'pregunta_estudio_2', 'pregunta_estudio_3',
            'pregunta_interaccion', 'ai_context', 'sort_order'
        ];
        const safeUpdates = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }
        safeUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('master_route_pois')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ poi: data });
    } catch (error) {
        console.error('Error updating route POI:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — Delete a route POI
export async function DELETE(request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const { error } = await supabase
            .from('master_route_pois')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting route POI:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
