'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Camera, CheckCircle2, ChevronRight, Loader2, MapPin, Lock, Eye, Gamepad2, Map } from 'lucide-react';
import SyncHeader from './SyncHeader';
import { PILOT_READY_SOURCE, parseMeta } from '@/utils/metaHelpers';

function compressPhotoForUpload(file) {
    return new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result;

            img.onload = () => {
                const MAX_WIDTH = 1600;
                const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }

                    const baseName = (file.name || 'pilot-spot').replace(/\.[^/.]+$/, '');
                    resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.82);
            };

            img.onerror = () => resolve(file);
        };

        reader.onerror = () => resolve(file);
    });
}

const PREP_CHECKLIST = [
    { id: 'recon', iconKey: 'visibility', iconColor: '#F97316', title: 'Reconocimiento del entorno', desc: 'Cables, ramas, postes, zonas de riesgo y obstáculos visuales.' },
    { id: 'test_flight', iconKey: 'toys', iconColor: '#14B8A6', title: 'Vuelo de prueba', desc: 'Señal, estabilidad y altura segura antes de la misión.' },
    { id: 'route', iconKey: 'map', iconColor: '#8B5CF6', title: 'Ruta óptima', desc: 'Identifica dónde se pierde señal o visibilidad.' },
];

const PREP_ICONS = {
    visibility: (color) => <Eye size={18} color={color} />,
    toys: (color) => <Gamepad2 size={18} color={color} />,
    map: (color) => <Map size={18} color={color} />,
};

const AUDIO_CHECKLIST = [
    { id: 'music_emitter', label: 'Enciende la emisora de música' },
    { id: 'audio_player', label: 'Enciende el reproductor de audio' },
    { id: 'microphone', label: 'Enciende el micrófono' }
];

function normalizeChecks(value, total) {
    if (!Array.isArray(value)) {
        return Array.from({ length: total }, () => false);
    }

    return Array.from({ length: total }, (_, idx) => Boolean(value[idx]));
}

function checksAreEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }

    return a.every((item, idx) => Boolean(item) === Boolean(b[idx]));
}

function getPilotPrepTiming(meta = {}) {
    const spotAtMs = Date.parse(meta?.pilot_spot_set_at || '');
    const prepAtMs = Date.parse(meta?.pilot_prep_complete_at || '');
    const controllerAtMs = Date.parse(meta?.pilot_controller_connected_at || '');
    const audioAtMs = Date.parse(meta?.pilot_audio_configured_at || '');
    const spotConfirmed = Number.isFinite(spotAtMs);
    const checklistDoneForCurrentSpot =
        spotConfirmed &&
        Number.isFinite(prepAtMs) &&
        prepAtMs >= spotAtMs;

    const controllerConnectedForCurrentSpot =
        checklistDoneForCurrentSpot &&
        meta?.pilot_controller_connected === true &&
        (!Number.isFinite(controllerAtMs) || controllerAtMs >= prepAtMs);

    const audioConfiguredForCurrentSpot =
        controllerConnectedForCurrentSpot &&
        meta?.pilot_audio_configured === true &&
        (!Number.isFinite(audioAtMs) || audioAtMs >= (Number.isFinite(controllerAtMs) ? controllerAtMs : prepAtMs));

    return {
        spotConfirmed,
        checklistDoneForCurrentSpot,
        controllerConnectedForCurrentSpot,
        audioConfiguredForCurrentSpot
    };
}

