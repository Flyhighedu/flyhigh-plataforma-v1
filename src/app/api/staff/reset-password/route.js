import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Admin-only: resetear password de un usuario staff
export async function POST(request) {
    try {
        const body = await request.json();
        const { user_id, new_password } = body;

        if (!user_id || !new_password) {
            return NextResponse.json(
                { error: 'Faltan campos: user_id, new_password' },
                { status: 400 }
            );
        }

        if (new_password.length < 6) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres' },
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

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
            password: new_password
        });

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        // Also save the new password for admin reference
        await supabaseAdmin
            .from('staff_profiles')
            .update({ initial_password: new_password, updated_at: new Date().toISOString() })
            .eq('user_id', user_id);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error en reset-password:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
