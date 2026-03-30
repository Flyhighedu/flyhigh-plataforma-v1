import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
    try {
        const { data, error } = await supabaseService
            .from('hr_documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req) {
    try {
        const body = await req.json();
        const { id, field, value } = body;

        if (!id || !field) {
            return NextResponse.json({ error: 'Faltan parámetros de actualización (id, field)' }, { status: 400 });
        }

        const { error } = await supabaseService
            .from('hr_documents')
            .update({ [field]: value })
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ message: 'Documento actualizado correctamente.' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
