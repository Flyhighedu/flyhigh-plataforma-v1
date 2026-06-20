const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Listando archivos en staff-arrival...');
    const { data, error } = await supabase.storage
        .from('staff-arrival')
        .list('', { limit: 1 });

    if (error) {
        console.error('❌ Error de Storage:', error.message);
    } else {
        console.log('✅ Éxito de Storage:', data);
    }
}
run();
