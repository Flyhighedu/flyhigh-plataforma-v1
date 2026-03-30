import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service Role client — bypasses RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const { docId, status } = await request.json();

        if (!docId || !status) {
            return NextResponse.json({ error: 'Missing docId or status' }, { status: 400 });
        }

        if (!['validated', 'rejected', 'pending'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const updateData = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'validated') {
            updateData.validated_at = new Date().toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('hr_documents')
            .update(updateData)
            .eq('id', docId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error('HR validate doc error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
