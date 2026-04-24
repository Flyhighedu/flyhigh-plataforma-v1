import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // We fetch all schools and their CRM details.
    // Also we will try to join whatsapp_conversations to see if there's an active chat.
    
    // We can do this in two steps or with a custom SQL function.
    // Two steps is easier for Supabase PostgREST without creating a new view.
    
    // Step 1: Fetch schools and crm details
    let query = supabase
      .from('catalogo_escuelas')
      .select(`
        cct,
        nombre_escuela,
        turno,
        tipo,
        ninos,
        estado_pipeline,
        crm_escuelas_detalles (
          notas,
          reminder_at,
          reminder_note,
          assigned_to,
          last_interaction_at
        )
      `);

    if (search) {
      query = query.or(`cct.ilike.%${search}%,nombre_escuela.ilike.%${search}%`);
    }

    const { data: schools, error: schoolsError } = await query;

    if (schoolsError) {
      console.error("[CRM GET] Error fetching schools:", schoolsError);
      return NextResponse.json({ error: schoolsError.message }, { status: 500 });
    }

    // Step 2: Fetch active whatsapp conversations that have a mapped cct
    const { data: activeChats, error: chatsError } = await supabase
      .from('whatsapp_conversations')
      .select('id, cct_identificado, phone_number, last_message_at')
      .not('cct_identificado', 'is', null);

    if (chatsError) {
      console.error("[CRM GET] Error fetching chats:", chatsError);
    }

    // Map the results
    const chatsByCCT = {};
    if (activeChats) {
      activeChats.forEach(chat => {
        // Only keep the most recent if multiple exist for some reason
        if (!chatsByCCT[chat.cct_identificado] || new Date(chat.last_message_at) > new Date(chatsByCCT[chat.cct_identificado].last_message_at)) {
           chatsByCCT[chat.cct_identificado] = chat;
        }
      });
    }

    const formattedData = schools.map(school => ({
      cct: school.cct,
      nombre_escuela: school.nombre_escuela,
      turno: school.turno,
      tipo: school.tipo,
      ninos: school.ninos,
      estado_pipeline: school.estado_pipeline || 'sin_contacto',
      notas: school.crm_escuelas_detalles?.notas || '',
      reminder_at: school.crm_escuelas_detalles?.reminder_at || null,
      reminder_note: school.crm_escuelas_detalles?.reminder_note || '',
      assigned_to: school.crm_escuelas_detalles?.assigned_to || null,
      last_interaction_at: school.crm_escuelas_detalles?.last_interaction_at || null,
      whatsapp_chat_id: chatsByCCT[school.cct]?.id || null,
      whatsapp_phone: chatsByCCT[school.cct]?.phone_number || null,
    }));

    return NextResponse.json({ data: formattedData });
  } catch (err) {
    console.error("[CRM GET] Catch error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { cct, estado_pipeline, notas, reminder_at, reminder_note, assigned_to } = body;

    if (!cct) {
      return NextResponse.json({ error: "cct is required" }, { status: 400 });
    }

    // 1. Update estado_pipeline in catalogo_escuelas (if provided)
    if (estado_pipeline !== undefined) {
      const { error: catError } = await supabase
        .from('catalogo_escuelas')
        .update({ estado_pipeline })
        .eq('cct', cct);

      if (catError) {
        console.error("[CRM PATCH] Error updating catalogo_escuelas:", catError);
        return NextResponse.json({ error: catError.message }, { status: 500 });
      }
    }

    // 2. Upsert details in crm_escuelas_detalles
    // Build object with defined properties only to avoid overwriting with nulls if not sent
    const detailsToUpdate = { cct };
    if (notas !== undefined) detailsToUpdate.notas = notas;
    if (reminder_at !== undefined) detailsToUpdate.reminder_at = reminder_at;
    if (reminder_note !== undefined) detailsToUpdate.reminder_note = reminder_note;
    if (assigned_to !== undefined) detailsToUpdate.assigned_to = assigned_to;
    
    // We always update last interaction
    detailsToUpdate.last_interaction_at = new Date().toISOString();
    detailsToUpdate.updated_at = new Date().toISOString();

    const { error: crmError } = await supabase
      .from('crm_escuelas_detalles')
      .upsert(detailsToUpdate, { onConflict: 'cct' });

    if (crmError) {
      console.error("[CRM PATCH] Error upserting crm_escuelas_detalles:", crmError);
      return NextResponse.json({ error: crmError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[CRM PATCH] Catch error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
