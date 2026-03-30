require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  // Find teacher
  const { data: teachers } = await supabase.from('staff_profiles').select('*').eq('role', 'teacher').limit(1);
  if (!teachers || teachers.length === 0) { console.log('No teacher found'); return; }
  const teacherId = teachers[0].user_id;

  console.log(`Teacher: ${teachers[0].full_name} (${teacherId})`);

  // Get her checkins
  const { data: events } = await supabase.from('staff_prep_events')
    .select('created_at, event_type')
    .eq('user_id', teacherId)
    .eq('event_type', 'checkin')
    .order('created_at', { ascending: false });

  // Get total unique days
  const checkins = events || [];
  const uniqueDays = new Set(checkins.map(e => new Date(e.created_at).toDateString()));

  console.log(`Found ${checkins.length} checkins across ${uniqueDays.size} unique days.`);
  console.log(Array.from(uniqueDays));

  // Let's see if she has closures where she didn't check in
  // Wait, prep_complete instead of checkin?
  const { data: prepEvents } = await supabase.from('staff_prep_events')
    .select('created_at, event_type')
    .eq('user_id', teacherId)
    .order('created_at', { ascending: false });

  const prepUniqueDays = new Set((prepEvents||[]).map(e => new Date(e.created_at).toDateString()));
  console.log(`Total days with ANY prep event: ${prepUniqueDays.size}`);
}

investigate();
