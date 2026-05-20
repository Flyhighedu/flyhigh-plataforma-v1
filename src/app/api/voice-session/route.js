import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor.' }, { status: 500 });
        }

        return NextResponse.json({ apiKey });
    } catch (error) {
        console.error('Error en /api/voice-session:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
