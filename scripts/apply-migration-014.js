const { Client } = require('pg');

async function run() {
    // Try direct connection (port 5432, session mode)
    const client = new Client({
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 5432,
        database: 'postgres',
        user: 'postgres.sbzwffqhzmlxtnjyjduk',
        password: process.env.SUPABASE_DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('Connected to Supabase Postgres');
        
        // Apply migration
        await client.query(`
            ALTER TABLE public.pilot_pois
            ADD COLUMN IF NOT EXISTS dato_clave_1 TEXT,
            ADD COLUMN IF NOT EXISTS dato_clave_2 TEXT,
            ADD COLUMN IF NOT EXISTS pregunta_interaccion TEXT,
            ADD COLUMN IF NOT EXISTS research_article TEXT;
        `);
        console.log('Migration 014 applied successfully!');
        
        // Verify
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pilot_pois' 
            AND column_name IN ('dato_clave_1', 'dato_clave_2', 'pregunta_interaccion', 'research_article')
            ORDER BY column_name;
        `);
        console.log('Verified columns:', result.rows);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
