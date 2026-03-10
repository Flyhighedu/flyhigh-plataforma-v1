'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { enqueueOptimisticUpload } from '@/utils/offlineSyncManager';
import { compressPhotoForUpload } from '@/utils/compressPhoto';

/* ─── Animated Parking Scene Illustration ─── */
function ParkTruckIllustration() {
    return (
        <div style={{
            width: '100%', maxWidth: 352,
            backgroundColor: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 14px 24px -10px rgba(0,0,0,0.14)',
            overflow: 'hidden'
        }}>
            <svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: 'auto' }}>
                <defs>
                    <filter id="shadow-car" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.25" />
                    </filter>
                    <filter id="shadow-ui" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#64748b" floodOpacity="0.15" />
                    </filter>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <path id="ruta-estacionamiento" d="M 100 450 L 400 450 Q 500 450 500 350 L 500 175" />
                    <g id="auto-estatico">
                        <rect x="-70" y="-42" width="140" height="84" rx="25" fill="#0f172a" opacity="0.15" />
                        <rect x="-65" y="-37" width="130" height="74" rx="22" fill="#64748b" />
                        <rect x="-25" y="-32" width="85" height="64" rx="14" fill="#0f172a" />
                        <rect x="-20" y="-29" width="65" height="58" rx="10" fill="#475569" />
                        <rect x="20" y="-41" width="10" height="6" rx="3" fill="#64748b" />
                        <rect x="20" y="35" width="10" height="6" rx="3" fill="#64748b" />
                    </g>
                </defs>

                {/* Parking lot */}
                <rect x="50" y="50" width="900" height="500" rx="24" fill="#f8fafc" />
                <rect x="50" y="50" width="900" height="500" rx="24" fill="none" stroke="#e2e8f0" strokeWidth="4" />

                {/* Green target slot */}
                <rect x="400" y="50" width="200" height="250" fill="#dcfce7" fillOpacity="0.4" />

                {/* Parking lines */}
                <path d="M 200 50 L 200 300 M 400 50 L 400 300 M 600 50 L 600 300 M 800 50 L 800 300 M 200 50 L 800 50"
                    fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

                {/* P sign in target slot */}
                <circle cx="500" cy="175" r="40" fill="#22c55e" opacity="0.1" />
                <text x="500" y="190" fontFamily="sans-serif" fontWeight="bold" fontSize="40" fill="#22c55e" opacity="0.3" textAnchor="middle">P</text>

                {/* Static parked cars */}
                <g transform="translate(300, 175) rotate(-90)">
                    <use href="#auto-estatico" />
                </g>
                <g transform="translate(700, 175) rotate(-90)">
                    <use href="#auto-estatico" />
                </g>

                {/* ── Animated sequence ── */}
                <g>
                    <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.85; 0.9; 1" dur="6s" repeatCount="indefinite" />

                    {/* Route guide line */}
                    <path d="M 100 450 L 400 450 Q 500 450 500 350 L 500 175" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeDasharray="15 15" strokeLinecap="round" />
                    <path d="M 100 450 L 400 450 Q 500 450 500 350 L 500 175" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" filter="url(#glow)">
                        <animate attributeName="stroke-dashoffset" values="100; 100; 0; 0; 100" keyTimes="0; 0.05; 0.55; 0.95; 1" dur="6s" repeatCount="indefinite" />
                    </path>

                    {/* ── Moving hatchback ── */}
                    <g>
                        <animateMotion dur="6s" repeatCount="indefinite" keyTimes="0; 0.15; 0.6; 1" keyPoints="0; 0; 1; 1" calcMode="linear" rotate="auto">
                            <mpath href="#ruta-estacionamiento" />
                        </animateMotion>

                        <g filter="url(#shadow-car)">
                            {/* Body */}
                            <rect x="-65" y="-37" width="130" height="74" rx="22" fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />
                            {/* Windows */}
                            <rect x="-25" y="-32" width="85" height="64" rx="14" fill="#1e293b" />
                            {/* Roof */}
                            <rect x="-20" y="-29" width="65" height="58" rx="10" fill="#ffffff" />
                            {/* Sunroof */}
                            <rect x="-5" y="-20" width="35" height="40" rx="8" fill="#0f172a" opacity="0.9" />
                            {/* Mirrors */}
                            <rect x="25" y="-41" width="10" height="6" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                            <rect x="25" y="35" width="10" height="6" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                            {/* Headlights */}
                            <rect x="58" y="-32" width="6" height="12" rx="3" fill="#fef08a" />
                            <rect x="58" y="20" width="6" height="12" rx="3" fill="#fef08a" />
                            {/* Brake lights */}
                            <g>
                                <animate attributeName="opacity" values="0.3; 0.3; 1; 0.3; 0.3" keyTimes="0; 0.59; 0.6; 0.75; 1" dur="6s" repeatCount="indefinite" />
                                <rect x="-64" y="-33" width="6" height="16" rx="3" fill="#ef4444" />
                                <rect x="-64" y="17" width="6" height="16" rx="3" fill="#ef4444" />
                            </g>
                        </g>
                    </g>

                    {/* ── Success check badge ── */}
                    <g transform="translate(500, 175)">
                        <animateTransform attributeName="transform" type="scale"
                            values="0; 0; 1.1; 1; 1"
                            keyTimes="0; 0.63; 0.66; 0.7; 1" dur="6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.63; 0.65; 0.9; 0.95" dur="6s" repeatCount="indefinite" />
                        <circle cx="0" cy="0" r="35" fill="#10b981" filter="url(#shadow-ui)" />
                        <path d="M -15 -2 L -3 8 L 15 -10" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                </g>
            </svg>
        </div>
    );
}

