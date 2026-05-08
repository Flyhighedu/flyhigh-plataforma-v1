import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Temporary migration endpoint — DELETE AFTER USE
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'public' } }
    );

    // Check if column already exists by querying
    const { data: testRow, error: testErr } = await supabase
        .from('audio_quality_audits')
        .select('energia_positiva')
        .limit(1);

    if (testErr && testErr.message.includes('energia_positiva')) {
        // Column doesn't exist — but we can't ALTER TABLE via Supabase JS client
        // We'll handle backfill in the API response instead
        return NextResponse.json({ ok: true, message: 'Column does not exist yet. Using backfill from raw_response.', needsMigration: true });
    }

    // Column exists — backfill null values from raw_response
    const { data: nullRows } = await supabase
        .from('audio_quality_audits')
        .select('id, raw_response')
        .is('energia_positiva', null)
        .not('raw_response', 'is', null)
        .limit(200);

    let updated = 0;
    if (nullRows && nullRows.length > 0) {
        for (const row of nullRows) {
            try {
                const raw = typeof row.raw_response === 'string' ? JSON.parse(row.raw_response) : row.raw_response;
                const val = raw?.analysis?.energia_positiva;
                if (val === true || val === false) {
                    await supabase.from('audio_quality_audits').update({ energia_positiva: val }).eq('id', row.id);
                    updated++;
                }
            } catch { /* skip */ }
        }
    }

    return NextResponse.json({ ok: true, message: `Backfill complete. Updated ${updated} rows.`, columnExists: !testErr });
}
