import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET() {
    try {
        const supabase = getAdminSupabase();

        // Get past due reminders
        const { data: contacts, error } = await supabase
            .from('crm_contacts')
            .select('id, phone_number, contact_name, cct, reminder_at, reminder_note')
            .not('reminder_at', 'is', null)
            .lte('reminder_at', new Date().toISOString());

        if (error) throw error;

        // Optionally, enrich with school names if needed
        const ccts = [...new Set((contacts || []).map(c => c.cct).filter(Boolean))];
        let schoolMap = {};
        if (ccts.length > 0) {
            const { data: schools } = await supabase
                .from('catalogo_escuelas')
                .select('cct, nombre_escuela')
                .in('cct', ccts);
            (schools || []).forEach(s => { schoolMap[s.cct] = s.nombre_escuela; });
        }

        const alarms = (contacts || []).map(c => ({
            ...c,
            school_name: schoolMap[c.cct] || 'Desconocida',
        }));

        return NextResponse.json({ data: alarms });
    } catch (err) {
        console.error('[API] crm-alarms GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
