// Diagnostic: find today's flights and journey
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
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    console.log(`\n📅 Fecha: ${today}\n`);

    // 1. Today's journeys
    const { data: journeys, error: jErr } = await supabase
        .from('staff_journeys')
        .select('*')
        .eq('date', today);
    
    if (jErr) console.error('Journey error:', jErr.message);
    
    console.log(`📋 Journeys de hoy: ${(journeys || []).length}`);
    const journeyIds = [];
    (journeys || []).forEach(j => {
        journeyIds.push(j.id);
        console.log(`   ID: ${j.id}`);
        console.log(`   school_id: ${j.school_id}`);
        console.log(`   role: ${j.role}`);
        console.log(`   date: ${j.date}`);
        console.log(`   created_at: ${j.created_at}`);
        console.log('');
    });

    // 2. Today's flights by date range (not journey)
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    
    const { data: todayFlights, error: fErr } = await supabase
        .from('bitacora_vuelos')
        .select('*')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .order('created_at', { ascending: true });

    if (fErr) console.error('Flight error:', fErr.message);

    console.log(`\n✈️  Vuelos creados HOY en bitacora_vuelos: ${(todayFlights || []).length}`);
    (todayFlights || []).forEach((f, i) => {
        const matchesJourney = journeyIds.includes(f.journey_id);
        console.log(`   ${i+1}. flight_number: ${f.flight_number || 'NULL'} | students: ${f.student_count} | journey_id: ${f.journey_id} | ${matchesJourney ? '✅ MATCHED' : '❌ NOT MATCHED'}`);
        console.log(`      start: ${f.start_time} → end: ${f.end_time}`);
        console.log(`      created: ${f.created_at}`);
    });

    // 3. Flights by journey_id (how supervisor queries)
    if (journeyIds.length > 0) {
        const { data: flightsByJourney, error: fjErr } = await supabase
            .from('bitacora_vuelos')
            .select('*')
            .in('journey_id', journeyIds)
            .order('created_at', { ascending: true });

        if (fjErr) console.error('Flight by journey error:', fjErr.message);

        console.log(`\n🔗 Vuelos filtrados por journey_id (como los ve el supervisor): ${(flightsByJourney || []).length}`);
        (flightsByJourney || []).forEach((f, i) => {
            console.log(`   ${i+1}. students: ${f.student_count} | start: ${f.start_time} → end: ${f.end_time}`);
        });
    }

    // 4. Check if there are flights with mismatched journey_ids
    if (journeyIds.length > 0 && (todayFlights || []).length > 0) {
        const mismatched = todayFlights.filter(f => !journeyIds.includes(f.journey_id));
        if (mismatched.length > 0) {
            console.log(`\n⚠️  VUELOS DE HOY CON journey_id QUE NO COINCIDE: ${mismatched.length}`);
            mismatched.forEach((f, i) => {
                console.log(`   ${i+1}. journey_id: ${f.journey_id} | mission_id: ${f.mission_id}`);
            });
        }
    }

    // 5. Also check: flights from recent days to understand the pattern
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const { data: recentFlights } = await supabase
        .from('bitacora_vuelos')
        .select('journey_id, created_at, student_count')
        .gte('created_at', `${yesterday}T00:00:00.000Z`)
        .order('created_at', { ascending: false });

    console.log(`\n📊 Vuelos desde ayer: ${(recentFlights || []).length}`);
    const byJourney = {};
    (recentFlights || []).forEach(f => {
        const jid = f.journey_id || 'NULL';
        byJourney[jid] = (byJourney[jid] || 0) + 1;
    });
    Object.entries(byJourney).forEach(([jid, count]) => {
        console.log(`   journey ${jid}: ${count} vuelos`);
    });
}

diagnose().catch(console.error);
