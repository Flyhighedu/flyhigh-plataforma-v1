import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { TEST_SCHOOL_ID } from '@/utils/testModeUtils';

export async function POST(request) {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

        // Upsert Demo School
        const { error } = await supabaseAdmin
            .from('proximas_escuelas')
            .upsert({
                id: TEST_SCHOOL_ID,
                nombre_escuela: 'Escuela DEMO FlyHigh',
                colonia: 'Col. Pruebas (Simulación)',
                fecha_programada: today,
                estatus: 'pendiente'
            });

        if (error) {
            console.error('Error deploying demo school:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Demo School deployed' });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

        // Archive Demo School entry for today (soft-delete)
        let { error } = await supabaseAdmin
            .from('proximas_escuelas')
            .update({
                estatus: 'archivado',
                is_archived: true,
                archived_at: new Date().toISOString()
            })
            .eq('id', TEST_SCHOOL_ID)
            .eq('fecha_programada', today);

        if (error && /column/i.test(error.message || '')) {
            const fallback = await supabaseAdmin
                .from('proximas_escuelas')
                .update({ estatus: 'archivado' })
                .eq('id', TEST_SCHOOL_ID)
                .eq('fecha_programada', today);
            error = fallback.error;
        }

        if (error) {
            console.error('Error deleting demo school:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Demo School archived' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
