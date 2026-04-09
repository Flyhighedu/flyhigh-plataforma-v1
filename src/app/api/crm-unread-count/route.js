import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = getAdminSupabase();

        // Fetch all contacts with recent activity
        const { data: contacts, error } = await supabase
            .from('crm_contacts')
            .select('id, phone_number, pipeline_stage, bot_paused, last_message_at')
            .not('last_message_at', 'is', null);

        if (error) throw error;
        if (!contacts || contacts.length === 0) {
            return NextResponse.json({ unreadCount: 0 });
        }

        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        let unreadCount = 0;
        for (const c of contacts) {
            let requiresAttention = false;

            // Rule 1: Bot is paused — human operator MUST respond
            if (c.bot_paused) {
                requiresAttention = true;
            }
            // Rule 2: Lead is brand new / exploring
            else if (c.pipeline_stage === '1_nuevo' || c.pipeline_stage === '1_explorando') {
                requiresAttention = true;
            }
            // Rule 3: Any contact with activity in the last 24 hours
            // This ensures the operator knows about active conversations
            // even when the bot auto-replies instantly
            else if (c.last_message_at) {
                const msSinceMsg = now - new Date(c.last_message_at).getTime();
                if (msSinceMsg <= TWENTY_FOUR_HOURS) {
                    requiresAttention = true;
                }
            }

            if (requiresAttention) unreadCount++;
        }

        return NextResponse.json({ unreadCount });
    } catch (err) {
        console.error('[API] crm-unread-count GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
