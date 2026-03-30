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
            .from('staff_profiles')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { id, full_name, role, is_active, email, phone } = body;

        if (!id || !full_name) {
            return NextResponse.json({ error: 'ID UUID y Nombre son requeridos.' }, { status: 400 });
        }

        const payload = {
            id,
            full_name,
            role: role || 'auxiliar',
            is_active: is_active ?? true,
            email: email || null,
            phone: phone || null,
        };

        const { data, error } = await supabaseService
            .from('staff_profiles')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data, message: 'Perfil operativo registrado correctamente.' }, { status: 201 });
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
            .from('staff_profiles')
            .update({ [field]: value })
            .eq('user_id', id);

        if (error) throw error;
        return NextResponse.json({ message: 'Atributo actualizado correctamente.' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID es requerido para eliminación' }, { status: 400 });
        }

        const { error } = await supabaseService
            .from('staff_profiles')
            .delete()
            .eq('user_id', id);

        if (error) throw error;
        return NextResponse.json({ message: 'Perfil eliminado permanentemente.' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
