import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function toIsoTime(value) {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
}

function toNonNegativeInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 0) return null;
    return Math.floor(parsed);
}

function scoreCandidate(row, context) {
    const startMs = Date.parse(row?.start_time || '');
    const endMs = Date.parse(row?.end_time || '');
    const prevStudents = Number(row?.student_count ?? 0);

    let score = 0;
    if (Number.isFinite(startMs) && Number.isFinite(context.startMs)) {
        score += Math.abs(startMs - context.startMs);
    }
    if (Number.isFinite(endMs) && Number.isFinite(context.endMs)) {
        score += Math.abs(endMs - context.endMs);
    }
    if (Number.isFinite(prevStudents) && Number.isFinite(context.previousStudentCount)) {
        score += Math.abs(prevStudents - context.previousStudentCount) * 1000;
    }

    return score;
}

function pickBestCandidate(rows, context) {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const sorted = [...rows].sort((a, b) => scoreCandidate(a, context) - scoreCandidate(b, context));
    return sorted[0] || null;
}

export async function POST(request) {
    try {
        const body = await request.json();

        const journeyId = body?.journeyId ? String(body.journeyId) : null;
        const missionId = body?.missionId ? String(body.missionId) : null;
        const cloudRowId = body?.cloudRowId ? String(body.cloudRowId) : null;
        const actorUserId = body?.actorUserId ? String(body.actorUserId) : null;
        const actorName = body?.actorName ? String(body.actorName) : null;
        const actorRole = body?.actorRole ? String(body.actorRole) : null;
        const localFlightId = body?.localFlightId ? String(body.localFlightId) : null;

        const startTimeIso = toIsoTime(body?.startTime);
        const endTimeIso = toIsoTime(body?.endTime);
        const previousStudentCount = toNonNegativeInt(body?.previousStudentCount);
        const newStudentCount = toNonNegativeInt(body?.newStudentCount);
        const reason = String(body?.reason || '').trim();

        if (!journeyId && !missionId && !cloudRowId) {
            return NextResponse.json({ ok: false, error: 'Missing identifiers for target flight.' }, { status: 400 });
        }

        if (!startTimeIso || !endTimeIso) {
            return NextResponse.json({ ok: false, error: 'Invalid flight start/end time.' }, { status: 400 });
        }

        if (!Number.isFinite(newStudentCount)) {
            return NextResponse.json({ ok: false, error: 'Invalid student count.' }, { status: 400 });
        }

        if (!Number.isFinite(previousStudentCount)) {
            return NextResponse.json({ ok: false, error: 'Invalid previous student count.' }, { status: 400 });
        }

        if (reason.length < 6) {
            return NextResponse.json({ ok: false, error: 'Reason is required (min 6 chars).' }, { status: 400 });
        }

        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ ok: false, error: 'Server configuration error.' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        let targetFlightRow = null;

        if (cloudRowId) {
            const { data, error } = await supabaseAdmin
                .from('bitacora_vuelos')
                .select('id, mission_id, journey_id, student_count, start_time, end_time, created_at')
                .eq('id', cloudRowId)
                .single();

            if (error) {
                console.warn('Cloud row id lookup failed, falling back to signature lookup:', error.message);
            } else {
                targetFlightRow = data || null;
            }
        }

        if (!targetFlightRow) {
            let signatureQuery = supabaseAdmin
                .from('bitacora_vuelos')
                .select('id, mission_id, journey_id, student_count, start_time, end_time, created_at')
                .eq('start_time', startTimeIso)
                .eq('end_time', endTimeIso)
                .order('created_at', { ascending: false })
                .limit(8);

            if (journeyId) {
                signatureQuery = signatureQuery.eq('journey_id', journeyId);
            } else if (missionId) {
                signatureQuery = signatureQuery.eq('mission_id', missionId);
            }

            const { data: exactMatches, error: exactError } = await signatureQuery;
            if (exactError) {
                return NextResponse.json({ ok: false, error: exactError.message }, { status: 500 });
            }

            if (Array.isArray(exactMatches) && exactMatches.length > 0) {
                targetFlightRow = pickBestCandidate(exactMatches, {
                    startMs: Date.parse(startTimeIso),
                    endMs: Date.parse(endTimeIso),
                    previousStudentCount
                });
            }
        }

        if (!targetFlightRow) {
            const startMs = Date.parse(startTimeIso);
            const endMs = Date.parse(endTimeIso);

            let tolerantQuery = supabaseAdmin
                .from('bitacora_vuelos')
                .select('id, mission_id, journey_id, student_count, start_time, end_time, created_at')
                .gte('start_time', new Date(startMs - 1500).toISOString())
                .lte('start_time', new Date(startMs + 1500).toISOString())
                .gte('end_time', new Date(endMs - 1500).toISOString())
                .lte('end_time', new Date(endMs + 1500).toISOString())
                .order('created_at', { ascending: false })
                .limit(12);

            if (journeyId) {
                tolerantQuery = tolerantQuery.eq('journey_id', journeyId);
            } else if (missionId) {
                tolerantQuery = tolerantQuery.eq('mission_id', missionId);
            }

            const { data: tolerantMatches, error: tolerantError } = await tolerantQuery;
            if (tolerantError) {
                return NextResponse.json({ ok: false, error: tolerantError.message }, { status: 500 });
            }

            targetFlightRow = pickBestCandidate(tolerantMatches, {
                startMs,
                endMs,
                previousStudentCount
            });
        }

        if (!targetFlightRow?.id) {
            return NextResponse.json({ ok: false, error: 'Flight row not found for edit.' }, { status: 404 });
        }

        const editedAt = new Date().toISOString();
        const { data: updatedFlightRows, error: updateError } = await supabaseAdmin
            .from('bitacora_vuelos')
            .update({ student_count: newStudentCount })
            .eq('id', targetFlightRow.id)
            .select('id, mission_id, journey_id, student_count, start_time, end_time, created_at')
            .limit(1);

        if (updateError) {
            return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
        }

        const updatedFlight = Array.isArray(updatedFlightRows) && updatedFlightRows.length > 0
            ? updatedFlightRows[0]
            : null;

        if (journeyId && actorUserId) {
            const { error: auditError } = await supabaseAdmin
                .from('staff_events')
                .insert({
                    journey_id: journeyId,
                    type: 'FLIGHT_STUDENT_COUNT_EDITED',
                    actor_user_id: actorUserId,
                    payload: {
                        flight_row_id: targetFlightRow.id,
                        local_flight_id: localFlightId,
                        mission_id: targetFlightRow.mission_id || missionId || null,
                        previous_student_count: previousStudentCount,
                        new_student_count: newStudentCount,
                        reason,
                        edited_at: editedAt,
                        actor_name: actorName,
                        actor_role: actorRole,
                        start_time: startTimeIso,
                        end_time: endTimeIso
                    }
                });

            if (auditError) {
                console.warn('Could not write flight edit audit event:', auditError.message);
            }
        }

        return NextResponse.json({
            ok: true,
            edited_at: editedAt,
            flight: updatedFlight,
            previous_student_count: previousStudentCount,
            new_student_count: newStudentCount
        });
    } catch (error) {
        console.error('Error editing flight student count:', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal server error.' }, { status: 500 });
    }
}
