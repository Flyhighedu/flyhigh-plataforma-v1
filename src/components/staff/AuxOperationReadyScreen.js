'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { enqueueOptimisticUpload } from '@/utils/offlineSyncManager';
import { compressPhotoForUpload } from '@/utils/compressPhoto';

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
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

function isReadyToStartOperation(meta = {}) {
    return (
        meta.pilot_music_ambience_done === true &&
        meta.teacher_operation_ready === true &&
        meta.aux_operation_ready === true &&
        Boolean(meta.aux_operation_stand_photo_url)
    );
}

const AUX_OPERATION_READY_ILLUSTRATION_SVG = `
<svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tomar foto de evidencia del stand">
    <defs>
        <pattern id="dot-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="#cbd5e1" />
        </pattern>

        <filter id="shadow-floor" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="15" stdDeviation="15" flood-color="#0f172a" flood-opacity="0.1" />
        </filter>
        <filter id="shadow-phone" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="25" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.3" />
        </filter>
        <filter id="shadow-photo" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.2" />
        </filter>

        <clipPath id="screen-clip">
            <rect x="200" y="160" width="600" height="320" rx="16" />
        </clipPath>

        <g id="chair-with-vr">
            <ellipse cx="0" cy="25" rx="20" ry="8" fill="#0f172a" opacity="0.2" />

            <line x1="-15" y1="20" x2="15" y2="-10" stroke="#1e293b" stroke-width="4" stroke-linecap="round" />
            <line x1="15" y1="20" x2="-15" y2="-10" stroke="#1e293b" stroke-width="4" stroke-linecap="round" />
            <line x1="-20" y1="25" x2="20" y2="-5" stroke="#0f172a" stroke-width="4" stroke-linecap="round" />
            <line x1="20" y1="25" x2="-20" y2="-5" stroke="#0f172a" stroke-width="4" stroke-linecap="round" />

            <polygon points="-22,0 22,0 16,-12 -16,-12" fill="#1e293b" stroke="#334155" stroke-width="2" stroke-linejoin="round" />

            <polygon points="-16,-12 16,-12 18,-45 -18,-45" fill="#334155" />
            <polygon points="-18,-45 18,-45 20,-50 -20,-50" fill="#1e293b" />

            <g transform="translate(0, -6)">
                <ellipse cx="0" cy="5" rx="8" ry="3" fill="#020617" opacity="0.5" />
                <path d="M -10 0 C -10 -10, 10 -10, 10 0" fill="none" stroke="#1e293b" stroke-width="3" />
                <rect x="-8" y="-4" width="16" height="8" rx="4" fill="#ffffff" />
                <rect x="-6" y="-2" width="12" height="4" rx="2" fill="#0f172a" />
            </g>
        </g>

        <g id="stand-completo">
            <polygon points="100,600 900,600 750,220 250,220" fill="#e2e8f0" filter="url(#shadow-floor)" />
            <polygon points="105,595 895,595 745,225 255,225" fill="#f8fafc" />

            <line x1="500" y1="595" x2="500" y2="225" stroke="#cbd5e1" stroke-width="4" stroke-dasharray="15 15" />

            <g transform="translate(500, 220)">
                <rect x="-260" y="-120" width="520" height="120" rx="10" fill="#cbd5e1" />
                <rect x="-255" y="-125" width="510" height="120" rx="10" fill="#334155" />
                <rect x="-250" y="-120" width="500" height="120" rx="8" fill="#ffffff" />

                <circle cx="0" cy="-60" r="35" fill="#2563eb" />
                <path d="M -10 -70 L 10 -50 M -10 -50 L 10 -70" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
                <circle cx="0" cy="-60" r="10" fill="#ffffff" stroke="#2563eb" stroke-width="2" />
                <text x="50" y="-50" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="28" fill="#1e293b" letter-spacing="3">FLY HIGH</text>
            </g>

            <g transform="translate(250, 480)">
                <ellipse cx="0" cy="0" rx="90" ry="30" fill="#1e293b" stroke="#3b82f6" stroke-width="4" />
                <ellipse cx="0" cy="0" rx="70" ry="22" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="10 6" />
                <ellipse cx="0" cy="0" rx="50" ry="15" fill="#334155" />
                <path d="M -15 -5 L -15 5 M 15 -5 L 15 5 M -15 0 L 15 0" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
            </g>

            <use href="#chair-with-vr" transform="translate(350, 300) scale(0.65)" />
            <use href="#chair-with-vr" transform="translate(420, 300) scale(0.65)" />
            <use href="#chair-with-vr" transform="translate(580, 300) scale(0.65)" />
            <use href="#chair-with-vr" transform="translate(650, 300) scale(0.65)" />

            <use href="#chair-with-vr" transform="translate(320, 370) scale(0.8)" />
            <use href="#chair-with-vr" transform="translate(410, 370) scale(0.8)" />
            <use href="#chair-with-vr" transform="translate(590, 370) scale(0.8)" />
            <use href="#chair-with-vr" transform="translate(680, 370) scale(0.8)" />

            <use href="#chair-with-vr" transform="translate(280, 460)" />
            <use href="#chair-with-vr" transform="translate(400, 460)" />
            <use href="#chair-with-vr" transform="translate(600, 460)" />
            <use href="#chair-with-vr" transform="translate(720, 460)" />
        </g>
    </defs>

    <rect width="100%" height="100%" fill="url(#dot-grid)" />

    <use href="#stand-completo" />

    <g>
        <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.95; 0.98; 1" dur="11s" repeatCount="indefinite" />

        <g>
            <animateTransform attributeName="transform" type="translate"
                values="0,700; 0,0; 0,0; 0,700; 0,700"
                keyTimes="0; 0.15; 0.85; 0.95; 1"
                calcMode="spline" keySplines="0.2 0 0.2 1; 1 0 0 1; 0.8 0 0.8 1; 1 0 0 1"
                dur="11s" repeatCount="indefinite" />

            <rect x="180" y="140" width="640" height="360" rx="30" fill="#1e293b" filter="url(#shadow-phone)" />
            <rect x="190" y="150" width="620" height="340" rx="20" fill="#020617" />

            <g clip-path="url(#screen-clip)">
                <rect x="200" y="160" width="600" height="320" fill="#000000" />

                <g transform="translate(-100, -60) scale(1.2)">
                    <use href="#stand-completo" />
                </g>

                <rect x="200" y="160" width="600" height="320" fill="#000000" opacity="0.1" />

                <line x1="400" y1="160" x2="400" y2="480" stroke="#ffffff" stroke-width="1.5" opacity="0.4" />
                <line x1="600" y1="160" x2="600" y2="480" stroke="#ffffff" stroke-width="1.5" opacity="0.4" />
                <line x1="200" y1="266" x2="800" y2="266" stroke="#ffffff" stroke-width="1.5" opacity="0.4" />
                <line x1="200" y1="373" x2="800" y2="373" stroke="#ffffff" stroke-width="1.5" opacity="0.4" />

                <g stroke="#facc15" stroke-width="4" fill="none">
                    <path d="M 460 280 L 460 260 L 480 260" />
                    <path d="M 540 260 L 560 260 L 560 280" />
                    <path d="M 460 360 L 460 380 L 480 380" />
                    <path d="M 560 380 L 560 360 L 540 360" />

                    <animateTransform attributeName="transform" type="scale" values="1.2; 1; 1" keyTimes="0; 0.3; 1" dur="11s" repeatCount="indefinite" />
                    <animateTransform attributeName="transform" type="translate" additive="sum" values="-100,-60; 0,0; 0,0" keyTimes="0; 0.3; 1" dur="11s" repeatCount="indefinite" />
                </g>

                <rect x="700" y="160" width="100" height="320" fill="#000000" opacity="0.6" />

                <circle cx="750" cy="320" r="30" fill="none" stroke="#ffffff" stroke-width="4" />
                <circle cx="750" cy="320" r="24" fill="#ffffff">
                    <animateTransform attributeName="transform" type="scale" values="1; 1; 0.8; 1; 1" keyTimes="0; 0.40; 0.42; 0.45; 1" dur="11s" repeatCount="indefinite" />
                </circle>

                <rect x="200" y="160" width="600" height="320" fill="#ffffff" opacity="0">
                    <animate attributeName="opacity" values="0; 0; 1; 0; 0" keyTimes="0; 0.41; 0.42; 0.50; 1" dur="11s" repeatCount="indefinite" />
                </rect>
            </g>

            <rect x="175" y="270" width="15" height="100" rx="7.5" fill="#000000" />
            <circle cx="182" cy="320" r="4" fill="#1e293b" />

            <g transform="translate(130, 360)">
                <rect x="0" y="0" width="60" height="35" rx="17.5" fill="#fed7aa" />
                <rect x="-10" y="40" width="60" height="35" rx="17.5" fill="#fdba74" />
                <path d="M -80 0 L 0 0 L -20 120 L -80 120 Z" fill="#2563eb" />
            </g>

            <g transform="translate(790, 260)">
                <rect x="-25" y="20" width="35" height="80" rx="17.5" fill="#fed7aa" transform="rotate(-20 -10 60)" />
                <path d="M 40 -10 L 100 -10 L 100 130 L 40 130 Z" fill="#1e3a8a" />
            </g>

            <g transform="translate(500, 320)">
                <animateTransform attributeName="transform" type="translate"
                    values="500,320; 500,320; 500,280; 500,280"
                    keyTimes="0; 0.48; 0.52; 1" dur="11s" repeatCount="indefinite" />

                <animateTransform attributeName="transform" type="scale" additive="sum"
                    values="0; 0; 1; 1; 0"
                    keyTimes="0; 0.48; 0.52; 0.80; 0.85"
                    calcMode="spline" keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1; 0.4 0 1 1" dur="11s" repeatCount="indefinite" />

                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.48; 0.50; 0.80; 0.85" dur="11s" repeatCount="indefinite" />

                <rect x="-100" y="-80" width="200" height="160" rx="12" fill="#ffffff" filter="url(#shadow-photo)" />

                <rect x="-90" y="-70" width="180" height="100" rx="6" fill="#f1f5f9" />
                <circle cx="50" cy="-40" r="16" fill="#fbbf24" />
                <polygon points="-90,-10 -30,-50 30,-10" fill="#3b82f6" opacity="0.8" />
                <polygon points="0,-10 60,-60 90,-10" fill="#0ea5e9" opacity="0.8" />

                <circle cx="0" cy="45" r="25" fill="#10b981" />
                <path d="M -10 43 L -3 52 L 12 37" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
            </g>
        </g>
    </g>
</svg>
`;

