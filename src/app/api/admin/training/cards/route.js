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

// GET — List all cards for a module
export async function GET(request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const moduleId = searchParams.get('module_id');

        if (!moduleId) {
            return NextResponse.json({ error: 'module_id es requerido' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('training_cards')
            .select('*')
            .eq('module_id', moduleId)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ cards: data || [] });
    } catch (error) {
        console.error('Error fetching training cards:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Create a manual card
export async function POST(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        const { module_id, question, answer, card_type = 'knowledge', difficulty = 1 } = body;

        if (!module_id || !question || !answer) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('training_cards')
            .insert({
                module_id,
                question,
                answer,
                card_type,
                difficulty,
                status: 'approved', // Manual cards are automatically approved
                sort_order: 999
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ card: data });
    } catch (error) {
        console.error('Error creating manual card:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — Update a card (approve, reject, edit content)
export async function PATCH(request) {
    try {
        const supabase = getAdminClient();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const allowed = ['question', 'answer', 'card_type', 'difficulty', 'status', 'sort_order'];
        const safeUpdates = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) safeUpdates[key] = updates[key];
        }

        const { data, error } = await supabase
            .from('training_cards')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ card: data });
    } catch (error) {
        console.error('Error updating training card:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — Delete a single card
export async function DELETE(request) {
    try {
        const supabase = getAdminClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const { error } = await supabase
            .from('training_cards')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting training card:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
