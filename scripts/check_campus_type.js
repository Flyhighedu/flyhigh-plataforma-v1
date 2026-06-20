import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCampus() {
  const { data: schools, error } = await supabase
    .from('intel_schools')
    .select('latitud, longitud, sostenimiento');

  if (error) {
    console.error('Error fetching schools:', error);
    return;
  }

  console.log(`Fetched ${schools.length} schools`);

  const groups = new Map();
  for (const s of schools) {
    if (s.latitud && s.longitud) {
      const key = `${s.latitud},${s.longitud}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
  }

  let publicCampusCount = 0;
  let privateCampusCount = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      // It's a candidate for campus
      const allPublic = group.every(s => !s.sostenimiento || s.sostenimiento.toUpperCase() === 'PÚBLICO' || s.sostenimiento.toUpperCase() === 'PUBLICO');
      const allPrivate = group.every(s => s.sostenimiento && (s.sostenimiento.toUpperCase() === 'PRIVADO' || s.sostenimiento.toUpperCase() === 'PARTICULAR'));
      
      if (allPublic) publicCampusCount++;
      if (allPrivate) privateCampusCount++;
    }
  }

  console.log(`Public Campus Locations: ${publicCampusCount}`);
  console.log(`Private Campus Locations: ${privateCampusCount}`);
}

checkCampus();
