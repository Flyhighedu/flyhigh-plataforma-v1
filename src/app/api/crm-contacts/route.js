import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET: Fetch all CRM contacts with school name + last message preview
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        const { data: contacts, error } = await supabase
            .from('crm_contacts')
            .select('*')
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        // Enrich with school name from catalogo
        const ccts = [...new Set((contacts || []).map(c => c.cct).filter(Boolean))];
        let schoolMap = {};
        if (ccts.length > 0) {
            const { data: schools } = await supabase
                .from('catalogo_escuelas')
                .select('cct, nombre_escuela, turno')
                .in('cct', ccts);
            (schools || []).forEach(s => { schoolMap[s.cct] = s; });
        }

        // Enrich with last messages for card preview (last user msg + last bot msg)
        const phones = (contacts || []).map(c => c.phone_number).filter(Boolean);
        let msgPreviewMap = {};
        if (phones.length > 0) {
            // Get last 3 messages per phone for context
            const { data: recentMsgs } = await supabase
                .from('whatsapp_messages')
                .select('phone_number, content, sender_type, direction, created_at')
                .in('phone_number', phones)
                .order('created_at', { ascending: false })
                .limit(phones.length * 3);

            // Group by phone, pick last user msg and last bot msg
            for (const msg of (recentMsgs || [])) {
                if (!msgPreviewMap[msg.phone_number]) {
                    msgPreviewMap[msg.phone_number] = { lastUser: null, lastBot: null };
                }
                const entry = msgPreviewMap[msg.phone_number];
                if (msg.direction === 'inbound' && !entry.lastUser) {
                    entry.lastUser = msg.content;
                }
                if (msg.sender_type === 'bot' && !entry.lastBot) {
                    entry.lastBot = msg.content;
                }
            }
        }

        const enriched = (contacts || []).map(c => ({
            ...c,
            school_name: schoolMap[c.cct]?.nombre_escuela || null,
            school_turno: schoolMap[c.cct]?.turno || null,
            last_user_message: msgPreviewMap[c.phone_number]?.lastUser || null,
            last_bot_message: msgPreviewMap[c.phone_number]?.lastBot || null,
        }));

        return NextResponse.json({ data: enriched });
    } catch (err) {
        console.error('[API] crm-contacts GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH: Update a contact (pipeline_stage, bot_paused, notes, etc.)
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const allowed = ['pipeline_stage', 'bot_paused', 'notes', 'assigned_to', 'cct', 'contact_name', 'lead_status', 'reminder_at', 'reminder_note'];
        const filtered = {};
        for (const key of Object.keys(updates)) {
            if (allowed.includes(key)) filtered[key] = updates[key];
        }

        if (Object.keys(filtered).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        filtered.updated_at = new Date().toISOString();

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('crm_contacts')
            .update(filtered)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[API] crm-contacts PATCH error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: Create a new contact manually
export async function POST(request) {
    try {
        const body = await request.json();
        const { phone_number, contact_name, cct, pipeline_stage, notes } = body;

        if (!phone_number) {
            return NextResponse.json({ error: 'phone_number is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('crm_contacts')
            .upsert({
                phone_number,
                contact_name: contact_name || null,
                cct: cct || null,
                pipeline_stage: pipeline_stage || '1_explorando',
                notes: notes || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'phone_number' })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err) {
        console.error('[API] crm-contacts POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