export default function AuxParkingVehicleScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const initialMetaRef = useRef(parseMeta(missionInfo?.meta));
    const [photoPreview, setPhotoPreview] = useState(initialMetaRef.current?.aux_vehicle_evidence_url || null);
    const [photoConfirmed, setPhotoConfirmed] = useState(!!initialMetaRef.current?.aux_vehicle_evidence_url);
    const [auxReady, setAuxReady] = useState(initialMetaRef.current?.aux_ready_seat_deployment === true);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
    const [isSavingReady, setIsSavingReady] = useState(false);

    const fileInputRef = useRef(null);
    const localPreviewUrlRef = useRef(null);
    const ignoreIncomingEvidenceRef = useRef(false);

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const incomingPhotoUrl = meta?.aux_vehicle_evidence_url || null;

        if (ignoreIncomingEvidenceRef.current) {
            if (!incomingPhotoUrl) {
                ignoreIncomingEvidenceRef.current = false;
            }
        } else if (!isUploadingPhoto && !isRemovingPhoto && !photoPreview && incomingPhotoUrl) {
            setPhotoPreview(incomingPhotoUrl);
            setPhotoConfirmed(true);
        }

        if (!ignoreIncomingEvidenceRef.current && !isUploadingPhoto && !isRemovingPhoto && !incomingPhotoUrl && photoConfirmed) {
            setPhotoPreview(null);
            setPhotoConfirmed(false);
        }

        if (!auxReady && meta?.aux_ready_seat_deployment === true) {
            setAuxReady(true);
        }
    }, [missionInfo?.meta, photoPreview, photoConfirmed, auxReady, isUploadingPhoto, isRemovingPhoto]);

    useEffect(() => {
        return () => {
            if (localPreviewUrlRef.current) {
                URL.revokeObjectURL(localPreviewUrlRef.current);
                localPreviewUrlRef.current = null;
            }
        };
    }, []);

    const persistEvidenceUrl = async (supabase, evidenceUrl) => {
        const now = new Date().toISOString();
        const { data: currentData } = await supabase
            .from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single();

        const currentMeta = parseMeta(currentData?.meta);
        const nextMeta = {
            ...currentMeta,
            aux_vehicle_evidence_url: evidenceUrl,
            aux_vehicle_evidence_at: evidenceUrl ? now : null,
            aux_vehicle_evidence_by: evidenceUrl ? userId : null
        };

        const { error: updateError } = await supabase
            .from('staff_journeys')
            .update({
                meta: nextMeta,
                updated_at: now
            })
            .eq('id', journeyId);

        if (updateError) throw updateError;
        return now;
    };

    const handlePhotoSelect = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!journeyId || !userId || isUploadingPhoto || isRemovingPhoto || auxReady || isSavingReady) return;

        ignoreIncomingEvidenceRef.current = false;

        if (localPreviewUrlRef.current) {
            URL.revokeObjectURL(localPreviewUrlRef.current);
            localPreviewUrlRef.current = null;
        }

        const localUrl = URL.createObjectURL(file);
        localPreviewUrlRef.current = localUrl;
        setPhotoPreview(localUrl);
        setPhotoConfirmed(false);

        setIsUploadingPhoto(true);
        try {
            const supabase = createClient();
            const extension = file.name.split('.').pop();
            const fileName = `${journeyId}/aux-vehicle/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
            const now = new Date().toISOString();

            // INSTANT: Write meta to DB immediately (triggers Realtime for all roles)
            const { data: currentData } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            const currentMeta = parseMeta(currentData?.meta);
            const nextMeta = {
                ...currentMeta,
                aux_vehicle_evidence_url: 'uploading',
                aux_vehicle_evidence_at: now,
                aux_vehicle_evidence_by: userId
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({ meta: nextMeta, updated_at: now })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            // UI unlocks immediately
            setPhotoConfirmed(true);

            // BACKGROUND: Queue heavy upload (fire-and-forget)
            const compressedFile = await compressPhotoForUpload(file);
            enqueueOptimisticUpload({
                file: compressedFile || file,
                storageBucket: 'staff-arrival',
                storagePath: fileName,
                dbMutation: {
                    table: 'staff_journeys',
                    matchColumn: 'id',
                    matchValue: journeyId,
                    data: {} // URL will be patched via meta by the drain
                },
                label: 'Foto estacionamiento auxiliar'
            }).then(async () => {
                // After upload, patch the meta with the real URL
                try {
                    const supabase2 = createClient();
                    // The drain already uploaded the file, get the public URL
                    const { data: publicData } = supabase2.storage
                        .from('staff-arrival')
                        .getPublicUrl(fileName);
                    await persistEvidenceUrl(supabase2, publicData.publicUrl);
                } catch (e) {
                    console.warn('[OptimisticUpload] meta patch failed:', e);
                }
            }).catch(e => console.warn('[OptimisticUpload] enqueue failed:', e));
        } catch (error) {
            console.error('Error uploading parking evidence photo:', error);
            alert('No se pudo guardar la evidencia. Intenta de nuevo.');
            setPhotoPreview(null);
            setPhotoConfirmed(false);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleRemovePhoto = async (event) => {
        event?.stopPropagation?.();
        if (!journeyId || isUploadingPhoto || isRemovingPhoto || isSavingReady) return;
        if (!photoPreview) return;

        setIsRemovingPhoto(true);
        try {
            const supabase = createClient();
            await persistEvidenceUrl(supabase, null);
            ignoreIncomingEvidenceRef.current = true;
            setPhotoPreview(null);
            setPhotoConfirmed(false);
        } catch (error) {
            console.error('Error removing parking evidence photo:', error);
            alert('No se pudo eliminar la evidencia. Intenta de nuevo.');
            ignoreIncomingEvidenceRef.current = false;
        } finally {
            if (localPreviewUrlRef.current) {
                URL.revokeObjectURL(localPreviewUrlRef.current);
                localPreviewUrlRef.current = null;
            }
            setIsRemovingPhoto(false);
        }
    };

    const handleVehicleParked = async () => {
        if (!photoConfirmed || auxReady || isSavingReady || isUploadingPhoto || isRemovingPhoto) return;

        setIsSavingReady(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data: currentData } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            const currentMeta = parseMeta(currentData?.meta);

            const nextMeta = {
                ...currentMeta,
                aux_ready_seat_deployment: true,
                aux_ready_seat_deployment_at: now
            };

            const { error } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'seat_deployment',
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (error) throw error;

            setAuxReady(true);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error confirming parked vehicle:', error);
            alert('No se pudo confirmar el estacionamiento. Intenta de nuevo.');
            setIsSavingReady(false);
        }
    };

    const firstName = profile?.full_name?.split(' ')[0] || 'Auxiliar';
    const roleName = ROLE_LABELS[profile?.role] || 'Auxiliar';
    const chipText = auxReady ? 'En espera del docente' : 'Te esperan';
    const canInteractPhoto = !auxReady && !isUploadingPhoto && !isRemovingPhoto && !isSavingReady;
    const ctaDisabled = !photoConfirmed || auxReady || isSavingReady || isUploadingPhoto || isRemovingPhoto;

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
            {/* ─── Header (UNTOUCHED) ─── */}
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load"
                chipOverride={chipText}
                onDemoStart={onRefresh}
            />

            {/* ─── Main Content ─── */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', padding: '14px 18px 0',
                paddingBottom: 112,
                overflow: 'auto'
            }}>
                {/* Illustration */}
                <div style={{ marginBottom: 12 }}>
                    <ParkTruckIllustration />
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: 22, fontWeight: 700, color: '#1F2937',
                    letterSpacing: '-0.02em', lineHeight: 1.2,
                    marginBottom: 6, textAlign: 'center'
                }}>
                    Estaciona el vehículo
                </h2>

                {/* Description */}
                <p style={{
                    fontSize: 14, color: '#6B7280', lineHeight: 1.6,
                    textAlign: 'center', maxWidth: 340, margin: '0 0 2px',
                    fontWeight: 400
                }}>
                    Llévalo al estacionamiento final.
                </p>
                <p style={{
                    fontSize: 13, color: '#2563EB', lineHeight: 1.45,
                    textAlign: 'center', maxWidth: 340, margin: '0 0 14px',
                    fontWeight: 500
                }}>
                    Preferencia: dentro del plantel.
                </p>

                {/* Photo Evidence Card */}
                <div style={{
                    width: '100%', maxWidth: 360,
                    backgroundColor: 'white',
                    borderRadius: 18,
                    padding: 14,
                    boxShadow: '0 8px 20px -12px rgba(0,0,0,0.2)',
                    border: '1px solid #F3F4F6'
                }}>
                    {/* Photo preview / capture area */}
                    <div
                        onClick={() => {
                            if (!canInteractPhoto) return;
                            fileInputRef.current?.click();
                        }}
                        style={{
                            height: 128,
                            borderRadius: 12,
                            border: `2px dashed ${photoConfirmed ? '#86EFAC' : '#BFDBFE'}`,
                            backgroundColor: photoPreview ? 'transparent' : '#F8FAFC',
                            backgroundImage: photoPreview ? `url(${photoPreview})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: canInteractPhoto ? 'pointer' : 'default',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'border-color 0.2s, background-color 0.2s',
                            opacity: canInteractPhoto ? 1 : 0.95
                        }}
                    >
                        {!photoPreview && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    backgroundColor: '#EFF6FF', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 8px'
                                }}>
                                    <span className="material-symbols-outlined" style={{
                                        fontSize: 24, color: '#2563EB',
                                        fontVariationSettings: "'FILL' 0, 'wght' 400"
                                    }}>photo_camera</span>
                                </div>
                                <p style={{
                                    margin: 0, fontSize: 13, fontWeight: 600, color: '#2563EB'
                                }}>Tomar foto de evidencia</p>
                            </div>
                        )}

                        {photoPreview && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                backgroundColor: isUploadingPhoto ? 'rgba(15,23,42,0.48)' : 'rgba(15,23,42,0.35)',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'center', transition: 'opacity 0.2s'
                            }}>
                                <span style={{
                                    fontSize: 13, fontWeight: 700, color: 'white',
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    padding: '5px 12px', borderRadius: 8,
                                    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)'
                                }}>
                                    {isUploadingPhoto ? 'Subiendo evidencia...' : 'Cambiar foto'}
                                </span>
                            </div>
                        )}

                        {photoPreview && (
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                disabled={!canInteractPhoto}
                                aria-label="Eliminar foto de evidencia"
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    backgroundColor: 'rgba(15,23,42,0.62)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: canInteractPhoto ? 'pointer' : 'not-allowed',
                                    opacity: canInteractPhoto ? 1 : 0.6,
                                    zIndex: 3
                                }}
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        disabled={!canInteractPhoto}
                        style={{ display: 'none' }}
                    />

                    <div style={{
                        marginTop: 10,
                        padding: '8px 10px',
                        borderRadius: 10,
                        backgroundColor: photoConfirmed ? '#ECFDF5' : '#EFF6FF',
                        border: `1px solid ${photoConfirmed ? '#BBF7D0' : '#BFDBFE'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7
                    }}>
                        {(isUploadingPhoto || isRemovingPhoto) ? (
                            <Loader2 size={14} className="animate-spin" color={photoConfirmed ? '#16A34A' : '#2563EB'} />
                        ) : (
                            <CheckCircle2 size={14} color={photoConfirmed ? '#16A34A' : '#2563EB'} />
                        )}
                        <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: photoConfirmed ? '#166534' : '#1D4ED8'
                        }}>
                            {isUploadingPhoto
                                ? 'Guardando evidencia...'
                                : isRemovingPhoto
                                    ? 'Eliminando evidencia...'
                                    : photoConfirmed
                                        ? 'Evidencia guardada'
                                        : 'Toma una foto para continuar'}
                        </span>
                    </div>
                </div>
            </main>

            {/* ─── Sticky Bottom CTA ─── */}
            <div style={{
                position: 'sticky', bottom: 0, left: 0, right: 0,
                zIndex: 40,
                padding: '12px 18px 14px',
                background: 'linear-gradient(to top, rgba(243,244,246,1) 60%, rgba(243,244,246,0.92) 80%, rgba(243,244,246,0) 100%)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>
                <div style={{ maxWidth: 360, margin: '0 auto' }}>
                    <button
                        onClick={handleVehicleParked}
                        disabled={ctaDisabled}
                        style={{
                            width: '100%', padding: '14px',
                            backgroundColor: 'white', color: '#2563EB',
                            borderRadius: 14,
                            border: '1px solid #E5E7EB',
                            fontSize: 16, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 10,
                            cursor: ctaDisabled ? 'default' : 'pointer',
                            opacity: ctaDisabled ? 0.55 : 1,
                            boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
                            transition: 'opacity 0.2s, transform 0.15s',
                        }}
                    >
                        {isSavingReady ? <Loader2 className="animate-spin" size={18} /> : null}
                        <span>Vehículo estacionado</span>
                        {!isSavingReady && (
                            <span className="material-symbols-outlined" style={{
                                fontSize: 20, color: '#2563EB',
                                transition: 'transform 0.2s'
                            }}>arrow_forward</span>
                        )}
                    </button>

                    {/* Info line */}
                    <div style={{
                        marginTop: 8, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 6
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 14, color: '#9CA3AF',
                            fontVariationSettings: "'FILL' 1, 'wght' 400"
                        }}>verified_user</span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {auxReady ? 'Esperando confirmación de Dirección.' : 'No cierres la app (los datos se guardan)'}
                        </span>
                    </div>

                    {/* Bottom bar */}
                    <div style={{
                        marginTop: 10, display: 'flex', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '33%', maxWidth: 128, height: 4,
                            backgroundColor: '#D1D5DB', borderRadius: 999
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
