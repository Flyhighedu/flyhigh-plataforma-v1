'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import LoadingValidationModal from './LoadingValidationModal';
import MomentoDeCargarScreen from './MomentoDeCargarScreen';
import { parseMeta } from '@/utils/metaHelpers';
import { enqueueOptimisticUpload } from '@/utils/offlineSyncManager';
import { compressPhotoForUpload } from '@/utils/compressPhoto';

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'assistant' || normalized === 'auxiliar' || normalized === 'aux') return 'assistant';
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

async function uploadEvidencePhoto({ supabase, journeyId, file, slot }) {
    const extension = getFileExtension(file);
    const path = `${journeyId}/closure/global-loading/${slot}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from('staff-arrival')
        .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
        .from('staff-arrival')
        .getPublicUrl(path);

    return String(publicData?.publicUrl || '');
}

export default function GlobalLoadingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const normalizedRole = useMemo(() => normalizeRole(profile?.role), [profile?.role]);
    const isAssistant = normalizedRole === 'assistant';

    const initialMeta = parseMeta(missionInfo?.meta);
    const [isValidationOpen, setIsValidationOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoaded, setIsLoaded] = useState(
        initialMeta.global_equipment_loaded === true ||
        initialMeta.global_container_loading_done === true ||
        initialMeta.pilot_containers_loaded === true
    );

    useEffect(() => {
        const nextMeta = parseMeta(missionInfo?.meta);
        const nextLoaded =
            nextMeta.global_equipment_loaded === true ||
            nextMeta.global_container_loading_done === true ||
            nextMeta.pilot_containers_loaded === true;

        setIsLoaded((prev) => (prev === nextLoaded ? prev : nextLoaded));
    }, [missionInfo?.meta, missionState]);

    const handleConfirmLoading = async ({ checks, containersPhotoFile, roofPhotoFile }) => {
        if (!journeyId || !userId || !isAssistant) return;

        setIsSubmitting(true);
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
            const alreadyLoaded =
                currentMeta.global_equipment_loaded === true ||
                currentMeta.global_container_loading_done === true ||
                currentMeta.pilot_containers_loaded === true;

            if (alreadyLoaded) {
                setIsValidationOpen(false);
                setIsLoaded(true);
                onRefresh && onRefresh();
                return;
            }

            // Build storage paths for fire-and-forget uploads
            const containersPath = `${journeyId}/closure/global-loading/containers-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${getFileExtension(containersPhotoFile)}`;
            const roofPath = `${journeyId}/closure/global-loading/roof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${getFileExtension(roofPhotoFile)}`;

            // INSTANT: Write DB state first (triggers Realtime for all roles)
            const actorName = firstName(profile?.full_name, 'Operativo');
            const nextMeta = {
                ...currentMeta,
                global_equipment_loading_checks: checks,
                global_equipment_loaded: true,
                global_equipment_loaded_at: now,
                global_equipment_loaded_by: userId,
                global_equipment_loaded_by_name: actorName,
                global_equipment_loaded_photo_containers_url: 'uploading',
                global_equipment_loaded_photo_containers_at: now,
                global_equipment_loaded_photo_containers_by: userId,
                global_equipment_loaded_photo_roof_url: 'uploading',
                global_equipment_loaded_photo_roof_at: now,
                global_equipment_loaded_photo_roof_by: userId,
                global_container_loading_done: true,
                global_container_loading_done_at: now,
                global_container_loading_done_by: userId,
                global_container_loading_done_by_name: actorName,
                pilot_containers_loaded: true,
                aux_return_route_started: true,
                aux_return_route_started_at: now,
                aux_return_route_started_by: userId,
                aux_return_route_started_by_name: actorName,
                closure_return_route_done: true,
                closure_return_route_done_at: now,
                closure_return_route_done_by: userId,
                closure_return_route_done_by_name: actorName,
                closure_phase: 'return'
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
            setIsLoaded(true);
            setIsValidationOpen(false);
            onRefresh && onRefresh();

            // BACKGROUND: Queue heavy uploads (fire-and-forget)
            const enqueueOne = async (file, storagePath, label) => {
                const compressed = await compressPhotoForUpload(file);
                return enqueueOptimisticUpload({
                    file: compressed || file,
                    storageBucket: 'staff-arrival',
                    storagePath,
                    dbMutation: {
                        table: 'staff_journeys',
                        matchColumn: 'id',
                        matchValue: journeyId,
                        data: {}
                    },
                    label
                }).catch(e => console.warn(`[OptimisticUpload] ${label} enqueue failed:`, e));
            };

            Promise.all([
                enqueueOne(containersPhotoFile, containersPath, 'Foto contenedores carga'),
                enqueueOne(roofPhotoFile, roofPath, 'Foto techo carga')
            ]).then(async () => {
                try {
                    const supabase2 = createClient();
                    const { data: cPub } = supabase2.storage.from('staff-arrival').getPublicUrl(containersPath);
                    const { data: rPub } = supabase2.storage.from('staff-arrival').getPublicUrl(roofPath);
                    const { data: latest } = await supabase2
                        .from('staff_journeys')
                        .select('meta')
                        .eq('id', journeyId)
                        .single();
                    const latestMeta = parseMeta(latest?.meta);
                    await supabase2
                        .from('staff_journeys')
                        .update({
                            meta: {
                                ...latestMeta,
                                global_equipment_loaded_photo_containers_url: cPub.publicUrl,
                                global_equipment_loaded_photo_roof_url: rPub.publicUrl
                            },
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', journeyId);
                } catch (e) {
                    console.warn('[OptimisticUpload] global loading meta patch failed:', e);
                }
            }).catch(e => console.warn('[OptimisticUpload] batch failed:', e));
        } catch (error) {
            console.error('No se pudo validar la carga global:', error);
            alert('No se pudo validar la carga. Intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isAssistant) {
        return (
            <MomentoDeCargarScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={missionInfo}
                missionState={missionState}
                onRefresh={onRefresh}
            />
        );
    }

    return (
        <>
            <MomentoDeCargarScreen
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={missionInfo}
                missionState={missionState}
                onRefresh={onRefresh}
                subtitleOverride="Supervisa la carga del equipo. Verifica que cada contenedor esté a bordo y no quede nada en la zona de vuelo."
                onPrimaryAction={() => setIsValidationOpen(true)}
                primaryActionLabel="Carga lista"
                primaryActionDisabled={isLoaded || isSubmitting}
                primaryActionLoading={isSubmitting}
            />

            {isValidationOpen ? (
                <LoadingValidationModal
                    onClose={() => {
                        if (isSubmitting) return;
                        setIsValidationOpen(false);
                    }}
                    onConfirm={handleConfirmLoading}
                    isSubmitting={isSubmitting}
                />
            ) : null}
        </>
    );
}
