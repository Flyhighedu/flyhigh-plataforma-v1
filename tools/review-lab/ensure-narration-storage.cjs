const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { readEnv, validateEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');

async function ensureNarrationStorage(input = readEnv(path.join(root, '.env.review.local'))) {
    validateEnvironment(input, readEnv(path.join(root, '.env.local')));
    const client = createClient(input.NEXT_PUBLIC_SUPABASE_URL, input.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.storage.listBuckets();
    if (error) throw error;
    if (data.some(bucket => bucket.id === 'poi-narratives')) return;
    const created = await client.storage.createBucket('poi-narratives', { public: true, fileSizeLimit: 50 * 1024 * 1024, allowedMimeTypes: ['audio/wav'] });
    if (created.error) throw created.error;
}
if (require.main === module) ensureNarrationStorage().then(() => console.log('Almacenamiento de narraciones listo en la base local.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { ensureNarrationStorage };
