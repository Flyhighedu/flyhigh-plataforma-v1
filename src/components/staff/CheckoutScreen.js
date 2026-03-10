'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    GraduationCap,
    HandHeart,
    Loader2,
    MapPin,
    Plane,
    User
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { parseMeta } from '@/utils/metaHelpers';
import { STAFF_CONFIG } from '@/config/staffConfig';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';
import HeaderOperativo from './HeaderOperativo';
import HeaderHamburgerMenu from './HeaderHamburgerMenu';
import { useRouter } from 'next/navigation';
import { clearJourneyLocalOperationalData } from '@/utils/staff/resetJourneyLocalData';
import { getPendingUploads, syncAllPending, clearLocalProgress, removePendingUpload } from '@/utils/offlineSyncManager';

const TEAM_ROLES = ['pilot', 'teacher', 'assistant'];

const EMPTY_TEAM_STATUS = Object.freeze({
    pilot: false,
    teacher: false,
    assistant: false
});

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'docente') return 'teacher';
    if (normalized === 'auxiliar' || normalized === 'aux') return 'assistant';
    return normalized;
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [head] = normalized.split(/\s+/);
    return head || fallback;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
}

function capitalizeSentence(text) {
    const safeText = String(text || '').trim();
    if (!safeText) return '';
    return safeText.charAt(0).toUpperCase() + safeText.slice(1);
}

function getTimeBasedGreeting(now = new Date()) {
    const hour = now.getHours();
    if (hour < 12) return '¡Buenos días!';
    if (hour < 19) return '¡Buenas tardes!';
    return '¡Buenas noches!';
}

function getTodayDateLabel(now = new Date()) {
    const dateLabel = now.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
    return capitalizeSentence(dateLabel);
}

function formatMissionDate(rawDate) {
    if (!rawDate) return 'Por confirmar';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return String(rawDate);
    const label = parsed.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
    return capitalizeSentence(label);
}

function toPositiveInteger(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num);
}

function sumStudentsFromFlightLogs(logs = [], journeyId = null) {
    if (!Array.isArray(logs)) return 0;

    const targetJourneyId = String(journeyId || '').trim();

    return logs.reduce((total, row) => {
        const rowJourneyId = String(row?.journey_id ?? row?.journeyId ?? '').trim();
        if (targetJourneyId && rowJourneyId && rowJourneyId !== targetJourneyId) {
            return total;
        }

        const hasCompletedTimestamp = Boolean(row?.end_time || row?.endTime || row?.created_at);
        if (!hasCompletedTimestamp) return total;

        const count = toPositiveInteger(row?.student_count ?? row?.students_count ?? row?.studentCount);
        return total + (count || 0);
    }, 0);
}

function readJourneyStudentsFromLocalLogs(journeyId) {
    if (typeof window === 'undefined') return 0;

    const targetJourneyId = String(journeyId || '').trim();
    if (!targetJourneyId) return 0;

    try {
        const logs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
        return sumStudentsFromFlightLogs(logs, targetJourneyId);
    } catch {
        return 0;
    }
}

function sumStudentsFromMissionLogs(logs = []) {
    if (!Array.isArray(logs)) return 0;
    return logs.reduce((total, row) => {
        const hasCompletedTimestamp = Boolean(row?.end_time || row?.endTime || row?.created_at);
        if (!hasCompletedTimestamp) return total;
        const count = toPositiveInteger(row?.student_count ?? row?.students_count ?? row?.studentCount);
        return total + (count || 0);
    }, 0);
}

function resolveMissionId(missionInfo, missionMeta) {
    const candidate = missionInfo?.id ?? missionInfo?.mission_id ?? missionMeta?.mission_id ?? null;
    const normalized = String(candidate || '').trim();
    return normalized || null;
}

async function fetchJourneyStudentsCount({ journeyId, missionId }) {
    const supabase = createClient();

    if (journeyId) {
        const { data: byJourney, error: byJourneyError } = await supabase
            .from('bitacora_vuelos')
            .select('journey_id, student_count, end_time')
            .eq('journey_id', journeyId)
            .order('end_time', { ascending: false })
            .limit(500);

        if (!byJourneyError && Array.isArray(byJourney)) {
            return sumStudentsFromFlightLogs(byJourney, journeyId);
        }
    }

    if (missionId) {
        const { data: byMission, error: byMissionError } = await supabase
            .from('bitacora_vuelos')
            .select('mission_id, student_count, end_time')
            .eq('mission_id', missionId)
            .order('end_time', { ascending: false })
            .limit(500);

        if (!byMissionError && Array.isArray(byMission)) {
            return sumStudentsFromMissionLogs(byMission);
        }
    }

    return 0;
}

