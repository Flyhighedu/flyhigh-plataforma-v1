-- ═══════════════════════════════════════════════════════════════
-- Odómetro de Tavily: Contador de uso mensual
-- Tabla singleton (1 sola fila) que rastrea consumo del mes actual
-- Límite: 1,000 búsquedas/mes en plan gratuito
-- Reset automático: se verifica el mes actual en cada consulta
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tavily_usage (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton: solo 1 fila
    month_key TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),  -- e.g. '2026-05'
    usage_count INTEGER NOT NULL DEFAULT 0,
    monthly_limit INTEGER NOT NULL DEFAULT 1000,
    last_used_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar la fila inicial
INSERT INTO public.tavily_usage (id, month_key, usage_count)
VALUES (1, to_char(now(), 'YYYY-MM'), 0)
ON CONFLICT (id) DO NOTHING;

-- RLS: Solo el service role puede modificar, lectura anónima para el frontend
ALTER TABLE public.tavily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tavily_usage_read_all" ON public.tavily_usage
    FOR SELECT USING (true);

CREATE POLICY "tavily_usage_service_only" ON public.tavily_usage
    FOR ALL USING (auth.role() = 'service_role');
