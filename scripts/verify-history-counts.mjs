import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

async function getCount(supabase, tableName) {
    const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
}

async function run() {
    loadEnvLocal();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
        throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en entorno.');
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const tables = [
        'cierres_mision',
        'bitacora_vuelos',
        'bitacora_pausas',
        'proximas_escuelas',
        'staff_journeys'
    ];

    const backupDirArg = process.argv[2];
    let expected = null;

    if (backupDirArg) {
        const manifestPath = path.join(process.cwd(), backupDirArg, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`No existe manifest en: ${manifestPath}`);
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        expected = manifest.tables || null;
    }

    const report = [];
    for (const table of tables) {
        const current = await getCount(supabase, table);
        const previous = expected?.[table]?.row_count ?? null;

        report.push({
            table,
            previous,
            current,
            matches: previous === null ? null : previous === current
        });
    }

    console.log(JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 2));
}

run().catch((error) => {
    console.error('Error verificando conteos históricos:', error.message);
    process.exit(1);
});
