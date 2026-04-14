-- ============================================================
-- MIGRACIÓN 005: Purificar Pipeline del Catálogo de Escuelas
-- Fecha: 2026-04-14
-- ============================================================
-- PROBLEMA: El trigger sync_catalogo_pipeline_from_journey() 
-- sincronizaba micro-estados operativos transitorios (en_preparacion,
-- en_ruta, operando) hacia catalogo_escuelas. Estos estados no le
-- pertenecen al catálogo maestro — le pertenecen a staff_journeys 
-- y proximas_escuelas. Esto causaba:
--   1. Constraint violation al crear jornadas (bug crítico en Staff App)
--   2. Pérdida de histórico al revisitar escuelas
--
-- SOLUCIÓN: El trigger ahora SOLO marca "visitada" al cerrar misión.
-- El catálogo solo conoce verdades permanentes:
--   sin_contacto → contactada → agendada → visitada
-- ============================================================

-- 1. Limpiar filas con estados transitorios huérfanos
UPDATE catalogo_escuelas 
SET estado_pipeline = 'visitada' 
WHERE estado_pipeline IN ('en_preparacion', 'en_ruta', 'operando');

-- 2. Simplificar el trigger: solo marca 'visitada' al cerrar misión
CREATE OR REPLACE FUNCTION public.sync_catalogo_pipeline_from_journey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  school_cct TEXT;
BEGIN
  -- Solo actuar cuando la misión se cierra
  IF NEW.status != 'closed' AND NEW.mission_state NOT IN ('report', 'closed') THEN
    RETURN NEW;
  END IF;

  -- Get the CCT from proximas_escuelas linked to this journey
  SELECT cct INTO school_cct
  FROM proximas_escuelas
  WHERE id = NEW.school_id;

  -- If no CCT found, skip
  IF school_cct IS NULL OR school_cct = '' THEN
    RETURN NEW;
  END IF;

  -- Marcar como visitada (medalla permanente, nunca se quita)
  UPDATE catalogo_escuelas
  SET estado_pipeline = 'visitada'
  WHERE cct = school_cct
    AND estado_pipeline != 'visitada';

  RETURN NEW;
END;
$function$;

-- 3. Restaurar constraint a sus 4 estados permanentes
ALTER TABLE catalogo_escuelas DROP CONSTRAINT IF EXISTS chk_estado_pipeline;
ALTER TABLE catalogo_escuelas ADD CONSTRAINT chk_estado_pipeline 
CHECK (estado_pipeline IN ('sin_contacto', 'contactada', 'agendada', 'visitada'));

DO $$
BEGIN
    RAISE NOTICE '✅ Migración 005 completada.';
    RAISE NOTICE '   → Trigger simplificado: solo marca visitada al cerrar misión';
    RAISE NOTICE '   → Constraint restaurado a 4 estados permanentes';
    RAISE NOTICE '   → Estados transitorios eliminados del catálogo';
END $$;
