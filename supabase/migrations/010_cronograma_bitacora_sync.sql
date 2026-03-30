-- =========================================================================
-- Trigger: Sincronización PWA (staff_journeys) -> Cronograma (proximas_escuelas)
-- =========================================================================

-- 1. Crear la Función del Autómata (Trigger Function)
CREATE OR REPLACE FUNCTION sync_journey_closure_to_cronograma()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el administrador o la PWA cierran la misión:
    IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
        -- Marca la misión en el calendario como "completada" para que desaparezca del Kanban de pendientes
        UPDATE proximas_escuelas
        SET estatus = 'completada'
        WHERE id = NEW.school_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asociar la función a la tabla staff_journeys
DROP TRIGGER IF EXISTS trigger_sync_journey_closure ON staff_journeys;
CREATE TRIGGER trigger_sync_journey_closure
AFTER UPDATE OF status
ON staff_journeys
FOR EACH ROW
EXECUTE FUNCTION sync_journey_closure_to_cronograma();

-- =========================================================================
-- SCRIPT DE BARRIDO RETROACTIVO (BACKFILL)
-- =========================================================================
-- Esto arreglará inmediatamente las misiones viejas que ya decían 'closed' 
-- pero el cronograma seguía pensando que estaban 'programada'.

UPDATE proximas_escuelas pe
SET estatus = 'completada'
FROM staff_journeys sj
WHERE pe.id = sj.school_id
  AND sj.status = 'closed'
  AND (pe.estatus IS NULL OR pe.estatus != 'completada');

-- NOTA: Con esto, el Kanban del "Cronograma Operativo" quedará mágicamente limpio.
