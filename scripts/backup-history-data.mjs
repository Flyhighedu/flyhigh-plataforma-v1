import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

async function fetchAllRows(supabase, tableName) {
    const pageSize = 1000;
    let from = 0;
    let allRows = [];

    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = data || [];
        allRows = allRows.concat(rows);

        if (rows.length < pageSize) break;
        from += pageSize;
    }

    return allRows;
}

function stableHash(value) {
    const json = JSON.stringify(value);
    return crypto.createHash('sha256').update(json).digest('hex');
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupsDir = path.join(process.cwd(), 'backups');
    const outputDir = path.join(backupsDir, `history-backup-${timestamp}`);

    fs.mkdirSync(outputDir, { recursive: true });

    const manifest = {
        created_at: new Date().toISOString(),
        project_url: supabaseUrl,
        tables: {}
    };

    for (const table of tables) {
        const rows = await fetchAllRows(supabase, table);
        const fileName = `${table}.json`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');

        manifest.tables[table] = {
            file: fileName,
            row_count: rows.length,
            sha256: stableHash(rows)
        };

        console.log(`${table}: ${rows.length} registros`);
    }

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log('');
    console.log(`Backup histórico exportado en: ${outputDir}`);
    console.log(`Manifest: ${manifestPath}`);
}

run().catch((error) => {
    console.error('Error generando backup histórico:', error.message);
    process.exit(1);
});
