import { createClient } from '@/utils/supabase/client';

export const TEST_JOURNEY_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const TEST_SCHOOL_ID = 999999; // BigInt, not UUID

export const ensureTestJourney = async (userId, role) => {
    try {
        const response = await fetch('/api/test/ensure-journey', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ journeyId: TEST_JOURNEY_ID, userId, role }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Error creating Test Journey (API):', error);
            return null;
        }

        const data = await response.json();
        console.log('✅ Test Journey verified (API):', data);
        return data.journey;
    } catch (e) {
        console.error('❌ Network error creating Test Journey:', e);
        return null;
    }
};

export const resetTestJourney = async () => {
    const supabase = createClient();

    // Clean prep events
    await supabase
        .from('staff_prep_events')
        .delete()
        .eq('journey_id', TEST_JOURNEY_ID);

    // Clean prep photos (evidence)
    await supabase
        .from('staff_prep_photos')
        .delete()
        .eq('journey_id', TEST_JOURNEY_ID);

    // Clean staff events (stage transitions)
    await supabase
        .from('staff_events')
        .delete()
        .eq('journey_id', TEST_JOURNEY_ID);

    // Clean presence (so roles reset to offline)
    await supabase
        .from('staff_presence')
        .delete()
        .eq('journey_id', TEST_JOURNEY_ID);

    // Clean flight logs for this test journey
    await supabase
        .from('bitacora_vuelos')
        .delete()
        .eq('journey_id', TEST_JOURNEY_ID);

    // Reset journey state
    await supabase
        .from('staff_journeys')
        .update({
            mission_state: 'PILOT_PREP',
            status: 'operation',
            meta: {},
            updated_at: new Date().toISOString()
        })
        .eq('id', TEST_JOURNEY_ID);
};
