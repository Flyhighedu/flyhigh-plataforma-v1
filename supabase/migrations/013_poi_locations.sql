-- =====================================================
-- FlyHigh EDU — POI Locations (Puntos de Interés)
-- SOLO ADITIVO: No se modifica nada existente
-- 
-- Los POIs son GLOBALES — cualquier staff puede crear
-- un punto de interés y estará disponible para todos.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.poi_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    emoji text NOT NULL DEFAULT '📍',
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_by_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.poi_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi_locations_select_authenticated"
    ON public.poi_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "poi_locations_insert_authenticated"
    ON public.poi_locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "poi_locations_update_authenticated"
    ON public.poi_locations FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_poi_locations_active
ON public.poi_locations (is_active, created_at DESC);
