import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

async function isAdmin() {
    const cookieStore = await cookies();
    return cookieStore.has('flyhigh_admin_auth');
}

// GET — List all soundtracks
export async function GET() {
    try {
        const supabase = getServiceClient();
        const { data, error } = await supabase
            .from('official_soundtracks')
            .select('*')
            .order('track_type', { ascending: true })
            .order('sort_order', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ soundtracks: data || [] });
    } catch (err) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// PUT — Reorder soundtracks (batch update sort_order)
export async function PUT(request) {
    try {
        if (!(await isAdmin())) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { items } = await request.json();
        // items = [{ id: 'uuid', sort_order: 0 }, { id: 'uuid', sort_order: 1 }, ...]

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'items array requerido' }, { status: 400 });
        }

        const supabase = getServiceClient();
        const now = new Date().toISOString();

        // Batch update each item
        const updates = items.map(item =>
            supabase
                .from('official_soundtracks')
                .update({ sort_order: item.sort_order, updated_at: now })
                .eq('id', item.id)
        );

        await Promise.all(updates);

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: 'Error al reordenar' }, { status: 500 });
    }
}

// DELETE — Soft delete (set is_active = false) or hard delete
export async function DELETE(request) {
    try {
        if (!(await isAdmin())) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id, hard } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const supabase = getServiceClient();

        if (hard) {
            // Get storage path first
            const { data: track } = await supabase
                .from('official_soundtracks')
                .select('storage_path')
                .eq('id', id)
                .single();

            if (track?.storage_path) {
                await supabase.storage.from('official_soundtracks').remove([track.storage_path]);
            }

            const { error } = await supabase
                .from('official_soundtracks')
                .delete()
                .eq('id', id);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        } else {
            const { error } = await supabase
                .from('official_soundtracks')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
    }
}
