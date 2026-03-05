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

export async function POST(request) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: 'id es requerido' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        const { error } = await supabase
            .from('proximas_escuelas')
            .update({
                estatus: 'archivado',
                is_archived: true,
                archived_at: new Date().toISOString()
            })
            .eq('id', id);

        // Fallback if is_archived / archived_at columns don't exist
        if (error && /column/i.test(error.message || '')) {
            const { error: fallbackError } = await supabase
                .from('proximas_escuelas')
                .update({ estatus: 'archivado' })
                .eq('id', id);

            if (fallbackError) throw fallbackError;
        } else if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API] delete-school error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
