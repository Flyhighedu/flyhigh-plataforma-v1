-- =====================================================
-- FlyHigh EDU — Ensure realtime for operation flights
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
              AND tablename = 'bitacora_vuelos'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.bitacora_vuelos;
        END IF;
    END IF;
END $$;
