-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: Temas Generales + Voice-Ready Keywords
-- ════════════════════════════════════════════════════════

-- 1. Discriminador explícito
ALTER TABLE public.master_route_pois
  ADD COLUMN IF NOT EXISTS is_general_topic BOOLEAN DEFAULT false;

-- 2. Palabras clave para comandos de voz
ALTER TABLE public.master_route_pois
  ADD COLUMN IF NOT EXISTS trigger_keywords TEXT[];

-- 3. Índice para filtrado rápido por tipo
CREATE INDEX IF NOT EXISTS idx_master_route_pois_general_topic
  ON public.master_route_pois (is_general_topic);

-- 4. Índice GIN para búsqueda por palabras clave
CREATE INDEX IF NOT EXISTS idx_master_route_pois_keywords
  ON public.master_route_pois USING gin (trigger_keywords);
