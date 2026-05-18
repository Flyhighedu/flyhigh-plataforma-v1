'use client';

// =====================================================
// StaffOperationLegacy.js
// Componente extraído del dashboard original de staff.
// Preserva TODA la funcionalidad existente de vuelos, pausas y menú.
// Acepta props opcionales para integración con el nuevo stepper.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import TodayFlightList from '@/components/staff/TodayFlightList';
import FlightLogger from '@/components/staff/FlightLogger';
import OperationUI from '@/components/staff/OperationUI';
import { syncFlightLog, syncPauseStart, syncPauseEnd, syncAllPendingFlights } from '@/utils/staff/sync';
import { LogOut, MoreVertical, RotateCcw, Clock, Pause } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import MissionSelector from '@/components/staff/MissionSelector';
import PauseMenu from '@/components/staff/PauseMenu';
import PauseActiveOverlay from '@/components/staff/PauseActiveOverlay';
import ResumeProtocolModal from '@/components/staff/ResumeProtocolModal';
import SyncHeader from '@/components/staff/SyncHeader';
import ContingencyBypassMenu from '@/components/staff/ContingencyBypassMenu';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
// ── Escuadrón de Vuelo (Surgical Layer) ──
import EscuadronBriefingOverlay from '@/components/staff/EscuadronBriefingOverlay';
import SquadronBitacoraModal, { BitacoraPilotBanner } from '@/components/staff/SquadronBitacoraModal';
import EmotionRatingModal from '@/components/staff/EmotionRatingModal';
import EscuadronDebriefModal from '@/components/staff/EscuadronDebriefModal';
import { ROLE_TO_ESCUADRON, LOCAL_KEYS, META_KEYS } from '@/config/escuadronConfig';
// ── Pilot Audio Recording ──
import useAudioRecorder from '@/hooks/useAudioRecorder';
import { triggerAudioAudit } from '@/utils/triggerAudioAudit';
// ── Flight Audio Ecosystem ──
import useFlightAudio from '@/hooks/useFlightAudio';

const ACTIVE_FLIGHT_KEY = 'flyhigh_active_flight';
const CLOSED_FLIGHTS_KEY = 'flyhigh_recently_closed_flights';
const OPERATION_PHASE_STATES = new Set([
    'ARRIVAL_PHOTO_DONE',
    'waiting_unload_assignment',
    'waiting_dropzone',
    'unload',
    'post_unload_coordination',
    'seat_deployment',
    'OPERATION',
    'operation',
    'PILOT_OPERATION'
]);
const CLOSE_DAY_HOLD_MS = 2000;

function safeParseJson(input, fallback = null) {
    try {
        if (!input) return fallback;
        return JSON.parse(input);
    } catch (_e) {
        return fallback;
    }
}

function parseMetaLike(meta) {
    if (!meta) return Object.create(null);
    if (typeof meta === 'string') return safeParseJson(meta, Object.create(null)) || Object.create(null);
    if (typeof meta === 'object' && !Array.isArray(meta)) return meta;
    return Object.create(null);
}

function normalizeActiveFlightPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const startedAt = typeof raw.startedAt === 'string'
        ? raw.startedAt
        : typeof raw.start_time === 'string'
            ? raw.start_time
            : null;

    const startTimeMs = startedAt
        ? new Date(startedAt).getTime()
        : Number(raw.startTime || raw.startTimeMs || 0);

    if (!Number.isFinite(startTimeMs) || startTimeMs <= 0) return null;

    const rawFlightNumber = normalizePositiveInt(raw.flightNumber ?? raw.flight_number);

    return {
        flightId: raw.flightId || `flight-${startTimeMs}`,
        flightNumber: rawFlightNumber,
        startedAt: startedAt || new Date(startTimeMs).toISOString(),
        startTime: startTimeMs,
        studentCount: Number(raw.studentCount) || 0,
        staffCount: Number(raw.staffCount) || 0,
        incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
        status: 'active',
        mission_id: raw.mission_id || raw.missionId || null,
        journey_id: raw.journey_id || raw.journeyId || null,
        createdBy: raw.createdBy || null,
        createdByName: raw.createdByName || null,
        updatedAt: raw.updatedAt || new Date().toISOString()
    };
}

function normalizeFlightId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function toEpochMs(value) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;

    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildFlightFingerprint(flight) {
    if (!flight || typeof flight !== 'object') return '';

    const startTime = toEpochMs(flight.startTime ?? flight.start_time);
    const studentCount = Number(flight.studentCount ?? flight.student_count ?? 0) || 0;
    const staffCount = Number(flight.staffCount ?? flight.staff_count ?? 0) || 0;

    return `${startTime}|${studentCount}|${staffCount}`;
}

function readClosedFlightIdsFromSession() {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];

    const parsed = safeParseJson(window.sessionStorage.getItem(CLOSED_FLIGHTS_KEY), []);
    if (!Array.isArray(parsed)) return [];

    return parsed
        .map((id) => normalizeFlightId(id))
        .filter(Boolean)
        .slice(-80);
}

function writeClosedFlightIdsToSession(ids) {
    if (typeof window === 'undefined' || !window.sessionStorage) return;

    const payload = Array.from(ids)
        .map((id) => normalizeFlightId(id))
        .filter(Boolean)
        .slice(-80);

    window.sessionStorage.setItem(CLOSED_FLIGHTS_KEY, JSON.stringify(payload));
}

function waitMs(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function toIsoEpochMs(value) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;

    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
}

function isMissionFlightLog(log, missionId, journeyId) {
    if (!log || typeof log !== 'object') return false;

    const targetJourney = String(journeyId || '').trim();
    const targetMission = String(missionId || '').trim();

    const logJourney = String(log.journey_id || '').trim();
    if (targetJourney && logJourney && logJourney === targetJourney) return true;

    const logMission = String(log.mission_id || '').trim();
    return Boolean(!logJourney && targetMission && logMission === targetMission);
}

function sortFlightsByEndDesc(rows) {
    return [...rows].sort((a, b) => {
        const aEnd = toIsoEpochMs(a.endTime ?? a.end_time ?? a.created_at ?? a.startTime ?? a.start_time);
        const bEnd = toIsoEpochMs(b.endTime ?? b.end_time ?? b.created_at ?? b.startTime ?? b.start_time);
        return bEnd - aEnd;
    });
}

function dedupeFlightLogs(rows) {
    if (!Array.isArray(rows)) return [];

    const byKey = new Map();

    rows.forEach((row, idx) => {
        if (!row || typeof row !== 'object') return;

        const flightId = normalizeFlightId(row.flightId ?? row.flight_id);
        const fingerprint = buildFlightFingerprint(row);
        const missionKey = String(row.mission_id || '').trim();
        const journeyKey = String(row.journey_id || '').trim();
        const timeAnchor = toIsoEpochMs(row.endTime ?? row.end_time ?? row.created_at ?? row.startTime ?? row.start_time);

        const dedupeKey = flightId
            ? `id:${flightId}`
            : fingerprint
                ? `fp:${journeyKey}|${missionKey}|${fingerprint}`
                : `row:${journeyKey}|${missionKey}|${timeAnchor}|${idx}`;

        const existing = byKey.get(dedupeKey);
        if (!existing) {
            byKey.set(dedupeKey, row);
            return;
        }

        const merged = {
            ...existing,
            ...row,
            synced: Boolean(existing.synced || row.synced),
            incidents: Array.isArray(row.incidents) && row.incidents.length > 0
                ? row.incidents
                : Array.isArray(existing.incidents)
                    ? existing.incidents
                    : []
        };

        byKey.set(dedupeKey, merged);
    });

    return Array.from(byKey.values());
}

function isSameFlightLogEntry(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

    if (a.id !== undefined && a.id !== null && b.id !== undefined && b.id !== null) {
        if (String(a.id) === String(b.id)) return true;
    }

    const aFlightId = normalizeFlightId(a.flightId ?? a.flight_id);
    const bFlightId = normalizeFlightId(b.flightId ?? b.flight_id);
    if (aFlightId && bFlightId && aFlightId === bFlightId) return true;

    const aFingerprint = buildFlightFingerprint(a);
    const bFingerprint = buildFlightFingerprint(b);
    if (aFingerprint && bFingerprint && aFingerprint === bFingerprint) return true;

    const aStart = toIsoEpochMs(a.startTime ?? a.start_time);
    const bStart = toIsoEpochMs(b.startTime ?? b.start_time);
    const aEnd = toIsoEpochMs(a.endTime ?? a.end_time ?? a.created_at);
    const bEnd = toIsoEpochMs(b.endTime ?? b.end_time ?? b.created_at);

    return Boolean(aStart > 0 && bStart > 0 && aEnd > 0 && bEnd > 0 && aStart === bStart && aEnd === bEnd);
}

