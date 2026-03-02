'use client';

import { useEffect } from 'react';

// =====================================================
// DependencyTransitionOverlay
// Full-screen premium overlay for external dependency
// transitions. Includes haptic + short success sound.
// =====================================================

/**
 * Play a short success tick via Web Audio API.
 */
function playSuccessSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.close();
            return;
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.06);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        osc.onended = () => ctx.close();
    } catch (error) {
        // Silent fail by design.
    }
}

/**
 * Single short haptic pulse.
 */
function triggerHaptic() {
    try {
        if (navigator.vibrate) {
            navigator.vibrate(80);
        }
    } catch (error) {
        // Silent fail by design.
    }
}

export default function DependencyTransitionOverlay({ overlayData }) {
    useEffect(() => {
        if (!overlayData) return;
        playSuccessSound();
        triggerHaptic();
    }, [overlayData]);

    if (!overlayData) return null;

    const hasCustomHeadline = String(overlayData.headlineText || '').trim().length > 0;
    const hasCustomNextAction = String(overlayData.nextActionText || '').trim().length > 0;

    const titleLine = overlayData.triggerName
        ? `${overlayData.triggerName} (${overlayData.triggerRole}) ${overlayData.actionText}`
        : `${overlayData.triggerRole} ${overlayData.actionText}`;

    const subtitleLine = hasCustomNextAction
        ? `Ya puedes continuar con ${overlayData.nextActionText}.`
        : `Ya puedes continuar con ${overlayData.nextPhaseText}.`;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                pointerEvents: 'auto',
                animation: 'dtoOverlayIn 220ms ease-out both'
            }}
            aria-live="assertive"
            role="status"
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '0 32px',
                    maxWidth: 380,
                    animation: 'dtoCardIn 240ms cubic-bezier(0.22, 1, 0.36, 1) both'
                }}
            >
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 20,
                        boxShadow: '0 10px 34px rgba(37, 99, 235, 0.35)',
                        animation: 'dtoPulse 0.62s ease-out'
                    }}
                >
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ animation: 'dtoCheck 0.4s ease-out 0.12s both' }}
                    >
                        <path d="M5 12l5 5L20 7" />
                    </svg>
                </div>

                <h1
                    style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: '#0f172a',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                        margin: '0 0 12px',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                    }}
                >
                    Listo ✅
                </h1>

                <p
                    style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#334155',
                        lineHeight: 1.5,
                        margin: '0 0 6px',
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                    }}
                >
                    {hasCustomHeadline ? overlayData.headlineText : titleLine}
                </p>

                <p
                    style={{
                        fontSize: 15,
                        fontWeight: 400,
                        color: '#64748b',
                        lineHeight: 1.5,
                        margin: 0,
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                    }}
                >
                    {subtitleLine}
                </p>

                {overlayData.hasEvidence && (
                    <div
                        style={{
                            marginTop: 16,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 14px',
                            borderRadius: 20,
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#1d4ed8',
                            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
                        }}
                    >
                        <span>📎</span>
                        Evidencia registrada ✅
                    </div>
                )}
            </div>

            <style>{`
                @keyframes dtoOverlayIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes dtoCardIn {
                    0% { transform: scale(0.965); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes dtoPulse {
                    0% { transform: scale(0.6); opacity: 0; }
                    50% { transform: scale(1.08); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes dtoCheck {
                    0% { stroke-dasharray: 30; stroke-dashoffset: 30; }
                    100% { stroke-dasharray: 30; stroke-dashoffset: 0; }
                }
            `}</style>
        </div>
    );
}
