'use client';

// =====================================================
// EmotionRatingModal.js
// Post-flight emotion rating for the Auxiliar (assistant).
// Appears after each flight landing before the next
// flight can begin.
//
// SAFETY: Has a "Skip" button. If the modal crashes,
// the try/catch in handleFlightComplete processes the
// flight normally without emotion data.
// =====================================================

import { useState, useCallback } from 'react';
import {
    EMOTION_LEVELS,
    COMPLIANCE_QUESTIONS,
    LOCAL_KEYS
} from '@/config/escuadronConfig';

export default function EmotionRatingModal({
    isOpen,
    onSubmit,  // called with { score, compliance, flightNumber }
    onSkip,    // called to skip without scoring
    flightNumber = 1,
    flightStudentCount = 0
}) {
    const [selectedScore, setSelectedScore] = useState(null);
    const [compliance, setCompliance] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const selectedLevel = EMOTION_LEVELS.find(l => l.score === selectedScore);

    const handleComplianceToggle = useCallback((questionId) => {
        setCompliance(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (selectedScore === null || isSaving) return;
        setIsSaving(true);

        const scoreData = {
            score: selectedScore,
            compliance: { ...compliance },
            flightNumber,
            studentCount: flightStudentCount,
            timestamp: new Date().toISOString()
        };

        try {
            // Save locally first (offline-first)
            try {
                const existing = JSON.parse(localStorage.getItem(LOCAL_KEYS.EMOTION_SCORES) || '[]');
                existing.push(scoreData);
                localStorage.setItem(LOCAL_KEYS.EMOTION_SCORES, JSON.stringify(existing));
            } catch { /* non-blocking */ }

            await onSubmit?.(scoreData);
        } catch (err) {
            console.warn('⚠️ EmotionRating submit failed:', err);
        } finally {
            // Reset state
            setSelectedScore(null);
            setCompliance({});
            setIsSaving(false);
        }
    }, [selectedScore, compliance, flightNumber, flightStudentCount, isSaving, onSubmit]);

    const handleSkip = useCallback(() => {
        setSelectedScore(null);
        setCompliance({});
        onSkip?.();
    }, [onSkip]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 85,
            background: 'rgba(15,23,42,0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                background: 'white', borderRadius: 28,
                padding: '28px 22px',
                width: '100%', maxWidth: 380,
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 30px 60px -15px rgba(0,0,0,0.35)',
                animation: 'emScaleIn 0.3s ease'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: '#D1FAE5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 12px'
                    }}>
                        <span style={{ fontSize: 24 }}>📊</span>
                    </div>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 2px' }}>
                        Emocionómetro
                    </p>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', margin: '0 0 4px' }}>
                        ¿Cómo estuvo el Vuelo #{flightNumber}?
                    </h2>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                        {flightStudentCount > 0 ? `${flightStudentCount} alumnos volaron` : 'Evalúa la emoción del grupo'}
                    </p>
                </div>

                {/* Emotion Scale */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: 8,
                    marginBottom: 20
                }}>
                    {EMOTION_LEVELS.map((level) => {
                        const isSelected = selectedScore === level.score;
                        return (
                            <button
                                key={level.score}
                                onClick={() => setSelectedScore(level.score)}
                                style={{
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: 4,
                                    padding: '10px 8px', borderRadius: 16,
                                    border: `2px solid ${isSelected ? level.color : 'transparent'}`,
                                    background: isSelected ? level.bg : '#F8FAFC',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                    minWidth: 54
                                }}
                            >
                                <span style={{
                                    fontSize: isSelected ? 32 : 24,
                                    transition: 'font-size 0.2s ease',
                                    filter: isSelected ? 'none' : 'grayscale(0.3)'
                                }}>
                                    {level.emoji}
                                </span>
                                <span style={{
                                    fontSize: 9, fontWeight: 800,
                                    color: isSelected ? level.color : '#94A3B8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    textAlign: 'center',
                                    lineHeight: 1.2
                                }}>
                                    {level.score}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Selected Label */}
                {selectedLevel && (
                    <div style={{
                        textAlign: 'center', marginBottom: 20,
                        padding: '8px 16px', borderRadius: 12,
                        background: selectedLevel.bg,
                        display: 'inline-flex',
                        alignItems: 'center', gap: 6,
                        margin: '0 auto 20px',
                        width: 'fit-content'
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: selectedLevel.color }}>
                            {selectedLevel.label}
                        </span>
                    </div>
                )}

                {/* Compliance Questions */}
                {selectedScore !== null && (
                    <div style={{
                        borderTop: '1px solid #F1F5F9',
                        paddingTop: 16, marginTop: 8
                    }}>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                            Verificación rápida
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {COMPLIANCE_QUESTIONS.map((q) => {
                                const isChecked = compliance[q.id] === true;
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => handleComplianceToggle(q.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 12px', borderRadius: 12,
                                            border: `1.5px solid ${isChecked ? '#22C55E' : '#E2E8F0'}`,
                                            background: isChecked ? '#F0FDF4' : 'white',
                                            cursor: 'pointer', textAlign: 'left',
                                            transition: 'all 0.15s ease',
                                            width: '100%'
                                        }}
                                    >
                                        <div style={{
                                            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                                            border: `2px solid ${isChecked ? '#22C55E' : '#CBD5E1'}`,
                                            background: isChecked ? '#22C55E' : 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.15s ease'
                                        }}>
                                            {isChecked && (
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>
                                            {q.icon} {q.text}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                        onClick={handleSubmit}
                        disabled={selectedScore === null || isSaving}
                        style={{
                            width: '100%', padding: '14px 0', borderRadius: 16,
                            border: 'none',
                            background: selectedScore !== null
                                ? 'linear-gradient(135deg, #059669, #047857)'
                                : '#E2E8F0',
                            color: selectedScore !== null ? 'white' : '#94A3B8',
                            fontSize: 15, fontWeight: 800,
                            cursor: selectedScore !== null ? 'pointer' : 'not-allowed',
                            boxShadow: selectedScore !== null ? '0 10px 24px -6px rgba(5,150,105,0.4)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isSaving ? 'Guardando...' : 'Registrar evaluación'}
                    </button>

                    <button
                        onClick={handleSkip}
                        style={{
                            width: '100%', padding: '10px 0', borderRadius: 12,
                            border: 'none', background: 'transparent',
                            color: '#94A3B8', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Omitir esta vez
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes emScaleIn {
                    from { transform: scale(0.92); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
