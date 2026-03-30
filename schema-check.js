const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
async function run() {
  // Let's get the 5 most recent records in proximas_escuelas to see columns and data
  const { data, error } = await supabase.from('proximas_escuelas').select('*').limit(5).order('id', {ascending: false});
  console.log('--- PROXIMAS ESCUELAS ---');
  if (error) console.error(error);
  else console.dir(data, { depth: null });

  // And let's check a bit of staff_journeys
  const { data: journeys } = await supabase.from('staff_journeys').select('*').limit(1).order('created_at', {ascending: false});
  console.log('\n--- STAFF JOURNEYS ---');
  console.dir(journeys, { depth: null });
}
run();
