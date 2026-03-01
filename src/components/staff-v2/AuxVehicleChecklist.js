'use client';

// =====================================================
// AuxVehicleChecklist — Checklist 2 (Contenedores en vehículo)
// Stage 3: Post Pilot Equipment Ready
// Manteniendo el diseño exacto pedido por el usuario.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ChevronDown, ChevronUp, Check, Camera,
    X, Loader2, AlertTriangle, BatteryCharging, GripHorizontal
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { AUX_LOAD_GROUPS } from '@/config/operationalChecklists';

// ── Date helpers ──
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatShortDate() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    return `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
}

const ANTI_PALOMEO = {
    FINAL_HOLD_DURATION_MS: 1500,
};

const AUX_GROUPS = AUX_LOAD_GROUPS;

const NAV_STEPS = [
    { id: 'informe', label: 'INFORME', icon: 'check', status: 'completed' },
    { id: 'preparacion', label: 'PREPARACIÓN', icon: 'assignment', status: 'completed' },
    { id: 'carga', label: 'CARGA', icon: 'local_shipping', status: 'active' },
    { id: 'operacion', label: 'OPERACIÓN', icon: 'flight', status: 'pending' },
];

function getOfflineQueue(journeyId) {
    try {
        const raw = localStorage.getItem(`flyhigh_aux_queue_2_${journeyId}`);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function addToOfflineQueue(journeyId, event) {
    const queue = getOfflineQueue(journeyId);
    queue.push({ ...event, idempotency_key: crypto.randomUUID(), queued_at: new Date().toISOString() });
    localStorage.setItem(`flyhigh_aux_queue_2_${journeyId}`, JSON.stringify(queue));
}

function clearOfflineQueue(journeyId) {
    localStorage.removeItem(`flyhigh_aux_queue_2_${journeyId}`);
}

async function flushQueueToSupabase(supabase, journeyId, fallbackUserId = null) {
    const queue = getOfflineQueue(journeyId);
    if (queue.length === 0) return;

    const inserts = queue.map((queuedEvent) => ({
        journey_id: journeyId,
        user_id: queuedEvent.user_id || fallbackUserId,
        event_type: queuedEvent.event_type,
        payload: queuedEvent.payload
    }));

    const { error } = await supabase.from('staff_prep_events').insert(inserts);
    if (error) throw error;

    clearOfflineQueue(journeyId);
}

import SyncHeader from './SyncHeader';

export default function AuxVehicleChecklist({ journeyId, userId, onComplete, preview = false, missionInfo }) {
    const [checkedItems, setCheckedItems] = useState({});
    const [photos, setPhotos] = useState({});
    const [expandedBlock, setExpandedBlock] = useState('containers_check');
    const [uploadingTarget, setUploadingTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmModalItem, setConfirmModalItem] = useState(null);

    // Hold handling
    const [finalHoldProgress, setFinalHoldProgress] = useState(0);
    const [holdingFinal, setHoldingFinal] = useState(false);

    const fileInputRef = useRef(null);
    const activePhotoTargetRef = useRef(null);
    const finalHoldAnimRef = useRef(null);

    const group = AUX_GROUPS[0];

    // Validation
    const allChecksDone = group.items.every(i => checkedItems[i.id]);
    const allPhotosDone = group.photos.every(p => photos[p.id]);
    const canDoPhotos = allChecksDone;
    const canSubmit = allChecksDone && allPhotosDone;

    const flushPendingEvents = useCallback(async () => {
        if (preview || !journeyId || !navigator.onLine) return;

        try {
            const supabase = createClient();
            await flushQueueToSupabase(supabase, journeyId, userId);
        } catch (error) {
            console.warn('No se pudo sincronizar cola auxiliar:', error.message || error);
        }
    }, [journeyId, preview, userId]);

    useEffect(() => {
        if (preview || !journeyId) return;

        const handleOnline = () => {
            flushPendingEvents();
        };

        flushPendingEvents();
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [flushPendingEvents, journeyId, preview]);

    const toggleCheck = (item) => {
        if (item.type === 'check_confirm' && !checkedItems[item.id]) {
            setConfirmModalItem(item);
            return;
        }
        const val = !checkedItems[item.id];
        setCheckedItems(prev => ({ ...prev, [item.id]: val }));
        saveEvent('check', { item_id: item.id, value: val });
    };

    const confirmCheck = () => {
        if (!confirmModalItem) return;
        const itemId = confirmModalItem.id;
        setCheckedItems(prev => ({ ...prev, [itemId]: true }));
        saveEvent('check', { item_id: itemId, value: true });
        setConfirmModalItem(null);
    };

    const handlePhotoClick = (targetId) => {
        if (!canDoPhotos) return;
        activePhotoTargetRef.current = targetId;
        fileInputRef.current?.click();
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
                            resolve(file); // Fallback to original if blob fails
                            return;
                        }
                        const newFile = new File([blob], file.name, { type: 'image/jpeg' });
                        resolve(newFile);
                    }, 'image/jpeg', 0.7); // Quality 0.7
                };
                img.onerror = (err) => resolve(file); // Fallback
            };
            reader.onerror = (err) => resolve(file); // Fallback
        });
    };

    const onFileSelected = async (e) => {
        let file = e.target.files?.[0];
        if (!file) return;

        const targetId = activePhotoTargetRef.current;
        setUploadingTarget(targetId);

        if (preview) {
            // ... existing preview logic ...
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPhotos(prev => ({ ...prev, [targetId]: ev.target.result }));
                setUploadingTarget(null);
                saveEvent('photo', { target_id: targetId, local_preview: true });
            };
            reader.readAsDataURL(file);
            return;
        }

        try {
            // Compress image
            try {
                file = await compressImage(file);
            } catch (err) {
                console.warn('Compression failed, using original', err);
            }

            const supabase = createClient();
            const filename = `aux2_${journeyId}_${targetId}_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('prep-evidence')
                .upload(filename, file);

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from('prep-evidence')
                .getPublicUrl(filename);

            const url = publicData.publicUrl;
            setPhotos(prev => ({ ...prev, [targetId]: url }));

            // Log persistence
            await supabase.from('staff_prep_photos').insert({
                journey_id: journeyId, user_id: userId, file_path: url, item_id: targetId
            });

            saveEvent('photo', { target_id: targetId, file_path: url });

        } catch (err) {
            console.error('Error subiendo foto:', err);
            // Fallback visual
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPhotos(prev => ({ ...prev, [targetId]: ev.target.result }));
            };
            reader.readAsDataURL(file);
        } finally {
            setUploadingTarget(null);
        }
    };

    const saveEvent = async (type, payload) => {
        if (!journeyId || preview) return;

        const event = { event_type: `aux2_${type}`, payload, user_id: userId };

        if (!navigator.onLine) {
            addToOfflineQueue(journeyId, event);
            return;
        }

        try {
            const supabase = createClient();
            await flushQueueToSupabase(supabase, journeyId, userId);
            const { error } = await supabase.from('staff_prep_events').insert({
                journey_id: journeyId,
                user_id: userId,
                event_type: event.event_type,
                payload: event.payload
            });

            if (error) throw error;
        } catch (error) {
            addToOfflineQueue(journeyId, event);
            console.warn('No se pudo guardar evento en vivo, enviado a cola local:', error.message || error);
        }
    };

    const startFinalHold = () => {
        if (!canSubmit || saving) return;
        setHoldingFinal(true);
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const pct = Math.min(100, (elapsed / ANTI_PALOMEO.FINAL_HOLD_DURATION_MS) * 100);
            setFinalHoldProgress(pct);
            if (pct >= 100) {
                handleFinalSubmit();
                return;
            }
            finalHoldAnimRef.current = requestAnimationFrame(animate);
        };
        finalHoldAnimRef.current = requestAnimationFrame(animate);
    };

    const stopFinalHold = () => {
        setHoldingFinal(false);
        setFinalHoldProgress(0);
        if (finalHoldAnimRef.current) cancelAnimationFrame(finalHoldAnimRef.current);
    };

    const handleFinalSubmit = async () => {
        setHoldingFinal(false);
        setFinalHoldProgress(0);
        if (preview) {
            onComplete && onComplete();
            return;
        }

        setSaving(true);
        try {
            const supabase = createClient();
            await flushQueueToSupabase(supabase, journeyId, userId);

            await supabase.from('staff_journeys')
                .update({ mission_state: 'AUX_CONTAINERS_DONE', updated_at: new Date().toISOString() })
                .eq('id', journeyId);

        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
            onComplete && onComplete();
        }
    };

    const firstName = missionInfo?.profile?.full_name?.split(' ')[0] || 'Auxiliar';
    const roleName = ROLE_LABELS[missionInfo?.profile?.role] || 'Auxiliar';

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: '#F8F9FB', color: '#0f172a',
            WebkitFontSmoothing: 'antialiased',
            minHeight: '100vh', display: 'flex', flexDirection: 'column'
        }}>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFileSelected} />

            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={missionInfo?.profile?.role}
                navSteps={NAV_STEPS}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionInfo?.mission_state}
                isWaitScreen={false}
                waitPhase="load"
            />

            <main style={{ flex: 1, padding: '24px 20px 200px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ backgroundColor: '#D97706', borderRadius: 20, padding: '20px 22px', boxShadow: '0 20px 40px -12px rgba(217,119,6,0.35)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -30, top: -30, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '50%', filter: 'blur(24px)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'white', backgroundColor: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 8, backdropFilter: 'blur(8px)' }}>Carga en vehículo</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{formatShortDate()}</span>
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1.25, margin: 0 }}>{missionInfo?.school_name || 'Escuela del día'}</h3>
                </div>

                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.2, margin: 0 }}>{group.label}</h1>
                    <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, margin: '2px 0 0' }}>{group.subtitle}</p>
                </div>

                <div style={{
                    backgroundColor: 'white', borderRadius: 16,
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ height: 44, width: 44, flexShrink: 0, backgroundColor: group.bgColor, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 22, color: group.color }}>{group.icon}</span>
                            </div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{group.label}</h4>
                        </div>
                    </div>

                    <div style={{ padding: '0 18px 18px' }}>
                        {/* Checkboxes List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleCheck(item)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 0', borderBottom: '1px solid #f8fafc',
                                        background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer'
                                    }}
                                >
                                    <span style={{ fontSize: 14, fontWeight: 500, color: checkedItems[item.id] ? '#15803d' : '#334155' }}>
                                        {item.label}
                                    </span>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: 6, border: checkedItems[item.id] ? 'none' : '2px solid #cbd5e1',
                                        backgroundColor: checkedItems[item.id] ? '#22c55e' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {checkedItems[item.id] && <Check size={16} color="white" />}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Photos Evidence Block */}
                        <div style={{
                            marginTop: 10, padding: '16px 0', borderTop: '2px dashed #f1f5f9',
                            opacity: canDoPhotos ? 1 : 0.4,
                            transition: 'opacity 0.3s ease'
                        }}>
                            {!canDoPhotos && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                                    <AlertTriangle size={14} className="text-amber-500" />
                                    <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, margin: 0 }}>
                                        Marca los 5 contenedores para habilitar fotos
                                    </p>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {group.photos.map(photo => {
                                    const hasPhoto = !!photos[photo.id];
                                    return (
                                        <div key={photo.id}>
                                            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                                {photo.label} <span style={{ color: '#ef4444' }}>*</span>
                                            </div>
                                            {hasPhoto ? (
                                                <div style={{ position: 'relative', height: 120, borderRadius: 12, overflow: 'hidden' }}>
                                                    <img src={photos[photo.id]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <button onClick={() => {
                                                        const n = { ...photos }; delete n[photo.id]; setPhotos(n);
                                                    }} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: 24, height: 24, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handlePhotoClick(photo.id)}
                                                    style={{
                                                        width: '100%', padding: '16px', border: '2px dashed #F59E0B', borderRadius: 12,
                                                        background: '#fffbeb', color: '#F59E0B', fontWeight: 600, fontSize: 13,
                                                        display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
                                                        cursor: canDoPhotos ? 'pointer' : 'not-allowed'
                                                    }}
                                                >
                                                    {uploadingTarget === photo.id ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : (
                                                        <Camera size={18} />
                                                    )}
                                                    {uploadingTarget === photo.id ? 'Subiendo...' : 'Tomar Foto'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px 20px 24px', background: 'linear-gradient(to top, #F8F9FB 80%, transparent)', zIndex: 40 }}>
                <button
                    onMouseDown={startFinalHold} onMouseUp={stopFinalHold} onMouseLeave={stopFinalHold}
                    onTouchStart={startFinalHold} onTouchEnd={stopFinalHold}
                    disabled={!canSubmit || saving}
                    style={{
                        width: '100%', padding: '18px 0',
                        backgroundColor: canSubmit ? '#0f172a' : '#e2e8f0',
                        color: canSubmit ? 'white' : '#94a3b8',
                        borderRadius: 16, fontWeight: 700, fontSize: 15, border: 'none',
                        position: 'relative', overflow: 'hidden', cursor: canSubmit ? 'pointer' : 'not-allowed'
                    }}
                >
                    {holdingFinal && <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${finalHoldProgress}%`, background: 'rgba(255,255,255,0.2)' }} />}
                    <span style={{ position: 'relative', zIndex: 1 }}>
                        {saving ? 'Guardando...' : canSubmit ? (holdingFinal ? 'Mantén para finalizar...' : 'INICIAR RUTA A ESCUELA') : 'Completa todos los pasos'}
                    </span>
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
                        style={{ backgroundColor: 'white', borderRadius: '24px 24px 0 0', padding: 24, width: '100%', maxWidth: 450, paddingBottom: 40 }}
                    >
                        <div style={{ width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, margin: '0 auto 20px' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, marginBottom: 24 }}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <GripHorizontal size={32} color="#F59E0B" />
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
                                width: '100%', padding: '16px 0', borderRadius: 16, background: '#F59E0B', color: 'white',
                                border: 'none', fontWeight: 700, fontSize: 16, boxShadow: '0 10px 20px -5px rgba(245,158,11,0.4)'
                            }}>
                            Sí, confirmo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
