import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// GET /api/admin/audio-quality
//
// Returns audio quality audit data for the supervisor
// dashboard. Supports filtering by date and journey.
//
// Query params:
//   ?date=2026-05-06       → audits for a specific date
//   ?journeyId=uuid        → audits for a specific journey
//   ?days=7                → audits for last N days (default: 1)
//
// SECURITY: Uses service role key (server-side only).
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

export async function GET(request) {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return NextResponse.json({ ok: false, error: 'Missing configuration.' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const journeyId = searchParams.get('journeyId');
        const days = Number(searchParams.get('days')) || 1;

        let query = supabase
            .from('audio_quality_audits')
            .select('*')
            // Remove the status filter so failed/analyzing audits are also returned to the UI
            // .eq('status', 'completed')
            .order('created_at', { ascending: false });

        if (journeyId) {
            query = query.eq('journey_id', journeyId);
        } else if (date) {
            // Filter by specific date (Mexico City timezone)
            query = query
                .gte('created_at', `${date}T00:00:00-06:00`)
                .lt('created_at', `${date}T23:59:59-06:00`);
        } else {
            // Default: last N days
            const since = new Date();
            since.setDate(since.getDate() - days);
            query = query.gte('created_at', since.toISOString());
        }

        const { data: audits, error } = await query.limit(100);

        if (error) {
            console.error('Audio quality query error:', error);
            return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }

        // ── Build summary metrics ──
        const completed = (audits || []).filter(a => a.score !== null);
        const totalAudited = completed.length;

        const avgScore = totalAudited > 0
            ? Math.round(completed.reduce((sum, a) => sum + a.score, 0) / totalAudited)
            : null;

        // Checklist compliance rates
        const countTrue = (field) => completed.filter(a => a[field] === true).length;
        const countFalse = (field) => completed.filter(a => a[field] === false).length;
        const rate = (field) => totalAudited > 0
            ? Math.round((countTrue(field) / totalAudited) * 100)
            : null;

        const checklist = {
            menciona_nombre_equipo: {
                passed: countTrue('menciona_nombre_equipo'),
                failed: countFalse('menciona_nombre_equipo'),
                rate: rate('menciona_nombre_equipo')
            },
            menciona_destino: {
                passed: countTrue('menciona_destino'),
                failed: countFalse('menciona_destino'),
                rate: rate('menciona_destino')
            },
            dinamica_sube_sube: {
                passed: countTrue('dinamica_sube_sube'),
                failed: countFalse('dinamica_sube_sube'),
                rate: rate('dinamica_sube_sube')
            },
            energia_positiva: {
                passed: countTrue('energia_positiva'),
                failed: countFalse('energia_positiva'),
                rate: rate('energia_positiva')
            },
            participacion_ninos_audible: {
                passed: countTrue('participacion_ninos_audible'),
                failed: countFalse('participacion_ninos_audible'),
                rate: rate('participacion_ninos_audible')
            }
        };

        // Energy distribution
        const energyDist = {
            alta: completed.filter(a => a.energia_interaccion === 'alta').length,
            media: completed.filter(a => a.energia_interaccion === 'media').length,
            baja: completed.filter(a => a.energia_interaccion === 'baja').length
        };

        // Alerts: audits with score < 50
        const alerts = completed
            .filter(a => a.score < 50)
            .map(a => ({
                id: a.id,
                score: a.score,
                flight_number: a.flight_number,
                nombre_equipo: a.nombre_equipo_detectado,
                resumen: a.resumen_supervisor,
                feedback: a.feedback_para_isa,
                created_at: a.created_at
            }));

        return NextResponse.json({
            ok: true,
            summary: {
                totalAudited,
                avgScore,
                checklist,
                energyDist,
                alertCount: alerts.length
            },
            alerts,
            audits: (audits || []).map(a => {
                // Backfill energia_positiva from raw_response for older audits
                let energiaPositiva = a.energia_positiva;
                if (energiaPositiva === null || energiaPositiva === undefined) {
                    try {
                        const raw = typeof a.raw_response === 'string' ? JSON.parse(a.raw_response) : a.raw_response;
                        energiaPositiva = raw?.analysis?.energia_positiva ?? null;
                    } catch { energiaPositiva = null; }
                }
                return {
                    id: a.id,
                    status: a.status,
                    error_message: a.error_message,
                    journey_id: a.journey_id,
                    flight_number: a.flight_number,
                    score: a.score,
                    menciona_nombre_equipo: a.menciona_nombre_equipo,
                    nombre_equipo_detectado: a.nombre_equipo_detectado,
                    menciona_destino: a.menciona_destino,
                    destino_detectado: a.destino_detectado,
                    dinamica_sube_sube: a.dinamica_sube_sube,
                    energia_positiva: energiaPositiva,
                    energia_interaccion: a.energia_interaccion,
                    participacion_ninos_audible: a.participacion_ninos_audible,
                    feedback_para_isa: a.feedback_para_isa,
                    resumen_supervisor: a.resumen_supervisor,
                    source: a.source,
                    created_at: a.created_at
                };
            })
        });

    } catch (error) {
        console.error('Audio quality API error:', error);
        return NextResponse.json(
            { ok: false, error: error?.message || 'Internal server error.' },
            { status: 500 }
        );
    }
}