function getTeamStatusFromMeta(meta) {
    const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta)
        ? meta
        : Object.create(null);

    if (safeMeta.closure_checkout_done === true) {
        return {
            pilot: true,
            teacher: true,
            assistant: true
        };
    }

    const teamBlock = safeMeta.closure_checkout_team;
    const teamMap = teamBlock && typeof teamBlock === 'object' && !Array.isArray(teamBlock)
        ? teamBlock
        : Object.create(null);

    return {
        pilot: safeMeta.closure_checkout_pilot_done === true || safeMeta.checkout_pilot_done === true || teamMap.pilot === true,
        teacher: safeMeta.closure_checkout_teacher_done === true || safeMeta.checkout_teacher_done === true || teamMap.teacher === true,
        assistant: safeMeta.closure_checkout_assistant_done === true || safeMeta.checkout_assistant_done === true || teamMap.assistant === true
    };
}

function toTeamStatus(baseStatus) {
    return {
        pilot: baseStatus?.pilot === true,
        teacher: baseStatus?.teacher === true,
        assistant: baseStatus?.assistant === true
    };
}

function isUuid(value) {
    const normalized = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function getErrorMessage(error) {
    if (!error) return 'Error desconocido.';
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    if (typeof error.error_description === 'string' && error.error_description.trim()) return error.error_description.trim();
    if (typeof error.details === 'string' && error.details.trim()) return error.details.trim();

    try {
        const serialized = JSON.stringify(error);
        if (serialized && serialized !== '{}') return serialized;
    } catch {
        // no-op
    }

    return 'Error inesperado.';
}

function resolveEventRole(row, userRoleMap) {
    const payloadRole = normalizeRole(row?.payload?.role || row?.payload?.user_role);
    if (TEAM_ROLES.includes(payloadRole)) return payloadRole;

    const eventUserId = String(row?.user_id || '').trim();
    if (eventUserId && userRoleMap[eventUserId]) return userRoleMap[eventUserId];

    return '';
}

function Avatar({ role, checkedOut }) {
    const bgColors = {
        pilot: 'bg-blue-100 text-blue-700',
        teacher: 'bg-sky-100 text-sky-700',
        assistant: 'bg-slate-200 text-slate-700'
    };

    let Icon = User;
    if (role === 'pilot') Icon = Plane;
    if (role === 'teacher') Icon = GraduationCap;
    if (role === 'assistant') Icon = HandHeart;

    return (
        <div className="relative">
            <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-white shadow-sm ${bgColors[role] || 'bg-slate-100 text-slate-500'}`}>
                <Icon size={20} strokeWidth={2} />
            </div>
            {checkedOut ? (
                <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-sm">
                    <Check size={11} strokeWidth={3} />
                </span>
            ) : null}
        </div>
    );
}

function TeamStatusBadge({ checkedOut }) {
    if (checkedOut) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                <CheckCircle2 size={12} />
                Check-out completado
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">
            <Clock3 size={12} />
            Pendiente
        </span>
    );
}

function buildCheckoutCommentList(existingValue) {
    if (Array.isArray(existingValue)) return [...existingValue];

    const legacyComment = String(existingValue || '').trim();
    if (!legacyComment) return [];

    return [{
        message: legacyComment,
        source: 'legacy'
    }];
}

export default function CheckoutScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    onRefresh,
    onCheckoutComplete = null
}) {
    const router = useRouter();
    const normalizedRole = useMemo(() => normalizeRole(profile?.role), [profile?.role]);
    const actorName = useMemo(() => firstName(profile?.full_name, 'Operativo'), [profile?.full_name]);
    const roleTag = useMemo(() => ROLE_LABELS[profile?.role] || 'Operativo', [profile?.role]);

    const missionMeta = useMemo(() => parseMeta(missionInfo?.meta), [missionInfo?.meta]);
    const initialTeamStatus = useMemo(() => toTeamStatus(getTeamStatusFromMeta(missionMeta)), [missionMeta]);
    const missionId = useMemo(() => resolveMissionId(missionInfo, missionMeta), [missionInfo, missionMeta]);

    const teamUserRoleMap = useMemo(() => {
        const mapping = Object.create(null);

        const pilotId = String(missionInfo?.pilot_id || missionMeta?.pilot_id || '').trim();
        const teacherId = String(missionInfo?.teacher_id || missionMeta?.teacher_id || '').trim();
        const assistantId = String(missionInfo?.aux_id || missionInfo?.assistant_id || missionMeta?.aux_id || missionMeta?.assistant_id || '').trim();

        if (pilotId) mapping[pilotId] = 'pilot';
        if (teacherId) mapping[teacherId] = 'teacher';
        if (assistantId) mapping[assistantId] = 'assistant';

        return mapping;
    }, [missionInfo?.pilot_id, missionInfo?.teacher_id, missionInfo?.aux_id, missionInfo?.assistant_id, missionMeta?.pilot_id, missionMeta?.teacher_id, missionMeta?.aux_id, missionMeta?.assistant_id]);

    const teamMembers = useMemo(() => ([
        {
            role: 'pilot',
            label: 'Piloto',
            name: firstName(missionInfo?.pilot_name || missionMeta?.pilot_name, 'Piloto')
        },
        {
            role: 'teacher',
            label: 'Docente',
            name: firstName(missionInfo?.teacher_name || missionMeta?.teacher_name, 'Docente')
        },
        {
            role: 'assistant',
            label: 'Auxiliar',
            name: firstName(missionInfo?.aux_name || missionInfo?.assistant_name || missionMeta?.aux_name || missionMeta?.assistant_name, 'Auxiliar')
        }
    ]), [missionInfo?.pilot_name, missionInfo?.teacher_name, missionInfo?.aux_name, missionInfo?.assistant_name, missionMeta?.pilot_name, missionMeta?.teacher_name, missionMeta?.aux_name, missionMeta?.assistant_name]);

    const nextMissionDate = useMemo(() => {
        const rawDate =
            missionInfo?.nextMissionDate ||
            missionInfo?.next_mission_date ||
            missionMeta?.nextMissionDate ||
            missionMeta?.next_mission_date;
        return formatMissionDate(rawDate);
    }, [missionInfo?.nextMissionDate, missionInfo?.next_mission_date, missionMeta?.nextMissionDate, missionMeta?.next_mission_date]);

    const nextSchoolName = useMemo(() => (
        String(
            missionInfo?.nextSchoolName ||
            missionInfo?.next_school_name ||
            missionMeta?.nextSchoolName ||
            missionMeta?.next_school_name ||
            'Por asignar'
        ).trim() || 'Por asignar'
    ), [missionInfo?.nextSchoolName, missionInfo?.next_school_name, missionMeta?.nextSchoolName, missionMeta?.next_school_name]);

    const watchIdRef = useRef(null);

    const [teamCheckoutStatus, setTeamCheckoutStatus] = useState(initialTeamStatus);
    const [locationStatus, setLocationStatus] = useState('idle');
    const [distance, setDistance] = useState(null);
    const [accuracy, setAccuracy] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [checkoutComment, setCheckoutComment] = useState('');
    const [studentsCount, setStudentsCount] = useState(0);
    const [clockNow, setClockNow] = useState(() => new Date());
    const [syncRequired, setSyncRequired] = useState(false);
    const [pendingSyncItems, setPendingSyncItems] = useState([]);
    const [isSyncingCheckout, setIsSyncingCheckout] = useState(false);

    const isWithinRange = distance !== null && distance <= STAFF_CONFIG.GEOFENCE_RADIUS_METERS;
    const hasCurrentUserCheckedOut = TEAM_ROLES.includes(normalizedRole) && teamCheckoutStatus[normalizedRole] === true;

    useEffect(() => {
        setTeamCheckoutStatus((prev) => ({
            pilot: prev.pilot || initialTeamStatus.pilot,
            teacher: prev.teacher || initialTeamStatus.teacher,
            assistant: prev.assistant || initialTeamStatus.assistant
        }));
    }, [initialTeamStatus]);

    useEffect(() => {
        const timer = setInterval(() => {
            setClockNow(new Date());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const localCount = readJourneyStudentsFromLocalLogs(journeyId);
        setStudentsCount(localCount);

        const loadStudentsCount = async () => {
            try {
                const remoteCount = await fetchJourneyStudentsCount({ journeyId, missionId });
                if (cancelled) return;
                setStudentsCount(Math.max(localCount, remoteCount));
            } catch {
                if (!cancelled) {
                    setStudentsCount(localCount);
                }
            }
        };

        loadStudentsCount();

        return () => {
            cancelled = true;
        };
    }, [journeyId, missionId]);

    const stopWatchingLocation = useCallback(() => {
        if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    }, []);

    const startWatchingLocation = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setLocationStatus('error');
            return;
        }

        setLocationStatus('locating');

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy: nextAccuracy } = position.coords;

                const targetLat = STAFF_CONFIG.OFFICE_LOCATION.lat;
                const targetLng = STAFF_CONFIG.OFFICE_LOCATION.lng;
                const dist = getDistanceFromLatLonInM(latitude, longitude, targetLat, targetLng);

                setDistance(Math.round(dist));
                setAccuracy(nextAccuracy);
                setLocationStatus('success');
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationStatus('denied');
                } else {
                    setLocationStatus('error');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 5000
            }
        );
    }, []);

    const loadTeamCheckoutStatus = useCallback(async () => {
        if (!journeyId) return;

        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('staff_prep_events')
                .select('user_id, payload, created_at')
                .eq('journey_id', journeyId)
                .eq('event_type', 'checkout')
                .order('created_at', { ascending: false })
                .limit(300);

            if (error) throw error;

            const nextStatus = {
                ...EMPTY_TEAM_STATUS,
                ...toTeamStatus(getTeamStatusFromMeta(parseMeta(missionInfo?.meta)))
            };

            for (const row of data || []) {
                const role = resolveEventRole(row, teamUserRoleMap);
                if (!role) continue;
                nextStatus[role] = true;
            }

            setTeamCheckoutStatus(nextStatus);
        } catch (error) {
            console.warn('No se pudo sincronizar el estado de check-out del equipo:', error);
        }
    }, [journeyId, missionInfo?.meta, teamUserRoleMap]);

    useEffect(() => {
        if (!journeyId) return;

        loadTeamCheckoutStatus();

        const supabase = createClient();
        const channel = supabase
            .channel(`checkout-sync-${journeyId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'staff_prep_events',
                    filter: `journey_id=eq.${journeyId}`
                },
                (payload) => {
                    if (payload.new?.event_type !== 'checkout') return;
                    loadTeamCheckoutStatus();
                }
            )
            .subscribe();

        const interval = setInterval(loadTeamCheckoutStatus, 4500);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [journeyId, loadTeamCheckoutStatus]);

    useEffect(() => {
        if (hasCurrentUserCheckedOut) {
            stopWatchingLocation();
            return;
        }

        startWatchingLocation();
        return () => stopWatchingLocation();
    }, [hasCurrentUserCheckedOut, startWatchingLocation, stopWatchingLocation]);

    useEffect(() => {
        if (!feedback) return;
        const timeout = setTimeout(() => setFeedback(''), 3200);
        return () => clearTimeout(timeout);
    }, [feedback]);

    const handleFinalizeCheckout = async () => {
        if (!journeyId || isSubmitting || hasCurrentUserCheckedOut) return;

        if (!TEAM_ROLES.includes(normalizedRole)) {
            setFeedback('No fue posible validar tu rol operativo.');
            return;
        }

        if (!isWithinRange) {
            setFeedback('Debes estar en el perímetro de la base para hacer check-out.');
            return;
        }

        // [SYNC GATE] Check for pending offline uploads before allowing checkout
        try {
            const pending = await getPendingUploads();
            if (pending.length > 0) {
                setPendingSyncItems(pending);
                setSyncRequired(true);
                setFeedback('Tienes evidencia pendiente por sincronizar.');
                return;
            }
        } catch (e) {
            console.warn('[CheckoutSyncGate] Could not check pending uploads:', e);
        }

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const normalizedComment = checkoutComment.trim();
            let actorUserId = isUuid(userId) ? String(userId).trim() : '';

            if (!actorUserId && isUuid(profile?.user_id)) {
                actorUserId = String(profile.user_id).trim();
            }

            if (!actorUserId) {
                const { data: authData } = await supabase.auth.getUser();
                if (isUuid(authData?.user?.id)) {
                    actorUserId = String(authData.user.id).trim();
                }
            }

            const doneById = actorUserId || String(userId || '').trim() || null;

            let existingCheckout = [];
            if (actorUserId) {
                const { data: existingRows, error: existingError } = await supabase
                    .from('staff_prep_events')
                    .select('id')
                    .eq('journey_id', journeyId)
                    .eq('event_type', 'checkout')
                    .eq('user_id', actorUserId)
                    .limit(1);

                if (existingError) {
                    console.warn('No se pudo validar check-out previo, se continuará con actualización de meta:', existingError);
                } else {
                    existingCheckout = existingRows || [];
                }
            }

            if (actorUserId && existingCheckout.length === 0) {
                const { error: insertError } = await supabase
                    .from('staff_prep_events')
                    .insert({
                        journey_id: journeyId,
                        user_id: actorUserId,
                        event_type: 'checkout',
                        payload: {
                            role: normalizedRole,
                            actor_name: actorName,
                            timestamp: now,
                            checkout_comment: normalizedComment || null,
                            location: {
                                distance,
                                accuracy,
                                radius: STAFF_CONFIG.GEOFENCE_RADIUS_METERS,
                                office_lat: STAFF_CONFIG.OFFICE_LOCATION.lat,
                                office_lng: STAFF_CONFIG.OFFICE_LOCATION.lng
                            }
                        }
                    });

                if (insertError) {
                    console.warn('No se pudo registrar el evento de check-out; se continuará con actualización de meta:', insertError);
                }
            }

            const { data: teamEvents, error: teamEventsError } = await supabase
                .from('staff_prep_events')
                .select('user_id, payload')
                .eq('journey_id', journeyId)
                .eq('event_type', 'checkout')
                .limit(500);

            if (teamEventsError) {
                console.warn('No se pudo cargar eventos del equipo para check-out, se usará meta actual:', teamEventsError);
            }

            const nextStatus = {
                ...EMPTY_TEAM_STATUS,
                ...toTeamStatus(getTeamStatusFromMeta(parseMeta(missionInfo?.meta)))
            };

            for (const row of teamEvents || []) {
                const role = resolveEventRole(row, teamUserRoleMap);
                if (!role) continue;
                nextStatus[role] = true;
            }
            nextStatus[normalizedRole] = true;

            const allTeamCheckedOut = TEAM_ROLES.every((role) => nextStatus[role] === true);

            const { data: journeyData, error: readJourneyError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readJourneyError) throw readJourneyError;

            const currentMeta = parseMeta(journeyData?.meta);
            const closureCheckoutTeam = currentMeta.closure_checkout_team && typeof currentMeta.closure_checkout_team === 'object' && !Array.isArray(currentMeta.closure_checkout_team)
                ? currentMeta.closure_checkout_team
                : Object.create(null);

            const nextMeta = {
                ...currentMeta,
                closure_checkout_team: {
                    ...closureCheckoutTeam,
                    ...nextStatus
                },
                [`closure_checkout_${normalizedRole}_done`]: true,
                [`closure_checkout_${normalizedRole}_done_at`]: now,
                [`closure_checkout_${normalizedRole}_done_by`]: doneById,
                [`closure_checkout_${normalizedRole}_done_by_name`]: actorName,
                closure_checkout_done: allTeamCheckedOut,
                closure_phase: allTeamCheckedOut ? 'report' : 'base_closure'
            };

            if (normalizedComment) {
                const currentComments = buildCheckoutCommentList(currentMeta.checkout_comments);
                currentComments.push({
                    message: normalizedComment,
                    at: now,
                    by: doneById,
                    by_name: actorName,
                    role: normalizedRole
                });
                nextMeta.checkout_comments = currentComments;
            }

            if (allTeamCheckedOut) {
                nextMeta.closure_checkout_done_at = now;
                nextMeta.closure_checkout_done_by = doneById;
                nextMeta.closure_checkout_done_by_name = actorName;
                nextMeta.closure_completed_at = now;
                nextMeta.closure_completed_by = doneById;
                nextMeta.closure_completed_by_name = actorName;
            }

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: allTeamCheckedOut ? 'report' : 'dismantling',
                    ...(allTeamCheckedOut ? { status: 'report' } : {}),
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setTeamCheckoutStatus(nextStatus);
            setFeedback(allTeamCheckedOut
                ? 'Equipo completo. Jornada finalizada.'
                : 'Check-out completado. Esperando al resto del equipo.');
            setCheckoutComment('');
            onRefresh && onRefresh();

            if (allTeamCheckedOut) {
                clearJourneyLocalOperationalData(journeyId);
                clearLocalProgress(journeyId);
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.removeItem('flyhigh_staff_mission');
                }
            }

            if (typeof onCheckoutComplete === 'function') {
                onCheckoutComplete({
                    allTeamCheckedOut,
                    nextStatus,
                    finalizedAt: now
                });
            }

            router.replace('/staff/history');
        } catch (error) {
            const details = getErrorMessage(error);
            console.error('No se pudo finalizar el check-out:', { error, details });
            setFeedback(`No se pudo finalizar la jornada. ${details}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── TEMP: Force checkout bypass for remote testing ──
    const handleForceCheckout = async () => {
        if (!journeyId || isSubmitting || hasCurrentUserCheckedOut) return;
        if (!TEAM_ROLES.includes(normalizedRole)) {
            setFeedback('No fue posible validar tu rol operativo.');
            return;
        }
        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const normalizedComment = checkoutComment.trim();
            let actorUserId = isUuid(userId) ? String(userId).trim() : '';
            if (!actorUserId && isUuid(profile?.user_id)) actorUserId = String(profile.user_id).trim();
            if (!actorUserId) {
                const { data: authData } = await supabase.auth.getUser();
                if (isUuid(authData?.user?.id)) actorUserId = String(authData.user.id).trim();
            }
            const doneById = actorUserId || String(userId || '').trim() || null;

            let existingCheckout = [];
            if (actorUserId) {
                const { data: existingRows } = await supabase
                    .from('staff_prep_events').select('id')
                    .eq('journey_id', journeyId).eq('event_type', 'checkout').eq('user_id', actorUserId).limit(1);
                existingCheckout = existingRows || [];
            }

            if (actorUserId && existingCheckout.length === 0) {
                await supabase.from('staff_prep_events').insert({
                    journey_id: journeyId, user_id: actorUserId, event_type: 'checkout',
                    payload: {
                        role: normalizedRole, actor_name: actorName, timestamp: now,
                        checkout_comment: normalizedComment || null,
                        location: {
                            distance: null, accuracy: null, radius: STAFF_CONFIG.GEOFENCE_RADIUS_METERS,
                            office_lat: STAFF_CONFIG.OFFICE_LOCATION.lat, office_lng: STAFF_CONFIG.OFFICE_LOCATION.lng,
                            bypass_reason: 'test_mode_remote'
                        }
                    }
                });
            }

            const { data: teamEvents } = await supabase.from('staff_prep_events')
                .select('user_id, payload').eq('journey_id', journeyId).eq('event_type', 'checkout').limit(500);

            const nextStatus = { ...EMPTY_TEAM_STATUS, ...toTeamStatus(getTeamStatusFromMeta(parseMeta(missionInfo?.meta))) };
            for (const row of teamEvents || []) {
                const role = resolveEventRole(row, teamUserRoleMap);
                if (role) nextStatus[role] = true;
            }
            nextStatus[normalizedRole] = true;
            const allTeamCheckedOut = TEAM_ROLES.every((role) => nextStatus[role] === true);

            const { data: journeyData, error: readErr } = await supabase.from('staff_journeys')
                .select('meta').eq('id', journeyId).single();
            if (readErr) throw readErr;

            const currentMeta = parseMeta(journeyData?.meta);
            const closureCheckoutTeam = currentMeta.closure_checkout_team && typeof currentMeta.closure_checkout_team === 'object'
                ? currentMeta.closure_checkout_team : {};
            const nextMeta = {
                ...currentMeta,
                closure_checkout_team: { ...closureCheckoutTeam, ...nextStatus },
                [`closure_checkout_${normalizedRole}_done`]: true,
                [`closure_checkout_${normalizedRole}_done_at`]: now,
                [`closure_checkout_${normalizedRole}_done_by`]: doneById,
                [`closure_checkout_${normalizedRole}_done_by_name`]: actorName,
                closure_checkout_done: allTeamCheckedOut,
                closure_phase: allTeamCheckedOut ? 'report' : 'base_closure'
            };
            if (normalizedComment) {
                const currentComments = buildCheckoutCommentList(currentMeta.checkout_comments);
                currentComments.push({ message: normalizedComment, at: now, by: doneById, by_name: actorName, role: normalizedRole });
                nextMeta.checkout_comments = currentComments;
            }
            if (allTeamCheckedOut) {
                nextMeta.closure_checkout_done_at = now;
                nextMeta.closure_checkout_done_by = doneById;
                nextMeta.closure_checkout_done_by_name = actorName;
                nextMeta.closure_completed_at = now;
                nextMeta.closure_completed_by = doneById;
                nextMeta.closure_completed_by_name = actorName;
            }

            const { error: updateError } = await supabase.from('staff_journeys')
                .update({
                    mission_state: allTeamCheckedOut ? 'report' : 'dismantling',
                    ...(allTeamCheckedOut ? { status: 'report' } : {}), meta: nextMeta, updated_at: now
                })
                .eq('id', journeyId);
            if (updateError) throw updateError;

            setTeamCheckoutStatus(nextStatus);
            setFeedback(allTeamCheckedOut ? 'Equipo completo. Jornada finalizada.' : 'Check-out completado (modo prueba).');
            setCheckoutComment('');
            onRefresh && onRefresh();
            if (allTeamCheckedOut) {
                clearJourneyLocalOperationalData(journeyId);
                clearLocalProgress(journeyId);
                if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem('flyhigh_staff_mission');
            }
            if (typeof onCheckoutComplete === 'function') onCheckoutComplete({ allTeamCheckedOut, nextStatus, finalizedAt: now });
            router.replace('/staff/history');
        } catch (error) {
            const details = getErrorMessage(error);
            console.error('Force checkout error:', { error, details });
            setFeedback(`No se pudo finalizar. ${details}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const finalizeDisabled = isSubmitting || hasCurrentUserCheckedOut || !isWithinRange;
    const greetingText = useMemo(() => getTimeBasedGreeting(clockNow), [clockNow]);
    const dateLabel = useMemo(() => getTodayDateLabel(clockNow), [clockNow]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-100 via-blue-50/35 to-slate-100 text-slate-900">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
                <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
            </div>

            <HeaderOperativo
                firstName={actorName}
                roleLabel={roleTag}
                missionState="MISSION_BRIEF"
                dateLabel={dateLabel}
                checkInGreetingText={greetingText}
                checkInHeadlineText={`Gracias, ${actorName}`}
                actionsSlot={(
                    <HeaderHamburgerMenu
                        journeyId={journeyId}
                        schoolId={missionInfo?.id || missionInfo?.mission_id || missionId}
                        role={profile?.role}
                        onDemoStart={onRefresh}
                    />
                )}
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            />

            <main className="relative z-10 mx-auto w-full max-w-[430px] space-y-4 px-5 pb-40 pt-5">
                <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 shadow-[0_24px_56px_-34px_rgba(30,64,175,0.32)]">
                    <h2 className="m-0 text-[29px] font-black leading-tight tracking-tight text-slate-900">¡Misión Cumplida!</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
                        Gracias a tu esfuerzo de hoy, le cumpliste el sueño de volar a {studentsCount} niños.
                    </p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)]">
                    <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Próxima Misión</p>
                    <div className="mt-3 flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                            <CalendarDays size={18} />
                        </span>
                        <div className="min-w-0">
                            <p className="m-0 text-sm font-black text-slate-800">{nextMissionDate}</p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{nextSchoolName}</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)]">
                    <p className="m-0 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Sincronización de Equipo</p>
                    <div className="mt-3 space-y-3">
                        {teamMembers.map((member) => {
                            const checkedOut = teamCheckoutStatus[member.role] === true;
                            return (
                                <div
                                    key={member.role}
                                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar role={member.role} checkedOut={checkedOut} />
                                        <div>
                                            <p className="m-0 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                                                {member.label}
                                            </p>
                                            <p className="m-0 text-sm font-bold text-slate-800">{member.name}</p>
                                        </div>
                                    </div>
                                    <TeamStatusBadge checkedOut={checkedOut} />
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.32)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500">Ubicación de Base</p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">
                                {locationStatus === 'locating' ? 'Validando geolocalización...' : 'Validación para check-out activo'}
                            </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold ${isWithinRange ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            <MapPin size={12} />
                            {isWithinRange ? 'Dentro de rango' : 'Fuera de rango'}
                        </span>
                    </div>

                    <div className="mt-3 flex items-end justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div>
                            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Distancia</p>
                            <p className={`m-0 text-xl font-black tabular-nums ${isWithinRange ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {distance != null ? `${distance}m` : '--'}
                            </p>
                        </div>
                        <p className="m-0 text-xs font-semibold text-slate-500">
                            {accuracy != null ? `Precisión ±${Math.round(accuracy)}m` : 'Esperando precisión GPS'}
                        </p>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.28)]">
                    <label htmlFor="checkout-feedback" className="m-0 text-[12px] font-extrabold text-slate-700">
                        Queremos escucharte (Opcional)
                    </label>
                    <textarea
                        id="checkout-feedback"
                        rows={2}
                        value={checkoutComment}
                        onChange={(event) => setCheckoutComment(event.target.value)}
                        placeholder="¿Alguna sugerencia, anécdota, queja o aporte del día de hoy? Este espacio es tuyo."
                        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                </section>

            </main>

            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent px-5 pb-5 pt-4">
                <div className="mx-auto w-full max-w-[420px]">
                    {feedback ? (
                        <div className={`mb-2 rounded-xl border px-3 py-2 text-center text-xs font-bold ${feedback.includes('No se pudo') || feedback.includes('perímetro') || feedback.includes('pendiente') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            {feedback}
                        </div>
                    ) : null}

                    {/* Sync Gate UI */}
                    {syncRequired && pendingSyncItems.length > 0 && (
                        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-amber-600 text-lg">⚠️</span>
                                <p className="text-xs font-bold text-amber-800">Evidencia pendiente por mala conexión</p>
                            </div>
                            <p className="text-[11px] text-amber-700 mb-3 leading-relaxed">
                                Conéctate al Wi-Fi y presiona Sincronizar para completar el checkout.
                            </p>
                            <div className="space-y-1.5 mb-3 max-h-28 overflow-y-auto">
                                {pendingSyncItems.map((item, i) => (
                                    <div key={item.key || i} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 border border-amber-100">
                                        <span className="text-xs">{item.contentType?.startsWith('audio') ? '🎤' : '📸'}</span>
                                        <span className="text-[10px] font-mono text-slate-600 truncate flex-1">{item.label || 'archivo'}</span>
                                        <span className="text-[9px] font-bold text-amber-600 uppercase">⏳ {item.status}</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    setIsSyncingCheckout(true);
                                    try {
                                        const result = await syncAllPending();
                                        const remaining = await getPendingUploads();
                                        setPendingSyncItems(remaining);
                                        if (remaining.length === 0) {
                                            setSyncRequired(false);
                                            setFeedback('✅ Todo sincronizado. Ya puedes hacer check-out.');
                                        } else {
                                            setFeedback(`${result.synced} sincronizado(s), ${remaining.length} pendiente(s).`);
                                        }
                                    } catch (e) {
                                        setFeedback('Error al sincronizar. Verifica tu conexión.');
                                    } finally {
                                        setIsSyncingCheckout(false);
                                    }
                                }}
                                disabled={isSyncingCheckout}
                                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-extrabold text-white shadow transition hover:bg-amber-700 disabled:opacity-50"
                            >
                                {isSyncingCheckout ? '🔄 Sincronizando...' : '🔄 Sincronizar Ahora'}
                            </button>
                            {pendingSyncItems.some(item => item.status === 'failed') && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const failedItems = pendingSyncItems.filter(item => item.status === 'failed');
                                        for (const item of failedItems) {
                                            if (item.key) {
                                                await removePendingUpload(item.key);
                                            }
                                        }
                                        const remaining = await getPendingUploads();
                                        setPendingSyncItems(remaining);
                                        if (remaining.length === 0) {
                                            setSyncRequired(false);
                                            setFeedback('✅ Fotos descartadas. Ya puedes hacer check-out.');
                                        } else {
                                            setFeedback(`${failedItems.length} descartado(s), ${remaining.length} pendiente(s).`);
                                        }
                                    }}
                                    disabled={isSyncingCheckout}
                                    className="w-full mt-2 rounded-xl bg-slate-500 px-4 py-2.5 text-xs font-extrabold text-white shadow transition hover:bg-slate-600 disabled:opacity-50"
                                >
                                    🗑️ Descartar fotos fallidas
                                </button>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleFinalizeCheckout}
                        disabled={finalizeDisabled || syncRequired}
                        className={getPrimaryCtaClasses(finalizeDisabled || syncRequired)}
                    >
                        <span className="flex flex-col items-center justify-center gap-0.5">
                            <span className="inline-flex items-center justify-center gap-2 text-base font-extrabold tracking-tight">
                                {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : null}
                                Finalizar Jornada
                            </span>
                            <span className={`text-xs font-semibold ${finalizeDisabled ? 'text-slate-400' : 'text-blue-100'}`}>
                                (Check-out)
                            </span>
                        </span>
                    </button>

                    {!isWithinRange ? (
                        <p className="mt-2 text-center text-xs font-semibold text-rose-600">
                            Debes estar en el perímetro de la base para hacer check-out.
                        </p>
                    ) : null}

                    <button
                        type="button"
                        onClick={handleForceCheckout}
                        disabled={isSubmitting || hasCurrentUserCheckedOut}
                        className="mt-6 w-full text-center text-xs text-gray-400 underline"
                    >
                        Modo Prueba: Forzar Check-out
                    </button>
                </div>
            </div>
        </div>
    );
}
