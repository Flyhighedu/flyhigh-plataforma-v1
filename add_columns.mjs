import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      ALTER TABLE crm_contacts 
      ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reminder_note TEXT;
    `
  });
  
  if (error) {
     console.error("RPC failed, trying raw query...", error);
     // If RPC is missing, Supabase JS doesn't have a direct raw query executor, so I should just use HTTP or rely on the user having the tables migrated.
  } else {
     console.log("Success add columns", data);
  }
}
run();
