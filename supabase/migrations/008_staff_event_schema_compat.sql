-- =====================================================
-- FlyHigh EDU — Staff event schema compatibility hardening
-- Additive/safe: no historical rows are deleted
-- =====================================================

-- 1) Ensure photos table supports item-level linkage used by UI
ALTER TABLE IF EXISTS public.staff_prep_photos
ADD COLUMN IF NOT EXISTS item_id text;

-- 2) Relax rigid event_type checks to prevent silent write failures
DO $$
DECLARE
    constraint_row record;
BEGIN
    IF to_regclass('public.staff_prep_events') IS NULL THEN
        RETURN;
    END IF;

    FOR constraint_row IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'staff_prep_events'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%event_type%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.staff_prep_events DROP CONSTRAINT IF EXISTS %I',
            constraint_row.conname
        );
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'staff_prep_events'
          AND c.conname = 'staff_prep_events_event_type_not_blank'
    ) THEN
        ALTER TABLE public.staff_prep_events
        ADD CONSTRAINT staff_prep_events_event_type_not_blank
        CHECK (char_length(btrim(event_type)) > 0);
    END IF;
END $$;

-- 3) Indexes for high-frequency fallback polling
CREATE INDEX IF NOT EXISTS idx_staff_prep_events_journey_created_at
ON public.staff_prep_events (journey_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_prep_photos_journey_created_at
ON public.staff_prep_photos (journey_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_events_journey_created_at
ON public.staff_events (journey_id, created_at DESC);
