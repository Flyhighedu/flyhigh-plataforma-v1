'use client';

// =====================================================
// EscuadronDebriefModal.js
// Pre-closure debrief modal. Appears when the team
// presses "Operación Finalizada" — a quick reflection
// before entering the dismantling flow.
//
// SAFETY: Has a prominent "Omitir" button. If it crashes,
// the handleCloseDay() function proceeds normally.
// =====================================================

import { useState, useCallback, useMemo } from 'react';
import {
    ROLE_TO_ESCUADRON,
    ESCUADRON_ROLE_LABELS,
    ESCUADRON_ROLE_COLORS,
    META_KEYS,
    LOCAL_KEYS
} from '@/config/escuadronConfig';
import { atomicMetaUpdate } from '@/utils/metaHelpers';

const DEBRIEF_QUESTIONS = [
    {
        id: 'energy_level',
        text: '¿Cómo fue tu energía hoy?',
        options: [
            { value: 'high', emoji: '🔥', label: 'Alta todo el día' },
            { value: 'medium', emoji: '👍', label: 'Normal' },
            { value: 'low', emoji: '😓', label: 'Baja / cansado' }
        ]
    },
    {
        id: 'protocol_followed',
        text: '¿Seguiste el protocolo del Escuadrón?',
        options: [
            { value: 'fully', emoji: '✅', label: 'Completamente' },
            { value: 'partially', emoji: '🟡', label: 'Parcialmente' },
            { value: 'no', emoji: '❌', label: 'No pude hacerlo' }
        ]
    },
    {
        id: 'improvement',
        text: '¿Qué mejorarías para mañana?',
        type: 'text'
    }
];

export default function EscuadronDebriefModal({
    isOpen,
    onComplete,   // called when debrief is saved → then proceeds to handleCloseDay
    onSkip,       // called to skip → goes directly to handleCloseDay
    journeyId,
    profile
}) {
    const escuadronRole = ROLE_TO_ESCUADRON[profile?.role] || 'supervisor';
    const roleLabel = ESCUADRON_ROLE_LABELS[escuadronRole] || 'Operativo';
    const roleColors = ESCUADRON_ROLE_COLORS[escuadronRole] || { bg: '#2563EB', light: '#DBEAFE', text: '#1D4ED8' };

    const [answers, setAnswers] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const requiredAnswered = useMemo(() => {
        const selectQuestions = DEBRIEF_QUESTIONS.filter(q => q.type !== 'text');
        return selectQuestions.every(q => answers[q.id] !== undefined);
    }, [answers]);

    const handleOptionSelect = useCallback((questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    }, []);

    const handleTextChange = useCallback((questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    }, []);

    const handleSave = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);

        const debriefData = {
            role: escuadronRole,
            answers: { ...answers },
            timestamp: new Date().toISOString()
        };

        try {
            if (journeyId) {
                await atomicMetaUpdate(journeyId, {
                    [`${META_KEYS.DEBRIEF_DATA}_${escuadronRole}`]: debriefData,
                    [`${META_KEYS.DEBRIEF_DONE}_${escuadronRole}`]: true
                });
            }

            // Local backup
            try {
                const localKey = `flyhigh_escuadron_debrief_${journeyId || 'local'}`;
                const existing = JSON.parse(localStorage.getItem(localKey) || '{}');
                existing[escuadronRole] = debriefData;
                localStorage.setItem(localKey, JSON.stringify(existing));
            } catch (_e) { /* non-blocking */ }

            onComplete?.();
        } catch (err) {
            console.warn('⚠️ Debrief save failed:', err);
            // Even if save fails, allow proceeding to closure
            onComplete?.();
        } finally {
            setIsSaving(false);
        }
    }, [answers, escuadronRole, journeyId, isSaving, onComplete]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(15,23,42,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                background: 'white', borderRadius: 28,
                padding: '28px 22px',
                width: '100%', maxWidth: 400,
                maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 30px 60px -15px rgba(0,0,0,0.35)',
                animation: 'dbSlideIn 0.35s ease'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center', gap: 6,
                        background: roleColors.light,
                        padding: '6px 14px', borderRadius: 100,
                        marginBottom: 12
                    }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: roleColors.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {roleLabel}
                        </span>
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>
                        Debrief de Misión
                    </h2>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                        Reflexión rápida antes del cierre operativo.
                    </p>
                </div>

                {/* Questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {DEBRIEF_QUESTIONS.map((q) => (
                        <div key={q.id}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', margin: '0 0 10px' }}>
                                {q.text}
                            </p>

                            {q.type === 'text' ? (
                                <textarea
                                    value={answers[q.id] || ''}
                                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                                    placeholder="Escribe tu respuesta (opcional)..."
                                    maxLength={200}
                                    rows={2}
                                    style={{
                                        width: '100%', padding: '10px 14px',
                                        borderRadius: 14, border: '2px solid #E2E8F0',
                                        background: '#F8FAFC', fontSize: 14,
                                        fontWeight: 500, color: '#0F172A',
                                        outline: 'none', resize: 'none',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            ) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {q.options.map((opt) => {
                                        const isSelected = answers[q.id] === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleOptionSelect(q.id, opt.value)}
                                                style={{
                                                    flex: 1, display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', gap: 4,
                                                    padding: '12px 8px', borderRadius: 14,
                                                    border: `2px solid ${isSelected ? roleColors.bg : '#E2E8F0'}`,
                                                    background: isSelected ? `${roleColors.bg}12` : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700,
                                                    color: isSelected ? roleColors.text : '#64748B',
                                                    textAlign: 'center', lineHeight: 1.2
                                                }}>
                                                    {opt.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                        onClick={handleSave}
                        disabled={!requiredAnswered || isSaving}
                        style={{
                            width: '100%', padding: '14px 0', borderRadius: 16,
                            border: 'none',
                            background: requiredAnswered
                                ? `linear-gradient(135deg, ${roleColors.bg}, ${roleColors.text})`
                                : '#E2E8F0',
                            color: requiredAnswered ? 'white' : '#94A3B8',
                            fontSize: 15, fontWeight: 800,
                            cursor: requiredAnswered ? 'pointer' : 'not-allowed',
                            boxShadow: requiredAnswered ? `0 10px 24px -6px ${roleColors.bg}60` : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isSaving ? 'Guardando...' : 'Completar y cerrar operación'}
                    </button>

                    <button
                        onClick={onSkip}
                        disabled={isSaving}
                        style={{
                            width: '100%', padding: '10px 0', borderRadius: 12,
                            border: 'none', background: 'transparent',
                            color: '#94A3B8', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Omitir debrief
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes dbSlideIn {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
