import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// GET /api/cron/retry-audio-audits
//
// Background Job to retry failed Gemini AI audio audits.
// Runs every ~15 mins (via Vercel Cron or webhook).
//
// ONLY processes audits that failed due to temporary
// errors (status='failed') from the last 24 hours.
// =====================================================

export const runtime = 'nodejs';
export const maxDuration = 300; // Allow 5 minutes since we process multiple sequentially

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
    // Security check (Cron secret from Vercel or manual auth)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return NextResponse.json({ error: 'Missing DB config' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        // Fetch up to 5 failed audits from the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: failedAudits, error } = await supabase
            .from('audio_quality_audits')
            .select('id, audio_url, journey_id, flight_number, source, user_id, audio_duration_seconds')
            .eq('status', 'failed')
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!failedAudits || failedAudits.length === 0) {
            return NextResponse.json({ ok: true, message: 'No failed audits to retry.' });
        }

        const results = [];

        // Determine the base URL to call our own endpoint
        // Useful for Vercel environments
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        // Fallback to localhost if host is missing during local dev
        const baseUrl = host ? `${protocol}://${host}` : 'http://localhost:3000';

        for (const audit of failedAudits) {
            console.log(`[Cron] Retrying audit ${audit.id} (Flight ${audit.flight_number})...`);
            
            try {
                // Call the existing analyze-audio logic passing the specific auditId
                const response = await fetch(`${baseUrl}/api/staff/analyze-audio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        auditId: audit.id,
                        audioUrl: audit.audio_url,
                        journeyId: audit.journey_id,
                        flightNumber: audit.flight_number,
                        source: audit.source,
                        userId: audit.user_id,
                        durationSeconds: audit.audio_duration_seconds
                    })
                });

                const data = await response.json();
                results.push({ auditId: audit.id, flightNumber: audit.flight_number, ok: data.ok, error: data.error || null });
            } catch (err) {
                console.error(`[Cron] Error retrying audit ${audit.id}:`, err);
                results.push({ auditId: audit.id, flightNumber: audit.flight_number, ok: false, error: err.message });
            }
        }

        return NextResponse.json({
            ok: true,
            retried: failedAudits.length,
            results
        });

    } catch (err) {
        console.error('❌ [Cron] retry-audio-audits error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
