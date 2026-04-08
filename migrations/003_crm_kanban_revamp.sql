-- ============================================================
-- MIGRACIÓN 003: Reestructurar Embudo CRM (5 columnas reales)
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Insertar nuevas etapas ANTES de eliminar las viejas (FK safety)
INSERT INTO public.crm_pipeline_stages (id, label, color, icon, sort_order, is_terminal) VALUES
    ('1_explorando',          'Explorando / Menú',    '#6366f1', '📩', 1, false),
    ('2_validando_escuela',   'Inició Agendamiento',  '#3b82f6', '🏫', 2, false),
    ('3_configurando_visita', 'Configurando Visita',  '#f59e0b', '📅', 3, false),
    ('4_agendado',            'Agendado ✅',          '#22c55e', '🎯', 4, true),
    ('5_pausa_humana',        'Intervención Humana',  '#ef4444', '⏸️', 5, false)
ON CONFLICT (id) DO NOTHING;

-- 2. Migrar contactos existentes de stages viejos a nuevos
UPDATE public.crm_contacts SET pipeline_stage = '1_explorando'          WHERE pipeline_stage = 'primer_contacto';
UPDATE public.crm_contacts SET pipeline_stage = '2_validando_escuela'   WHERE pipeline_stage = 'cct_validado';
UPDATE public.crm_contacts SET pipeline_stage = '5_pausa_humana'        WHERE pipeline_stage = 'pausa_dudas';
UPDATE public.crm_contacts SET pipeline_stage = '4_agendado'            WHERE pipeline_stage = 'agendado';

-- 3. Cambiar el DEFAULT de pipeline_stage para nuevos contactos
ALTER TABLE public.crm_contacts ALTER COLUMN pipeline_stage SET DEFAULT '1_explorando';

-- 4. Eliminar stages viejos (ya no tienen FK references)
DELETE FROM public.crm_pipeline_stages WHERE id IN ('primer_contacto', 'cct_validado', 'pausa_dudas', 'agendado');

-- 4. Fix Realtime RLS (incluye fix de migración 002 si no se ejecutó)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read crm_contacts' AND tablename = 'crm_contacts') THEN
        CREATE POLICY "Public read crm_contacts" ON public.crm_contacts FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read whatsapp_messages' AND tablename = 'whatsapp_messages') THEN
        CREATE POLICY "Public read whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (true);
    END IF;
END $$;

-- 5. Verificación
DO $$
BEGIN
    RAISE NOTICE '✅ Migración 003 completada.';
    RAISE NOTICE '   → 5 nuevas columnas de embudo insertadas';
    RAISE NOTICE '   → Contactos existentes migrados a nuevos stages';
    RAISE NOTICE '   → RLS de lectura pública asegurado para Realtime';
END $$;
