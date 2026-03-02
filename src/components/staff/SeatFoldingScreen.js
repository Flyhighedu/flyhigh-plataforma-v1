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

function SeatFoldingIllustration() {
    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                maxWidth: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: '5%',
                    background: 'linear-gradient(135deg, #FFFFFF, #EFF6FF)',
                    borderRadius: '50%',
                    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
                }}
            />
            <svg
                style={{ position: 'relative', zIndex: 1, display: 'block', width: '100%', height: 'auto' }}
                viewBox="0 0 800 600"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <filter id="shadow-soft-fold" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="15" stdDeviation="15" floodColor="#0f172a" floodOpacity="0.15" />
                    </filter>
                    <filter id="shadow-ui-fold" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.1" />
                    </filter>
                    <pattern id="quilt-pattern-fold" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="16" height="16" fill="#18181b" />
                        <path d="M 0 0 L 0 16 M 0 0 L 16 0" fill="none" stroke="#27272a" strokeWidth="1.5" />
                    </pattern>
                    <pattern id="mesh-pattern-fold" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill="#000000" />
                        <path d="M 0 0 L 0 6 M 0 0 L 6 0" fill="none" stroke="#b45309" strokeWidth="1.5" />
                    </pattern>
                </defs>

                <g>
                    <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.85; 0.9; 1" dur="6s" repeatCount="indefinite" />

                    <ellipse cx="400" cy="520" fill="#0f172a" opacity="0.15">
                        <animate attributeName="rx" values="160; 160; 50; 50" keyTimes="0; 0.2; 0.25; 1" dur="6s" repeatCount="indefinite" />
                        <animate attributeName="ry" values="25; 25; 10; 10" keyTimes="0; 0.2; 0.25; 1" dur="6s" repeatCount="indefinite" />
                    </ellipse>

                    <g>
                        <animateTransform attributeName="transform" type="translate" values="0,30; 0,30; 0,10; 0,0" keyTimes="0; 0.15; 0.22; 1" dur="6s" repeatCount="indefinite" />
                        <animateTransform attributeName="transform" type="scale" additive="sum" values="0,0; 0.5,0; 1,0.95; 1,1" keyTimes="0; 0.15; 0.22; 1" dur="6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0; 0; 1; 1" keyTimes="0; 0.18; 0.22; 1" dur="6s" repeatCount="indefinite" />

                        <g transform="translate(400, 320)" filter="url(#shadow-soft-fold)">
                            <path d="M -35 -160 L 35 -160 C 45 -160 50 160 40 180 C 20 190 -20 190 -40 180 C -50 160 -45 -160 -35 -160 Z" fill="#09090b" />
                            <path d="M -20 -160 L 0 -160 C 10 -160 15 160 5 180 C -5 185 -15 185 -25 180 C -35 160 -30 -160 -20 -160 Z" fill="#18181b" />
                            <path d="M -35 -160 Q 0 -190 35 -160 Z" fill="#000000" />
                            <path d="M -15 -170 Q -25 -190 -30 -220 M 15 -170 Q 25 -190 30 -210" fill="none" stroke="#27272a" strokeWidth="3" strokeLinecap="round" />
                            <path d="M -42 -100 Q -90 -30 -45 50" fill="none" stroke="#000000" strokeWidth="8" strokeLinecap="round" />
                        </g>
                    </g>

                    <g opacity="0">
                        <animate attributeName="opacity" values="0; 0; 1; 0; 0" keyTimes="0; 0.2; 0.22; 0.3; 1" dur="6s" repeatCount="indefinite" />
                        <line x1="400" y1="350" x2="200" y2="150" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round">
                            <animate attributeName="strokeDasharray" values="0,200; 100,200; 0,200" keyTimes="0; 0.5; 1" dur="0.5s" repeatCount="indefinite" />
                        </line>
                        <line x1="400" y1="350" x2="600" y2="150" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round">
                            <animate attributeName="strokeDasharray" values="0,200; 100,200; 0,200" keyTimes="0; 0.5; 1" dur="0.5s" repeatCount="indefinite" />
                        </line>
                        <line x1="400" y1="350" x2="200" y2="500" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round">
                            <animate attributeName="strokeDasharray" values="0,200; 100,200; 0,200" keyTimes="0; 0.5; 1" dur="0.5s" repeatCount="indefinite" />
                        </line>
                        <line x1="400" y1="350" x2="600" y2="500" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round">
                            <animate attributeName="strokeDasharray" values="0,200; 100,200; 0,200" keyTimes="0; 0.5; 1" dur="0.5s" repeatCount="indefinite" />
                        </line>
                    </g>

                    <g>
                        <animateTransform attributeName="transform" type="translate" values="0,0; 0,0; 400,350; 400,350" keyTimes="0; 0.2; 0.26; 1" dur="6s" repeatCount="indefinite" />
                        <animateTransform attributeName="transform" type="scale" additive="sum" values="1; 1; 1.05; 0; 0" keyTimes="0; 0.2; 0.24; 0.28; 1" dur="6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1; 1; 1; 0; 0" keyTimes="0; 0.2; 0.22; 0.9; 1" dur="6s" repeatCount="indefinite" />

                        <g filter="url(#shadow-soft-fold)">
                            <g stroke="#09090b" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="280" y1="350" x2="220" y2="480" />
                                <line x1="520" y1="330" x2="480" y2="450" />
                                <line x1="280" y1="350" x2="200" y2="130" />
                                <line x1="520" y1="330" x2="580" y2="100" />
                            </g>

                            <g>
                                <path d="M 200 130 C 350 180 450 160 580 100 C 560 250 580 350 640 400 C 450 480 350 450 180 430 C 220 320 200 220 200 130 Z" fill="url(#quilt-pattern-fold)" stroke="#09090b" strokeWidth="6" strokeLinejoin="round" />
                                <path d="M 200 130 C 350 180 450 160 580 100 C 560 250 580 350 640 400 C 450 480 350 450 180 430 C 220 320 200 220 200 130 Z" fill="none" stroke="#27272a" strokeWidth="2" />
                                <path d="M 205 145 C 340 190 440 170 565 115 L 575 140 C 440 195 340 215 215 170 Z" fill="#18181b" stroke="#000000" strokeWidth="3" strokeLinejoin="round" />
                                <path d="M 205 145 C 340 190 440 170 565 115 L 575 140 C 440 195 340 215 215 170 Z" fill="url(#quilt-pattern-fold)" opacity="0.5" />
                            </g>

                            <g transform="translate(520, 360)">
                                <path d="M 0 0 C 30 20 80 10 100 0 L 90 70 C 60 90 20 80 0 60 Z" fill="#b45309" stroke="#78350f" strokeWidth="4" strokeLinejoin="round" />
                                <path d="M 0 0 C 30 20 80 10 100 0 L 90 70 C 60 90 20 80 0 60 Z" fill="url(#mesh-pattern-fold)" />
                                <path d="M 0 0 C 30 20 80 10 100 0" fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
                                <line x1="45" y1="15" x2="40" y2="75" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
                            </g>

                            <g stroke="#09090b" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="180" y1="430" x2="220" y2="520" />
                                <line x1="640" y1="400" x2="580" y2="490" />
                                <line x1="220" y1="520" x2="640" y2="400" />
                                <line x1="580" y1="490" x2="380" y2="460" />
                                <line x1="380" y1="460" x2="180" y2="430" />
                            </g>

                            <circle cx="410" cy="460" r="10" fill="#18181b" />

                            <path d="M 210 515 L 230 515 L 235 525 L 205 525 Z" fill="#000000" stroke="#18181b" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M 570 485 L 590 485 L 595 495 L 565 495 Z" fill="#000000" stroke="#18181b" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M 210 475 L 230 475 L 235 485 L 205 485 Z" fill="#000000" stroke="#18181b" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M 470 445 L 490 445 L 495 455 L 465 455 Z" fill="#000000" stroke="#18181b" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M 545 482 L 565 482 L 565 490 L 545 490 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" strokeLinejoin="round" />
                        </g>
                    </g>

                    <g transform="translate(400, 250)">
                        <animateTransform attributeName="transform" type="scale" values="1; 1; 1.2; 0; 0" keyTimes="0; 0.28; 0.32; 0.36; 1" dur="6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.28; 0.3; 0.9; 0.95" dur="6s" repeatCount="indefinite" />
                        <circle cx="0" cy="0" r="35" fill="#10b981" filter="url(#shadow-ui-fold)" />
                        <path d="M -15 -2 L -3 8 L 18 -12" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                </g>
            </svg>
        </div>
    );
}

