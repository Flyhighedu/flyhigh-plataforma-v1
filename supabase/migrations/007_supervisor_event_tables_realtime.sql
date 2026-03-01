-- =====================================================
-- FlyHigh EDU — Ensure realtime for operational event tables
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
              AND tablename = 'staff_prep_events'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_prep_events;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'staff_prep_photos'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_prep_photos;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'staff_events'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_events;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'staff_presence'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_presence;
        END IF;
    END IF;
END $$;
