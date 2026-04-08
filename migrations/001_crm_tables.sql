-- ============================================================
-- MIGRACIÓN 001: CRM WhatsApp Bidireccional
-- Ejecutar en Supabase Dashboard → SQL Editor
-- Fecha: 2026-04-07
-- ============================================================

-- ─── 1. PIPELINE STAGES (Embudo Kanban) ────────────────────
CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6366f1',
    icon        TEXT DEFAULT '📌',
    sort_order  INT NOT NULL,
    is_terminal BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.crm_pipeline_stages (id, label, color, icon, sort_order, is_terminal) VALUES
    ('primer_contacto',  'Primer Contacto',  '#3b82f6', '📩', 1, false),
    ('cct_validado',     'CCT Validado',     '#8b5cf6', '✅', 2, false),
    ('pausa_dudas',      'Pausa / Dudas',    '#f59e0b', '⏸️', 3, false),
    ('agendado',         'Agendado',         '#22c55e', '🎯', 4, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pipeline_stages" ON public.crm_pipeline_stages
    FOR SELECT USING (true);
CREATE POLICY "Service write pipeline_stages" ON public.crm_pipeline_stages
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 2. CRM CONTACTS (Tarjetas del Kanban) ────────────────
CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number    TEXT NOT NULL UNIQUE,
    contact_name    TEXT,
    cct             TEXT,
    pipeline_stage  TEXT NOT NULL DEFAULT 'primer_contacto'
                    REFERENCES public.crm_pipeline_stages(id),
    bot_paused      BOOLEAN NOT NULL DEFAULT false,
    assigned_to     TEXT,
    notes           TEXT,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_pipeline ON public.crm_contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.crm_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_bot_paused ON public.crm_contacts(bot_paused) WHERE bot_paused = true;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access crm_contacts" ON public.crm_contacts
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 3. WHATSAPP MESSAGES (Historial del Inbox) ───────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    phone_number    TEXT NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type     TEXT NOT NULL CHECK (sender_type IN ('user', 'bot', 'human')),
    message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'button', 'list', 'media', 'template')),
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    wa_message_id   TEXT,
    status          TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    created_at      TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_wa_message UNIQUE (wa_message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.whatsapp_messages(created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access whatsapp_messages" ON public.whatsapp_messages
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 4. ACTIVAR SUPABASE REALTIME ─────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_contacts;

-- ─── 5. VERIFICACIÓN ──────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '✅ Migración 001 completada exitosamente.';
    RAISE NOTICE '   → crm_pipeline_stages: 4 registros seed';
    RAISE NOTICE '   → crm_contacts: tabla creada con bot_paused';
    RAISE NOTICE '   → whatsapp_messages: tabla creada con FK a conversations';
    RAISE NOTICE '   → Realtime: activado para messages y contacts';
END $$;
