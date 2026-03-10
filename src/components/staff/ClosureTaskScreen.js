'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { enqueueOptimisticUpload } from '@/utils/offlineSyncManager';
import { compressPhotoForUpload } from '@/utils/compressPhoto';
import { getClosurePhaseForStep, getClosureProgress, normalizeClosureStep } from '@/constants/closureFlow';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function normalizeRole(role) {
    const normalized = safeText(role).trim().toLowerCase();
    if (normalized === 'auxiliar' || normalized === 'aux') return 'assistant';
    return normalized;
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [head] = normalized.split(/\s+/);
    return head || fallback;
}

function normalizeChecklist(rawChecks, checklistItems) {
    const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
        ? rawChecks
        : Object.create(null);

    const normalized = Object.create(null);
    checklistItems.forEach((item) => {
        normalized[item.id] = source[item.id] === true;
    });

    return normalized;
}

function stripLegacyClosureStep(meta) {
    const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta)
        ? { ...meta }
        : Object.create(null);

    delete safeMeta.closure_step;
    return safeMeta;
}

function isMetaTruthyFlag(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function isPrerequisiteReady(meta, item) {
    const keys = Array.isArray(item?.keys) && item.keys.length > 0
        ? item.keys
        : [item?.key];

    return keys.some((key) => key && isMetaTruthyFlag(meta?.[key]));
}

function checklistEqual(left, right, checklistItems) {
    return checklistItems.every((item) => Boolean(left?.[item.id]) === Boolean(right?.[item.id]));
}

function getFileExtension(file) {
    const fileName = safeText(file?.name);
    const fromName = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    if (fromName) return fromName;

    const mimeType = safeText(file?.type).toLowerCase();
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    return 'jpg';
}

export default function ClosureTaskScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh,
    screenKey,
    title,
    description,
    checklistItems = [],
    checklistGroups = null,
    checklistMetaKey = `${screenKey}_checks`,
    doneFlagKey = `${screenKey}_done`,
    doneAtKey = `${screenKey}_done_at`,
    doneByKey = `${screenKey}_done_by`,
    doneByNameKey = `${screenKey}_done_by_name`,
    nextClosureStep = null,
    requiresPhoto = false,
    photoMetaKey = `${screenKey}_photo_url`,
    photoAtKey = `${screenKey}_photo_at`,
    photoByKey = `${screenKey}_photo_by`,
    photoLabel = 'Tomar foto de evidencia',
    buttonLabel = 'Confirmar tarea',
    doneLabel = 'Tarea confirmada',
    allowedRoles = null,
    waitMessage = 'Esperando al responsable de esta tarea.',
    prerequisites = [],
    iconName = 'inventory_2',
    chipOverride = null,
    headerLayout = 'card',
    heroContent = null,
    layoutDensity = 'default',
    lockToPilot = false,
    controlScope = null,
    extraMetaPatch = null,
    journeyPatch = null,
    successMessage = 'Paso guardado correctamente.'
}) {
    const role = normalizeRole(profile?.role);
    const actorName = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    const resolvedControlScope = controlScope || screenKey;
    const controlModeKey = `${resolvedControlScope}_control_mode`;
    const controllerUserIdKey = `${resolvedControlScope}_controller_user_id`;
    const controllerNameKey = `${resolvedControlScope}_controller_name`;
    const controllerRoleKey = `${resolvedControlScope}_controller_role`;
    const controlLockedAtKey = `${resolvedControlScope}_control_locked_at`;

    const initialMeta = parseMeta(missionInfo?.meta);
    const [checks, setChecks] = useState(() => normalizeChecklist(initialMeta[checklistMetaKey], checklistItems));
    const [photoUrl, setPhotoUrl] = useState(() => safeText(initialMeta[photoMetaKey]));
    const [taskDone, setTaskDone] = useState(initialMeta[doneFlagKey] === true);
    const [doneByName, setDoneByName] = useState(() => safeText(initialMeta[doneByNameKey]));
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [controlMode, setControlMode] = useState(() => safeText(initialMeta[controlModeKey]) || 'open');
    const [controllerName, setControllerName] = useState(() => safeText(initialMeta[controllerNameKey]));
    const [controllerUserId, setControllerUserId] = useState(() => safeText(initialMeta[controllerUserIdKey]));
    const [isClaimingControl, setIsClaimingControl] = useState(false);
    const [showPilotLockAnimation, setShowPilotLockAnimation] = useState(false);

    const inputRef = useRef(null);

    const allowedRoleSet = useMemo(() => {
        if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return null;
        return new Set(allowedRoles.map((item) => normalizeRole(item)).filter(Boolean));
    }, [allowedRoles]);

    const isAllowedRole = allowedRoleSet ? allowedRoleSet.has(role) : true;
    const pilotLocked = lockToPilot && controlMode === 'pilot_locked';
    const isReadOnlyByPilotLock = pilotLocked && role !== 'pilot';
    const isReadOnly = !isAllowedRole || isReadOnlyByPilotLock;
    const isBusy = isSavingCheck || isUploadingPhoto || isFinalizing;
    const shouldRenderPilotLockChip = isReadOnlyByPilotLock;
    const isCanvasHeader = headerLayout === 'canvas';
    const isCompactDensity = layoutDensity === 'compact';

    const contentMaxWidth = isCompactDensity ? 500 : 560;
    const contentPadding = isCompactDensity ? '8px 16px 118px' : '16px 22px 132px';
    const headerGapBottom = isCompactDensity ? 10 : 14;
    const footerPadding = isCompactDensity
        ? '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))'
        : '16px 22px calc(16px + env(safe-area-inset-bottom, 0px))';
    const checklistCardPadding = isCompactDensity ? 12 : 16;
    const checklistCardRadius = isCompactDensity ? 16 : 20;
    const checklistItemPadding = isCompactDensity ? '9px 10px' : '11px 12px';
    const checklistGap = isCompactDensity ? 8 : 10;
    const infoBlockMarginBottom = isCompactDensity ? 8 : 12;

    const totalChecks = checklistItems.length;
    const completedChecks = useMemo(
        () => checklistItems.reduce((sum, item) => sum + (checks[item.id] ? 1 : 0), 0),
        [checks, checklistItems]
    );
    const allChecksDone = totalChecks === 0 ? true : completedChecks === totalChecks;
    const photoReady = !requiresPhoto || Boolean(photoUrl);

    const progressStep = normalizeClosureStep(screenKey);
    const progress = getClosureProgress(progressStep);

    const prerequisiteStatus = useMemo(() => {
        const meta = parseMeta(missionInfo?.meta);
        return prerequisites.map((item) => ({
            ...item,
            ready: isPrerequisiteReady(meta, item)
        }));
    }, [missionInfo?.meta, prerequisites]);

    const resolvedChecklistGroups = useMemo(() => {
        if (!Array.isArray(checklistGroups) || checklistGroups.length === 0) {
            return [];
        }

        const itemMap = new Map(checklistItems.map((item) => [safeText(item.id), item]));
        const groups = [];

        checklistGroups.forEach((group, index) => {
            const rawItems = Array.isArray(group?.items) ? group.items : [];
            const normalizedItems = rawItems
                .map((entry) => {
                    if (typeof entry === 'string') {
                        return itemMap.get(entry) || null;
                    }

                    const entryId = safeText(entry?.id);
                    if (!entryId) return null;
                    if (itemMap.has(entryId)) return itemMap.get(entryId);

                    const entryLabel = safeText(entry?.label);
                    if (!entryLabel) return null;

                    return {
                        id: entryId,
                        label: entryLabel
                    };
                })
                .filter((item) => item && safeText(item.id));

            if (normalizedItems.length === 0) return;

            groups.push({
                id: safeText(group?.id) || `group_${index + 1}`,
                title: safeText(group?.title || group?.label) || `Bloque ${index + 1}`,
                accentColor: safeText(group?.accentColor || group?.color) || '#1D4ED8',
                softBgColor: safeText(group?.softBgColor || group?.bgColor) || '#EFF6FF',
                items: normalizedItems
            });
        });

        if (groups.length === 0) return [];

        const groupedIds = new Set();
        groups.forEach((group) => {
            group.items.forEach((item) => groupedIds.add(item.id));
        });

        const ungroupedItems = checklistItems.filter((item) => !groupedIds.has(item.id));
        if (ungroupedItems.length > 0) {
            groups.push({
                id: 'additional_items',
                title: 'Checklist adicional',
                accentColor: '#1D4ED8',
                softBgColor: '#EFF6FF',
                items: ungroupedItems
            });
        }

        return groups;
    }, [checklistGroups, checklistItems]);

    const prerequisitesReady = prerequisiteStatus.every((item) => item.ready);

    const canEditChecks = !taskDone && !isBusy && !isReadOnly && prerequisitesReady;
    const canCapturePhoto = requiresPhoto && !taskDone && !isBusy && !isReadOnly && prerequisitesReady;
    const canFinalize = !taskDone && !isBusy && !isReadOnly && prerequisitesReady && allChecksDone && photoReady;

    useEffect(() => {
        const nextMeta = parseMeta(missionInfo?.meta);
        const nextChecks = normalizeChecklist(nextMeta[checklistMetaKey], checklistItems);
        const nextPhotoUrl = safeText(nextMeta[photoMetaKey]);
        const nextDone = nextMeta[doneFlagKey] === true;
        const nextDoneByName = safeText(nextMeta[doneByNameKey]);
        const nextControlMode = safeText(nextMeta[controlModeKey]) || 'open';
        const nextControllerName = safeText(nextMeta[controllerNameKey]);
        const nextControllerUserId = safeText(nextMeta[controllerUserIdKey]);

        setChecks((prev) => (checklistEqual(prev, nextChecks, checklistItems) ? prev : nextChecks));
        setPhotoUrl((prev) => (prev === nextPhotoUrl ? prev : nextPhotoUrl));
        setTaskDone((prev) => (prev === nextDone ? prev : nextDone));
        setDoneByName((prev) => (prev === nextDoneByName ? prev : nextDoneByName));
        setControlMode((prev) => (prev === nextControlMode ? prev : nextControlMode));
        setControllerName((prev) => (prev === nextControllerName ? prev : nextControllerName));
        setControllerUserId((prev) => (prev === nextControllerUserId ? prev : nextControllerUserId));
    }, [
        missionInfo?.meta,
        missionState,
        checklistMetaKey,
        checklistItems,
        photoMetaKey,
        doneFlagKey,
        doneByNameKey,
        controlModeKey,
        controllerNameKey,
        controllerUserIdKey
    ]);

    useEffect(() => {
        if (!lockToPilot || !journeyId || role !== 'pilot' || taskDone || pilotLocked) return;

        let cancelled = false;

        const claimControl = async () => {
            setIsClaimingControl(true);
            try {
                const supabase = createClient();
                const now = new Date().toISOString();
                const { data, error } = await supabase
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();

                if (error) throw error;

                const currentMeta = stripLegacyClosureStep(parseMeta(data?.meta));
                if (currentMeta[doneFlagKey] === true) return;
                if (safeText(currentMeta[controlModeKey]) === 'pilot_locked') return;

                const nextMeta = {
                    ...currentMeta,
                    [controlModeKey]: 'pilot_locked',
                    [controllerUserIdKey]: userId,
                    [controllerNameKey]: actorName,
                    [controllerRoleKey]: 'pilot',
                    [controlLockedAtKey]: now
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
                setControlMode('pilot_locked');
                setControllerName(actorName);
                setControllerUserId(safeText(userId));
            } catch (error) {
                console.warn('No se pudo asignar el control del piloto:', error);
            } finally {
                if (!cancelled) setIsClaimingControl(false);
            }
        };

        claimControl();

        return () => {
            cancelled = true;
        };
    }, [
        lockToPilot,
        journeyId,
        role,
        taskDone,
        pilotLocked,
        doneFlagKey,
        controlModeKey,
        controllerUserIdKey,
        controllerNameKey,
        controllerRoleKey,
        controlLockedAtKey,
        actorName,
        userId
    ]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(''), 2600);
        return () => clearTimeout(timer);
    }, [feedback]);

    useEffect(() => {
        if (!showPilotLockAnimation) return;
        const timer = setTimeout(() => setShowPilotLockAnimation(false), 500);
        return () => clearTimeout(timer);
    }, [showPilotLockAnimation]);

    const triggerPilotLockAnimation = () => {
        if (!shouldRenderPilotLockChip) return;
        setShowPilotLockAnimation(false);
        setTimeout(() => setShowPilotLockAnimation(true), 0);
    };

    const readCurrentMeta = async (supabase) => {
        const { data, error } = await supabase
            .from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single();

        if (error) throw error;
        return stripLegacyClosureStep(parseMeta(data?.meta));
    };

    const updateJourney = async (supabase, payload) => {
        const { error } = await supabase
            .from('staff_journeys')
            .update(payload)
            .eq('id', journeyId);

        if (error) throw error;
    };

    const showReadOnlyFeedback = () => {
        if (!isAllowedRole) {
            setFeedback(waitMessage);
            return;
        }

        if (isReadOnlyByPilotLock) {
            triggerPilotLockAnimation();
            const controllerLabel = controllerName || 'Piloto';
            setFeedback(`Control del piloto activo: ${controllerLabel}.`);
            return;
        }

        setFeedback('No puedes editar este paso por ahora.');
    };

    const handleToggleCheck = async (checkId) => {
        if (!checkId || !journeyId || !userId || taskDone || isBusy) return;
        if (isReadOnly) {
            showReadOnlyFeedback();
            return;
        }

        setIsSavingCheck(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta[doneFlagKey] === true) {
                setTaskDone(true);
                setDoneByName(safeText(currentMeta[doneByNameKey]));
                return;
            }

            if (lockToPilot && safeText(currentMeta[controlModeKey]) === 'pilot_locked' && role !== 'pilot') {
                setControlMode('pilot_locked');
                setControllerName(safeText(currentMeta[controllerNameKey]));
                setControllerUserId(safeText(currentMeta[controllerUserIdKey]));
                showReadOnlyFeedback();
                return;
            }

            const latestChecks = normalizeChecklist(currentMeta[checklistMetaKey], checklistItems);
            latestChecks[checkId] = !latestChecks[checkId];

            const nextMeta = {
                ...currentMeta,
                [checklistMetaKey]: latestChecks
            };

            if (lockToPilot && role === 'pilot') {
                nextMeta[controlModeKey] = 'pilot_locked';
                nextMeta[controllerUserIdKey] = userId;
                nextMeta[controllerNameKey] = actorName;
                nextMeta[controllerRoleKey] = 'pilot';
                nextMeta[controlLockedAtKey] = now;
            }

            await updateJourney(supabase, {
                meta: nextMeta,
                updated_at: now
            });

            setChecks(latestChecks);
        } catch (error) {
            console.error('No se pudo actualizar checklist de cierre:', error);
            alert('No se pudo guardar el checklist. Intenta de nuevo.');
        } finally {
            setIsSavingCheck(false);
        }
    };

    const handleSelectPhoto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || !journeyId || !userId || !requiresPhoto || isBusy || taskDone) return;
        if (isReadOnly) {
            showReadOnlyFeedback();
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const extension = getFileExtension(file);
            const path = `${journeyId}/closure/${screenKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

            // INSTANT: Show local preview
            const localUrl = URL.createObjectURL(file);
            setPhotoUrl(localUrl);

            // INSTANT: Write meta immediately (marks photo as uploading)
            const currentMeta = await readCurrentMeta(supabase);
            const nextMeta = {
                ...currentMeta,
                [photoMetaKey]: 'uploading',
                [photoAtKey]: now,
                [photoByKey]: userId
            };

            await updateJourney(supabase, {
                meta: nextMeta,
                updated_at: now
            });

            // BACKGROUND: Queue heavy upload (fire-and-forget)
            const compressedFile = await compressPhotoForUpload(file);
            enqueueOptimisticUpload({
                file: compressedFile || file,
                storageBucket: 'staff-arrival',
                storagePath: path,
                dbMutation: {
                    table: 'staff_journeys',
                    matchColumn: 'id',
                    matchValue: journeyId,
                    data: {}
                },
                label: `Cierre: ${screenKey}`
            }).then(async () => {
                try {
                    const supabase2 = createClient();
                    const { data: publicData } = supabase2.storage
                        .from('staff-arrival')
                        .getPublicUrl(path);
                    const { data: latest } = await supabase2
                        .from('staff_journeys')
                        .select('meta')
                        .eq('id', journeyId)
                        .single();
                    const latestMeta = parseMeta(latest?.meta);
                    await supabase2
                        .from('staff_journeys')
                        .update({
                            meta: { ...latestMeta, [photoMetaKey]: publicData.publicUrl },
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', journeyId);
                } catch (e) {
                    console.warn(`[OptimisticUpload] ${screenKey} meta patch failed:`, e);
                }
            }).catch(e => console.warn('[OptimisticUpload] enqueue failed:', e));

            onRefresh && onRefresh();
        } catch (error) {
            console.error('No se pudo guardar evidencia de cierre:', error);
            alert('No se pudo guardar la foto de evidencia. Intenta de nuevo.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleFinalize = async () => {
        if (!journeyId || !userId || taskDone || isBusy) return;
        if (isReadOnly) {
            showReadOnlyFeedback();
            return;
        }

        setIsFinalizing(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta[doneFlagKey] === true) {
                setTaskDone(true);
                setDoneByName(safeText(currentMeta[doneByNameKey]));
                onRefresh && onRefresh();
                return;
            }

            if (lockToPilot && safeText(currentMeta[controlModeKey]) === 'pilot_locked' && role !== 'pilot') {
                setControlMode('pilot_locked');
                setControllerName(safeText(currentMeta[controllerNameKey]));
                setControllerUserId(safeText(currentMeta[controllerUserIdKey]));
                showReadOnlyFeedback();
                return;
            }

            const latestChecks = normalizeChecklist(currentMeta[checklistMetaKey], checklistItems);
            const latestChecksDone = checklistItems.every((item) => latestChecks[item.id] === true);
            const latestPhotoUrl = safeText(currentMeta[photoMetaKey]);
            const latestPhotoReady = !requiresPhoto || Boolean(latestPhotoUrl);
            const latestPrerequisitesReady = prerequisites.every((item) => isPrerequisiteReady(currentMeta, item));

            if (!latestPrerequisitesReady) {
                setFeedback('Aun faltan tareas previas para desbloquear este paso.');
                return;
            }

            if (!latestChecksDone || !latestPhotoReady) {
                setChecks(latestChecks);
                setPhotoUrl(latestPhotoUrl);
                setFeedback('Completa todos los requisitos antes de confirmar.');
                return;
            }

            const resolvedNextStep = nextClosureStep
                ? normalizeClosureStep(nextClosureStep)
                : normalizeClosureStep(screenKey);

            const nextMeta = {
                ...currentMeta,
                [checklistMetaKey]: latestChecks,
                [photoMetaKey]: latestPhotoUrl,
                [doneFlagKey]: true,
                [doneAtKey]: now,
                [doneByKey]: userId,
                [doneByNameKey]: actorName,
                closure_phase: getClosurePhaseForStep(resolvedNextStep)
            };

            if (lockToPilot && role === 'pilot') {
                nextMeta[controlModeKey] = 'pilot_locked';
                nextMeta[controllerUserIdKey] = userId;
                nextMeta[controllerNameKey] = actorName;
                nextMeta[controllerRoleKey] = 'pilot';
                nextMeta[controlLockedAtKey] = now;
            }

            const resolvedExtraMetaPatch = typeof extraMetaPatch === 'function'
                ? extraMetaPatch({ currentMeta, now, profile, userId, actorName })
                : extraMetaPatch;

            if (resolvedExtraMetaPatch && typeof resolvedExtraMetaPatch === 'object' && !Array.isArray(resolvedExtraMetaPatch)) {
                Object.assign(nextMeta, resolvedExtraMetaPatch);
            }

            const resolvedJourneyPatch = typeof journeyPatch === 'function'
                ? journeyPatch({ currentMeta, now, profile, userId, actorName })
                : journeyPatch;

            const nextJourneyPayload = {
                mission_state: 'dismantling',
                meta: nextMeta,
                updated_at: now,
                ...(resolvedJourneyPatch && typeof resolvedJourneyPatch === 'object' ? resolvedJourneyPatch : {})
            };

            await updateJourney(supabase, nextJourneyPayload);

            setChecks(latestChecks);
            setPhotoUrl(latestPhotoUrl);
            setTaskDone(true);
            setDoneByName(actorName);
            setFeedback(successMessage);
            onRefresh && onRefresh();
        } catch (error) {
            console.error('No se pudo cerrar paso de desmontaje/retorno:', error);
            alert('No se pudo confirmar este paso. Intenta de nuevo.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const controllerLabel = controllerName || (controllerUserId ? 'Piloto' : 'Piloto');

    const renderChecklistItem = (item, keyPrefix = '') => {
        const checked = checks[item.id] === true;
        const shouldDisableCheckbox = !canEditChecks && !isReadOnlyByPilotLock;
        const showPilotConfirmationCopy =
            checked &&
            lockToPilot &&
            isReadOnlyByPilotLock;

        return (
            <button
                key={`${keyPrefix}${item.id}`}
                type="button"
                onClick={() => handleToggleCheck(item.id)}
                disabled={shouldDisableCheckbox}
                aria-disabled={!canEditChecks}
                style={{
                    width: '100%',
                    border: checked ? '1px solid #BFDBFE' : '1px solid #E5E7EB',
                    backgroundColor: checked ? '#F8FBFF' : '#FFFFFF',
                    borderRadius: 12,
                    padding: checklistItemPadding,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    textAlign: 'left',
                    cursor: canEditChecks ? 'pointer' : 'not-allowed',
                    opacity: taskDone ? 0.78 : (canEditChecks ? 1 : 0.9)
                }}
            >
                <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: checked ? '2px solid #2563EB' : '2px solid #D1D5DB',
                    backgroundColor: checked ? '#2563EB' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: checked ? 1 : 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: isCompactDensity ? 12 : 13, lineHeight: 1.35, color: '#334155', fontWeight: 650 }}>
                        {item.label}
                    </span>
                    {showPilotConfirmationCopy ? (
                        <span style={{ fontSize: 11, lineHeight: 1.35, color: '#1D4ED8', fontWeight: 700 }}>
                            Confirmado por: {controllerLabel}
                        </span>
                    ) : null}
                </div>
            </button>
        );
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
                firstName={actorName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                chipOverride={chipOverride}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                width: '100%',
                maxWidth: contentMaxWidth,
                margin: '0 auto',
                padding: contentPadding,
                overflowY: 'auto'
            }}>
                {isCanvasHeader ? (
                    <div style={{ marginBottom: headerGapBottom }}>
                        {heroContent ? (
                            <div style={{ marginBottom: isCompactDensity ? 2 : 4 }}>
                                {heroContent}
                            </div>
                        ) : null}

                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: isCompactDensity ? 24 : 30,
                                color: '#0F172A',
                                lineHeight: 1.12,
                                letterSpacing: '-0.03em',
                                fontWeight: 800
                            }}>
                                {title}
                            </h2>
                            <p style={{
                                margin: `${isCompactDensity ? 6 : 8}px auto 0`,
                                fontSize: isCompactDensity ? 12 : 14,
                                color: '#64748B',
                                lineHeight: isCompactDensity ? 1.4 : 1.5,
                                maxWidth: isCompactDensity ? 330 : 360
                            }}>
                                {description}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        borderRadius: 20,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 10px 24px -16px rgba(15, 23, 42, 0.35)',
                        padding: 18,
                        marginBottom: headerGapBottom
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 42,
                                height: 42,
                                borderRadius: 14,
                                border: '1px solid #BFDBFE',
                                backgroundColor: '#EFF6FF',
                                color: '#1D4ED8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 21, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>
                                    {iconName}
                                </span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <h2 style={{ margin: 0, fontSize: 25, color: '#0F172A', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                                    {title}
                                </h2>
                                <p style={{ margin: '5px 0 0', fontSize: 13, color: '#64748B', lineHeight: 1.45 }}>
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                                    Progreso cierre
                                </span>
                                <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 800 }}>
                                    {progress.index + 1}/{progress.total}
                                </span>
                            </div>
                            <div style={{ width: '100%', height: 8, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${progress.percent}%`,
                                    height: '100%',
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #2563EB 0%, #06B6D4 100%)',
                                    transition: 'width 0.25s ease'
                                }} />
                            </div>
                        </div>
                    </div>
                )}

                {((!isAllowedRole || isClaimingControl) && !isReadOnlyByPilotLock) && (
                    <div style={{
                        borderRadius: 14,
                        border: '1px solid #BFDBFE',
                        backgroundColor: '#EFF6FF',
                        color: '#1E40AF',
                        padding: '10px 12px',
                        marginBottom: infoBlockMarginBottom,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8
                    }}>
                        <Lock size={16} style={{ marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, fontWeight: 650 }}>
                            {!isAllowedRole
                                ? waitMessage
                                : isClaimingControl
                                    ? 'Sincronizando control del piloto...'
                                    : 'Sincronizando permisos de control.'
                            }
                        </p>
                    </div>
                )}

                {!prerequisitesReady && (
                    <div style={{
                        borderRadius: 14,
                        border: '1px solid #FCD34D',
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        padding: '10px 12px',
                        marginBottom: infoBlockMarginBottom
                    }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Esperando desbloqueo de paso previo</p>
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {prerequisiteStatus.map((item) => (
                                <span key={item.key || (Array.isArray(item.keys) ? item.keys.join('|') : item.label)} style={{ fontSize: 12, fontWeight: 600, opacity: item.ready ? 0.8 : 1 }}>
                                    {item.ready ? 'v' : '-'} {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {feedback && (
                    <div style={{
                        borderRadius: 14,
                        border: '1px solid #BBF7D0',
                        backgroundColor: '#ECFDF5',
                        color: '#166534',
                        padding: '10px 12px',
                        marginBottom: infoBlockMarginBottom,
                        fontSize: 12,
                        fontWeight: 700
                    }}>
                        {feedback}
                    </div>
                )}

                {checklistItems.length > 0 && (
                    <div style={{
                        borderRadius: checklistCardRadius,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 10px 22px -18px rgba(15, 23, 42, 0.4)',
                        padding: checklistCardPadding,
                        marginBottom: infoBlockMarginBottom
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCompactDensity ? 8 : 10 }}>
                            <h3 style={{ margin: 0, fontSize: 14, color: '#0F172A', fontWeight: 800 }}>Checklist</h3>
                            <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 800 }}>
                                {completedChecks}/{totalChecks}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: isCompactDensity ? 10 : 12 }}>
                            {resolvedChecklistGroups.length > 0 ? resolvedChecklistGroups.map((group) => {
                                const groupCompletedChecks = group.items.reduce((sum, item) => sum + (checks[item.id] === true ? 1 : 0), 0);

                                return (
                                    <section
                                        key={group.id}
                                        style={{
                                            borderRadius: 14,
                                            border: '1px solid #DBEAFE',
                                            backgroundColor: '#FFFFFF',
                                            boxShadow: '0 8px 20px -18px rgba(15, 23, 42, 0.35)',
                                            padding: isCompactDensity ? 10 : 12
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 8,
                                                borderRadius: 10,
                                                border: '1px solid #BFDBFE',
                                                backgroundColor: group.softBgColor,
                                                padding: '8px 10px',
                                                marginBottom: 8
                                            }}
                                        >
                                            <h4 style={{ margin: 0, fontSize: 13, color: '#0F172A', fontWeight: 800 }}>
                                                {group.title}
                                            </h4>
                                            <span style={{ fontSize: 11, color: group.accentColor, fontWeight: 800 }}>
                                                {groupCompletedChecks}/{group.items.length}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: checklistGap }}>
                                            {group.items.map((item) => renderChecklistItem(item, `${group.id}:`))}
                                        </div>
                                    </section>
                                );
                            }) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: checklistGap }}>
                                    {checklistItems.map((item) => renderChecklistItem(item))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {requiresPhoto && (
                    <div style={{
                        borderRadius: 20,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 10px 22px -18px rgba(15, 23, 42, 0.4)',
                        padding: 16,
                        marginBottom: infoBlockMarginBottom
                    }}>
                        <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#0F172A', fontWeight: 800 }}>
                            Evidencia
                        </h3>

                        <div
                            onClick={() => {
                                if (!canCapturePhoto) return;
                                inputRef.current?.click();
                            }}
                            style={{
                                height: 140,
                                borderRadius: 12,
                                border: `2px dashed ${photoReady ? '#86EFAC' : '#BFDBFE'}`,
                                backgroundColor: photoUrl ? 'transparent' : '#F8FAFC',
                                backgroundImage: photoUrl ? `url(${photoUrl})` : 'none',
                                backgroundPosition: 'center',
                                backgroundSize: 'cover',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: canCapturePhoto ? 'pointer' : 'default',
                                position: 'relative',
                                overflow: 'hidden',
                                opacity: canCapturePhoto ? 1 : 0.95
                            }}
                        >
                            {!photoUrl && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        width: 46,
                                        height: 46,
                                        borderRadius: '50%',
                                        backgroundColor: '#EFF6FF',
                                        color: '#2563EB',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 8
                                    }}>
                                        <Camera size={22} />
                                    </div>
                                    <p style={{ margin: 0, fontSize: 12, color: '#1D4ED8', fontWeight: 700 }}>{photoLabel}</p>
                                </div>
                            )}

                            {photoUrl && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'rgba(15, 23, 42, 0.38)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <span style={{
                                        color: '#FFFFFF',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                                        padding: '5px 10px',
                                        borderRadius: 8
                                    }}>
                                        {isUploadingPhoto ? 'Subiendo evidencia...' : 'Actualizar foto'}
                                    </span>
                                </div>
                            )}
                        </div>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleSelectPhoto}
                            disabled={!canCapturePhoto}
                            style={{ display: 'none' }}
                        />

                        <div style={{
                            marginTop: 10,
                            borderRadius: 10,
                            border: `1px solid ${photoReady ? '#BBF7D0' : '#BFDBFE'}`,
                            backgroundColor: photoReady ? '#ECFDF5' : '#EFF6FF',
                            color: photoReady ? '#166534' : '#1D4ED8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '8px 10px'
                        }}>
                            {isUploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            <span style={{ fontSize: 12, fontWeight: 700 }}>
                                {isUploadingPhoto
                                    ? 'Guardando evidencia...'
                                    : photoReady
                                        ? 'Evidencia lista'
                                        : 'Foto pendiente para continuar'}
                            </span>
                        </div>
                    </div>
                )}
            </main>

            <div style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 40,
                padding: footerPadding,
                background: 'linear-gradient(180deg, rgba(243,244,246,0) 0%, rgba(243,244,246,0.96) 34%, rgba(243,244,246,1) 100%)'
            }}>
                <div style={{ width: '100%', maxWidth: contentMaxWidth, margin: '0 auto' }}>
                    {shouldRenderPilotLockChip ? (
                        <div className="flex w-full justify-center">
                            <div
                                className={`inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-200 ${showPilotLockAnimation ? 'scale-[1.03] animate-pulse' : ''}`}
                            >
                                <Lock size={15} />
                                <span>Control del piloto activo: {controllerLabel}</span>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleFinalize}
                            disabled={!canFinalize}
                            className={getPrimaryCtaClasses(!canFinalize)}
                        >
                            {isFinalizing ? <Loader2 size={18} className="animate-spin" /> : null}
                            <span>{taskDone ? doneLabel : buttonLabel}</span>
                        </button>
                    )}

                    <div style={{ marginTop: 7, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                            {shouldRenderPilotLockChip
                                ? 'Solo el piloto puede confirmar esta tarea.'
                                : taskDone
                                    ? `${doneLabel}${doneByName ? ` - ${doneByName}` : ''}`
                                    : prerequisitesReady
                                        ? 'No cierres la app (los datos se guardan)'
                                        : 'Completa pasos previos para habilitar este cierre'}
                        </span>
                    </div>

                    <div style={{ marginTop: isCompactDensity ? 6 : 10, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 120, height: 4, borderRadius: 999, backgroundColor: '#D1D5DB' }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
