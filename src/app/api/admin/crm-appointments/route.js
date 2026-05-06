import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — List upcoming appointments (next 14 days by default)
export async function GET(request) {
    try {
        const supabase = getAdmin();
        const { searchParams } = new URL(request.url);
        const cct = searchParams.get('cct');
        const upcoming = searchParams.get('upcoming');

        let query = supabase
            .from('crm_citas_venta')
            .select(`
                *,
                catalogo_escuelas (nombre_escuela, tipo, nivel_educativo)
            `)
            .order('fecha_hora', { ascending: true });

        if (cct) {
            query = query.eq('cct', cct);
        }

        if (upcoming === 'true') {
            const now = new Date().toISOString();
            const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString();
            query = query
                .eq('estado', 'pendiente')
                .gte('fecha_hora', now)
                .lte('fecha_hora', twoWeeks);
        }

        const { data, error } = await query;
        if (error) throw error;

        const enriched = (data || []).map(c => ({
            ...c,
            nombre_escuela: c.catalogo_escuelas?.nombre_escuela || c.cct,
            tipo: c.catalogo_escuelas?.tipo || '',
            nivel_educativo: c.catalogo_escuelas?.nivel_educativo || '',
        }));

        return NextResponse.json({ data: enriched });
    } catch (err) {
        console.error('[CRM Appointments GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — Create a new appointment
export async function POST(request) {
    try {
        const supabase = getAdmin();
        const body = await request.json();
        const { cct, titulo, fecha_hora, duracion_min, responsable, notas } = body;

        if (!cct || !fecha_hora) {
            return NextResponse.json({ error: 'cct y fecha_hora son requeridos' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('crm_citas_venta')
            .insert({
                cct,
                titulo: titulo || 'Cita de Ventas',
                fecha_hora,
                duracion_min: duracion_min || 60,
                responsable: responsable || null,
                notas: notas || null,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[CRM Appointments POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH — Update appointment (mark reminder sent, change status, etc.)
export async function PATCH(request) {
    try {
        const supabase = getAdmin();
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('crm_citas_venta')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[CRM Appointments PATCH]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — Remove an appointment
export async function DELETE(request) {
    try {
        const supabase = getAdmin();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
        }

        const { error } = await supabase
            .from('crm_citas_venta')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[CRM Appointments DELETE]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
