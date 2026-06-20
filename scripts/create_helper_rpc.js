const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Conectando a Supabase...');

    const query = `
CREATE OR REPLACE FUNCTION public.get_expired_storage_objects(bucket_name text, age_days int)
RETURNS TABLE(name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT name FROM storage.objects
    WHERE bucket_id = bucket_name
      AND created_at < NOW() - (age_days || ' days')::interval;
$$;
    `;

    console.log('Ejecutando SQL para crear get_expired_storage_objects...');
    const { data, error } = await supabase.rpc('exec_sql', { query });

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Función get_expired_storage_objects creada con éxito en el esquema public.');
    }
}
run();
