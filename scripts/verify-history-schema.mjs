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

const REQUIRED = {
    cierres_mision: ['school_id', 'school_name_snapshot', 'mission_datetime'],
    proximas_escuelas: ['is_archived', 'archived_at']
};

async function run() {
    loadEnvLocal();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
        throw new Error('Faltan variables NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const tableErrors = {};
    const missing = [];

    for (const [table, columns] of Object.entries(REQUIRED)) {
        tableErrors[table] = [];

        for (const column of columns) {
            const { error } = await supabase.from(table).select(`id,${column}`).limit(1);
            if (error) {
                tableErrors[table].push(error.message);
                if (error.message.includes(`column ${table}.${column} does not exist`)) {
                    missing.push({ table, column });
                }
            }
        }

        if (tableErrors[table].length === 0) {
            tableErrors[table] = null;
        }
    }

    console.log(JSON.stringify({
        ok: missing.length === 0,
        required_tables: Object.keys(REQUIRED),
        table_errors: tableErrors,
        missing
    }, null, 2));

    if (missing.length > 0) {
        process.exitCode = 1;
    }
}

run().catch((error) => {
    console.error('Verificacion de schema historico fallo:', error.message);
    process.exitCode = 1;
});
