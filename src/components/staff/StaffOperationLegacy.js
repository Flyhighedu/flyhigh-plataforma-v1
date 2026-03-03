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
import { syncFlightLog, syncPauseStart, syncPauseEnd } from '@/utils/staff/sync';
import { LogOut, MoreVertical, RotateCcw, Clock, Pause } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import MissionSelector from '@/components/staff/MissionSelector';
import PauseMenu from '@/components/staff/PauseMenu';
import PauseActiveOverlay from '@/components/staff/PauseActiveOverlay';
import ResumeProtocolModal from '@/components/staff/ResumeProtocolModal';
import SyncHeader from '@/components/staff/SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';

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
    } catch {
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
    const [currentMission, setCurrentMission] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true);
    const [flightLogs, setFlightLogs] = useState([]);
    const [activeFlight, setActiveFlight] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [closeHoldProgress, setCloseHoldProgress] = useState(0);
    const [isClosingOperation, setIsClosingOperation] = useState(false);
    const [closeOperationError, setCloseOperationError] = useState(null);

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
            if (navigator.onLine) {
                supabase.auth.refreshSession().then(({ error }) => {
                    if (error) console.warn("Session refresh failed:", error);
                });
            }
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
            if (onCloseDay) {
                await onCloseDay();
            } else {
                router.push('/staff/closure');
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
    }, [onCloseDay, router]);

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
        setShowCloseConfirmModal(true);
        resetCloseDayHold();
    }, [resetCloseDayHold]);

    const finalizeCloseDay = useCallback(async () => {
        if (closeHoldTriggeredRef.current) return;
        closeHoldTriggeredRef.current = true;
        setCloseHoldProgress(100);
        setIsClosingOperation(true);
        setCloseOperationError(null);
        try {
            await handleCloseDay();
        } catch {
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
    };

    const handleFlightCancel = async () => {
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

            if (navigator.onLine) {
                const success = await syncFlightLog(newLog);
                if (success) {
                    newLog.synced = true;
                    const syncedLogs = dedupeFlightLogs(updatedLogs.map(l => l.id === newLog.id ? newLog : l));
                    localStorage.setItem('flyhigh_flight_logs', JSON.stringify(syncedLogs));
                    setFlightLogs(syncedLogs);
                } else {
                    alert("⚠️ AVISO: El vuelo se guardó en tu dispositivo, pero falló la sincronización con la nube.\n\nPor favor, verifica tu conexión o vuelve a iniciar sesión si persiste.");
                }
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

    const currentRole = profile?.role || null;
    const firstName = profile?.full_name?.split(' ')[0] || 'Auxiliar';
    const roleName = ROLE_LABELS[currentRole] || currentRole || 'Auxiliar';
    const shouldUseSyncHeader = useSyncHeader && !hideMenu;
    const canEditCompletedFlights = currentRole === 'assistant' || currentRole === 'auxiliar' || currentRole === 'teacher';

    const missionMeta = parseMetaLike(currentMission?.meta || initialMission?.meta);

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
    const showInterFlightTimer = !activeFlight && missionFlights.length > 0 && lastMissionFlightEndMs > 0;
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
    const missionStateKey = String(missionState || '').trim();
    const isOperationPhaseActive = OPERATION_PHASE_STATES.has(missionStateKey);

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
        <div className="min-h-screen bg-slate-50 pb-20">
            {shouldUseSyncHeader && (
                <SyncHeader
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
            )}

            {/* Sticky Header (legacy fallback) */}
            {!hideMenu && !shouldUseSyncHeader && (
                <div className="sticky top-0 bg-white/95 backdrop-blur-md z-40 shadow-sm border-b border-slate-100 transition-all">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0 pr-2">
                            <h1 className="text-base font-bold text-slate-900 leading-tight truncate">{currentMission.school_name}</h1>
                            <p className="text-[10px] text-green-600 font-bold tracking-wide uppercase flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                En Operación
                            </p>
                        </div>

                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-full active:bg-slate-200"
                        >
                            <MoreVertical size={24} />
                        </button>
                    </div>

                    {showMenu && (
                        <div className="absolute top-full right-4 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <div className="p-2 space-y-1">
                                <button
                                    onClick={handleOpenPauseMenu}
                                    className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-lg flex items-center gap-3 text-amber-600 text-sm font-medium"
                                >
                                    <Pause size={18} /> Iniciar Pausa
                                </button>
                                <button
                                    onClick={handleChangeSchool}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium"
                                >
                                    <RotateCcw size={18} /> Cambiar Escuela
                                </button>
                                <button
                                    onClick={() => router.push('/staff/history')}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-lg flex items-center gap-3 text-slate-600 text-sm font-medium border-t border-slate-100"
                                >
                                    <Clock size={18} /> Historial de Misiones
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="px-4 py-6 space-y-8 max-w-lg mx-auto">
                <FlightLogger
                    key={activeFlight?.flightId ? `active-${activeFlight.flightId}` : 'idle-flight-logger'}
                    onFlightComplete={handleFlightComplete}
                    onFlightStart={handleFlightStart}
                    onFlightCancel={handleFlightCancel}
                    initialActiveFlight={activeFlight}
                    nextFlightNumber={nextFlightNumber}
                    activeFlightNumber={activeFlightNumber}
                    showInterFlightTimer={showInterFlightTimer}
                    interFlightElapsedSeconds={interFlightElapsedSeconds}
                    totalStudentsFlown={totalStudentsFlown}
                    totalOperationElapsedSeconds={operationElapsedSeconds}
                    showTotalOperationTimer={operationStartedAtMs > 0}
                    disabled={!!activePause}
                />

                <div className="pt-4 border-t border-slate-200">
                    <TodayFlightList
                        flights={missionFlights}
                        pauses={completedPauses.filter(p => p.mission_id === currentMission?.id)}
                        activeFlight={activeFlight}
                        onRequestEditFlight={canEditCompletedFlights ? handleRequestEditFlight : null}
                    />
                </div>

                <section className="rounded-2xl border border-blue-200 bg-white px-4 py-4 shadow-[0_18px_36px_-24px_rgba(30,64,175,0.35)]">
                    <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                        Cierre operativo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                        Cuando todo el registro de vuelos esté completo, cierra la operación de hoy.
                    </p>
                    <button
                        type="button"
                        onClick={openCloseConfirmModal}
                        className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-[0_16px_28px_-18px_rgba(37,99,235,0.6)] transition hover:bg-blue-700 active:scale-[0.99]"
                    >
                        Operación finalizada
                    </button>
                </section>
            </div>

            {/* Overlay to close menu */}
            {!shouldUseSyncHeader && showMenu && (
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}></div>
            )}

            {showCloseConfirmModal && (
                <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-[2px] px-4 py-6 flex items-end justify-center sm:items-center">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_36px_72px_-34px_rgba(15,23,42,0.65)]">
                        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                            Confirmar cierre
                        </p>
                        <h3 className="mt-1 text-xl font-black text-slate-900">
                            ¿Seguro que deseas finalizar la operación?
                        </h3>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                            Esta acción te llevará al flujo de cierre. Para evitar cierres accidentales, mantén presionado 2 segundos.
                        </p>

                        {closeOperationError && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                                <p className="text-xs font-bold text-red-700 m-0">Error de conexión</p>
                                <p className="text-xs text-red-600 m-0 mt-0.5">{closeOperationError}</p>
                            </div>
                        )}

                        <div className="mt-5 grid grid-cols-1 gap-2.5">
                            {isClosingOperation ? (
                                <div className="relative overflow-hidden rounded-2xl bg-blue-700 px-4 py-4 text-center text-white shadow-[0_18px_30px_-18px_rgba(37,99,235,0.65)]">
                                    <span className="inline-flex items-center gap-2 text-sm font-extrabold tracking-wide">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Procesando...
                                    </span>
                                    <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                                        <span className="block h-full w-full rounded-full bg-white" />
                                    </span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onMouseDown={handleCloseHoldStart}
                                    onMouseUp={handleCloseHoldCancel}
                                    onMouseLeave={handleCloseHoldCancel}
                                    onTouchStart={handleCloseHoldStart}
                                    onTouchEnd={handleCloseHoldCancel}
                                    onTouchCancel={handleCloseHoldCancel}
                                    onTouchMove={(e) => e.preventDefault()}
                                    style={{ touchAction: 'none' }}
                                    className="relative overflow-hidden rounded-2xl bg-blue-600 px-4 py-3.5 text-left text-white shadow-[0_18px_30px_-18px_rgba(37,99,235,0.65)] transition active:scale-[0.99]"
                                >
                                    <span className="block text-sm font-extrabold tracking-wide">
                                        {closeOperationError ? 'Reintentar' : 'Operación finalizada'}
                                    </span>
                                    <span className="mt-0.5 block text-xs font-semibold text-blue-100">
                                        Mantén presionado por 2s para confirmar
                                    </span>
                                    <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                                        <span
                                            className="block h-full rounded-full bg-white transition-[width] duration-75"
                                            style={{ width: `${closeHoldProgress}%` }}
                                        />
                                    </span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={closeCloseConfirmModal}
                                disabled={isClosingOperation}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={editedStudentCount}
                                    onChange={(event) => setEditedStudentCount(event.target.value)}
                                    className="w-full bg-transparent text-xl font-black text-slate-900 outline-none tabular-nums"
                                    disabled={isSavingFlightEdit}
                                />
                            </label>
                        </div>

                        <label className="block mt-3">
                            <p className="text-[11px] font-bold text-slate-700 mb-1">Motivo del ajuste</p>
                            <textarea
                                value={flightEditReason}
                                onChange={(event) => setFlightEditReason(event.target.value)}
                                placeholder="Ej. Se repite alumno por falla de gafa en vuelo anterior"
                                rows={3}
                                maxLength={220}
                                disabled={isSavingFlightEdit}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                                style={{ resize: 'none' }}
                            />
                        </label>

                        <p className="text-[10px] text-slate-500 mt-2">Este cambio solo ajusta el conteo de alumnos del vuelo seleccionado.</p>

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={closeFlightEditModal}
                                disabled={isSavingFlightEdit}
                                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold bg-white hover:bg-slate-50 disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmFlightStudentEdit}
                                disabled={isSavingFlightEdit}
                                className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
                            >
                                {isSavingFlightEdit ? 'Guardando...' : 'Guardar ajuste'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pause Menu Modal */}
            <PauseMenu
                isOpen={showPauseMenu}
                onClose={() => setShowPauseMenu(false)}
                onStartPause={handleStartPause}
            />

            {/* Pause Active Overlay */}
            {activePause && (
                <PauseActiveOverlay
                    pauseData={activePause}
                    onRequestResume={handleRequestResume}
                />
            )}

            {/* Resume Protocol Modal */}
            <ResumeProtocolModal
                isOpen={showResumeModal}
                onClose={() => setShowResumeModal(false)}
                onConfirmResume={handleConfirmResume}
            />
        </div>
    );
}
