
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
console.log(`Reading env from: ${envPath}`);

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
        }
    });

    const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: missing Supabase credentials in .env.local');
        process.exit(1);
    }

    console.log('Supabase URL:', supabaseUrl);
    // console.log('Supabase Key:', supabaseKey); // Don't print secret

    const supabase = createClient(supabaseUrl, supabaseKey);

    async function checkTable(tableName) {
        console.log(`\n--- Checking table: "${tableName}" ---`);
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (error) {
            console.error(`Error querying "${tableName}":`, error.message);
            if (error.code) console.error(`Error code: ${error.code}`);
        } else {
            console.log(`Success! Found ${data.length} rows.`);
            if (data.length > 0) {
                console.log('Row 0 keys:', Object.keys(data[0]));
                console.log('Row 0 data:', data[0]);
            } else {
                console.log('Table is empty.');
            }
        }
    }

    // Run checks
    (async () => {
        await checkTable('impacto_global');
        await checkTable('estadísticas');
        await checkTable('estadísticas del panel de patrocinadores');
    })();

} catch (err) {
    console.error('Error reading .env.local or executing script:', err);
}
