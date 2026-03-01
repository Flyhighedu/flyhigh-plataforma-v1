-- =====================================================
-- FlyHigh EDU — V1 Staff Roles Migration
-- SOLO ADITIVO: No se borra/modifica nada existente
-- =====================================================

-- 1. staff_profiles: Perfil de operativos con rol
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'assistant' CHECK (role IN ('pilot', 'teacher', 'assistant', 'admin')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para staff_profiles
CREATE POLICY "staff_profiles_select_own"
    ON public.staff_profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "staff_profiles_admin_select"
    ON public.staff_profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid() AND sp.role = 'admin'
        )
    );

CREATE POLICY "staff_profiles_admin_insert"
    ON public.staff_profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid() AND sp.role = 'admin'
        )
    );

CREATE POLICY "staff_profiles_admin_update"
    ON public.staff_profiles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles sp
            WHERE sp.user_id = auth.uid() AND sp.role = 'admin'
        )
    );

-- También permitir al service_role insertar (para la primera creación)
-- Esto es implícito, service_role bypassa RLS

-- 2. staff_journeys: Jornada operativa del día
CREATE TABLE IF NOT EXISTS public.staff_journeys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    school_id bigint, -- FK opcional a proximas_escuelas (bigint porque proximas_escuelas usa bigint PK)
    school_name text, -- Nombre redundante para consulta rápida
    status text NOT NULL DEFAULT 'prep' CHECK (status IN ('prep', 'operation', 'report', 'closed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(date, school_id) -- Solo una jornada por escuela por día
);

ALTER TABLE public.staff_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_journeys_select_authenticated"
    ON public.staff_journeys FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "staff_journeys_insert_authenticated"
    ON public.staff_journeys FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "staff_journeys_update_authenticated"
    ON public.staff_journeys FOR UPDATE
    TO authenticated
    USING (true);

-- 3. staff_prep_events: Eventos de checklist pre-salida
CREATE TABLE IF NOT EXISTS public.staff_prep_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id uuid NOT NULL REFERENCES public.staff_journeys(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    event_type text NOT NULL CHECK (event_type IN ('checkin', 'check', 'cargo', 'salida', 'note')),
    payload jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_prep_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_prep_events_select_own_journey"
    ON public.staff_prep_events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "staff_prep_events_insert_own"
    ON public.staff_prep_events FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 4. staff_prep_photos: Fotos de evidencia
CREATE TABLE IF NOT EXISTS public.staff_prep_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id uuid NOT NULL REFERENCES public.staff_journeys(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    file_path text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_prep_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_prep_photos_select"
    ON public.staff_prep_photos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "staff_prep_photos_insert_own"
    ON public.staff_prep_photos FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 5. Agregar columna nullable journey_id a bitacora_vuelos (backward-compatible)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bitacora_vuelos'
          AND column_name = 'journey_id'
    ) THEN
        ALTER TABLE public.bitacora_vuelos ADD COLUMN journey_id uuid REFERENCES public.staff_journeys(id);
    END IF;
END $$;

-- 6. Crear storage bucket para evidencia de prep (si no existe)
-- Nota: Esto se debe ejecutar desde el dashboard de Supabase o con la API de Storage.
-- El bucket 'prep-evidence' debe ser creado manualmente si no se usa CLI.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('prep-evidence', 'prep-evidence', true)
-- ON CONFLICT (id) DO NOTHING;
