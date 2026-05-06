-- ═══ Tabla: Citas de Venta ═══
CREATE TABLE IF NOT EXISTS crm_citas_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cct TEXT NOT NULL REFERENCES catalogo_escuelas(cct) ON DELETE CASCADE,
    titulo TEXT NOT NULL DEFAULT 'Cita de Ventas',
    fecha_hora TIMESTAMPTZ NOT NULL,
    duracion_min INT DEFAULT 60,
    responsable TEXT,
    notas TEXT,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
    recordatorio_48h BOOLEAN DEFAULT false,
    recordatorio_24h BOOLEAN DEFAULT false,
    recordatorio_2h BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citas_fecha ON crm_citas_venta(fecha_hora) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_citas_cct ON crm_citas_venta(cct);

-- ═══ Tabla: Log de cambios de Pipeline ═══
CREATE TABLE IF NOT EXISTS crm_pipeline_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cct TEXT NOT NULL REFERENCES catalogo_escuelas(cct) ON DELETE CASCADE,
    nombre_escuela TEXT NOT NULL,
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    cambiado_por TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_log_cct ON crm_pipeline_log(cct);
CREATE INDEX IF NOT EXISTS idx_pipeline_log_created ON crm_pipeline_log(created_at DESC);

-- ═══ Habilitar Realtime para pipeline_log ═══
ALTER PUBLICATION supabase_realtime ADD TABLE crm_pipeline_log;

-- ═══ RLS (acceso abierto con service role, que es lo que usamos) ═══
ALTER TABLE crm_citas_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access citas" ON crm_citas_venta FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access pipeline_log" ON crm_pipeline_log FOR ALL USING (true) WITH CHECK (true);
