import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
    try {
        const { data, error } = await supabaseService
            .from('staff_prep_events')
            .select(`
                id, user_id, journey_id, event_type, payload, created_at,
                staff_journeys:journey_id(school_name, meta)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Fetch roles from staff_presence to supply 'user_role' directly
        const userIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))];
        let presences = [];
        if (userIds.length > 0) {
            const { data: pData } = await supabaseService
                .from('staff_presence')
                .select('user_id, role')
                .in('user_id', userIds);
            if (pData) presences = pData;
        }

        const enrichedData = (data || []).map(ev => {
            const presence = presences.find(p => p.user_id === ev.user_id);
            return {
                ...ev,
                user_role: presence ? presence.role : null
            };
        });

        return NextResponse.json({ data: enrichedData });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req) {
    try {
        const body = await req.json();
        const { id, field, value } = body;

        if (!id || !field) {
            return NextResponse.json({ error: 'Faltan parámetros de actualización (id, field)' }, { status: 400 });
        }

        if (id && typeof id === 'string' && id.startsWith('checkout_')) {
            const parts = id.split('_');
            const journeyId = parts[1];
            const role = parts[2];
             
            const { data: journey, error: fetchErr } = await supabaseService
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();
                 
            if (fetchErr) throw fetchErr;
             
            const meta = journey.meta || {};
            const key = `closure_checkout_${role}_done_at`;

            // If value is null or empty, delete the key
            if (!value) {
                delete meta[key];
            } else {
                meta[key] = value;
            }

            const { error: updErr } = await supabaseService
                .from('staff_journeys')
                .update({ meta })
                .eq('id', journeyId);
                 
            if (updErr) throw updErr;
            return NextResponse.json({ message: 'Salida actualizada exitosamente.' });
        }

        const { error } = await supabaseService
            .from('staff_prep_events')
            .update({ [field]: value })
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ message: 'Evento actualizado correctamente.' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
