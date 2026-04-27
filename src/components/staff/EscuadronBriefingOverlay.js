'use client';

// =====================================================
// EscuadronBriefingOverlay.js
// Full-screen overlay that appears ONCE when the team
// enters Operation phase. Each role confirms their
// Escuadrón de Vuelo checklist items.
//
// SAFETY: This is a pure overlay. If it crashes, the
// TaskErrorBoundary catches it and the user can dismiss
// to see the normal FlightLogger panel underneath.
// =====================================================

import { useState, useCallback } from 'react';
import {
    ROLE_TO_ESCUADRON,
    BRIEFING_ITEMS,
    ESCUADRON_ROLE_LABELS,
    ESCUADRON_ROLE_ICONS,
    ESCUADRON_ROLE_COLORS,
    META_KEYS,
    LOCAL_KEYS
} from '@/config/escuadronConfig';
import { atomicMetaUpdate } from '@/utils/metaHelpers';

export default function EscuadronBriefingOverlay({
    journeyId,
    profile,
    onComplete // called when this role's briefing is done
}) {
    const escuadronRole = ROLE_TO_ESCUADRON[profile?.role] || 'supervisor';
    const items = BRIEFING_ITEMS[escuadronRole] || [];
    const roleLabel = ESCUADRON_ROLE_LABELS[escuadronRole] || 'Operativo';
    const roleIcon = ESCUADRON_ROLE_ICONS[escuadronRole] || 'person';
    const roleColors = ESCUADRON_ROLE_COLORS[escuadronRole] || { bg: '#2563EB', light: '#DBEAFE', text: '#1D4ED8' };

    const [checkedItems, setCheckedItems] = useState(new Set());
    const [isSaving, setIsSaving] = useState(false);

    const allChecked = checkedItems.size === items.length;

    const toggleItem = useCallback((itemId) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!allChecked || isSaving) return;
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
    }, [allChecked, isSaving, journeyId, escuadronRole, onComplete]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch'
        }}>
            {/* Header */}
            <div style={{
                padding: '48px 24px 24px',
                textAlign: 'center'
            }}>
                {/* Role Badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: roleColors.bg,
                    padding: '8px 20px',
                    borderRadius: 100,
                    marginBottom: 20,
                    boxShadow: `0 8px 24px -4px ${roleColors.bg}66`
                }}>
                    <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 18, color: 'white', fontVariationSettings: "'FILL' 1" }}
                    >
                        {roleIcon}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'white', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {roleLabel}
                    </span>
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: 'white',
                    margin: '0 0 8px',
                    letterSpacing: '-0.02em'
                }}>
                    Briefing de Escuadrón
                </h1>
                <p style={{
                    fontSize: 14,
                    color: '#94A3B8',
                    margin: 0,
                    lineHeight: 1.5,
                    maxWidth: 320,
                    marginLeft: 'auto',
                    marginRight: 'auto'
                }}>
                    Confirma cada punto antes de iniciar la operación de vuelos.
                </p>
            </div>

            {/* Checklist */}
            <div style={{
                flex: 1,
                padding: '0 20px 24px',
                maxWidth: 420,
                margin: '0 auto',
                width: '100%'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map((item) => {
                        const isChecked = checkedItems.has(item.id);
                        return (
                            <button
                                key={item.id}
                                onClick={() => toggleItem(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    background: isChecked
                                        ? `${roleColors.bg}15`
                                        : 'rgba(255,255,255,0.05)',
                                    border: `2px solid ${isChecked ? roleColors.bg : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: 16,
                                    padding: '16px 18px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    transform: isChecked ? 'scale(1)' : 'scale(1)',
                                    width: '100%'
                                }}
                            >
                                {/* Checkbox */}
                                <div style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 10,
                                    border: `2px solid ${isChecked ? roleColors.bg : 'rgba(255,255,255,0.2)'}`,
                                    background: isChecked ? roleColors.bg : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all 0.2s ease'
                                }}>
                                    {isChecked && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>

                                {/* Emoji + Text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                                        <span style={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: isChecked ? 'white' : '#CBD5E1',
                                            lineHeight: 1.4,
                                            transition: 'color 0.2s ease'
                                        }}>
                                            {item.text}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Footer CTA */}
            <div style={{
                padding: '16px 20px 32px',
                maxWidth: 420,
                margin: '0 auto',
                width: '100%'
            }}>
                {/* Progress */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12
                }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>
                        {checkedItems.size} de {items.length} confirmados
                    </span>
                    <div style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.1)',
                        marginLeft: 12,
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            borderRadius: 2,
                            background: allChecked ? '#22C55E' : roleColors.bg,
                            width: `${items.length > 0 ? (checkedItems.size / items.length) * 100 : 0}%`,
                            transition: 'width 0.3s ease, background 0.3s ease'
                        }} />
                    </div>
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={!allChecked || isSaving}
                    style={{
                        width: '100%',
                        padding: '16px 0',
                        borderRadius: 16,
                        border: 'none',
                        background: allChecked
                            ? `linear-gradient(135deg, ${roleColors.bg}, ${roleColors.text})`
                            : 'rgba(255,255,255,0.08)',
                        color: allChecked ? 'white' : '#475569',
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: allChecked ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        boxShadow: allChecked ? `0 12px 28px -8px ${roleColors.bg}80` : 'none',
                        letterSpacing: '0.02em'
                    }}
                >
                    {isSaving ? 'Guardando...' : allChecked ? '¡Listo para volar! 🚀' : 'Confirma todos los puntos'}
                </button>
            </div>
        </div>
    );
}
