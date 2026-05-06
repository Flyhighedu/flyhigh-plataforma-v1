import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'public' } }
        );

        // Create crm_citas_venta table
        const { error: e1 } = await supabase.rpc('exec_sql', {
            sql: `
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

                ALTER TABLE crm_citas_venta ENABLE ROW LEVEL SECURITY;
                ALTER TABLE crm_pipeline_log ENABLE ROW LEVEL SECURITY;
                CREATE POLICY "full_access_citas" ON crm_citas_venta FOR ALL USING (true) WITH CHECK (true);
                CREATE POLICY "full_access_pipeline_log" ON crm_pipeline_log FOR ALL USING (true) WITH CHECK (true);
            `
        });

        if (e1) {
            return NextResponse.json({ error: e1.message, step: 'rpc' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
