'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const DEFAULT_STATION_COUNT = 2;
const MAX_FUNCTIONAL_GLASSES = 99;
const CONTROL_MODE_OPEN = 'open';
const CONTROL_MODE_PILOT_LOCKED = 'pilot_locked';

const STATIC_ITEMS = [
    { id: 'block0_connect_cabinet', label: 'Conectar cables al gabinete (en puertos correctos)' },
    { id: 'block0_route_to_seats', label: 'Llevar cables a cada silla (extremo del cable a su asiento correspondiente)' },
    { id: 'block1_take_from_case', label: 'Sacar gafas del estuche' },
    { id: 'block1_place_on_seat', label: 'Colocar gafas en su silla' }
];

const EMPTY_CHECK = Object.freeze({
    confirmed: false,
    confirmed_by: null,
    confirmed_name: null,
    confirmed_at: null
});

const GLASSES_SETUP_ILLUSTRATION_SVG = `
<svg viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="shadow-vr" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="25" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.2" />
        </filter>
        <filter id="shadow-ui" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.1" />
        </filter>
        <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    </defs>

    <g>
        <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.90; 0.95; 1" dur="10s" repeatCount="indefinite" />

        <g>
            <animateTransform attributeName="transform" type="translate"
                values="0,120; 0,0; 0,0"
                keyTimes="0; 0.15; 1"
                calcMode="spline" keySplines="0.4 0 0.2 1; 0 0 1 1" dur="10s" repeatCount="indefinite" />

            <path d="M 450 450 L 450 600" fill="none" stroke="#334155" stroke-width="10" stroke-linecap="round" />
            <rect x="435" y="440" width="30" height="25" rx="4" fill="#64748b" />
            <rect x="442" y="430" width="16" height="10" fill="#cbd5e1" />

            <path d="M 450 600 L 450 450" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-dasharray="20 40" opacity="0" filter="url(#glow-green)">
                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.249; 0.25; 0.4; 0.41" dur="10s" repeatCount="indefinite" />
                <animate attributeName="stroke-dashoffset" values="60; 0" dur="1s" repeatCount="indefinite" />
            </path>
        </g>

        <g filter="url(#shadow-vr)">
            <rect x="250" y="340" width="50" height="60" rx="15" fill="#475569" />
            <rect x="230" y="350" width="30" height="40" rx="10" fill="#334155" />
            <rect x="600" y="340" width="50" height="60" rx="15" fill="#475569" />
            <rect x="640" y="350" width="30" height="40" rx="10" fill="#334155" />

            <path d="M 320 320 C 380 305, 520 305, 580 320 C 625 320, 625 420, 580 420 C 520 435, 380 435, 320 420 C 275 420, 275 320, 320 320 Z" fill="#1e293b" />
            <path d="M 320 320 C 380 305, 520 305, 580 320" fill="none" stroke="#334155" stroke-width="4" stroke-linecap="round" />

            <path d="M 330 330 C 385 318, 515 318, 570 330 C 605 330, 605 410, 570 410 C 515 422, 385 422, 330 410 C 295 410, 295 330, 330 330 Z" fill="#0f172a" />
            <rect x="430" y="420" width="40" height="12" rx="4" fill="#020617" />

            <circle cx="450" cy="325" r="5" fill="#64748b">
                <animate attributeName="fill" values="#64748b; #64748b; #10b981; #10b981" keyTimes="0; 0.249; 0.25; 1" dur="10s" repeatCount="indefinite" />
                <animate attributeName="filter" values="none; none; url(#glow-green); url(#glow-green)" keyTimes="0; 0.249; 0.25; 1" dur="10s" repeatCount="indefinite" />
            </circle>

            <circle cx="390" cy="370" r="38" fill="#1e293b" stroke="#334155" stroke-width="4">
                <animate attributeName="fill" values="#1e293b; #1e293b; #0891b2; #0891b2" keyTimes="0; 0.249; 0.25; 1" dur="10s" repeatCount="indefinite" />
                <animate attributeName="filter" values="none; none; url(#glow-cyan); url(#glow-cyan)" keyTimes="0; 0.249; 0.25; 1" dur="10s" repeatCount="indefinite" />
            </circle>
            <path d="M 365 345 A 30 30 0 0 1 415 345 A 35 35 0 0 0 365 345 Z" fill="#ffffff" opacity="0.15" />

            <circle cx="510" cy="370" r="38" fill="#1e293b" stroke="#334155" stroke-width="4">
                <animate attributeName="fill" values="#1e293b; #1e293b; #0891b2; #0891b2" keyTimes="0; 0.249; 0.25; 1" dur="10s" repeatCount="indefinite" />
                <animate attributeName="filter" values="none; none; url(#glow-cyan); url(#glow-cyan)" keyTimes="0; 0.249; 0.25; 1" dur="10s" repeatCount="indefinite" />
            </circle>
            <path d="M 485 345 A 30 30 0 0 1 535 345 A 35 35 0 0 0 485 345 Z" fill="#ffffff" opacity="0.15" />
        </g>

        <g opacity="0">
            <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.249; 0.25; 0.90; 1" dur="10s" repeatCount="indefinite" />

            <polygon points="410,310 490,310 560,90 340,90" fill="#06b6d4" opacity="0.15" />

            <g transform="translate(450, 310)">
                <rect x="-160" y="-240" width="320" height="200" rx="16" fill="#0891b2" fill-opacity="0.2" stroke="#22d3ee" stroke-width="3" filter="url(#glow-cyan)" />

                <g transform="translate(-130, -210)">
                    <rect x="0" y="0" width="260" height="120" rx="8" fill="none" stroke="#a5f3fc" stroke-width="3" opacity="0.8" />
                    <circle cx="130" cy="40" r="24" fill="#67e8f9" />
                    <polygon points="0,120 70,30 140,120" fill="#06b6d4" opacity="0.9" />
                    <polygon points="100,120 170,50 240,120" fill="#22d3ee" opacity="0.9" />
                    <polygon points="200,120 230,80 260,120" fill="#0891b2" opacity="0.9" />
                    <path d="M 0 120 L 260 120 M 20 120 L -30 170 M 80 120 L 40 170 M 130 120 L 130 170 M 180 120 L 220 170 M 240 120 L 290 170" fill="none" stroke="#a5f3fc" stroke-width="2" opacity="0.5" />

                    <line x1="0" y1="0" x2="260" y2="0" stroke="#ffffff" stroke-width="4" filter="url(#glow-cyan)">
                        <animate attributeName="y1" values="0; 120; 0" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="y2" values="0; 120; 0" dur="1.5s" repeatCount="indefinite" />
                    </line>
                </g>

                <text x="0" y="-55" font-family="monospace" font-size="20" font-weight="bold" fill="#a5f3fc" text-anchor="middle">
                    <animate attributeName="textContent" values="ESCANEANDO...; IMAGEN OK" keyTimes="0; 0.50" dur="10s" repeatCount="indefinite" />
                    <animate attributeName="fill" values="#a5f3fc; #10b981" keyTimes="0; 0.50" dur="10s" repeatCount="indefinite" />
                </text>

                <g opacity="0">
                    <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.49; 0.50; 1" dur="10s" repeatCount="indefinite" />
                    <circle cx="-110" cy="-62" r="14" fill="#10b981" />
                    <path d="M -116 -62 L -112 -57 L -104 -67" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
                </g>
            </g>
        </g>

        <g transform="translate(680, 100)">
            <g>
                <animateTransform attributeName="transform" type="scale"
                    values="0; 0; 1.2; 1; 1; 0"
                    keyTimes="0; 0.52; 0.55; 0.58; 0.92; 1" dur="10s" repeatCount="indefinite" />

                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.52; 0.54; 0.92; 0.95" dur="10s" repeatCount="indefinite" />

                <circle cx="0" cy="0" r="45" fill="#10b981" filter="url(#shadow-ui)" />
                <circle cx="0" cy="0" r="35" fill="none" stroke="#34d399" stroke-width="3" />
                <path d="M -16 -2 L -4 10 L 20 -14" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />

                <rect x="-65" y="60" width="130" height="26" rx="13" fill="#ffffff" filter="url(#shadow-ui)" />
                <text x="0" y="77" font-family="sans-serif" font-weight="bold" font-size="13" fill="#10b981" text-anchor="middle" letter-spacing="1">CONFIGURADO</text>
            </g>
        </g>

    </g>

</svg>
`;

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [name] = normalized.split(/\s+/);
    return name || fallback;
}

