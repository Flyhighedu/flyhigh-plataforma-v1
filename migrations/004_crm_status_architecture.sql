-- ============================================================
-- MIGRACIÓN 004: Arquitectura de Status vs Pipeline
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Agregar columna lead_status a crm_contacts (Dimensión 2)
ALTER TABLE public.crm_contacts
ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'open'
CHECK (lead_status IN ('open', 'won', 'lost'));

-- 2. Migrar contactos existentes '4_agendado' al nuevo paradigma (Ganados, se quedan en etapa 3)
UPDATE public.crm_contacts
SET lead_status = 'won', pipeline_stage = '3_configurando_visita'
WHERE pipeline_stage = '4_agendado';

-- 3. Migrar contactos '5_pausa_humana' al nuevo paradigma (Pausados, se regresan a etapa 1)
UPDATE public.crm_contacts
SET bot_paused = true, pipeline_stage = '1_explorando'
WHERE pipeline_stage = '5_pausa_humana';

-- 4. Eliminar las etapas basura/anti-patrones de la base de datos (Dimensión 1 purificada)
DELETE FROM public.crm_pipeline_stages
WHERE id IN ('4_agendado', '5_pausa_humana');

-- 5. Exponer lead_status explícitamente en índices por rendimiento
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.crm_contacts(lead_status);

DO $$
BEGIN
    RAISE NOTICE '✅ Migración 004 completada.';
    RAISE NOTICE '   → Columna lead_status creada (open, won, lost)';
    RAISE NOTICE '   → Contactos viejos migrados a los estados correctos';
    RAISE NOTICE '   → Columnas basura (4_agendado, 5_pausa_humana) eliminadas del Kanban';
END $$;
