import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

const editableFields = [
    'nombre_escuela', 'cct', 'colonia', 'fecha_programada', 'estatus', 
    'nombre_director', 'telefono_director', 'cuota_alumno', 'tarifa_base', 
    'subsidio_patrocinador', 'numero_zona', 'numero_sector', 
    'nombre_maestro_delegado', 'telefono_maestro_delegado', 'notas', 'turno'
];

export async function GET() {
    try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('proximas_escuelas')
            .select('*')
            .order('fecha_programada', { ascending: false });

        if (error) throw error;
        // Try to enrich any empty turnos with dat from catalog
        const { data: catalogoRaw } = await supabase
            .from('catalogo_escuelas')
            .select('cct, turno');

        const catalogoMap = new Map();
        if (catalogoRaw) {
            catalogoRaw.forEach(c => {
                if (c.cct && c.turno) {
                    catalogoMap.set(c.cct.toUpperCase(), c.turno);
                }
            });
        }

        const enrichedData = (data || []).map(row => {
            let turnoFinal = row.turno;
            if (!turnoFinal && row.cct) {
                 turnoFinal = catalogoMap.get(row.cct.toUpperCase()) || "";
            }
            return {
                ...row,
                turno: turnoFinal
            };
        });

        return NextResponse.json({ data: enrichedData });
    } catch (err) {
        console.error('[API] sandbox-cronograma GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { id, field, value } = await request.json();

        if (!id || !field) {
            return NextResponse.json({ error: 'id and field are required' }, { status: 400 });
        }

        if (!editableFields.includes(field)) {
            return NextResponse.json({ error: `Field "${field}" is not editable` }, { status: 403 });
        }

        const supabase = getAdminSupabase();
        
        let castValue = value;
        if (['cuota_alumno', 'tarifa_base', 'subsidio_patrocinador'].includes(field)) {
            castValue = value === '' || value === null ? null : parseFloat(value);
            if (castValue !== null && isNaN(castValue)) {
                return NextResponse.json({ error: 'Valor numérico inválido' }, { status: 400 });
            }
        }

        const { data, error } = await supabase
            .from('proximas_escuelas')
            .update({ [field]: castValue })
            .eq('id', id)
            .select();

        if (error) throw error;
        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-cronograma PATCH error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const payload = await request.json();
        const payloadToInsert = { ...payload, registrado_via: payload.registrado_via || 'manual' };
        
        // Remove id if passed accidentally
        delete payloadToInsert.id;

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('proximas_escuelas')
            .insert(payloadToInsert)
            .select();

        if (error) throw error;
        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-cronograma POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { error } = await supabase
            .from('proximas_escuelas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API] sandbox-cronograma DELETE error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
