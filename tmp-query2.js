require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching staff prep events...');
  const { data: events, error } = await supabase
    .from('staff_prep_events')
    .select('created_at, event_type')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) console.error('Error:', error);
  else console.log('Last 5 events:', events);

  console.log('\nFetching staff profiles to check if phone exists...');
  const { data: profiles, error: pError } = await supabase
    .from('staff_profiles')
    .select('*')
    .limit(1);
    
  if (pError) console.error('Profiles Error:', pError);
  else console.log('Profiles structure:', profiles);
}

run();
