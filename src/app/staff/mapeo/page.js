'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import TacticalMapScreen from '@/components/staff/TacticalMapScreen';

export default function MapeoTacticoPage() {
    const router = useRouter();
    const [userId, setUserId] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [unauthorized, setUnauthorized] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function init() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.replace('/staff/login'); return; }

                const { data: prof } = await supabase
                    .from('staff_profiles')
                    .select('full_name, role, avatar_config')
                    .eq('user_id', user.id)
                    .single();

                if (cancelled) return;

                // Role guard: only pilots
                if (prof?.role !== 'pilot') {
                    setUnauthorized(true);
                    setLoading(false);
                    return;
                }

                setUserId(user.id);
                setProfile(prof);
            } catch (err) {
                console.error('MapeoTactico init error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        init();
        return () => { cancelled = true; };
    }, [router]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
                <Loader2 size={32} style={{ color: '#06B6D4', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (unauthorized) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0F172A', padding: 24, textAlign: 'center' }}>
                <ShieldAlert size={48} style={{ color: '#EF4444', marginBottom: 16 }} />
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#F1F5F9', margin: '0 0 8px' }}>Acceso Restringido</h2>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px' }}>Esta función está disponible exclusivamente para Pilotos.</p>
                <button onClick={() => router.back()} style={{
                    padding: '12px 28px', borderRadius: 14, background: '#06B6D4', color: 'white',
                    border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer'
                }}>
                    Volver
                </button>
            </div>
        );
    }

    return <TacticalMapScreen userId={userId} profile={profile} />;
}
