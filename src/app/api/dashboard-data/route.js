import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side Supabase client — bypasses RLS
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

        // Fetch all data in parallel
        const [
            { data: journeys, error: jErr },
            { data: cierres, error: cErr },
            { data: schools },
            { data: bitacora },
        ] = await Promise.all([
            supabase
                .from('staff_journeys')
                .select('id, date, school_name, school_id, status')
                .order('date', { ascending: false }),
            supabase
                .from('cierres_mision')
                .select('journey_id, total_students, total_flights, becados, group_photo_url, signature_url'),
            supabase
                .from('proximas_escuelas')
                .select('id, nombre_escuela, colonia')
                .order('fecha_programada', { ascending: true }),
            supabase
                .from('bitacora_vuelos')
                .select('journey_id, student_count')
                .not('journey_id', 'is', null)
        ]);

        if (jErr) throw jErr;
        if (cErr) throw cErr;

        // Calculate totals from cierres_mision (single source of truth for sealed missions)
        // PLUS live bitacora flights for active missions that haven't been sealed yet
        const closedJourneyIds = new Set((cierres || []).map(c => c.journey_id).filter(Boolean));
        const activeJourneyIds = new Set((journeys || []).map(j => j.id));
        let liveTotalStudents = 0;
        let studentSumMap = {};
        
        for (const b of (bitacora || [])) {
            if (b.journey_id && activeJourneyIds.has(b.journey_id)) {
                studentSumMap[b.journey_id] = (studentSumMap[b.journey_id] || 0) + (b.student_count || 0);
                if (!closedJourneyIds.has(b.journey_id)) {
                    liveTotalStudents += (b.student_count || 0);
                }
            }
        }

        const totalNinosVolados = (cierres || []).reduce(
            (sum, c) => sum + (c.total_students || 0), 0
        ) + liveTotalStudents;
        
        const totalBecados = (cierres || []).reduce(
            (sum, c) => sum + (c.becados || 0), 0
        );

        return NextResponse.json({
            journeys: journeys || [],
            cierres: cierres || [],
            schools: schools || [],
            liveStudentsMap: studentSumMap,
            totals: {
                ninosVolados: totalNinosVolados,
                ninosPatrocinados: totalBecados,
            },
        });
    } catch (err) {
        console.error('[API] dashboard-data GET error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno' },
            { status: 500 }
        );
    }
}
