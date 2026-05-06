-- ═══════════════════════════════════════════════════════════
-- RUTAS MAESTRAS — Migración de Base de Datos
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Tabla principal: Rutas Maestras
CREATE TABLE IF NOT EXISTS master_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'Nueva Ruta',
    description TEXT DEFAULT '',
    emoji TEXT DEFAULT '🗺️',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- 2. POIs dentro de una ruta (templates del admin)
CREATE TABLE IF NOT EXISTS master_route_pois (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES master_routes(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Nuevo Punto',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    dato_clave_1 TEXT DEFAULT '',
    dato_clave_2 TEXT DEFAULT '',
    dato_clave_3 TEXT DEFAULT '',
    pregunta_estudio_1 TEXT DEFAULT '',
    pregunta_estudio_2 TEXT DEFAULT '',
    pregunta_estudio_3 TEXT DEFAULT '',
    pregunta_interaccion TEXT DEFAULT '',
    ai_context JSONB DEFAULT '{}'::jsonb,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Progreso individual de cada piloto
CREATE TABLE IF NOT EXISTS pilot_route_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    route_id UUID NOT NULL REFERENCES master_routes(id) ON DELETE CASCADE,
    poi_id UUID NOT NULL REFERENCES master_route_pois(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    confidence_level INT DEFAULT 0 CHECK (confidence_level BETWEEN 0 AND 3),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, poi_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_master_route_pois_route ON master_route_pois(route_id);
CREATE INDEX IF NOT EXISTS idx_pilot_route_progress_user ON pilot_route_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_pilot_route_progress_route ON pilot_route_progress(route_id);
CREATE INDEX IF NOT EXISTS idx_master_routes_status ON master_routes(status);

-- RLS (permisivo para service role, lectura para authenticated)
ALTER TABLE master_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_route_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_route_progress ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura para authenticated (los pilotos pueden ver rutas publicadas)
CREATE POLICY "Authenticated can read published routes"
    ON master_routes FOR SELECT
    TO authenticated
    USING (status = 'published');

CREATE POLICY "Authenticated can read route POIs"
    ON master_route_pois FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM master_routes WHERE id = route_id AND status = 'published'
    ));

-- Progreso: cada piloto puede CRUD su propio progreso
CREATE POLICY "Users can manage own progress"
    ON pilot_route_progress FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
