import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

const editableFields = [
    'nombre', 'email', 'password', 'aportacion_total'
];

export async function GET() {
    try {
        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('patrocinadores')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ data: data || [] });
    } catch (err) {
        console.error('[API] sandbox-patrocinadores GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const { id, field, value } = await request.json();

        if (!id || !field) {
            return NextResponse.json({ error: 'id and field are required' }, { status: 400 });
        }

        if (!editableFields.includes(field)) {
            return NextResponse.json({ error: `Field "${field}" is not editable` }, { status: 403 });
        }

        const supabase = getAdminSupabase();
        
        let castValue = value;
        if (field === 'aportacion_total') {
            castValue = value === '' || value === null ? 0 : parseFloat(value);
            if (castValue !== null && isNaN(castValue)) {
                return NextResponse.json({ error: 'Valor numérico inválido' }, { status: 400 });
            }
        }

        const { data, error } = await supabase
            .from('patrocinadores')
            .update({ [field]: castValue })
            .eq('id', id)
            .select();

        if (error) throw error;
        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-patrocinadores PATCH error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const payload = await request.json();
        
        // Ensure aportacion_total is mapped if they pass another name, or keep it 0 if omitted
        const payloadToInsert = { ...payload };
        
        // Remove id if passed accidentally
        delete payloadToInsert.id;
        
        if (!payloadToInsert.aportacion_total && payloadToInsert.aportacion_total !== 0) {
            payloadToInsert.aportacion_total = 0;
        }

        const supabase = getAdminSupabase();
        const { data, error } = await supabase
            .from('patrocinadores')
            .insert(payloadToInsert)
            .select();

        if (error) throw error;
        return NextResponse.json({ data: data?.[0] || null });
    } catch (err) {
        console.error('[API] sandbox-patrocinadores POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const { error } = await supabase
            .from('patrocinadores')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[API] sandbox-patrocinadores DELETE error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