export default function AuxOperationReadyScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const initialMeta = parseMeta(missionInfo?.meta);
    const [photoUrl, setPhotoUrl] = useState(() => safeText(initialMeta.aux_operation_stand_photo_url));
    const [auxReady, setAuxReady] = useState(initialMeta.aux_operation_ready === true);
    const [readyByName, setReadyByName] = useState(() => safeText(initialMeta.aux_operation_ready_by_name));
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [pilotMusicReady, setPilotMusicReady] = useState(initialMeta.pilot_music_ambience_done === true);
    const [teacherReady, setTeacherReady] = useState(initialMeta.teacher_operation_ready === true);
    const [bridgeTriggered, setBridgeTriggered] = useState(Boolean(initialMeta.operation_start_bridge_at));

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextPhotoUrl = safeText(meta.aux_operation_stand_photo_url);
        const nextReady = meta.aux_operation_ready === true;
        const nextReadyByName = safeText(meta.aux_operation_ready_by_name);

        setPhotoUrl((prev) => (prev === nextPhotoUrl ? prev : nextPhotoUrl));
        setAuxReady((prev) => (prev === nextReady ? prev : nextReady));
        setReadyByName((prev) => (prev === nextReadyByName ? prev : nextReadyByName));
        setPilotMusicReady(meta.pilot_music_ambience_done === true);
        setTeacherReady(meta.teacher_operation_ready === true);
        setBridgeTriggered(Boolean(meta.operation_start_bridge_at));
    }, [missionInfo?.meta, missionState]);

    // AUTO-TRANSITION: when operation_start_bridge_at appears, route to bridge
    useEffect(() => {
        if (bridgeTriggered && auxReady) {
            onRefresh && onRefresh();
        }
    }, [bridgeTriggered, auxReady, onRefresh]);

    const firstName = getFirstName(profile?.full_name, 'Auxiliar');
    const roleName = ROLE_LABELS[profile?.role] || 'Auxiliar';
    const isBusy = isUploadingPhoto || isConfirming;
    const hasPhoto = Boolean(photoUrl);
    const ctaDisabled = !hasPhoto || auxReady || isBusy;

    // BARRIER: Waiting room after CTA click
    const isWaitingForOthers = auxReady && !bridgeTriggered;
    const waitingNames = useMemo(() => {
        if (!isWaitingForOthers) return '';
        const missing = [];
        if (!pilotMusicReady) missing.push((missionInfo?.pilot_name || 'Piloto').split(' ')[0]);
        if (!teacherReady) missing.push((missionInfo?.teacher_name || 'Docente').split(' ')[0]);
        return missing.join(' y ');
    }, [isWaitingForOthers, pilotMusicReady, teacherReady, missionInfo?.pilot_name, missionInfo?.teacher_name]);
    const waitingChip = isWaitingForOthers && waitingNames ? `ESPERANDO A ${waitingNames.toUpperCase()}` : null;

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

    const handlePhotoSelected = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || !journeyId || isBusy || auxReady) return;

        setIsUploadingPhoto(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const ext = getFileExtension(file);
            const filePath = `${journeyId}/aux-operation-stand/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

            // INSTANT: Show local preview
            const localUrl = URL.createObjectURL(file);
            setPhotoUrl(localUrl);

            // INSTANT: Write meta to DB immediately (triggers Realtime)
            const currentMeta = await readCurrentMeta(supabase);
            const nextMeta = {
                ...currentMeta,
                aux_operation_stand_photo_url: 'uploading',
                aux_operation_stand_photo_at: now,
                aux_operation_stand_photo_by: userId,
                aux_operation_ready: false,
                aux_operation_ready_at: null,
                aux_operation_ready_by: null,
                aux_operation_ready_by_name: null
            };

            await writeMeta(supabase, nextMeta, now);
            onRefresh && onRefresh();

            // BACKGROUND: Queue heavy upload (fire-and-forget)
            const compressedFile = await compressPhotoForUpload(file);
            enqueueOptimisticUpload({
                file: compressedFile || file,
                storageBucket: 'staff-arrival',
                storagePath: filePath,
                dbMutation: {
                    table: 'staff_journeys',
                    matchColumn: 'id',
                    matchValue: journeyId,
                    data: {}
                },
                label: 'Foto stand operación'
            }).then(async () => {
                try {
                    const supabase2 = createClient();
                    const { data: publicData } = supabase2.storage
                        .from('staff-arrival')
                        .getPublicUrl(filePath);
                    const latestMeta = await readCurrentMeta(supabase2);
                    await writeMeta(supabase2, {
                        ...latestMeta,
                        aux_operation_stand_photo_url: publicData.publicUrl
                    }, new Date().toISOString());
                    setPhotoUrl(publicData.publicUrl);
                } catch (e) {
                    console.warn('[OptimisticUpload] stand photo meta patch failed:', e);
                }
            }).catch(e => console.warn('[OptimisticUpload] enqueue failed:', e));
        } catch (error) {
            console.error('Error uploading stand photo evidence:', error);
            alert('No se pudo guardar la foto del stand. Intenta de nuevo.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleConfirmReady = async () => {
        if (!journeyId || !userId || !hasPhoto || auxReady || isBusy) return;

        setIsConfirming(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.aux_operation_ready === true) {
                setAuxReady(true);
                setReadyByName(safeText(currentMeta.aux_operation_ready_by_name));
                onRefresh && onRefresh();
                return;
            }

            const latestPhotoUrl = safeText(currentMeta.aux_operation_stand_photo_url);
            if (!latestPhotoUrl) {
                alert('Toma la foto del stand antes de continuar.');
                return;
            }

            const actorName = getFirstName(profile?.full_name, 'Auxiliar');
            const nextMeta = {
                ...currentMeta,
                aux_operation_stand_photo_url: latestPhotoUrl,
                aux_operation_ready: true,
                aux_operation_ready_at: now,
                aux_operation_ready_by: userId,
                aux_operation_ready_by_name: actorName
            };

            if (!currentMeta.operation_start_bridge_at && isReadyToStartOperation(nextMeta)) {
                nextMeta.operation_start_bridge_at = now;
                nextMeta.operation_start_bridge_by = userId;
            }

            await writeMeta(supabase, nextMeta, now);

            setPhotoUrl(latestPhotoUrl);
            setAuxReady(true);
            setReadyByName(actorName);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error confirming assistant operation start readiness:', error);
            alert('No se pudo confirmar. Intenta de nuevo.');
        } finally {
            setIsConfirming(false);
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
                chipOverride={waitingChip}
                isWaitScreen={isWaitingForOthers}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 24px 150px',
                overflowY: 'auto'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: 520,
                    margin: '0 auto 14px',
                    borderRadius: 24,
                    overflow: 'hidden',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 14px 30px -18px rgba(15,23,42,0.28)'
                }}
                    dangerouslySetInnerHTML={{ __html: AUX_OPERATION_READY_ILLUSTRATION_SVG }}
                />

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0, marginBottom: 8, fontSize: 31, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
                        Todo listo para iniciar
                    </h2>
                    <p style={{ margin: 0, maxWidth: 320, fontSize: 14, color: '#6B7280', lineHeight: 1.5, marginInline: 'auto' }}>
                        Antes de iniciar, toma una foto del stand completo para confirmar que el montaje quedo perfecto.
                    </p>
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: 390,
                    margin: '0 auto 16px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    padding: 18,
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.03), 0 4px 6px -2px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                backgroundColor: '#EFF6FF',
                                color: '#2563EB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>camera_alt</span>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1F2937' }}>Evidencia de montaje</h3>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9CA3AF' }}>Requerido para continuar</p>
                            </div>
                        </div>

                        <div style={{
                            width: 74,
                            height: 62,
                            borderRadius: 10,
                            backgroundColor: '#F8FAFC',
                            border: '1px dashed #CBD5E1',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {hasPhoto ? (
                                <img
                                    alt="Vista previa del stand"
                                    src={photoUrl}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <span style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.1 }}>Vista previa</span>
                            )}
                        </div>
                    </div>

                    <label style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        borderRadius: 12,
                        border: '2px solid #2563EB',
                        color: '#2563EB',
                        fontWeight: 700,
                        fontSize: 14,
                        padding: '11px 12px',
                        backgroundColor: '#FFFFFF',
                        cursor: auxReady || isBusy ? 'not-allowed' : 'pointer',
                        opacity: auxReady ? 0.6 : 1,
                        transition: 'all 0.2s ease'
                    }}>
                        {isUploadingPhoto ? <Loader2 size={17} className="animate-spin" /> : <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>add_a_photo</span>}
                        <span>{isUploadingPhoto ? 'Guardando foto...' : 'Tomar foto del stand'}</span>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoSelected}
                            disabled={auxReady || isBusy}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>

                <div style={{
                    marginTop: 'auto',
                    marginBottom: 8,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 999,
                        backgroundColor: '#FEF3C7',
                        color: '#B45309'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
                            hourglass_empty
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {auxReady ? 'Listo para iniciar operacion.' : 'Esperando inicio de operacion...'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.78 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#9CA3AF', fontVariationSettings: "'FILL' 1" }}>
                        shield
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>No cierres la app (los datos se guardan localmente)</span>
                </div>
            </main>

            <div style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 40,
                padding: '16px 24px calc(18px + env(safe-area-inset-bottom, 0px))',
                background: 'linear-gradient(180deg, rgba(243,244,246,0) 0%, rgba(243,244,246,0.96) 30%, rgba(243,244,246,1) 100%)'
            }}>
                <div style={{ maxWidth: 390, margin: '0 auto' }}>
                    {isWaitingForOthers ? (
                        <div style={{
                            width: '100%',
                            backgroundColor: '#EFF6FF',
                            borderRadius: 16,
                            padding: '18px 20px',
                            border: '1px solid #BFDBFE',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                marginBottom: 8
                            }}>
                                <Loader2 size={18} className="animate-spin" style={{ color: '#2563EB' }} />
                                <span style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: '#1E3A8A'
                                }}>
                                    {waitingNames ? `Esperando a ${waitingNames}` : 'Esperando al equipo...'}
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>
                                Tu parte está lista. Avanzamos juntos cuando todos confirmen.
                            </p>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConfirmReady}
                            disabled={ctaDisabled}
                            style={{
                                width: '100%',
                                border: 'none',
                                borderRadius: 16,
                                backgroundColor: ctaDisabled ? '#E5E7EB' : '#2563EB',
                                color: ctaDisabled ? '#9CA3AF' : '#FFFFFF',
                                padding: '14px 16px',
                                fontSize: 16,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                cursor: ctaDisabled ? 'not-allowed' : 'pointer',
                                boxShadow: ctaDisabled ? 'none' : '0 12px 28px -12px rgba(37,99,235,0.5)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {isConfirming ? <Loader2 size={18} className="animate-spin" /> : null}
                            {auxReady ? `A volar!${readyByName ? ` - ${readyByName}` : ''}` : 'A volar! ->'}
                        </button>
                    )}

                    <div style={{ width: 128, height: 4, borderRadius: 999, backgroundColor: '#D1D5DB', margin: '12px auto 0' }} />
                </div>
            </div>
        </div>
    );
}
