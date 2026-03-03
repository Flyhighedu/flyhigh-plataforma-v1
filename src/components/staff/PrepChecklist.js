'use client';

// =====================================================
// PrepChecklist.js
// Checklists de pre-jornada por rol con botones grandes,
// foto evidencia y acción de salida.
//
// V3: Soporte para fotos múltiples y agrupación lógica (Auxiliar).
// =====================================================

import { useState, useRef } from 'react';
import {
    Check, Camera, AlertTriangle, ArrowRight, Loader2, X,
    ChevronDown, ChevronUp, GripHorizontal // Icono para modal de confirmación
} from 'lucide-react';
import { PREP_CHECKLISTS, ROLE_LABELS, ROLE_COLORS } from '@/config/prepChecklistConfig';
import { createClient } from '@/utils/supabase/client';
import PilotPrepChecklist from './PilotPrepChecklist';
import TeacherTeamChecklist from './TeacherTeamChecklist';

import SyncHeader from './SyncHeader';

// Helper for date
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatShortDate() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    return `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
}

// NAV_STEPS Removed (Handled by SyncHeader)

export default function PrepChecklist({ role = 'pilot', journeyId, userId, onComplete, preview = false, missionInfo, onRefresh }) {
    if (role === 'pilot') {
        return <PilotPrepChecklist journeyId={journeyId} userId={userId} onComplete={onComplete} preview={preview} missionInfo={missionInfo} onRefresh={onRefresh} />;
    }

    const config = PREP_CHECKLISTS[role] || PREP_CHECKLISTS.assistant;
    const colors = ROLE_COLORS[role] || ROLE_COLORS.assistant;
    const firstName = missionInfo?.profile?.full_name?.split(' ')[0] || 'Operativo';
    const roleName = ROLE_LABELS[role] || role;

    const [checkedItems, setCheckedItems] = useState({});
    const [photoUrls, setPhotoUrls] = useState({}); // Ahora soporta múltiples fotos por itemId
    const [uploadingItem, setUploadingItem] = useState(null); // ID del item subiendo foto
    const [showDepartureModal, setShowDepartureModal] = useState(false);
    const [departureReason, setDepartureReason] = useState('');

    // Modal de confirmación para checks de seguridad
    const [confirmModalItem, setConfirmModalItem] = useState(null);

    const [saving, setSaving] = useState(false);
    const [missionChips, setMissionChips] = useState({}); // { school: bool, address: bool, date: bool }

    // Referencia dinámica para inputs de archivo
    const fileInputRefs = useRef({});

    // --- LÓGICA DE PROGRESO (Custom para Auxiliar) ---
    const items = config.items.filter(i => !i.isDeparture);

    let totalBlocks = items.length;
    let completedBlocks = 0;

    if (role === 'assistant') {
        // Regla especial Auxiliar: 4 bloques lógicos
        // 1. vehicle_loc
        // 2. keys_hand + tires_visual
        // 3. fuel_level
        // 4. trunk_open
        totalBlocks = 4;

        const b1 = checkedItems['vehicle_loc'];
        const b2 = checkedItems['keys_hand'] && checkedItems['tires_visual'];
        const b3 = checkedItems['fuel_level'];
        const b4 = checkedItems['trunk_open'];

        if (b1) completedBlocks++;
        if (b2) completedBlocks++;
        if (b3) completedBlocks++;
        if (b4) completedBlocks++;
    } else if (role === 'teacher') {
        // Regla especial Docente: 2 bloques críticos obligatorios
        // 1. mission_confirm (chips)
        // 2. group_selfie (foto)
        // El checklist de equipo NO bloquea, pero genera excepciones.
        totalBlocks = 2;

        const missionDone = missionChips.school && missionChips.address;

        if (missionDone) completedBlocks++;

        // Block 2: Personal Review (Grid + Selfie)
        const gridDone = checkedItems['__team_grid_complete'];
        const selfieDone = checkedItems['group_selfie'];
        if (gridDone && selfieDone) completedBlocks++;

        // Sync missionDone to checkedItems for critical checks validation
        if (missionDone !== checkedItems['mission_confirm']) {
            setCheckedItems(prev => ({ ...prev, mission_confirm: missionDone }));
        }
    } else {
        // Lógica estándar 1 item = 1 bloque
        completedBlocks = Object.values(checkedItems).filter(Boolean).length;
    }

    // Critical checks validation (generic)
    let criticalItems = items.filter(i => i.critical);
    let criticalDone = false;

    if (role === 'teacher') {
        const missionDone = checkedItems['mission_confirm'];
        const gridDone = checkedItems['__team_grid_complete'];
        const selfieDone = checkedItems['group_selfie'];
        criticalDone = !!(missionDone && gridDone && selfieDone);
    } else {
        criticalDone = criticalItems.every(i => checkedItems[i.id]);
    }
    const allDone = completedBlocks === totalBlocks;

    // UI State for Group (Accordion)
    const [isGroupOpen, setIsGroupOpen] = useState(true);

    const toggleItem = async (itemId) => {
        const newValue = !checkedItems[itemId];

        // Optimistic update
        setCheckedItems(prev => ({ ...prev, [itemId]: newValue }));

        if (preview) return;

        try {
            const supabase = createClient();
            await supabase.from('staff_prep_events').insert({
                journey_id: journeyId,
                user_id: userId,
                event_type: 'check',
                payload: { item_id: itemId, value: newValue }
            });
        } catch (e) {
            console.warn('Error guardando check event:', e);
        }
    };

    const handleCheckClick = (item) => {
        if (item.type === 'check_confirm' && !checkedItems[item.id]) {
            setConfirmModalItem(item); // Abrir modal antes de marcar
        } else {
            toggleItem(item.id);
        }
    };

    const toggleMissionChip = (chipId) => {
        const newValue = !missionChips[chipId];
        setMissionChips(prev => ({ ...prev, [chipId]: newValue }));

        // Log event for chip confirmation
        if (!preview) {
            const supabase = createClient();
            supabase.from('staff_prep_events').insert({
                journey_id: journeyId, user_id: userId, event_type: 'mission_chip',
                payload: { chip: chipId, value: newValue }
            }).then(() => { });
        }
    };

    const confirmCheck = () => {
        if (confirmModalItem) {
            toggleItem(confirmModalItem.id);
            setConfirmModalItem(null);
        }
    };

    // Helper: Compress image before upload
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1280;
                    const scaleSize = MAX_WIDTH / img.width;
                    const width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
                    const height = (img.width > MAX_WIDTH) ? img.height * scaleSize : img.height;

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Canvas is empty'));
                            return;
                        }
                        const newFile = new File([blob], file.name, { type: 'image/jpeg' });
                        resolve(newFile);
                    }, 'image/jpeg', 0.7); // Quality 0.7
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handlePhotoCapture = async (e, itemId) => {
        if (preview) return;
        let file = e.target.files?.[0];
        if (!file) return;

        setUploadingItem(itemId);
        try {
            // Compress image
            try {
                const compressed = await compressImage(file);
                file = compressed;
            } catch (compressionErr) {
                console.warn('Image compression failed, trying original:', compressionErr);
            }

            const supabase = createClient();
            const filename = `prep_${journeyId}_${itemId}_${Date.now()}.jpg`; // Force jpg extension

            const { error: uploadError } = await supabase.storage
                .from('prep-evidence')
                .upload(filename, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                // Fallback local visual
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setPhotoUrls(prev => ({ ...prev, [itemId]: ev.target.result }));
                    // Auto-check item on photo success
                    if (!checkedItems[itemId]) toggleItem(itemId);
                };
                reader.readAsDataURL(file);
                return;
            }

            const { data: publicData } = supabase.storage
                .from('prep-evidence')
                .getPublicUrl(filename);

            setPhotoUrls(prev => ({ ...prev, [itemId]: publicData.publicUrl }));

            // Auto-check item on photo success
            if (!checkedItems[itemId]) toggleItem(itemId);

            await supabase.from('staff_prep_photos').insert({
                journey_id: journeyId, user_id: userId, file_path: publicData.publicUrl, item_id: itemId
            });
            await supabase.from('staff_prep_events').insert({
                journey_id: journeyId, user_id: userId, event_type: 'evidence', payload: { item_id: itemId, file_path: publicData.publicUrl }
            });

        } catch (e) {
            console.error(e);
        } finally {
            setUploadingItem(null);
        }
    };

    const handleContinue = async () => {
        console.log('📌 handleContinue clicked', { role, criticalDone, allDone, checkedItems });

        // FIX: For Teacher, we already redefined criticalDone above.
        // If criticalDone is false, we block.
        if (!criticalDone && !departureReason) {
            console.warn('⚠️ Blocked by critical checks', { criticalItems: criticalItems.map(i => ({ id: i.id, done: checkedItems[i.id] })) });
            return;
        }

        setSaving(true);

        // Global state update for Assistant
        if (role === 'assistant' && allDone && !preview) {
            try {
                const supabase = createClient();
                const now = new Date().toISOString();

                // RESTORED LOGIC WITH SAFETY CHECK:
                // Only update mission_state if we are NOT potentially overwriting a critical Pilot state.
                // We fetch the current state first to be sure.
                const { data: currentJourney } = await supabase
                    .from('staff_journeys')
                    .select('mission_state, meta')
                    .eq('id', journeyId)
                    .single();

                const currentState = currentJourney?.mission_state;
                const rawMeta = currentJourney?.meta;
                let safeMeta = {};

                if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
                    safeMeta = { ...rawMeta };
                } else if (typeof rawMeta === 'string') {
                    try {
                        const parsedMeta = JSON.parse(rawMeta);
                        if (parsedMeta && typeof parsedMeta === 'object' && !Array.isArray(parsedMeta)) {
                            safeMeta = { ...parsedMeta };
                        }
                    } catch {
                        safeMeta = {};
                    }
                }

                const journeyUpdate = {
                    meta: {
                        ...safeMeta,
                        aux_load_cta_at: now,
                        aux_load_cta_by: userId,
                        aux_load_cta_source: 'assistant_prep_continue'
                    },
                    updated_at: now
                };

                // Only update if state is still initial/prep using a safe list
                // If Pilot is already ready (PILOT_READY_FOR_LOAD), we DO NOT overwrite it.
                if (!currentState || currentState === 'PILOT_PREP' || currentState === 'prep') {
                    journeyUpdate.mission_state = 'AUX_PREP_DONE';
                }

                await supabase.from('staff_journeys')
                    .update(journeyUpdate)
                    .eq('id', journeyId);

                // Log event
                await supabase.from('staff_prep_events').insert({
                    journey_id: journeyId, user_id: userId,
                    event_type: 'prep_complete',
                    payload: { role: 'assistant', status: 'AUX_PREP_DONE', cta_at: now }
                });

            } catch (err) {
                console.error("Error logging assistant prep completion", err);
            }
        }

        // Global state update for Teacher
        if (role === 'teacher' && allDone && !preview) {
            try {
                const supabase = createClient();

                // RESTORED LOGIC WITH SAFETY CHECK for Teacher
                const { data: currentJourney } = await supabase
                    .from('staff_journeys')
                    .select('mission_state')
                    .eq('id', journeyId)
                    .single();

                const currentState = currentJourney?.mission_state;

                if (!currentState || currentState === 'PILOT_PREP' || currentState === 'prep' || currentState === 'AUX_PREP_DONE') {
                    await supabase.from('staff_journeys')
                        .update({ mission_state: 'TEACHER_SUPPORTING_PILOT' })
                        .eq('id', journeyId);
                }

                await supabase.from('staff_prep_events').insert({
                    journey_id: journeyId, user_id: userId,
                    event_type: 'prep_complete',
                    payload: { role: 'teacher', status: 'TEACHER_SUPPORTING_PILOT' }
                });
            } catch (err) {
                console.error("Error logging teacher prep completion", err);
            }
        }

        if (onComplete) onComplete();
        setSaving(false);
    };

    const handleDeparture = async () => {
        setSaving(true);
        if (journeyId && !preview) {
            const supabase = createClient();
            await supabase.from('staff_prep_events').insert({
                journey_id: journeyId, user_id: userId, event_type: 'departure_force',
                payload: { reason: departureReason, missing_items: totalBlocks - completedBlocks }
            });
        }
        setTimeout(() => {
            setSaving(false);
            if (onComplete) onComplete();
        }, 800);
    };

    // UI Constants
    const progressPercent = (completedBlocks / Math.max(1, totalBlocks)) * 100;
    const groupColor = ROLE_COLORS[role]?.bg?.replace('bg-', '')?.replace('-500', '') || '#0066FF';
    const groupHex = groupColor.startsWith('#') ? groupColor : (role === 'assistant' ? '#F59E0B' : '#0066FF');

    // Icon Logic
    const GroupIcon = role === 'assistant' ? 'local_shipping' : 'assignment_ind';
    const GroupLabel = role === 'assistant' ? 'Vehículo listo para carga' : 'Montaje personal';

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: '#F8F9FB', color: '#0f172a',
            WebkitFontSmoothing: 'antialiased',
            minHeight: '100vh', display: 'flex', flexDirection: 'column'
        }}>
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionInfo?.mission_state && missionInfo.mission_state !== 'MISSION_BRIEF' ? missionInfo.mission_state : 'prep'}
                onDemoStart={onRefresh}
            />

            {/* ════════════ MAIN CONTENT ════════════ */}
            <main style={{ flex: 1, padding: '24px 20px 160px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* ──── Mission Card ──── */}
                <div style={{
                    backgroundColor: '#0066FF', borderRadius: 20, padding: '20px 22px',
                    boxShadow: '0 20px 40px -12px rgba(0,102,255,0.35)', position: 'relative', overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', right: -30, top: -30, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '50%', filter: 'blur(24px)' }} />
                    <div style={{ position: 'absolute', left: -20, bottom: -20, width: 60, height: 60, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(16px)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'white', backgroundColor: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 8, backdropFilter: 'blur(8px)' }}>
                            Misión del día
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                            {formatShortDate()}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ height: 52, width: 52, flexShrink: 0, backgroundColor: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#0066FF', fontVariationSettings: "'FILL' 0, 'wght' 300" }}>school</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1.25, margin: 0 }}>
                                {missionInfo?.school_name || 'Escuela del día'}
                            </h3>
                            {missionInfo?.colonia && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: 'rgba(255,255,255,0.75)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>location_on</span>
                                    <span style={{ fontSize: 11, fontWeight: 500 }}>{missionInfo.colonia}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ──── Section title ──── */}
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.2, margin: 0 }}>
                        {config.title || 'Montaje'}
                    </h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginTop: 4, margin: '4px 0 0' }}>
                        {completedBlocks}/{totalBlocks} items completados
                    </p>
                </div>

                {/* ──── Checklist Group (Standard for others, Custom for Teacher) ──── */}
                {role === 'teacher' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* 1. Team Check Grid + Evidence (Integrated) */}
                        <TeacherTeamChecklist
                            journeyId={journeyId}
                            userId={userId}
                            missionInfo={missionInfo}
                            // Evidence props passed to be rendered inside the card
                            evidenceItem={items.find(i => i.id === 'group_selfie')}
                            hasPhoto={!!photoUrls['group_selfie']}
                            photoUrl={photoUrls['group_selfie']}
                            uploadingItem={uploadingItem}
                            onPhotoCapture={(id) => fileInputRefs.current[id]?.click()}
                            onRetakePhoto={() => {
                                const newUrls = { ...photoUrls };
                                delete newUrls['group_selfie'];
                                setPhotoUrls(newUrls);
                                setCheckedItems(p => ({ ...p, ['group_selfie']: false }));
                            }}
                            onUpdate={(checks, meta = {}) => {
                                // Logic:
                                // 1. Calculate stats (ok/exception)
                                // 2. Check if ALL cells are handled (OK or Exception) - inferred by count or passed by component
                                // Use dynamic total slots from source config to avoid hardcoded checklist duplication.
                                const currentTotal = Object.keys(checks).length;
                                const totalSlots = Number(meta.totalSlots) || 9;
                                const isGridComplete = currentTotal >= totalSlots;

                                const excCount = Object.values(checks).filter(c => c.status === 'EXCEPTION').length;

                                setCheckedItems(prev => ({
                                    ...prev,
                                    __team_exception_count: excCount,
                                    __team_grid_complete: isGridComplete
                                }));
                            }}
                        />

                        {/* Hidden input for selfie capture */}
                        <input
                            type="file"
                            ref={el => fileInputRefs.current['group_selfie'] = el}
                            className="hidden" accept="image/*" capture="user"
                            onChange={(e) => handlePhotoCapture(e, 'group_selfie')}
                        />

                        {/* 2. Mission Confirmation */}
                        {items.filter(i => i.type === 'mission_chips').map(item => {
                            const isConfirmed = missionChips['school'] && missionChips['address'];

                            const handleToggleMission = () => {
                                const newVal = !isConfirmed;
                                setMissionChips({ school: newVal, address: newVal });
                                if (!preview) {
                                    const supabase = createClient();
                                    supabase.from('staff_prep_events').insert({
                                        journey_id: journeyId, user_id: userId, event_type: 'mission_chip',
                                        payload: { chip: 'mission_bulk', value: newVal }
                                    }).then(() => { });
                                }
                            };

                            return (
                                <button
                                    key={item.id}
                                    onClick={handleToggleMission}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '16px 18px', borderRadius: 16,
                                        backgroundColor: isConfirmed ? '#f0fdf4' : 'white',
                                        border: isConfirmed ? '1.5px solid #22c55e' : '1px solid #e2e8f0',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                        cursor: 'pointer', textAlign: 'left',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                        backgroundColor: isConfirmed ? '#dcfce7' : '#EFF6FF',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 22, color: isConfirmed ? '#22c55e' : '#2563EB', fontVariationSettings: `'FILL' ${isConfirmed ? 1 : 0}` }}>
                                            {isConfirmed ? 'verified' : 'fact_check'}
                                        </span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                            {missionInfo?.school_name || 'Escuela'}
                                        </p>
                                        <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 0, 'wght' 300" }}>location_on</span>
                                            {missionInfo?.colonia || 'Dirección'}
                                        </p>
                                    </div>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: 8,
                                        border: `2px solid ${isConfirmed ? '#22c55e' : '#cbd5e1'}`,
                                        backgroundColor: isConfirmed ? '#22c55e' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s', flexShrink: 0
                                    }}>
                                        {isConfirmed && <Check size={16} color="white" strokeWidth={3} />}
                                    </div>
                                </button>
                            );
                        })}


                    </div>
                ) : (
                    <div style={{
                        backgroundColor: 'white', borderRadius: 16,
                        border: isGroupOpen ? `1.5px solid ${groupHex}20` : '1px solid #f1f5f9',
                        boxShadow: isGroupOpen ? `0 8px 24px -4px ${groupHex}12` : '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s ease', overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => setIsGroupOpen(!isGroupOpen)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textAlign: 'left',
                                background: 'none', border: 'none', cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                height: 44, width: 44, flexShrink: 0, backgroundColor: `${groupHex}10`, borderRadius: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {allDone ? (
                                    <Check size={22} style={{ color: '#22c55e' }} strokeWidth={3} />
                                ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: groupHex, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                                        {GroupIcon}
                                    </span>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>
                                    {GroupLabel}
                                </h4>
                                <div style={{ marginTop: 8, height: 3, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 99, backgroundColor: allDone ? '#22c55e' : groupHex, width: `${progressPercent}%`, transition: 'width 0.4s ease' }} />
                                </div>
                            </div>
                            {isGroupOpen ? <ChevronUp size={18} style={{ color: '#cbd5e1' }} /> : <ChevronDown size={18} style={{ color: '#cbd5e1' }} />}
                        </button>

                        {isGroupOpen && (
                            <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f8fafc' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {items.map(item => {
                                        // --- RENDERIZADO TIPO FOTO ---
                                        if (item.type === 'photo') {
                                            const hasPhoto = !!photoUrls[item.id];
                                            const isChecked = checkedItems[item.id]; // Should be true if photo exists

                                            return (
                                                <div key={item.id} style={{ padding: '16px 0', borderBottom: '1px solid #f8fafc' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: hasPhoto ? '#22c55e' : '#64748b', marginTop: 2 }}>
                                                                {hasPhoto ? 'check_circle' : 'camera_alt'}
                                                            </span>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                                                                    {item.label}
                                                                </span>
                                                                {item.description && (
                                                                    <span style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.3 }}>
                                                                        {item.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {hasPhoto ? (
                                                        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                                            <img src={photoUrls[item.id]} alt="Evidence" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                                                            <button
                                                                onClick={() => {
                                                                    const newUrls = { ...photoUrls };
                                                                    delete newUrls[item.id];
                                                                    setPhotoUrls(newUrls);
                                                                    setCheckedItems(p => ({ ...p, [item.id]: false }));
                                                                }}
                                                                style={{
                                                                    position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)',
                                                                    color: 'white', borderRadius: '50%', width: 32, height: 32,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer'
                                                                }}
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                            <div style={{
                                                                position: 'absolute', bottom: 10, left: 10,
                                                                background: 'rgba(34,197,94,0.9)', color: 'white',
                                                                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8
                                                            }}>
                                                                EVIDENCIA CORRECTA
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Botón de carga
                                                        <button
                                                            onClick={() => fileInputRefs.current[item.id]?.click()}
                                                            disabled={uploadingItem === item.id}
                                                            style={{
                                                                width: '100%', padding: '24px 20px',
                                                                border: `2px dashed ${groupHex}40`, borderRadius: 14,
                                                                backgroundColor: uploadingItem === item.id ? '#f8fafc' : `${groupHex}08`,
                                                                color: uploadingItem === item.id ? '#94a3b8' : groupHex,
                                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                                                                cursor: uploadingItem === item.id ? 'wait' : 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            {uploadingItem === item.id ? (
                                                                <Loader2 size={24} className="animate-spin" />
                                                            ) : (
                                                                <div style={{
                                                                    width: 48, height: 48, borderRadius: '50%', backgroundColor: `${groupHex}15`,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}>
                                                                    <Camera size={22} />
                                                                </div>
                                                            )}
                                                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                                                                {uploadingItem === item.id ? 'Subiendo...' : 'Capturar Evidencia'}
                                                            </span>
                                                        </button>
                                                    )}
                                                    <input
                                                        type="file"
                                                        ref={el => fileInputRefs.current[item.id] = el}
                                                        className="hidden" accept="image/*" capture="environment"
                                                        onChange={(e) => handlePhotoCapture(e, item.id)}
                                                    />
                                                </div>
                                            );
                                        }

                                        // --- RENDERIZADO TIPO MISSION CHIPS ---
                                        if (item.type === 'mission_chips') {
                                            const isConfirmed = missionChips['school'] && missionChips['address'];

                                            const handleToggleMission = () => {
                                                const newVal = !isConfirmed;
                                                setMissionChips({ school: newVal, address: newVal });
                                                if (!preview) {
                                                    const supabase = createClient();
                                                    supabase.from('staff_prep_events').insert({
                                                        journey_id: journeyId, user_id: userId, event_type: 'mission_chip',
                                                        payload: { chip: 'mission_bulk', value: newVal }
                                                    }).then(() => { });
                                                }
                                            };

                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={handleToggleMission}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                                        padding: '14px 10px', borderRadius: 12,
                                                        backgroundColor: isConfirmed ? '#f0fdf4' : 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer', textAlign: 'left',
                                                        borderBottom: '1px solid #f8fafc',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: isConfirmed ? '#22c55e' : '#64748b' }}>
                                                        {isConfirmed ? 'verified_user' : 'info'}
                                                    </span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block' }}>
                                                            {missionInfo?.school_name || 'Escuela'}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: '#64748b' }}>
                                                            {missionInfo?.colonia || 'Dirección'}
                                                        </span>
                                                    </div>
                                                    <div style={{
                                                        width: 24, height: 24, borderRadius: 8,
                                                        border: `2px solid ${isConfirmed ? '#22c55e' : '#cbd5e1'}`,
                                                        backgroundColor: isConfirmed ? '#22c55e' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s'
                                                    }}>
                                                        {isConfirmed && <Check size={16} color="white" strokeWidth={3} />}
                                                    </div>
                                                </button>
                                            );
                                        }

                                        // --- RENDERIZADO TIPO CHECK CONFIRM ---
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleCheckClick(item)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '16px 10px',
                                                    borderBottom: '1px solid #f8fafc',
                                                    background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left'
                                                }}
                                            >
                                                <span style={{ fontSize: 14, fontWeight: 500, color: checkedItems[item.id] ? '#15803d' : '#334155' }}>
                                                    {item.label}
                                                </span>
                                                <div style={{
                                                    width: 24, height: 24, borderRadius: 8,
                                                    border: `2px solid ${checkedItems[item.id] ? '#22c55e' : '#cbd5e1'}`,
                                                    backgroundColor: checkedItems[item.id] ? '#22c55e' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}>
                                                    {checkedItems[item.id] && <Check size={16} color="white" strokeWidth={3} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ════════════ STICKY FOOTER CTA ════════════ */}
            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px 20px 24px',
                background: 'linear-gradient(to top, #F8F9FB 80%, transparent)', zIndex: 40
            }}>
                {/* Warning for critical checks */}
                {!allDone && role !== 'teacher' && role !== 'assistant' && (
                    <div style={{
                        marginBottom: 12, padding: 12, borderRadius: 12,
                        backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
                        display: 'flex', gap: 10, alignItems: 'start'
                    }}>
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <p style={{ fontSize: 12, color: '#b45309', margin: 0, fontWeight: 500 }}>
                            Checks críticos pendientes. Completa todos para continuar.
                        </p>
                    </div>
                )}

                {/* Warning for teacher exceptions */}
                {role === 'teacher' && checkedItems.__team_exception_count > 0 && (
                    <div style={{
                        marginBottom: 12, padding: '12px 16px', borderRadius: 12,
                        backgroundColor: '#fffbeb', border: '1px solid #fcd34d',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                            <p style={{ fontSize: 13, color: '#b45309', margin: 0, fontWeight: 600 }}>
                                Atención: {checkedItems.__team_exception_count} excepciones registradas
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleContinue}
                    disabled={saving || !allDone} // Block if not all done
                    style={{
                        width: '100%',
                        backgroundColor: allDone ? '#0f172a' : '#e2e8f0',
                        color: allDone ? 'white' : '#94a3b8',
                        fontWeight: 700, padding: '18px 0', borderRadius: 16,
                        fontSize: 15, letterSpacing: '-0.01em',
                        boxShadow: allDone ? '0 16px 32px -8px rgba(15,23,42,0.15)' : 'none',
                        transition: 'all 0.2s ease', border: 'none',
                        cursor: allDone ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                >
                    {saving ? (
                        <Loader2 size={22} className="animate-spin" />
                    ) : allDone ? (
                        <>
                            <Check size={18} strokeWidth={3} />
                            {role === 'teacher' ? (checkedItems.__team_exception_count > 0 ? 'Confirmar con excepciones' : 'Completar y apoyar al piloto') : (role === 'assistant' ? 'Continuar a Carga de vehículo' : 'Continuar')}
                        </>
                    ) : (
                        // Calculate missing
                        `Faltan ${totalBlocks - completedBlocks} pasos`
                    )}
                </button>
            </footer>

            {/* MODAL: Confirmación Check */}
            {confirmModalItem && (
                <div
                    onClick={() => setConfirmModalItem(null)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="animate-in slide-in-from-bottom-5"
                        style={{ backgroundColor: 'white', borderRadius: '24px 24px 0 0', padding: 24, width: '100%', maxWidth: 450, paddingBottom: 40 }}
                    >
                        <div style={{ width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, margin: '0 auto 20px' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, marginBottom: 24 }}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <GripHorizontal size={32} color="#0066FF" />
                            </div>
                            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                Confirmar acción
                            </h3>
                            <p style={{ fontSize: 15, color: '#64748b', margin: 0, maxWidth: '80%' }}>
                                ¿Confirmas que has verificado: <br /><strong>"{confirmModalItem.label}"</strong>?
                            </p>
                        </div>

                        <button
                            onClick={confirmCheck}
                            style={{
                                width: '100%', padding: '16px 0', borderRadius: 16, background: '#0066FF', color: 'white',
                                border: 'none', fontWeight: 700, fontSize: 16, boxShadow: '0 10px 20px -5px rgba(0,102,255,0.4)'
                            }}>
                            Sí, confirmo
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL: Salida (Fallback) */}
            {showDepartureModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="animate-in slide-in-from-bottom-4" style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>⚠️ Confirmar</h3>
                            <button onClick={() => setShowDepartureModal(false)}><X size={20} color="#94a3b8" /></button>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setShowDepartureModal(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600 }}>
                                Cancelar
                            </button>
                            <button onClick={handleDeparture} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#f59e0b', color: 'white', border: 'none', fontWeight: 700 }}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