export default function StaffOperationLegacy({
    initialMission = null,
    onCloseDay = null,
    hideMenu = false,
    preview = false,
    useSyncHeader = false,
    startFromMissionSelector = false,
    journeyId = null,
    userId = null,
    profile = null,
    missionState = null,
    onRefresh = null
}) {
    const currentRole = profile?.role || null;
    const firstName = profile?.full_name?.split(' ')[0] || 'Auxiliar';
    const roleName = ROLE_LABELS[currentRole] || currentRole || 'Auxiliar';
    const shouldUseSyncHeader = useSyncHeader && !hideMenu;
    const canEditCompletedFlights = currentRole === 'assistant' || currentRole === 'auxiliar' || currentRole === 'teacher';

    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const [flightLogs, setFlightLogs] = useState([]);
    const [activeFlight, setActiveFlight] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [closeHoldProgress, setCloseHoldProgress] = useState(0);
    const [isClosingOperation, setIsClosingOperation] = useState(false);
    const [closeOperationError, setCloseOperationError] = useState(null);

    // ── Escuadrón de Vuelo State (Isolated Layer) ──
    const [escuadronBriefingDone, setEscuadronBriefingDone] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(LOCAL_KEYS.BRIEFING_DONE) === 'true';
        }
        return false;
    });
    const [showBitacoraModal, setShowBitacoraModal] = useState(false);
    const [showEmotionModal, setShowEmotionModal] = useState(false);
    const [pendingFlightForEmotion, setPendingFlightForEmotion] = useState(null);
    const [showDebriefModal, setShowDebriefModal] = useState(false);

    // Pause State
    const [showPauseMenu, setShowPauseMenu] = useState(false);
    const [activePause, setActivePause] = useState(null);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [completedPauses, setCompletedPauses] = useState([]);
    const [nowMs, setNowMs] = useState(Date.now());
    const [flightEditModal, setFlightEditModal] = useState(null);
    const [editedStudentCount, setEditedStudentCount] = useState('0');
    const [flightEditReason, setFlightEditReason] = useState('');
    const [isSavingFlightEdit, setIsSavingFlightEdit] = useState(false);
    const [pilotQaFeedback, setPilotQaFeedback] = useState(null);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // ── Voice AI (Computadora de Vuelo) ──
    const [voicePois, setVoicePois] = useState([]);
    const [voiceIsActive, setVoiceIsActive] = useState(false);
    const [voicePlayingPoiId, setVoicePlayingPoiId] = useState(null);
    // Copilot voice state for audio ducking (tracks the AI narration state)
    const [copilotVoiceState, setCopilotVoiceState] = useState('off');

    // ── Flight Audio Ecosystem ──
    const flightAudio = useFlightAudio({ copilotVoiceState });

    // ── Pilot Audio Recording (fire-and-forget, never blocks flight ops) ──
    const {
        isSupported: pilotMicSupported,
        isRecording: pilotRecording,
        durationSeconds: pilotRecDuration,
        permissionState: pilotMicPermission,
        startRecording: startPilotRecording,
        stopRecording: stopPilotRecording,
        cancelRecording: cancelPilotRecording
    } = useAudioRecorder();
    const pilotRecDurationRef = useRef(0);
    useEffect(() => { pilotRecDurationRef.current = pilotRecDuration; }, [pilotRecDuration]);

    // ── Fetch + Realtime POIs for Sistema de Narración ──
    // Official POIs: fetched immediately (no auth needed — API uses service role)
    // Personal POIs: fetched when userId is available (client-side auth)
    const [voicePoisOfficial, setVoicePoisOfficial] = useState([]);
    const [voicePoisPersonal, setVoicePoisPersonal] = useState([]);

    // Merge official + personal into the final voicePois array
    useEffect(() => {
        setVoicePois([...voicePoisOfficial, ...voicePoisPersonal]);
    }, [voicePoisOfficial, voicePoisPersonal]);

    // Effect 1: Official POIs — runs immediately on mount
    useEffect(() => {
        let cancelled = false;

        const fetchOfficial = async () => {
            try {
                const result = await fetch('/api/official-pois').then(r => r.ok ? r.json() : { pois: [] }).catch(() => ({ pois: [] }));
                if (!cancelled) {
                    const official = result.pois || [];
                    console.log(`[SistemaNarración] Official POIs loaded: ${official.length}, with audio: ${official.filter(p => p.audio_url).length}`);
                    setVoicePoisOfficial(official);
                }
            } catch (err) {
                console.warn('⚠️ Official POI fetch failed (non-blocking):', err);
            }
        };

        fetchOfficial();

        // Realtime: official POIs (master_route_pois) — e.g. admin generates new audio
        const supabase = createClient();
        const officialChannel = supabase
            .channel('voice-official-pois')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'master_route_pois',
            }, () => { if (!cancelled) fetchOfficial(); })
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(officialChannel);
        };
    }, []);

    // Effect 2: Personal POIs — runs when userId is available
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const supabase = createClient();

        const fetchPersonal = async () => {
            try {
                const { data, error } = await supabase
                    .from('pilot_pois')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (!cancelled) {
                    const personal = data || [];
                    if (error) console.warn('⚠️ pilot_pois query error:', error.message);
                    console.log(`[SistemaNarración] Personal POIs loaded: ${personal.length}, with audio: ${personal.filter(p => p.audio_url).length}`);
                    setVoicePoisPersonal(personal);
                }
            } catch (err) {
                console.warn('⚠️ Personal POI fetch failed (non-blocking):', err);
            }
        };

        fetchPersonal();

        // Realtime: personal POIs (pilot_pois)
        const personalChannel = supabase
            .channel('voice-personal-pois')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pilot_pois',
                filter: `user_id=eq.${userId}`,
            }, () => { if (!cancelled) fetchPersonal(); })
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(personalChannel);
        };
    }, [userId]);

    // ── Notify supervisor of mic permission status via journey meta ──
    const lastReportedMicStateRef = useRef(null);
    useEffect(() => {
        if (!journeyId || preview) return;
        if (currentRole !== 'pilot' && currentRole !== 'teacher') return;
        if (pilotMicPermission !== 'denied' && pilotMicPermission !== 'granted') return;

        const isBlocked = pilotMicPermission === 'denied';
        const roleKey = currentRole === 'pilot' ? 'pilot_mic_blocked' : 'teacher_mic_blocked';

        // Avoid redundant writes
        if (lastReportedMicStateRef.current === `${roleKey}:${isBlocked}`) return;
        lastReportedMicStateRef.current = `${roleKey}:${isBlocked}`;

        const supabase = createClient();
        supabase.from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single()
            .then(({ data, error: readErr }) => {
                if (readErr) throw readErr;
                const currentMeta = parseMetaLike(data?.meta);
                // Only write if value actually changed
                if (currentMeta[roleKey] === isBlocked) return;
                return supabase.from('staff_journeys')
                    .update({
                        meta: {
                            ...currentMeta,
                            [roleKey]: isBlocked,
                            [`${roleKey}_at`]: new Date().toISOString()
                        },
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', journeyId);
            })
            .catch(err => console.warn('⚠️ No se pudo reportar estado del micrófono:', err));
    }, [journeyId, pilotMicPermission, currentRole, preview]);

    const recentlyClosedFlightIdsRef = useRef(new Set());
    const processingFlightIdsRef = useRef(new Set());
    const activeMetaWriteSeqRef = useRef(0);
    const operationAnchorSyncInFlightRef = useRef(false);
    const lastSyncedOperationAnchorMsRef = useRef(0);
    const closeHoldRafRef = useRef(null);
    const closeHoldStartedAtRef = useRef(0);
    const closeHoldTriggeredRef = useRef(false);
    const [operationAnchorBootstrapMs, setOperationAnchorBootstrapMs] = useState(0);

    const router = useRouter();

    useEffect(() => {
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        return () => {
            if (closeHoldRafRef.current !== null) {
                window.cancelAnimationFrame(closeHoldRafRef.current);
            }
        };
    }, []);

    const rememberClosedFlightId = (flightId) => {
        const normalized = normalizeFlightId(flightId);
        if (!normalized) return;

        recentlyClosedFlightIdsRef.current.add(normalized);
        writeClosedFlightIdsToSession(recentlyClosedFlightIdsRef.current);
    };

    const forgetClosedFlightId = (flightId) => {
        const normalized = normalizeFlightId(flightId);
        if (!normalized) return;

        if (!recentlyClosedFlightIdsRef.current.has(normalized)) return;
        recentlyClosedFlightIdsRef.current.delete(normalized);
        writeClosedFlightIdsToSession(recentlyClosedFlightIdsRef.current);
    };

    useEffect(() => {
        if (startFromMissionSelector) {
            recentlyClosedFlightIdsRef.current = new Set(readClosedFlightIdsFromSession());

            const savedLogsRaw = safeParseJson(localStorage.getItem('flyhigh_flight_logs'), []);
            const savedLogs = dedupeFlightLogs(Array.isArray(savedLogsRaw) ? savedLogsRaw : []);

            if (savedLogs.length !== (Array.isArray(savedLogsRaw) ? savedLogsRaw.length : 0)) {
                localStorage.setItem('flyhigh_flight_logs', JSON.stringify(savedLogs));
            }

            setCurrentMission(null);
            setFlightLogs(savedLogs);
            setActiveFlight(null);
            setCompletedPauses(JSON.parse(localStorage.getItem('flyhigh_completed_pauses') || '[]'));
            setIsRestoring(false);
            return;
        }

        // Si viene una misión inicial (auto-detectada), usarla
        if (initialMission) {
            setCurrentMission({
                ...initialMission,
                school_name: initialMission.school_name || initialMission.nombre_escuela
            });
        }

        // Preview: no restaurar localStorage
        if (preview) {
            recentlyClosedFlightIdsRef.current = new Set();
            setActiveFlight(null);
            setIsRestoring(false);
            return;
        }

        recentlyClosedFlightIdsRef.current = new Set(readClosedFlightIdsFromSession());

        // Restaurar desde localStorage
        const savedMissionRaw = localStorage.getItem('flyhigh_staff_mission');
        const savedMission = safeParseJson(savedMissionRaw);
        const savedLogsRaw = safeParseJson(localStorage.getItem('flyhigh_flight_logs'), []);
        const savedLogs = dedupeFlightLogs(Array.isArray(savedLogsRaw) ? savedLogsRaw : []);
        const savedPause = localStorage.getItem('flyhigh_active_pause');
        const savedCompletedPauses = JSON.parse(localStorage.getItem('flyhigh_completed_pauses') || '[]');
        const savedActiveFlight = normalizeActiveFlightPayload(safeParseJson(localStorage.getItem(ACTIVE_FLIGHT_KEY)));
        const missionMeta = parseMetaLike(initialMission?.meta || savedMission?.meta);
        const metaActiveFlight = normalizeActiveFlightPayload(missionMeta?.aux_operation_active_flight);
        const restoredActiveFlight = savedActiveFlight || metaActiveFlight;

        if (savedLogs.length !== (Array.isArray(savedLogsRaw) ? savedLogsRaw.length : 0)) {
            localStorage.setItem('flyhigh_flight_logs', JSON.stringify(savedLogs));
        }

        if (!initialMission && savedMission) {
            setCurrentMission(savedMission);
            setFlightLogs(savedLogs);
        } else {
            setFlightLogs(savedLogs);
        }

        const targetMissionId = initialMission?.id || savedMission?.id || null;
        const targetJourneyId = journeyId || null;
        const restoredFlightId = normalizeFlightId(restoredActiveFlight?.flightId);
        const wasClosedRecently = restoredFlightId
            ? recentlyClosedFlightIdsRef.current.has(restoredFlightId)
            : false;

        const activeMatchesMission =
            restoredActiveFlight &&
            (!targetMissionId || String(restoredActiveFlight.mission_id || '') === String(targetMissionId));
        const activeMatchesJourney =
            restoredActiveFlight &&
            (!targetJourneyId || !restoredActiveFlight.journey_id || String(restoredActiveFlight.journey_id) === String(targetJourneyId));

        if (!wasClosedRecently && activeMatchesMission && activeMatchesJourney) {
            setActiveFlight({
                ...restoredActiveFlight,
                mission_id: targetMissionId || restoredActiveFlight.mission_id || null,
                journey_id: targetJourneyId || restoredActiveFlight.journey_id || null
            });
        } else {
            setActiveFlight(null);
            localStorage.removeItem(ACTIVE_FLIGHT_KEY);
        }

        if (savedPause) {
            try { setActivePause(JSON.parse(savedPause)); } catch (e) { console.error("Failed to restore pause", e); }
        }

        setCompletedPauses(savedCompletedPauses);
        setIsRestoring(false);
    }, [initialMission, preview, journeyId, startFromMissionSelector]);

    // Keep session alive (skip in preview)
    useEffect(() => {
        if (preview) return;
        const supabase = createClient();
        supabase.auth.refreshSession();

        const intervalId = setInterval(() => {
            // [H-04 FIX] Always attempt refresh — navigator.onLine is unreliable
            supabase.auth.refreshSession().then(({ error }) => {
                if (error) console.warn("Session refresh failed:", error);
            });
        }, 10 * 60 * 1000);

        const handleOnline = () => {
            supabase.auth.refreshSession();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, [preview]);

    // ── [CRITICAL FIX] Retry queue: automatically re-sync unsynced flights every 30s ──
    useEffect(() => {
        if (preview) return;

        const retrySyncPending = async () => {
            const rawLogs = safeParseJson(localStorage.getItem('flyhigh_flight_logs'), []);
            const pending = Array.isArray(rawLogs) ? rawLogs.filter(l => l && !l.synced) : [];
            setPendingSyncCount(pending.length);

            if (pending.length === 0) return;

            let syncedAny = false;
            const updatedLogs = [...rawLogs];

            for (const flight of pending) {
                try {
                    const success = await syncFlightLog(flight);
                    if (success) {
                        const idx = updatedLogs.findIndex(l => l.id === flight.id);
                        if (idx !== -1) updatedLogs[idx] = { ...updatedLogs[idx], synced: true };
                        syncedAny = true;
                    }
                } catch (_e) { /* retry next cycle */ }
            }

            if (syncedAny) {
                localStorage.setItem('flyhigh_flight_logs', JSON.stringify(updatedLogs));
                setFlightLogs(dedupeFlightLogs(updatedLogs));
                const newPending = updatedLogs.filter(l => l && !l.synced).length;
                setPendingSyncCount(newPending);
                console.log(`✅ Retry sync: ${pending.length - newPending} vuelos sincronizados`);
            }
        };

        // Initial check
        retrySyncPending();

        // Retry every 30 seconds
        const retryInterval = setInterval(retrySyncPending, 30_000);

        // Also retry immediately when device comes back online
        const handleOnlineRetry = () => {
            setTimeout(retrySyncPending, 2000); // Small delay for network stabilization
        };
        window.addEventListener('online', handleOnlineRetry);

        return () => {
            clearInterval(retryInterval);
            window.removeEventListener('online', handleOnlineRetry);
        };
    }, [preview]);

    useEffect(() => {
        if (preview) return;

        const missionId = currentMission?.id || initialMission?.id || null;
        const missionMeta = parseMetaLike(currentMission?.meta || initialMission?.meta);
        const metaActiveFlight = normalizeActiveFlightPayload(missionMeta?.aux_operation_active_flight);

        if (!metaActiveFlight) return;

        if (missionId && metaActiveFlight.mission_id && String(metaActiveFlight.mission_id) !== String(missionId)) {
            return;
        }

        if (journeyId && metaActiveFlight.journey_id && String(metaActiveFlight.journey_id) !== String(journeyId)) {
            return;
        }

        const nextActive = {
            ...metaActiveFlight,
            mission_id: missionId || metaActiveFlight.mission_id || null,
            journey_id: journeyId || metaActiveFlight.journey_id || null
        };

        const nextFlightId = normalizeFlightId(nextActive.flightId);
        if (nextFlightId && recentlyClosedFlightIdsRef.current.has(nextFlightId)) {
            localStorage.removeItem(ACTIVE_FLIGHT_KEY);
            return;
        }

        setActiveFlight((prev) => {
            if (
                prev?.flightId === nextActive.flightId &&
                prev?.updatedAt === nextActive.updatedAt &&
                prev?.startTime === nextActive.startTime
            ) {
                return prev;
            }
            return nextActive;
        });

        localStorage.setItem(ACTIVE_FLIGHT_KEY, JSON.stringify(nextActive));
    }, [currentMission?.id, currentMission?.meta, initialMission?.id, initialMission?.meta, journeyId, preview]);

    // ── Keep currentMission.meta in sync with realtime updates from initialMission ──
    // This ensures components like BitacoraPilotBanner receive live data
    // from the teacher's bitacora entries without a full re-initialization.
    useEffect(() => {
        if (!initialMission?.meta || startFromMissionSelector) return;
        setCurrentMission(prev => {
            if (!prev) return prev;
            const prevMetaStr = JSON.stringify(prev.meta || {});
            const nextMetaStr = JSON.stringify(initialMission.meta || {});
            if (prevMetaStr === nextMetaStr) return prev;
            return { ...prev, meta: initialMission.meta };
        });
    }, [initialMission?.meta, startFromMissionSelector]);

    const handleSelectMission = (mission) => {
        setCurrentMission(mission);
        if (!preview) localStorage.setItem('flyhigh_staff_mission', JSON.stringify(mission));
    };

    const handleLogout = async () => {
        if (preview) return;
        const supabase = createClient();
        await supabase.auth.signOut();
        localStorage.removeItem('flyhigh_staff_mission');
        localStorage.removeItem(ACTIVE_FLIGHT_KEY);
        writeClosedFlightIdsToSession(new Set());
        router.push('/staff/login');
    };

    const handleChangeSchool = () => {
        if (preview) { setCurrentMission(null); setShowMenu(false); return; }
        if (confirm("¿Seguro que quieres cambiar de escuela?")) {
            setCurrentMission(null);
            localStorage.removeItem('flyhigh_staff_mission');
            localStorage.removeItem(ACTIVE_FLIGHT_KEY);
            writeClosedFlightIdsToSession(new Set());
            setShowMenu(false);
        }
    };

    const handleCloseDay = useCallback(async () => {
        try {
            // ── GUARD: Block closure if a flight is still active ──
            if (activeFlight) {
                setCloseOperationError('Hay un vuelo activo. Finalízalo antes de cerrar la operación.');
                setIsClosingOperation(false);
                closeHoldTriggeredRef.current = false;
                setCloseHoldProgress(0);
                return;
            }

            // ── SEAL MISSION: Insert/update closure record with real totals ──
            if (journeyId && currentMission?.id) {
                const supabase = createClient();
                const now = new Date().toISOString();

                // Compute totals from current flight logs
                const currentMissionFlights = sortFlightsByEndDesc(
                    dedupeFlightLogs(
                        (flightLogs || []).filter((log) => isMissionFlightLog(log, currentMission.id, journeyId))
                    )
                );
                const sealTotalFlights = currentMissionFlights.length;
                const sealTotalStudents = currentMissionFlights.reduce((acc, flight) => {
                    const students = Number(flight?.studentCount ?? flight?.student_count ?? 0);
                    return acc + (Number.isFinite(students) ? Math.max(0, Math.floor(students)) : 0);
                }, 0);

                // 1. UPSERT → cierres_mision (seal with real totals)
                const { error: cierreError } = await supabase
                    .from('cierres_mision')
                    .upsert({
                        journey_id: journeyId,
                        mission_id: currentMission.id,
                        school_name_snapshot: currentMission.school_name || currentMission.nombre_escuela || null,
                        total_flights: sealTotalFlights,
                        total_students: sealTotalStudents,
                        created_by: userId || null,
                        closed_by_name: profile?.full_name || null,
                        created_at: now
                    }, { onConflict: 'journey_id' });

                if (cierreError) {
                    console.warn('⚠️ cierres_mision upsert failed (non-blocking):', cierreError);
                }

                const missionMeta = parseMetaLike(currentMission?.meta || {});
                const isContingency = missionMeta?.contingency_direct_operation === true;

                if (isContingency) {
                    // 🚨 EMERGENCY CLOSURE 🚨
                    // 1. Force sync all pending flight logs before sealing
                    try {
                        console.log('🔄 Syncing pending flights before emergency closure...');
                        await syncAllPendingFlights();
                    } catch (syncErr) {
                        console.warn('⚠️ Pre-closure sync failed (non-blocking):', syncErr);
                    }

                    // 2. SEAL MISSION: Insert/update closure record with real totals
                    // (Already handled by the upsert at line 540)
                    const actorName = profile?.full_name?.split(' ')[0] || 'Docente';
                    const closureMeta = {
                        ...missionMeta,
                        contingency_closed_at: now,
                        contingency_closed_by: userId,
                        contingency_closed_by_name: actorName,
                        contingency_closure: true
                    };

                    await supabase.from('staff_journeys').update({
                        status: 'closed',
                        mission_state: 'completed',
                        meta: closureMeta,
                        updated_at: now
                    }).eq('id', journeyId);

                    // Audit event
                    await supabase.from('staff_events').insert({
                        journey_id: journeyId,
                        type: 'CONTINGENCY_OPERATION_CLOSED',
                        actor_user_id: userId,
                        payload: { by_name: actorName, closed_at: now }
                    });

                    // Update mission status
                    await supabase.from('proximas_escuelas').update({
                        estatus: 'completada',
                        updated_at: now
                    }).eq('id', currentMission.id);

                    // Clear presence for this mission/journey
                    await supabase.from('staff_presence').delete().eq('journey_id', journeyId);

                    console.log('🚨 Emergency Contingency Closure triggered. Journey sealed.');
                } else {
                    // NORMAL CLOSURE
                    // NOTE: status='closed' and proximas_escuelas='completado' are NOT set here.
                    // Those transitions happen AFTER the full checkout process is complete
                    // (see CheckoutScreen / handleReportComplete). Sealing them here was
                    // causing the journey to disappear from the supervisor dashboard while
                    // the team was still in the dismantling phase.
                }

                console.log('✅ Flight log sealed:', {
                    journeyId,
                    missionId: currentMission.id,
                    totalFlights: sealTotalFlights,
                    totalStudents: sealTotalStudents
                });
            }

            // ── NAVIGATE: Proceed to dismantling flow or History ──
            const missionMetaStr = currentMission?.meta || {};
            const isContingencyRoute = typeof missionMetaStr === 'string' 
                ? missionMetaStr.includes('"contingency_direct_operation":true') 
                : missionMetaStr?.contingency_direct_operation === true;

            if (isContingencyRoute) {
                // ── CLEAN EXIT (Lobby) ──
                // Clear local mission state to prevent dashboard from auto-returning to operation
                localStorage.removeItem('flyhigh_staff_mission');
                localStorage.removeItem('flyhigh_selected_mission_id');
                localStorage.removeItem('flyhigh_active_journey_id');
                localStorage.removeItem(ACTIVE_FLIGHT_KEY);
                localStorage.removeItem(CLOSED_FLIGHTS_KEY);
                
                // Hard-refresh redirect to Lobby (History tab)
                console.log('🚪 Contingency complete. Returning to Lobby...');
                window.location.href = '/staff/dashboard?tab=history';
            } else if (onCloseDay) {
                await onCloseDay();
            } else {
                router.push('/staff/history');
            }
            // Only close modal on SUCCESS
            setShowCloseConfirmModal(false);
            setShowMenu(false);
        } catch (err) {
            // Reset hold state so user can retry
            closeHoldTriggeredRef.current = false;
            setCloseHoldProgress(0);
            setIsClosingOperation(false);
            setCloseOperationError(err?.message || 'No se pudo finalizar. Intenta nuevamente.');
            throw err; // Re-throw so finalizeCloseDay also catches
        }
    }, [onCloseDay, router, activeFlight, journeyId, currentMission, flightLogs, userId, profile]);

    const resetCloseDayHold = useCallback(() => {
        if (closeHoldRafRef.current !== null) {
            window.cancelAnimationFrame(closeHoldRafRef.current);
            closeHoldRafRef.current = null;
        }
        closeHoldStartedAtRef.current = 0;
        closeHoldTriggeredRef.current = false;
        setCloseHoldProgress(0);
        setIsClosingOperation(false);
        setCloseOperationError(null);
    }, []);

    const closeCloseConfirmModal = useCallback(() => {
        setShowCloseConfirmModal(false);
        resetCloseDayHold();
    }, [resetCloseDayHold]);

    const openCloseConfirmModal = useCallback(() => {
        setShowMenu(false);
        // ── Escuadrón Debrief Intercept ──
        // Show debrief modal BEFORE the close confirmation if not done yet
        const escuadronRole = ROLE_TO_ESCUADRON[profile?.role];
        const debriefLocalKey = `flyhigh_escuadron_debrief_${journeyId || 'local'}`;
        let debriefAlreadyDone = false;
        try {
            const localDebrief = JSON.parse(localStorage.getItem(debriefLocalKey) || '{}');
            debriefAlreadyDone = Boolean(localDebrief[escuadronRole]);
        } catch (_e) { /* non-blocking */ }

        if (!debriefAlreadyDone && escuadronRole) {
            setShowDebriefModal(true);
            return;
        }
        setShowCloseConfirmModal(true);
        resetCloseDayHold();
    }, [resetCloseDayHold, profile?.role, journeyId]);

    const finalizeCloseDay = useCallback(async () => {
        if (closeHoldTriggeredRef.current) return;
        closeHoldTriggeredRef.current = true;
        setCloseHoldProgress(100);
        setIsClosingOperation(true);
        setCloseOperationError(null);
        try {
            await handleCloseDay();
        } catch (_e) {
            // Error already handled inside handleCloseDay (sets closeOperationError)
        }
    }, [handleCloseDay]);

    const handleCloseHoldStart = useCallback((event) => {
        if (closeHoldTriggeredRef.current) return;
        if (event?.cancelable) event.preventDefault();

        if (closeHoldRafRef.current !== null) {
            window.cancelAnimationFrame(closeHoldRafRef.current);
            closeHoldRafRef.current = null;
        }

        closeHoldStartedAtRef.current = performance.now();
        setCloseHoldProgress(1);

        const tick = (now) => {
            const elapsed = Math.max(0, now - closeHoldStartedAtRef.current);
            const progress = Math.min(100, (elapsed / CLOSE_DAY_HOLD_MS) * 100);
            setCloseHoldProgress(progress);

            if (progress >= 100) {
                closeHoldRafRef.current = null;
                finalizeCloseDay();
                return;
            }

            closeHoldRafRef.current = window.requestAnimationFrame(tick);
        };

        closeHoldRafRef.current = window.requestAnimationFrame(tick);
    }, [finalizeCloseDay]);

    const handleCloseHoldCancel = useCallback(() => {
        if (closeHoldTriggeredRef.current) return;
        if (closeHoldRafRef.current !== null) {
            window.cancelAnimationFrame(closeHoldRafRef.current);
            closeHoldRafRef.current = null;
        }
        setCloseHoldProgress(0);
    }, []);

    const persistActiveFlightCache = (nextFlight) => {
        if (preview) return;
        if (nextFlight) {
            localStorage.setItem(ACTIVE_FLIGHT_KEY, JSON.stringify(nextFlight));
        } else {
            localStorage.removeItem(ACTIVE_FLIGHT_KEY);
        }
    };

    const persistActiveFlightInJourneyMeta = useCallback(async (nextFlight, options = Object.create(null)) => {
        if (preview || !journeyId) return;

        const forcedOperationStartedAt = typeof options?.operationStartedAt === 'string'
            ? options.operationStartedAt
            : null;

        const writeSeq = ++activeMetaWriteSeqRef.current;
        const maxAttempts = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (writeSeq !== activeMetaWriteSeqRef.current) return;

                const supabase = createClient();
                const now = new Date().toISOString();
                const { data, error: readError } = await supabase
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();

                if (readError) throw readError;
                if (writeSeq !== activeMetaWriteSeqRef.current) return;

                const currentMeta = parseMetaLike(data?.meta);
                const currentOperationStartedAtMs = toIsoEpochMs(currentMeta?.aux_operation_started_at);
                const forcedOperationStartedAtMs = toIsoEpochMs(forcedOperationStartedAt);
                const nextFlightStartMs = toIsoEpochMs(nextFlight?.startedAt ?? nextFlight?.start_time ?? nextFlight?.startTime);

                const operationAnchorCandidates = [
                    currentOperationStartedAtMs,
                    forcedOperationStartedAtMs,
                    nextFlightStartMs
                ].filter((value) => Number.isFinite(value) && value > 0);

                const nextOperationStartedAtMs = operationAnchorCandidates.length > 0
                    ? Math.min(...operationAnchorCandidates)
                    : 0;

                const nextOperationStartedAt = nextOperationStartedAtMs > 0
                    ? new Date(nextOperationStartedAtMs).toISOString()
                    : null;

                const nextMeta = {
                    ...currentMeta,
                    aux_operation_active_flight: nextFlight || null,
                    aux_operation_active_flight_updated_at: now
                };

                if (nextOperationStartedAt) {
                    nextMeta.aux_operation_started_at = nextOperationStartedAt;
                }

                const { error: updateError } = await supabase
                    .from('staff_journeys')
                    .update({
                        meta: nextMeta,
                        updated_at: now
                    })
                    .eq('id', journeyId);

                if (writeSeq !== activeMetaWriteSeqRef.current) return;
                if (updateError) throw updateError;

                return;
            } catch (error) {
                lastError = error;
                if (writeSeq !== activeMetaWriteSeqRef.current) return;

                if (attempt < maxAttempts) {
                    await waitMs(220 * attempt);
                    continue;
                }
            }
        }

        console.warn('No se pudo sincronizar vuelo activo en journey meta:', lastError);
    }, [journeyId, preview]);


    const missionMeta = parseMetaLike(currentMission?.meta || initialMission?.meta);
    const missionStateKey = String(missionState || '').trim();
    const isOperationPhaseActive = OPERATION_PHASE_STATES.has(missionStateKey);

    // ── Contingency: assistant acts as pilot → needs the Bitácora banner ──
    const isContingencyNoPilot = missionMeta?.contingency_no_pilot === true;

    const missionFlights = sortFlightsByEndDesc(
        dedupeFlightLogs(
            (flightLogs || []).filter((log) => isMissionFlightLog(log, currentMission?.id, journeyId))
        )
    );

    const nextFlightNumber = missionFlights.length + 1;
    const activeFlightNumber = normalizePositiveInt(activeFlight?.flightNumber) || nextFlightNumber;
    const lastMissionFlight = missionFlights[0] || null;
    const lastMissionFlightEndMs = toIsoEpochMs(
        lastMissionFlight?.endTime ??
        lastMissionFlight?.end_time ??
        lastMissionFlight?.created_at
    );
    // [BUG-FIX] Only show inter-flight timer when operation phase is still active
    const showInterFlightTimer = !activeFlight && missionFlights.length > 0 && lastMissionFlightEndMs > 0 && isOperationPhaseActive;
    const interFlightElapsedSeconds = showInterFlightTimer
        ? Math.max(0, Math.floor((nowMs - lastMissionFlightEndMs) / 1000))
        : 0;

    const totalStudentsFlown = missionFlights.reduce((acc, flight) => {
        const students = Number(flight?.studentCount ?? flight?.student_count ?? 0);
        return acc + (Number.isFinite(students) ? Math.max(0, Math.floor(students)) : 0);
    }, 0);

    const missionFirstFlightStartMs = missionFlights.reduce((earliest, flight) => {
        const startMs = toIsoEpochMs(flight?.startTime ?? flight?.start_time);
        if (!startMs) return earliest;
        if (!earliest) return startMs;
        return Math.min(earliest, startMs);
    }, 0);

    const activeFlightStartMs = toIsoEpochMs(activeFlight?.startedAt ?? activeFlight?.start_time ?? activeFlight?.startTime);
    const operationStartedAtMsFromMeta = toIsoEpochMs(missionMeta?.aux_operation_started_at);

    const operationAnchorCandidates = [
        operationStartedAtMsFromMeta,
        missionFirstFlightStartMs,
        activeFlightStartMs,
        operationAnchorBootstrapMs
    ].filter((value) => Number.isFinite(value) && value > 0);

    const hasPersistentOperationAnchor =
        operationStartedAtMsFromMeta > 0 ||
        missionFirstFlightStartMs > 0 ||
        activeFlightStartMs > 0;

    const operationStartedAtMs = operationAnchorCandidates.length > 0
        ? Math.min(...operationAnchorCandidates)
        : 0;

    const operationElapsedSeconds = operationStartedAtMs > 0
        ? Math.max(0, Math.floor((nowMs - operationStartedAtMs) / 1000))
        : 0;

    // ── Pilot Audio: Upload telemetry and trigger AI audit (fire-and-forget) ──
    const uploadPilotTelemetry = useCallback(async (blob, flightNumber) => {
        if (!blob || !journeyId || preview) return;
        try {
            // Convert WebM→MP3 for OpenAI audio analysis compatibility
            let uploadBlob = blob;
            let uploadFilename = 'pilot_narration.webm';
            let uploadMime = 'audio/webm';
            try {
                const { convertToMp3 } = await import('@/utils/convertToMp3');
                const mp3Blob = await convertToMp3(blob);
                if (mp3Blob && mp3Blob.size > 0) {
                    uploadBlob = mp3Blob;
                    uploadFilename = 'pilot_narration.mp3';
                    uploadMime = 'audio/mp3';
                }
            } catch (convErr) {
                console.warn('⚠️ MP3 conversion skipped:', convErr?.message);
            }

            const formData = new FormData();
            formData.append('audio', uploadBlob, uploadFilename);
            formData.append('journeyId', journeyId);
            formData.append('flightNumber', String(flightNumber || 0));
            formData.append('userId', userId || '');
            formData.append('durationSeconds', String(pilotRecDurationRef.current || 0));
            formData.append('source', 'pilot_narration');

            const res = await fetch('/api/staff/upload-telemetry', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.ok && data.url) {
                // 🧠 AI Quality Audit — fire-and-forget (never blocks Pilot)
                triggerAudioAudit({
                    audioUrl: data.url,
                    journeyId,
                    flightNumber,
                    source: 'pilot_narration',
                    userId,
                    durationSeconds: pilotRecDurationRef.current || 0,
                    onFeedback: ({ score, feedback, strikes }) => {
                        setPilotQaFeedback({ score, feedback, strikes });
                    }
                });
            }
        } catch (err) {
            console.warn('⚠️ Pilot telemetry upload error (non-blocking):', err);
        }
    }, [journeyId, userId, preview]);

    const clearActiveFlight = async (closedFlightId = null) => {
        if (closedFlightId && !preview) {
            rememberClosedFlightId(closedFlightId);
        }
        setActiveFlight(null);
        persistActiveFlightCache(null);

        const fallbackOperationAnchor = operationStartedAtMs > 0
            ? new Date(operationStartedAtMs).toISOString()
            : null;

        await persistActiveFlightInJourneyMeta(
            null,
            fallbackOperationAnchor
                ? { operationStartedAt: fallbackOperationAnchor }
                : undefined
        );
    };

    const handleFlightStart = async (payload) => {
        const missionId = currentMission?.id || null;
        const sourceLogs = preview
            ? (flightLogs || [])
            : safeParseJson(localStorage.getItem('flyhigh_flight_logs'), []);

        const completedMissionFlights = dedupeFlightLogs(
            Array.isArray(sourceLogs)
                ? sourceLogs.filter((log) => isMissionFlightLog(log, missionId, journeyId))
                : []
        );

        const fallbackFlightNumber = completedMissionFlights.length + 1;
        const resolvedFlightNumber = normalizePositiveInt(payload?.flightNumber) || fallbackFlightNumber;

        const normalizedStart = normalizeActiveFlightPayload({
            ...payload,
            flightNumber: resolvedFlightNumber,
            status: 'active',
            mission_id: currentMission?.id || null,
            journey_id: journeyId || null,
            createdBy: userId || null,
            createdByName: profile?.full_name || null,
            updatedAt: new Date().toISOString()
        });

        if (!normalizedStart) return;

        forgetClosedFlightId(normalizedStart.flightId);

        setActiveFlight(normalizedStart);
        persistActiveFlightCache(normalizedStart);

        const fallbackOperationAnchorMs = operationStartedAtMs > 0
            ? operationStartedAtMs
            : toIsoEpochMs(normalizedStart.startedAt ?? normalizedStart.start_time ?? normalizedStart.startTime);

        const fallbackOperationAnchor = fallbackOperationAnchorMs > 0
            ? new Date(fallbackOperationAnchorMs).toISOString()
            : null;

        await persistActiveFlightInJourneyMeta(
            normalizedStart,
            fallbackOperationAnchor
                ? { operationStartedAt: fallbackOperationAnchor }
                : undefined
        );

        // ── Flight Audio: Crossfade boarding→in_flight on takeoff ──
        flightAudio.transitionToFlight();

        // ── Copilot AI: Auto-activate on takeoff ──
        setVoiceIsActive(true);

        // ── Pilot Audio: Start recording on takeoff (fire-and-forget) ──
        if (currentRole === 'pilot' && pilotMicSupported && !pilotRecording) {
            startPilotRecording().catch(err => console.warn('⚠️ Pilot mic auto-start failed:', err));
        }
    };

    const handleFlightCancel = async () => {
        // ── Pilot Audio: Discard recording on cancel ──
        if (pilotRecording) {
            cancelPilotRecording();
        }
        await clearActiveFlight();
    };

    const handleOpenPauseMenu = () => {
        setShowMenu(false);
        setShowPauseMenu(true);
    };

    const handleStartPause = async (pauseData) => {
        // Preview: solo actualizar UI, no sincronizar
        if (preview) {
            setActivePause({
                type: pauseData.type,
                reason: pauseData.reason,
                startTime: new Date().toISOString(),
                pauseId: `preview-${Date.now()}`
            });
            return;
        }

        const result = await syncPauseStart({
            ...pauseData,
            mission_id: currentMission.id
        });

        setActivePause({
            type: pauseData.type,
            reason: pauseData.reason,
            startTime: new Date().toISOString(),
            pauseId: result.pauseId || `local-${Date.now()}`
        });

        localStorage.setItem('flyhigh_active_pause', JSON.stringify({
            type: pauseData.type,
            reason: pauseData.reason,
            startTime: new Date().toISOString(),
            pauseId: result.pauseId || `local-${Date.now()}`
        }));
    };

    const handleRequestResume = () => {
        setShowResumeModal(true);
    };

    const handleConfirmResume = async (resumeChecklist) => {
        // Preview: solo actualizar UI
        if (preview) {
            const completedPause = { ...activePause, endTime: new Date().toISOString(), resumeChecklist };
            setCompletedPauses(prev => [...prev, completedPause]);
            setActivePause(null);
            setShowResumeModal(false);
            return;
        }

        if (activePause?.pauseId) {
            await syncPauseEnd(activePause.pauseId, resumeChecklist);
        }

        const completedPause = {
            ...activePause,
            mission_id: currentMission?.id,
            endTime: new Date().toISOString(),
            resumeChecklist
        };
        const updatedPauses = [...completedPauses, completedPause];
        setCompletedPauses(updatedPauses);
        localStorage.setItem('flyhigh_completed_pauses', JSON.stringify(updatedPauses));

        setActivePause(null);
        setShowResumeModal(false);
        localStorage.removeItem('flyhigh_active_pause');
    };

    const handleFlightComplete = async (data) => {
        const completedFlightId = normalizeFlightId(data?.flightId) || `flight-${Date.now()}`;
        const completedFingerprint = buildFlightFingerprint(data);
        const missionId = currentMission?.id || null;

        const sourceLogsForNumber = preview
            ? (flightLogs || [])
            : safeParseJson(localStorage.getItem('flyhigh_flight_logs'), []);

        const completedMissionFlights = dedupeFlightLogs(
            Array.isArray(sourceLogsForNumber)
                ? sourceLogsForNumber.filter((log) => isMissionFlightLog(log, missionId, journeyId))
                : []
        );

        const completedFlightNumber = normalizePositiveInt(data?.flightNumber) || (completedMissionFlights.length + 1);

        if (processingFlightIdsRef.current.has(completedFlightId)) {
            return;
        }

        processingFlightIdsRef.current.add(completedFlightId);

        // Preview: solo actualizar UI local, no guardar en localStorage ni sincronizar
        try {
            // ── Flight Audio: Crossfade in_flight→boarding on landing ──
            flightAudio.transitionToBoarding();

            // ── Copilot AI: Auto-deactivate on landing ──
            setVoiceIsActive(false);

            // ── Pilot Audio: Stop recording on landing (fire-and-forget) ──
            if (currentRole === 'pilot' && pilotRecording) {
                try {
                    const blob = await stopPilotRecording();
                    if (blob && blob.size > 0) {
                        uploadPilotTelemetry(blob, completedFlightNumber);
                    }
                } catch (err) { console.warn('⚠️ Pilot mic stop failed:', err); }
            }

            if (preview) {
                const newLog = {
                    ...data,
                    flightId: completedFlightId,
                    flightNumber: completedFlightNumber,
                    mission_id: currentMission?.id || null,
                    journey_id: journeyId || null,
                    id: Date.now(),
                    synced: false
                };
                setFlightLogs((prev) => dedupeFlightLogs([...prev, newLog]));
                await clearActiveFlight(completedFlightId);
                return;
            }

            const existingLogsRaw = safeParseJson(localStorage.getItem('flyhigh_flight_logs'), []);
            const existingLogs = dedupeFlightLogs(Array.isArray(existingLogsRaw) ? existingLogsRaw : []);
            const alreadySaved = existingLogs.some((log) => {
                const sameFlightId = normalizeFlightId(log?.flightId) === completedFlightId;
                const sameFingerprint = completedFingerprint && buildFlightFingerprint(log) === completedFingerprint;
                return sameFlightId || sameFingerprint;
            });

            if (alreadySaved) {
                await clearActiveFlight(completedFlightId);
                return;
            }

            const newLog = {
                ...data,
                flightId: completedFlightId,
                flightNumber: completedFlightNumber,
                mission_id: currentMission.id,
                journey_id: journeyId || null,
                mission_data: currentMission,
                id: Date.now(),
                synced: false
            };
            const updatedLogs = dedupeFlightLogs([...existingLogs, newLog]);

            localStorage.setItem('flyhigh_flight_logs', JSON.stringify(updatedLogs));
            setFlightLogs(updatedLogs);
            await clearActiveFlight(completedFlightId);

            // [CRITICAL FIX] Always attempt sync — navigator.onLine is unreliable on mobile PWAs
            // If sync fails, the retry queue (every 30s) will pick it up automatically
            const success = await syncFlightLog(newLog);
            if (success) {
                newLog.synced = true;
                const syncedLogs = dedupeFlightLogs(updatedLogs.map(l => l.id === newLog.id ? newLog : l));
                localStorage.setItem('flyhigh_flight_logs', JSON.stringify(syncedLogs));
                setFlightLogs(syncedLogs);
                setPendingSyncCount(prev => Math.max(0, prev - 1));
            } else {
                setPendingSyncCount(prev => prev + 1);
                console.warn('⚠️ Sync falló — vuelo en cola de retry automático (cada 30s)');
            }
        } finally {
            processingFlightIdsRef.current.delete(completedFlightId);
        }
    };

    const closeFlightEditModal = () => {
        if (isSavingFlightEdit) return;
        setFlightEditModal(null);
        setEditedStudentCount('0');
        setFlightEditReason('');
    };

    const handleRequestEditFlight = (flight) => {
        if (!flight || typeof flight !== 'object') return;

        const currentStudents = Number(flight.studentCount ?? flight.student_count ?? 0);
        const safeCurrentStudents = Number.isFinite(currentStudents) && currentStudents >= 0
            ? Math.floor(currentStudents)
            : 0;

        setFlightEditModal({
            flight,
            currentStudents: safeCurrentStudents,
            flightNumber: normalizePositiveInt(flight.flightNumber ?? flight.flight_number) || null
        });
        setEditedStudentCount(String(safeCurrentStudents));
        setFlightEditReason('');
    };

    const handleConfirmFlightStudentEdit = async () => {
        if (!flightEditModal?.flight) return;

        const nextCountParsed = Number(editedStudentCount);
        const nextStudentCount = Number.isFinite(nextCountParsed)
            ? Math.max(0, Math.floor(nextCountParsed))
            : NaN;

        if (!Number.isFinite(nextStudentCount)) {
            alert('Ingresa un número válido de alumnos.');
            return;
        }

        const reason = String(flightEditReason || '').trim();
        if (reason.length < 6) {
            alert('Agrega un motivo breve para el ajuste (mínimo 6 caracteres).');
            return;
        }

        const targetFlight = flightEditModal.flight;
        const currentLogs = dedupeFlightLogs(Array.isArray(flightLogs) ? flightLogs : []);
        const targetLog = currentLogs.find((row) => isSameFlightLogEntry(row, targetFlight));

        if (!targetLog) {
            alert('No se encontró el vuelo a editar en esta sesión.');
            return;
        }

        const previousStudentCountRaw = Number(targetLog.studentCount ?? targetLog.student_count ?? 0);
        const previousStudentCount = Number.isFinite(previousStudentCountRaw)
            ? Math.max(0, Math.floor(previousStudentCountRaw))
            : 0;

        if (nextStudentCount === previousStudentCount) {
            closeFlightEditModal();
            return;
        }

        const startMs = toIsoEpochMs(targetLog.startTime ?? targetLog.start_time);
        const endMs = toIsoEpochMs(targetLog.endTime ?? targetLog.end_time ?? targetLog.created_at);

        if (!startMs || !endMs) {
            alert('No se pudo identificar el vuelo en base de datos.');
            return;
        }

        if (preview) {
            const updatedLogs = dedupeFlightLogs(
                currentLogs.map((row) => {
                    if (!isSameFlightLogEntry(row, targetLog)) return row;
                    return {
                        ...row,
                        studentCount: nextStudentCount,
                        student_count: nextStudentCount,
                        student_edit_reason: reason,
                        student_edit_at: new Date().toISOString(),
                        student_edit_previous_count: previousStudentCount
                    };
                })
            );
            setFlightLogs(updatedLogs);
            setFlightEditModal(null);
            return;
        }

        if (!navigator.onLine) {
            alert('Necesitas conexión para editar alumnos y sincronizar con centro de control.');
            return;
        }


        setIsSavingFlightEdit(true);

        try {
            const response = await fetch('/api/staff/update-flight-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    journeyId: targetLog.journey_id || journeyId || null,
                    missionId: targetLog.mission_id || currentMission?.id || null,
                    cloudRowId: targetLog.cloud_row_id || null,
                    startTime: new Date(startMs).toISOString(),
                    endTime: new Date(endMs).toISOString(),
                    previousStudentCount,
                    newStudentCount: nextStudentCount,
                    reason,
                    actorUserId: userId || null,
                    actorName: profile?.full_name || firstName,
                    actorRole: profile?.role || null,
                    localFlightId: targetLog.flightId || targetLog.id || null
                })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                const message = payload?.error || 'No se pudo editar el vuelo.';
                throw new Error(message);
            }

            const cloudRowId = payload?.flight?.id || targetLog.cloud_row_id || null;

            const updatedLogs = dedupeFlightLogs(
                currentLogs.map((row) => {
                    if (!isSameFlightLogEntry(row, targetLog)) return row;
                    return {
                        ...row,
                        studentCount: nextStudentCount,
                        student_count: nextStudentCount,
                        synced: true,
                        cloud_row_id: cloudRowId,
                        student_edit_reason: reason,
                        student_edit_at: payload?.edited_at || new Date().toISOString(),
                        student_edit_previous_count: previousStudentCount
                    };
                })
            );

            localStorage.setItem('flyhigh_flight_logs', JSON.stringify(updatedLogs));
            setFlightLogs(updatedLogs);
            setFlightEditModal(null);

            // [FIX] No longer calling onRefresh() — the local state update above is sufficient.
            // Calling onRefresh triggers refreshMission in the parent, which re-renders the entire
            // component tree and wipes activeFlight state. The student count is already updated
            // in both React state and localStorage, so no parent refresh is needed.

            alert('Ajuste de alumnos guardado y sincronizado.');
        } catch (error) {
            console.error('Error editing flight students:', error);
            alert(error?.message || 'No se pudo guardar el ajuste de alumnos.');
        } finally {
            setIsSavingFlightEdit(false);
        }
    };

    useEffect(() => {
        if (!journeyId || !isOperationPhaseActive) {
            setOperationAnchorBootstrapMs(0);
            return;
        }

        if (hasPersistentOperationAnchor) {
            if (operationAnchorBootstrapMs !== 0) {
                setOperationAnchorBootstrapMs(0);
            }
            return;
        }

        if (operationAnchorBootstrapMs === 0) {
            setOperationAnchorBootstrapMs(Date.now());
        }
    }, [journeyId, isOperationPhaseActive, hasPersistentOperationAnchor, operationAnchorBootstrapMs]);

    useEffect(() => {
        lastSyncedOperationAnchorMsRef.current = 0;
        operationAnchorSyncInFlightRef.current = false;
    }, [journeyId]);

    useEffect(() => {
        if (preview || !journeyId || !isOperationPhaseActive) return;
        if (operationStartedAtMs <= 0) return;
        if (operationAnchorSyncInFlightRef.current) return;

        const shouldSyncAnchor =
            lastSyncedOperationAnchorMsRef.current <= 0 ||
            operationStartedAtMs < lastSyncedOperationAnchorMsRef.current;

        if (!shouldSyncAnchor) return;

        operationAnchorSyncInFlightRef.current = true;
        const anchorIso = new Date(operationStartedAtMs).toISOString();

        persistActiveFlightInJourneyMeta(
            activeFlight,
            { operationStartedAt: anchorIso }
        )
            .then(() => {
                lastSyncedOperationAnchorMsRef.current = operationStartedAtMs;
            })
            .finally(() => {
                operationAnchorSyncInFlightRef.current = false;
            });
    }, [
        activeFlight,
        isOperationPhaseActive,
        journeyId,
        operationStartedAtMs,
        persistActiveFlightInJourneyMeta,
        preview
    ]);

    if (isRestoring) return null;

    if (!currentMission) {
        return (
            <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4">
                <MissionSelector onSelect={handleSelectMission} />

                {!hideMenu && (
                    <div className="mt-12 text-center pb-8 border-t border-slate-100 pt-8 space-y-4">
                        <button
                            onClick={() => router.push('/staff/history')}
                            className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
                        >
                            <Clock size={18} /> Ver Historial de Misiones
                        </button>

                        <button onClick={handleLogout} className="text-sm text-slate-400 underline hover:text-slate-600 flex items-center justify-center gap-2 mx-auto p-4">
                            <LogOut size={16} /> Cerrar Sesión Staff
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <OperationUI
                missionInfo={currentMission}
                activeFlight={activeFlight}
                missionFlights={missionFlights}
                nextFlightNumber={nextFlightNumber}
                activeFlightNumber={activeFlightNumber}
                activePause={activePause}
                completedPauses={completedPauses}
                operationElapsedSeconds={operationElapsedSeconds}
                showOperationTimer={operationStartedAtMs > 0}
                interFlightElapsedSeconds={interFlightElapsedSeconds}
                showInterFlightTimer={showInterFlightTimer}
                totalStudentsFlown={totalStudentsFlown}
                pendingSyncCount={pendingSyncCount}
                onFlightStart={handleFlightStart}
                onFlightComplete={(data) => {
                    // ── Escuadrón: Intercept for Auxiliar Emocionómetro ──
                    if (currentRole === 'assistant' || currentRole === 'auxiliar') {
                        setPendingFlightForEmotion(data);
                        setShowEmotionModal(true);
                        return;
                    }
                    return handleFlightComplete(data);
                }}
                onFlightCancel={handleFlightCancel}
                onStartPause={handleStartPause}
                onRequestResume={() => setShowResumeModal(true)}
                onConfirmResume={handleConfirmResume}
                onCloseOperation={handleCloseDay}
                onRequestEditFlight={handleRequestEditFlight}
                onChangeSchool={handleChangeSchool}
                onViewHistory={() => router.push('/staff/history')}
                onViewPOI={() => router.push('/staff/poi')}
                onLogout={handleLogout}
                hideMenu={hideMenu}
                isSimulation={false}
                canEditCompletedFlights={canEditCompletedFlights}
                pilotRecording={pilotRecording}
                pilotMicPermission={pilotMicPermission}
                pilotMicSupported={pilotMicSupported}
                onRetryMicPermission={currentRole === 'pilot' ? async () => {
                    const ok = await startPilotRecording();
                    if (ok) cancelPilotRecording();
                    return ok;
                } : null}
                currentRole={currentRole}
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
                headerSlot={
                    shouldUseSyncHeader ? (
                        <ContingencyBypassMenu
                            journeyId={journeyId}
                            userId={userId}
                            profile={profile}
                            missionState={missionState}
                            missionInfo={currentMission}
                            onRefresh={onRefresh}
                        >
                            <SyncHeader
                                avatarConfig={profile?.avatar_config}
                                firstName={firstName}
                                roleName={roleName}
                                role={currentRole}
                                journeyId={journeyId}
                                userId={userId}
                                missionInfo={currentMission}
                                missionState={missionState}
                                onDemoStart={onRefresh}
                                onCloseMission={handleCloseDay}
                            />
                        </ContingencyBypassMenu>
                    ) : null
                }
                escuadronSlot={
                    <>
                        {/* ── Escuadrón: Bitácora Banner for Pilot ── */}
                        {(currentRole === 'pilot' || (isContingencyNoPilot && (currentRole === 'assistant' || currentRole === 'auxiliar'))) && (
                            <BitacoraPilotBanner
                                missionInfo={currentMission}
                                activeFlight={activeFlight}
                                nextFlightNumber={nextFlightNumber}
                            />
                        )}

                        {/* ── Escuadrón: Bitácora FAB for Supervisor ── */}
                        {(currentRole === 'teacher') && (
                            <button
                                onClick={() => setShowBitacoraModal(true)}
                                style={{
                                    position: 'fixed', bottom: 100, right: 20, zIndex: 45,
                                    width: 56, height: 56, borderRadius: 18,
                                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                                    border: 'none', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 12px 28px -6px rgba(124,58,237,0.5)',
                                    cursor: 'pointer'
                                }}
                                title="Bitácora Digital"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>edit_note</span>
                            </button>
                        )}

                        {/* ── Escuadrón: Briefing Overlay ── */}
                        {!escuadronBriefingDone && !preview && currentMission && (
                            <EscuadronBriefingOverlay
                                journeyId={journeyId}
                                profile={profile}
                                onComplete={() => setEscuadronBriefingDone(true)}
                            />
                        )}

                        {/* ── Escuadrón: Bitácora Modal (Supervisor) ── */}
                        <SquadronBitacoraModal
                            isOpen={showBitacoraModal}
                            onClose={() => setShowBitacoraModal(false)}
                            journeyId={journeyId}
                            flightNumber={nextFlightNumber}
                            missionInfo={currentMission}
                        />

                        {/* ── Escuadrón: Emocionómetro Modal (Auxiliar) ── */}
                        <EmotionRatingModal
                            isOpen={showEmotionModal}
                            flightNumber={missionFlights.length + 1}
                            flightStudentCount={pendingFlightForEmotion?.studentCount || 0}
                            onSubmit={async (scoreData) => {
                                setShowEmotionModal(false);
                                if (pendingFlightForEmotion) {
                                    try {
                                        await handleFlightComplete({
                                            ...pendingFlightForEmotion,
                                            _escuadronEmotionScore: scoreData.score,
                                            _escuadronCompliance: scoreData.compliance
                                        });
                                    } catch (err) {
                                        console.warn('⚠️ Flight complete after emotion failed:', err);
                                    }
                                    setPendingFlightForEmotion(null);
                                }
                            }}
                            onSkip={() => {
                                setShowEmotionModal(false);
                                if (pendingFlightForEmotion) {
                                    handleFlightComplete(pendingFlightForEmotion).catch(() => {});
                                    setPendingFlightForEmotion(null);
                                }
                            }}
                        />

                        {/* ── Escuadrón: Debrief Modal ── */}
                        <EscuadronDebriefModal
                            isOpen={showDebriefModal}
                            journeyId={journeyId}
                            profile={profile}
                            onComplete={() => {
                                setShowDebriefModal(false);
                                // After debrief, proceed to close — handled by OperationUI
                            }}
                            onSkip={() => {
                                setShowDebriefModal(false);
                            }}
                        />

                        {/* ── Flight Edit Modal ── */}
                        {flightEditModal && (
                            <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-[1px] px-4 py-6 flex items-center justify-center">
                                <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-[0_30px_60px_-28px_rgba(15,23,42,0.6)] p-5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ajuste operativo</p>
                                    <h3 className="text-lg font-black text-slate-900 mt-1">Editar alumnos del Vuelo #{flightEditModal.flightNumber || '--'}</h3>
                                    <p className="text-xs text-slate-500 mt-1">Este ajuste se sincroniza con el centro de control en tiempo real.</p>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Actual</p>
                                            <p className="text-xl font-black text-slate-800 tabular-nums">{flightEditModal.currentStudents}</p>
                                        </div>
                                        <label className="rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Nuevo</p>
                                            <input
                                                type="number" min={0} step={1}
                                                value={editedStudentCount}
                                                onChange={(e) => setEditedStudentCount(e.target.value)}
                                                className="w-full bg-transparent text-xl font-black text-slate-900 outline-none tabular-nums"
                                                disabled={isSavingFlightEdit}
                                            />
                                        </label>
                                    </div>
                                    <label className="block mt-3">
                                        <p className="text-[11px] font-bold text-slate-700 mb-1">Motivo del ajuste</p>
                                        <textarea
                                            value={flightEditReason}
                                            onChange={(e) => setFlightEditReason(e.target.value)}
                                            placeholder="Ej. Se repite alumno por falla de gafa en vuelo anterior"
                                            rows={3} maxLength={220} disabled={isSavingFlightEdit}
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                                            style={{ resize: 'none' }}
                                        />
                                    </label>
                                    <p className="text-[10px] text-slate-500 mt-2">Este cambio solo ajusta el conteo de alumnos del vuelo seleccionado.</p>
                                    <div className="mt-4 flex items-center justify-end gap-2">
                                        <button onClick={closeFlightEditModal} disabled={isSavingFlightEdit} className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold bg-white hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
                                        <button onClick={handleConfirmFlightStudentEdit} disabled={isSavingFlightEdit} className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60">
                                            {isSavingFlightEdit ? 'Guardando...' : 'Guardar ajuste'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 🧠 AI Quality Modal (Pilot Feedback) */}
                        {pilotQaFeedback && (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 20, animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}>
                                <div style={{
                                    background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 32, width: '100%', maxWidth: 400, padding: 32,
                                    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'
                                }}>
                                    <div style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        background: pilotQaFeedback.score >= 80 ? 'rgba(16, 185, 129, 0.1)' : pilotQaFeedback.score >= 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `2px solid ${pilotQaFeedback.score >= 80 ? '#10B981' : pilotQaFeedback.score >= 60 ? '#FBBF24' : '#F87171'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 20,
                                        boxShadow: `0 0 30px ${pilotQaFeedback.score >= 80 ? 'rgba(16, 185, 129, 0.3)' : pilotQaFeedback.score >= 60 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                    }}>
                                        <span style={{ fontSize: 32, fontWeight: 900, color: pilotQaFeedback.score >= 80 ? '#10B981' : pilotQaFeedback.score >= 60 ? '#FBBF24' : '#F87171' }}>
                                            {pilotQaFeedback.score}
                                        </span>
                                    </div>
                                    <h3 style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 900, margin: '0 0 8px', textAlign: 'center' }}>Reporte de IA</h3>
                                    <p style={{ color: '#94A3B8', fontSize: 15, margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5 }}>{pilotQaFeedback.feedback}</p>
                                    {pilotQaFeedback.strikes && pilotQaFeedback.strikes.length > 0 && (
                                        <div style={{ width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
                                            <p style={{ color: '#F87171', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                                                Áreas de oportunidad ({pilotQaFeedback.strikes.length})
                                            </p>
                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {pilotQaFeedback.strikes.map((strike, i) => (
                                                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                        <span style={{ color: '#F87171', fontSize: 16, lineHeight: 1 }}>✖</span>
                                                        <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{strike}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setPilotQaFeedback(null)}
                                        style={{
                                            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                                            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                                            color: 'white', fontSize: 16, fontWeight: 800, textTransform: 'uppercase',
                                            cursor: 'pointer', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.4)'
                                        }}
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                }
            />
        </>
    );
}

