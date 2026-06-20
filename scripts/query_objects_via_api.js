const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        db: { schema: 'storage' },
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Consultando storage.objects...');
    const { data, error } = await supabase
        .from('objects')
        .select('id, name, bucket_id, created_at')
        .in('bucket_id', ['staff-arrival', 'prep-evidence', 'staff-telemetry'])
        .limit(5);

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Éxito:', data);
    }
}
run();
