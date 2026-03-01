'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const CHECK_ITEMS = [
    {
        id: 'batches_ready',
        label: 'Tandas listas',
        sublabel: '(1 en vuelo, 2 en espera)'
    },
    {
        id: 'waiting_zone_ready',
        label: 'Zona de espera lista',
        sublabel: '(2 tandas sentadas y ordenadas)'
    }
];

const CHECK_KEYS = CHECK_ITEMS.map((item) => item.id);

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function getFirstName(fullName, fallback = 'Docente') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

function normalizeChecks(rawChecks) {
    const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
        ? rawChecks
        : Object.create(null);

    return {
        batches_ready: source.batches_ready === true,
        waiting_zone_ready: source.waiting_zone_ready === true
    };
}

function checksAreEqual(left, right) {
    return CHECK_KEYS.every((key) => Boolean(left?.[key]) === Boolean(right?.[key]));
}

function isReadyToStartOperation(meta = {}) {
    return (
        meta.pilot_music_ambience_done === true &&
        meta.teacher_operation_ready === true &&
        meta.aux_operation_ready === true &&
        Boolean(meta.aux_operation_stand_photo_url)
    );
}

const TEACHER_OPERATION_READY_ILLUSTRATION_SVG = `
<svg viewBox="0 0 1000 650" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Listos para volar en tres tandas">
    <defs>
        <filter id="shadow-floor" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="15" stdDeviation="15" flood-color="#0f172a" flood-opacity="0.1" />
        </filter>
        <filter id="shadow-ui" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.15" />
        </filter>
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    </defs>

    <g>
        <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.90; 0.95; 1" dur="10s" repeatCount="indefinite" />

        <rect x="50" y="50" width="900" height="550" rx="40" fill="#f8fafc" />
        <rect x="50" y="50" width="900" height="550" rx="40" fill="none" stroke="#e2e8f0" stroke-width="4" />

        <line x1="50" y1="325" x2="950" y2="325" stroke="#f1f5f9" stroke-width="8" stroke-dasharray="20 20" />
        <circle cx="500" cy="325" r="80" fill="none" stroke="#f1f5f9" stroke-width="8" />

        <g transform="translate(500, 150)" filter="url(#shadow-floor)">
            <ellipse cx="0" cy="35" rx="20" ry="8" fill="#0f172a" opacity="0.15" />
            <rect x="-18" y="-10" width="36" height="45" rx="14" fill="#475569" />
            <circle cx="0" cy="-25" r="16" fill="#fed7aa" />

            <rect x="5" y="0" width="24" height="30" rx="4" fill="#cbd5e1" />
            <rect x="7" y="2" width="20" height="26" rx="2" fill="#ffffff" />

            <rect x="7" y="2" width="20" height="26" rx="2" fill="#10b981" opacity="0" filter="url(#glow-green)">
                <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.44; 0.45; 1" dur="10s" repeatCount="indefinite" />
            </rect>
        </g>

        <g transform="translate(200, 420)">
            <circle cx="0" cy="0" r="70" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="4" stroke-dasharray="10 10" />
            <text x="0" y="-85" font-weight="bold" font-size="14" fill="#94a3b8" text-anchor="middle">TANDA 1</text>
            <g opacity="0">
                <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.14; 0.15; 1" dur="10s" repeatCount="indefinite" />
                <circle cx="0" cy="0" r="70" fill="#dcfce7" fill-opacity="0.5" stroke="#10b981" stroke-width="4" />
                <circle cx="50" cy="-50" r="14" fill="#10b981" />
                <path d="M 45 -50 L 48 -47 L 55 -55" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
            </g>
        </g>

        <g transform="translate(500, 420)">
            <circle cx="0" cy="0" r="70" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="4" stroke-dasharray="10 10" />
            <text x="0" y="-85" font-weight="bold" font-size="14" fill="#94a3b8" text-anchor="middle">TANDA 2</text>
            <g opacity="0">
                <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.29; 0.30; 1" dur="10s" repeatCount="indefinite" />
                <circle cx="0" cy="0" r="70" fill="#dcfce7" fill-opacity="0.5" stroke="#10b981" stroke-width="4" />
                <circle cx="50" cy="-50" r="14" fill="#10b981" />
                <path d="M 45 -50 L 48 -47 L 55 -55" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
            </g>
        </g>

        <g transform="translate(800, 420)">
            <circle cx="0" cy="0" r="70" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="4" stroke-dasharray="10 10" />
            <text x="0" y="-85" font-weight="bold" font-size="14" fill="#94a3b8" text-anchor="middle">TANDA 3</text>
            <g opacity="0">
                <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.44; 0.45; 1" dur="10s" repeatCount="indefinite" />
                <circle cx="0" cy="0" r="70" fill="#dcfce7" fill-opacity="0.5" stroke="#10b981" stroke-width="4" />
                <circle cx="50" cy="-50" r="14" fill="#10b981" />
                <path d="M 45 -50 L 48 -47 L 55 -55" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
            </g>
        </g>

        <g>
            <animateTransform attributeName="transform" type="translate"
                values="-100,420; 200,420; 200,420"
                keyTimes="0; 0.15; 1"
                calcMode="spline" keySplines="0.25 0.1 0.25 1; 0 0 1 1" dur="10s" repeatCount="indefinite" />

            <g transform="translate(-30, 15)">
                <ellipse cx="0" cy="30" rx="14" ry="6" fill="#0f172a" opacity="0.15" />
                <rect x="-12" y="-5" width="24" height="35" rx="12" fill="#38bdf8" />
                <circle cx="0" cy="-15" r="12" fill="#fef08a" />
            </g>
            <g transform="translate(30, 15)">
                <ellipse cx="0" cy="30" rx="14" ry="6" fill="#0f172a" opacity="0.15" />
                <rect x="-12" y="-5" width="24" height="35" rx="12" fill="#0ea5e9" />
                <circle cx="0" cy="-15" r="12" fill="#fef08a" />
            </g>
            <g transform="translate(0, 25)">
                <ellipse cx="0" cy="30" rx="16" ry="7" fill="#0f172a" opacity="0.15" />
                <rect x="-14" y="-5" width="28" height="35" rx="14" fill="#0284c7" />
                <circle cx="0" cy="-15" r="14" fill="#fef08a" />
                <rect x="-8" y="5" width="16" height="20" rx="4" fill="#0369a1" />
            </g>
        </g>

        <g>
            <animateTransform attributeName="transform" type="translate"
                values="500,750; 500,750; 500,420; 500,420"
                keyTimes="0; 0.15; 0.30; 1"
                calcMode="spline" keySplines="0 0 1 1; 0.25 0.1 0.25 1; 0 0 1 1" dur="10s" repeatCount="indefinite" />

            <g transform="translate(-30, 15)">
                <ellipse cx="0" cy="30" rx="14" ry="6" fill="#0f172a" opacity="0.15" />
                <rect x="-12" y="-5" width="24" height="35" rx="12" fill="#c084fc" />
                <circle cx="0" cy="-15" r="12" fill="#ffedd5" />
            </g>
            <g transform="translate(30, 15)">
                <ellipse cx="0" cy="30" rx="14" ry="6" fill="#0f172a" opacity="0.15" />
                <rect x="-12" y="-5" width="24" height="35" rx="12" fill="#a855f7" />
                <circle cx="0" cy="-15" r="12" fill="#ffedd5" />
            </g>
            <g transform="translate(0, 25)">
                <ellipse cx="0" cy="30" rx="16" ry="7" fill="#0f172a" opacity="0.15" />
                <rect x="-14" y="-5" width="28" height="35" rx="14" fill="#9333ea" />
                <circle cx="0" cy="-15" r="14" fill="#ffedd5" />
                <rect x="-8" y="5" width="16" height="20" rx="4" fill="#7e22ce" />
            </g>
        </g>

        <g>
            <animateTransform attributeName="transform" type="translate"
                values="1100,420; 1100,420; 800,420; 800,420"
                keyTimes="0; 0.30; 0.45; 1"
                calcMode="spline" keySplines="0 0 1 1; 0.25 0.1 0.25 1; 0 0 1 1" dur="10s" repeatCount="indefinite" />

            <g transform="translate(-30, 15)">
                <ellipse cx="0" cy="30" rx="14" ry="6" fill="#0f172a" opacity="0.15" />
                <rect x="-12" y="-5" width="24" height="35" rx="12" fill="#fbbf24" />
                <circle cx="0" cy="-15" r="12" fill="#fed7aa" />
            </g>
            <g transform="translate(30, 15)">
                <ellipse cx="0" cy="30" rx="14" ry="6" fill="#0f172a" opacity="0.15" />
                <rect x="-12" y="-5" width="24" height="35" rx="12" fill="#f59e0b" />
                <circle cx="0" cy="-15" r="12" fill="#fed7aa" />
            </g>
            <g transform="translate(0, 25)">
                <ellipse cx="0" cy="30" rx="16" ry="7" fill="#0f172a" opacity="0.15" />
                <rect x="-14" y="-5" width="28" height="35" rx="14" fill="#d97706" />
                <circle cx="0" cy="-15" r="14" fill="#fed7aa" />
                <rect x="-8" y="5" width="16" height="20" rx="4" fill="#b45309" />
            </g>
        </g>

        <g transform="translate(500, 260)">
            <g>
                <animateTransform attributeName="transform" type="scale"
                    values="0; 0; 1.1; 1; 1"
                    keyTimes="0; 0.49; 0.52; 0.55; 1" dur="10s" repeatCount="indefinite" />

                <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.49; 0.51; 1" dur="10s" repeatCount="indefinite" />

                <rect x="-180" y="-70" width="360" height="140" rx="30" fill="#ffffff" filter="url(#shadow-ui)" />

                <rect x="-60" y="-85" width="120" height="30" rx="15" fill="#38bdf8" />
                <text x="0" y="-66" font-family="sans-serif" font-weight="bold" font-size="11" fill="#ffffff" text-anchor="middle" letter-spacing="1">3 TANDAS OK</text>

                <text x="0" y="-10" font-family="sans-serif" font-weight="900" font-size="28" fill="#1e293b" text-anchor="middle" letter-spacing="1">LISTOS PARA</text>
                <text x="0" y="25" font-family="sans-serif" font-weight="900" font-size="34" fill="#10b981" text-anchor="middle" letter-spacing="2">VOLAR</text>

                <g>
                    <animateTransform attributeName="transform" type="translate"
                        values="-120,40; 160,-60; -120,40"
                        keyTimes="0; 0.8; 1" dur="3s" repeatCount="indefinite" />

                    <g transform="rotate(15)">
                        <polygon points="-15,10 15,-5 -15,-20 -5,-5" fill="#38bdf8" />
                        <polygon points="-15,10 15,-5 -5,-5" fill="#0284c7" />
                    </g>
                </g>

                <path d="M -120 40 L 120 -40" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-dasharray="8 8" stroke-linecap="round" />

            </g>
        </g>

    </g>
</svg>
`;

