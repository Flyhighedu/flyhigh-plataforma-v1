'use client';

// =====================================================
// EscuadronBriefingOverlay.js
// Inspirational modal that appears ONCE when the pilot
// enters Operation phase. Replaces the old full-screen
// checklist with a concise, assertive yet warm message
// about the pilot's narrative responsibility.
//
// SAFETY: This is a pure overlay. If it crashes, the
// TaskErrorBoundary catches it and the user can dismiss
// to see the normal FlightLogger panel underneath.
// =====================================================

import { useState, useCallback } from 'react';
import {
    ROLE_TO_ESCUADRON,
    META_KEYS,
    LOCAL_KEYS
} from '@/config/escuadronConfig';
import { atomicMetaUpdate } from '@/utils/metaHelpers';

export default function EscuadronBriefingOverlay({
    journeyId,
    profile,
    onComplete // called when this role's briefing is done
}) {
    const escuadronRole = ROLE_TO_ESCUADRON[profile?.role] || 'piloto';
    const [isSaving, setIsSaving] = useState(false);
    const firstName = profile?.full_name?.split(' ')[0] || 'Piloto';

    const handleConfirm = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);

        try {
            // Save to meta
            if (journeyId) {
                const metaKey = `${META_KEYS.BRIEFING_DONE_PREFIX}${escuadronRole}`;
                await atomicMetaUpdate(journeyId, {
                    [metaKey]: true,
                    [`${metaKey}_at`]: new Date().toISOString()
                });
            }

            // Save locally as fallback
            if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_KEYS.BRIEFING_DONE, 'true');
            }

            onComplete?.();
        } catch (err) {
            console.warn('⚠️ Escuadrón briefing save failed (non-blocking):', err);
            // Still allow proceeding even if save fails
            onComplete?.();
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, journeyId, escuadronRole, onComplete]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '24px 20px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            animation: 'escBriefFadeIn 0.3s ease-out'
        }}>
            {/* Backdrop */}
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.9)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: -1
            }} />

            {/* Modal Card */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 420,
                maxHeight: 'calc(100vh - 48px)',
                margin: 'auto',
                borderRadius: 24,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: '#0F172A',
                border: '1px solid rgba(255,255,255,0.08)',
                animation: 'escBriefSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}>
                {/* ── X Close Button ── */}
                <button
                    onClick={handleConfirm}
                    aria-label="Cerrar"
                    style={{
                        position: 'absolute', top: 12, right: 12, zIndex: 10,
                        width: 36, height: 36, borderRadius: 12,
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94A3B8', fontSize: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    ×
                </button>
                {/* ── Header ── */}
                <div style={{
                    padding: '32px 24px 24px',
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        <span style={{ fontSize: 28 }}>🎙️</span>
                    </div>

                    <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.08)',
                        padding: '4px 12px', borderRadius: 100,
                        marginBottom: 12
                    }}>
                        <span style={{
                            fontSize: 10, fontWeight: 700, color: '#94A3B8',
                            textTransform: 'uppercase', letterSpacing: '0.1em'
                        }}>
                            Piloto Narrador
                        </span>
                    </div>

                    <h2 style={{
                        fontSize: 22, fontWeight: 800, color: 'white',
                        margin: '0 0 8px', letterSpacing: '-0.01em', lineHeight: 1.2
                    }}>
                        {firstName}, tú controlas la emoción
                    </h2>
                    <p style={{
                        fontSize: 14, fontWeight: 500, color: '#94A3B8',
                        margin: 0, lineHeight: 1.4
                    }}>
                        Todo lo que sientan los niños depende de tu voz.
                    </p>
                </div>

                {/* ── Body Content (scrollable) ── */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    WebkitOverflowScrolling: 'touch'
                }}>
                    {/* Main inspirational message */}
                    <p style={{
                        fontSize: 14, fontWeight: 400, color: '#CBD5E1',
                        lineHeight: 1.6, margin: '0 0 24px',
                        textAlign: 'center'
                    }}>
                        Cada grupo que suba al simulador vivirá la experiencia que tú les narres. 
                        Tu energía convierte un vuelo en un momento inolvidable.
                    </p>

                    {/* Key points */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 12,
                        marginBottom: 28
                    }}>
                        {/* Point 1 */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 16, padding: '16px'
                        }}>
                            <span style={{ fontSize: 20 }}>🏷️</span>
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', margin: '0 0 2px' }}>
                                    Llámalos por su nombre de Escuadrón
                                </p>
                                <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                                    Verás el nombre del grupo en tu pantalla. Es la única forma de dirigirte a ellos.
                                </p>
                            </div>
                        </div>

                        {/* Point 2 */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 16, padding: '16px'
                        }}>
                            <span style={{ fontSize: 20 }}>🎧</span>
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', margin: '0 0 2px' }}>
                                    Tu narración es monitoreada
                                </p>
                                <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                                    Cada vuelo se escucha para asegurar una inmersión total. ¡Da lo mejor de ti!
                                </p>
                            </div>
                        </div>

                        {/* Point 3 */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 16, padding: '16px'
                        }}>
                            <span style={{ fontSize: 20 }}>📋</span>
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', margin: '0 0 2px' }}>
                                    Sigue el Plan de Vuelo
                                </p>
                                <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                                    La ruta y destinos aparecerán automáticamente desde la bitácora de la maestra.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        style={{
                            width: '100%',
                            padding: '16px 0',
                            borderRadius: 16,
                            border: 'none',
                            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                            color: 'white',
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: isSaving ? 'wait' : 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)',
                            flexShrink: 0
                        }}
                    >
                        {isSaving ? 'Iniciando...' : (
                            <>
                                <span>Entendido, ¡listo para volar!</span>
                                <span>🚀</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes escBriefFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes escBriefSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
