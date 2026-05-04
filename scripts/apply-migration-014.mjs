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
        if (!process.env[key]) process.env[key] = value;
    }
}

function deriveProjectRef(url) {
    const match = (url || '').match(/^https:\/\/([^.]+)\.supabase\.co\/?$/i);
    return match ? match[1] : null;
}

async function run() {
    loadEnvLocal();

    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!projectUrl) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL.');
    if (!accessToken) throw new Error('Falta SUPABASE_ACCESS_TOKEN (Personal Access Token de Supabase). Configúralo como variable de entorno del sistema.');

    const projectRef = deriveProjectRef(projectUrl);
    if (!projectRef) throw new Error('No se pudo derivar project ref.');

    const query = `
        ALTER TABLE public.pilot_pois
        ADD COLUMN IF NOT EXISTS dato_clave_1 TEXT,
        ADD COLUMN IF NOT EXISTS dato_clave_2 TEXT,
        ADD COLUMN IF NOT EXISTS pregunta_interaccion TEXT,
        ADD COLUMN IF NOT EXISTS research_article TEXT;
    `;

    const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

    console.log(`Aplicando migración 014 al proyecto ${projectRef}...`);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`API respondió ${response.status}: ${text}`);
    }

    console.log('✅ Migración 014 aplicada con éxito!');
    console.log('Columnas añadidas: dato_clave_1, dato_clave_2, pregunta_interaccion, research_article');
}

run().catch(err => {
    console.error('❌ Error:', err.message);
    console.log('\nAlternativa: ejecuta este SQL manualmente en el Supabase SQL Editor:');
    console.log(`
ALTER TABLE public.pilot_pois
  ADD COLUMN IF NOT EXISTS dato_clave_1 TEXT,
  ADD COLUMN IF NOT EXISTS dato_clave_2 TEXT,
  ADD COLUMN IF NOT EXISTS pregunta_interaccion TEXT,
  ADD COLUMN IF NOT EXISTS research_article TEXT;
    `);
    process.exit(1);
});
