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
// Also supports ?schools=1 to return the school catalog for ghost row
export async function GET(request) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const journeyId = searchParams.get('journey_id');
        const schoolsCatalog = searchParams.get('schools');

        // School catalog for ghost row select
        if (schoolsCatalog) {
            const { data, error } = await supabase
                .from('proximas_escuelas')
                .select('id, nombre_escuela, colonia')
                .order('nombre_escuela', { ascending: true });

            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

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

        // Master: fetch journeys with resolved school names + vuelo counts
        const { data: rawJourneys, error: rawError } = await supabase
            .from('staff_journeys')
            .select('id, date, school_name, school_id, status, tipo_escuela, costo_por_nino, created_at')
            .order('created_at', { ascending: false });

        if (rawError) throw rawError;

        // Fetch the school catalog for name resolution
        const { data: schools } = await supabase
            .from('proximas_escuelas')
            .select('id, nombre_escuela, colonia');

        const schoolMap = {};
        if (schools) {
            for (const s of schools) {
                schoolMap[s.id] = s;
            }
        }

        // Get vuelo counts per journey
        let countsMap = {};
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

        // Get totals from cierres_mision (total_students, total_flights)
        const { data: cierres } = await supabase
            .from('cierres_mision')
            .select('journey_id, total_students, total_flights');

        const cierreMap = {};
        if (cierres) {
            for (const c of cierres) {
                if (c.journey_id) {
                    cierreMap[c.journey_id] = c;
                }
            }
        }

        // Enrich journeys: resolve school_name via COALESCE logic + add vuelo_count
        const enriched = (rawJourneys || []).map(j => {
            const school = schoolMap[j.school_id];
            const cierre = cierreMap[j.id];
            // Fallback: show cierre totals if available, otherwise sum from bitacora
            return {
                ...j,
                school_name: j.school_name || (school?.nombre_escuela) || null,
                colonia: school?.colonia || null,
                vuelo_count: countsMap[j.id] || 0,
                total_students: cierre?.total_students || 0,
                total_flights: cierre?.total_flights || 0,
            };
        });

        return NextResponse.json({ data: enriched });
    } catch (err) {
        console.error('[API] sandbox-vuelos GET error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// PATCH — update a single field on a single row
// For total_students / total_flights: UPSERT into cierres_mision + set status=closed
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

        const supabase = getAdminSupabase();

        // Special path: Niños/Vuelos → UPSERT cierres_mision + seal journey
        if (targetTable === 'staff_journeys' && (field === 'total_students' || field === 'total_flights')) {
            const numValue = parseInt(value) || 0;

            // Get journey data for cierre fields
            const { data: journey, error: jErr } = await supabase
                .from('staff_journeys')
                .select('id, school_id, school_name, date')
                .eq('id', id)
                .single();

            if (jErr) throw jErr;

            // Resolve school name
            let schoolName = journey.school_name;
            if (!schoolName && journey.school_id) {
                const { data: school } = await supabase
                    .from('proximas_escuelas')
                    .select('nombre_escuela')
                    .eq('id', journey.school_id)
                    .single();
                schoolName = school?.nombre_escuela || null;
            }

            // Check if cierre already exists
            const { data: existing } = await supabase
                .from('cierres_mision')
                .select('id')
                .eq('journey_id', id)
                .maybeSingle();

            if (existing) {
                // UPDATE existing cierre
                const { error: upErr } = await supabase
                    .from('cierres_mision')
                    .update({ [field]: numValue })
                    .eq('journey_id', id);
                if (upErr) throw upErr;
            } else {
                // INSERT new cierre
                const { error: insErr } = await supabase
                    .from('cierres_mision')
                    .insert({
                        journey_id: id,
                        mission_id: journey.school_id ? String(journey.school_id) : null,
                        school_name_snapshot: schoolName,
                        school_id: journey.school_id,
                        [field]: numValue,
                        // Set the other field to 0 so they don't start null
                        ...(field === 'total_students' ? { total_flights: 0 } : { total_students: 0 }),
                        checklist_verified: false,
                        end_time: new Date().toISOString(),
                    });
                if (insErr) throw insErr;
            }

            // Seal journey status to 'closed'
            await supabase
                .from('staff_journeys')
                .update({ status: 'closed' })
                .eq('id', id);

            return NextResponse.json({ data: { id, [field]: numValue, status: 'closed' } });
        }

        // Standard path: update a field on the target table
        const editableFields = {
            bitacora_vuelos: ['mission_id', 'student_count', 'duration_seconds', 'start_time', 'end_time'],
            staff_journeys: ['date', 'school_name', 'tipo_escuela', 'costo_por_nino', 'status'],
        };

        const allowed = editableFields[targetTable];
        if (!allowed || !allowed.includes(field)) {
            return NextResponse.json(
                { error: `Field "${field}" is not editable on table "${targetTable}"` },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from(targetTable)
            .update({ [field]: value })
            .eq('id', id)
            .select();

        if (error) throw error;

        // Sync school_name → cierres_mision.school_name_snapshot
        if (targetTable === 'staff_journeys' && field === 'school_name' && value) {
            const { error: syncErr } = await supabase
                .from('cierres_mision')
                .update({ school_name_snapshot: value })
                .eq('journey_id', id);
            if (syncErr) {
                console.warn('[API] school_name_snapshot sync failed (non-blocking):', syncErr);
            }
        }

        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-vuelos PATCH error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// POST — Ghost Row: auto-create school in catalog + double INSERT (staff_journeys + cierres_mision)
export async function POST(request) {
    try {
        const { school_name, date, total_students, total_flights, tipo_escuela, costo_por_nino } = await request.json();

        if (!school_name?.trim() || !date) {
            return NextResponse.json(
                { error: 'school_name and date are required' },
                { status: 400 }
            );
        }

        const supabase = getAdminSupabase();
        const trimmedName = school_name.trim();

        // Auto-catalog: check if school already exists in proximas_escuelas
        const { data: existing } = await supabase
            .from('proximas_escuelas')
            .select('id, nombre_escuela')
            .ilike('nombre_escuela', trimmedName)
            .limit(1)
            .maybeSingle();

        let schoolId = existing?.id || null;

        // If not found, create it in the catalog
        if (!existing) {
            const { data: newSchool, error: schoolErr } = await supabase
                .from('proximas_escuelas')
                .insert({
                    nombre_escuela: trimmedName,
                    colonia: '',
                    fecha_programada: date,
                    estatus: 'completado',
                })
                .select('id')
                .single();

            if (schoolErr) throw schoolErr;
            schoolId = newSchool.id;
        }

        // Step 1: INSERT into staff_journeys
        const { data: newJourney, error: jErr } = await supabase
            .from('staff_journeys')
            .insert({
                date,
                school_id: schoolId,
                school_name: trimmedName,
                status: 'closed',
                tipo_escuela: tipo_escuela || null,
                costo_por_nino: costo_por_nino ? Number(costo_por_nino) : null,
            })
            .select()
            .single();

        if (jErr) throw jErr;

        // Step 2: INSERT into cierres_mision
        const { error: cErr } = await supabase
            .from('cierres_mision')
            .insert({
                journey_id: newJourney.id,
                mission_id: schoolId ? String(schoolId) : null,
                school_name_snapshot: trimmedName,
                school_id: schoolId,
                total_students: parseInt(total_students) || 0,
                total_flights: parseInt(total_flights) || 0,
                checklist_verified: false,
                end_time: new Date().toISOString(),
            });

        if (cErr) throw cErr;

        return NextResponse.json({
            data: {
                ...newJourney,
                school_name: trimmedName,
                total_students: parseInt(total_students) || 0,
                total_flights: parseInt(total_flights) || 0,
                vuelo_count: 0,
            },
        });
    } catch (err) {
        console.error('[API] sandbox-vuelos POST error:', err);
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
        const { error: vuelosError } = await supabase
            .from('bitacora_vuelos')
            .delete()
            .eq('journey_id', journeyId);

        if (vuelosError) {
            throw new Error(`Error eliminando vuelos: ${vuelosError.message}`);
        }

        // Step B: Delete cierres_mision for this journey
        await supabase.from('cierres_mision').delete().eq('journey_id', journeyId);

        // Step C: Delete other child tables that reference this journey
        await supabase.from('staff_prep_events').delete().eq('journey_id', journeyId);
        await supabase.from('staff_prep_photos').delete().eq('journey_id', journeyId);
        await supabase.from('staff_events').delete().eq('journey_id', journeyId);
        await supabase.from('staff_presence').update({ journey_id: null }).eq('journey_id', journeyId);

        // Step D: Delete the parent journey
        const { error: journeyError } = await supabase
            .from('staff_journeys')
            .delete()
            .eq('id', journeyId);

        if (journeyError) {
            throw new Error(`Error eliminando journey: ${journeyError.message}`);
        }

        return NextResponse.json({
            success: true,
            message: `Journey eliminado. Vuelos y cierre limpiados.`,
        });
    } catch (err) {
        console.error('[API] sandbox-vuelos DELETE error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
