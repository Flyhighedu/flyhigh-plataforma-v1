-- Migration: Add En Ruta Phase

-- 1. Updates to staff_journeys
ALTER TABLE staff_journeys 
ADD COLUMN IF NOT EXISTS route_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS route_started_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS arrival_photo_taken_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arrival_photo_taken_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS arrival_photo_url TEXT,
ADD COLUMN IF NOT EXISTS mission_state TEXT DEFAULT 'prep';

-- 2. Create staff_events table
CREATE TABLE IF NOT EXISTS staff_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES staff_journeys(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- ROUTE_STARTED, ARRIVAL_FACADE_PHOTO_TAKEN, ISSUE_REPORTED
    actor_user_id UUID NOT NULL REFERENCES auth.users(id),
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create staff_presence table (for heartbeat/offline detection)
CREATE TABLE IF NOT EXISTS staff_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES staff_journeys(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_online BOOLEAN DEFAULT TRUE
);

-- 4. Enable RLS
ALTER TABLE staff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_presence ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'staff_events' AND policyname = 'Allow read/write all authenticated staff') THEN
        CREATE POLICY "Allow read/write all authenticated staff" ON staff_events FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'staff_presence' AND policyname = 'Allow read/write all authenticated staff') THEN
        CREATE POLICY "Allow read/write all authenticated staff" ON staff_presence FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Policies for extended staff_journeys columns (if needed, usually covered by existing)

-- Storage Bucket Creation (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-arrival', 'staff-arrival', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow staff upload arrival') THEN
        CREATE POLICY "Allow staff upload arrival" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'staff-arrival' AND auth.role() = 'authenticated' );
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read arrival') THEN
        CREATE POLICY "Allow public read arrival" ON storage.objects FOR SELECT USING ( bucket_id = 'staff-arrival' );
    END IF;
END $$;
