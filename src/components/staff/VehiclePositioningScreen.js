'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { CLOSURE_STEPS, getClosurePhaseForStep } from '@/constants/closureFlow';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'assistant' || normalized === 'aux' || normalized === 'auxiliar') return 'assistant';
    if (normalized === 'teacher' || normalized === 'docente') return 'teacher';
    if (normalized === 'pilot') return 'pilot';
    return normalized;
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [head] = normalized.split(/\s+/);
    return head || fallback;
}

export function ParkTruckIllustration() {
    return (
        <div
            style={{
                width: '100%',
                maxWidth: 352,
                backgroundColor: '#ffffff',
                borderRadius: 20,
                boxShadow: '0 14px 24px -10px rgba(0,0,0,0.14)',
                overflow: 'hidden'
            }}
        >
            <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: 'auto' }}>
                <defs>
                    <filter id="shadow-car-dismantle" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.25" />
                    </filter>
                    <filter id="shadow-ui-dismantle" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#64748b" floodOpacity="0.15" />
                    </filter>
                    <filter id="glow-dismantle" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <path id="ruta-estacionamiento-dismantle" d="M 100 450 L 400 450 Q 500 450 500 350 L 500 175" />
                    <g id="auto-estatico-dismantle">
                        <rect x="-70" y="-42" width="140" height="84" rx="25" fill="#0f172a" opacity="0.15" />
                        <rect x="-65" y="-37" width="130" height="74" rx="22" fill="#64748b" />
                        <rect x="-25" y="-32" width="85" height="64" rx="14" fill="#0f172a" />
                        <rect x="-20" y="-29" width="65" height="58" rx="10" fill="#475569" />
                        <rect x="20" y="-41" width="10" height="6" rx="3" fill="#64748b" />
                        <rect x="20" y="35" width="10" height="6" rx="3" fill="#64748b" />
                    </g>
                </defs>

                <rect x="50" y="50" width="900" height="500" rx="24" fill="#f8fafc" />
                <rect x="50" y="50" width="900" height="500" rx="24" fill="none" stroke="#e2e8f0" strokeWidth="4" />

                <rect x="400" y="50" width="200" height="250" fill="#dcfce7" fillOpacity="0.4" />

                <path d="M 200 50 L 200 300 M 400 50 L 400 300 M 600 50 L 600 300 M 800 50 L 800 300 M 200 50 L 800 50" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

                <circle cx="500" cy="175" r="40" fill="#22c55e" opacity="0.1" />
                <text x="500" y="190" fontFamily="sans-serif" fontWeight="bold" fontSize="40" fill="#22c55e" opacity="0.3" textAnchor="middle">P</text>

                <g transform="translate(300, 175) rotate(-90)">
                    <use href="#auto-estatico-dismantle" />
                </g>
                <g transform="translate(700, 175) rotate(-90)">
                    <use href="#auto-estatico-dismantle" />
                </g>

                <g>
                    <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.85; 0.9; 1" dur="6s" repeatCount="indefinite" />

                    <path d="M 100 450 L 400 450 Q 500 450 500 350 L 500 175" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeDasharray="15 15" strokeLinecap="round" />
                    <path d="M 100 450 L 400 450 Q 500 450 500 350 L 500 175" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" filter="url(#glow-dismantle)">
                        <animate attributeName="stroke-dashoffset" values="100; 100; 0; 0; 100" keyTimes="0; 0.05; 0.55; 0.95; 1" dur="6s" repeatCount="indefinite" />
                    </path>

                    <g>
                        <animateMotion dur="6s" repeatCount="indefinite" keyTimes="0; 0.15; 0.6; 1" keyPoints="0; 0; 1; 1" calcMode="linear" rotate="auto">
                            <mpath href="#ruta-estacionamiento-dismantle" />
                        </animateMotion>

                        <g filter="url(#shadow-car-dismantle)">
                            <rect x="-65" y="-37" width="130" height="74" rx="22" fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />
                            <rect x="-25" y="-32" width="85" height="64" rx="14" fill="#1e293b" />
                            <rect x="-20" y="-29" width="65" height="58" rx="10" fill="#ffffff" />
                            <rect x="-5" y="-20" width="35" height="40" rx="8" fill="#0f172a" opacity="0.9" />
                            <rect x="25" y="-41" width="10" height="6" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                            <rect x="25" y="35" width="10" height="6" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                            <rect x="58" y="-32" width="6" height="12" rx="3" fill="#fef08a" />
                            <rect x="58" y="20" width="6" height="12" rx="3" fill="#fef08a" />
                            <g>
                                <animate attributeName="opacity" values="0.3; 0.3; 1; 0.3; 0.3" keyTimes="0; 0.59; 0.6; 0.75; 1" dur="6s" repeatCount="indefinite" />
                                <rect x="-64" y="-33" width="6" height="16" rx="3" fill="#ef4444" />
                                <rect x="-64" y="17" width="6" height="16" rx="3" fill="#ef4444" />
                            </g>
                        </g>
                    </g>

                    <g transform="translate(500, 175)">
                        <animateTransform attributeName="transform" type="scale" values="0; 0; 1.1; 1; 1" keyTimes="0; 0.63; 0.66; 0.7; 1" dur="6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.63; 0.65; 0.9; 0.95" dur="6s" repeatCount="indefinite" />
                        <circle cx="0" cy="0" r="35" fill="#10b981" filter="url(#shadow-ui-dismantle)" />
                        <path d="M -15 -2 L -3 8 L 15 -10" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                </g>
            </svg>
        </div>
    );
}

