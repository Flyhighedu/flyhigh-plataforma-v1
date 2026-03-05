'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ClosureTaskScreen from './ClosureTaskScreen';
import KeyDropModal from './KeyDropModal';
import { ParkTruckIllustration } from './VehiclePositioningScreen';
import { parseMeta } from '@/utils/metaHelpers';
import { CLOSURE_STEPS } from '@/constants/closureFlow';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';
import { enqueueOptimisticUpload } from '@/utils/offlineSyncManager';

function FinalParkingHero() {
    return (
        <div className="mx-auto mb-2 w-full max-w-[330px]">
            <ParkTruckIllustration />
        </div>
    );
}

function getFileExtension(file) {
    const fileName = String(file?.name || '');
    const fromName = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    if (fromName) return fromName;

    const mimeType = String(file?.type || '').toLowerCase();
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    return 'jpg';
}

async function uploadKeyDropEvidence({ supabase, journeyId, file }) {
    const extension = getFileExtension(file);
    const path = `${journeyId}/closure/key-drop/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from('staff-arrival')
        .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
        .from('staff-arrival')
        .getPublicUrl(path);

    return String(publicData?.publicUrl || '');
}

export default function FinalParkingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const role = useMemo(() => String(profile?.role || '').trim().toLowerCase(), [profile?.role]);
    const isAssistant = role === 'assistant' || role === 'auxiliar' || role === 'aux';

    const meta = parseMeta(missionInfo?.meta);
    const parkingChecklistDone =
        meta.aux_final_parking_checklist_done === true ||
        meta.aux_final_parking_done === true ||
        meta.closure_final_parking_done === true;
    const keyDropDone =
        meta.aux_key_drop_done === true ||
        meta.closure_key_drop_done === true;
    const keyDropPending = parkingChecklistDone && !keyDropDone && isAssistant;

    const [isKeyDropOpen, setIsKeyDropOpen] = useState(keyDropPending);
    const [isKeyDropDeferred, setIsKeyDropDeferred] = useState(false);
    const [isSubmittingKeyDrop, setIsSubmittingKeyDrop] = useState(false);

    useEffect(() => {
        if (!isAssistant) {
            setIsKeyDropOpen(false);
            setIsKeyDropDeferred(false);
            return;
        }

        if (parkingChecklistDone && !keyDropDone) {
            if (!isSubmittingKeyDrop && !isKeyDropOpen && !isKeyDropDeferred) {
                setIsKeyDropOpen(true);
            }
            return;
        }

        if (keyDropDone && isKeyDropOpen) {
            setIsKeyDropOpen(false);
        }
        if (keyDropDone && isKeyDropDeferred) {
            setIsKeyDropDeferred(false);
        }

        if (!parkingChecklistDone && isKeyDropDeferred) {
            setIsKeyDropDeferred(false);
        }
    }, [parkingChecklistDone, keyDropDone, isAssistant, isSubmittingKeyDrop, isKeyDropOpen, isKeyDropDeferred]);

    const handleCloseKeyDrop = () => {
        if (isSubmittingKeyDrop) return;
        setIsKeyDropOpen(false);
        if (keyDropPending) {
            setIsKeyDropDeferred(true);
        }
    };

    const handleReopenKeyDrop = () => {
        if (!keyDropPending || isSubmittingKeyDrop) return;
        setIsKeyDropDeferred(false);
        setIsKeyDropOpen(true);
    };

    const handleConfirmKeyDrop = async ({ keyDropPhotoFile }) => {
        if (!journeyId || !userId || !isAssistant || !keyDropPhotoFile) return;

        setIsSubmittingKeyDrop(true);
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
            const currentParkingChecklistDone =
                currentMeta.aux_final_parking_checklist_done === true ||
                currentMeta.aux_final_parking_done === true ||
                currentMeta.closure_final_parking_done === true;

            if (!currentParkingChecklistDone) {
                alert('Primero confirma el estacionamiento para continuar.');
                setIsSubmittingKeyDrop(false);
                return;
            }

            const alreadyDone =
                currentMeta.aux_key_drop_done === true ||
                currentMeta.closure_key_drop_done === true;

            if (alreadyDone) {
                setIsKeyDropOpen(false);
                setIsKeyDropDeferred(false);
                onRefresh && onRefresh();
                return;
            }

            // INSTANT: Write DB state immediately (triggers Realtime)
            const extension = getFileExtension(keyDropPhotoFile);
            const storagePath = `${journeyId}/closure/key-drop/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
            const actorName = String(profile?.full_name || '').trim().split(/\s+/)[0] || 'Auxiliar';
            const nextMeta = {
                ...currentMeta,
                aux_final_parking_checklist_done: true,
                aux_key_drop_done: true,
                aux_key_drop_done_at: now,
                aux_key_drop_done_by: userId,
                aux_key_drop_done_by_name: actorName,
                aux_key_drop_photo_url: 'uploading',
                aux_key_drop_photo_at: now,
                aux_key_drop_photo_by: userId,
                aux_final_parking_done: true,
                aux_final_parking_done_at: now,
                aux_final_parking_done_by: userId,
                aux_final_parking_done_by_name: actorName,
                closure_final_parking_done: true,
                closure_final_parking_done_at: now,
                closure_final_parking_done_by: userId,
                closure_final_parking_done_by_name: actorName,
                closure_key_drop_done: true,
                closure_key_drop_done_at: now,
                closure_key_drop_done_by: userId,
                closure_key_drop_done_by_name: actorName,
                closure_phase: 'base_closure'
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

            // UI advances immediately
            setIsKeyDropOpen(false);
            setIsKeyDropDeferred(false);
            onRefresh && onRefresh();

            // BACKGROUND: Queue heavy upload (fire-and-forget)
            enqueueOptimisticUpload({
                file: keyDropPhotoFile,
                storageBucket: 'staff-arrival',
                storagePath,
                dbMutation: {
                    table: 'staff_journeys',
                    matchColumn: 'id',
                    matchValue: journeyId,
                    data: {}
                },
                label: 'Foto resguardo de llaves'
            }).then(async () => {
                try {
                    const supabase2 = createClient();
                    const { data: publicData } = supabase2.storage
                        .from('staff-arrival')
                        .getPublicUrl(storagePath);
                    const { data: latest } = await supabase2
                        .from('staff_journeys')
                        .select('meta')
                        .eq('id', journeyId)
                        .single();
                    const latestMeta = parseMeta(latest?.meta);
                    await supabase2
                        .from('staff_journeys')
                        .update({
                            meta: { ...latestMeta, aux_key_drop_photo_url: publicData.publicUrl },
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', journeyId);
                } catch (e) {
                    console.warn('[OptimisticUpload] key drop meta patch failed:', e);
                }
            }).catch(e => console.warn('[OptimisticUpload] enqueue failed:', e));
        } catch (error) {
            console.error('No se pudo confirmar resguardo de llaves:', error);
            alert('No se pudo confirmar el resguardo de llaves. Intenta de nuevo.');
        } finally {
            setIsSubmittingKeyDrop(false);
        }
    };

    return (
        <>
            <ClosureTaskScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={missionInfo}
                missionState={missionState}
                onRefresh={onRefresh}
                screenKey={CLOSURE_STEPS.FINAL_PARKING}
                title="Lleva el vehículo a su estacionamiento"
                description="Completa estacionamiento final y registra evidencia visual antes del resguardo de llaves."
                iconName="local_parking"
                headerLayout="canvas"
                layoutDensity="compact"
                heroContent={<FinalParkingHero />}
                checklistMetaKey="closure_final_parking_checks"
                doneFlagKey="aux_final_parking_checklist_done"
                doneAtKey="aux_final_parking_checklist_done_at"
                doneByKey="aux_final_parking_checklist_done_by"
                doneByNameKey="aux_final_parking_checklist_done_by_name"
                checklistItems={[
                    { id: 'park_in_assigned_slot', label: 'Estacionar en cajón asignado' },
                    { id: 'secure_vehicle', label: 'Asegurar frenos, luces y cierre de unidad' }
                ]}
                requiresPhoto={true}
                photoMetaKey="closure_final_parking_photo_url"
                photoAtKey="closure_final_parking_photo_at"
                photoByKey="closure_final_parking_photo_by"
                photoLabel="Tomar foto del estacionamiento final"
                prerequisites={[
                    {
                        key: 'global_equipment_unloaded',
                        keys: ['global_equipment_unloaded', 'closure_equipment_unload_done'],
                        label: 'Equipo descargado en base'
                    }
                ]}
                nextClosureStep={CLOSURE_STEPS.CHECKOUT}
                allowedRoles={['assistant']}
                waitMessage="Esperando al auxiliar para cerrar estacionamiento final."
                buttonLabel="Estacionamiento confirmado"
                doneLabel="Estacionamiento confirmado"
                successMessage="Checklist de estacionamiento confirmado."
            />

            {keyDropPending && !isKeyDropOpen ? (
                <div className="pointer-events-none fixed inset-x-0 bottom-[108px] z-50 px-5">
                    <div className="pointer-events-auto mx-auto w-full max-w-[420px] rounded-2xl border border-amber-200 bg-amber-50/95 p-3 shadow-[0_18px_34px_-22px_rgba(180,83,9,0.55)] backdrop-blur-sm">
                        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-700">
                            Pendiente de cierre
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                            Falta completar el resguardo de llaves.
                        </p>
                        <button
                            type="button"
                            onClick={handleReopenKeyDrop}
                            disabled={isSubmittingKeyDrop}
                            className={getPrimaryCtaClasses(isSubmittingKeyDrop, 'mt-3 inline-flex items-center justify-center gap-2')}
                        >
                            <KeyRound size={15} />
                            Reabrir resguardo de llaves
                        </button>
                    </div>
                </div>
            ) : null}

            {isKeyDropOpen ? (
                <KeyDropModal
                    isOpen={true}
                    onClose={handleCloseKeyDrop}
                    onConfirm={handleConfirmKeyDrop}
                    isSubmitting={isSubmittingKeyDrop}
                />
            ) : null}
        </>
    );
}
