const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: closures } = await supabase
        .from('cierres_mision')
        .select('*')
        .eq('signature_url', 'SYSTEM_AUTO_RECOVERY');

    console.log(`Found ${closures.length} auto-recovered closures to fix.`);

    for (const c of closures) {
        if (!c.journey_id) {
            const { data: jData } = await supabase
                .from('staff_journeys')
                .select('id, school_id')
                .eq('id', c.mission_id)
                .single();

            if (jData) {
                const { error } = await supabase
                    .from('cierres_mision')
                    .update({ 
                        school_id: jData.school_id, 
                        journey_id: jData.id, 
                        mission_id: String(jData.school_id) 
                    })
                    .eq('id', c.id);

                if (error) {
                    console.error(`Error fixing closure ${c.id}:`, error);
                } else {
                    console.log(`Fixed closure ${c.id} to school ${jData.school_id}`);
                }
            } else {
                console.log(`Could not find journey for closure ${c.id} (mission_id: ${c.mission_id})`);
            }
        }
    }
}
run();
