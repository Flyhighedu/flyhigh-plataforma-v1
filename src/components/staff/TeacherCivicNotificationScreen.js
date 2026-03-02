'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const NO_CIVIC_REASONS = [
    'La escuela no realiza acto cívico',
    'Dirección indicó que no',
    'Horario / logística',
    'Clima / espacio',
    'Otro'
];

/* ─── Megaphone Person SVG Illustration ─── */
function CivicIllustration() {
    return (
        <div style={{
            position: 'relative', width: '100%', maxWidth: 180,
            aspectRatio: '1', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
        }}>
            {/* Circular glow */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, #FFFFFF, #EFF6FF)',
                borderRadius: '50%', transform: 'scale(1.1)', opacity: 0.8,
                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)'
            }} />
            <svg style={{ position: 'relative', zIndex: 1 }}
                viewBox="0 0 400 400" width="150" height="150" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Ground shadow */}
                <ellipse cx="200" cy="330" rx="140" ry="20" fill="#E5E7EB" />
                {/* Body */}
                <path d="M200 120 C180 120 160 140 160 170 V240 H240 V170 C240 140 220 120 200 120 Z" fill="#2563EB" />
                {/* Pants */}
                <path d="M160 240 H240 V320 H160 Z" fill="#1E40AF" />
                {/* Head */}
                <circle cx="200" cy="100" r="40" fill="#FCA5A5" />
                {/* Hair */}
                <path d="M160 100 Q160 50 200 50 Q240 50 240 100 Q240 120 200 120 Q160 120 160 100" fill="#1F2937" />
                {/* Megaphone */}
                <path d="M240 180 L280 160 L280 200 L240 180" fill="#F59E0B" />
                <rect x="230" y="175" width="10" height="10" fill="#4B5563" />
                {/* Sound waves */}
                <path d="M300 160 Q310 180 300 200" stroke="#F59E0B" strokeLinecap="round" strokeWidth="4" fill="none" />
                <path d="M315 150 Q330 180 315 210" stroke="#F59E0B" strokeLinecap="round" strokeWidth="4" fill="none" opacity="0.6" />
                {/* Speech bubble */}
                <path d="M100 80 H160 V120 H120 L100 140 V120 H100 V80 Z" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
                <circle cx="130" cy="100" r="4" fill="#2563EB" />
                <circle cx="145" cy="100" r="4" fill="#2563EB" opacity="0.5" />
                {/* Shoes */}
                <path d="M170 320 V340 H190 V320" fill="#1F2937" />
                <path d="M210 320 V340 H230 V320" fill="#1F2937" />
            </svg>
        </div>
    );
}

