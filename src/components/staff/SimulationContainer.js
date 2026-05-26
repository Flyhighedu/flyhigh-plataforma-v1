'use client';

// =====================================================
// SimulationContainer.js — Mock Smart Container
// =====================================================
// This is the "smart" container for the SIMULATION mode.
// It provides mock handlers that mimic the production
// flight operation without ANY real Supabase calls.
//
// ⚠️ SECURITY: This file MUST NEVER import:
//   - createClient (Supabase)
//   - syncFlightLog, syncPauseStart, syncPauseEnd
//   - Any real data persistence utility
//
// All state is ephemeral (useState only).
// =====================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import OperationUI from '@/components/staff/OperationUI';
import { createClient } from '@/utils/supabase/client';
import useFlightAudio from '@/hooks/useFlightAudio';

// ── Mock Mission Data ──
const MOCK_MISSION = {
    id: 'sim-mission-001',
    school_name: '🎓 Escuela de Práctica',
    school_id: 'sim-school',
    mission_type: 'simulation',
    meta: {},
};

function normalizePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
}

function toIsoEpochMs(value) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function SimulationContainer({ onExit }) {
    const [activeFlight, setActiveFlight] = useState(null);
    const [mockFlightLogs, setMockFlightLogs] = useState([]);
    const [activePause, setActivePause] = useState(null);
    const [completedPauses, setCompletedPauses] = useState([]);
    // [PERF FIX] Use ref instead of state to avoid re-rendering the entire
    // component tree every second. Timer display is handled locally inside
    // OperationUI via useElapsedTimer (same fix applied in StaffOperationLegacy).
    const nowMsRef = useRef(Date.now());
    const [operationStartMs, setOperationStartMs] = useState(0);
    const [toast, setToast] = useState(null);

    // ── Voice AI (Sistema de Narración) — fetch real POIs ──
    const [voicePois, setVoicePois] = useState([]);
    const [voiceIsActive, setVoiceIsActive] = useState(false);
    const [voicePlayingPoiId, setVoicePlayingPoiId] = useState(null);
    const [copilotVoiceState, setCopilotVoiceState] = useState('idle');

    // ── Flight Audio Ecosystem ──
    const flightAudio = useFlightAudio({ copilotVoiceState });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Fetch official POIs (public API, no auth needed)
                const officialResult = await fetch('/api/official-pois')
                    .then(r => r.ok ? r.json() : { pois: [] })
                    .catch(() => ({ pois: [] }));

                // Fetch personal POIs (needs auth)
                let personal = [];
                try {
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data } = await supabase
                            .from('pilot_pois')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('created_at', { ascending: false });
                        personal = data || [];
                    }
                } catch { /* non-blocking */ }

                if (!cancelled) {
                    const official = officialResult.pois || [];
                    setVoicePois([...official, ...personal]);
                    console.log(`[Simulador] POIs loaded: ${official.length} official + ${personal.length} personal`);
                }
            } catch (err) {
                console.warn('⚠️ Simulator POI fetch failed:', err);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    // [PERF FIX] Silent ref update — no re-render. Timer display is handled
    // by useElapsedTimer inside OperationUI.
    useEffect(() => {
        const id = setInterval(() => { nowMsRef.current = Date.now(); }, 1000);
        return () => clearInterval(id);
    }, []);

    // ── Toast auto-dismiss ──
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const showToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
    }, []);

    // ── Computed values ──
    const nextFlightNumber = mockFlightLogs.length + 1;
    const activeFlightNumber = normalizePositiveInt(activeFlight?.flightNumber) || nextFlightNumber;

    const totalStudentsFlown = mockFlightLogs.reduce((acc, f) => {
        const s = Number(f?.studentCount ?? f?.student_count ?? 0);
        return acc + (Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0);
    }, 0);

    const lastFlightEndMs = mockFlightLogs.length > 0
        ? Math.max(...mockFlightLogs.map(f => toIsoEpochMs(f.endTime ?? f.end_time ?? f.created_at)))
        : 0;

    const showInterFlightTimer = !activeFlight && mockFlightLogs.length > 0 && lastFlightEndMs > 0;
    // [PERF FIX] No longer compute elapsed seconds here. Pass raw startMs
    // values to OperationUI and let useElapsedTimer handle the ticking locally.
    // This eliminates the need for the nowMs state that re-rendered everything.

    // ═══════════════════════════════════════════════════
    // MOCK HANDLERS — Zero Supabase, Zero localStorage
    // ═══════════════════════════════════════════════════

    const handleFlightStart = useCallback((payload) => {
        const flightNumber = normalizePositiveInt(payload?.flightNumber) || (mockFlightLogs.length + 1);
        const startMs = Date.now();

        const simFlight = {
            flightId: payload?.flightId || `sim-flight-${startMs}`,
            flightNumber,
            startedAt: new Date(startMs).toISOString(),
            startTime: startMs,
            studentCount: Number(payload?.studentCount) || 0,
            staffCount: Number(payload?.staffCount) || 0,
            incidents: [],
            status: 'active',
            mission_id: MOCK_MISSION.id,
        };

        setActiveFlight(simFlight);

        if (operationStartMs <= 0) {
            setOperationStartMs(startMs);
        }

        // Trigger Audio Ecosystem transition and Copilot activation
        flightAudio.transitionToFlight();
        setVoiceIsActive(true);

        showToast(`✈️ Vuelo #${flightNumber} simulado — ¡Despegue!`, 'success');
    }, [mockFlightLogs.length, operationStartMs, showToast, flightAudio]);

    const handleFlightComplete = useCallback((data) => {
        const endMs = Date.now();
        const flightNumber = normalizePositiveInt(data?.flightNumber) || (mockFlightLogs.length + 1);

        const completedLog = {
            ...data,
            flightId: data?.flightId || `sim-flight-${endMs}`,
            flightNumber,
            endTime: endMs,
            end_time: new Date(endMs).toISOString(),
            mission_id: MOCK_MISSION.id,
            journey_id: 'sim-journey',
            synced: false,
            id: Date.now(),
        };

        setMockFlightLogs(prev => [...prev, completedLog]);
        setActiveFlight(null);

        // Trigger Audio Ecosystem transition and Copilot deactivation
        flightAudio.transitionToBoarding();
        setVoiceIsActive(false);
        setVoicePlayingPoiId(null);

        showToast(`✅ Vuelo #${flightNumber} aterrizó — ${data?.studentCount || 0} niños`, 'success');
    }, [mockFlightLogs.length, showToast, flightAudio]);

    const handleFlightCancel = useCallback(() => {
        setActiveFlight(null);
        showToast('🚫 Vuelo cancelado (simulación)', 'warning');
    }, [showToast]);

    const handleStartPause = useCallback((pauseData) => {
        setActivePause({
            type: pauseData.type,
            reason: pauseData.reason,
            startTime: new Date().toISOString(),
            pauseId: `sim-pause-${Date.now()}`,
            mission_id: MOCK_MISSION.id,
        });
        showToast('⏸️ Pausa simulada iniciada', 'info');
    }, [showToast]);

    const handleConfirmResume = useCallback((checklist) => {
        if (activePause) {
            setCompletedPauses(prev => [...prev, {
                ...activePause,
                endTime: new Date().toISOString(),
                resumeChecklist: checklist,
            }]);
        }
        setActivePause(null);
        showToast('▶️ Operación reanudada', 'success');
    }, [activePause, showToast]);

    const handleCloseOperation = useCallback(async () => {
        showToast('🎓 ¡Simulación completada! Buen trabajo.', 'success');
        // Small delay for toast visibility before exit
        await new Promise(r => setTimeout(r, 800));
        if (typeof onExit === 'function') {
            onExit();
        }
    }, [onExit, showToast]);

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className="relative">            {/* ── OperationUI (shared visual component) ── */}
            <OperationUI
                missionInfo={MOCK_MISSION}
                activeFlight={activeFlight}
                missionFlights={mockFlightLogs}
                nextFlightNumber={nextFlightNumber}
                activeFlightNumber={activeFlightNumber}
                activePause={activePause}
                completedPauses={completedPauses}
                operationElapsedSeconds={0}
                showOperationTimer={operationStartMs > 0}
                operationStartedAtMs={operationStartMs}
                interFlightElapsedSeconds={0}
                showInterFlightTimer={showInterFlightTimer}
                interFlightStartMs={lastFlightEndMs}
                totalStudentsFlown={totalStudentsFlown}
                pendingSyncCount={0}
                onFlightStart={handleFlightStart}
                onFlightComplete={handleFlightComplete}
                onFlightCancel={handleFlightCancel}
                onStartPause={handleStartPause}
                onConfirmResume={handleConfirmResume}
                onCloseOperation={handleCloseOperation}
                hideMenu={true}
                isSimulation={true}
                canEditCompletedFlights={false}
                pilotRecording={false}
                pilotMicPermission={null}
                pilotMicSupported={false}
                currentRole="pilot"
                pois={voicePois}
                voiceIsActive={voiceIsActive}
                voiceSetIsActive={setVoiceIsActive}
                voicePlayingPoiId={voicePlayingPoiId}
                voiceSetPlayingPoiId={setVoicePlayingPoiId}
                // ── Flight Audio Ecosystem Props ──
                flightPhase={flightAudio.flightPhase}
                onPrepareCabin={flightAudio.prepareCabin}
                flightAudioCurrentTrack={flightAudio.currentTrack}
                flightAudioIsPlaying={flightAudio.isPlaying}
                flightAudioIsLoading={flightAudio.isLoading}
                flightAudioHasError={flightAudio.hasError}
                flightAudioHasSoundtracks={flightAudio.hasSoundtracks}
                onFlightAudioTogglePlayPause={flightAudio.togglePlayPause}
                onFlightAudioSkipTrack={flightAudio.skipTrack}
                onCopilotVoiceStateChange={setCopilotVoiceState}
            />

            {/* ── Toast Notification ── */}
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 32,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        padding: '12px 24px',
                        borderRadius: 16,
                        background: toast.type === 'success'
                            ? 'linear-gradient(135deg, #065F46, #047857)'
                            : toast.type === 'warning'
                                ? 'linear-gradient(135deg, #78350F, #92400E)'
                                : 'linear-gradient(135deg, #1E293B, #334155)',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 700,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                        border: `1px solid ${
                            toast.type === 'success' ? 'rgba(16,185,129,0.3)'
                            : toast.type === 'warning' ? 'rgba(245,158,11,0.3)'
                            : 'rgba(148,163,184,0.2)'
                        }`,
                        maxWidth: '90vw',
                        textAlign: 'center',
                        animation: 'fadeIn 0.3s ease-out',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {toast.message}
                </div>
            )}
        </div>
    );
}
