import { createClient } from '@supabase/supabase-js'; // Use direct client for Service Role
import { NextResponse } from 'next/server';

function toMexicoDate(value) {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return '';
    return new Date(parsed).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function chunkArray(values, size = 200) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const chunks = [];
    for (let idx = 0; idx < values.length; idx += size) {
        chunks.push(values.slice(idx, idx + size));
    }
    return chunks;
}

export async function POST(request) {
    try {
        // [CRITICAL] Use Service Role to bypass RLS
        // This ensures we can DELETE events from ALL users (Pilot, Teacher, Assistant)
        // enabling a true global reset.
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        const { journeyId } = await request.json();

        if (!journeyId) {
            return NextResponse.json({ ok: false, error: 'Missing journeyId' }, { status: 400 });
        }

        console.log('🔄 STARTING GLOBAL RESET (ADMIN) for Journey:', journeyId);

        // Resolve mission/date context for safe cleanup of orphan (legacy) rows.
        // IMPORTANT: We only remove orphan rows for THIS mission and THIS journey day.
        const { data: journeyMeta, error: journeyMetaError } = await supabase
            .from('staff_journeys')
            .select('id, school_id, date')
            .eq('id', journeyId)
            .single();

        if (journeyMetaError) {
            console.warn('⚠️ Could not read journey metadata for legacy cleanup:', journeyMetaError.message);
        }

        const journeyMissionId = journeyMeta?.school_id === null || journeyMeta?.school_id === undefined
            ? null
            : String(journeyMeta.school_id);
        const journeyDate = typeof journeyMeta?.date === 'string' ? journeyMeta.date : null;

        // 1. Clear All Prep Events (check-in, check, team_check, etc.)
        const { error: deleteError } = await supabase
            .from('staff_prep_events')
            .delete()
            .eq('journey_id', journeyId);

        if (deleteError) {
            console.error('Error clearing events:', deleteError);
            return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
        }

        // 2. Clear Prep Photos (evidence uploaded during demo)
        const { error: photoErr } = await supabase
            .from('staff_prep_photos')
            .delete()
            .eq('journey_id', journeyId);
        if (photoErr) console.warn('⚠️ Error clearing photos:', photoErr.message);

        // 3. Clear Staff Events (stage transitions, activity logs)
        const { error: staffEvErr } = await supabase
            .from('staff_events')
            .delete()
            .eq('journey_id', journeyId);
        if (staffEvErr) console.warn('⚠️ Error clearing staff_events:', staffEvErr.message);

        // 4. Clear Presence (so all roles show as "not checked in" on supervisor)
        const { error: presErr } = await supabase
            .from('staff_presence')
            .delete()
            .eq('journey_id', journeyId);
        if (presErr) console.warn('⚠️ Error clearing presence:', presErr.message);

        // 5. Clear Flight Logs tied directly to this journey
        const { error: flightErr } = await supabase
            .from('bitacora_vuelos')
            .delete()
            .eq('journey_id', journeyId);

        if (flightErr) {
            console.error('Error clearing flight logs:', flightErr);
            return NextResponse.json({ ok: false, error: flightErr.message }, { status: 500 });
        }

        // 5-bis. Clear orphan legacy flight rows (journey_id is null) for this same mission/day only.
        // This avoids touching historical data from older missions/schools.
        let removedLegacyFlights = 0;
        if (journeyMissionId && journeyDate) {
            const { data: orphanRows, error: orphanFetchError } = await supabase
                .from('bitacora_vuelos')
                .select('id, start_time, end_time, created_at')
                .eq('mission_id', journeyMissionId)
                .is('journey_id', null);

            if (orphanFetchError) {
                console.warn('⚠️ Could not fetch orphan legacy flights:', orphanFetchError.message);
            } else {
                const orphanIdsForThisDay = (orphanRows || [])
                    .filter((row) => {
                        const anchor = row?.end_time || row?.start_time || row?.created_at;
                        return toMexicoDate(anchor) === journeyDate;
                    })
                    .map((row) => row?.id)
                    .filter(Boolean);

                const batches = chunkArray(orphanIdsForThisDay, 200);
                for (const batchIds of batches) {
                    const { error: orphanDeleteError } = await supabase
                        .from('bitacora_vuelos')
                        .delete()
                        .in('id', batchIds);

                    if (orphanDeleteError) {
                        console.error('Error clearing orphan legacy flight logs:', orphanDeleteError);
                        return NextResponse.json({ ok: false, error: orphanDeleteError.message }, { status: 500 });
                    }

                    removedLegacyFlights += batchIds.length;
                }
            }
        }

        // 6. Reset Journey State (Global State Source of Truth)
        // We set a new updated_at to trigger realtime for everyone ONLY AFTER events are gone.
        const { error: updateError } = await supabase
            .from('staff_journeys')
            .update({
                mission_state: 'prep',
                status: 'prep',
                meta: {},
                arrival_photo_url: null,
                arrival_photo_taken_at: null,
                arrival_photo_taken_by: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', journeyId);

        if (updateError) {
            console.error('Error resetting journey:', updateError);
            return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
        }

        console.log('✅ GLOBAL RESET COMPLETE (events, photos, staff_events, presence, flights, journey)');

        return NextResponse.json({
            ok: true,
            message: 'Journey reset successfully (full cleanup)',
            removed_legacy_flights: removedLegacyFlights,
            reset_at: new Date().toISOString()
        });

    } catch (e) {
        console.error('API Error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
