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
    'nombre_maestro_delegado', 'telefono_maestro_delegado', 'notas', 'turno',
    'numero_ninos'
];

/**
 * Maps cronograma estatus → CRM pipeline stage.
 * Only advances the pipeline (never goes backwards from a higher stage).
 */
const CRONOGRAMA_TO_CRM = {
    'pendiente':     'agendada',
    'en_progreso':   'en_ruta',
    'completada':    'visitada',
    'cancelada':     null, // Don't change CRM on cancel
};

// CRM stage order for "only advance" logic
const CRM_ORDER = [
    'sin_contacto', 'llamada_sin_respuesta', 'contactada', 'cita_ventas',
    'agendada', 'en_preparacion', 'en_ruta', 'operando', 'visitada', 'perdida'
];

/**
 * Syncs catalogo_escuelas.estado_pipeline based on what happened in the cronograma.
 * @param {SupabaseClient} supabase - Admin client
 * @param {string} cct - School CCT identifier
 * @param {string} cronogramaEstatus - The new estatus from proximas_escuelas
 */
async function syncCRMPipelineState(supabase, cct, cronogramaEstatus) {
    if (!cct) return;

    const normalizedCCT = cct.trim().toUpperCase();
    const targetCRMStage = CRONOGRAMA_TO_CRM[cronogramaEstatus];
    if (!targetCRMStage) return; // null = don't sync (e.g. cancelada)

    // Fetch current CRM state to only advance, never go backwards
    const { data: school, error } = await supabase
        .from('catalogo_escuelas')
        .select('estado_pipeline')
        .ilike('cct', normalizedCCT)
        .maybeSingle();

    if (error || !school) {
        console.warn(`[CRM Sync] No se encontró la escuela ${normalizedCCT} en el catálogo.`);
        return;
    }

    const currentIndex = CRM_ORDER.indexOf(school.estado_pipeline || 'sin_contacto');
    const targetIndex  = CRM_ORDER.indexOf(targetCRMStage);

    if (targetIndex > currentIndex) {
        const { error: updateError } = await supabase
            .from('catalogo_escuelas')
            .update({ estado_pipeline: targetCRMStage })
            .ilike('cct', normalizedCCT);

        if (!updateError) {
            console.log(`[CRM Sync] ${normalizedCCT}: ${school.estado_pipeline} → ${targetCRMStage}`);
        } else {
            console.error(`[CRM Sync Error] ${normalizedCCT}:`, updateError);
        }
    }
}

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

        // — CRM Sync: if estatus changed, update pipeline state —
        if (field === 'estatus' && data?.[0]?.cct) {
            await syncCRMPipelineState(supabase, data[0].cct, castValue);
        }

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

        // — CRM Sync: new mission = school is now 'agendada' —
        if (data?.[0]?.cct) {
            await syncCRMPipelineState(supabase, data[0].cct, 'pendiente');
        }

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
