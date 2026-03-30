-- Enable Realtime for cierres_mision so Sandbox Vuelos
-- receives INSERT/UPDATE events via postgres_changes.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND tablename = 'cierres_mision'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cierres_mision;
        RAISE NOTICE 'cierres_mision added to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'cierres_mision already in supabase_realtime';
    END IF;
END $$;
