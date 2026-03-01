-- =====================================================
-- FlyHigh EDU — Ensure realtime for live journey meta
-- Additive only: no historical rows are modified
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'staff_journeys'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_journeys;
        END IF;
    END IF;
END $$;
