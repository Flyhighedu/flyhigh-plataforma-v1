import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export const usePresence = (journeyId, userId, role) => {
    useEffect(() => {
        if (!journeyId || !userId) return;

        const supabase = createClient();
        const channel = supabase.channel(`presence_${journeyId}`);

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                console.log('Online users:', newState);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const status = await channel.track({
                        user_id: userId,
                        role: role,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        // Also update the database table for persistent tracking
        const heartbeatInterval = setInterval(async () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                await supabase
                    .from('staff_presence')
                    .upsert({
                        user_id: userId,
                        journey_id: journeyId,
                        role: role,
                        last_seen_at: new Date().toISOString(),
                        is_online: true
                    }, { onConflict: 'user_id' });
            }
        }, 30000); // 30 seconds

        return () => {
            channel.unsubscribe();
            clearInterval(heartbeatInterval);
        };
    }, [journeyId, userId, role]);
};
