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

// GET — List all training modules (with card counts)
export async function GET() {
    try {
        const supabase = getAdminClient();
        
        const { data: modules, error } = await supabase
            .from('training_modules')
            .select('*, training_cards(count)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Flatten card count
        const result = (modules || []).map(m => ({
            ...m,
            card_count: m.training_cards?.[0]?.count || 0,
            training_cards: undefined
        }));

        return NextResponse.json({ modules: result });
    } catch (error) {
        console.error('Error fetching training modules:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create a new training module
export async function POST(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        
        const { title, description, source_text, icon, color, target_roles } = body;
        if (!title || !source_text) {
            return NextResponse.json({ error: 'title y source_text son requeridos' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('training_modules')
            .insert({
                title,
                description: description || '',
                source_text,
                icon: icon || '📋',
                color: color || '#6366F1',
                target_roles: target_roles || ['pilot'],
                status: 'draft'
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ module: data });
    } catch (error) {
        console.error('Error creating training module:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — Update a training module (status, metadata)
export async function PATCH(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        // Only allow safe fields
        const allowed = ['title', 'description', 'source_text', 'icon', 'color', 'status', 'target_roles'];
        const safeUpdates = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }
        safeUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('training_modules')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ module: data });
    } catch (error) {
        console.error('Error updating training module:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — Delete a training module and all its cards (cascading)
export async function DELETE(request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const { error } = await supabase
            .from('training_modules')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting training module:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
