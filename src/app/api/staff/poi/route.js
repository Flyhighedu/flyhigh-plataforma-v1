import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabaseAdmin() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET /api/staff/poi — List all active POIs
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('poi_locations')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, pois: data || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/staff/poi — Create a new POI
export async function POST(request) {
    try {
        const body = await request.json();
        const { name, emoji, lat, lng, created_by, created_by_name } = body;

        if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
            return NextResponse.json(
                { error: 'Campos requeridos: name (string), lat (number), lng (number)' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('poi_locations')
            .insert({
                name: name.trim(),
                emoji: emoji || '📍',
                lat, lng,
                created_by: created_by || null,
                created_by_name: created_by_name || null
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, poi: data });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH /api/staff/poi — Update a POI
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, name, emoji, is_active } = body;

        if (!id) return NextResponse.json({ error: 'Campo requerido: id' }, { status: 400 });

        const updates = { updated_at: new Date().toISOString() };
        if (name !== undefined) updates.name = name.trim();
        if (emoji !== undefined) updates.emoji = emoji;
        if (is_active !== undefined) updates.is_active = is_active;

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('poi_locations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, poi: data });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
