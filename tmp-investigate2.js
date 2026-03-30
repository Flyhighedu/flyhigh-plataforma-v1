const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  const { data: teachers } = await supabase.from('staff_profiles').select('*').eq('role', 'teacher').limit(1);
  if (!teachers || teachers.length === 0) return;
  const teacherId = teachers[0].user_id;

  const { data: events } = await supabase.from('staff_prep_events')
    .select('created_at, event_type')
    .eq('user_id', teacherId)
    .eq('event_type', 'checkin');
    
  const checkins = events || [];
  const uniqueDays = new Set(checkins.map(e => new Date(e.created_at).toDateString()));

  const { data: prepEvents } = await supabase.from('staff_prep_events')
    .select('created_at, event_type')
    .eq('user_id', teacherId);

  const prepUniqueDays = new Set((prepEvents||[]).map(e => new Date(e.created_at).toDateString()));
  
  const result = {
    teacher: teachers[0].full_name,
    checkins_count: checkins.length,
    unique_checkin_days: Array.from(uniqueDays).length,
    dates: Array.from(uniqueDays),
    total_prep_days: Array.from(prepUniqueDays).length,
    all_prep_dates: Array.from(prepUniqueDays)
  };
  
  fs.writeFileSync('C:\\Users\\jd9\\Documents\\NewFlyHigh\\web\\investigation-result.json', JSON.stringify(result, null, 2));
}
investigate();
