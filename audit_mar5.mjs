import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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
      user_id,
      created_at, 
      event_type, 
      journey_id, 
      staff_journeys(id, school_name)
    `)
    .gte('created_at', '2026-03-05T00:00:00.000Z')
    .lte('created_at', '2026-03-12T00:00:00.000Z')
    .order('created_at', { ascending: false });

  if (error) {
     console.error("Error querying:", error.message);
     return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

run();
