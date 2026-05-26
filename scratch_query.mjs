import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Helper to normalize commands exactly like useVoiceCopilot
function normalizeCommand(text) {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .join(' ') || text.toLowerCase().trim().split(/\s+/)[0] || '';
}

const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
    if (parts) {
        let key = parts[1];
        let val = parts[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
        }
        env[key] = val;
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: pois, error } = await supabase
        .from('master_route_pois')
        .select('id, name, audio_url');

    if (error) {
        console.error(error);
        return;
    }

    console.log('ALL POIs with their normalized keywords:');
    pois.forEach(p => {
        const norm = normalizeCommand(p.name);
        const kws = norm.split(' ').filter(Boolean);
        console.log(`- "${p.name}" -> Keywords: ${JSON.stringify(kws)} (Has Audio: ${!!p.audio_url})`);
    });
}

run();
