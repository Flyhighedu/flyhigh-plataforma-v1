import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const t1 = await supabase.from('catalogo_escuelas').select('*').limit(1);
  console.log("columns:", Object.keys(t1.data[0]));
}
check();