export default function TeacherCivicNotificationScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const [isSaving, setIsSaving] = useState(false);
    const initialMeta = parseMeta(missionInfo?.meta);
    const [teacherReady, setTeacherReady] = useState(initialMeta.teacher_civic_notified === true);
    const [civicDecision, setCivicDecision] = useState(initialMeta.teacher_civic_decision || null);
    const [showNoCivicModal, setShowNoCivicModal] = useState(false);
    const [noCivicReason, setNoCivicReason] = useState('');
    const [noCivicOtherReason, setNoCivicOtherReason] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        if (!teacherReady && meta.teacher_civic_notified === true) {
            setTeacherReady(true);
        }
        if (meta.teacher_civic_decision && civicDecision !== meta.teacher_civic_decision) {
            setCivicDecision(meta.teacher_civic_decision);
        }
    }, [missionInfo?.meta, teacherReady, civicDecision]);

    useEffect(() => {
        if (!toastMessage) return;
        const timer = setTimeout(() => setToastMessage(''), 2400);
        return () => clearTimeout(timer);
    }, [toastMessage]);

    const handleNotifyCivic = async () => {
        if (isSaving || teacherReady) return;

        setIsSaving(true);
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
                teacher_civic_notified: true,
                teacher_civic_notified_at: now,
                teacher_civic_notified_by: userId,
                teacher_civic_decision: 'yes',
                teacher_civic_reason: null,
                teacher_civic_reason_detail: null,
                teacher_civic_decision_at: now,
                teacher_civic_decision_by: userId,
                is_recording_standby: false
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

            setTeacherReady(true);
            setCivicDecision('yes');
            setToastMessage('Acto cívico confirmado.');
            setTimeout(() => {
                onRefresh && onRefresh();
            }, 250);
        } catch (error) {
            console.error('Error confirming civic notice:', error);
            alert('No se pudo confirmar. Intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenNoCivicModal = () => {
        if (isSaving || teacherReady) return;
        setNoCivicReason('');
        setNoCivicOtherReason('');
        setShowNoCivicModal(true);
    };

    const handleRegisterNoCivic = async () => {
        const otherReason = noCivicOtherReason.trim();
        const isValid = Boolean(noCivicReason) && (noCivicReason !== 'Otro' || otherReason.length > 0);
        if (!isValid || isSaving) return;

        setIsSaving(true);
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
                teacher_civic_notified: true,
                teacher_civic_notified_at: now,
                teacher_civic_notified_by: userId,
                teacher_civic_decision: 'no',
                teacher_civic_reason: noCivicReason,
                teacher_civic_reason_detail: noCivicReason === 'Otro' ? otherReason : null,
                teacher_civic_decision_at: now,
                teacher_civic_decision_by: userId
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

            setTeacherReady(true);
            setCivicDecision('no');
            setShowNoCivicModal(false);
            setToastMessage('Listo. Se registró: No habrá acto cívico.');

            setTimeout(() => {
                onRefresh && onRefresh();
            }, 250);
        } catch (error) {
            console.error('Error registering no civic decision:', error);
            alert('No se pudo registrar. Intenta de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    const firstName = profile?.full_name?.split(' ')[0] || 'Docente';
    const roleName = ROLE_LABELS[profile?.role] || 'Docente';
    const chipText = teacherReady ? 'En espera del auxiliar' : 'Te esperan';
    const noCivicOtherTrimmed = noCivicOtherReason.trim();
    const canSubmitNoCivic = Boolean(noCivicReason) && (noCivicReason !== 'Otro' || noCivicOtherTrimmed.length > 0);

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
                alignItems: 'center', justifyContent: 'center',
                padding: '16px 24px 0'
            }}>
                {/* Illustration */}
                <div style={{ marginBottom: 12 }}>
                    <CivicIllustration />
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: 22, fontWeight: 700, color: '#1F2937',
                    letterSpacing: '-0.02em', lineHeight: 1.2,
                    marginBottom: 8, textAlign: 'center'
                }}>
                    Notificar Acto Cívico
                </h2>

                {/* Description */}
                <p style={{
                    fontSize: 14, color: '#6B7280', lineHeight: 1.5,
                    textAlign: 'center', maxWidth: 300, margin: '0 0 16px',
                    fontWeight: 400
                }}>
                    Avisa que el equipo está listo para comenzar. Esta acción notificará a todos los participantes.
                </p>

                {/* Info Card */}
                <div style={{
                    width: '100%', maxWidth: 380,
                    backgroundColor: 'white',
                    borderRadius: 14,
                    padding: '12px 14px',
                    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                    border: '1px solid #F3F4F6',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: '#EFF6FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 20, color: '#2563EB',
                            fontVariationSettings: "'FILL' 0, 'wght' 400"
                        }}>info</span>
                    </div>
                    <div>
                        <h3 style={{
                            margin: 0, fontSize: 13, fontWeight: 600, color: '#1F2937'
                        }}>Protocolo Escolar</h3>
                        <p style={{
                            margin: '2px 0 0', fontSize: 12, color: '#6B7280', lineHeight: 1.4
                        }}>Verifica que el director esté presente antes de notificar.</p>
                    </div>
                </div>
            </main>

            {/* ─── Sticky Bottom CTA ─── */}
            <div style={{
                position: 'sticky', bottom: 0, left: 0, right: 0,
                zIndex: 40,
                padding: '16px 24px 20px',
                backgroundColor: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderTop: '1px solid #E5E7EB',
                borderRadius: '24px 24px 0 0'
            }}>
                <div style={{ maxWidth: 380, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Primary CTA */}
                    <button
                        onClick={handleNotifyCivic}
                        disabled={isSaving || teacherReady}
                        style={{
                            width: '100%', padding: '16px',
                            backgroundColor: '#2563EB', color: 'white',
                            borderRadius: 14, border: 'none',
                            fontSize: 16, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8,
                            cursor: (isSaving || teacherReady) ? 'default' : 'pointer',
                            opacity: teacherReady ? 0.6 : 1,
                            boxShadow: '0 10px 25px -5px rgba(37,99,235,0.3)',
                            transition: 'opacity 0.2s, transform 0.15s',
                        }}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : (
                            <span className="material-symbols-outlined" style={{
                                fontSize: 18,
                                fontVariationSettings: "'FILL' 0, 'wght' 500"
                            }}>notifications_active</span>
                        )}
                        Acto cívico notificado
                    </button>

                    {/* Secondary CTA */}
                    <button
                        onClick={handleOpenNoCivicModal}
                        disabled={isSaving || teacherReady}
                        style={{
                            width: '100%', padding: '14px',
                            backgroundColor: 'transparent', color: '#6B7280',
                            borderRadius: 14,
                            border: '2px solid #E5E7EB',
                            fontSize: 14, fontWeight: 500,
                            cursor: (isSaving || teacherReady) ? 'default' : 'pointer',
                            opacity: teacherReady ? 0.55 : 1,
                            transition: 'opacity 0.2s, border-color 0.2s',
                        }}
                    >
                        ¿No habrá acto cívico?
                    </button>

                    {/* Info line */}
                    <div style={{
                        marginTop: 4, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 6
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 14, color: '#9CA3AF',
                            fontVariationSettings: "'FILL' 1, 'wght' 400"
                        }}>verified_user</span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {teacherReady
                                ? (civicDecision === 'no' ? 'Registro guardado. Continuando con la operación.' : 'Esperando confirmación del Auxiliar.')
                                : 'No cierres la app (los datos se guardan)'}
                        </span>
                    </div>

                    {/* Bottom bar */}
                    <div style={{
                        marginTop: 6, display: 'flex', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '33%', maxWidth: 128, height: 4,
                            backgroundColor: '#D1D5DB', borderRadius: 999
                        }} />
                    </div>
                </div>
            </div>

            {/* ─── No Civic Modal (UNTOUCHED LOGIC) ─── */}
            {showNoCivicModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 120,
                        backgroundColor: 'rgba(2, 6, 23, 0.62)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: 14
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 520,
                            borderRadius: 22,
                            backgroundColor: 'white',
                            color: '#0f172a',
                            padding: 16,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 20px 42px -22px rgba(15,23,42,0.5)'
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                            No habrá acto cívico
                        </h3>
                        <p style={{ marginTop: 8, marginBottom: 12, fontSize: 14, color: '#475569', lineHeight: 1.45 }}>
                            Registra el motivo. Esto desactiva &apos;Iniciar acto cívico&apos; hoy.
                        </p>

                        <div style={{ display: 'grid', gap: 8 }}>
                            {NO_CIVIC_REASONS.map((reason) => {
                                const selected = noCivicReason === reason;
                                return (
                                    <button
                                        key={reason}
                                        onClick={() => {
                                            setNoCivicReason(reason);
                                            if (reason !== 'Otro') setNoCivicOtherReason('');
                                        }}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            borderRadius: 12,
                                            border: selected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                            backgroundColor: selected ? '#eff6ff' : 'white',
                                            color: '#0f172a',
                                            fontWeight: selected ? 800 : 700,
                                            fontSize: 14,
                                            padding: '12px 14px'
                                        }}
                                    >
                                        {reason}
                                    </button>
                                );
                            })}
                        </div>

                        {noCivicReason === 'Otro' && (
                            <div style={{ marginTop: 12 }}>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                                    Especifica la razón
                                </label>
                                <textarea
                                    value={noCivicOtherReason}
                                    onChange={(event) => setNoCivicOtherReason(event.target.value)}
                                    placeholder="Ej: Hoy hubo evaluación general."
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        borderRadius: 12,
                                        border: '1px solid #cbd5e1',
                                        padding: '10px 12px',
                                        fontSize: 14,
                                        color: '#0f172a',
                                        resize: 'none',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        )}

                        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => setShowNoCivicModal(false)}
                                disabled={isSaving}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 12,
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: 'white',
                                    color: '#334155',
                                    fontSize: 14,
                                    fontWeight: 700
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegisterNoCivic}
                                disabled={!canSubmitNoCivic || isSaving}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 12,
                                    border: 'none',
                                    backgroundColor: '#0f172a',
                                    color: 'white',
                                    fontSize: 14,
                                    fontWeight: 800,
                                    opacity: !canSubmitNoCivic || isSaving ? 0.55 : 1
                                }}
                            >
                                {isSaving ? 'Guardando...' : 'Registrar y continuar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Toast (UNTOUCHED) ─── */}
            {toastMessage && (
                <div
                    style={{
                        position: 'fixed',
                        left: '50%',
                        bottom: 22,
                        transform: 'translateX(-50%)',
                        zIndex: 130,
                        backgroundColor: '#0f172a',
                        color: 'white',
                        borderRadius: 999,
                        padding: '10px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        boxShadow: '0 12px 26px -14px rgba(15,23,42,0.55)'
                    }}
                >
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
