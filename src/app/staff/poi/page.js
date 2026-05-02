'use client';

import { useState, useEffect } from 'react';
import POIMapEditor from '@/components/staff/POIMapEditor';
import { createClient } from '@/utils/supabase/client';

export default function POIPage() {
    const [profile, setProfile] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        async function loadProfile() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('staff_profiles')
                        .select('user_id, full_name, role')
                        .eq('user_id', user.id)
                        .single();
                    setProfile(data);
                }
            } catch (err) {
                console.warn('Profile load error:', err);
            } finally {
                setReady(true);
            }
        }
        loadProfile();
    }, []);

    if (!ready) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#0F172A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16
            }}>
                <div style={{ fontSize: 48 }}>📍</div>
                <p style={{ color: '#94A3B8', fontSize: 14, fontWeight: 600 }}>Cargando...</p>
            </div>
        );
    }

    return (
        <POIMapEditor
            isOpen={true}
            onClose={() => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/staff/dashboard';
                }
            }}
            profile={profile}
        />
    );
}
