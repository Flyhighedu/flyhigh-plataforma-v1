const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
        process.exit(1);
    }

    // Cliente estándar para interactuar con la API de Storage y RPCs de public
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const buckets = ['staff-arrival', 'prep-evidence', 'staff-telemetry'];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 45); // 45 días de retención
    const cutoffStr = cutoffDate.toISOString();

    console.log(`Buscando archivos creados antes de: ${cutoffStr}\n`);

    for (const bucket of buckets) {
        console.log(`-----------------------------------------------`);
        console.log(`Procesando bucket: ${bucket}...`);

        // 1. Obtener la lista de archivos que superan los 45 días usando la función RPC
        const { data: objects, error: fetchError } = await supabase.rpc(
            'get_expired_storage_objects',
            { bucket_name: bucket, age_days: 45 }
        );

        if (fetchError) {
            console.error(`❌ Error al consultar metadata de ${bucket}:`, fetchError.message);
            continue;
        }

        if (!objects || objects.length === 0) {
            console.log(`✅ No hay archivos mayores a 45 días en ${bucket}.`);
            continue;
        }

        console.log(`Encontrados ${objects.length} archivos para eliminar.`);

        // 2. Eliminar en lotes de 100 usando el SDK oficial (limpia BD y S3 físico)
        const batchSize = 100;
        let deletedCount = 0;

        for (let i = 0; i < objects.length; i += batchSize) {
            const batch = objects.slice(i, i + batchSize).map(obj => obj.name);
            
            const { data, error: deleteError } = await supabase.storage
                .from(bucket)
                .remove(batch);

            if (deleteError) {
                console.error(`❌ Error eliminando lote en ${bucket}:`, deleteError.message);
            } else {
                deletedCount += batch.length;
                console.log(`   -> Eliminados ${deletedCount}/${objects.length} archivos...`);
            }
        }

        console.log(`✅ Proceso finalizado para ${bucket}.`);
    }
}

run().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
