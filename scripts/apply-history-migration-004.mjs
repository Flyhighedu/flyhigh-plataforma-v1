import fs from 'fs';
import path from 'path';

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

function deriveProjectRef(url) {
    const match = (url || '').match(/^https:\/\/([^.]+)\.supabase\.co\/?$/i);
    return match ? match[1] : null;
}

function splitStatements(sqlText) {
    const statements = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < sqlText.length; i++) {
        const char = sqlText[i];
        const prev = i > 0 ? sqlText[i - 1] : '';

        if (char === "'" && !inDouble && prev !== '\\') {
            inSingle = !inSingle;
            current += char;
            continue;
        }

        if (char === '"' && !inSingle && prev !== '\\') {
            inDouble = !inDouble;
            current += char;
            continue;
        }

        if (char === ';' && !inSingle && !inDouble) {
            const statement = current.trim();
            if (statement) {
                statements.push(statement);
            }
            current = '';
            continue;
        }

        current += char;
    }

    const tail = current.trim();
    if (tail) statements.push(tail);

    return statements
        .map((statement) => statement.replace(/^\s*--.*$/gm, '').trim())
        .filter(Boolean);
}

async function run() {
    loadEnvLocal();

    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!projectUrl) {
        throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL.');
    }
    if (!accessToken) {
        throw new Error('Falta SUPABASE_ACCESS_TOKEN (Personal Access Token de Supabase).');
    }

    const projectRef = deriveProjectRef(projectUrl);
    if (!projectRef) {
        throw new Error('No se pudo derivar project ref desde NEXT_PUBLIC_SUPABASE_URL.');
    }

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '004_history_snapshot_and_soft_delete.sql');
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`No existe migracion esperada: ${migrationPath}`);
    }

    const sqlText = fs.readFileSync(migrationPath, 'utf8');
    const statements = splitStatements(sqlText);
    if (statements.length === 0) {
        throw new Error('La migracion no contiene sentencias SQL ejecutables.');
    }

    const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

    const applied = [];
    for (let i = 0; i < statements.length; i++) {
        const query = statements[i];

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        const text = await response.text();
        let payload;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch (_error) {
            payload = text;
        }

        if (!response.ok) {
            const preview = query.replace(/\s+/g, ' ').slice(0, 200);
            throw new Error(`Error en sentencia ${i + 1}/${statements.length}: ${preview}\nRespuesta API (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
        }

        applied.push({
            index: i + 1,
            sql_preview: query.replace(/\s+/g, ' ').slice(0, 140),
            response_status: response.status
        });
    }

    console.log(JSON.stringify({
        ok: true,
        project_ref: projectRef,
        migration: '004_history_snapshot_and_soft_delete.sql',
        statements_applied: applied.length,
        applied
    }, null, 2));
}

run().catch((error) => {
    console.error('Aplicacion de migracion 004 fallo:', error.message);
    process.exit(1);
});
