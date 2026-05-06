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

// GET — List all master routes (with POI counts)
export async function GET() {
    try {
        const supabase = getAdminClient();
        
        const { data: routes, error } = await supabase
            .from('master_routes')
            .select('*, master_route_pois(count)')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        const result = (routes || []).map(r => ({
            ...r,
            poi_count: r.master_route_pois?.[0]?.count || 0,
            master_route_pois: undefined
        }));

        return NextResponse.json({ routes: result });
    } catch (error) {
        console.error('Error fetching master routes:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create a new master route (idempotent: returns existing if title matches)
export async function POST(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        
        const { title, description, emoji } = body;
        const routeTitle = title || 'Directorio Global';

        // Prevent duplicates: if a route with this title already exists, return it
        const { data: existing } = await supabase
            .from('master_routes')
            .select('*')
            .eq('title', routeTitle)
            .limit(1)
            .single();

        if (existing) {
            return NextResponse.json({ route: existing });
        }

        const { data, error } = await supabase
            .from('master_routes')
            .insert({
                title: routeTitle,
                description: description || '',
                emoji: emoji || '🗺️',
                status: 'published',
                published_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ route: data });
    } catch (error) {
        console.error('Error creating master route:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — Update a master route
export async function PATCH(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const allowed = ['title', 'description', 'emoji', 'status', 'sort_order'];
        const safeUpdates = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }
        safeUpdates.updated_at = new Date().toISOString();
        
        // If publishing, set published_at
        if (safeUpdates.status === 'published') {
            safeUpdates.published_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('master_routes')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ route: data });
    } catch (error) {
        console.error('Error updating master route:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — Delete a master route (cascades to POIs and progress)
export async function DELETE(request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const { error } = await supabase
            .from('master_routes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting master route:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
