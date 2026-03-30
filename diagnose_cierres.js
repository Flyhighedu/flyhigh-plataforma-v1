const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fullAudit() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('╔══════════════════════════════════════════╗');
    console.log('║   AUDITORÍA COMPLETA - cierres_mision    ║');
    console.log('╚══════════════════════════════════════════╝\n');
    
    // 1. ALL cierres in the table
    const { data: allCierres, error: cErr } = await admin
        .from('cierres_mision')
        .select('id, journey_id, mission_id, total_students, total_flights, school_name_snapshot, end_time, created_at')
        .order('created_at', { ascending: false });
    
    console.log(`\n[1] TOTAL CIERRES EN LA TABLA: ${allCierres?.length || 0}`);
    console.log('    Con journey_id:', allCierres?.filter(c => c.journey_id).length || 0);
    console.log('    Sin journey_id (huérfanos):', allCierres?.filter(c => !c.journey_id).length || 0);
    
    // 2. Demo journey info
    const { data: demoJ } = await admin
        .from('staff_journeys')
        .select('id, school_name, school_id, status, mission_state, date, created_at')
        .eq('school_name', 'Escuela DEMO FlyHigh')
        .order('created_at', { ascending: false })
        .limit(5);
    
    console.log(`\n[2] DEMO JOURNEYS: ${demoJ?.length || 0}`);
    if (demoJ?.length) {
        for (const j of demoJ) {
            console.log(`    ID: ${j.id}`);
            console.log(`    Status: ${j.status} | State: ${j.mission_state}`);
            console.log(`    Date: ${j.date} | School ID: ${j.school_id}`);
            
            // Check cierre for this journey
            const { data: jCierre } = await admin
                .from('cierres_mision')
                .select('*')
                .eq('journey_id', j.id);
            console.log(`    Cierre: ${jCierre?.length ? JSON.stringify(jCierre[0]) : '❌ NONE'}`);
            
            // Check vuelos for this journey
            const { data: jVuelos } = await admin
                .from('bitacora_vuelos')
                .select('id, student_count, staff_count, journey_id')
                .eq('journey_id', j.id);
            console.log(`    Vuelos: ${jVuelos?.length || 0}`);
            if (jVuelos?.length) {
                const totalStudents = jVuelos.reduce((s, v) => s + (v.student_count || 0), 0);
                console.log(`    Sum student_count from vuelos: ${totalStudents}`);
            }
            console.log('');
        }
    }
    
    // 3. Check what the API would return for demo journey
    if (demoJ?.length) {
        const journeyId = demoJ[0].id;
        
        // Simulate what GET /api/sandbox-vuelos does
        const { data: cierres } = await admin
            .from('cierres_mision')
            .select('id, journey_id, total_students, total_flights, becados');
        
        const cierreMap = {};
        if (cierres) {
            for (const c of cierres) {
                if (c.journey_id) {
                    cierreMap[c.journey_id] = c;
                }
            }
        }
        
        const match = cierreMap[journeyId];
        console.log(`[3] API SIMULATION for journey ${journeyId}:`);
        console.log(`    cierreMap match: ${match ? JSON.stringify(match) : '❌ NO MATCH'}`);
        console.log(`    Would show total_students: ${match?.total_students || 0}`);
    }

    // 4. Check unique constraint on journey_id
    const { data: constraints } = await admin.rpc('exec_sql', {
        sql: "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'cierres_mision'::regclass"
    });
    console.log('\n[4] CONSTRAINTS:', constraints || 'Could not query');
    
    // 5. Check RLS policies
    console.log('\n[5] RLS STATUS:');
    // Try anon write
    const anon = createClient(url, anonKey);
    const { error: anonInsert } = await anon
        .from('cierres_mision')
        .insert({ journey_id: 'test-anon-' + Date.now(), total_students: 1 });
    console.log('    Anon INSERT:', anonInsert ? '❌ ' + anonInsert.message : '✅ OK');
    
    // Try anon select
    const { data: anonSelect, error: anonSelErr } = await anon
        .from('cierres_mision')
        .select('id')
        .limit(1);
    console.log('    Anon SELECT:', anonSelErr ? '❌ ' + anonSelErr.message : `✅ ${anonSelect?.length} rows`);
    
    // 6. Check the last 5 cierres with ALL fields
    console.log('\n[6] LAST 5 CIERRES (all fields):');
    if (allCierres?.length) {
        for (const c of allCierres.slice(0, 5)) {
            console.log(`    ${c.id} | journey: ${c.journey_id || 'NULL'} | students: ${c.total_students} | flights: ${c.total_flights} | school: ${c.school_name_snapshot} | created: ${c.created_at}`);
        }
    }
}

fullAudit().catch(console.error);
