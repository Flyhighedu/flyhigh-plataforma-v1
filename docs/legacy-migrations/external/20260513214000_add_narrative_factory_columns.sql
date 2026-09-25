-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: Narrative Factory — Fábrica de Narrativas
-- ════════════════════════════════════════════════════════

-- 1a. Agregar nuevas columnas a master_route_pois
ALTER TABLE public.master_route_pois
  ADD COLUMN IF NOT EXISTS narrative_script TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS research_article TEXT;

-- 1b. Agregar las mismas columnas a pilot_pois (POIs personales de pilotos)
ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS narrative_script TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS research_article TEXT;

-- 2. Crear bucket (público para lectura por la PWA)
INSERT INTO storage.buckets (id, name, public)
VALUES ('poi-narratives', 'poi-narratives', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Política: Cualquiera puede leer (público)
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
