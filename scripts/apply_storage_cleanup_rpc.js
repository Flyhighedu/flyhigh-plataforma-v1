const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Conectando a Supabase URL:', supabaseUrl);

    const query = `
-- 1. Asegurar que las extensiones necesarias estén disponibles
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Crear una función para realizar la limpieza de los 3 buckets
CREATE OR REPLACE FUNCTION public.cleanup_expired_storage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Borrar de staff-arrival con más de 45 días
    DELETE FROM storage.objects
    WHERE bucket_id = 'staff-arrival'
      AND created_at < NOW() - INTERVAL '45 days';

    -- Borrar de prep-evidence con más de 45 días
    DELETE FROM storage.objects
    WHERE bucket_id = 'prep-evidence'
      AND created_at < NOW() - INTERVAL '45 days';

    -- Borrar de staff-telemetry con más de 45 días
    DELETE FROM storage.objects
    WHERE bucket_id = 'staff-telemetry'
      AND created_at < NOW() - INTERVAL '45 days';
END;
$$;

-- 3. Programar la limpieza automática (Corre todos los días a las 3:00 AM UTC)
-- Si la tarea ya existe, primero la eliminamos para no duplicar.
DO $$
BEGIN
    PERFORM cron.unschedule('daily-storage-cleanup');
EXCEPTION WHEN OTHERS THEN
    -- Ignorar si no existe
END $$;

SELECT cron.schedule(
    'daily-storage-cleanup',
    '0 3 * * *',
    'SELECT public.cleanup_expired_storage();'
);
    `;

    console.log('Ejecutando script de migración mediante RPC exec_sql...');
    const { data, error } = await supabase.rpc('exec_sql', { query });

    if (error) {
        console.error('❌ Error al ejecutar la migración:', error.message);
        process.exit(1);
    }

    console.log('✅ Migración SQL de limpieza y pg_cron aplicada con éxito.');

    console.log('Ejecutando limpieza manual inmediata...');
    const { error: runError } = await supabase.rpc('exec_sql', { 
        query: 'SELECT public.cleanup_expired_storage();' 
    });

    if (runError) {
        console.error('❌ Error al ejecutar la limpieza inmediata:', runError.message);
        process.exit(1);
    }

    console.log('✅ Limpieza inmediata ejecutada con éxito. Los archivos mayores a 45 días han sido purgados.');
}

run().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
