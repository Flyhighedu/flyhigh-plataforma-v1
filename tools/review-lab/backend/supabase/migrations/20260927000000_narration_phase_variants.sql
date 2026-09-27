ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS phase_variants jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.master_route_pois
  ADD COLUMN IF NOT EXISTS phase_variants jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pilot_pois ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.pilot_pois ALTER COLUMN longitude DROP NOT NULL;
