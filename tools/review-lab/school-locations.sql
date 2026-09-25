-- LOCAL REVIEW ONLY. Deliberately outside supabase/migrations: not deployable
-- accidentally with the application. No backfill, DELETE, identity or FK changes.
ALTER TABLE public.catalogo_escuelas ADD COLUMN IF NOT EXISTS ubicacion_lat double precision;
ALTER TABLE public.catalogo_escuelas ADD COLUMN IF NOT EXISTS ubicacion_lng double precision;
ALTER TABLE public.catalogo_escuelas ADD COLUMN IF NOT EXISTS ubicacion_fuente jsonb;
ALTER TABLE public.catalogo_escuelas ADD COLUMN IF NOT EXISTS ubicacion_verificada_at timestamptz;
ALTER TABLE public.proximas_escuelas ADD COLUMN IF NOT EXISTS ubicacion_fuente jsonb;
ALTER TABLE public.proximas_escuelas ADD COLUMN IF NOT EXISTS ubicacion_verificada_at timestamptz;

CREATE TABLE IF NOT EXISTS public.review_location_changes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    target_table text NOT NULL,
    target_id text NOT NULL,
    before_location jsonb,
    after_location jsonb NOT NULL
);
ALTER TABLE public.review_location_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_location_changes FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.review_confirm_school_location(uuid);
CREATE OR REPLACE FUNCTION public.review_confirm_school_location(p_source_id uuid, p_expected jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s public.intel_schools; c public.catalogo_escuelas; src jsonb; project_name text; target_cct text;
BEGIN
    -- Serialize the local confirmation workflow, including duplicate checks.
    LOCK TABLE public.intel_schools IN SHARE MODE;
    LOCK TABLE public.catalogo_escuelas IN SHARE ROW EXCLUSIVE MODE;
    SELECT * INTO STRICT s FROM public.intel_schools WHERE id = p_source_id;
    IF p_expected IS DISTINCT FROM jsonb_build_object('project_id', s.project_id, 'cct', s.cct, 'nombre', s.nombre,
        'turno', s.turno, 'latitud', s.latitud, 'longitud', s.longitud) THEN
        RAISE EXCEPTION 'La fuente cambió desde la revisión. Vuelve a comprobar el mapa';
    END IF;
    target_cct := upper(btrim(s.cct));
    IF target_cct = '' OR btrim(coalesce(s.turno, '')) = '' THEN RAISE EXCEPTION 'CCT o turno incompleto'; END IF;
    IF (SELECT count(*) FROM public.intel_schools WHERE project_id = s.project_id AND upper(btrim(cct)) = target_cct) <> 1 THEN
        RAISE EXCEPTION 'CCT duplicado en este proyecto: requiere revisión manual';
    END IF;
    IF s.latitud IS NULL OR s.longitud IS NULL OR NOT (s.latitud BETWEEN 14 AND 33 AND s.longitud BETWEEN -119 AND -86) THEN
        RAISE EXCEPTION 'Coordenadas inválidas para el catálogo mexicano';
    END IF;
    IF (SELECT count(*) FROM public.catalogo_escuelas WHERE upper(btrim(cct)) = target_cct) > 1 THEN
        RAISE EXCEPTION 'CCT ambiguo en catálogo';
    END IF;
    SELECT * INTO c FROM public.catalogo_escuelas WHERE upper(btrim(cct)) = target_cct;
    IF FOUND THEN
        IF upper(btrim(coalesce(c.turno, ''))) <> upper(btrim(s.turno)) THEN RAISE EXCEPTION 'El turno no coincide'; END IF;
        IF c.ubicacion_lat IS NOT NULL OR c.ubicacion_lng IS NOT NULL THEN RAISE EXCEPTION 'La ubicación existente se conserva; no se sobrescribe'; END IF;
    END IF;
    SELECT name INTO project_name FROM public.intel_projects WHERE id = s.project_id;
    src := jsonb_build_object('kind', 'intelligence', 'project_id', s.project_id, 'project_name', project_name,
        'source_id', s.id, 'cct', s.cct, 'nombre', s.nombre, 'turno', s.turno, 'municipio', s.municipio,
        'latitud', s.latitud, 'longitud', s.longitud, 'reviewed_in', 'local-lab');
    IF c.cct IS NULL THEN
        INSERT INTO public.catalogo_escuelas(cct, nombre_escuela, turno, tipo, ninos, nivel_educativo,
            ubicacion_lat, ubicacion_lng, ubicacion_fuente, ubicacion_verificada_at)
        VALUES(target_cct, s.nombre, s.turno, s.sostenimiento, s.alumnos, nullif(s.nivel_educativo, ''),
            s.latitud, s.longitud, src, now()) RETURNING * INTO c;
        INSERT INTO public.review_location_changes(target_table, target_id, before_location, after_location)
        VALUES('catalogo_escuelas', c.cct, NULL, to_jsonb(c));
    ELSE
        -- Deliberately do not update names, prices, pipeline, visitada or CCT.
        UPDATE public.catalogo_escuelas SET ubicacion_lat = s.latitud, ubicacion_lng = s.longitud,
            ubicacion_fuente = src, ubicacion_verificada_at = now() WHERE cct = c.cct RETURNING * INTO c;
        INSERT INTO public.review_location_changes(target_table, target_id, before_location, after_location)
        VALUES('catalogo_escuelas', c.cct, '{"ubicacion_lat":null,"ubicacion_lng":null}',
            jsonb_build_object('ubicacion_lat', c.ubicacion_lat, 'ubicacion_lng', c.ubicacion_lng, 'ubicacion_fuente', src));
    END IF;
    RETURN to_jsonb(c);
END $$;

CREATE OR REPLACE FUNCTION public.review_fill_visit_location(p_visit_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v public.proximas_escuelas; c public.catalogo_escuelas;
BEGIN
    SELECT * INTO STRICT v FROM public.proximas_escuelas WHERE id = p_visit_id FOR UPDATE;
    IF v.fecha_programada <= (now() AT TIME ZONE 'America/Mexico_City')::date OR v.is_archived OR v.archived_at IS NOT NULL OR
        upper(btrim(coalesce(v.estatus, ''))) NOT IN ('PENDIENTE', 'PROGRAMADO', 'PROGRAMADA') OR
        v.ubicacion_lat IS NOT NULL OR v.ubicacion_lng IS NOT NULL OR
        EXISTS (SELECT 1 FROM public.staff_journeys WHERE school_id = v.id) OR
        EXISTS (SELECT 1 FROM public.cierres_mision WHERE school_id = v.id) THEN
        RAISE EXCEPTION 'Visita excluida: histórica, iniciada, archivada, de hoy o con ubicación existente';
    END IF;
    SELECT * INTO STRICT c FROM public.catalogo_escuelas WHERE upper(btrim(cct)) = upper(btrim(v.cct)) FOR SHARE;
    IF c.ubicacion_verificada_at IS NULL OR c.ubicacion_lat IS NULL OR c.ubicacion_lng IS NULL OR
        btrim(coalesce(v.turno, '')) = '' OR upper(btrim(coalesce(c.turno, ''))) <> upper(btrim(v.turno)) THEN
        RAISE EXCEPTION 'Falta ubicación verificada o el turno no coincide';
    END IF;
    UPDATE public.proximas_escuelas SET ubicacion_lat = c.ubicacion_lat, ubicacion_lng = c.ubicacion_lng,
        ubicacion_fuente = c.ubicacion_fuente, ubicacion_verificada_at = c.ubicacion_verificada_at
        WHERE id = v.id RETURNING * INTO v;
    INSERT INTO public.review_location_changes(target_table, target_id, before_location, after_location)
    VALUES('proximas_escuelas', v.id::text, '{"ubicacion_lat":null,"ubicacion_lng":null}',
        jsonb_build_object('ubicacion_lat', v.ubicacion_lat, 'ubicacion_lng', v.ubicacion_lng, 'ubicacion_fuente', v.ubicacion_fuente));
    RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION public.review_confirm_school_location(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_fill_visit_location(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_confirm_school_location(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_fill_visit_location(integer) TO service_role;
NOTIFY pgrst, 'reload schema';
