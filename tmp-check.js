const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const out = {};
  const { data: journeys, error } = await supabase
    .from('staff_journeys')
    .select('id, school_name, cct, status')
    .ilike('school_name', '%Zaragoza%');

  if (error) {
    console.error('Error fetching journey:', error);
    return;
  }
  
  out.journeys = journeys;

  for (const j of journeys) {
    const { data: vuelos } = await supabase
      .from('bitacora_vuelos')
      .select('id, student_count')
      .eq('journey_id', j.id);
      
    j.vuelos_count = vuelos?.length || 0;
    if (vuelos) {
        let sum = 0;
        vuelos.forEach(v => sum += (Number(v.student_count) || 0));
        j.vuelos_sum_students = sum;
    }

    const { data: cierre } = await supabase
      .from('cierres_mision')
      .select('*')
      .eq('journey_id', j.id);
    j.cierre = cierre;
  }
  
  fs.writeFileSync('tmp-out.json', JSON.stringify(out, null, 2));
  console.log('Wrote tmp-out.json');
}

check();
