import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllCampus() {
  let allSchools = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('intel_schools')
      .select('latitud, longitud, sostenimiento, nivel_educativo, nombre')
      .range(from, from + limit - 1);

    if (error) {
      console.error(error);
      return;
    }
    
    allSchools = allSchools.concat(data);
    from += limit;
    if (data.length < limit) hasMore = false;
  }

  console.log(`Fetched ${allSchools.length} total schools`);

  const groups = new Map();
  for (const s of allSchools) {
    if (s.latitud && s.longitud) {
      const key = `${s.latitud},${s.longitud}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
  }

  let publicCampusCount = 0;
  let privateCampusCount = 0;
  let multiLevelPublicCount = 0;
  let multiLevelPrivateCount = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      const isPublic = group.every(s => !s.sostenimiento || s.sostenimiento.toUpperCase() === 'PÚBLICO' || s.sostenimiento.toUpperCase() === 'PUBLICO');
      const isPrivate = group.every(s => s.sostenimiento && (s.sostenimiento.toUpperCase() === 'PRIVADO' || s.sostenimiento.toUpperCase() === 'PARTICULAR'));
      
      const levels = new Set(group.map(s => s.nivel_educativo));
      const hasMultiLevel = levels.size > 1;

      if (isPublic) {
        publicCampusCount++;
        if (hasMultiLevel) multiLevelPublicCount++;
      }
      if (isPrivate) {
        privateCampusCount++;
        if (hasMultiLevel) multiLevelPrivateCount++;
      }
    }
  }

  console.log(`Public groups (same location): ${publicCampusCount}`);
  console.log(`- of which have multiple levels: ${multiLevelPublicCount}`);
  console.log(`Private groups (same location): ${privateCampusCount}`);
  console.log(`- of which have multiple levels: ${multiLevelPrivateCount}`);
}

checkAllCampus();