export default function TeacherOperationReadyScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const initialMeta = parseMeta(missionInfo?.meta);
    const [checks, setChecks] = useState(() => normalizeChecks(initialMeta.teacher_operation_ready_checks));
    const [teacherReady, setTeacherReady] = useState(initialMeta.teacher_operation_ready === true);
    const [readyByName, setReadyByName] = useState(() => safeText(initialMeta.teacher_operation_ready_by_name));
    const [pilotMusicReady, setPilotMusicReady] = useState(initialMeta.pilot_music_ambience_done === true);
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextChecks = normalizeChecks(meta.teacher_operation_ready_checks);
        const nextTeacherReady = meta.teacher_operation_ready === true;
        const nextReadyBy = safeText(meta.teacher_operation_ready_by_name);
        const nextPilotMusicReady = meta.pilot_music_ambience_done === true;

        setChecks((prev) => (checksAreEqual(prev, nextChecks) ? prev : nextChecks));
        setTeacherReady((prev) => (prev === nextTeacherReady ? prev : nextTeacherReady));
        setReadyByName((prev) => (prev === nextReadyBy ? prev : nextReadyBy));
        setPilotMusicReady((prev) => (prev === nextPilotMusicReady ? prev : nextPilotMusicReady));
    }, [missionInfo?.meta, missionState]);

    const firstName = getFirstName(profile?.full_name, 'Docente');
    const roleName = ROLE_LABELS[profile?.role] || 'Docente';

    const allChecksDone = useMemo(() => CHECK_KEYS.every((key) => checks[key] === true), [checks]);
    const isBusy = isSavingCheck || isConfirming;
    const ctaDisabled = !pilotMusicReady || !allChecksDone || teacherReady || isBusy;

    const readCurrentMeta = async (supabase) => {
        const { data, error } = await supabase
            .from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single();

        if (error) throw error;
        return parseMeta(data?.meta);
    };

    const writeMeta = async (supabase, nextMeta, now) => {
        const { error } = await supabase
            .from('staff_journeys')
            .update({
                meta: nextMeta,
                updated_at: now
            })
            .eq('id', journeyId);

        if (error) throw error;
    };

    const handleToggleCheck = async (checkId) => {
        if (!journeyId || teacherReady || isBusy) return;

        setIsSavingCheck(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.teacher_operation_ready === true) {
                setTeacherReady(true);
                setReadyByName(safeText(currentMeta.teacher_operation_ready_by_name));
                return;
            }

            const nextChecks = normalizeChecks(currentMeta.teacher_operation_ready_checks);
            nextChecks[checkId] = !nextChecks[checkId];

            const nextMeta = {
                ...currentMeta,
                teacher_operation_ready_checks: nextChecks
            };

            await writeMeta(supabase, nextMeta, now);
            setChecks(nextChecks);
        } catch (error) {
            console.error('Error updating teacher operation checklist:', error);
            alert('No se pudo guardar el checklist. Intenta de nuevo.');
        } finally {
            setIsSavingCheck(false);
        }
    };

    const handleConfirmReady = async () => {
        if (!journeyId || !userId || teacherReady || isBusy) return;

        setIsConfirming(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.teacher_operation_ready === true) {
                setTeacherReady(true);
                setReadyByName(safeText(currentMeta.teacher_operation_ready_by_name));
                onRefresh && onRefresh();
                return;
            }

            if (currentMeta.pilot_music_ambience_done !== true) {
                alert('Espera a que el piloto confirme la ambientacion musical.');
                return;
            }

            const latestChecks = normalizeChecks(currentMeta.teacher_operation_ready_checks);
            const latestAllDone = CHECK_KEYS.every((key) => latestChecks[key] === true);
            if (!latestAllDone) {
                setChecks(latestChecks);
                alert('Completa ambos puntos antes de continuar.');
                return;
            }

            const actorName = getFirstName(profile?.full_name, 'Docente');
            const nextMeta = {
                ...currentMeta,
                teacher_operation_ready_checks: latestChecks,
                teacher_operation_ready: true,
                teacher_operation_ready_at: now,
                teacher_operation_ready_by: userId,
                teacher_operation_ready_by_name: actorName
            };

            if (!currentMeta.operation_start_bridge_at && isReadyToStartOperation(nextMeta)) {
                nextMeta.operation_start_bridge_at = now;
                nextMeta.operation_start_bridge_by = userId;
            }

            await writeMeta(supabase, nextMeta, now);

            setChecks(latestChecks);
            setTeacherReady(true);
            setReadyByName(actorName);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error confirming teacher operation start readiness:', error);
            alert('No se pudo confirmar. Intenta de nuevo.');
        } finally {
            setIsConfirming(false);
        }
    };

    const indicatorText = pilotMusicReady
        ? 'Ambientacion lista (OK)'
        : 'Esperando ambientacion musical...';

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
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                padding: '18px 24px 170px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflowY: 'auto'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: 520,
                    marginBottom: 14,
                    borderRadius: 24,
                    overflow: 'hidden',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 14px 30px -18px rgba(15,23,42,0.28)'
                }}
                    dangerouslySetInnerHTML={{ __html: TEACHER_OPERATION_READY_ILLUSTRATION_SVG }}
                />

                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, marginBottom: 8, fontSize: 30, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
                        Listos para volar
                    </h2>
                    <p style={{ margin: 0, maxWidth: 320, fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>
                        Pidele al maestro delegado 3 tandas de alumnos (1 en vuelo, 2 en espera).
                    </p>
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: 390,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    padding: 20,
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                    marginBottom: 16
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {CHECK_ITEMS.map((item, index) => {
                            const checked = checks[item.id] === true;
                            const disabled = teacherReady || isBusy;
                            return (
                                <div key={item.id}>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => handleToggleCheck(item.id)}
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            background: 'transparent',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 12,
                                            textAlign: 'left',
                                            padding: 0,
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            opacity: disabled ? 0.78 : 1
                                        }}
                                    >
                                        <div style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            backgroundColor: checked ? '#2563EB' : '#DBEAFE',
                                            color: '#FFFFFF',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            marginTop: 1,
                                            fontSize: 14,
                                            fontWeight: 800
                                        }}>
                                            {checked ? 'v' : ''}
                                        </div>
                                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1F2937', lineHeight: 1.35 }}>
                                            {item.label}
                                            <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#6B7280', fontWeight: 400 }}>
                                                {item.sublabel}
                                            </span>
                                        </p>
                                    </button>

                                    {index < CHECK_ITEMS.length - 1 && (
                                        <div style={{ height: 1, backgroundColor: '#F3F4F6', marginTop: 14, marginLeft: 36 }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: pilotMusicReady ? '#10B981' : '#6B7280',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8,
                    animation: pilotMusicReady ? 'none' : 'teacher-ready-pulse 1.8s ease-in-out infinite'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                        music_note
                    </span>
                    <span>{indicatorText}</span>
                </div>
            </main>

            <div style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 40,
                padding: '20px 24px calc(18px + env(safe-area-inset-bottom, 0px))',
                background: 'linear-gradient(180deg, rgba(243,244,246,0) 0%, rgba(243,244,246,0.96) 32%, rgba(243,244,246,1) 100%)'
            }}>
                <div style={{ maxWidth: 390, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        type="button"
                        onClick={handleConfirmReady}
                        disabled={ctaDisabled}
                        style={{
                            width: '100%',
                            border: 'none',
                            borderRadius: 18,
                            padding: '15px 16px',
                            backgroundColor: ctaDisabled ? '#9CA3AF' : '#2563EB',
                            color: '#FFFFFF',
                            fontSize: 16,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: ctaDisabled ? 'not-allowed' : 'pointer',
                            boxShadow: ctaDisabled ? 'none' : '0 14px 30px -14px rgba(37,99,235,0.5)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isConfirming ? <Loader2 size={18} className="animate-spin" /> : null}
                        {teacherReady
                            ? `A volar!${readyByName ? ` - ${readyByName}` : ''}`
                            : 'A volar!'}
                        <span style={{ transform: 'translateY(-0.5px)' }}>-&gt;</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#6B7280', opacity: 0.8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                        <span style={{ fontSize: 11 }}>No cierres la app (los datos se guardan)</span>
                    </div>

                    <div style={{ width: 128, height: 4, borderRadius: 999, backgroundColor: '#D1D5DB', margin: '2px auto 0' }} />
                </div>
            </div>

            <style>{`
                @keyframes teacher-ready-pulse {
                    0%, 100% { opacity: 0.75; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
