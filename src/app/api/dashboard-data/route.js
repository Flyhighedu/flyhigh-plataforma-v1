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
            { data: cronograma, error: cronErr },
        ] = await Promise.all([
            supabase
                .from('staff_journeys')
                .select('id, date, school_name, school_id, status, mission_state')
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
                .not('journey_id', 'is', null),
            // ── SSoT: Cronograma directo de proximas_escuelas ──
            supabase
                .from('proximas_escuelas')
                .select('id, nombre_escuela, colonia, fecha_programada, estatus')
                .eq('is_archived', false)
                .order('fecha_programada', { ascending: true }),
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

        // ── SSoT: Live Mission Detection ──
        // Find ANY journey currently in 'operation' status (active field mission)
        const activeJourney = (journeys || []).find(j => j.status === 'operation');
        let liveMission = null;

        if (activeJourney) {
            const liveStudents = studentSumMap[activeJourney.id] || 0;
            // Count individual flights for this journey from bitacora
            const liveFlightCount = (bitacora || []).filter(b => b.journey_id === activeJourney.id).length;
            
            // Resolve school name
            const schoolMap = {};
            (schools || []).forEach(s => { schoolMap[s.id] = s; });
            const school = schoolMap[activeJourney.school_id];
            
            liveMission = {
                journeyId: activeJourney.id,
                schoolName: activeJourney.school_name || school?.nombre_escuela || 'Escuela en curso',
                studentsFlown: liveStudents,
                flightsCompleted: liveFlightCount,
                status: activeJourney.status,
            };
        }

        return NextResponse.json({
            journeys: journeys || [],
            cierres: cierres || [],
            schools: schools || [],
            liveStudentsMap: studentSumMap,
            // ── NEW: SSoT Cronograma from proximas_escuelas ──
            cronograma: cronograma || [],
            // ── NEW: Live Mission Data ──
            liveMission,
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
