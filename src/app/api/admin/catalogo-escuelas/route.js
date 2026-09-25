import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { localSchoolLocationsEnabled } from '@/lib/school-locations-server';

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

        if (localSchoolLocationsEnabled()) {
            const rows = [];
            for (let start = 0; ; start += 1000) {
                const { data, error } = await supabase.from('catalogo_escuelas').select('*').order('cct').range(start, start + 999);
                if (error) throw error;
                rows.push(...data);
                if (data.length < 1000) break;
            }
            return NextResponse.json({ data: rows.sort((a, b) => (a.nombre_escuela || '').localeCompare(b.nombre_escuela || '', 'es')) });
        }

        const { data, error } = await supabase
            .from('catalogo_escuelas')
            .select('*')
            .order('nombre_escuela', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (err) {
        console.error('[API] catalogo-escuelas error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
