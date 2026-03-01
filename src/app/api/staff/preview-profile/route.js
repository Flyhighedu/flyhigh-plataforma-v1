import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Obtener perfil de operativo + escuela del día para preview (usa service_role para bypassear RLS)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json({ error: 'Falta user_id' }, { status: 400 });
        }

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Perfil del operativo
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('staff_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
        }

        // 2. Escuela programada hoy
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        const { data: scheduled } = await supabaseAdmin
            .from('proximas_escuelas')
            .select('id, nombre_escuela, colonia, fecha_programada')
            .eq('fecha_programada', today)
            .in('estatus', ['pendiente', 'en_progreso'])
            .order('id', { ascending: false })
            .limit(1);

        const school = scheduled && scheduled.length > 0 ? {
            id: scheduled[0].id,
            school_name: scheduled[0].nombre_escuela,
            colonia: scheduled[0].colonia,
        } : null;

        return NextResponse.json({ profile, school });

    } catch (error) {
        console.error('Error en preview-profile:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
