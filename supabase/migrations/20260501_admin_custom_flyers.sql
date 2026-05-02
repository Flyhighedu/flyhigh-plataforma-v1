-- Migration: admin_custom_flyers
-- Create table to persist AI-generated flyers

CREATE TABLE IF NOT EXISTS public.admin_custom_flyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    html_content TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.admin_custom_flyers ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can manage
CREATE POLICY "Allow authenticated users to manage custom flyers"
ON public.admin_custom_flyers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Optional trigger for updated_at
CREATE OR REPLACE FUNCTION update_custom_flyers_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_custom_flyers_updated_at ON public.admin_custom_flyers;
CREATE TRIGGER trg_admin_custom_flyers_updated_at
BEFORE UPDATE ON public.admin_custom_flyers
FOR EACH ROW
EXECUTE FUNCTION update_custom_flyers_modtime();
