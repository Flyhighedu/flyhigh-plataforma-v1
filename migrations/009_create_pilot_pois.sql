-- =====================================================
-- 009_create_pilot_pois.sql
-- Table for Pilot POI (Point of Interest) mapping.
-- Each pilot can save geographic points they discover
-- during field operations for future reference.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pilot_pois (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
    description TEXT CHECK (char_length(description) <= 300),
    latitude    DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude   DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    category    TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('school','parking','hazard','landmark','refuel','general')),
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pilot_pois_user ON public.pilot_pois(user_id);
CREATE INDEX idx_pilot_pois_category ON public.pilot_pois(category);

-- RLS: Pilots only see/manage their own POIs
ALTER TABLE public.pilot_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own POIs"
    ON public.pilot_pois FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own POIs"
    ON public.pilot_pois FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own POIs"
    ON public.pilot_pois FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own POIs"
    ON public.pilot_pois FOR DELETE
    USING (auth.uid() = user_id);
