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

export async function POST(request) {
    try {
        const body = await request.json();
        const { nombre_escuela, colonia, fecha_programada, cct, turno, id, nombre_director, telefono_director, numero_ninos, precio } = body;

        // Validate required fields
        if (!nombre_escuela || !fecha_programada) {
            return NextResponse.json(
                { error: 'nombre_escuela y fecha_programada son requeridos' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const schoolData = {
            nombre_escuela: nombre_escuela.trim(),
            colonia: colonia || '',
            fecha_programada,
            cct: cct || null,
            turno: turno || null,
            nombre_director: nombre_director || null,
            telefono_director: telefono_director || null,
            numero_ninos: numero_ninos || null,
            // SSoT: "precio" del admin se mapea a cuota_alumno (misma columna que usa Sandbox Cronograma)
            cuota_alumno: precio ? parseFloat(precio) : null,
        };

        let result;

        if (id) {
            // UPDATE existing school
            const { data, error } = await supabase
                .from('proximas_escuelas')
                .update(schoolData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            result = data;
        } else {
            // INSERT new school — mark origin for traceability
            const { data, error } = await supabase
                .from('proximas_escuelas')
                .insert({ ...schoolData, estatus: 'pendiente', registrado_via: 'admin' })
                .select()
                .single();

            if (error) throw error;
            result = data;
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err) {
        console.error('[API] save-school error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
