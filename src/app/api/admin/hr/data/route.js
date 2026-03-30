import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Fetch docs
        const { data: docs } = await supabaseAdmin
            .from('hr_documents')
            .select('*')
            .order('created_at', { ascending: false });

        // Last 30 days window
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isoDate = thirtyDaysAgo.toISOString();

        // Fetch events
        const { data: events } = await supabaseAdmin
            .from('staff_prep_events')
            .select('user_id, event_type, created_at, payload')
            .gte('created_at', isoDate)
            .order('created_at', { ascending: true });

        // Fetch cierres
        const { data: closures } = await supabaseAdmin
            .from('cierres_mision')
            .select('*')
            .gte('created_at', isoDate);

        return NextResponse.json({ 
            docs: docs || [], 
            events: events || [], 
            closures: closures || []
        });

    } catch (error) {
        console.error('Error fetching HR data:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
