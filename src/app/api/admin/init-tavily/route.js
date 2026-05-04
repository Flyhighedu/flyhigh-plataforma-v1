import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══ Admin endpoint: Create tavily_usage table ═══
// Call once: GET /api/admin/init-tavily
// Safe to call multiple times (uses upsert)

export async function GET(request) {
    const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const currentMonth = new Date().toISOString().slice(0, 7);

    // First try to read — if table exists, just verify the row
    const { data, error } = await sb.from('tavily_usage').select('*').eq('id', 1).maybeSingle();

    if (error && error.message.includes('does not exist')) {
        // Table doesn't exist — need to create it via SQL editor
        return NextResponse.json({
            status: 'needs_migration',
            message: 'Table tavily_usage does not exist. Please run this SQL in Supabase Dashboard > SQL Editor:',
            sql: [
                "CREATE TABLE IF NOT EXISTS public.tavily_usage (",
                "    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),",
                "    month_key TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),",
                "    usage_count INTEGER NOT NULL DEFAULT 0,",
                "    monthly_limit INTEGER NOT NULL DEFAULT 1000,",
                "    last_used_at TIMESTAMPTZ DEFAULT now(),",
                "    updated_at TIMESTAMPTZ DEFAULT now()",
                ");",
                "",
                "INSERT INTO public.tavily_usage (id, month_key, usage_count)",
                "VALUES (1, to_char(now(), 'YYYY-MM'), 0)",
                "ON CONFLICT (id) DO NOTHING;",
                "",
                "ALTER TABLE public.tavily_usage ENABLE ROW LEVEL SECURITY;",
                "",
                "CREATE POLICY \"tavily_usage_read_all\" ON public.tavily_usage FOR SELECT USING (true);",
                "CREATE POLICY \"tavily_usage_service_only\" ON public.tavily_usage FOR ALL USING (auth.role() = 'service_role');"
            ].join('\n')
        });
    }

    if (data) {
        return NextResponse.json({ 
            status: 'ok', 
            message: 'Table exists and has data',
            data 
        });
    }

    // Table exists but no row — insert one
    const { data: inserted, error: insertErr } = await sb.from('tavily_usage').upsert({
        id: 1,
        month_key: currentMonth,
        usage_count: 0,
        monthly_limit: 1000,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    return NextResponse.json({
        status: insertErr ? 'error' : 'initialized',
        data: inserted,
        error: insertErr?.message
    });
}