function normalizeStationCount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STATION_COUNT;
    return Math.max(1, Math.min(12, Math.floor(parsed)));
}

function getStationCount(meta = {}) {
    const explicit = normalizeStationCount(meta.global_glasses_station_count);
    if (meta.global_glasses_station_count != null) {
        return explicit;
    }

    const checks =
        meta && typeof meta.global_glasses_checks === 'object' && !Array.isArray(meta.global_glasses_checks)
            ? meta.global_glasses_checks
            : Object.create(null);

    let maxSeat = 0;
    Object.keys(checks).forEach((key) => {
        const match = key.match(/^seat_(\d+)_(connect_cable|confirm_image)$/);
        if (!match) return;
        const seatNumber = Number(match[1]);
        if (Number.isFinite(seatNumber) && seatNumber > maxSeat) {
            maxSeat = seatNumber;
        }
    });

    return maxSeat > 0 ? normalizeStationCount(maxSeat) : DEFAULT_STATION_COUNT;
}

function getSeatKeys() {
    return ['seat_1_connect_cable', 'seat_1_confirm_image'];
}

function getRequiredKeys(stationCount) {
    return [...STATIC_ITEMS.map((item) => item.id), ...getSeatKeys(stationCount)];
}

function normalizeChecks(rawChecks, stationCount) {
    const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
        ? rawChecks
        : Object.create(null);

    const normalized = Object.create(null);
    const required = getRequiredKeys(stationCount);

    required.forEach((key) => {
        const value = source[key];
        if (!value || typeof value !== 'object') {
            normalized[key] = { ...EMPTY_CHECK };
            return;
        }

        normalized[key] = {
            confirmed: value.confirmed === true,
            confirmed_by: safeText(value.confirmed_by) || null,
            confirmed_name: safeText(value.confirmed_name) || null,
            confirmed_at: safeText(value.confirmed_at) || null
        };
    });

    return normalized;
}

