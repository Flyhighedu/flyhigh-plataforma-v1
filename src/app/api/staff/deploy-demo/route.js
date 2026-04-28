import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { TEST_SCHOOL_ID } from '@/utils/testModeUtils';

export async function POST(request) {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

        // 1. Upsert Demo School
        const { error: schoolError } = await supabaseAdmin
            .from('proximas_escuelas')
            .upsert({
                id: TEST_SCHOOL_ID,
                nombre_escuela: 'Escuela DEMO FlyHigh',
                colonia: 'Col. Pruebas (Simulación)',
                fecha_programada: today,
                estatus: 'pendiente'
            });

        if (schoolError) {
            console.error('Error deploying demo school:', schoolError);
            return NextResponse.json({ error: schoolError.message }, { status: 500 });
        }

        // 2. Upsert Demo Journey (so MissionBrief finds a valid journeyId)
        const { data: journey, error: journeyError } = await supabaseAdmin
            .from('staff_journeys')
            .upsert({
                date: today,
                school_id: TEST_SCHOOL_ID,
                school_name: 'Escuela DEMO FlyHigh',
                status: 'prep',
                mission_state: 'PILOT_PREP',
                meta: {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'date,school_id' })
            .select('id')
            .single();

        if (journeyError) {
            console.warn('⚠️ Demo journey upsert failed (non-blocking):', journeyError);
        }

        return NextResponse.json({
            success: true,
            message: 'Demo School + Journey deployed',
            journeyId: journey?.id || null
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

        // 1. Find the demo journey ID for cleanup
        const { data: demoJourney } = await supabaseAdmin
            .from('staff_journeys')
            .select('id')
            .eq('school_id', TEST_SCHOOL_ID)
            .eq('date', today)
            .single();

        const demoJourneyId = demoJourney?.id;

        // 2. Signal ALL connected clients to exit by closing the journey first.
        //    The realtime UPDATE listener on contingencia-piloto/page.js detects
        //    status='closed' and redirects everyone to the dashboard lobby.
        if (demoJourneyId) {
            await supabaseAdmin
                .from('staff_journeys')
                .update({
                    status: 'closed',
                    mission_state: 'completed',
                    meta: { demo_exit: true, demo_exit_at: new Date().toISOString() },
                    updated_at: new Date().toISOString()
                })
                .eq('id', demoJourneyId);

            // Give realtime 2s to propagate the close event to all clients
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 3. Now clean up all related data
            await Promise.allSettled([
                supabaseAdmin.from('staff_prep_events').delete().eq('journey_id', demoJourneyId),
                supabaseAdmin.from('staff_prep_photos').delete().eq('journey_id', demoJourneyId),
                supabaseAdmin.from('staff_events').delete().eq('journey_id', demoJourneyId),
                supabaseAdmin.from('staff_presence').delete().eq('journey_id', demoJourneyId),
                supabaseAdmin.from('bitacora_vuelos').delete().eq('journey_id', demoJourneyId),
            ]);

            // 4. Delete the journey itself
            await supabaseAdmin
                .from('staff_journeys')
                .delete()
                .eq('id', demoJourneyId);
        }

        // 4. Archive Demo School entry for today
        let { error } = await supabaseAdmin
            .from('proximas_escuelas')
            .update({
                estatus: 'archivado',
                is_archived: true,
                archived_at: new Date().toISOString()
            })
            .eq('id', TEST_SCHOOL_ID)
            .eq('fecha_programada', today);

        if (error && /column/i.test(error.message || '')) {
            const fallback = await supabaseAdmin
                .from('proximas_escuelas')
                .update({ estatus: 'archivado' })
                .eq('id', TEST_SCHOOL_ID)
                .eq('fecha_programada', today);
            error = fallback.error;
        }

        if (error) {
            console.error('Error archiving demo school:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Demo School + Journey cleaned up' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
