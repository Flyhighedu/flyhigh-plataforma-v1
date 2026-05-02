-- Caché permanente de información de POIs generada por IA
-- Cada POI se consulta UNA sola vez; después se sirve de aquí
CREATE TABLE IF NOT EXISTS public.poi_info_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poi_key TEXT NOT NULL UNIQUE,
    poi_name TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    description TEXT NOT NULL,
    city_context TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_cache_key ON public.poi_info_cache (poi_key);

ALTER TABLE public.poi_info_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi_cache_public_read" ON public.poi_info_cache
    FOR SELECT USING (true);
