import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/migrate-nivel-educativo
 *
 * One-shot migration:
 * 1) Adds `nivel_educativo` column to `catalogo_escuelas` (TEXT DEFAULT 'PRIMARIA')
 * 2) Tags all existing NULL rows as 'PRIMARIA'
 *
 * Safe to run multiple times — uses IF NOT EXISTS.
 */

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST() {
    try {
        const supabase = getAdminSupabase();

        // Step 1: Add column via RPC
        const { error: alterErr } = await supabase.rpc('exec_sql', {
            query: `ALTER TABLE catalogo_escuelas ADD COLUMN IF NOT EXISTS nivel_educativo TEXT DEFAULT 'PRIMARIA';`
        });

        if (alterErr) {
            console.error('[migrate] ALTER TABLE error:', alterErr);
            return NextResponse.json(
                { error: `Error al agregar columna: ${alterErr.message}` },
                { status: 500 }
            );
        }

        // Step 2: Tag existing rows that have NULL nivel_educativo
        const { data: updated, error: updateErr } = await supabase
            .from('catalogo_escuelas')
            .update({ nivel_educativo: 'PRIMARIA' })
            .is('nivel_educativo', null)
            .select('cct');

        if (updateErr) {
            console.warn('[migrate] Tag primarias warning:', updateErr.message);
        }

        return NextResponse.json({
            success: true,
            message: `✅ Migración completada. Columna nivel_educativo agregada. ${(updated || []).length} escuelas etiquetadas como PRIMARIA.`,
            tagged_count: (updated || []).length,
        });
    } catch (err) {
        console.error('[API] migrate-nivel-educativo error:', err);
        return NextResponse.json(
            { error: err.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
