import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Check if RLS is enabled on cierres_mision
    const { data: rlsCheck } = await supabase.rpc('exec_sql', {
        query: "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'cierres_mision'"
    }).maybeSingle();

    // Fallback: just query pg_tables
    const { data: rlsInfo, error: rlsError } = await supabase
        .from('cierres_mision')
        .select('id, journey_id, total_students, total_flights, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    // 2. Check demo journey specifically
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const { data: demoJourney } = await supabase
        .from('staff_journeys')
        .select('id, school_name, status, mission_state, date')
        .eq('school_name', 'Escuela DEMO FlyHigh')
        .order('created_at', { ascending: false })
        .limit(3);

    // 3. Check if there's a cierre for the demo journey
    let demoCierre = null;
    if (demoJourney?.length) {
        const ids = demoJourney.map(j => j.id);
        const { data } = await supabase
            .from('cierres_mision')
            .select('*')
            .in('journey_id', ids);
        demoCierre = data;
    }

    // 4. Try a test write with anon key to see if RLS blocks it
    const anonSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const testId = 'test-rls-check-' + Date.now();
    const { error: writeTest } = await anonSupabase
        .from('cierres_mision')
        .insert({ journey_id: testId, total_students: 0 });
    
    // Clean up test record if it succeeded
    if (!writeTest) {
        await supabase.from('cierres_mision').delete().eq('journey_id', testId);
    }

    return NextResponse.json({
        rls_blocks_anon_write: writeTest ? writeTest.message : 'NO - anon can write',
        recent_cierres: rlsInfo,
        demo_journeys: demoJourney,
        demo_cierres: demoCierre,
        today,
    });
}