export default function SeatFoldingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const role = useMemo(() => normalizeRole(profile?.role), [profile?.role]);
    const isAllowedRole = role === 'pilot' || role === 'teacher';

    const initialMeta = parseMeta(missionInfo?.meta);
    const [isSaving, setIsSaving] = useState(false);
    const [taskDone, setTaskDone] = useState(
        initialMeta.global_seats_folded === true || initialMeta.global_seat_folding_done === true
    );
    const [doneByName, setDoneByName] = useState(
        String(initialMeta.global_seats_folded_by_name || initialMeta.global_seat_folding_done_by_name || '')
    );
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextDone = meta.global_seats_folded === true || meta.global_seat_folding_done === true;
        const nextDoneByName = String(meta.global_seats_folded_by_name || meta.global_seat_folding_done_by_name || '');

        setTaskDone((prev) => (prev === nextDone ? prev : nextDone));
        setDoneByName((prev) => (prev === nextDoneByName ? prev : nextDoneByName));
    }, [missionInfo?.meta, missionState]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(''), 2600);
        return () => clearTimeout(timer);
    }, [feedback]);

    const firstNameLabel = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    const handleConfirmSeatFolding = async () => {
        if (taskDone || isSaving || !journeyId || !userId) return;

        if (!isAllowedRole) {
            setFeedback('Esta tarea global es operada por piloto y docente.');
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
            const latestDone = currentMeta.global_seats_folded === true || currentMeta.global_seat_folding_done === true;

            if (latestDone) {
                setTaskDone(true);
                setDoneByName(String(currentMeta.global_seats_folded_by_name || currentMeta.global_seat_folding_done_by_name || ''));
                onRefresh && onRefresh();
                return;
            }

            const nextMeta = {
                ...currentMeta,
                global_seats_folded: true,
                global_seats_folded_at: now,
                global_seats_folded_by: userId,
                global_seats_folded_by_name: firstNameLabel,
                global_seat_folding_done: true,
                global_seat_folding_done_at: now,
                global_seat_folding_done_by: userId,
                global_seat_folding_done_by_name: firstNameLabel,
                closure_phase: getClosurePhaseForStep(CLOSURE_STEPS.VEHICLE_POSITIONING)
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
            setFeedback('Pliegue global de asientos confirmado.');
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error confirming seat folding global task:', error);
            alert('No se pudo confirmar el pliegue global de asientos.');
        } finally {
            setIsSaving(false);
        }
    };

    const tips = [
        { icon: 'view_agenda', text: 'Plegar asientos por fila y asegurar cierre.' },
        { icon: 'layers', text: 'Dejar estaciones compactas para almacenaje.' },
        { icon: 'local_shipping', text: 'Liberar pasillo y zona para carga de equipo.' }
    ];

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
                    justifyContent: 'center',
                    padding: '8px 24px 0'
                }}
            >
                <div style={{ marginBottom: 10 }}>
                    <SeatFoldingIllustration />
                </div>

                <h2
                    style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#1F2937',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                        marginBottom: 6,
                        textAlign: 'center'
                    }}
                >
                    Pliegue de Asientos
                </h2>

                <p
                    style={{
                        fontSize: 13,
                        color: '#6B7280',
                        lineHeight: 1.4,
                        textAlign: 'center',
                        maxWidth: 320,
                        margin: '0 0 14px',
                        fontWeight: 400
                    }}
                >
                    Compacta y resguarda las estaciones para dejar lista la zona de carga.
                </p>

                {!isAllowedRole ? (
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 380,
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
                        Esta tarea la cierran en paralelo piloto y docente.
                    </div>
                ) : null}

                {feedback ? (
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 380,
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

                <div
                    style={{
                        width: '100%',
                        maxWidth: 380,
                        backgroundColor: 'white',
                        borderRadius: 14,
                        padding: '14px 16px',
                        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                        border: '1px solid #F3F4F6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                    }}
                >
                    {tips.map((tip) => (
                        <div key={tip.icon} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    backgroundColor: '#EFF6FF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                <span
                                    className="material-symbols-outlined"
                                    style={{
                                        fontSize: 13,
                                        color: '#2563EB',
                                        fontVariationSettings: "'FILL' 1, 'wght' 400"
                                    }}
                                >
                                    {tip.icon}
                                </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#1F2937' }}>{tip.text}</span>
                        </div>
                    ))}
                </div>
            </main>

            <div
                style={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    padding: '12px 24px 14px',
                    background: 'linear-gradient(to top, rgba(243,244,246,1) 60%, rgba(243,244,246,0.92) 80%, rgba(243,244,246,0) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)'
                }}
            >
                <div style={{ maxWidth: 380, margin: '0 auto' }}>
                    <button
                        onClick={handleConfirmSeatFolding}
                        disabled={taskDone || isSaving || !isAllowedRole}
                        className={getPrimaryCtaClasses(taskDone || isSaving || !isAllowedRole)}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
                        <span>
                            {taskDone
                                ? 'Pliegue confirmado'
                                : isAllowedRole
                                    ? 'Asientos plegados y resguardados'
                                    : 'Pendiente del equipo'}
                        </span>
                    </button>

                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                            {taskDone
                                ? `Global confirmado${doneByName ? ` · ${doneByName}` : ''}`
                                : isAllowedRole
                                    ? 'No cierres la app (los datos se guardan)'
                                    : 'Esperando cierre del piloto o docente'}
                        </span>
                    </div>

                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: '33%', maxWidth: 128, height: 4, backgroundColor: '#D1D5DB', borderRadius: 999 }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
