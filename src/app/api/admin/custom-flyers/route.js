import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicializar cliente Supabase con Service Role Key para evadir RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('admin_custom_flyers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("GET /api/admin/custom-flyers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'save') {
      const { flyer, config } = payload;
      const dbPayload = {
        id: flyer.id,
        source_id: flyer.sourceId,
        html_content: flyer.html,
        config: config || {}
      };
      
      const { error } = await supabase
        .from('admin_custom_flyers')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) throw error;
      return NextResponse.json({ success: true });

    } else if (action === 'updateConfig') {
      const { id, config } = payload;
      const { error } = await supabase
        .from('admin_custom_flyers')
        .update({ config: config })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });

  } catch (error) {
    console.error("POST /api/admin/custom-flyers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: "Falta el ID" }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabase
      .from('admin_custom_flyers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/custom-flyers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
