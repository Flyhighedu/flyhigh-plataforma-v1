import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// =====================================================
// GET /api/cron/cleanup-storage
//
// Endpoint programado (cron) que busca y elimina archivos
// mayores a 45 días en los buckets: staff-arrival, prep-evidence,
// y staff-telemetry usando el SDK de Supabase para evitar
// huérfanos físicos en S3.
// =====================================================

export async function GET(request) {
    try {
        // Validar token de seguridad del cron (opcional/recomendado)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ ok: false, error: 'Server configuration error.' }, { status: 500 });
        }

        // Cliente para API de Storage y RPC
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const buckets = ['staff-arrival', 'prep-evidence', 'staff-telemetry'];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 45); // 45 días de retención
        const cutoffStr = cutoffDate.toISOString();

        const report = {};

        for (const bucket of buckets) {
            // 1. Consultar metadata usando RPC
            const { data: objects, error: fetchError } = await supabase.rpc(
                'get_expired_storage_objects',
                { bucket_name: bucket, age_days: 45 }
            );

            if (fetchError) {
                console.error(`[Cron Cleanup] Error querying ${bucket}:`, fetchError.message);
                report[bucket] = { ok: false, error: fetchError.message };
                continue;
            }

            if (!objects || objects.length === 0) {
                report[bucket] = { ok: true, deleted: 0 };
                continue;
            }

            // 2. Eliminar en lotes
            const batchSize = 100;
            let deletedCount = 0;
            let hasError = false;

            for (let i = 0; i < objects.length; i += batchSize) {
                const batch = objects.slice(i, i + batchSize).map(obj => obj.name);
                
                const { error: deleteError } = await supabase.storage
                    .from(bucket)
                    .remove(batch);

                if (deleteError) {
                    console.error(`[Cron Cleanup] Error removing batch in ${bucket}:`, deleteError.message);
                    hasError = true;
                } else {
                    deletedCount += batch.length;
                }
            }

            report[bucket] = { ok: !hasError, deleted: deletedCount };
        }

        return NextResponse.json({ ok: true, report });

    } catch (error) {
        console.error('[Cron Cleanup] Fatal error:', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal server error.' }, { status: 500 });
    }
}
