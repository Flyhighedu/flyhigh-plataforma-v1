const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { readEnv, validateEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');
async function migrateSchoolLocations(input = readEnv(path.join(root, '.env.review.local'))) {
    validateEnvironment(input, readEnv(path.join(root, '.env.local')));
    // No remote URI parameter: this tool cannot target production.
    const db = new Client({ host: '127.0.0.1', port: 54322, database: 'postgres', user: 'postgres', password: 'postgres', connectionTimeoutMillis: 5000 });
    await db.connect();
    try {
        await db.query('BEGIN');
        await db.query(fs.readFileSync(path.join(__dirname, 'school-locations.sql'), 'utf8'));
        await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { await db.end(); }
}
if (require.main === module) migrateSchoolLocations().then(() => console.log('Ubicaciones habilitadas solo en Supabase local.')).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrateSchoolLocations };
