// Diagnostic script: query bitacora_vuelos to see what's actually in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function diagnose() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 DIAGNÓSTICO: bitacora_vuelos en Supabase');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Total flights in bitacora_vuelos
    const { data: allFlights, error } = await supabase
        .from('bitacora_vuelos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('❌ Error querying bitacora_vuelos:', error.message);
        return;
    }

    console.log(`📊 Total de vuelos en bitacora_vuelos: ${allFlights.length}\n`);

    if (allFlights.length === 0) {
        console.log('⚠️  No hay vuelos en la tabla.');
        return;
    }

    // 2. Show each flight
    allFlights.forEach((f, i) => {
        console.log(`── Vuelo ${i + 1} ──`);
        console.log(`   ID:            ${f.id}`);
        console.log(`   journey_id:    ${f.journey_id || 'NULL'}`);
        console.log(`   mission_id:    ${f.mission_id || 'NULL'}`);
        console.log(`   flight_number: ${f.flight_number || 'NULL'}`);
        console.log(`   student_count: ${f.student_count || 0}`);
        console.log(`   staff_count:   ${f.staff_count || 0}`);
        console.log(`   start_time:    ${f.start_time || 'NULL'}`);
        console.log(`   end_time:      ${f.end_time || 'NULL'}`);
        console.log(`   created_at:    ${f.created_at}`);
        console.log(`   user_id:       ${f.user_id || 'NULL'}`);
        console.log('');
    });

    // 3. Check today's journeys
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    console.log(`\n📅 Journeys de hoy (${today}):`);
    
    const { data: todayJourneys, error: jError } = await supabase
        .from('staff_journeys')
        .select('id, user_id, date, school_id, role, meta, created_at')
        .eq('date', today)
        .order('created_at', { ascending: false });

    if (jError) {
        console.error('❌ Error querying staff_journeys:', jError.message);
    } else {
        console.log(`   Total journeys hoy: ${todayJourneys.length}`);
        todayJourneys.forEach((j, i) => {
            const meta = typeof j.meta === 'string' ? JSON.parse(j.meta) : (j.meta || {});
            const telemetryCount = Array.isArray(meta.telemetry_recordings) ? meta.telemetry_recordings.length : 0;
            console.log(`   ${i + 1}. Journey ${j.id} | role: ${j.role} | school: ${j.school_id} | telemetry: ${telemetryCount} recordings`);
        });
    }

    // 4. Cross-reference: flights per journey today
    if (todayJourneys && todayJourneys.length > 0) {
        const journeyIds = todayJourneys.map(j => j.id);
        const todayFlights = allFlights.filter(f => journeyIds.includes(f.journey_id));
        console.log(`\n   Vuelos en bitacora_vuelos vinculados a journeys de hoy: ${todayFlights.length}`);
        
        // Check for flights with NULL journey_id that might be orphaned
        const orphanFlights = allFlights.filter(f => !f.journey_id);
        if (orphanFlights.length > 0) {
            console.log(`\n   ⚠️  Vuelos HUÉRFANOS (sin journey_id): ${orphanFlights.length}`);
            orphanFlights.forEach((f, i) => {
                console.log(`      ${i + 1}. ID: ${f.id} | mission: ${f.mission_id} | students: ${f.student_count} | created: ${f.created_at}`);
            });
        }
    }

    // 5. Check staff_profiles for pilot
    const { data: profiles } = await supabase
        .from('staff_profiles')
        .select('user_id, full_name, role')
        .eq('role', 'pilot');
    
    console.log(`\n👨‍✈️ Pilotos registrados: ${(profiles || []).length}`);
    (profiles || []).forEach(p => {
        console.log(`   - ${p.full_name} (${p.user_id})`);
    });

    console.log('\n═══════════════════════════════════════════════════');
    console.log('🏁 Diagnóstico completado');
    console.log('═══════════════════════════════════════════════════');
}

diagnose().catch(console.error);
