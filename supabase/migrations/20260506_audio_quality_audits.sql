-- =====================================================
-- Migration: 20260506_audio_quality_audits
-- Creates the audio_quality_audits table for the
-- AI-powered Quality Monitoring system.
--
-- Each row = one analyzed audio from a pre-flight
-- dynamic (SupervisorBitacoraScreen wizard).
-- Linked to staff_journeys via journey_id.
--
-- SECURITY: RLS enabled. Authenticated users can read.
-- Only service role (backend) can write.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audio_quality_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Operational links ──
    journey_id UUID REFERENCES public.staff_journeys(id) ON DELETE CASCADE,
    user_id UUID,
    flight_number INTEGER,
    source TEXT NOT NULL DEFAULT 'bitacora'
        CHECK (source IN ('bitacora', 'civic', 'pilot_narration')),

    -- ── Audio source ──
    audio_url TEXT,
    audio_duration_seconds INTEGER,

    -- ── Analysis status ──
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'analyzing',
            'completed',
            'failed',
            'too_short',
            'download_failed',
            'parse_failed'
        )),

    -- ── Scorecard: checklist booleans ──
    -- null = "no_detectado" (Gemini couldn't determine)
    score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    menciona_nombre_equipo BOOLEAN,
    nombre_equipo_detectado TEXT,
    menciona_destino BOOLEAN,
    destino_detectado TEXT,
    dinamica_sube_sube BOOLEAN,
    energia_interaccion TEXT
        CHECK (energia_interaccion IS NULL OR energia_interaccion IN ('alta','media','baja','no_detectado')),
    participacion_ninos_audible BOOLEAN,

    -- ── Feedback ──
    feedback_para_isa TEXT,
    resumen_supervisor TEXT,

    -- ── Raw AI response (for debugging) ──
    raw_response JSONB,

    -- ── Metadata ──
    model_used TEXT DEFAULT 'gemini-2.5-flash',
    error_message TEXT,
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Performance indexes ──
CREATE INDEX IF NOT EXISTS idx_aqa_journey  ON public.audio_quality_audits(journey_id);
CREATE INDEX IF NOT EXISTS idx_aqa_user     ON public.audio_quality_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_aqa_status   ON public.audio_quality_audits(status);
CREATE INDEX IF NOT EXISTS idx_aqa_created  ON public.audio_quality_audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aqa_score    ON public.audio_quality_audits(score)
    WHERE status = 'completed';

-- ── RLS: read-only for authenticated, write via service role ──
ALTER TABLE public.audio_quality_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audits"
    ON public.audio_quality_audits
    FOR SELECT
    TO authenticated
    USING (true);

-- No INSERT/UPDATE/DELETE policies for 'authenticated' or 'anon'.
-- Only the service_role key (used by our API routes) can write.