export default function PilotPrepareFlightScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onPilotReadyForLoad,
    onRefresh
}) {
    const initialMetaRef = useRef(parseMeta(missionInfo?.meta));
    const mainRef = useRef(null);

    const [pilotPhase, setPilotPhase] = useState(() => {
        const m = initialMetaRef.current;
        const {
            spotConfirmed,
            checklistDoneForCurrentSpot,
            controllerConnectedForCurrentSpot,
            audioConfiguredForCurrentSpot
        } = getPilotPrepTiming(m);

        if (checklistDoneForCurrentSpot && !controllerConnectedForCurrentSpot) return 'connect';
        if (controllerConnectedForCurrentSpot && !audioConfiguredForCurrentSpot) return 'audio';
        if (spotConfirmed) return 'prepare';
        return 'identify';
    });
    const [spotPhoto, setSpotPhoto] = useState(null);
    const [photoUrl, setPhotoUrl] = useState(initialMetaRef.current?.pilot_spot_photo_url || null);
    const [spotNote, setSpotNote] = useState(initialMetaRef.current?.pilot_spot_note || '');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Checklist state — persisted in meta.pilot_prep_checks for real-time sync
    const initChecks = normalizeChecks(initialMetaRef.current?.pilot_prep_checks, PREP_CHECKLIST.length);
    const [prepChecks, setPrepChecks] = useState(initChecks);
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const checksCompleted = prepChecks.filter(Boolean).length;

    const initAudioChecks = normalizeChecks(initialMetaRef.current?.pilot_audio_checks, AUDIO_CHECKLIST.length);
    const [audioChecks, setAudioChecks] = useState(initAudioChecks);
    const [isSavingAudioCheck, setIsSavingAudioCheck] = useState(false);
    const audioChecksCompleted = audioChecks.filter(Boolean).length;

    const toggleCheck = async (idx) => {
        const next = [...prepChecks];
        next[idx] = !next[idx];
        setPrepChecks(next);
        setIsSavingCheck(true);
        try {
            const supabase = createClient();
            const { data: cur } = await supabase.from('staff_journeys').select('meta').eq('id', journeyId).single();
            const curMeta = parseMeta(cur?.meta);
            await supabase.from('staff_journeys').update({
                meta: { ...curMeta, pilot_prep_checks: next },
                updated_at: new Date().toISOString()
            }).eq('id', journeyId);
        } catch (e) {
            console.error('Error saving prep check:', e);
        } finally {
            setIsSavingCheck(false);
        }
    };

    const toggleAudioCheck = async (idx) => {
        const next = [...audioChecks];
        next[idx] = !next[idx];
        setAudioChecks(next);
        setIsSavingAudioCheck(true);
        try {
            const supabase = createClient();
            const { data: cur } = await supabase.from('staff_journeys').select('meta').eq('id', journeyId).single();
            const curMeta = parseMeta(cur?.meta);
            await supabase.from('staff_journeys').update({
                meta: { ...curMeta, pilot_audio_checks: next },
                updated_at: new Date().toISOString()
            }).eq('id', journeyId);
        } catch (e) {
            console.error('Error saving audio check:', e);
        } finally {
            setIsSavingAudioCheck(false);
        }
    };

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [pilotPhase]);

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const {
            spotConfirmed,
            checklistDoneForCurrentSpot,
            controllerConnectedForCurrentSpot,
            audioConfiguredForCurrentSpot
        } = getPilotPrepTiming(meta);

        let expectedPhase = 'identify';
        if (spotConfirmed) expectedPhase = 'prepare';
        if (checklistDoneForCurrentSpot && !controllerConnectedForCurrentSpot) expectedPhase = 'connect';
        if (controllerConnectedForCurrentSpot && !audioConfiguredForCurrentSpot) expectedPhase = 'audio';

        if (pilotPhase !== expectedPhase) {
            setPilotPhase(expectedPhase);
        }

        const nextPrepChecks = normalizeChecks(meta.pilot_prep_checks, PREP_CHECKLIST.length);
        if (!checksAreEqual(nextPrepChecks, prepChecks)) {
            setPrepChecks(nextPrepChecks);
        }

        const nextAudioChecks = normalizeChecks(meta.pilot_audio_checks, AUDIO_CHECKLIST.length);
        if (!checksAreEqual(nextAudioChecks, audioChecks)) {
            setAudioChecks(nextAudioChecks);
        }

        if (!photoUrl && meta.pilot_spot_photo_url) {
            setPhotoUrl(meta.pilot_spot_photo_url);
        }

        if (!spotNote && meta.pilot_spot_note) {
            setSpotNote(meta.pilot_spot_note);
        }
    }, [missionInfo?.meta, pilotPhase, prepChecks, audioChecks, photoUrl, spotNote]);

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSpotPhoto(file);
            setPhotoUrl(URL.createObjectURL(file));
        }
    };

    const getTeamAdvanceLabel = (state) => {
        if (state === 'waiting_dropzone') return 'Preparando descarga';
        if (state === 'unload') return 'Descarga';
        if (state === 'post_unload_coordination') return 'Logística final';
        if (state === 'seat_deployment') return 'Despliegue de asientos';
        if (state === 'OPERATION') return 'Operación';
        if (state === 'ARRIVAL_PHOTO_DONE') return 'Operación';
        return null;
    };

    const teamAdvanceLabel = pilotPhase === 'prepare' ? getTeamAdvanceLabel(missionState) : null;

    const handleConfirmRunway = async () => {
        if (isUploading) return;

        setIsUploading(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data: currentData } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            const currentMeta = parseMeta(currentData?.meta);
            let publicUrl = currentMeta.pilot_spot_photo_url || null;

            // Optional photo upload
            if (spotPhoto) {
                const normalizedPhoto = await compressPhotoForUpload(spotPhoto);
                const fileName = `${journeyId}/pilot-spot/${Date.now()}.jpg`;

                const { error: uploadError } = await supabase.storage
                    .from('staff-arrival') // Reusing existing bucket
                    .upload(fileName, normalizedPhoto || spotPhoto, {
                        upsert: true,
                        contentType: 'image/jpeg'
                    });

                if (uploadError) {
                    console.error('Error uploading pilot reference photo:', uploadError);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('staff-arrival')
                        .getPublicUrl(fileName);

                    publicUrl = urlData.publicUrl;
                }
            }

            const cleanedNote = (spotNote || '').trim();
            const resetPrepChecks = [false, false, false];
            const resetAudioChecks = [false, false, false];

            const newMeta = {
                ...currentMeta,
                pilot_spot_photo_url: publicUrl || currentMeta.pilot_spot_photo_url || null,
                pilot_spot_note: cleanedNote || currentMeta.pilot_spot_note || '',
                pilot_spot_set_at: now,
                pilot_prep_checks: resetPrepChecks,
                pilot_prep_complete_at: null,
                pilot_controller_connected: false,
                pilot_controller_connected_at: null,
                pilot_audio_checks: resetAudioChecks,
                pilot_audio_configured: false,
                pilot_audio_configured_at: null,
                pilot_ready: false,
                pilot_ready_at: null,
                pilot_ready_source: null
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    meta: newMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (updateError) throw updateError;

            setPrepChecks(resetPrepChecks);
            setAudioChecks(resetAudioChecks);
            setPilotPhase('prepare');
            setShowConfirmModal(false);

        } catch (e) {
            console.error('Error saving pilot reference:', e);
            alert('Error al confirmar pista. Intenta de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    // Transition to connect phase (after checklist 3/3)
    const handleChecklistDone = async () => {
        if (isUploading) return;
        setIsUploading(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const { data: cur } = await supabase.from('staff_journeys').select('meta').eq('id', journeyId).single();
            const curMeta = parseMeta(cur?.meta);
            await supabase.from('staff_journeys').update({
                meta: { ...curMeta, pilot_prep_complete_at: now },
                updated_at: now
            }).eq('id', journeyId);
            setPilotPhase('connect');
            onRefresh && onRefresh();
        } catch (e) {
            console.error('Error transitioning to connect phase:', e);
            alert('Error al avanzar. Intenta de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    // Connect step completed -> open audio setup phase
    const handleControllerConnected = async () => {
        if (isUploading) return;
        setIsUploading(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data: currentData } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            const currentMeta = parseMeta(currentData?.meta);
            const resetAudioChecks = [false, false, false];

            const nextMeta = {
                ...currentMeta,
                pilot_controller_connected: true,
                pilot_controller_connected_at: now,
                pilot_audio_checks: resetAudioChecks,
                pilot_audio_configured: false,
                pilot_audio_configured_at: null,
                pilot_ready: false,
                pilot_ready_at: null,
                pilot_ready_source: null
            };

            const { error } = await supabase
                .from('staff_journeys')
                .update({
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (error) throw error;

            setAudioChecks(resetAudioChecks);
            setPilotPhase('audio');
            onRefresh && onRefresh();
        } catch (e) {
            console.error('Error moving to audio setup:', e);
            alert('Error al avanzar. Intenta de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    // Final step: audio configured -> pilot ready for global flow
    const handleFinalizePreparation = async () => {
        if (isUploading || audioChecksCompleted < AUDIO_CHECKLIST.length) return;
        setIsUploading(true);
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
                pilot_audio_checks: normalizeChecks(audioChecks, AUDIO_CHECKLIST.length),
                pilot_audio_configured: true,
                pilot_audio_configured_at: now,
                pilot_ready: true,
                pilot_ready_at: now,
                pilot_ready_source: PILOT_READY_SOURCE
            };

            const preLoadStates = new Set([
                '',
                'prep',
                'PILOT_PREP',
                'AUX_PREP_DONE',
                'TEACHER_SUPPORTING_PILOT',
                'PILOT_READY_FOR_LOAD',
                'WAITING_AUX_VEHICLE_CHECK'
            ]);

            const normalizedMissionState = String(missionState || '').trim();
            const shouldMoveToLoad = preLoadStates.has(normalizedMissionState);
            const updatePayload = {
                meta: nextMeta,
                updated_at: now
            };

            if (shouldMoveToLoad) {
                updatePayload.mission_state = 'PILOT_READY_FOR_LOAD';
            }

            const { error } = await supabase
                .from('staff_journeys')
                .update(updatePayload)
                .eq('id', journeyId);

            if (error) throw error;

            if (shouldMoveToLoad && onPilotReadyForLoad) {
                onPilotReadyForLoad(nextMeta);
            }

            onRefresh && onRefresh();
        } catch (e) {
            console.error('Error in pilot finalization:', e);
            alert('Error al finalizar. Intenta de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: (pilotPhase === 'identify' || pilotPhase === 'prepare' || pilotPhase === 'connect' || pilotPhase === 'audio') ? '#F3F4F6' : 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)',
            color: (pilotPhase === 'identify' || pilotPhase === 'prepare' || pilotPhase === 'connect' || pilotPhase === 'audio') ? '#1F2937' : 'white',
            minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={profile?.full_name?.split(' ')[0]}
                roleName="Piloto"
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                onDemoStart={onRefresh}
            />

            <main
                ref={mainRef}
                style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column',
                    padding: pilotPhase === 'identify' ? '8px 24px 24px' : '24px',
                    overflowY: 'auto'
                }}>
                {pilotPhase === 'identify' ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        textAlign: 'center',
                        gap: 20,
                        paddingBottom: 8
                    }}>
                        {/* ── SVG Drone Pilot Illustration ── */}
                        <div style={{
                            width: '100%', maxWidth: 280,
                            position: 'relative'
                        }}>
                            {/* Soft glow */}
                            <div style={{
                                position: 'absolute', inset: 12,
                                background: 'linear-gradient(135deg, #DBEAFE 0%, #EEF2FF 100%)',
                                borderRadius: '50%', filter: 'blur(30px)', opacity: 0.6
                            }} />
                            <svg style={{ width: '100%', height: 'auto', position: 'relative', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.06))' }} fill="none" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="200" cy="150" r="130" fill="#EBF5FF" />
                                <ellipse cx="200" cy="240" rx="100" ry="15" fill="#CBD5E1" />
                                {/* Helipad */}
                                <circle cx="200" cy="240" r="40" fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" />
                                <text x="200" y="245" textAnchor="middle" fill="#64748B" fontFamily="Arial" fontSize="14" fontWeight="bold">H</text>
                                {/* Drone */}
                                <g transform="translate(240, 100)">
                                    <path d="M10 20 L50 20 M30 10 L30 30" stroke="#1E293B" strokeLinecap="round" strokeWidth="2" />
                                    <rect x="20" y="15" width="20" height="10" rx="2" fill="#3B82F6" />
                                    <circle cx="10" cy="20" r="8" fill="#CBD5E1" opacity="0.6" />
                                    <circle cx="50" cy="20" r="8" fill="#CBD5E1" opacity="0.6" />
                                    <circle cx="30" cy="10" r="8" fill="#CBD5E1" opacity="0.6" />
                                    <circle cx="30" cy="30" r="8" fill="#CBD5E1" opacity="0.6" />
                                    <animateTransform attributeName="transform" type="translate" values="240,100;240,95;240,100" dur="2s" repeatCount="indefinite" />
                                </g>
                                {/* Orange cones */}
                                <path d="M80 240 L95 210 L110 240 Z" fill="#F97316" />
                                <path d="M85 240 L105 240" stroke="#EA580C" strokeWidth="2" />
                                <path d="M300 230 L315 200 L330 230 Z" fill="#F97316" />
                                {/* Person */}
                                <g transform="translate(140, 80)">
                                    <path d="M45 160 L45 220" stroke="#1E293B" strokeLinecap="round" strokeWidth="14" />
                                    <path d="M75 160 L75 220" stroke="#1E293B" strokeLinecap="round" strokeWidth="14" />
                                    <path d="M35 220 H55" stroke="#0F172A" strokeLinecap="round" strokeWidth="8" />
                                    <path d="M65 220 H85" stroke="#0F172A" strokeLinecap="round" strokeWidth="8" />
                                    <path d="M30 100 C30 90 40 80 60 80 C80 80 90 90 90 100 V165 H30 V100 Z" fill="#2563EB" />
                                    <path d="M30 130 H90" stroke="#3B82F6" strokeWidth="6" />
                                    <path d="M30 105 L10 135" stroke="#2563EB" strokeLinecap="round" strokeWidth="10" />
                                    <path d="M90 105 L110 135" stroke="#2563EB" strokeLinecap="round" strokeWidth="10" />
                                    <rect x="5" y="130" width="30" height="20" rx="3" fill="#1E293B" transform="rotate(-15 20 140)" />
                                    <line x1="15" y1="130" x2="15" y2="120" stroke="#64748B" strokeWidth="2" transform="rotate(-15 20 140)" />
                                    <circle cx="60" cy="65" r="22" fill="#FFD7BA" />
                                    <path d="M38 55 C38 40 45 30 60 30 C75 30 82 40 82 55 C82 65 90 75 90 85 H30 C30 75 38 65 38 55 Z" fill="#4B5563" />
                                    <circle cx="35" cy="70" r="8" fill="#4B5563" />

                                </g>
                            </svg>
                        </div>

                        {/* ── Text block ── */}
                        <div style={{ maxWidth: 340 }}>
                            <h2 style={{
                                fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em',
                                lineHeight: 1.2, marginBottom: 6, color: '#1e293b'
                            }}>
                                Identifica la pista
                            </h2>
                            <p style={{
                                fontSize: 14, color: '#64748b',
                                lineHeight: 1.5, fontWeight: 400, margin: 0
                            }}>
                                Elige el punto más seguro y despejado para despegar.
                            </p>
                        </div>

                        {/* ── White checklist card ── */}
                        <div style={{
                            width: '100%', maxWidth: 340,
                            backgroundColor: 'white',
                            borderRadius: 16, padding: '14px 16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            border: '1px solid #e2e8f0',
                            display: 'flex', flexDirection: 'column', gap: 12
                        }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <CheckCircle2 size={18} color="#2563EB" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', lineHeight: 1.4, textAlign: 'left' }}>
                                    Lleva: maletín del dron + pista + conos.
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <CheckCircle2 size={18} color="#2563EB" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', lineHeight: 1.4, textAlign: 'left' }}>
                                    Delimita el área para evitar curiosos.
                                </span>
                            </div>
                        </div>

                        {/* ── Blue CTA button ── */}
                        <div style={{ width: '100%', maxWidth: 340 }}>
                            <button
                                onClick={() => setShowConfirmModal(true)}
                                style={{
                                    width: '100%', padding: '15px',
                                    backgroundColor: '#2563EB', color: 'white',
                                    borderRadius: 16, border: 'none',
                                    fontSize: 16, fontWeight: 700,
                                    boxShadow: '0 10px 25px -8px rgba(37, 99, 235, 0.4)',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                }}
                            >
                                Pista lista
                            </button>
                        </div>
                    </div>
                ) : pilotPhase === 'prepare' ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        paddingBottom: 100 /* space for fixed CTA */
                    }}>
                        {/* ── Drone SVG Illustration ── */}
                        <div style={{
                            width: '100%', maxWidth: 200,
                            alignSelf: 'center',
                            position: 'relative'
                        }}>
                            <svg style={{ width: '100%', height: 'auto' }} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <ellipse cx="100" cy="115" rx="50" ry="6" fill="#BFDBFE" fillOpacity="0.4" />
                                {/* Top-left propeller */}
                                <g opacity="0.8">
                                    <circle cx="50" cy="50" r="22" fill="#E0F2FE" />
                                    <circle cx="50" cy="50" r="8" fill="#BAE6FD" />
                                    <path d="M50 50L35 38M50 50L65 38M50 50L50 68" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
                                </g>
                                {/* Top-right propeller */}
                                <g opacity="0.8">
                                    <circle cx="150" cy="50" r="22" fill="#E0F2FE" />
                                    <circle cx="150" cy="50" r="8" fill="#BAE6FD" />
                                    <path d="M150 50L135 38M150 50L165 38M150 50L150 68" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
                                </g>
                                {/* Arms */}
                                <path d="M80 75L50 55" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" />
                                <path d="M120 75L150 55" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" />
                                {/* Body */}
                                <rect x="55" y="60" width="90" height="50" rx="20" fill="#EFF6FF" />
                                <rect x="60" y="65" width="80" height="40" rx="16" fill="#DBEAFE" />
                                {/* Camera lens */}
                                <circle cx="100" cy="85" r="14" fill="#3B82F6" />
                                <circle cx="100" cy="85" r="10" fill="#60A5FA" />
                                <circle cx="103" cy="82" r="3" fill="white" />
                                {/* Bottom-left leg */}
                                <g transform="translate(0, 10)">
                                    <path d="M70 90L40 100" stroke="#60A5FA" strokeWidth="6" strokeLinecap="round" />
                                    <circle cx="35" cy="100" r="24" fill="#DBEAFE" fillOpacity="0.6" />
                                    <circle cx="35" cy="100" r="6" fill="#93C5FD" />
                                    <path d="M35 100L20 90M35 100L50 90M35 100L35 115" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
                                </g>
                                {/* Bottom-right leg */}
                                <g transform="translate(0, 10)">
                                    <path d="M130 90L160 100" stroke="#60A5FA" strokeWidth="6" strokeLinecap="round" />
                                    <circle cx="165" cy="100" r="24" fill="#DBEAFE" fillOpacity="0.6" />
                                    <circle cx="165" cy="100" r="6" fill="#93C5FD" />
                                    <path d="M165 100L150 90M165 100L180 90M165 100L165 115" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
                                </g>
                                {/* Antenna */}
                                <path d="M100 60V55" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="100" cy="53" r="3" fill="#60A5FA" />
                            </svg>
                        </div>

                        {/* ── Title + Subtitle ── */}
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{
                                fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                                lineHeight: 1.2, marginBottom: 4, color: '#1F2937'
                            }}>
                                Montaje de vuelo
                            </h2>
                            <p style={{
                                fontSize: 14, color: '#6B7280',
                                lineHeight: 1.5, fontWeight: 400, margin: 0
                            }}>
                                Reconocimiento y ruta segura.
                            </p>
                        </div>

                        {teamAdvanceLabel && (
                            <div style={{
                                alignSelf: 'center',
                                padding: '6px 14px',
                                borderRadius: 999,
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #DBEAFE'
                            }}>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                                    El equipo avanzó a: {teamAdvanceLabel}
                                </p>
                            </div>
                        )}

                        {/* ── Progress bar ── */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12, padding: '0 4px'
                        }}>
                            <div style={{
                                flex: 1, height: 8, borderRadius: 4,
                                backgroundColor: '#E5E7EB',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%', borderRadius: 4,
                                    backgroundColor: checksCompleted === 3 ? '#22C55E' : '#2563EB',
                                    width: `${(checksCompleted / 3) * 100}%`,
                                    transition: 'width 0.3s ease, background-color 0.3s ease'
                                }} />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>
                                {checksCompleted}/3
                            </span>
                        </div>

                        {/* ── Checklist cards ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {PREP_CHECKLIST.map((item, idx) => {
                                const done = prepChecks[idx];
                                // Derive a soft tint from the icon color for the pill background
                                const tintMap = { '#F97316': '#FFF7ED', '#14B8A6': '#F0FDFA', '#8B5CF6': '#F5F3FF' };
                                const iconBg = tintMap[item.iconColor] || '#F3F4F6';
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleCheck(idx)}
                                        disabled={isSavingCheck}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            backgroundColor: done ? '#F0FDF4' : 'white',
                                            border: done ? '1.5px solid #86EFAC' : '1px solid #E5E7EB',
                                            borderRadius: 18, padding: '18px 16px',
                                            cursor: 'pointer', textAlign: 'left',
                                            transition: 'all 0.25s ease', width: '100%',
                                            WebkitTapHighlightColor: 'transparent',
                                            boxShadow: done
                                                ? '0 2px 8px rgba(34,197,94,0.10)'
                                                : '0 2px 8px rgba(0,0,0,0.06)',
                                            position: 'relative', overflow: 'hidden'
                                        }}
                                    >
                                        {/* Check circle */}
                                        <div style={{
                                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                            border: done ? 'none' : '2px solid #CBD5E1',
                                            backgroundColor: done ? '#22C55E' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.25s ease',
                                            boxShadow: done ? '0 2px 6px rgba(34,197,94,0.3)' : 'none'
                                        }}>
                                            {done && (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        {/* Icon + text */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                {/* Icon pill */}
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                                    backgroundColor: done ? '#DCFCE7' : iconBg,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'background-color 0.2s ease'
                                                }}>
                                                    {PREP_ICONS[item.iconKey] && PREP_ICONS[item.iconKey](done ? '#16A34A' : item.iconColor)}
                                                </div>
                                                <span style={{
                                                    fontSize: 15, fontWeight: 700, lineHeight: 1.3,
                                                    color: done ? '#16A34A' : '#111827',
                                                    textDecoration: done ? 'line-through' : 'none',
                                                    opacity: done ? 0.8 : 1,
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                    {item.title}
                                                </span>
                                            </div>
                                            <p style={{
                                                fontSize: 13, color: done ? '#6B7280' : '#6B7280',
                                                lineHeight: 1.5, margin: 0,
                                                paddingLeft: 36,
                                                opacity: done ? 0.5 : 0.85,
                                                transition: 'opacity 0.2s ease'
                                            }}>
                                                {item.desc}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Footer microcopy ── */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, padding: '4px 0'
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <span style={{ fontSize: 12, fontWeight: 500, color: '#9CA3AF' }}>
                                No cierres la app (los datos se guardan)
                            </span>
                        </div>
                    </div>
                ) : null}

                {/* ═══ PHASE 3: CONNECT CONTROLLER ═══ */}
                {pilotPhase === 'connect' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        paddingBottom: 100
                    }}>
                        {/* ── Animated Illustration ── */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
                            <svg viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 280 }}>
                                <defs>
                                    <filter id="connect-shadow" x="-5%" y="-5%" width="110%" height="110%">
                                        <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#cbd5e1" floodOpacity="0.5" />
                                    </filter>
                                    <path id="ruta-cable" d="M 180 210 C 230 210, 240 260, 316 260" />
                                </defs>

                                {/* Circle background */}
                                <circle cx="250" cy="200" r="180" fill="#f0f5ff" filter="url(#connect-shadow)" />

                                {/* Animated controller cable */}
                                <g>
                                    <path d="M 180 210 C 230 210, 240 260, 316 260"
                                        fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"
                                        pathLength="100" strokeDasharray="100" strokeDashoffset="100">
                                        <animate attributeName="stroke-dashoffset"
                                            values="100; 100; 0; 0; 100"
                                            keyTimes="0; 0.1; 0.4; 0.8; 1"
                                            dur="4s" repeatCount="indefinite" />
                                    </path>
                                    <g>
                                        <rect x="-14" y="-7" width="14" height="14" rx="2" fill="#374151" />
                                        <rect x="0" y="-4" width="6" height="8" rx="1" fill="#9ca3af" />
                                        <animateMotion dur="4s" repeatCount="indefinite" rotate="auto"
                                            keyPoints="0; 0; 1; 1; 0"
                                            keyTimes="0; 0.1; 0.4; 0.8; 1"
                                            calcMode="linear">
                                            <mpath href="#ruta-cable" />
                                        </animateMotion>
                                    </g>
                                </g>

                                {/* Animated power cable */}
                                <g>
                                    <path d="M 410 280 C 440 280, 450 320, 480 320"
                                        fill="none" stroke="#374151" strokeWidth="6" strokeLinecap="round"
                                        pathLength="100" strokeDasharray="100" strokeDashoffset="100">
                                        <animate attributeName="stroke-dashoffset"
                                            values="100; 100; 0; 0; 100"
                                            keyTimes="0; 0.45; 0.6; 0.8; 1"
                                            dur="4s" repeatCount="indefinite" />
                                    </path>
                                    <g opacity="0">
                                        <animate attributeName="opacity"
                                            values="0; 0; 1; 1; 0"
                                            keyTimes="0; 0.58; 0.6; 0.8; 1"
                                            dur="4s" repeatCount="indefinite" />
                                        <rect x="480" y="310" width="12" height="20" rx="2" fill="#1f2937" />
                                        <rect x="492" y="314" width="6" height="4" rx="1" fill="#9ca3af" />
                                        <rect x="492" y="322" width="6" height="4" rx="1" fill="#9ca3af" />
                                    </g>
                                </g>

                                {/* Controller */}
                                <g transform="translate(70, 175)">
                                    <rect x="15" y="-8" width="25" height="15" rx="4" fill="#1f2937" />
                                    <rect x="70" y="-8" width="25" height="15" rx="4" fill="#1f2937" />
                                    <rect x="0" y="0" width="110" height="70" rx="35" fill="#4b5563" />
                                    <rect x="24" y="20" width="8" height="24" rx="1" fill="#1f2937" />
                                    <rect x="16" y="28" width="24" height="8" rx="1" fill="#1f2937" />
                                    <circle cx="85" cy="24" r="4.5" fill="#60a5fa" />
                                    <circle cx="95" cy="34" r="4.5" fill="#f87171" />
                                    <circle cx="75" cy="34" r="4.5" fill="#fbbf24" />
                                    <circle cx="85" cy="44" r="4.5" fill="#34d399" />
                                    <circle cx="40" cy="50" r="9" fill="#374151" />
                                    <circle cx="40" cy="50" r="5" fill="#1f2937" />
                                    <circle cx="70" cy="50" r="9" fill="#374151" />
                                    <circle cx="70" cy="50" r="5" fill="#1f2937" />
                                    <circle cx="55" cy="25" r="3" fill="#9ca3af">
                                        <animate attributeName="fill"
                                            values="#9ca3af; #9ca3af; #10b981; #10b981; #9ca3af"
                                            keyTimes="0; 0.4; 0.45; 0.8; 1"
                                            dur="4s" repeatCount="indefinite" />
                                    </circle>
                                </g>

                                {/* Cabinet */}
                                <g transform="translate(320, 90)">
                                    <rect x="0" y="0" width="90" height="220" rx="6" fill="#3b82f6" />
                                    <rect x="10" y="50" width="70" height="160" rx="4" fill="#2563eb" />
                                    <rect x="10" y="15" width="70" height="12" rx="2" fill="#60a5fa" />
                                    <rect x="10" y="32" width="70" height="4" rx="1" fill="#60a5fa" opacity="0.5" />
                                    <rect x="-4" y="160" width="8" height="20" rx="2" fill="#1e293b" />
                                    <rect x="-2" y="164" width="4" height="12" fill="#0f172a" />
                                    <circle cx="45" cy="130" r="4.5" fill="#9ca3af">
                                        <animate attributeName="fill"
                                            values="#9ca3af; #9ca3af; #10b981; #10b981; #9ca3af"
                                            keyTimes="0; 0.4; 0.45; 0.8; 1"
                                            dur="4s" repeatCount="indefinite" />
                                    </circle>
                                </g>
                            </svg>
                        </div>

                        {/* ── Title + Subtitle ── */}
                        <div style={{ textAlign: 'center', padding: '10px 28px 14px' }}>
                            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', marginBottom: 8 }}>
                                Conecta el mando y enciende gabinete
                            </h2>
                            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                                Conecta el control remoto al gabinete para que quede listo para operar.
                            </p>
                        </div>

                        {/* ── Green badge ── */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0',
                                borderRadius: 999, padding: '8px 16px'
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>Checklist de vuelo completado</span>
                            </div>
                        </div>



                        {/* ── Footer microcopy ── */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, padding: '16px 0 0', opacity: 0.5
                        }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>
                                No cierres la app (los datos se guardan)
                            </span>
                        </div>
                    </div>
                )}

                {pilotPhase === 'audio' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingBottom: 120
                    }}>
                        <div style={{
                            width: '100%',
                            maxWidth: 420,
                            marginBottom: 12
                        }}>
                            <svg viewBox="0 0 1000 450" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', display: 'block' }}>
                                <defs>
                                    <filter id="audio-shadow-device" x="-20%" y="-20%" width="140%" height="150%">
                                        <feDropShadow dx="0" dy="15" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.15" />
                                    </filter>
                                    <filter id="audio-shadow-ui" x="-20%" y="-20%" width="140%" height="140%">
                                        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.1" />
                                    </filter>
                                    <filter id="audio-glow-green" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <filter id="audio-glow-blue" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="4" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <path id="audio-nota-musical" d="M 15 0 L 15 20 C 15 25 10 30 5 30 C 0 30 -5 25 -5 20 C -5 15 0 10 5 10 C 8 10 10 11 12 13 L 12 5 L 25 2 L 25 10 L 15 12 Z" fill="#3b82f6" />
                                </defs>

                                <g>
                                    <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.9; 0.95; 1" dur="8s" repeatCount="indefinite" />

                                    <line x1="100" y1="350" x2="900" y2="350" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />

                                    <path d="M 220 340 L 500 340 L 780 340" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
                                    <path d="M 220 340 L 500 340 L 780 340" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" filter="url(#audio-glow-green)">
                                        <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.8; 0.82; 0.95; 1" dur="8s" repeatCount="indefinite" />
                                    </path>

                                    <g id="emisora" transform="translate(220, 270)">
                                        <rect x="-60" y="-80" width="120" height="150" rx="16" fill="#0f172a" opacity="0.1" filter="url(#audio-shadow-device)" />
                                        <line x1="-30" y1="-80" x2="-40" y2="-130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                                        <circle cx="-40" cy="-130" r="5" fill="#475569" />
                                        <line x1="30" y1="-80" x2="40" y2="-130" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                                        <circle cx="40" cy="-130" r="5" fill="#475569" />

                                        <rect x="-60" y="-80" width="120" height="150" rx="16" fill="#1e293b" />
                                        <rect x="-50" y="-70" width="100" height="100" rx="12" fill="#0f172a" />
                                        <rect x="-30" y="40" width="60" height="10" rx="4" fill="#334155" />
                                        <rect x="-30" y="55" width="60" height="10" rx="4" fill="#334155" />

                                        <circle cx="0" cy="-20" r="30" fill="none" stroke="#334155" strokeWidth="8" />

                                        <circle cx="0" cy="-20" r="30" fill="none" stroke="#10b981" strokeWidth="8" filter="url(#audio-glow-green)">
                                            <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.14; 0.15; 0.95; 1" dur="8s" repeatCount="indefinite" />
                                        </circle>

                                        <circle cx="0" cy="-20" r="8" fill="#ffffff" />

                                        <g>
                                            <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.14; 0.15; 0.95; 1" dur="8s" repeatCount="indefinite" />
                                            <g stroke="#3b82f6" strokeWidth="4" fill="none" strokeLinecap="round" filter="url(#audio-glow-blue)">
                                                <path d="M -20 -40 A 25 25 0 0 1 20 -40">
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="1.5s" repeatCount="indefinite" />
                                                </path>
                                                <path d="M -30 -50 A 40 40 0 0 1 30 -50">
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
                                                </path>
                                                <path d="M -40 -60 A 55 55 0 0 1 40 -60">
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="1.5s" begin="1s" repeatCount="indefinite" />
                                                </path>
                                            </g>
                                        </g>
                                    </g>

                                    <g id="reproductor" transform="translate(500, 270)">
                                        <rect x="-100" y="-60" width="200" height="130" rx="20" fill="#0f172a" opacity="0.1" filter="url(#audio-shadow-device)" />

                                        <rect x="-100" y="-60" width="200" height="130" rx="20" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="4" />

                                        <rect x="-80" y="-40" width="160" height="60" rx="12" fill="#0f172a" />

                                        <circle cx="0" cy="40" r="20" fill="#e2e8f0" />

                                        <g>
                                            <circle cx="0" cy="40" r="20" fill="#10b981" filter="url(#audio-glow-green)">
                                                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.43; 0.44; 0.95; 1" dur="8s" repeatCount="indefinite" />
                                            </circle>
                                            <polygon points="-5,30 10,40 -5,50" fill="#ffffff" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
                                        </g>

                                        <g>
                                            <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.43; 0.44; 0.95; 1" dur="8s" repeatCount="indefinite" />

                                            <g stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" filter="url(#audio-glow-blue)">
                                                <line x1="-40" y1="10" x2="-40" y2="-10">
                                                    <animate attributeName="y2" values="-10; -25; -10" dur="0.6s" repeatCount="indefinite" />
                                                </line>
                                                <line x1="-20" y1="10" x2="-20" y2="-5">
                                                    <animate attributeName="y2" values="-5; -30; -5" dur="0.8s" repeatCount="indefinite" />
                                                </line>
                                                <line x1="0" y1="10" x2="0" y2="-15">
                                                    <animate attributeName="y2" values="-15; -20; -15" dur="0.5s" repeatCount="indefinite" />
                                                </line>
                                                <line x1="20" y1="10" x2="20" y2="-10">
                                                    <animate attributeName="y2" values="-10; -30; -10" dur="0.7s" repeatCount="indefinite" />
                                                </line>
                                                <line x1="40" y1="10" x2="40" y2="0">
                                                    <animate attributeName="y2" values="0; -20; 0" dur="0.9s" repeatCount="indefinite" />
                                                </line>
                                            </g>

                                            <g>
                                                <g>
                                                    <animateTransform attributeName="transform" type="translate" values="-40,-50; -60,-120" dur="2s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="2s" repeatCount="indefinite" />
                                                    <use href="#audio-nota-musical" transform="scale(0.8)" />
                                                </g>
                                                <g>
                                                    <animateTransform attributeName="transform" type="translate" values="20,-50; 50,-100" dur="2.5s" begin="1s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="2.5s" begin="1s" repeatCount="indefinite" />
                                                    <use href="#audio-nota-musical" transform="scale(1.2)" />
                                                </g>
                                            </g>
                                        </g>
                                    </g>

                                    <g id="microfono" transform="translate(780, 270)">
                                        <ellipse cx="0" cy="70" rx="35" ry="10" fill="#0f172a" opacity="0.2" filter="url(#audio-shadow-device)" />
                                        <ellipse cx="0" cy="70" rx="40" ry="12" fill="#334155" />
                                        <rect x="-6" y="-30" width="12" height="100" fill="#cbd5e1" />

                                        <path d="M -25 -20 L -25 -40 A 25 25 0 0 1 25 -40 L 25 -20" fill="none" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                                        <circle cx="-25" cy="-20" r="5" fill="#475569" />
                                        <circle cx="25" cy="-20" r="5" fill="#475569" />

                                        <rect x="-18" y="-90" width="36" height="80" rx="18" fill="#1e293b" />
                                        <rect x="-14" y="-86" width="28" height="40" rx="14" fill="#334155" />
                                        <line x1="-14" y1="-70" x2="14" y2="-70" stroke="#0f172a" strokeWidth="2" />
                                        <line x1="-14" y1="-60" x2="14" y2="-60" stroke="#0f172a" strokeWidth="2" />
                                        <line x1="-14" y1="-50" x2="14" y2="-50" stroke="#0f172a" strokeWidth="2" />

                                        <circle cx="0" cy="-25" r="4" fill="#ef4444" />

                                        <g>
                                            <circle cx="0" cy="-25" r="4" fill="#10b981" filter="url(#audio-glow-green)">
                                                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.68; 0.69; 0.95; 1" dur="8s" repeatCount="indefinite" />
                                            </circle>

                                            <g>
                                                <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.68; 0.69; 0.95; 1" dur="8s" repeatCount="indefinite" />

                                                <circle cx="0" cy="-65" r="30" fill="none" stroke="#38bdf8" strokeWidth="3" filter="url(#audio-glow-blue)">
                                                    <animate attributeName="r" values="50; 20" dur="1s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="1s" repeatCount="indefinite" />
                                                </circle>
                                                <circle cx="0" cy="-65" r="30" fill="none" stroke="#38bdf8" strokeWidth="3" filter="url(#audio-glow-blue)">
                                                    <animate attributeName="r" values="50; 20" dur="1s" begin="0.5s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0; 1; 0" dur="1s" begin="0.5s" repeatCount="indefinite" />
                                                </circle>
                                            </g>
                                        </g>
                                    </g>

                                    <g transform="translate(500, 130)">
                                        <g>
                                            <animateTransform
                                                attributeName="transform"
                                                type="scale"
                                                values="0; 0; 1.2; 1; 1; 0"
                                                keyTimes="0; 0.8; 0.83; 0.86; 0.95; 1"
                                                dur="8s"
                                                repeatCount="indefinite"
                                            />
                                            <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.8; 0.82; 0.95; 1" dur="8s" repeatCount="indefinite" />

                                            <circle cx="0" cy="0" r="40" fill="#10b981" filter="url(#audio-shadow-ui)" />
                                            <circle cx="0" cy="0" r="32" fill="none" stroke="#34d399" strokeWidth="2" />
                                            <path d="M -15 -2 L -3 10 L 18 -12" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

                                            <text x="0" y="65" fontFamily="sans-serif" fontWeight="bold" fontSize="16" fill="#10b981" textAnchor="middle" letterSpacing="1">
                                                AUDIO LISTO
                                            </text>
                                        </g>
                                    </g>
                                </g>
                            </svg>
                        </div>

                        <div style={{ textAlign: 'center', marginBottom: 18, maxWidth: 360 }}>
                            <h2 style={{ fontSize: 32, fontWeight: 700, color: '#1E3A8A', margin: 0, marginBottom: 10, letterSpacing: '-0.02em' }}>
                                Configura el audio
                            </h2>
                            <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.6, padding: '0 12px' }}>
                                Sigue estos pasos para asegurar una comunicación clara y ambiente musical para el vuelo.
                            </p>
                        </div>

                        <div style={{
                            width: '100%',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 24,
                            padding: '22px 20px',
                            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.03)',
                            marginBottom: 20,
                            border: '1px solid #F1F5F9'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                {AUDIO_CHECKLIST.map((item, idx) => {
                                    const done = audioChecks[idx];
                                    return (
                                        <button
                                            type="button"
                                            key={item.id}
                                            onClick={() => toggleAudioCheck(idx)}
                                            disabled={isSavingAudioCheck}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 14,
                                                width: '100%',
                                                background: 'transparent',
                                                border: 'none',
                                                padding: 0,
                                                textAlign: 'left',
                                                cursor: isSavingAudioCheck ? 'not-allowed' : 'pointer',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <div
                                                style={{
                                                    marginTop: 1,
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    border: done ? '2px solid #2563EB' : '2px solid #BFDBFE',
                                                    backgroundColor: done ? '#2563EB' : '#FFFFFF',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <svg
                                                    width="13"
                                                    height="13"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="#FFFFFF"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{ opacity: done ? 1 : 0, transition: 'opacity 0.2s ease' }}
                                                >
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                            <span style={{
                                                fontSize: 14,
                                                fontWeight: 500,
                                                color: '#374151',
                                                lineHeight: 1.45,
                                                paddingTop: 2
                                            }}>
                                                {item.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, opacity: 0.5
                        }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>
                                No cierres la app (los datos se guardan)
                            </span>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Fixed CTA for prepare phase ── */}
            {pilotPhase === 'prepare' && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    padding: '16px 24px 28px',
                    background: 'linear-gradient(0deg, #F3F4F6 80%, transparent)',
                    zIndex: 30
                }}>
                    <button
                        onClick={handleChecklistDone}
                        disabled={isUploading || checksCompleted < 3}
                        style={{
                            width: '100%',
                            padding: '16px 20px',
                            backgroundColor: checksCompleted < 3 ? '#E5E7EB' : '#22C55E',
                            color: checksCompleted < 3 ? '#9CA3AF' : 'white',
                            borderRadius: 14,
                            border: 'none',
                            fontSize: 15,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: checksCompleted < 3 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: checksCompleted >= 3 ? '0 8px 24px -8px rgba(34,197,94,0.5)' : 'none'
                        }}
                    >
                        {isUploading ? <Loader2 className="animate-spin" size={18} /> : (
                            <>
                                {checksCompleted < 3 && <Lock size={16} />}
                                <span>
                                    {checksCompleted < 3
                                        ? `Completa los ${3 - checksCompleted} punto${3 - checksCompleted > 1 ? 's' : ''} restante${3 - checksCompleted > 1 ? 's' : ''}`
                                        : 'Checklist terminado'
                                    }
                                </span>
                                {checksCompleted >= 3 && <ChevronRight size={18} />}
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ── Fixed CTA for connect phase ── */}
            {pilotPhase === 'connect' && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    padding: '12px 24px 28px',
                    background: 'linear-gradient(0deg, #F3F4F6 85%, transparent)',
                    zIndex: 30
                }}>
                    <button
                        onClick={handleControllerConnected}
                        disabled={isUploading}
                        style={{
                            width: '100%',
                            padding: '17px 20px',
                            backgroundColor: '#22C55E',
                            color: 'white',
                            borderRadius: 14,
                            border: 'none',
                            fontSize: 16,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 8px 24px -8px rgba(34,197,94,0.5)'
                        }}
                    >
                        {isUploading
                            ? <Loader2 className="animate-spin" size={18} />
                            : <>Mando conectado <ChevronRight size={18} /></>
                        }
                    </button>
                </div>
            )}

            {pilotPhase === 'audio' && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    padding: '12px 24px 28px',
                    background: 'linear-gradient(0deg, #F3F4F6 85%, transparent)',
                    zIndex: 30
                }}>
                    <button
                        onClick={handleFinalizePreparation}
                        disabled={isUploading || audioChecksCompleted < AUDIO_CHECKLIST.length}
                        style={{
                            width: '100%',
                            padding: '17px 20px',
                            backgroundColor: audioChecksCompleted < AUDIO_CHECKLIST.length ? '#E5E7EB' : '#2563EB',
                            color: audioChecksCompleted < AUDIO_CHECKLIST.length ? '#9CA3AF' : 'white',
                            borderRadius: 14,
                            border: 'none',
                            fontSize: 16,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: (isUploading || audioChecksCompleted < AUDIO_CHECKLIST.length) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: audioChecksCompleted >= AUDIO_CHECKLIST.length ? '0 8px 24px -8px rgba(37,99,235,0.45)' : 'none'
                        }}
                    >
                        {isUploading
                            ? <Loader2 className="animate-spin" size={18} />
                            : <>Audio listo <ChevronRight size={18} /></>
                        }
                    </button>
                </div>
            )}

            {showConfirmModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(6, 18, 45, 0.55)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    zIndex: 120,
                    padding: 16
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: 420,
                        backgroundColor: 'white',
                        borderRadius: 24,
                        padding: 18,
                        color: '#0f172a',
                        boxShadow: '0 24px 44px -24px rgba(2, 40, 89, 0.55)'
                    }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Confirma punto de pista</h3>
                        <p style={{ margin: 0, fontSize: 13, color: '#475569', marginBottom: 14 }}>
                            Toma foto si la necesitas y agrega una referencia breve.
                        </p>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                backgroundColor: '#f1f5f9',
                                borderRadius: 14,
                                height: 132,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundImage: photoUrl ? `url(${photoUrl})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                border: '1px dashed #94a3b8',
                                marginBottom: 12,
                                cursor: 'pointer'
                            }}
                        >
                            {!photoUrl && (
                                <>
                                    <Camera size={28} color="#0f172a" style={{ marginBottom: 6, opacity: 0.75 }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Tomar foto (opcional)</span>
                                </>
                            )}
                            {photoUrl && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'rgba(15, 23, 42, 0.28)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Cambiar foto</span>
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoSelect}
                            style={{ display: 'none' }}
                        />

                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                            Referencia (opcional)
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Frente a canchas / junto al domo"
                            value={spotNote}
                            onChange={(e) => setSpotNote(e.target.value)}
                            maxLength={120}
                            style={{
                                width: '100%',
                                padding: '14px 12px',
                                borderRadius: 12,
                                border: '1px solid #cbd5e1',
                                backgroundColor: 'white',
                                color: '#0f172a',
                                fontSize: 14,
                                outline: 'none',
                                marginBottom: 14
                            }}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isUploading}
                                style={{
                                    padding: '13px',
                                    borderRadius: 12,
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: 'white',
                                    color: '#334155',
                                    fontWeight: 700,
                                    fontSize: 14
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={handleConfirmRunway}
                                disabled={isUploading}
                                style={{
                                    padding: '13px',
                                    borderRadius: 12,
                                    border: 'none',
                                    backgroundColor: '#0f172a',
                                    color: 'white',
                                    fontWeight: 800,
                                    fontSize: 14,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                {isUploading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
