import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { journeyId, schoolId, userId, role } = await request.json();

        // Use SERVICE ROLE key to bypass RLS
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceRoleKey || !supabaseUrl) {
            console.error('Missing Supabase Service Role configuration');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // 1. Check if journey exists
        const { data: existingJourney, error: fetchError } = await supabase
            .from('staff_journeys')
            .select('*')
            .eq('id', journeyId)
            .single();

        if (existingJourney) {
            return NextResponse.json({ journey: existingJourney, created: false });
        }

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching journey:', fetchError);
            // Don't return error yet, try creating
        }

        // 2. Fetch ANY valid school if schoolId not provided or verify it
        let targetSchoolId = schoolId;
        if (!targetSchoolId) {
            const { data: anySchool } = await supabase
                .from('proximas_escuelas')
                .select('id')
                .limit(1)
                .single();
            targetSchoolId = anySchool?.id;
        }

        if (!targetSchoolId) {
            return NextResponse.json({ error: 'No schools found to link journey' }, { status: 404 });
        }

        // 3. Create Test Journey
        const { data: newJourney, error: insertError } = await supabase
            .from('staff_journeys')
            .insert({
                id: journeyId,
                school_id: targetSchoolId,
                status: 'operation',
                mission_state: 'PILOT_PREP',
                created_at: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0] // Today
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting test journey:', insertError);
            // Check if it was created in the meantime (race condition)
            if (insertError.code === '23505') { // Unique violation
                const { data: retryJourney } = await supabase
                    .from('staff_journeys')
                    .select('*')
                    .eq('id', journeyId)
                    .single();
                return NextResponse.json({ journey: retryJourney, created: false });
            }

            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ journey: newJourney, created: true });

    } catch (e) {
        console.error('API Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
