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

        // Paso preventivo: Eliminar conversaciones de WhatsApp que apunten a esta escuela
        // para evitar "violates foreign key constraint".
        await supabase
            .from('whatsapp_conversations')
            .delete()
            .eq('proxima_escuela_id', id);

        const { error } = await supabase
            .from('proximas_escuelas')
            .delete()
            .eq('id', id);

        if (error) {
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
