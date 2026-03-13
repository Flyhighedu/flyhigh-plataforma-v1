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

// GET — fetch all bitacora_vuelos rows
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('bitacora_vuelos')
            .select('id, mission_id, journey_id, student_count, duration_seconds, start_time, end_time, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (err) {
        console.error('[API] sandbox-vuelos GET error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PATCH — update a single field on a single row
export async function PATCH(request) {
    try {
        const { id, field, value } = await request.json();

        if (!id || !field) {
            return NextResponse.json(
                { error: 'id and field are required' },
                { status: 400 }
            );
        }

        // Allowlist of editable fields to prevent arbitrary writes
        const editableFields = ['mission_id', 'student_count', 'duration_seconds', 'start_time', 'end_time'];
        if (!editableFields.includes(field)) {
            return NextResponse.json(
                { error: `Field "${field}" is not editable` },
                { status: 403 }
            );
        }

        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from('bitacora_vuelos')
            .update({ [field]: value })
            .eq('id', id)
            .select();

        if (error) throw error;

        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-vuelos PATCH error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
