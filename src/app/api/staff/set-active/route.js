import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Admin-only: activar/desactivar usuario staff
export async function POST(request) {
    try {
        const body = await request.json();
        const { user_id, is_active } = body;

        if (!user_id || typeof is_active !== 'boolean') {
            return NextResponse.json(
                { error: 'Faltan campos: user_id (string), is_active (boolean)' },
                { status: 400 }
            );
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

        // 1. Actualizar perfil
        const { error: profileError } = await supabaseAdmin
            .from('staff_profiles')
            .update({ is_active, updated_at: new Date().toISOString() })
            .eq('user_id', user_id);

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        // 2. Banear/desbanear en Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            ban_duration: is_active ? 'none' : '876600h' // ~100 años = forever
        });

        if (authError) {
            // Revertir el cambio de perfil si Auth falla
            await supabaseAdmin
                .from('staff_profiles')
                .update({ is_active: !is_active })
                .eq('user_id', user_id);
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, is_active });

    } catch (error) {
        console.error('Error en set-active:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
