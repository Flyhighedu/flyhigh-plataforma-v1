import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET: Fetch all fechas_disponibles + cross-reference with proximas_escuelas for turno occupancy
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        // 1. All available dates
        const { data: fechas, error: fechasErr } = await supabase
            .from('fechas_disponibles')
            .select('*')
            .order('fecha', { ascending: true });

        if (fechasErr) throw fechasErr;

        // 2. All scheduled schools (to cross-reference turno occupancy)
        const { data: escuelas, error: escErr } = await supabase
            .from('proximas_escuelas')
            .select('id, nombre_escuela, cct, fecha_programada, estatus')
            .not('estatus', 'eq', 'cancelada');

        if (escErr) throw escErr;

        // 3. Get turno info from catalogo_escuelas for the scheduled CCTs
        const ccts = (escuelas || []).map(e => e.cct).filter(Boolean);
        let turnoMap = {};
        if (ccts.length > 0) {
            const { data: catalogoData } = await supabase
                .from('catalogo_escuelas')
                .select('cct, turno')
                .in('cct', ccts);
            (catalogoData || []).forEach(c => { turnoMap[c.cct] = c.turno; });
        }

        // 4. Enrich each fecha with occupancy info
        const enriched = (fechas || []).map(f => {
            const schoolsOnDate = (escuelas || []).filter(e => e.fecha_programada === f.fecha);
            const slots = schoolsOnDate.map(e => ({
                id: e.id,
                nombre: e.nombre_escuela,
                turno: turnoMap[e.cct] || 'sin turno',
            }));
            const matutino = slots.find(s => s.turno?.toLowerCase().includes('matutino'));
            const vespertino = slots.find(s => s.turno?.toLowerCase().includes('vespertino'));
            return {
                ...f,
                cupo_usado: schoolsOnDate.length,
                slots,
                matutino: matutino || null,
                vespertino: vespertino || null,
            };
        });

        return NextResponse.json({ data: enriched });
    } catch (err) {
        console.error('[API] sandbox-fechas GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: Create a new available date
export async function POST(request) {
    try {
        const { fecha, cupo_maximo, notas } = await request.json();

        if (!fecha) {
            return NextResponse.json({ error: 'fecha is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('fechas_disponibles')
            .insert({ fecha, cupo_maximo: cupo_maximo || 2, notas: notas || null })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[API] sandbox-fechas POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH: Toggle activa or update fields
export async function PATCH(request) {
    try {
        const { id, field, value } = await request.json();

        if (!id || !field) {
            return NextResponse.json({ error: 'id and field are required' }, { status: 400 });
        }

        const allowed = ['activa', 'cupo_maximo', 'notas'];
        if (!allowed.includes(field)) {
            return NextResponse.json({ error: `Field "${field}" is not editable` }, { status: 403 });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('fechas_disponibles')
            .update({ [field]: value })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[API] sandbox-fechas PATCH error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: Remove a date (only if cupo_usado = 0)
export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // Safety: check if any schools are scheduled on this date
        const { data: fecha } = await supabase
            .from('fechas_disponibles')
            .select('fecha')
            .eq('id', id)
            .single();

        if (fecha) {
            const { data: scheduled } = await supabase
                .from('proximas_escuelas')
                .select('id')
                .eq('fecha_programada', fecha.fecha)
                .not('estatus', 'eq', 'cancelada')
                .limit(1);

            if (scheduled && scheduled.length > 0) {
                return NextResponse.json(
                    { error: 'No puedes eliminar una fecha que tiene escuelas agendadas. Primero cancela o mueve las escuelas.' },
                    { status: 409 }
                );
            }
        }

        const { error } = await supabase
            .from('fechas_disponibles')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API] sandbox-fechas DELETE error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
