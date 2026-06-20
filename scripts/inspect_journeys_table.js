const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Consultando staff_journeys...');
    const { data, error, count } = await supabase
        .from('staff_journeys')
        .select('arrival_photo_url, created_at')
        .not('arrival_photo_url', 'is', null)
        .limit(5);

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log(`✅ Registros encontrados:`, data);
    }
}
run();
