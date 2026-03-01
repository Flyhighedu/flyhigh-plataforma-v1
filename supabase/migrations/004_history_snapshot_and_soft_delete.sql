-- FlyHigh EDU
-- Historial seguro: snapshot de escuela + soft-delete de escuelas
-- Migracion NO destructiva (no borra ni trunca datos)

-- 1) Snapshot fields en cierres_mision
ALTER TABLE IF EXISTS public.cierres_mision
ADD COLUMN IF NOT EXISTS school_id integer;

ALTER TABLE IF EXISTS public.cierres_mision
ADD COLUMN IF NOT EXISTS school_name_snapshot text;

ALTER TABLE IF EXISTS public.cierres_mision
ADD COLUMN IF NOT EXISTS mission_datetime timestamptz;

-- 2) Soft-delete fields en proximas_escuelas
ALTER TABLE IF EXISTS public.proximas_escuelas
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.proximas_escuelas
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 3) Backfill school_id desde mission_id numerico
UPDATE public.cierres_mision c
SET school_id = c.mission_id::integer
WHERE c.school_id IS NULL
  AND c.mission_id ~ '^[0-9]+$';

-- 4) Backfill mission_datetime
UPDATE public.cierres_mision
SET mission_datetime = COALESCE(mission_datetime, end_time, created_at)
WHERE mission_datetime IS NULL;

-- 5) Backfill school_name_snapshot
UPDATE public.cierres_mision c
SET school_name_snapshot = COALESCE(
    NULLIF(c.school_name_snapshot, ''),
    (
        SELECT s.nombre_escuela
        FROM public.proximas_escuelas s
        WHERE s.id = c.school_id
        LIMIT 1
    ),
    (
        SELECT COALESCE(
            NULLIF(bv.mission_data->>'school_name', ''),
            NULLIF(bv.mission_data->>'nombre_escuela', '')
        )
        FROM public.bitacora_vuelos bv
        WHERE bv.mission_id = c.mission_id
        ORDER BY bv.created_at ASC
        LIMIT 1
    ),
    'Escuela no vinculada'
)
WHERE c.school_name_snapshot IS NULL OR BTRIM(c.school_name_snapshot) = '';

-- 6) Indices de soporte
CREATE INDEX IF NOT EXISTS idx_cierres_mision_school_id
ON public.cierres_mision (school_id);

CREATE INDEX IF NOT EXISTS idx_cierres_mision_mission_datetime
ON public.cierres_mision (mission_datetime);

CREATE INDEX IF NOT EXISTS idx_proximas_escuelas_is_archived
ON public.proximas_escuelas (is_archived);
