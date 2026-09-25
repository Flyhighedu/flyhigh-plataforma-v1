-- ════════════════════════════════════════════════════════
-- official_soundtracks — Music tracks for flight operations
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.official_soundtracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist TEXT DEFAULT NULL,
    track_type TEXT NOT NULL CHECK (track_type IN ('boarding', 'in_flight')),
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('audio/mpeg', 'audio/mp4', 'audio/x-m4a')),
    duration_seconds NUMERIC(8,2) DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soundtracks_type_active 
    ON public.official_soundtracks (track_type, is_active) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_soundtracks_sort 
    ON public.official_soundtracks (track_type, sort_order);

ALTER TABLE public.official_soundtracks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'official_soundtracks' 
        AND policyname = 'anon_read_soundtracks'
    ) THEN
        CREATE POLICY "anon_read_soundtracks" ON public.official_soundtracks
            FOR SELECT TO anon, authenticated USING (is_active = TRUE);
    END IF;
END $$;

-- ════════════════════════════════════════════════════════
-- Storage Bucket para official_soundtracks
-- ════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('official_soundtracks', 'official_soundtracks', true)
ON CONFLICT (id) DO NOTHING;

-- Política: Cualquiera puede leer (público)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow public read official_soundtracks'
    ) THEN
        CREATE POLICY "Allow public read official_soundtracks"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'official_soundtracks');
    END IF;
END $$;

-- Política: Upload para autenticados (staff/admin)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated upload official_soundtracks'
    ) THEN
        CREATE POLICY "Allow authenticated upload official_soundtracks"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = 'official_soundtracks' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Política: Update para autenticados (staff/admin)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated update official_soundtracks'
    ) THEN
        CREATE POLICY "Allow authenticated update official_soundtracks"
            ON storage.objects FOR UPDATE
            USING (bucket_id = 'official_soundtracks' AND auth.role() = 'authenticated')
            WITH CHECK (bucket_id = 'official_soundtracks' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Política: Delete para autenticados (staff/admin)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Allow authenticated delete official_soundtracks'
    ) THEN
        CREATE POLICY "Allow authenticated delete official_soundtracks"
            ON storage.objects FOR DELETE
            USING (bucket_id = 'official_soundtracks' AND auth.role() = 'authenticated');
    END IF;
END $$;
