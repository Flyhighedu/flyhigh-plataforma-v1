-- =====================================================
-- 014 — Agregar campos de Ficha Didáctica a pilot_pois
-- SOLO ADITIVO: No modifica columnas existentes.
-- Nuevos campos para almacenar la investigación de
-- Gemini y la ficha educativa generada por IA.
-- =====================================================

ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS dato_clave_1 TEXT,
  ADD COLUMN IF NOT EXISTS dato_clave_2 TEXT,
  ADD COLUMN IF NOT EXISTS pregunta_interaccion TEXT,
  ADD COLUMN IF NOT EXISTS research_article TEXT;
