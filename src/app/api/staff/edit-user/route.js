import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Admin-only: editar perfil de un usuario staff (email, nombre, rol)
export async function POST(request) {
    try {
        const body = await request.json();
        const { user_id, email, full_name, role } = body;

        if (!user_id) {
            return NextResponse.json(
                { error: 'Falta user_id' },
                { status: 400 }
            );
        }

        // At least one field to update
        if (!email && !full_name && !role) {
            return NextResponse.json(
                { error: 'Debes enviar al menos un campo para actualizar (email, full_name, role)' },
                { status: 400 }
            );
        }

        // Validate role if provided
        if (role) {
            const validRoles = ['pilot', 'teacher', 'assistant', 'admin', 'supervisor'];
            if (!validRoles.includes(role)) {
                return NextResponse.json(
                    { error: `Rol inválido. Debe ser: ${validRoles.join(', ')}` },
                    { status: 400 }
                );
            }
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

        // 1. Update email in Supabase Auth if changed
        if (email) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
                email,
                email_confirm: true, // Auto-confirm so they don't need to verify
                user_metadata: {
                    ...(full_name ? { full_name } : {}),
                    ...(role ? { role } : {}),
                }
            });

            if (authError) {
                return NextResponse.json({ error: `Error actualizando email: ${authError.message}` }, { status: 400 });
            }
        }

        // 2. Update staff_profiles
        const profileUpdate = {
            updated_at: new Date().toISOString(),
        };
        if (full_name) profileUpdate.full_name = full_name;
        if (role) profileUpdate.role = role;

        const { error: profileError } = await supabaseAdmin
            .from('staff_profiles')
            .update(profileUpdate)
            .eq('user_id', user_id);

        if (profileError) {
            return NextResponse.json({ error: `Error actualizando perfil: ${profileError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            updated: { user_id, email, full_name, role }
        });

    } catch (error) {
        console.error('Error en edit-user:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
