import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Admin-only: crear usuario de staff con email + password definido por admin
// Auth: usa SUPABASE_SERVICE_ROLE_KEY directamente (el admin panel usa password hardcodeado, no Supabase Auth)
export async function POST(request) {
    try {
        const body = await request.json();
        const { email, password, full_name, role } = body;

        if (!email || !password || !full_name || !role) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: email, password, full_name, role' },
                { status: 400 }
            );
        }

        const validRoles = ['pilot', 'teacher', 'assistant', 'admin', 'supervisor'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: `Rol inválido. Debe ser: ${validRoles.join(', ')}` },
                { status: 400 }
            );
        }

        // Usar service_role para crear usuario
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json(
                { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Crear usuario en Auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirmar email
            user_metadata: { full_name, role }
        });

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        // 2. Crear perfil en staff_profiles
        const { error: profileError } = await supabaseAdmin
            .from('staff_profiles')
            .upsert({
                user_id: newUser.user.id,
                full_name,
                role,
                is_active: true,
                initial_password: password,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (profileError) {
            // Si falla el perfil, intentar limpiar el usuario creado
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
            return NextResponse.json({ error: `Error creando perfil: ${profileError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: newUser.user.id,
                email: newUser.user.email,
                full_name,
                role
            }
        });

    } catch (error) {
        console.error('Error en create-user:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
