-- ==============================================================================
-- MIGRACIÓN: Temas Generales para Staff (pilot_pois)
-- ==============================================================================

-- 1. Discriminador explícito
ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS is_general_topic BOOLEAN DEFAULT false;

-- 2. Palabras clave para comandos de voz
ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS trigger_keywords TEXT[];

-- 3. Índice para filtrado rápido
CREATE INDEX IF NOT EXISTS idx_pilot_pois_general_topic
  ON public.pilot_pois (is_general_topic);

-- 4. Índice GIN para búsqueda de voz
CREATE INDEX IF NOT EXISTS idx_pilot_pois_keywords
  ON public.pilot_pois USING gin (trigger_keywords);

-- ==============================================================================
-- FIX RLS: Asegurar que el Staff (auth.uid()) pueda crear, editar y borrar 
-- sus propios registros en pilot_pois
-- ==============================================================================

-- Si existen políticas restrictivas viejas, se reemplazan o se asegura su existencia
DROP POLICY IF EXISTS "Users can insert their own POIs" ON public.pilot_pois;
CREATE POLICY "Users can insert their own POIs" ON public.pilot_pois
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own POIs" ON public.pilot_pois;
CREATE POLICY "Users can update their own POIs" ON public.pilot_pois
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own POIs" ON public.pilot_pois;
CREATE POLICY "Users can delete their own POIs" ON public.pilot_pois
    FOR DELETE USING (auth.uid() = user_id);
