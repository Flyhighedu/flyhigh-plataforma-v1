import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Listar todos los operativos con email (usa service_role para bypassear RLS + acceder auth.users)
export async function GET() {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Obtener perfiles de staff
        const { data: profiles, error } = await supabaseAdmin
            .from('staff_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // 2. Obtener emails de auth.users para cada perfil
        const staffWithEmails = await Promise.all(
            (profiles || []).map(async (profile) => {
                try {
                    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
                    return {
                        ...profile,
                        email: user?.email || 'N/A'
                    };
                } catch {
                    return { ...profile, email: 'N/A' };
                }
            })
        );

        return NextResponse.json({ staff: staffWithEmails });

    } catch (error) {
        console.error('Error en list-staff:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
