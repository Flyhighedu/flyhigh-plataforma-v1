export function normalizeSchoolName(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function parseMissionData(value) {
    if (!value) return {};

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_error) {
            return {};
        }
    }

    return typeof value === 'object' ? value : {};
}

export function missionDateTimeFromClosure(closure) {
    return (
        closure?.mission_datetime ||
        closure?.end_time ||
        closure?.created_at ||
        null
    );
}

export function buildSchoolMapById(schools) {
    const map = {};

    for (const school of schools || []) {
        const name = normalizeSchoolName(school?.nombre_escuela) || normalizeSchoolName(school?.school_name);
        if (!name || school?.id === undefined || school?.id === null) continue;

        map[String(school.id)] = name;
    }

    return map;
}

export function buildFlightSnapshotMap(flights) {
    const map = {};

    for (const flight of flights || []) {
        const missionId = flight?.mission_id;
        if (!missionId) continue;

        const missionData = parseMissionData(flight?.mission_data);
        const snapshotName =
            normalizeSchoolName(missionData?.school_name) ||
            normalizeSchoolName(missionData?.nombre_escuela);

        if (!snapshotName) continue;

        const key = String(missionId);
        if (!map[key]) {
            map[key] = snapshotName;
        }
    }

    return map;
}

export function resolveHistorySchoolName({ closure, schoolMapById, flightSnapshotMap }) {
    const missionId = closure?.mission_id;
    const missionIdKey = missionId !== null && missionId !== undefined ? String(missionId) : null;

    const linkedSchoolId =
        closure?.school_id !== null && closure?.school_id !== undefined
            ? String(closure.school_id)
            : missionIdKey && /^\d+$/.test(missionIdKey)
                ? missionIdKey
                : null;

    if (linkedSchoolId && schoolMapById?.[linkedSchoolId]) {
        return schoolMapById[linkedSchoolId];
    }

    const snapshotName = normalizeSchoolName(closure?.school_name_snapshot);
    if (snapshotName) {
        return snapshotName;
    }

    if (missionIdKey && flightSnapshotMap?.[missionIdKey]) {
        return flightSnapshotMap[missionIdKey];
    }

    return 'Escuela no vinculada';
}

export function formatDateAndTime(value) {
    const dateObj = value ? new Date(value) : null;
    const isValid = dateObj && !Number.isNaN(dateObj.getTime());

    if (!isValid) {
        return {
            date: 'Fecha no disponible',
            time: '--:--'
        };
    }

    return {
        date: dateObj.toLocaleDateString(),
        time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
}
