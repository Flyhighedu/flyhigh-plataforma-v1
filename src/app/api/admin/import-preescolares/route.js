import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Server-side Supabase client with Service Role Key — bypasses RLS
function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * POST /api/admin/import-preescolares
 * 
 * One-shot migration endpoint:
 * 1) Adds `nivel_educativo` column to `catalogo_escuelas` if it doesn't exist
 * 2) Tags all existing rows (primarias) with nivel_educativo = 'PRIMARIA'
 * 3) Parses the CSV from public/ and bulk-inserts preescolares
 * 
 * Idempotent: skips rows whose CCT already exists.
 */
export async function POST(request) {
    try {
        const supabase = getAdminSupabase();

        // ── Step 1: Add nivel_educativo column if missing ──
        // Using raw SQL via rpc (or catch error if column exists)
        try {
            await supabase.rpc('exec_sql', {
                query: `ALTER TABLE catalogo_escuelas ADD COLUMN IF NOT EXISTS nivel_educativo TEXT DEFAULT 'PRIMARIA';`
            });
        } catch (rpcErr) {
            // If rpc 'exec_sql' doesn't exist, try direct approach
            // The column might already exist — we'll handle this gracefully
            console.warn('[import-preescolares] RPC exec_sql not available, column may already exist:', rpcErr.message);
        }

        // ── Step 2: Tag existing primarias ──
        // Only update rows that have NULL nivel_educativo
        const { error: tagErr } = await supabase
            .from('catalogo_escuelas')
            .update({ nivel_educativo: 'PRIMARIA' })
            .is('nivel_educativo', null);

        if (tagErr) {
            console.warn('[import-preescolares] Tagging primarias warning:', tagErr.message);
        }

        // ── Step 3: Parse CSV ──
        const csvPath = join(process.cwd(), 'public', 'concentrado_Preescolares upn(in).csv');
        let csvContent;
        try {
            csvContent = readFileSync(csvPath, 'utf-8');
        } catch (fileErr) {
            return NextResponse.json(
                { error: `No se pudo leer el archivo CSV: ${fileErr.message}. Asegúrate de que existe en web/public/` },
                { status: 400 }
            );
        }

        const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
        
        // CSV column mapping (semicolon-separated):
        // 0: CCT, 2: Turno, 3: Nombre, 8: Tipo de sostenimiento, 22: C.P., 26: Alumnos total
        const rows = [];
        const skippedCCTs = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            const cct = (cols[0] || '').trim();
            
            // Skip footer rows and non-school lines
            if (!cct || !cct.match(/^\d{2}[A-Z]/)) continue;

            const nombre = (cols[3] || '').trim();
            const turno = (cols[2] || '').trim();
            const tipo = (cols[8] || '').trim(); // PRIVADO, FEDERAL TRANSFERIDO, ESTATAL
            const codigoPostal = (cols[22] || '').trim();
            const alumnosStr = (cols[26] || '').trim();
            const alumnos = alumnosStr ? parseInt(alumnosStr) : null;

            rows.push({
                cct,
                nombre_escuela: nombre,
                turno: turno || null,
                tipo: tipo || null,
                codigo_postal: codigoPostal || null,
                ninos: isNaN(alumnos) ? null : alumnos,
                nivel_educativo: 'PREESCOLAR',
                estado_pipeline: 'sin_contacto',
            });
        }

        if (rows.length === 0) {
            return NextResponse.json(
                { error: 'No se encontraron filas de datos válidas en el CSV' },
                { status: 400 }
            );
        }

        // ── Step 4: Check for existing CCTs to avoid duplicates ──
        const allCCTs = rows.map(r => r.cct);
        const { data: existing } = await supabase
            .from('catalogo_escuelas')
            .select('cct')
            .in('cct', allCCTs);

        const existingSet = new Set((existing || []).map(e => e.cct));
        const newRows = rows.filter(r => {
            if (existingSet.has(r.cct)) {
                skippedCCTs.push(r.cct);
                return false;
            }
            return true;
        });

        // ── Step 5: Bulk insert ──
        let insertedCount = 0;
        let errors = [];

        if (newRows.length > 0) {
            // Insert in batches of 50 to avoid payload limits
            const BATCH_SIZE = 50;
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const batch = newRows.slice(i, i + BATCH_SIZE);
                const { data: inserted, error: insErr } = await supabase
                    .from('catalogo_escuelas')
                    .insert(batch)
                    .select('cct');

                if (insErr) {
                    errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insErr.message}`);
                } else {
                    insertedCount += (inserted || []).length;
                }
            }
        }

        return NextResponse.json({
            success: true,
            summary: {
                total_csv_rows: rows.length,
                inserted: insertedCount,
                skipped_duplicates: skippedCCTs.length,
                skipped_ccts: skippedCCTs.slice(0, 10), // Show first 10 for debugging
                errors: errors.length > 0 ? errors : null,
            },
            message: `✅ ${insertedCount} preescolares importados exitosamente. ${skippedCCTs.length} duplicados omitidos.`,
        });
    } catch (err) {
        console.error('[API] import-preescolares error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
