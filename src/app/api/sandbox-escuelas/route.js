import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side Supabase client with Service Role Key — bypasses RLS
function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — fetch all schools from catalogo_escuelas
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('catalogo_escuelas')
            .select('*')
            .order('nombre_escuela', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (err) {
        console.error('[API] sandbox-escuelas GET error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PATCH — update a single field on a single row (by cct primary key)
export async function PATCH(request) {
    try {
        const { cct, field, value } = await request.json();

        if (!cct || !field) {
            return NextResponse.json(
                { error: 'cct and field are required' },
                { status: 400 }
            );
        }

        const editableFields = ['nombre_escuela', 'tipo', 'ninos', 'codigo_postal', 'turno', 'visitada'];
        if (!editableFields.includes(field)) {
            return NextResponse.json(
                { error: `Field "${field}" is not editable on catalogo_escuelas` },
                { status: 403 }
            );
        }

        const supabase = getAdminSupabase();

        // Cast numeric fields
        let castValue = value;
        if (field === 'ninos') {
            castValue = value === '' || value === null ? null : parseInt(value);
            if (castValue !== null && isNaN(castValue)) {
                return NextResponse.json({ error: 'Valor numérico inválido' }, { status: 400 });
            }
        }

        const { data, error } = await supabase
            .from('catalogo_escuelas')
            .update({ [field]: castValue })
            .eq('cct', cct)
            .select();

        if (error) throw error;

        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-escuelas PATCH error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST — create a new school in catalogo_escuelas
export async function POST(request) {
    try {
        const { cct, nombre_escuela, tipo, ninos, codigo_postal, turno } = await request.json();

        if (!cct?.trim() || !nombre_escuela?.trim()) {
            return NextResponse.json(
                { error: 'cct y nombre_escuela son requeridos' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('catalogo_escuelas')
            .insert({
                cct: cct.trim(),
                nombre_escuela: nombre_escuela.trim(),
                tipo: tipo || null,
                ninos: ninos ? parseInt(ninos) : null,
                codigo_postal: codigo_postal || null,
                turno: turno || null,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[API] sandbox-escuelas POST error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE — delete a school by cct
export async function DELETE(request) {
    try {
        const { cct } = await request.json();

        if (!cct) {
            return NextResponse.json(
                { error: 'cct is required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { error } = await supabase
            .from('catalogo_escuelas')
            .delete()
            .eq('cct', cct);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: `Escuela con CCT ${cct} eliminada.`,
        });
    } catch (err) {
        console.error('[API] sandbox-escuelas DELETE error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
