import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
        const { 
            nombre_escuela, cct, turno, fecha_programada, cuota_alumno, numero_ninos,
            nombre_director, telefono_director, colonia
        } = body;

        if (!nombre_escuela || !fecha_programada || !cuota_alumno) {
            return NextResponse.json(
                { error: 'nombre_escuela, fecha_programada, y cuota_alumno son requeridos' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const schoolData = {
            nombre_escuela: nombre_escuela.trim(),
            cct: cct || null,
            turno: turno || null,
            fecha_programada,
            cuota_alumno: parseFloat(cuota_alumno),
            numero_ninos: numero_ninos ? parseInt(numero_ninos, 10) : null,
            nombre_director: nombre_director?.trim() || null,
            telefono_director: telefono_director?.trim() || null,
            colonia: colonia?.trim() || '',
            estatus: 'pendiente',
            registrado_via: 'ventas_campo'
        };

        const { data, error } = await supabase
            .from('proximas_escuelas')
            .insert(schoolData)
            .select();

        if (error) throw error;

        const result = data && data.length > 0 ? data[0] : null;

        return NextResponse.json(
            { message: 'Escuela registrada exitosamente', data: result },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error in sales-register:', error);
        return NextResponse.json(
            { error: error.message || 'Error interno del servidor al registrar escuela' },
            { status: 500 }
        );
    }
}
