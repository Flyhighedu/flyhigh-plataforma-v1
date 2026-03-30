import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('staff_prep_events')
    .select(`
      id, 
      created_at, 
      journey_id, 
      staff_journeys(*)
    `)
    .in('journey_id', ['023e46c0-c0b0-4040-9278-c87e3ffbffed', '149c108c-a6e1-49f0-86b3-df1874aa2030'])
    .limit(2);

  if (error) {
     console.error("Error querying:", error.message);
     return;
  }
  
  fs.writeFileSync('audit_mar5_journeys.json', JSON.stringify(data, null, 2), 'utf8');
  console.log('Saved to audit_mar5_journeys.json');
}

run();
