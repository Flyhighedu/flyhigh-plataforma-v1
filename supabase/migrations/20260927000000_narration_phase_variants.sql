-- One POI/topic remains one record; education-phase scripts and audio live together.
-- Existing narrative_script/audio_url records intentionally remain general versions.
ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS phase_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.master_route_pois
  ADD COLUMN IF NOT EXISTS phase_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Topics are not map pins and therefore have no meaningful coordinates.
ALTER TABLE public.pilot_pois ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.pilot_pois ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE public.visit_narration_plans
  ADD COLUMN IF NOT EXISTS grade text
  CHECK (grade IS NULL OR grade IN ('preescolar1', 'preescolar2', 'preescolar3', 'primaria1', 'primaria2', 'primaria3', 'primaria4', 'primaria5', 'primaria6'));

COMMENT ON COLUMN public.pilot_pois.phase_variants IS 'phase2..phase5: script, audio_url, audio_duration_seconds, audio_generated_at. Null or empty for legacy general narration.';
COMMENT ON COLUMN public.master_route_pois.phase_variants IS 'Official education-phase versions. Legacy narrative_script/audio_url remain a clearly labeled general version.';
