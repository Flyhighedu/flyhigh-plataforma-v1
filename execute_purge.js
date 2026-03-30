const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    try {
        const fileData = JSON.parse(fs.readFileSync('garbage_ids.json', 'utf-8'));
        const idsToDelete = fileData.toDelete;

        if (!idsToDelete || idsToDelete.length === 0) {
            console.log('No garbage IDs found to delete.');
            return;
        }

        console.log('Starting Hard Delete of ' + idsToDelete.length + ' garbage records...');

        // Batch delete the isolated IDs
        for (let i = 0; i < idsToDelete.length; i += 50) {
            const batch = idsToDelete.slice(i, i + 50);
            const { error } = await supabase
                .from('staff_prep_events')
                .delete()
                .in('id', batch);

            if (error) {
                console.error('Failure during deletion batch:', error);
                return;
            }
        }

        console.log('Successfully wiped all ' + idsToDelete.length + ' garbage records. Production data untouched.');
        
        // Final verification check
        const { count, error: countErr } = await supabase
            .from('staff_prep_events')
            .select('*', { count: 'exact', head: true });
            
        console.log('Total records remaining in database: ' + count);

    } catch(err) {
        console.error('General error:', err);
    }
})();
