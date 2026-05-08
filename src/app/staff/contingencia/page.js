'use client';

// ═══════════════════════════════════════════════════════════════════
// /staff/contingencia — Ruta Aislada de Contingencia
// Bypasses the entire dashboard state machine.
// Connects to the same Supabase tables for real-time data.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import StaffOperationLegacy from '@/components/staff/StaffOperationLegacy';
import OperationPanelConstructionScreen from '@/components/staff/OperationPanelConstructionScreen';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { Loader2, AlertCircle, ShieldAlert, X } from 'lucide-react';

function safeParseJson(value, fallback = null) {
    try {
        if (!value) return fallback;
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (_e) {
        return fallback;
    }
}

export default function ContingenciaPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profile, setProfile] = useState(null);
    const [userId, setUserId] = useState(null);
    const [journeyId, setJourneyId] = useState(null);
    const [missionInfo, setMissionInfo] = useState(null);

    // ── 1. Initialize: auth + journey from localStorage ──
    useEffect(() => {
        const init = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    router.push('/staff/login');
                    return;
                }
                setUserId(user.id);

                // Fetch profile
                const { data: profileData, error: profileError } = await supabase
                    .from('staff_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (profileError || !profileData || !profileData.is_active) {
                    setError('Perfil no encontrado o inactivo.');
                    setLoading(false);
                    return;
                }

                // Normalize auxiliar → assistant
                if (profileData.role === 'auxiliar') {
                    profileData.role = 'assistant';
                }
                setProfile(profileData);

                // Read journey from localStorage
                const savedMission = safeParseJson(localStorage.getItem('flyhigh_staff_mission'));
                const savedMissionId = localStorage.getItem('flyhigh_selected_mission_id');

                if (!savedMission && !savedMissionId) {
                    setError('No hay misión activa. Regresa al dashboard primero.');
                    setLoading(false);
                    return;
                }

                // Try to find the journey
                const schoolId = savedMission?.id || savedMissionId;
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

                const { data: journey } = await supabase
                    .from('staff_journeys')
                    .select('*')
                    .eq('date', today)
                    .eq('school_id', schoolId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (!journey) {
                    setError('No se encontró una jornada activa para hoy.');
                    setLoading(false);
                    return;
                }

                setJourneyId(journey.id);
                setMissionInfo({
                    ...savedMission,
                    ...journey,
                    school_name: journey.school_name || savedMission?.school_name || 'Escuela'
                });

                setLoading(false);
            } catch (e) {
                console.error('Contingencia init error:', e);
                setError('Error al inicializar contingencia.');
                setLoading(false);
            }
        };
        init();
    }, [router]);

    // ── 2. Realtime listener for closure detection ──
    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();

        const channel = supabase
            .channel(`contingencia-${journeyId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'staff_journeys', filter: `id=eq.${journeyId}` },
                (payload) => {
                    const newStatus = payload.new?.status;
                    const newMeta = typeof payload.new?.meta === 'string'
                        ? safeParseJson(payload.new.meta) : (payload.new?.meta || {});

                    // If journey was closed (by this or another device), redirect to dashboard
                    if (newStatus === 'closed' || newStatus === 'completada' || newStatus === 'cerrada') {
                        console.log('📦 Journey closed. Cleaning state and redirecting...');
                        
                        // Clear all mission-related local storage to avoid loops
                        localStorage.removeItem('flyhigh_staff_mission');
                        localStorage.removeItem('flyhigh_selected_mission_id');
                        localStorage.removeItem('flyhigh_active_journey_id');
                        localStorage.removeItem('flyhigh_active_flight');
                        localStorage.removeItem('flyhigh_flight_logs');
                        localStorage.removeItem('flyhigh_recently_closed_flights');
                        
                        // Force hard redirect to history
                        window.location.href = '/staff/dashboard?tab=history';
                    }

                    // Update mission info with latest data
                    if (payload.new) {
                        setMissionInfo(prev => ({
                            ...prev,
                            ...payload.new,
                            meta: newMeta
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [journeyId]);


    // ── Render: Loading ──
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-red-500 animate-spin mx-auto" />
                    <p className="text-slate-500 font-medium">Cargando modo contingencia...</p>
                </div>
            </div>
        );
    }

    // ── Render: Error ──
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
                <div className="max-w-sm text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <button
                        onClick={() => router.push('/staff/dashboard')}
                        className="text-sm text-blue-500 underline"
                    >
                        Volver al dashboard
                    </button>
                </div>
            </div>
        );
    }


    const isTeacher = profile?.role === 'teacher';
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';
    const firstName = (profile?.full_name || 'Operativo').split(/\s+/)[0];

    // ── Render: Teacher → StaffOperationLegacy (full flight panel) ──
    if (isTeacher) {
        return (
            <div className="relative min-h-screen">
                {/* Contingency Banner */}
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                    padding: '6px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                    <ShieldAlert size={14} color="white" />
                    <span style={{ color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
                        MODO CONTINGENCIA
                    </span>
                </div>

                {/* Spacer for banner */}
                <div style={{ height: 30 }} />

                <StaffOperationLegacy
                    initialMission={missionInfo}
                    onCloseDay={null}
                    hideMenu={false}
                    useSyncHeader={true}
                    journeyId={journeyId}
                    userId={userId}
                    profile={profile}
                    missionState="OPERATION"
                    onRefresh={null}
                />
            </div>
        );
    }

    // ── Render: Pilot / Assistant → OperationPanelConstructionScreen ──
    return (
        <div className="relative min-h-screen">
            {/* Contingency Banner */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                padding: '6px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
                <ShieldAlert size={14} color="white" />
                <span style={{ color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
                    MODO CONTINGENCIA
                </span>
            </div>

            {/* Spacer for banner */}
            <div style={{ height: 30 }} />

            <OperationPanelConstructionScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={missionInfo}
                missionState="OPERATION"
                onRefresh={null}
            />
        </div>
    );
}
