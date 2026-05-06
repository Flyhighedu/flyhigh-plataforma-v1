-- =====================================================
-- Migration: 20260506_add_pilot_narration_source
-- Adds 'pilot_narration' to the source CHECK constraint
-- on audio_quality_audits table.
--
-- Required because the original migration only allowed
-- 'bitacora' and 'civic', but the pilot recording
-- system sends source='pilot_narration'.
-- =====================================================

-- Drop the existing CHECK constraint on source column
ALTER TABLE public.audio_quality_audits
    DROP CONSTRAINT IF EXISTS audio_quality_audits_source_check;

-- Re-add the constraint with 'pilot_narration' included
ALTER TABLE public.audio_quality_audits
    ADD CONSTRAINT audio_quality_audits_source_check
    CHECK (source IN ('bitacora', 'civic', 'pilot_narration'));
