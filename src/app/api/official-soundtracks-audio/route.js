import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Public endpoint — no auth required (used by PWA to fetch active soundtracks)
export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase
            .from('official_soundtracks')
            .select('id, title, artist, track_type, public_url, duration_seconds')
            .eq('is_active', true)
            .order('track_type', { ascending: true })
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Soundtracks fetch error:', error);
            return NextResponse.json({ soundtracks: [] });
        }

        // Group by type for easier consumption
        const boarding = (data || []).filter(t => t.track_type === 'boarding');
        const inFlight = (data || []).filter(t => t.track_type === 'in_flight');

        return NextResponse.json({
            soundtracks: data || [],
            boarding,
            inFlight
        });
    } catch (err) {
        console.error('Soundtracks API error:', err);
        return NextResponse.json({ soundtracks: [], boarding: [], inFlight: [] });
    }
}
