-- =====================================================
-- Migration: 20260506_pilot_narration_source
-- Adds 'pilot_narration' as a valid source in
-- audio_quality_audits for pilot flight recordings.
-- =====================================================

ALTER TABLE public.audio_quality_audits
  DROP CONSTRAINT IF EXISTS audio_quality_audits_source_check;

ALTER TABLE public.audio_quality_audits
  ADD CONSTRAINT audio_quality_audits_source_check
  CHECK (source IN ('bitacora', 'civic', 'pilot_narration'));
