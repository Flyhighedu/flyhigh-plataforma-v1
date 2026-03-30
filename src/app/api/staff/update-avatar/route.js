import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { avatar_config } = body;

        if (!avatar_config) {
            return NextResponse.json({ error: 'Configuración vacía' }, { status: 400 });
        }

        // 1. Verificar identidad estricta vía cookies
        const supabaseAuth = await createClient();
        const { data: authData, error: authError } = await supabaseAuth.auth.getUser();

        if (authError || !authData?.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const userId = authData.user.id;

        // 2. Usar Service Role para esquivar problemas de RLS en 'update' 
        // y asegurar que el usuario solo pueda modificar SU fila y SU avatar_config.
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Falta service role key en servidor' }, { status: 500 });
        }

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { error: updateError } = await supabaseAdmin
            .from('staff_profiles')
            .update({ 
                avatar_config,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: 'ID Guardado exitosamente' });

    } catch (error) {
        console.error('Error en update-avatar:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
