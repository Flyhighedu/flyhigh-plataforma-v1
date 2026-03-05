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

export async function GET() {
    try {
        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('proximas_escuelas')
            .select('*')
            .neq('estatus', 'archivado')
            .order('fecha_programada', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (err) {
        console.error('[API] list-schools error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
