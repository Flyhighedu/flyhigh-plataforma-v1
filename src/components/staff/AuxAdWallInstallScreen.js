'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const MANUAL_CHECK_KEYS = ['deploy_structure', 'place_canvas'];

const MANUAL_CHECK_ITEMS = [
    {
        id: 'deploy_structure',
        label: 'Desplegar estructura del muro detras de la zona de asientos'
    },
    {
        id: 'place_canvas',
        label: 'Colocar lona correctamente'
    }
];

export const AD_WALL_INSTALL_ILLUSTRATION_SVG = `
<svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <pattern id="dot-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="#cbd5e1" />
        </pattern>

        <filter id="shadow-floor" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="25" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.15" />
        </filter>
        <filter id="shadow-ui" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.1" />
        </filter>
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#dot-grid)" />

    <g>
        <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.9; 0.95; 1" dur="10s" repeatCount="indefinite" />

        <polygon fill="#0f172a" opacity="0.1" filter="url(#shadow-floor)">
            <animate attributeName="points"
                values="230,560 250,550 310,520 290,530;
                        230,560 250,550 310,520 290,530;
                        230,560 250,550 650,350 630,360;
                        230,560 250,550 650,350 630,360"
                keyTimes="0; 0.15; 0.55; 1" dur="10s"
                calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1" repeatCount="indefinite" />
        </polygon>

        <ellipse cx="250" cy="550" rx="16" ry="8" fill="#475569" />
        <rect x="240" y="540" width="20" height="10" rx="2" fill="#334155" />

        <polygon points="230,560 250,550 250,300 230,310" fill="#1e293b" />

        <polygon fill="#334155">
            <animate attributeName="points"
                values="230,310 250,300 310,270 290,280;
                        230,310 250,300 310,270 290,280;
                        230,310 250,300 650,100 630,110;
                        230,310 250,300 650,100 630,110"
                keyTimes="0; 0.15; 0.55; 1" dur="10s"
                calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1" repeatCount="indefinite" />
        </polygon>

        <g transform="translate(250, 300) skewY(-26.565)">
            <g>
                <animateTransform attributeName="transform" type="scale"
                    values="0.15,1; 0.15,1; 1,1; 1,1"
                    keyTimes="0; 0.15; 0.55; 1" dur="10s"
                    calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1" repeatCount="indefinite" />

                <rect x="0" y="0" width="400" height="250" fill="#ffffff" />

                <circle cx="200" cy="85" r="50" fill="#2563eb" />
                <circle cx="200" cy="85" r="35" fill="#ffffff" opacity="0.2" />

                <g transform="translate(200, 85)">
                    <path d="M -16 -16 L 16 16 M -16 16 L 16 -16" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
                    <circle cx="-16" cy="-16" r="5" fill="#ffffff" />
                    <circle cx="16" cy="-16" r="5" fill="#ffffff" />
                    <circle cx="-16" cy="16" r="5" fill="#ffffff" />
                    <circle cx="16" cy="16" r="5" fill="#ffffff" />
                    <path d="M -26 -21 L -6 -21 M 6 -21 L 26 -21 M -26 11 L -6 11 M 6 11 L 26 11" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
                    <rect x="-10" y="-10" width="20" height="20" rx="6" fill="#ffffff" stroke="#2563eb" stroke-width="2" />
                    <circle cx="0" cy="3" r="3" fill="#2563eb" />
                </g>

                <text x="200" y="180" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="48" fill="#1e293b" text-anchor="middle" letter-spacing="4">FLY HIGH</text>

                <rect x="160" y="205" width="80" height="8" rx="4" fill="#3b82f6" />

                <rect x="0" y="0" width="400" height="250" fill="none" stroke="#e2e8f0" stroke-width="4" />

                <rect x="0" y="0" width="20" height="250" fill="#0f172a" opacity="0.1" />
            </g>
        </g>

        <g>
            <animateTransform attributeName="transform" type="translate"
                values="0,0; 0,0; 340,-170; 340,-170"
                keyTimes="0; 0.15; 0.55; 1" dur="10s"
                calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1" repeatCount="indefinite" />

            <polygon points="310,520 310,270 300,275 300,525" fill="#475569" />
            <line x1="310" y1="270" x2="310" y2="520" stroke="#1e293b" stroke-width="2" />

            <ellipse cx="310" cy="520" rx="16" ry="8" fill="#475569" />
            <rect x="300" y="510" width="20" height="10" rx="2" fill="#334155" />

            <g opacity="0">
                <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.12; 0.15; 1" dur="10s" repeatCount="indefinite" />

                <g>
                    <animateTransform attributeName="transform" type="translate" values="0,0; 20,-10; 0,0" dur="1s" repeatCount="indefinite" />
                    <line x1="330" y1="380" x2="380" y2="355" stroke="#3b82f6" stroke-width="6" stroke-linecap="round" />
                    <polygon points="385,352.5 370,345 375,360" fill="#3b82f6" />
                </g>
            </g>

            <g transform="translate(340, 460)">
                <ellipse cx="0" cy="50" rx="25" ry="12" fill="#0f172a" opacity="0.2" />

                <g>
                    <animateTransform attributeName="transform" type="translate"
                        values="0,0; 0,0; 0,-5; 0,0; 0,-5; 0,0; 0,0"
                        keyTimes="0; 0.15; 0.25; 0.35; 0.45; 0.55; 1" dur="10s" repeatCount="indefinite" />

                    <line x1="-10" y1="10" x2="-15" y2="45" stroke="#1e293b" stroke-width="12" stroke-linecap="round" />
                    <line x1="10" y1="10" x2="5" y2="50" stroke="#1e293b" stroke-width="12" stroke-linecap="round" />

                    <rect x="-18" y="-40" width="36" height="55" rx="14" fill="#2563eb" />

                    <circle cx="0" cy="-60" r="18" fill="#fed7aa" />
                    <path d="M -18 -62 A 18 18 0 0 1 18 -62 Z" fill="#1e3a8a" />
                    <line x1="-20" y1="-62" x2="5" y2="-62" stroke="#1e3a8a" stroke-width="5" stroke-linecap="round" />

                    <circle cx="-10" cy="-55" r="2.5" fill="#0f172a" />
                    <circle cx="2" cy="-55" r="2.5" fill="#0f172a" />

                    <path d="M -15 -30 C -25 -10 -40 -30 -30 -60" fill="none" stroke="#3b82f6" stroke-width="10" stroke-linecap="round" />
                    <circle cx="-30" cy="-60" r="6" fill="#fed7aa" />
                </g>
            </g>

        </g>

        <g transform="translate(450, 180)">
            <g>
                <animateTransform attributeName="transform" type="scale"
                    values="0; 0; 1.2; 1; 1; 0"
                    keyTimes="0; 0.58; 0.61; 0.64; 0.96; 1" dur="10s" repeatCount="indefinite" />

                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.58; 0.60; 0.95; 0.98" dur="10s" repeatCount="indefinite" />

                <circle cx="0" cy="0" r="40" fill="#10b981" filter="url(#shadow-ui)" />
                <circle cx="0" cy="0" r="32" fill="none" stroke="#34d399" stroke-width="2" />
                <path d="M -15 -2 L -3 10 L 18 -12" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />

                <rect x="-80" y="55" width="160" height="30" rx="15" fill="#ffffff" filter="url(#shadow-ui)" />
                <text x="0" y="75" font-family="sans-serif" font-weight="bold" font-size="14" fill="#10b981" text-anchor="middle" letter-spacing="1">MURO INSTALADO</text>
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

function normalizeChecks(rawChecks) {
    const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
        ? rawChecks
        : Object.create(null);

    return {
        deploy_structure: source.deploy_structure === true,
        place_canvas: source.place_canvas === true
    };
}

function checksAreEqual(left, right) {
    return MANUAL_CHECK_KEYS.every((key) => Boolean(left?.[key]) === Boolean(right?.[key]));
}

function getFirstName(fullName, fallback = 'Auxiliar') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

function getFileExtension(file) {
    const fromName = safeText(file?.name).split('.').pop();
    if (fromName) return fromName.toLowerCase();

    const mimeType = safeText(file?.type).toLowerCase();
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    return 'jpg';
}

function ChecklistCircle({ checked }) {
    return (
        <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: checked ? '2px solid #2563EB' : '2px solid #BFDBFE',
            backgroundColor: checked ? '#2563EB' : '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s ease'
        }}>
            <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: '#FFFFFF', opacity: checked ? 1 : 0, transition: 'opacity 0.2s ease' }}
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                />
            </svg>
        </div>
    );
}

export default function AuxAdWallInstallScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const initialMeta = parseMeta(missionInfo?.meta);
    const [checks, setChecks] = useState(() => normalizeChecks(initialMeta.aux_ad_wall_checks));
    const [evidenceUrl, setEvidenceUrl] = useState(() => safeText(initialMeta.aux_ad_wall_evidence_url));
    const [taskDone, setTaskDone] = useState(initialMeta.aux_ad_wall_done === true);
    const [doneByName, setDoneByName] = useState(() => safeText(initialMeta.aux_ad_wall_done_by_name));
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    const inputRef = useRef(null);

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextChecks = normalizeChecks(meta.aux_ad_wall_checks);
        const nextEvidenceUrl = safeText(meta.aux_ad_wall_evidence_url);
        const nextTaskDone = meta.aux_ad_wall_done === true;
        const nextDoneByName = safeText(meta.aux_ad_wall_done_by_name);

        setChecks((prev) => (checksAreEqual(prev, nextChecks) ? prev : nextChecks));
        setEvidenceUrl((prev) => (prev === nextEvidenceUrl ? prev : nextEvidenceUrl));
        setTaskDone((prev) => (prev === nextTaskDone ? prev : nextTaskDone));
        setDoneByName((prev) => (prev === nextDoneByName ? prev : nextDoneByName));
    }, [missionInfo?.meta, missionState]);

    const firstName = getFirstName(profile?.full_name, 'Auxiliar');
    const roleName = ROLE_LABELS[profile?.role] || 'Auxiliar';

    const evidenceDone = Boolean(evidenceUrl);
    const completedChecks = useMemo(() => {
        let done = 0;
        if (checks.deploy_structure) done += 1;
        if (checks.place_canvas) done += 1;
        if (evidenceDone) done += 1;
        return done;
    }, [checks.deploy_structure, checks.place_canvas, evidenceDone]);

    const isBusy = isSavingCheck || isUploadingPhoto || isFinalizing;
    const allChecksDone = completedChecks === 3;

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
        if (!journeyId || taskDone || isBusy) return;

        setIsSavingCheck(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.aux_ad_wall_done === true) {
                setTaskDone(true);
                setDoneByName(safeText(currentMeta.aux_ad_wall_done_by_name));
                return;
            }

            const nextChecks = normalizeChecks(currentMeta.aux_ad_wall_checks);
            nextChecks[checkId] = !nextChecks[checkId];

            const nextMeta = {
                ...currentMeta,
                aux_ad_wall_checks: nextChecks
            };

            await writeMeta(supabase, nextMeta, now);
            setChecks(nextChecks);
        } catch (error) {
            console.error('Error updating ad wall checklist:', error);
            alert('No se pudo guardar el checklist. Intenta de nuevo.');
        } finally {
            setIsSavingCheck(false);
        }
    };

    const handlePickPhoto = () => {
        if (taskDone || isBusy) return;
        inputRef.current?.click();
    };

    const handlePhotoSelected = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || !journeyId || isBusy) return;

        setIsUploadingPhoto(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const ext = getFileExtension(file);
            const filePath = `${journeyId}/aux-ad-wall/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('staff-arrival')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('staff-arrival')
                .getPublicUrl(filePath);

            const currentMeta = await readCurrentMeta(supabase);
            const nextMeta = {
                ...currentMeta,
                aux_ad_wall_evidence_url: publicData.publicUrl,
                aux_ad_wall_evidence_at: now,
                aux_ad_wall_evidence_by: userId
            };

            await writeMeta(supabase, nextMeta, now);

            setEvidenceUrl(publicData.publicUrl || '');
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error uploading ad wall evidence:', error);
            alert('No se pudo guardar la foto de evidencia. Intenta de nuevo.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleConfirmInstallation = async () => {
        if (!journeyId || !userId || taskDone || isBusy) return;

        setIsFinalizing(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.aux_ad_wall_done === true) {
                setTaskDone(true);
                setDoneByName(safeText(currentMeta.aux_ad_wall_done_by_name));
                onRefresh && onRefresh();
                return;
            }

            const latestChecks = normalizeChecks(currentMeta.aux_ad_wall_checks);
            const latestEvidenceUrl = safeText(currentMeta.aux_ad_wall_evidence_url);
            const latestAllDone = latestChecks.deploy_structure && latestChecks.place_canvas && Boolean(latestEvidenceUrl);

            if (!latestAllDone) {
                setChecks(latestChecks);
                setEvidenceUrl(latestEvidenceUrl);
                alert('Completa los 3 puntos para confirmar la instalacion.');
                return;
            }

            const actorName = getFirstName(profile?.full_name, 'Auxiliar');
            const nextMeta = {
                ...currentMeta,
                aux_ad_wall_checks: latestChecks,
                aux_ad_wall_done: true,
                aux_ad_wall_done_at: now,
                aux_ad_wall_done_by: userId,
                aux_ad_wall_done_by_name: actorName
            };

            await writeMeta(supabase, nextMeta, now);

            setChecks(latestChecks);
            setEvidenceUrl(latestEvidenceUrl);
            setTaskDone(true);
            setDoneByName(actorName);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error confirming ad wall installation:', error);
            alert('No se pudo confirmar la instalacion. Intenta de nuevo.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const cameraButtonLabel = isUploadingPhoto
        ? 'Guardando evidencia...'
        : evidenceDone
            ? 'Actualizar foto de evidencia'
            : 'Tomar foto de evidencia';

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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 24px 36px',
                overflowY: 'auto',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none'
            }}>
                <div
                    style={{
                        width: '100%',
                        maxWidth: 420,
                        margin: '14px 0 16px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 32,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
                        overflow: 'hidden'
                    }}
                    dangerouslySetInnerHTML={{ __html: AD_WALL_INSTALL_ILLUSTRATION_SVG }}
                />

                <div style={{ textAlign: 'center', marginBottom: 24, maxWidth: 340 }}>
                    <h2 style={{ margin: 0, marginBottom: 10, fontSize: 24, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        Instalar muro publicitario
                    </h2>
                    <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.45 }}>
                        Prepara el escenario colaborativo para una mejor experiencia visual.
                    </p>
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: 380,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    padding: 24,
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #F3F4F6',
                    marginBottom: 18
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {MANUAL_CHECK_ITEMS.map((item, index) => {
                            const checked = checks[item.id] === true;
                            const disabled = taskDone || isBusy;

                            return (
                                <div key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleCheck(item.id)}
                                        disabled={disabled}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 14,
                                            textAlign: 'left',
                                            padding: 0,
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            opacity: disabled ? 0.85 : 1
                                        }}
                                    >
                                        <ChecklistCircle checked={checked} />
                                        <span style={{
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: '#374151',
                                            lineHeight: 1.35,
                                            paddingTop: 2
                                        }}>
                                            {item.label}
                                        </span>
                                    </button>

                                    {index < MANUAL_CHECK_ITEMS.length - 1 && (
                                        <div style={{ height: 1, backgroundColor: '#F3F4F6', marginTop: 16 }} />
                                    )}
                                </div>
                            );
                        })}

                        <div style={{ height: 1, backgroundColor: '#F3F4F6' }} />

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <ChecklistCircle checked={evidenceDone} />
                            <span style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#374151',
                                lineHeight: 1.35,
                                paddingTop: 2
                            }}>
                                Tomar foto de evidencia
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handlePickPhoto}
                        disabled={taskDone || isBusy}
                        style={{
                            marginTop: 24,
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '12px 14px',
                            backgroundColor: '#EFF6FF',
                            color: '#2563EB',
                            borderRadius: 12,
                            border: '1px solid #DBEAFE',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: taskDone || isBusy ? 'not-allowed' : 'pointer',
                            opacity: taskDone ? 0.65 : 1,
                            transition: 'background-color 0.2s ease, opacity 0.2s ease'
                        }}
                    >
                        {isUploadingPhoto ? <Loader2 size={18} className="animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>photo_camera</span>}
                        {cameraButtonLabel}
                    </button>

                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelected}
                    style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9CA3AF', marginBottom: 18 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
                        verified_user
                    </span>
                    <span style={{ fontSize: 12 }}>No cierres la app (los datos se guardan)</span>
                </div>

                <button
                    type="button"
                    onClick={handleConfirmInstallation}
                    disabled={!allChecksDone || taskDone || isBusy}
                    style={{
                        width: '100%',
                        maxWidth: 380,
                        backgroundColor: (!allChecksDone || taskDone) ? '#E5E7EB' : '#2563EB',
                        color: (!allChecksDone || taskDone) ? '#9CA3AF' : '#FFFFFF',
                        fontWeight: 700,
                        fontSize: 16,
                        padding: '16px 18px',
                        borderRadius: 18,
                        border: 'none',
                        boxShadow: allChecksDone && !taskDone ? '0 12px 30px -10px rgba(37,99,235,0.45)' : 'none',
                        cursor: (!allChecksDone || taskDone || isBusy) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s ease'
                    }}
                >
                    {isFinalizing ? <Loader2 size={18} className="animate-spin" /> : null}
                    <span>
                        {taskDone
                            ? `Instalacion confirmada${doneByName ? ` - ${doneByName}` : ''}`
                            : 'Confirmar instalacion'}
                    </span>
                    {!taskDone && !isFinalizing && (
                        <span className="material-symbols-outlined" style={{ fontSize: 19, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                            arrow_forward
                        </span>
                    )}
                </button>

                <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
                        {taskDone ? 'Paso puente del auxiliar completado.' : `${completedChecks}/3 confirmaciones`}
                    </span>
                </div>

                <div style={{ marginTop: 12, width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 128, height: 4, borderRadius: 999, backgroundColor: '#D1D5DB' }} />
                </div>
            </main>
        </div>
    );
}
