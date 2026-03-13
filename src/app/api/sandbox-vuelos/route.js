import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side Supabase client with Service Role Key — bypasses RLS
function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — fetch journeys (master) with nested vuelos count, or vuelos for a specific journey
export async function GET(request) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const journeyId = searchParams.get('journey_id');

        // Detail: fetch vuelos for a specific journey
        if (journeyId) {
            const { data, error } = await supabase
                .from('bitacora_vuelos')
                .select('id, mission_id, journey_id, student_count, duration_seconds, start_time, end_time, created_at')
                .eq('journey_id', journeyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        // Master: fetch all journeys with vuelo counts
        const { data: journeys, error: jError } = await supabase
            .from('staff_journeys')
            .select('id, date, school_name, status, tipo_escuela, costo_por_nino, created_at')
            .order('created_at', { ascending: false });

        if (jError) throw jError;

        // Get vuelo counts per journey in one query
        const { data: vueloCounts, error: vError } = await supabase
            .rpc('get_vuelo_counts_by_journey')
            .select('*');

        // If RPC doesn't exist, fallback to a manual count
        let countsMap = {};
        if (vError || !vueloCounts) {
            const { data: allVuelos } = await supabase
                .from('bitacora_vuelos')
                .select('journey_id');

            if (allVuelos) {
                for (const v of allVuelos) {
                    if (v.journey_id) {
                        countsMap[v.journey_id] = (countsMap[v.journey_id] || 0) + 1;
                    }
                }
            }
        } else {
            for (const row of vueloCounts) {
                countsMap[row.journey_id] = row.count;
            }
        }

        // Enrich journeys with vuelo_count
        const enriched = (journeys || []).map(j => ({
            ...j,
            vuelo_count: countsMap[j.id] || 0,
        }));

        return NextResponse.json({ data: enriched });
    } catch (err) {
        console.error('[API] sandbox-vuelos GET error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PATCH — update a single field on a single row (journeys OR vuelos)
export async function PATCH(request) {
    try {
        const { id, field, value, table } = await request.json();
        const targetTable = table || 'bitacora_vuelos';

        if (!id || !field) {
            return NextResponse.json(
                { error: 'id and field are required' },
                { status: 400 }
            );
        }

        // Allowlist of editable fields per table
        const editableFields = {
            bitacora_vuelos: ['mission_id', 'student_count', 'duration_seconds', 'start_time', 'end_time'],
            staff_journeys: ['date', 'school_name', 'tipo_escuela', 'costo_por_nino'],
        };

        const allowed = editableFields[targetTable];
        if (!allowed || !allowed.includes(field)) {
            return NextResponse.json(
                { error: `Field "${field}" is not editable on table "${targetTable}"` },
                { status: 403 }
            );
        }

        const supabase = getAdminSupabase();

        const { data, error } = await supabase
            .from(targetTable)
            .update({ [field]: value })
            .eq('id', id)
            .select();

        if (error) throw error;

        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-vuelos PATCH error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// DELETE — cascade delete: bitacora_vuelos children first, then staff_journeys parent
export async function DELETE(request) {
    try {
        const { journeyId } = await request.json();

        if (!journeyId) {
            return NextResponse.json(
                { error: 'journeyId is required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();

        // Step A: Delete all child vuelos for this journey
        const { error: vuelosError, count: deletedVuelos } = await supabase
            .from('bitacora_vuelos')
            .delete()
            .eq('journey_id', journeyId)
            .select('id', { count: 'exact', head: true });

        if (vuelosError) {
            throw new Error(`Error eliminando vuelos: ${vuelosError.message}`);
        }

        // Step B: Delete other child tables that reference this journey
        // staff_prep_events
        await supabase.from('staff_prep_events').delete().eq('journey_id', journeyId);
        // staff_prep_photos
        await supabase.from('staff_prep_photos').delete().eq('journey_id', journeyId);
        // staff_events
        await supabase.from('staff_events').delete().eq('journey_id', journeyId);
        // staff_presence (journey_id is nullable, just clear it)
        await supabase.from('staff_presence').update({ journey_id: null }).eq('journey_id', journeyId);

        // Step C: Delete the parent journey
        const { error: journeyError } = await supabase
            .from('staff_journeys')
            .delete()
            .eq('id', journeyId);

        if (journeyError) {
            throw new Error(`Error eliminando journey: ${journeyError.message}`);
        }

        return NextResponse.json({
            success: true,
            message: `Journey eliminado. Vuelos hijos limpiados.`,
        });
    } catch (err) {
        console.error('[API] sandbox-vuelos DELETE error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
