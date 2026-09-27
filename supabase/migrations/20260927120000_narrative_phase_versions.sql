-- Additive only: existing guion/audio columns remain the General version.
ALTER TABLE public.master_route_pois ADD COLUMN IF NOT EXISTS narrative_versions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pilot_pois ADD COLUMN IF NOT EXISTS narrative_versions jsonb NOT NULL DEFAULT '{}'::jsonb;
-- General topics are already an editor entry point and have no coordinates.
-- Keep coordinates required for geographical points, including new drafts.
ALTER TABLE public.pilot_pois ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.pilot_pois ALTER COLUMN longitude DROP NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.pilot_pois'::regclass AND conname = 'pilot_pois_topic_or_coordinates') THEN
        ALTER TABLE public.pilot_pois ADD CONSTRAINT pilot_pois_topic_or_coordinates
            CHECK (is_general_topic IS TRUE OR (latitude IS NOT NULL AND longitude IS NOT NULL)) NOT VALID;
    END IF;
END $$;
COMMENT ON COLUMN public.master_route_pois.narrative_versions IS 'Independent phase_2 through phase_6 educational drafts, review markers and audio; legacy columns remain General.';
COMMENT ON COLUMN public.pilot_pois.narrative_versions IS 'Independent phase_2 through phase_6 educational drafts, review markers and audio; ownership follows existing row policies.';
NOTIFY pgrst, 'reload schema';
