import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import axios from 'axios';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET: Fetch message history for a phone number
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const phone = url.searchParams.get('phone');

        if (!phone) {
            return NextResponse.json({ error: 'phone query param is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone_number', phone)
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (err) {
        console.error('[API] crm-messages GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: Send a human message via Meta Cloud API + persist to DB
export async function POST(request) {
    try {
        const { phone_number, content, conversation_id } = await request.json();

        if (!phone_number || !content) {
            return NextResponse.json({ error: 'phone_number and content are required' }, { status: 400 });
        }

        const META_TOKEN = process.env.META_ACCESS_TOKEN;
        const PHONE_ID = process.env.META_PHONE_NUMBER_ID;

        if (!META_TOKEN || !PHONE_ID) {
            return NextResponse.json({ error: 'Meta credentials not configured on this project' }, { status: 503 });
        }

        // 1. Send via Meta Cloud API
        const metaPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone_number,
            type: 'text',
            text: { preview_url: false, body: content },
        };

        try {
            await axios.post(
                `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
                metaPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${META_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        } catch (metaErr) {
            console.error('[API] Meta send error:', metaErr.response?.data || metaErr.message);
            return NextResponse.json(
                { error: 'Error enviando via WhatsApp: ' + (metaErr.response?.data?.error?.message || metaErr.message) },
                { status: 502 }
            );
        }

        // 2. Persist to whatsapp_messages
        const supabase = getAdminSupabase();

        // Resolve conversation_id if not provided
        let convId = conversation_id;
        if (!convId) {
            const { data: conv } = await supabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('phone_number', phone_number)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            convId = conv?.id || null;
        }

        const { data: msg, error: msgErr } = await supabase
            .from('whatsapp_messages')
            .insert({
                conversation_id: convId,
                phone_number,
                direction: 'outbound',
                sender_type: 'human',
                message_type: 'text',
                content,
                metadata: {},
            })
            .select()
            .single();

        if (msgErr) {
            console.error('[API] Message persist error:', msgErr);
            // Message was sent but not persisted — not fatal
        }

        // 3. Update contact last_message_at
        await supabase
            .from('crm_contacts')
            .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('phone_number', phone_number);

        return NextResponse.json({ data: msg, sent: true });
    } catch (err) {
        console.error('[API] crm-messages POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