export default function VehiclePositioningScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const role = useMemo(() => normalizeRole(profile?.role), [profile?.role]);
    const isAllowedRole = role === 'assistant';

    const initialMeta = parseMeta(missionInfo?.meta);
    const [isSaving, setIsSaving] = useState(false);
    const [taskDone, setTaskDone] = useState(
        initialMeta.aux_vehicle_positioned === true || initialMeta.closure_vehicle_positioning_done === true
    );
    const [doneByName, setDoneByName] = useState(
        String(initialMeta.aux_vehicle_positioned_by_name || initialMeta.closure_vehicle_positioning_done_by_name || '')
    );
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextDone = meta.aux_vehicle_positioned === true || meta.closure_vehicle_positioning_done === true;
        const nextDoneBy = String(meta.aux_vehicle_positioned_by_name || meta.closure_vehicle_positioning_done_by_name || '');
        setTaskDone((prev) => (prev === nextDone ? prev : nextDone));
        setDoneByName((prev) => (prev === nextDoneBy ? prev : nextDoneBy));
    }, [missionInfo?.meta, missionState]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(''), 2600);
        return () => clearTimeout(timer);
    }, [feedback]);

    const firstNameLabel = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    const handleConfirmVehiclePositioning = async () => {
        if (taskDone || isSaving || !journeyId || !userId) return;

        if (!isAllowedRole) {
            setFeedback('Esta tarea corresponde al auxiliar.');
            return;
        }

        setIsSaving(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data, error: readError } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            const currentMeta = parseMeta(data?.meta);
            const latestDone = currentMeta.aux_vehicle_positioned === true || currentMeta.closure_vehicle_positioning_done === true;

            if (latestDone) {
                setTaskDone(true);
                setDoneByName(String(currentMeta.aux_vehicle_positioned_by_name || currentMeta.closure_vehicle_positioning_done_by_name || ''));
                onRefresh && onRefresh();
                return;
            }

            const nextMeta = {
                ...currentMeta,
                aux_vehicle_positioned: true,
                aux_vehicle_positioned_at: now,
                aux_vehicle_positioned_by: userId,
                aux_vehicle_positioned_by_name: firstNameLabel,
                closure_vehicle_positioning_done: true,
                closure_vehicle_positioning_done_at: now,
                closure_vehicle_positioning_done_by: userId,
                closure_vehicle_positioning_done_by_name: firstNameLabel,
                closure_phase: getClosurePhaseForStep(CLOSURE_STEPS.CONTAINER_LOADING)
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'dismantling',
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setTaskDone(true);
            setDoneByName(firstNameLabel);
            setFeedback('Vehículo acomodado en zona de carga.');
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error confirming vehicle positioning:', error);
            alert('No se pudo confirmar la posicion del vehiculo.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                backgroundColor: '#F3F4F6',
                color: '#1F2937',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                WebkitFontSmoothing: 'antialiased',
                position: 'relative'
            }}
        >
            <SyncHeader
                firstName={firstNameLabel}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                onDemoStart={onRefresh}
            />

            <main
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '14px 18px 0',
                    paddingBottom: 112,
                    overflow: 'auto'
                }}
            >
                <div style={{ marginBottom: 12 }}>
                    <ParkTruckIllustration />
                </div>

                <h2
                    style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#1F2937',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                        marginBottom: 6,
                        textAlign: 'center'
                    }}
                >
                    Acomodar el vehículo en la zona de carga
                </h2>

                <p
                    style={{
                        fontSize: 14,
                        color: '#6B7280',
                        lineHeight: 1.55,
                        textAlign: 'center',
                        maxWidth: 340,
                        margin: '0 0 14px',
                        fontWeight: 400
                    }}
                >
                    Alinea la unidad para dejar libre la maniobra de carga y salida.
                </p>

                {!isAllowedRole ? (
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 360,
                            borderRadius: 14,
                            border: '1px solid #BFDBFE',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            padding: '10px 12px',
                            marginBottom: 12,
                            fontSize: 12,
                            fontWeight: 650,
                            textAlign: 'center'
                        }}
                    >
                        Esta tarea la confirma el auxiliar.
                    </div>
                ) : null}

                {feedback ? (
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 360,
                            borderRadius: 14,
                            border: '1px solid #BBF7D0',
                            backgroundColor: '#ECFDF5',
                            color: '#166534',
                            padding: '10px 12px',
                            marginBottom: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: 'center'
                        }}
                    >
                        {feedback}
                    </div>
                ) : null}
            </main>

            <div
                style={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    padding: '12px 18px 14px',
                    background: 'linear-gradient(to top, rgba(243,244,246,1) 60%, rgba(243,244,246,0.92) 80%, rgba(243,244,246,0) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)'
                }}
            >
                <div style={{ maxWidth: 360, margin: '0 auto' }}>
                    <button
                        onClick={handleConfirmVehiclePositioning}
                        disabled={taskDone || isSaving || !isAllowedRole}
                        className={getPrimaryCtaClasses(taskDone || isSaving || !isAllowedRole)}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                        <span>{taskDone ? 'Vehículo en zona de carga' : 'Vehículo en zona de carga'}</span>
                    </button>

                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                            {taskDone
                                ? `Confirmado${doneByName ? ` · ${doneByName}` : ''}`
                                : isAllowedRole
                                    ? 'No cierres la app (los datos se guardan)'
                                    : 'Esperando al auxiliar'}
                        </span>
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '33%', maxWidth: 128, height: 4, backgroundColor: '#D1D5DB', borderRadius: 999 }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
