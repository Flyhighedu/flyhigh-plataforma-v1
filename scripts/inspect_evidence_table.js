const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Consultando staff_prep_photos...');
    const { data, error, count } = await supabase
        .from('staff_prep_photos')
        .select('file_path, created_at', { count: 'exact' })
        .limit(5);

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log(`✅ Registros encontrados (Total: ${count}):`, data);
    }
}
run();
