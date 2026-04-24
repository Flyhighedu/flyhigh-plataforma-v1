-- ============================================================
-- MIGRACIÓN 007: Agregar estado "cita_ventas" al pipeline
-- Fecha: 2026-04-23
-- ============================================================
-- Nuevo estado intermedio entre "contactada" y "agendada"
-- para representar una Presentación Agendada (cita física de ventas).

ALTER TABLE public.catalogo_escuelas DROP CONSTRAINT IF EXISTS catalogo_escuelas_estado_pipeline_check;
ALTER TABLE public.catalogo_escuelas DROP CONSTRAINT IF EXISTS chk_estado_pipeline;

ALTER TABLE public.catalogo_escuelas ADD CONSTRAINT chk_estado_pipeline
CHECK (estado_pipeline IN (
  'sin_contacto',
  'llamada_sin_respuesta',
  'contactada',
  'cita_ventas',
  'agendada',
  'en_preparacion',
  'en_ruta',
  'operando',
  'visitada',
  'perdida'
));

DO $$
BEGIN
    RAISE NOTICE '✅ Migración 007 completada.';
    RAISE NOTICE '   → Nuevo estado: cita_ventas (Presentación Agendada)';
    RAISE NOTICE '   → Pipeline ahora tiene 10 estados válidos';
END $$;
