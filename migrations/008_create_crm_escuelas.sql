CREATE TABLE IF NOT EXISTS public.crm_escuelas_detalles (
    cct TEXT PRIMARY KEY REFERENCES public.catalogo_escuelas(cct) ON DELETE CASCADE,
    notas TEXT,
    reminder_at TIMESTAMPTZ,
    reminder_note TEXT,
    assigned_to TEXT,
    last_interaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.crm_escuelas_detalles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and modify
CREATE POLICY "Allow authenticated users full access to crm_escuelas_detalles"
    ON public.crm_escuelas_detalles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
