-- ════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Narrative Factory — Columnas + RLS Fix (Idempotente)
-- Fecha: 2026-05-14
-- Propósito: Asegurar columnas narrativas + corregir RLS en pilot_pois
-- ════════════════════════════════════════════════════════════════════

-- ═══ 1. COLUMNAS NARRATIVAS (IF NOT EXISTS) ═══

ALTER TABLE public.master_route_pois
  ADD COLUMN IF NOT EXISTS narrative_script TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS research_article TEXT;

ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS narrative_script TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS research_article TEXT;

-- ═══ 2. STORAGE BUCKET (idempotente) ═══

INSERT INTO storage.buckets (id, name, public)
VALUES ('poi-narratives', 'poi-narratives', true)
ON CONFLICT (id) DO NOTHING;

-- ═══ 3. STORAGE POLICY — Lectura pública ═══

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow public read poi-narratives'
    ) THEN
        CREATE POLICY "Allow public read poi-narratives"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'poi-narratives');
    END IF;
END $$;

-- ═══ 4. STORAGE POLICY — Upload para usuarios autenticados ═══

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated upload poi-narratives'
    ) THEN
        CREATE POLICY "Allow authenticated upload poi-narratives"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = 'poi-narratives' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- ═══ 5. RLS para pilot_pois — CRÍTICO ═══
-- Habilitar RLS (idempotente, no error si ya está habilitado)
ALTER TABLE public.pilot_pois ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas existentes que puedan estar mal configuradas
DROP POLICY IF EXISTS "Users can view own pilot_pois" ON public.pilot_pois;
DROP POLICY IF EXISTS "Users can insert own pilot_pois" ON public.pilot_pois;
DROP POLICY IF EXISTS "Users can update own pilot_pois" ON public.pilot_pois;
DROP POLICY IF EXISTS "Users can delete own pilot_pois" ON public.pilot_pois;
DROP POLICY IF EXISTS "pilot_pois_select_own" ON public.pilot_pois;
DROP POLICY IF EXISTS "pilot_pois_insert_own" ON public.pilot_pois;
DROP POLICY IF EXISTS "pilot_pois_update_own" ON public.pilot_pois;
DROP POLICY IF EXISTS "pilot_pois_delete_own" ON public.pilot_pois;

-- SELECT: Cada usuario solo ve sus propios POIs
CREATE POLICY "pilot_pois_select_own"
    ON public.pilot_pois FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: Cada usuario solo puede insertar con su propio user_id
CREATE POLICY "pilot_pois_insert_own"
    ON public.pilot_pois FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Cada usuario solo puede editar sus propios POIs
CREATE POLICY "pilot_pois_update_own"
    ON public.pilot_pois FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Cada usuario solo puede eliminar sus propios POIs
CREATE POLICY "pilot_pois_delete_own"
    ON public.pilot_pois FOR DELETE
    USING (auth.uid() = user_id);
