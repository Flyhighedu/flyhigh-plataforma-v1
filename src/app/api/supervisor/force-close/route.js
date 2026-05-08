import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { journeyId } = body;

        if (!journeyId) {
            return NextResponse.json({ error: 'Missing journeyId' }, { status: 400 });
        }

        // Initialize Supabase with Service Role to bypass RLS
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch Journey
        const { data: journey, error: journeyError } = await supabase
            .from('staff_journeys')
            .select('*')
            .eq('id', journeyId)
            .single();

        if (journeyError || !journey) {
            return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
        }

        const missionId = String(journey.school_id || '');
        if (!missionId) {
            return NextResponse.json({ error: 'Journey has no school_id' }, { status: 400 });
        }

        let meta = journey.meta || {};
        if (typeof meta === 'string') {
            try {
                meta = JSON.parse(meta);
            } catch (e) {
                meta = {};
            }
        }

        const schoolName = meta.schoolName || 'Unknown';

        // 2. Fetch Flights
        const { data: flights, error: flightsError } = await supabase
            .from('bitacora_vuelos')
            .select('student_count, created_at')
            .eq('mission_id', missionId);

        if (flightsError) {
            return NextResponse.json({ error: 'Error fetching flights' }, { status: 500 });
        }

        const totalFlights = flights?.length || 0;
        const totalStudents = (flights || []).reduce((acc, f) => acc + Number(f.student_count || 0), 0);
        
        let maxDate = new Date().toISOString();
        if (flights && flights.length > 0) {
            const sorted = [...flights].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            maxDate = sorted[0].created_at;
        }

        // 3. Create Cierre (Ignore if exists via Upsert or just let it fail silently and continue)
        const cierrePayload = {
            mission_id: missionId,
            school_id: /^\\d+$/.test(missionId) ? Number(missionId) : null,
            journey_id: journeyId,
            total_flights: totalFlights,
            total_students: totalStudents,
            checklist_verified: true,
            signature_url: 'SYSTEM_FORCED_CLOSE',
            group_photo_url: 'SYSTEM_FORCED_CLOSE',
            created_at: maxDate,
            end_time: new Date().toISOString(),
            school_name_snapshot: schoolName
        };

        const { error: cierreError } = await supabase
            .from('cierres_mision')
            .upsert(cierrePayload, { onConflict: 'mission_id' }); // Avoid duplicate key errors if it somehow exists

        // 4. Update Journey
        meta.closure_checkout_done = true;
        if (!meta.closure) meta.closure = {};
        if (!meta.closure.phases) meta.closure.phases = {};
        if (!meta.closure.phases.checkout) meta.closure.phases.checkout = {};
        meta.closure.phases.checkout.completed = true;

        const { error: updateJourneyError } = await supabase
            .from('staff_journeys')
            .update({
                mission_state: 'completed',
                meta: meta
            })
            .eq('id', journeyId);

        if (updateJourneyError) {
             return NextResponse.json({ error: 'Failed to update journey' }, { status: 500 });
        }

        // 5. Update Presence (Free the staff)
        await supabase
            .from('staff_presence')
            .update({ status: 'offline', current_journey_id: null, updated_at: new Date().toISOString() })
            .eq('current_journey_id', journeyId);

        return NextResponse.json({ success: true, flights: totalFlights, students: totalStudents });

    } catch (error) {
        console.error('Force close API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
