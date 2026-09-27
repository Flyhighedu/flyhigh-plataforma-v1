const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { readEnv, validateEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');

async function migratePreparations(input = readEnv(path.join(root, '.env.review.local'))) {
    validateEnvironment(input, readEnv(path.join(root, '.env.local')));
    // Fixed loopback database, never a connection string from production.
    const client = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });
    await client.connect();
    try {
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(root, 'supabase/migrations/20260925120000_visit_narration_plans.sql'), 'utf8'));
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); }
}
if (require.main === module) migratePreparations().then(() => console.log('Preparación de visitas habilitada en Supabase local.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migratePreparations };
