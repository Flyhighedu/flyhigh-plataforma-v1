const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: sponsors, error: err } = await supabase.from('patrocinadores').select('*').limit(1);
    console.log('Columns from select:', sponsors && sponsors.length ? Object.keys(sponsors[0]) : 'No rows');
    
    // check buckets
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Buckets:', buckets?.map(b => b.name));
}
check();
