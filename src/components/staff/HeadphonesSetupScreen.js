'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const HEADPHONES_ITEMS = [
    { id: 'take_from_container', label: 'Sacar audifonos del contenedor' },
    { id: 'deploy_headphones', label: 'Desplegar audifonos' },
    { id: 'power_on_headphones', label: 'Encender audifonos' },
    { id: 'adjust_volume', label: 'Ajustar nivel de volumen' },
    { id: 'test_audio_playback', label: 'Probar reproduccion de audio' },
    { id: 'verify_microphone', label: 'Verificar funcionamiento del microfono' }
];

const CONTROL_MODE_OPEN = 'open';
const CONTROL_MODE_PILOT_LOCKED = 'pilot_locked';

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function getFirstName(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

function createEmptyChecks() {
    return HEADPHONES_ITEMS.reduce((acc, item) => {
        acc[item.id] = {
            confirmed: false,
            confirmed_by: null,
            confirmed_name: null,
            confirmed_at: null
        };
        return acc;
    }, Object.create(null));
}

function normalizeChecks(rawChecks) {
    const empty = createEmptyChecks();
    const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
        ? rawChecks
        : Object.create(null);

    HEADPHONES_ITEMS.forEach((item) => {
        const current = source[item.id];
        if (!current || typeof current !== 'object') return;
        empty[item.id] = {
            confirmed: current.confirmed === true,
            confirmed_by: safeText(current.confirmed_by) || null,
            confirmed_name: safeText(current.confirmed_name) || null,
            confirmed_at: safeText(current.confirmed_at) || null
        };
    });

    return empty;
}

function checksAreEqual(a, b) {
    return HEADPHONES_ITEMS.every((item) => {
        const left = a?.[item.id] || Object.create(null);
        const right = b?.[item.id] || Object.create(null);
        return (
            Boolean(left.confirmed) === Boolean(right.confirmed) &&
            safeText(left.confirmed_by) === safeText(right.confirmed_by) &&
            safeText(left.confirmed_name) === safeText(right.confirmed_name) &&
            safeText(left.confirmed_at) === safeText(right.confirmed_at)
        );
    });
}

function getConfirmedCount(checks) {
    return HEADPHONES_ITEMS.reduce((sum, item) => sum + (checks?.[item.id]?.confirmed ? 1 : 0), 0);
}

function getControlMode(meta = {}) {
    return meta.global_headphones_control_mode === CONTROL_MODE_PILOT_LOCKED
        ? CONTROL_MODE_PILOT_LOCKED
        : CONTROL_MODE_OPEN;
}

function getControllerName(meta = {}) {
    return safeText(meta.global_headphones_controller_name);
}

function getControllerRole(meta = {}) {
    return safeText(meta.global_headphones_controller_role).toLowerCase();
}

function getControllerUserId(meta = {}) {
    return safeText(meta.global_headphones_controller_user_id);
}

export default function HeadphonesSetupScreen({
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
    const [checks, setChecks] = useState(() => normalizeChecks(initialMeta.global_headphones_checks));
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [headphonesDone, setHeadphonesDone] = useState(initialMeta.global_headphones_done === true);
    const [closedByName, setClosedByName] = useState(safeText(initialMeta.global_headphones_done_by_name));
    const [controlMode, setControlMode] = useState(() => getControlMode(initialMeta));
    const [controllerName, setControllerName] = useState(() => getControllerName(initialMeta));
    const [controllerRole, setControllerRole] = useState(() => getControllerRole(initialMeta));
    const [controllerUserId, setControllerUserId] = useState(() => getControllerUserId(initialMeta));
    const [isClaimingPilotControl, setIsClaimingPilotControl] = useState(false);

    const firstName = getFirstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';
    const role = safeText(profile?.role).toLowerCase();

    const confirmedCount = getConfirmedCount(checks);
    const allConfirmed = confirmedCount === HEADPHONES_ITEMS.length;
    const isBusy = isSavingCheck || isFinalizing;
    const pilotLocked = controlMode === CONTROL_MODE_PILOT_LOCKED;
    const isReadOnlyByPilotControl = pilotLocked && role !== 'pilot';
    const canEditChecklist = !headphonesDone && !isBusy && !isReadOnlyByPilotControl;
    const canFinalizeChecklist = allConfirmed && !headphonesDone && !isBusy && !isReadOnlyByPilotControl;
    const controllerLabel = controllerName || (controllerRole === 'pilot' ? 'Piloto' : 'Operativo');
    const controllerIdentityKnown = Boolean(controllerName || controllerUserId);
    const headerChipText = pilotLocked
        ? (role === 'pilot' ? 'Te esperan' : 'En espera del piloto')
        : null;

    useEffect(() => {
        const meta = parseMeta(missionMetaSafe);
        const nextChecks = normalizeChecks(meta.global_headphones_checks);
        const nextDone = meta.global_headphones_done === true;
        const nextClosedByName = safeText(meta.global_headphones_done_by_name);
        const nextControlMode = getControlMode(meta);
        const nextControllerName = getControllerName(meta);
        const nextControllerRole = getControllerRole(meta);
        const nextControllerUserId = getControllerUserId(meta);

        setChecks((prev) => (checksAreEqual(nextChecks, prev) ? prev : nextChecks));
        setHeadphonesDone((prev) => (prev === nextDone ? prev : nextDone));
        setClosedByName((prev) => (prev === nextClosedByName ? prev : nextClosedByName));
        setControlMode((prev) => (prev === nextControlMode ? prev : nextControlMode));
        setControllerName((prev) => (prev === nextControllerName ? prev : nextControllerName));
        setControllerRole((prev) => (prev === nextControllerRole ? prev : nextControllerRole));
        setControllerUserId((prev) => (prev === nextControllerUserId ? prev : nextControllerUserId));
    }, [missionMetaSafe, missionState]);

    useEffect(() => {
        if (!journeyId || !userId || role !== 'pilot' || headphonesDone || pilotLocked) return;

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
                if (currentMeta.global_headphones_done === true) return;

                const nextMeta = {
                    ...currentMeta,
                    global_headphones_control_mode: CONTROL_MODE_PILOT_LOCKED,
                    global_headphones_controller_user_id: userId,
                    global_headphones_controller_name: firstName,
                    global_headphones_controller_role: 'pilot',
                    global_headphones_control_locked_at: now
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
                setControllerName(firstName);
            } catch (error) {
                console.warn('Error claiming pilot control in headphones checklist:', error);
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
    }, [journeyId, userId, role, headphonesDone, pilotLocked, firstName]);

    const saveCheckState = async (itemId) => {
        if (!itemId || !journeyId || !userId || !canEditChecklist) return;

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
            if (currentMeta.global_headphones_done === true) {
                setHeadphonesDone(true);
                setClosedByName(safeText(currentMeta.global_headphones_done_by_name));
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
                alert('El piloto tiene el control de este checklist global.');
                return;
            }

            const nextChecks = normalizeChecks(currentMeta.global_headphones_checks);
            const alreadyConfirmed = nextChecks[itemId]?.confirmed === true;

            if (alreadyConfirmed) {
                nextChecks[itemId] = {
                    confirmed: false,
                    confirmed_by: null,
                    confirmed_name: null,
                    confirmed_at: null
                };
            } else {
                nextChecks[itemId] = {
                    confirmed: true,
                    confirmed_by: userId,
                    confirmed_name: firstName,
                    confirmed_at: now
                };
            }

            const nextMeta = {
                ...currentMeta,
                global_headphones_checks: nextChecks
            };

            if (role === 'pilot') {
                nextMeta.global_headphones_control_mode = CONTROL_MODE_PILOT_LOCKED;
                nextMeta.global_headphones_controller_user_id = userId;
                nextMeta.global_headphones_controller_name = firstName;
                nextMeta.global_headphones_controller_role = 'pilot';
                nextMeta.global_headphones_control_locked_at = now;
            }

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setChecks(nextChecks);
        } catch (error) {
            console.error('Error updating headphones checklist item:', error);
            alert('No se pudo guardar la confirmacion. Intenta de nuevo.');
        } finally {
            setIsSavingCheck(false);
        }
    };

    const finalizeHeadphones = async () => {
        if (!canFinalizeChecklist || !journeyId || !userId) return;

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

            if (currentMeta.global_headphones_done === true) {
                const latestChecks = normalizeChecks(currentMeta.global_headphones_checks);
                setChecks(latestChecks);
                setHeadphonesDone(true);
                setClosedByName(safeText(currentMeta.global_headphones_done_by_name));
                setControlMode(currentControlMode);
                setControllerName(getControllerName(currentMeta));
                setControllerRole(getControllerRole(currentMeta));
                setControllerUserId(getControllerUserId(currentMeta));
                return;
            }

            if (currentControlMode === CONTROL_MODE_PILOT_LOCKED && role !== 'pilot') {
                setControlMode(currentControlMode);
                setControllerName(getControllerName(currentMeta));
                setControllerRole(getControllerRole(currentMeta));
                setControllerUserId(getControllerUserId(currentMeta));
                alert('El piloto tiene el control de este checklist global.');
                return;
            }

            const latestChecks = normalizeChecks(currentMeta.global_headphones_checks);
            const latestCount = getConfirmedCount(latestChecks);

            if (latestCount !== HEADPHONES_ITEMS.length) {
                setChecks(latestChecks);
                alert('Faltan confirmaciones del checklist global de audifonos.');
                return;
            }

            const nextMeta = {
                ...currentMeta,
                global_headphones_checks: latestChecks,
                global_headphones_done: true,
                global_headphones_done_at: now,
                global_headphones_done_by: userId,
                global_headphones_done_by_name: firstName,
                global_glasses_station_count: Number.isFinite(Number(currentMeta.global_glasses_station_count))
                    ? Math.max(1, Math.floor(Number(currentMeta.global_glasses_station_count)))
                    : 2,
                global_glasses_checks: currentMeta.global_glasses_checks || Object.create(null),
                global_glasses_done: currentMeta.global_glasses_done === true,
                global_glasses_done_at: currentMeta.global_glasses_done_at || null,
                global_glasses_done_by: currentMeta.global_glasses_done_by || null,
                global_glasses_done_by_name: currentMeta.global_glasses_done_by_name || null,
                global_glasses_functional_count: Number.isFinite(Number(currentMeta.global_glasses_functional_count))
                    ? Math.max(0, Math.floor(Number(currentMeta.global_glasses_functional_count)))
                    : null
            };

            if (role === 'pilot') {
                nextMeta.global_headphones_control_mode = CONTROL_MODE_PILOT_LOCKED;
                nextMeta.global_headphones_controller_user_id = userId;
                nextMeta.global_headphones_controller_name = firstName;
                nextMeta.global_headphones_controller_role = 'pilot';
                nextMeta.global_headphones_control_locked_at = now;
            }

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setChecks(latestChecks);
            setHeadphonesDone(true);
            setClosedByName(firstName);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error finalizing headphones setup:', error);
            alert('No se pudo cerrar la tarea global de audifonos.');
        } finally {
            setIsFinalizing(false);
        }
    };

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: '#F3F4F6',
            color: '#1F2937',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={firstName}
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

            <main style={{
                flex: 1,
                padding: '16px 24px 120px',
                maxWidth: 520,
                margin: '0 auto',
                width: '100%',
                overflowY: 'auto'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: 420,
                    margin: '0 auto 18px'
                }}>
                    <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', display: 'block' }}>
                        <defs>
                            <pattern id="hp-dot-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <circle cx="20" cy="20" r="1.5" fill="#cbd5e1" />
                            </pattern>

                            <filter id="hp-shadow-soft" x="-20%" y="-20%" width="140%" height="150%">
                                <feDropShadow dx="0" dy="15" stdDeviation="15" floodColor="#0f172a" floodOpacity="0.15" />
                            </filter>
                            <filter id="hp-shadow-ui" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.1" />
                            </filter>
                            <filter id="hp-glow-green" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="hp-glow-blue" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="hp-glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>

                            <path id="hp-music-note" d="M 12 0 L 12 16 C 12 20 8 24 4 24 C 0 24 -4 20 -4 16 C -4 12 0 8 4 8 C 6.5 8 8 9 9.5 10.5 L 9.5 4 L 20 2 L 20 8 L 12 10 Z" fill="#3b82f6" />
                            <path id="hp-mic-icon" d="M 0 -10 Q 8 -10 8 0 L 8 10 Q 8 20 0 20 Q -8 20 -8 10 L -8 0 Q -8 -10 0 -10 Z M -12 10 A 12 12 0 0 0 12 10 M 0 22 L 0 30 M -6 30 L 6 30" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </defs>

                        <rect width="100%" height="100%" fill="url(#hp-dot-grid)" />

                        <g id="progress-tracker" transform="translate(400, 560)">
                            <rect x="-100" y="-15" width="200" height="30" rx="15" fill="#ffffff" filter="url(#hp-shadow-ui)" />

                            <circle cx="-72" cy="0" r="6" fill="#e2e8f0"><animate attributeName="fill" values="#e2e8f0; #3b82f6; #3b82f6; #e2e8f0" keyTimes="0; 0.05; 0.95; 1" dur="10s" repeatCount="indefinite" /></circle>
                            <circle cx="-36" cy="0" r="6" fill="#e2e8f0"><animate attributeName="fill" values="#e2e8f0; #e2e8f0; #10b981; #10b981; #e2e8f0" keyTimes="0; 0.24; 0.25; 0.95; 1" dur="10s" repeatCount="indefinite" /></circle>
                            <circle cx="0" cy="0" r="6" fill="#e2e8f0"><animate attributeName="fill" values="#e2e8f0; #e2e8f0; #f59e0b; #f59e0b; #e2e8f0" keyTimes="0; 0.44; 0.45; 0.95; 1" dur="10s" repeatCount="indefinite" /></circle>
                            <circle cx="36" cy="0" r="6" fill="#e2e8f0"><animate attributeName="fill" values="#e2e8f0; #e2e8f0; #3b82f6; #3b82f6; #e2e8f0" keyTimes="0; 0.64; 0.65; 0.95; 1" dur="10s" repeatCount="indefinite" /></circle>
                            <circle cx="72" cy="0" r="6" fill="#e2e8f0"><animate attributeName="fill" values="#e2e8f0; #e2e8f0; #a855f7; #a855f7; #e2e8f0" keyTimes="0; 0.84; 0.85; 0.95; 1" dur="10s" repeatCount="indefinite" /></circle>
                        </g>

                        <g>
                            <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.02; 0.95; 0.98; 1" dur="10s" repeatCount="indefinite" />

                            <g filter="url(#hp-shadow-soft)">
                                <rect x="250" y="380" width="300" height="40" rx="20" fill="#1e293b" />
                                <rect x="260" y="375" width="280" height="20" rx="10" fill="#020617" />
                            </g>

                            <g>
                                <animateTransform attributeName="transform" type="translate" values="0,0; 0,-50; 0,-50" keyTimes="0; 0.15; 1" dur="10s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="1; 1; 0; 0" keyTimes="0; 0.05; 0.15; 1" dur="10s" repeatCount="indefinite" />

                                <rect x="250" y="370" width="300" height="40" rx="20" fill="#1e293b" />
                                <path d="M 250 390 L 550 390" fill="none" stroke="#334155" strokeWidth="2" />
                            </g>

                            <g filter="url(#hp-shadow-soft)">
                                <animateTransform
                                    attributeName="transform"
                                    type="translate"
                                    values="400,380; 400,240; 400,240; 400,240"
                                    keyTimes="0; 0.15; 0.9; 1"
                                    calcMode="spline"
                                    keySplines="0.25 0.1 0.25 1; 0 0 1 1; 0 0 1 1"
                                    dur="10s"
                                    repeatCount="indefinite"
                                />

                                <path d="M -110 0 A 110 110 0 0 1 110 0" fill="none" stroke="#1e293b" strokeWidth="28" strokeLinecap="round" />
                                <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" />

                                <rect x="-114" y="-15" width="8" height="35" rx="4" fill="#94a3b8" />
                                <rect x="-132" y="5" width="44" height="90" rx="22" fill="#1e293b" />
                                <rect x="-124" y="20" width="28" height="60" rx="14" fill="#334155" />
                                <rect x="-88" y="10" width="20" height="80" rx="10" fill="#020617" />

                                <line x1="-120" y1="80" x2="-160" y2="120" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
                                <circle cx="-160" cy="120" r="7" fill="#1e293b" />
                                <circle cx="-160" cy="120" r="3" fill="#ef4444">
                                    <animate attributeName="fill" values="#ef4444; #ef4444; #10b981; #10b981" keyTimes="0; 0.84; 0.85; 1" dur="10s" repeatCount="indefinite" />
                                </circle>

                                <rect x="106" y="-15" width="8" height="35" rx="4" fill="#94a3b8" />
                                <rect x="88" y="5" width="44" height="90" rx="22" fill="#1e293b" />
                                <rect x="96" y="20" width="28" height="60" rx="14" fill="#334155" />
                                <rect x="68" y="10" width="20" height="80" rx="10" fill="#020617" />

                                <circle cx="110" cy="80" r="4" fill="#475569">
                                    <animate attributeName="fill" values="#475569; #475569; #10b981; #10b981" keyTimes="0; 0.24; 0.25; 1" dur="10s" repeatCount="indefinite" />
                                </circle>

                                <g opacity="0">
                                    <animate attributeName="opacity" values="0; 0; 1; 1; 0; 0" keyTimes="0; 0.64; 0.65; 0.82; 0.83; 1" dur="10s" repeatCount="indefinite" />

                                    <g stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" fill="none" filter="url(#hp-glow-blue)">
                                        <path d="M 140 30 A 25 25 0 0 1 140 70"><animate attributeName="opacity" values="0; 1; 0" dur="1s" repeatCount="indefinite" /></path>
                                        <path d="M 155 20 A 40 40 0 0 1 155 80"><animate attributeName="opacity" values="0; 1; 0" dur="1s" begin="0.3s" repeatCount="indefinite" /></path>
                                        <path d="M 170 10 A 55 55 0 0 1 170 90"><animate attributeName="opacity" values="0; 1; 0" dur="1s" begin="0.6s" repeatCount="indefinite" /></path>
                                    </g>

                                    <use href="#hp-music-note" transform="translate(150, 50) scale(0.8)">
                                        <animateTransform attributeName="transform" type="translate" values="150,50; 220, 0" dur="1.5s" repeatCount="indefinite" />
                                    </use>
                                    <use href="#hp-music-note" transform="translate(180, 70) scale(1)">
                                        <animateTransform attributeName="transform" type="translate" values="180,70; 260, 40" dur="1.5s" begin="0.7s" repeatCount="indefinite" />
                                    </use>
                                </g>

                                <g stroke="#a855f7" strokeWidth="4" strokeLinecap="round" fill="none" filter="url(#hp-glow-purple)" opacity="0">
                                    <animate attributeName="opacity" values="0; 0; 1; 1; 0; 0" keyTimes="0; 0.84; 0.85; 0.95; 0.96; 1" dur="10s" repeatCount="indefinite" />

                                    <path d="M -220 95 A 35 35 0 0 1 -190 65"><animate attributeName="opacity" values="1; 0; 1" dur="0.8s" repeatCount="indefinite" /></path>
                                    <path d="M -200 105 A 20 20 0 0 1 -180 85"><animate attributeName="opacity" values="0; 1; 0" dur="0.8s" begin="0.4s" repeatCount="indefinite" /></path>
                                </g>
                            </g>

                            <g transform="translate(580, 240)">
                                <animateTransform attributeName="transform" type="translate" values="560,240; 580,240; 580,240; 600,240" keyTimes="0; 0.45; 0.63; 1" dur="10s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 0; 1; 1; 0; 0" keyTimes="0; 0.44; 0.45; 0.63; 0.64; 1" dur="10s" repeatCount="indefinite" />

                                <rect x="-30" y="-70" width="60" height="140" rx="20" fill="#ffffff" filter="url(#hp-shadow-ui)" />
                                <path d="M -10 -50 L -10 -40 L 5 -40 L 5 -50 Z" fill="#94a3b8" />
                                <polygon points="-10,-50 -10,-40 -18,-45" fill="#94a3b8" />

                                <rect x="-6" y="-20" width="12" height="70" rx="6" fill="#e2e8f0" />
                                <rect x="-6" y="50" width="12" height="0" rx="6" fill="#f59e0b">
                                    <animate attributeName="y" values="50; -20; -20" keyTimes="0; 0.8; 1" dur="1.5s" repeatCount="indefinite" />
                                    <animate attributeName="height" values="0; 70; 70" keyTimes="0; 0.8; 1" dur="1.5s" repeatCount="indefinite" />
                                </rect>
                            </g>

                            <g transform="translate(220, 260)">
                                <animateTransform attributeName="transform" type="translate" values="240,260; 220,260; 220,260; 200,260" keyTimes="0; 0.84; 0.85; 1" dur="10s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 0; 1; 1; 0; 0" keyTimes="0; 0.83; 0.84; 0.95; 0.96; 1" dur="10s" repeatCount="indefinite" />

                                <rect x="-40" y="-30" width="80" height="60" rx="16" fill="#ffffff" filter="url(#hp-shadow-ui)" />
                                <g transform="translate(0, -5) scale(0.8)">
                                    <use href="#hp-mic-icon" />
                                </g>
                                <g stroke="#a855f7" strokeWidth="4" strokeLinecap="round">
                                    <line x1="-20" y1="15" x2="-20" y2="15"><animate attributeName="y1" values="15; 5; 15" dur="0.5s" repeatCount="indefinite" /></line>
                                    <line x1="-10" y1="15" x2="-10" y2="15"><animate attributeName="y1" values="15; 0; 15" dur="0.7s" repeatCount="indefinite" /></line>
                                    <line x1="0" y1="15" x2="0" y2="15"><animate attributeName="y1" values="15; -5; 15" dur="0.4s" repeatCount="indefinite" /></line>
                                    <line x1="10" y1="15" x2="10" y2="15"><animate attributeName="y1" values="15; 5; 15" dur="0.6s" repeatCount="indefinite" /></line>
                                    <line x1="20" y1="15" x2="20" y2="15"><animate attributeName="y1" values="15; 10; 15" dur="0.8s" repeatCount="indefinite" /></line>
                                </g>
                            </g>

                            <g transform="translate(400, 90)">
                                <g>
                                    <animateTransform
                                        attributeName="transform"
                                        type="scale"
                                        values="0; 0; 1.2; 1; 1; 0"
                                        keyTimes="0; 0.92; 0.94; 0.95; 0.98; 1"
                                        dur="10s"
                                        repeatCount="indefinite"
                                    />

                                    <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.92; 0.93; 0.98; 0.99" dur="10s" repeatCount="indefinite" />

                                    <circle cx="0" cy="0" r="45" fill="#10b981" filter="url(#hp-shadow-ui)" />
                                    <circle cx="0" cy="0" r="35" fill="none" stroke="#34d399" strokeWidth="3" />

                                    <path d="M -18 -2 L -4 10 L 20 -14" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                                </g>
                            </g>
                        </g>
                    </svg>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2 style={{ fontSize: 30, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 8, letterSpacing: '-0.02em' }}>
                        Configura audifonos
                    </h2>
                    <p style={{
                        margin: '0 auto',
                        fontSize: 14,
                        color: '#6B7280',
                        lineHeight: 1.6,
                        maxWidth: 320
                    }}>
                        Prepara tu equipo de audio para asegurar una comunicacion clara durante el vuelo.
                    </p>
                </div>

                <div style={{
                    marginBottom: 16,
                    borderRadius: 14,
                    border: pilotLocked ? '1px solid #BFDBFE' : '1px solid #BBF7D0',
                    backgroundColor: pilotLocked ? '#EFF6FF' : '#ECFDF5',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 18,
                        color: pilotLocked ? '#2563EB' : '#16A34A',
                        fontVariationSettings: "'FILL' 1, 'wght' 500",
                        marginTop: 1
                    }}>
                        {pilotLocked ? 'shield_lock' : 'groups'}
                    </span>
                    <p style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: pilotLocked ? '#1D4ED8' : '#166534',
                        fontWeight: 600
                    }}>
                        {pilotLocked
                            ? (role === 'pilot'
                                ? 'Tienes el control del checklist global de audifonos.'
                                : `Control actual: Piloto${controllerIdentityKnown ? ` ${controllerLabel}` : ''}. Puedes apoyar mientras ves el avance en tiempo real.`)
                            : (isClaimingPilotControl
                                ? 'Sincronizando control del piloto...'
                                : 'Checklist colaborativo temporal. Cuando llegue el piloto, tomara el control.')}
                    </p>
                </div>

                <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    padding: '20px 18px',
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #E5E7EB',
                    marginBottom: 22
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {HEADPHONES_ITEMS.map((item) => {
                            const itemState = checks[item.id] || Object.create(null);
                            const confirmed = itemState.confirmed === true;
                            const confirmName = safeText(itemState.confirmed_name) || 'Operativo';

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={!canEditChecklist}
                                    onClick={() => saveCheckState(item.id)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        textAlign: 'left',
                                        padding: 0,
                                        cursor: canEditChecklist ? 'pointer' : 'not-allowed',
                                        opacity: headphonesDone ? 0.72 : (isReadOnlyByPilotControl ? 0.86 : 1)
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
                                        <span style={{
                                            display: 'block',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: '#374151',
                                            lineHeight: 1.35
                                        }}>
                                            {item.label}
                                        </span>

                                        {confirmed && (
                                            <span style={{
                                                display: 'block',
                                                marginTop: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: '#10B981'
                                            }}>
                                                Confirmado · {confirmName}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#6B7280', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                        verified_user
                    </span>
                    <p style={{ margin: 0, fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                        No cierres la app (los datos se guardan)
                    </p>
                </div>
            </main>

            <div style={{
                position: 'sticky',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 40,
                padding: '16px 24px 20px',
                backgroundColor: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid #E5E7EB'
            }}>
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                    <button
                        type="button"
                        onClick={finalizeHeadphones}
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
                        {isFinalizing ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <>
                                <span>{headphonesDone ? 'Audifonos configurados' : 'Audifonos listos'}</span>
                                {!headphonesDone && (
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                                        arrow_forward
                                    </span>
                                )}
                            </>
                        )}
                    </button>

                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                            {headphonesDone
                                ? `Checklist global cerrado${closedByName ? ` · ${closedByName}` : ''}`
                                : isReadOnlyByPilotControl
                                    ? `Solo lectura · Control del piloto${controllerIdentityKnown ? ` ${controllerLabel}` : ''}`
                                : `${confirmedCount}/${HEADPHONES_ITEMS.length} confirmaciones`
                            }
                        </span>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '33%', maxWidth: 128, height: 4, backgroundColor: '#D1D5DB', borderRadius: 999 }} />
                    </div>
                </div>
            </div>

        </div>
    );
}
