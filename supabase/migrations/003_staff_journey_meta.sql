-- Migration: Add meta column to staff_journeys for flexible storage
-- Idempotent: Only adds if it doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'staff_journeys'
        AND column_name = 'meta'
    ) THEN
        ALTER TABLE public.staff_journeys
        ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;
