'use client';

const FLIGHT_LOGS_KEY = 'flyhigh_flight_logs';
const ACTIVE_FLIGHT_KEY = 'flyhigh_active_flight';
const ACTIVE_PAUSE_KEY = 'flyhigh_active_pause';
const COMPLETED_PAUSES_KEY = 'flyhigh_completed_pauses';
const CLOSED_FLIGHTS_KEY = 'flyhigh_recently_closed_flights';
const STAFF_MISSION_KEY = 'flyhigh_staff_mission';

function safeParseJson(raw, fallback) {
    try {
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function normalizeJourneyId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeMissionId(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function writeArrayOrRemove(key, rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        localStorage.removeItem(key);
        return;
    }
    localStorage.setItem(key, JSON.stringify(rows));
}

export function clearJourneyLocalOperationalData(journeyId) {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { removedFlights: 0 };
    }

    const targetJourneyId = normalizeJourneyId(journeyId);
    if (!targetJourneyId) return { removedFlights: 0 };

    const missionRaw = safeParseJson(localStorage.getItem(STAFF_MISSION_KEY), null);
    const targetMissionId = normalizeMissionId(missionRaw?.id ?? missionRaw?.mission_id);

    const logsRaw = safeParseJson(localStorage.getItem(FLIGHT_LOGS_KEY), []);
    const logs = Array.isArray(logsRaw) ? logsRaw : [];
    const filteredLogs = logs.filter((log) => {
        const logJourneyId = normalizeJourneyId(log?.journey_id ?? log?.journeyId);
        const logMissionId = normalizeMissionId(log?.mission_id ?? log?.missionId);
        const isLegacyMissionRow = !logJourneyId && targetMissionId && logMissionId === targetMissionId;
        return logJourneyId !== targetJourneyId && !isLegacyMissionRow;
    });
    const removedFlights = Math.max(0, logs.length - filteredLogs.length);

    if (removedFlights > 0) {
        writeArrayOrRemove(FLIGHT_LOGS_KEY, filteredLogs);
    }

    const activeFlight = safeParseJson(localStorage.getItem(ACTIVE_FLIGHT_KEY), null);
    const activeFlightJourneyId = normalizeJourneyId(activeFlight?.journey_id ?? activeFlight?.journeyId);
    const activeFlightMissionId = normalizeMissionId(activeFlight?.mission_id ?? activeFlight?.missionId);
    const activeFlightLegacyMission = !activeFlightJourneyId && targetMissionId && activeFlightMissionId === targetMissionId;
    if (activeFlightJourneyId === targetJourneyId || activeFlightLegacyMission) {
        localStorage.removeItem(ACTIVE_FLIGHT_KEY);
    }

    const activePause = safeParseJson(localStorage.getItem(ACTIVE_PAUSE_KEY), null);
    const activePauseJourneyId = normalizeJourneyId(activePause?.journey_id ?? activePause?.journeyId);
    const activePauseMissionId = normalizeMissionId(activePause?.mission_id ?? activePause?.missionId);
    const activePauseLegacyMission = !activePauseJourneyId && targetMissionId && activePauseMissionId === targetMissionId;
    if (activePauseJourneyId === targetJourneyId || activePauseLegacyMission) {
        localStorage.removeItem(ACTIVE_PAUSE_KEY);
    }

    const completedPausesRaw = safeParseJson(localStorage.getItem(COMPLETED_PAUSES_KEY), []);
    const completedPauses = Array.isArray(completedPausesRaw) ? completedPausesRaw : [];
    const filteredPauses = completedPauses.filter((pause) => {
        const pauseJourneyId = normalizeJourneyId(pause?.journey_id ?? pause?.journeyId);
        const pauseMissionId = normalizeMissionId(pause?.mission_id ?? pause?.missionId);
        const isLegacyMissionPause = !pauseJourneyId && targetMissionId && pauseMissionId === targetMissionId;
        return pauseJourneyId !== targetJourneyId && !isLegacyMissionPause;
    });

    if (filteredPauses.length !== completedPauses.length) {
        writeArrayOrRemove(COMPLETED_PAUSES_KEY, filteredPauses);
    }

    if (window.sessionStorage) {
        window.sessionStorage.removeItem(CLOSED_FLIGHTS_KEY);
    }

    return { removedFlights };
}