function checksAreEqual(leftChecks, rightChecks, stationCount) {
    const required = getRequiredKeys(stationCount);
    return required.every((key) => {
        const left = leftChecks?.[key] || EMPTY_CHECK;
        const right = rightChecks?.[key] || EMPTY_CHECK;
        return (
            Boolean(left.confirmed) === Boolean(right.confirmed) &&
            safeText(left.confirmed_by) === safeText(right.confirmed_by) &&
            safeText(left.confirmed_name) === safeText(right.confirmed_name) &&
            safeText(left.confirmed_at) === safeText(right.confirmed_at)
        );
    });
}

function getConfirmedCount(checks, stationCount) {
    return getRequiredKeys(stationCount).reduce((total, key) => total + (checks?.[key]?.confirmed ? 1 : 0), 0);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getControlMode(meta = {}) {
    return meta.global_glasses_control_mode === CONTROL_MODE_PILOT_LOCKED
        ? CONTROL_MODE_PILOT_LOCKED
        : CONTROL_MODE_OPEN;
}

function getControllerName(meta = {}) {
    return safeText(meta.global_glasses_controller_name);
}

function getControllerRole(meta = {}) {
    return safeText(meta.global_glasses_controller_role).toLowerCase();
}

function getControllerUserId(meta = {}) {
    return safeText(meta.global_glasses_controller_user_id);
}

export default function GlassesSetupScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const missionMetaSafe = (() => {
        const rawMeta = missionInfo?.meta;
        if (!rawMeta) return '';
        if (typeof rawMeta === 'string') return rawMeta;
        try {
            return JSON.stringify(rawMeta);
        } catch {
            return '';
        }
    })();

    const initialMeta = parseMeta(missionMetaSafe);
    const initialStations = getStationCount(initialMeta);
    const [stationCount, setStationCount] = useState(initialStations);
    const [checks, setChecks] = useState(() => normalizeChecks(initialMeta.global_glasses_checks, initialStations));
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [glassesDone, setGlassesDone] = useState(initialMeta.global_glasses_done === true);
    const [closedByName, setClosedByName] = useState(safeText(initialMeta.global_glasses_done_by_name));
    const [controlMode, setControlMode] = useState(() => getControlMode(initialMeta));
    const [controllerName, setControllerName] = useState(() => getControllerName(initialMeta));
    const [controllerRole, setControllerRole] = useState(() => getControllerRole(initialMeta));
    const [controllerUserId, setControllerUserId] = useState(() => getControllerUserId(initialMeta));
    const [isClaimingPilotControl, setIsClaimingPilotControl] = useState(false);
    const [functionalCount, setFunctionalCount] = useState(() => {
        const rawCount = Number(initialMeta.global_glasses_functional_count);
        if (!Number.isFinite(rawCount)) return initialStations;
        return clamp(Math.floor(rawCount), 0, MAX_FUNCTIONAL_GLASSES);
    });
    const [showCounterModal, setShowCounterModal] = useState(false);
    const [pilotLockToast, setPilotLockToast] = useState('');

    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';
    const localFirstName = firstName(profile?.full_name, 'Operativo');
    const role = safeText(profile?.role).toLowerCase();

    const block0Keys = ['block0_connect_cabinet', 'block0_route_to_seats'];
    const block1Keys = ['block1_take_from_case', 'block1_place_on_seat'];
    const totalRequired = getRequiredKeys(stationCount).length;
    const confirmedCount = getConfirmedCount(checks, stationCount);
    const allConfirmed = totalRequired > 0 && confirmedCount === totalRequired;
    const isBusy = isSavingCheck || isFinalizing;
    const pilotLocked = controlMode === CONTROL_MODE_PILOT_LOCKED;
    const isReadOnlyByPilotControl = pilotLocked && role !== 'pilot';
    const canEditChecklist = !glassesDone && !isBusy && !isReadOnlyByPilotControl;
    const canFinalizeChecklist = allConfirmed && !glassesDone && !isBusy && !isReadOnlyByPilotControl;
    const itemInteractionDisabled = glassesDone || isBusy;
    const controllerLabel = controllerName || (controllerRole === 'pilot' ? 'Piloto' : 'Operativo');
    const controllerIdentityKnown = Boolean(controllerName || controllerUserId);
    const headerChipText = pilotLocked
        ? (role === 'pilot' ? 'Te esperan' : 'En espera del piloto')
        : null;

    useEffect(() => {
        const meta = parseMeta(missionMetaSafe);
        const nextStationCount = getStationCount(meta);
        const nextChecks = normalizeChecks(meta.global_glasses_checks, nextStationCount);
        const nextDone = meta.global_glasses_done === true;
        const nextDoneByName = safeText(meta.global_glasses_done_by_name);
        const nextControlMode = getControlMode(meta);
        const nextControllerName = getControllerName(meta);
        const nextControllerRole = getControllerRole(meta);
        const nextControllerUserId = getControllerUserId(meta);
        const nextFunctionalRaw = Number(meta.global_glasses_functional_count);
        const nextFunctional = Number.isFinite(nextFunctionalRaw)
            ? clamp(Math.floor(nextFunctionalRaw), 0, MAX_FUNCTIONAL_GLASSES)
            : nextStationCount;

        setStationCount((prev) => (prev === nextStationCount ? prev : nextStationCount));
        setChecks((prev) => (checksAreEqual(prev, nextChecks, nextStationCount) ? prev : nextChecks));
        setGlassesDone((prev) => (prev === nextDone ? prev : nextDone));
        setClosedByName((prev) => (prev === nextDoneByName ? prev : nextDoneByName));
        setControlMode((prev) => (prev === nextControlMode ? prev : nextControlMode));
        setControllerName((prev) => (prev === nextControllerName ? prev : nextControllerName));
        setControllerRole((prev) => (prev === nextControllerRole ? prev : nextControllerRole));
        setControllerUserId((prev) => (prev === nextControllerUserId ? prev : nextControllerUserId));
        setFunctionalCount((prev) => (prev === nextFunctional ? prev : nextFunctional));
    }, [missionMetaSafe, missionState]);

    useEffect(() => {
        if (!journeyId || !userId || role !== 'pilot' || glassesDone || pilotLocked) return;

        let cancelled = false;

        const claimPilotControl = async () => {
            setIsClaimingPilotControl(true);
            try {
                const supabase = createClient();
                const now = new Date().toISOString();
                const { data, error } = await supabase
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();

                if (error) throw error;

                const currentMeta = parseMeta(data?.meta);
                if (currentMeta.global_glasses_done === true) return;

                const nextMeta = {
                    ...currentMeta,
                    global_glasses_control_mode: CONTROL_MODE_PILOT_LOCKED,
                    global_glasses_controller_user_id: userId,
                    global_glasses_controller_name: localFirstName,
                    global_glasses_controller_role: 'pilot',
                    global_glasses_control_locked_at: now
                };

                const { error: updateError } = await supabase
                    .from('staff_journeys')
                    .update({
                        meta: nextMeta,
                        updated_at: now
                    })
                    .eq('id', journeyId);

                if (updateError) throw updateError;

                if (cancelled) return;
                setControlMode(CONTROL_MODE_PILOT_LOCKED);
                setControllerUserId(userId);
                setControllerRole('pilot');
                setControllerName(localFirstName);
            } catch (error) {
                console.warn('Error claiming pilot control in glasses checklist:', error);
            } finally {
                if (!cancelled) {
                    setIsClaimingPilotControl(false);
                }
            }
        };

        claimPilotControl();

        return () => {
            cancelled = true;
        };
    }, [journeyId, userId, role, glassesDone, pilotLocked, localFirstName]);

    useEffect(() => {
        if (!canEditChecklist && showCounterModal) {
            setShowCounterModal(false);
        }
    }, [canEditChecklist, showCounterModal]);

    useEffect(() => {
        if (!pilotLockToast) return;
        const timer = setTimeout(() => setPilotLockToast(''), 2600);
        return () => clearTimeout(timer);
    }, [pilotLockToast]);

    const showPilotLockMessage = () => {
        setPilotLockToast('Solo el piloto puede palomear este checklist de electrónica.');
    };

    const saveCheckToggle = async (checkKey) => {
        if (!checkKey || !journeyId || !userId || itemInteractionDisabled) return;

        if (isReadOnlyByPilotControl) {
            showPilotLockMessage();
            return;
        }

        setIsSavingCheck(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data: currentData, error: readError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            const currentMeta = parseMeta(currentData?.meta);
            if (currentMeta.global_glasses_done === true) {
                setGlassesDone(true);
                setClosedByName(safeText(currentMeta.global_glasses_done_by_name));
                setControlMode(getControlMode(currentMeta));
                setControllerName(getControllerName(currentMeta));
                setControllerRole(getControllerRole(currentMeta));
                setControllerUserId(getControllerUserId(currentMeta));
                return;
            }

            const currentControlMode = getControlMode(currentMeta);
            if (currentControlMode === CONTROL_MODE_PILOT_LOCKED && role !== 'pilot') {
                setControlMode(currentControlMode);
                setControllerName(getControllerName(currentMeta));
                setControllerRole(getControllerRole(currentMeta));
                setControllerUserId(getControllerUserId(currentMeta));
                showPilotLockMessage();
                return;
            }

            const latestStationCount = getStationCount(currentMeta);
            const nextChecks = normalizeChecks(currentMeta.global_glasses_checks, latestStationCount);
            const isConfirmed = nextChecks[checkKey]?.confirmed === true;

            if (!isConfirmed) {
                nextChecks[checkKey] = {
                    confirmed: true,
                    confirmed_by: userId,
                    confirmed_name: localFirstName,
                    confirmed_at: now
                };
            } else {
                nextChecks[checkKey] = {
                    confirmed: false,
                    confirmed_by: null,
                    confirmed_name: null,
                    confirmed_at: null
                };
            }

            const nextMeta = {
                ...currentMeta,
                global_glasses_station_count: latestStationCount,
                global_glasses_checks: nextChecks
            };

            if (role === 'pilot') {
                nextMeta.global_glasses_control_mode = CONTROL_MODE_PILOT_LOCKED;
                nextMeta.global_glasses_controller_user_id = userId;
                nextMeta.global_glasses_controller_name = localFirstName;
                nextMeta.global_glasses_controller_role = 'pilot';
                nextMeta.global_glasses_control_locked_at = now;
            }

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setStationCount(latestStationCount);
            setChecks(nextChecks);
        } catch (error) {
            console.error('Error updating glasses checklist item:', error);
            alert('No se pudo guardar la confirmacion. Intenta de nuevo.');
        } finally {
            setIsSavingCheck(false);
        }
    };

    const openFinalizeModal = () => {
        if (!canFinalizeChecklist) return;
        setFunctionalCount((prev) => clamp(prev, 0, MAX_FUNCTIONAL_GLASSES));
        setShowCounterModal(true);
    };

    const confirmFinalize = async () => {
        if (!journeyId || !userId || isFinalizing || !canFinalizeChecklist) return;

        setIsFinalizing(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data: currentData, error: readError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            const currentMeta = parseMeta(currentData?.meta);
            const currentControlMode = getControlMode(currentMeta);

            if (currentMeta.global_glasses_done === true) {
                const latestStationCount = getStationCount(currentMeta);
                const latestChecks = normalizeChecks(currentMeta.global_glasses_checks, latestStationCount);
                setStationCount(latestStationCount);
                setChecks(latestChecks);
                setGlassesDone(true);
                setClosedByName(safeText(currentMeta.global_glasses_done_by_name));
                setControlMode(getControlMode(currentMeta));
                setControllerName(getControllerName(currentMeta));
                setControllerRole(getControllerRole(currentMeta));
                setControllerUserId(getControllerUserId(currentMeta));
                setShowCounterModal(false);
                return;
            }

            if (currentControlMode === CONTROL_MODE_PILOT_LOCKED && role !== 'pilot') {
                setControlMode(currentControlMode);
                setControllerName(getControllerName(currentMeta));
                setControllerRole(getControllerRole(currentMeta));
                setControllerUserId(getControllerUserId(currentMeta));
                setShowCounterModal(false);
                alert('El piloto tiene el control de este checklist global.');
                return;
            }

            const latestStationCount = getStationCount(currentMeta);
            const latestChecks = normalizeChecks(currentMeta.global_glasses_checks, latestStationCount);
            const latestConfirmed = getConfirmedCount(latestChecks, latestStationCount);
            const latestTotal = getRequiredKeys(latestStationCount).length;

            if (latestConfirmed !== latestTotal || latestTotal === 0) {
                setStationCount(latestStationCount);
                setChecks(latestChecks);
                setShowCounterModal(false);
                alert('Faltan pasos por confirmar en la configuracion global de gafas.');
                return;
            }

            const normalizedFunctionalCount = clamp(functionalCount, 0, MAX_FUNCTIONAL_GLASSES);
            const nextMeta = {
                ...currentMeta,
                global_glasses_station_count: latestStationCount,
                global_glasses_checks: latestChecks,
                global_glasses_done: true,
                global_glasses_done_at: now,
                global_glasses_done_by: userId,
                global_glasses_done_by_name: localFirstName,
                global_glasses_functional_count: normalizedFunctionalCount,
                pilot_music_ambience_checks: {},
                pilot_music_ambience_done: false,
                pilot_music_ambience_done_at: null,
                pilot_music_ambience_done_by: null,
                pilot_music_ambience_done_by_name: null,
                teacher_operation_ready_checks: {},
                teacher_operation_ready: false,
                teacher_operation_ready_at: null,
                teacher_operation_ready_by: null,
                teacher_operation_ready_by_name: null,
                aux_operation_stand_photo_url: null,
                aux_operation_stand_photo_at: null,
                aux_operation_stand_photo_by: null,
                aux_operation_ready: false,
                aux_operation_ready_at: null,
                aux_operation_ready_by: null,
                aux_operation_ready_by_name: null,
                operation_start_bridge_at: null,
                operation_start_bridge_by: null
            };

            if (role === 'pilot') {
                nextMeta.global_glasses_control_mode = CONTROL_MODE_PILOT_LOCKED;
                nextMeta.global_glasses_controller_user_id = userId;
                nextMeta.global_glasses_controller_name = localFirstName;
                nextMeta.global_glasses_controller_role = 'pilot';
                nextMeta.global_glasses_control_locked_at = now;
            }

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'seat_deployment',
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setStationCount(latestStationCount);
            setChecks(latestChecks);
            setGlassesDone(true);
            setClosedByName(localFirstName);
            setShowCounterModal(false);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error finalizing glasses setup:', error);
            alert('No se pudo cerrar la tarea global de configuracion de gafas.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const renderCheckItem = (checkKey, label, compact = false) => {
        const check = checks?.[checkKey] || EMPTY_CHECK;
        const confirmed = check.confirmed === true;
        const confirmedBy = safeText(check.confirmed_name) || 'Operativo';
        const clickable = !itemInteractionDisabled;
        const rowPadding = compact ? '10px 10px' : '12px 12px';

        const handlePress = () => {
            if (itemInteractionDisabled) return;
            if (isReadOnlyByPilotControl) {
                showPilotLockMessage();
                return;
            }
            saveCheckToggle(checkKey);
        };

        return (
            <button
                key={checkKey}
                type="button"
                disabled={!clickable}
                onClick={handlePress}
                style={{
                    border: confirmed ? '1px solid #BFDBFE' : '1px solid #E5E7EB',
                    background: confirmed ? 'linear-gradient(180deg, #F8FBFF 0%, #EFF6FF 100%)' : '#FFFFFF',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    textAlign: 'left',
                    padding: rowPadding,
                    borderRadius: compact ? 14 : 16,
                    cursor: clickable ? (isReadOnlyByPilotControl ? 'not-allowed' : 'pointer') : 'not-allowed',
                    opacity: glassesDone ? 0.72 : (isReadOnlyByPilotControl ? 0.92 : 1),
                    boxShadow: compact ? 'none' : '0 6px 16px -14px rgba(15, 23, 42, 0.35)',
                    transition: 'all 0.2s ease'
                }}
            >
                <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: confirmed ? '2px solid #2563EB' : '2px solid #D1D5DB',
                    backgroundColor: confirmed ? '#2563EB' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                    transition: 'all 0.2s ease'
                }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: confirmed ? 1 : 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'clamp(13px, 2.8vw, 14px)', fontWeight: 650, color: '#374151', lineHeight: 1.35 }}>
                        {label}
                    </span>
                    {confirmed && (
                        <span style={{ display: 'block', marginTop: 5, fontSize: 11, fontWeight: 700, color: '#0F9D58' }}>
                            Confirmado por: {confirmedBy}
                        </span>
                    )}
                </div>
            </button>
        );
    };

    const block0Done = block0Keys.every((key) => checks?.[key]?.confirmed);
    const block1Done = block1Keys.every((key) => checks?.[key]?.confirmed);

    return (
        <div className="relative flex min-h-screen flex-col bg-slate-100 text-slate-800 antialiased">
            <SyncHeader
                firstName={localFirstName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={pilotLocked}
                waitPhase={pilotLocked ? 'load' : null}
                chipOverride={headerChipText}
                onDemoStart={onRefresh}
            />

            <main className="mx-auto w-full max-w-[560px] flex-1 overflow-y-auto px-4 pb-32 pt-4 sm:px-6 sm:pt-5">
                <div
                    className="mx-auto mb-3.5 w-full max-w-[460px]"
                    dangerouslySetInnerHTML={{ __html: GLASSES_SETUP_ILLUSTRATION_SVG }}
                />

                <div className="mb-4.5 text-center">
                    <h2 className="m-0 text-[clamp(24px,5.6vw,32px)] font-extrabold tracking-[-0.03em] text-slate-800">
                        Configuracion de Gafas
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-[360px] text-[clamp(13px,2.9vw,14px)] leading-relaxed text-slate-500">
                        Sigue los bloques en orden para dejar lista la electrónica y validar cada estación en tiempo real.
                    </p>
                </div>

                <div className={`mb-3 flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 ${pilotLocked ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 20,
                        color: pilotLocked ? '#2563EB' : '#16A34A',
                        fontVariationSettings: "'FILL' 1, 'wght' 500",
                        marginTop: 1,
                        flexShrink: 0
                    }}>
                        {pilotLocked ? 'shield_lock' : 'groups'}
                    </span>
                    <p className={`m-0 text-[clamp(12px,2.7vw,13px)] font-semibold leading-[1.45] ${pilotLocked ? 'text-blue-700' : 'text-emerald-700'}`}>
                        {pilotLocked
                            ? (role === 'pilot'
                                ? 'Tienes el control del checklist global de gafas.'
                                : `Control actual: Piloto${controllerIdentityKnown ? ` ${controllerLabel}` : ''}. Puedes apoyar mientras ves el avance en tiempo real.`)
                            : (isClaimingPilotControl
                                ? 'Sincronizando control del piloto...'
                                : 'Checklist colaborativo temporal. Cuando llegue el piloto, tomara el control.')}
                    </p>
                </div>

                <div className="mb-3.5 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3.5 py-3 shadow-[0_8px_18px_-14px_rgba(15,23,42,0.4)]">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', color: '#475569' }}>
                            Progreso global
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#1D4ED8' }}>
                            {confirmedCount}/{totalRequired}
                        </span>
                    </div>
                    <div style={{ width: '100%', height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{
                            width: `${totalRequired > 0 ? Math.round((confirmedCount / totalRequired) * 100) : 0}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #2563EB 0%, #06B6D4 100%)',
                            transition: 'width 0.25s ease'
                        }} />
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <section className="rounded-[22px] border border-slate-200 bg-white px-3.5 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)] sm:px-4">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    backgroundColor: '#DBEAFE',
                                    color: '#1D4ED8',
                                    fontSize: 12,
                                    fontWeight: 800
                                }}>
                                    1
                                </span>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 28,
                                    height: 28,
                                    borderRadius: 10,
                                    border: '1px solid #BFDBFE',
                                    backgroundColor: '#EFF6FF',
                                    color: '#1D4ED8'
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                                        cable
                                    </span>
                                </span>
                                <h3 className="m-0 text-[clamp(14px,3.2vw,15px)] font-extrabold leading-[1.35] text-slate-800">
                                    Bloque 1 · Cables
                                </h3>
                            </div>
                            {block0Done && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#0F9D58', backgroundColor: '#ECFDF5', borderRadius: 999, border: '1px solid #BBF7D0', padding: '3px 9px' }}>
                                    Listo
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {renderCheckItem('block0_connect_cabinet', 'Conectar cables al gabinete (en puertos correctos)')}
                            {renderCheckItem('block0_route_to_seats', 'Llevar cables a cada silla (extremo del cable a su asiento correspondiente)')}
                        </div>
                    </section>

                    <section className="rounded-[22px] border border-slate-200 bg-white px-3.5 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)] sm:px-4">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    backgroundColor: '#E0F2FE',
                                    color: '#0369A1',
                                    fontSize: 12,
                                    fontWeight: 800
                                }}>
                                    2
                                </span>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 28,
                                    height: 28,
                                    borderRadius: 10,
                                    border: '1px solid #BAE6FD',
                                    backgroundColor: '#F0F9FF',
                                    color: '#0369A1'
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                                        visibility
                                    </span>
                                </span>
                                <h3 className="m-0 text-[clamp(14px,3.2vw,15px)] font-extrabold leading-[1.35] text-slate-800">
                                    Bloque 2 · Gafas
                                </h3>
                            </div>
                            {block1Done && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#0F9D58', backgroundColor: '#ECFDF5', borderRadius: 999, border: '1px solid #BBF7D0', padding: '3px 9px' }}>
                                    Listo
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {renderCheckItem('block1_take_from_case', 'Sacar gafas del estuche')}
                            {renderCheckItem('block1_place_on_seat', 'Colocar gafas en su silla')}
                        </div>
                    </section>

                    <section className="rounded-[22px] border border-slate-200 bg-white px-3.5 py-4 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)] sm:px-4">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 28,
                                height: 28,
                                borderRadius: 999,
                                backgroundColor: '#F5F3FF',
                                color: '#6D28D9',
                                fontSize: 12,
                                fontWeight: 800
                            }}>
                                3
                            </span>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                borderRadius: 10,
                                border: '1px solid #DDD6FE',
                                backgroundColor: '#FAF5FF',
                                color: '#6D28D9'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                                    fact_check
                                </span>
                            </span>
                            <h3 className="m-0 text-[clamp(14px,3.2vw,15px)] font-extrabold leading-[1.35] text-slate-800">
                                Bloque 3 · Conexion y prueba
                            </h3>
                        </div>

                        <p className="mb-2.5 mt-0 text-xs leading-[1.45] text-slate-500">
                            Verifica estas dos tareas antes de continuar al cierre del checklist.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {renderCheckItem('seat_1_connect_cable', 'Conectar cable a la gafa', true)}
                            {renderCheckItem('seat_1_confirm_image', 'Confirmar imagen', true)}
                        </div>
                    </section>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1.5 opacity-75">
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6B7280', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                        verified_user
                    </span>
                    <p className="m-0 text-[11px] font-semibold text-slate-500">
                        No cierres la app (los datos se guardan)
                    </p>
                </div>
            </main>

            <div
                className="sticky bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/90 px-4 pb-5 pt-4 backdrop-blur-xl sm:px-6"
                style={{ WebkitBackdropFilter: 'blur(12px)' }}
            >
                <div className="mx-auto w-full max-w-[520px]">
                    <button
                        type="button"
                        onClick={openFinalizeModal}
                        disabled={!canFinalizeChecklist}
                        style={{
                            width: '100%',
                            padding: '15px 16px',
                            borderRadius: 16,
                            border: 'none',
                            backgroundColor: canFinalizeChecklist ? '#2563EB' : '#E5E7EB',
                            color: canFinalizeChecklist ? '#FFFFFF' : '#9CA3AF',
                            fontWeight: 700,
                            fontSize: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: canFinalizeChecklist ? 'pointer' : 'not-allowed',
                            boxShadow: canFinalizeChecklist ? '0 10px 40px -10px rgba(37, 99, 235, 0.25)' : 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isFinalizing ? <Loader2 className="animate-spin" size={18} /> : null}
                        <span>{glassesDone ? 'Gafas configuradas' : 'Gafas listas'}</span>
                        {!glassesDone && !isFinalizing && (
                            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                                arrow_forward
                            </span>
                        )}
                    </button>

                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                            {glassesDone
                                ? `Checklist global cerrado${closedByName ? ` · ${closedByName}` : ''}`
                                : isReadOnlyByPilotControl
                                    ? `Solo lectura · Control del piloto${controllerIdentityKnown ? ` ${controllerLabel}` : ''}`
                                : `${confirmedCount}/${totalRequired} confirmaciones`
                            }
                        </span>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '33%', maxWidth: 128, height: 4, borderRadius: 999, backgroundColor: '#D1D5DB' }} />
                    </div>
                </div>
            </div>

            {pilotLockToast && (
                <div style={{
                    position: 'fixed',
                    left: '50%',
                    bottom: 112,
                    transform: 'translateX(-50%)',
                    zIndex: 125,
                    width: 'min(92vw, 460px)',
                    borderRadius: 14,
                    border: '1px solid #BFDBFE',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    boxShadow: '0 12px 28px -18px rgba(15, 23, 42, 0.45)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                        shield_lock
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 650, lineHeight: 1.4 }}>
                        {pilotLockToast}
                    </span>
                </div>
            )}

            {showCounterModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(2, 6, 23, 0.62)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    padding: 16,
                    zIndex: 130
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: 460,
                        borderRadius: 22,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 20px 42px -22px rgba(15, 23, 42, 0.5)',
                        padding: 16
                    }}>
                        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A' }}>
                            Cuantas gafas funcionan correctamente?
                        </h3>

                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
                            <button
                                type="button"
                                onClick={() => setFunctionalCount((prev) => clamp(prev - 1, 0, MAX_FUNCTIONAL_GLASSES))}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: '#FFFFFF',
                                    color: '#334155',
                                    fontSize: 24,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    cursor: 'pointer'
                                }}
                            >
                                -
                            </button>

                            <span style={{ minWidth: 56, textAlign: 'center', fontSize: 44, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>
                                {functionalCount}
                            </span>

                            <button
                                type="button"
                                onClick={() => setFunctionalCount((prev) => clamp(prev + 1, 0, MAX_FUNCTIONAL_GLASSES))}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: '#FFFFFF',
                                    color: '#334155',
                                    fontSize: 24,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    cursor: 'pointer'
                                }}
                            >
                                +
                            </button>
                        </div>

                        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                            <button
                                type="button"
                                disabled={isFinalizing}
                                onClick={() => setShowCounterModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 12,
                                    border: '1px solid #CBD5E1',
                                    backgroundColor: '#FFFFFF',
                                    color: '#334155',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: isFinalizing ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                disabled={isFinalizing}
                                onClick={confirmFinalize}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 12,
                                    border: 'none',
                                    backgroundColor: '#2563EB',
                                    color: '#FFFFFF',
                                    fontSize: 14,
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    cursor: isFinalizing ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isFinalizing ? <Loader2 className="animate-spin" size={16} /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
