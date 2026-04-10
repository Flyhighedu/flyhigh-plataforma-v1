import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Using service role key for admin route
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { data, error } = await supabaseAdmin
      .from("precios_cuotas")
      .select("*")
      .order("precio", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[CRM-Precios] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { tipo_escuela, precio } = body;

    if (!tipo_escuela || !precio) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("precios_cuotas")
      .insert({ tipo_escuela, precio: Number(precio) })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[CRM-Precios] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("precios_cuotas")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[CRM-Precios] DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
