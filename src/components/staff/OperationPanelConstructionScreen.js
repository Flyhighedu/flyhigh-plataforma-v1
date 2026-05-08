'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { enqueueOptimisticUpload } from '@/utils/offlineSyncManager';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

/** Play a short 880Hz success beep via AudioContext */
function playSuccessBeep() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => ctx.close(), 300);
    } catch (_e) { /* non-critical */ }
}

const HOLD_DURATION_MS = 1000;
const COOLDOWN_MS = 2000;
const HAPTIC_PULSE_INTERVAL_MS = 150;
const TAG_AUTO_CLOSE_MS = 5000;

// SVG ring constants
const RING_RADIUS = 118;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const OPERATION_CONSTRUCTION_SVG = `
<svg viewBox="0 0 840 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Panel de operacion en construccion">
  <defs>
    <linearGradient id="opc-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EFF6FF" />
      <stop offset="100%" stop-color="#F8FAFC" />
    </linearGradient>
    <linearGradient id="opc-panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>
    <filter id="opc-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0F172A" flood-opacity="0.16" />
    </filter>
  </defs>

  <rect x="0" y="0" width="840" height="420" rx="28" fill="url(#opc-bg)" />

  <g opacity="0.28">
    <circle cx="120" cy="72" r="3" fill="#93C5FD" />
    <circle cx="154" cy="98" r="2" fill="#93C5FD" />
    <circle cx="690" cy="66" r="3" fill="#93C5FD" />
    <circle cx="724" cy="92" r="2" fill="#93C5FD" />
    <circle cx="96" cy="336" r="3" fill="#93C5FD" />
    <circle cx="742" cy="332" r="3" fill="#93C5FD" />
  </g>

  <rect x="110" y="88" width="620" height="244" rx="22" fill="url(#opc-panel)" stroke="#DBEAFE" stroke-width="2" filter="url(#opc-shadow)" />

  <rect x="142" y="122" width="556" height="144" rx="14" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="10 8" />

  <g transform="translate(208, 194)">
    <path d="M0 18 L42 0 L24 30 L48 28 L10 54 L20 32 Z" fill="#2563EB" />
  </g>

  <g transform="translate(340, 176)">
    <rect x="0" y="0" width="170" height="38" rx="10" fill="#FFFFFF" stroke="#BFDBFE" />
    <rect x="14" y="12" width="58" height="14" rx="7" fill="#DBEAFE" />
    <rect x="84" y="12" width="40" height="14" rx="7" fill="#E2E8F0" />
    <rect x="132" y="12" width="24" height="14" rx="7" fill="#E2E8F0" />
  </g>

  <g transform="translate(560, 158)">
    <circle cx="30" cy="30" r="30" fill="#DBEAFE" />
    <path d="M30 14 L34 18 L39 17 L40 23 L45 26 L42 31 L44 36 L39 39 L37 44 L31 43 L26 46 L22 41 L16 41 L16 35 L12 30 L16 26 L15 20 L20 18 L23 13 Z" fill="#1D4ED8" />
    <circle cx="30" cy="30" r="8" fill="#EFF6FF" />
  </g>

  <g transform="translate(156, 276)">
    <path d="M0 36 L18 0 L36 36 Z" fill="#F59E0B" />
    <rect x="12" y="16" width="12" height="6" fill="#FFFFFF" opacity="0.8" />
  </g>
  <g transform="translate(652, 276)">
    <path d="M0 36 L18 0 L36 36 Z" fill="#F59E0B" />
    <rect x="12" y="16" width="12" height="6" fill="#FFFFFF" opacity="0.8" />
  </g>

  <g>
    <rect x="304" y="284" width="232" height="10" rx="5" fill="#DBEAFE" />
    <rect x="324" y="304" width="192" height="8" rx="4" fill="#E2E8F0" />
  </g>
</svg>
`;

export default function OperationPanelConstructionScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const first = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';
    const roleNormalized = String(profile?.role || '').trim().toLowerCase();
    const isAuxiliar = roleNormalized === 'assistant' || roleNormalized === 'auxiliar';

    // ── Hold-to-Record state ──
    const [holdProgress, setHoldProgress] = useState(0); // 0 → 1
    const [isHolding, setIsHolding] = useState(false);
    const [justFired, setJustFired] = useState(false);     // success flash
    const [cooldown, setCooldown] = useState(false);        // post-fire lock

    // ── Tag Modal state ──
    const [showTagModal, setShowTagModal] = useState(false);
    const [tagText, setTagText] = useState('');

    const holdStartRef = useRef(null);
    const holdRafRef = useRef(null);
    const hapticIntervalRef = useRef(null);
    const cooldownTimerRef = useRef(null);
    const firedRef = useRef(false);
    const frozenTimestampRef = useRef(null);
    const tagAutoCloseRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
            if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
            if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
            if (tagAutoCloseRef.current) clearTimeout(tagAutoCloseRef.current);
        };
    }, []);

    // ── commitMarker: sends data using the FROZEN timestamp ──
    const commitMarker = useCallback(async (tag) => {
        // Close modal immediately
        setShowTagModal(false);
        if (tagAutoCloseRef.current) clearTimeout(tagAutoCloseRef.current);

        try {
            await enqueueOptimisticUpload({
                dbMutation: {
                    table: 'video_markers',
                    operation: 'insert',
                    data: {
                        journey_id: journeyId,
                        device_timestamp: frozenTimestampRef.current,
                        marker_type: 'Reacción Épica',
                        user_id: userId || null,
                        cct: missionInfo?.cct || null,
                        school_name_snapshot: missionInfo?.school_name || null,
                        tag: tag || null
                    }
                },
                label: 'Marcador: Reacción Épica'
            });

            setJustFired(true);
            setCooldown(true);

            toast.success(tag ? `¡Marcado: "${tag}"!` : '¡Reacción marcada!', {
                description: 'El momento ha sido guardado para la cápsula.',
                position: 'bottom-center'
            });

            cooldownTimerRef.current = setTimeout(() => {
                setCooldown(false);
                setJustFired(false);
                firedRef.current = false;
            }, COOLDOWN_MS);

        } catch (error) {
            console.error('Error al guardar marcador:', error);
            firedRef.current = false;
            toast.error('Error al guardar marcador', {
                description: 'Revisa tu conexión o intenta de nuevo.',
                position: 'bottom-center'
            });
        }
    }, [journeyId, userId, missionInfo]);

    // ── onHoldComplete: freezes timestamp, plays feedback, opens modal ──
    const onHoldComplete = useCallback(() => {
        if (firedRef.current) return;
        firedRef.current = true;

        // a) Freeze the timestamp at this exact instant
        frozenTimestampRef.current = new Date().toISOString();

        // b) Multisensory feedback
        playSuccessBeep();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        // c) Open tag modal + start 5s auto-close timer
        setTagText('');
        setShowTagModal(true);

        tagAutoCloseRef.current = setTimeout(() => {
            // Auto-save without tag
            commitMarker(null);
        }, TAG_AUTO_CLOSE_MS);
    }, [commitMarker]);

    const startHold = useCallback(() => {
        if (cooldown || firedRef.current) return;
        setIsHolding(true);
        setHoldProgress(0);
        holdStartRef.current = performance.now();

        // Haptic pulse loop
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
            hapticIntervalRef.current = setInterval(() => {
                navigator.vibrate(50);
            }, HAPTIC_PULSE_INTERVAL_MS);
        }

        // Animation frame loop
        const tick = () => {
            const elapsed = performance.now() - holdStartRef.current;
            const progress = Math.min(elapsed / HOLD_DURATION_MS, 1);
            setHoldProgress(progress);

            if (progress >= 1) {
                // ── HOLD COMPLETE ──
                if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
                setIsHolding(false);
                onHoldComplete();
                return;
            }
            holdRafRef.current = requestAnimationFrame(tick);
        };
        holdRafRef.current = requestAnimationFrame(tick);
    }, [cooldown, onHoldComplete]);

    const cancelHold = useCallback(() => {
        if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
        if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
        setIsHolding(false);
        if (!firedRef.current) setHoldProgress(0);
    }, []);

    // ── Cancel auto-close when user interacts with input ──
    const handleTagInputFocus = useCallback(() => {
        if (tagAutoCloseRef.current) {
            clearTimeout(tagAutoCloseRef.current);
            tagAutoCloseRef.current = null;
        }
    }, []);

    const handleTagSave = useCallback(() => {
        commitMarker(tagText.trim() || null);
    }, [commitMarker, tagText]);

    if (isAuxiliar) {
        const ringOffset = RING_CIRCUMFERENCE * (1 - holdProgress);
        const ringColor = justFired ? '#22C55E' : isHolding ? '#60A5FA' : 'rgba(59, 130, 246, 0.25)';
        const buttonLabel = justFired
            ? '✓ Marcado'
            : isHolding
                ? 'Mantén presionado...'
                : cooldown
                    ? 'Espera...'
                    : 'Mantén para marcar';

        return (
            <div style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                backgroundColor: '#020617',
                color: '#F8FAFC',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                WebkitFontSmoothing: 'antialiased',
                position: 'relative'
            }}>
                <SyncHeader
                avatarConfig={missionInfo?.profile?.avatar_config}
                    firstName={first}
                    roleName={roleName}
                    role={profile?.role}
                    journeyId={journeyId}
                    userId={userId}
                    missionInfo={missionInfo}
                    missionState={missionState}
                    onDemoStart={onRefresh}
                />

                <main style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px 22px 120px'
                }}>
                    
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <h2 style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            color: '#F8FAFC',
                            letterSpacing: '-0.02em',
                            margin: '0 0 8px 0'
                        }}>
                            Claqueta Digital
                        </h2>
                        <p style={{
                            color: '#94A3B8',
                            fontSize: '15px',
                            margin: 0
                        }}>
                            Mantén presionado 1 segundo para registrar el momento.
                        </p>
                    </div>

                    {/* Hold-to-Record Button with SVG Ring */}
                    <div style={{ position: 'relative', width: 250, height: 250 }}>
                        {/* SVG Progress Ring */}
                        <svg
                            width="250"
                            height="250"
                            viewBox="0 0 250 250"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                transform: 'rotate(-90deg)',
                                zIndex: 5
                            }}
                        >
                            {/* Background ring */}
                            <circle
                                cx="125"
                                cy="125"
                                r={RING_RADIUS}
                                fill="none"
                                stroke="rgba(59, 130, 246, 0.15)"
                                strokeWidth="6"
                            />
                            {/* Progress ring */}
                            <circle
                                cx="125"
                                cy="125"
                                r={RING_RADIUS}
                                fill="none"
                                stroke={ringColor}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={RING_CIRCUMFERENCE}
                                strokeDashoffset={ringOffset}
                                style={{
                                    transition: isHolding ? 'none' : 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease'
                                }}
                            />
                        </svg>

                        {/* Core Button */}
                        <motion.div
                            animate={justFired ? { scale: [1, 1.15, 1] } : {}}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 10
                            }}
                        >
                            <div
                                onPointerDown={startHold}
                                onPointerUp={cancelHold}
                                onPointerLeave={cancelHold}
                                onPointerCancel={cancelHold}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{
                                    width: '220px',
                                    height: '220px',
                                    borderRadius: '50%',
                                    border: justFired
                                        ? '4px solid rgba(34, 197, 94, 0.7)'
                                        : '4px solid rgba(59, 130, 246, 0.5)',
                                    background: justFired
                                        ? 'linear-gradient(135deg, #14532D 0%, #22C55E 100%)'
                                        : 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
                                    boxShadow: justFired
                                        ? '0 0 60px rgba(34, 197, 94, 0.5), inset 0 4px 12px rgba(255, 255, 255, 0.3)'
                                        : isHolding
                                            ? '0 0 60px rgba(59, 130, 246, 0.6), inset 0 4px 12px rgba(255, 255, 255, 0.4)'
                                            : '0 0 40px rgba(59, 130, 246, 0.4), inset 0 4px 12px rgba(255, 255, 255, 0.3)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    cursor: cooldown ? 'not-allowed' : 'pointer',
                                    color: '#FFFFFF',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    touchAction: 'none',
                                    opacity: cooldown && !justFired ? 0.6 : 1,
                                    transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease'
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: '52px',
                                        fontVariationSettings: "'FILL' 1",
                                        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                                    }}
                                    className="material-symbols-outlined"
                                >
                                    {justFired ? 'check_circle' : 'movie_creation'}
                                </span>
                                <span style={{
                                    fontWeight: 800,
                                    fontSize: '13px',
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    textAlign: 'center',
                                    padding: '0 14px',
                                    lineHeight: 1.3
                                }}>
                                    {buttonLabel}
                                </span>
                            </div>
                        </motion.div>
                    </div>

                    <div style={{
                        marginTop: 50,
                        padding: '12px 20px',
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        borderRadius: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        backdropFilter: 'blur(8px)'
                    }}>
                        <span className="material-symbols-outlined" style={{ color: '#3B82F6', fontSize: 20 }}>
                            offline_pin
                        </span>
                        <p style={{ margin: 0, color: '#94A3B8', fontSize: '13px', fontWeight: 500 }}>
                            Los marcadores se sincronizan offline automáticamente
                        </p>
                    </div>
                </main>

                {/* ── Tag Bottom Sheet Modal ── */}
                {showTagModal && (
                    <>
                        {/* Backdrop */}
                        <div
                            onClick={() => commitMarker(tagText.trim() || null)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                zIndex: 900,
                                backdropFilter: 'blur(4px)'
                            }}
                        />
                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                            style={{
                                position: 'fixed',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                zIndex: 910,
                                backgroundColor: '#0F172A',
                                borderTopLeftRadius: 24,
                                borderTopRightRadius: 24,
                                padding: '20px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
                                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            {/* Drag handle */}
                            <div style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: '#334155', margin: '0 auto 18px' }} />

                            <p style={{
                                margin: '0 0 14px',
                                fontSize: 15,
                                fontWeight: 700,
                                color: '#F1F5F9',
                                textAlign: 'center'
                            }}>
                                ¿Qué pasó en este momento?
                            </p>

                            <input
                                type="text"
                                value={tagText}
                                onChange={(e) => setTagText(e.target.value)}
                                onFocus={handleTagInputFocus}
                                placeholder="¿Qué pasó? (Ej. Vi mi casa!, Parque Nacional...)"
                                maxLength={60}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: '2px solid #334155',
                                    backgroundColor: '#1E293B',
                                    color: '#F8FAFC',
                                    fontSize: 15,
                                    fontWeight: 500,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    transition: 'border-color 0.2s ease'
                                }}
                                onFocusCapture={(e) => e.target.style.borderColor = '#3B82F6'}
                                onBlurCapture={(e) => e.target.style.borderColor = '#334155'}
                            />

                            <button
                                type="button"
                                onClick={handleTagSave}
                                style={{
                                    width: '100%',
                                    marginTop: 14,
                                    padding: '14px 16px',
                                    borderRadius: 14,
                                    border: 'none',
                                    backgroundColor: '#2563EB',
                                    color: '#FFFFFF',
                                    fontSize: 16,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                    boxShadow: '0 8px 20px -8px rgba(37, 99, 235, 0.5)',
                                    transition: 'background-color 0.2s ease'
                                }}
                            >
                                Guardar
                            </button>
                        </motion.div>
                    </>
                )}
            </div>
        );
    }

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
                avatarConfig={missionInfo?.profile?.avatar_config}
                firstName={first}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 22px 120px'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: 520,
                    borderRadius: 24,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 18px 36px -24px rgba(15, 23, 42, 0.42)',
                    padding: 18
                }}>
                    <div style={{
                        width: '100%',
                        borderRadius: 18,
                        overflow: 'hidden',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        marginBottom: 16
                    }}
                        dangerouslySetInnerHTML={{ __html: OPERATION_CONSTRUCTION_SVG }}
                    />

                    <h2 style={{
                        margin: '0 0 8px',
                        fontSize: 'clamp(24px, 5.8vw, 30px)',
                        lineHeight: 1.12,
                        letterSpacing: '-0.02em',
                        color: '#0F172A',
                        fontWeight: 800,
                        textAlign: 'center'
                    }}>
                        Tu panel de operacion sigue en construccion
                    </h2>

                    <p style={{
                        margin: '0 auto 8px',
                        maxWidth: 420,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: '#64748B',
                        textAlign: 'center'
                    }}>
                        Estamos terminando esta vista para tu rol en esta fase.
                    </p>

                    <div style={{
                        margin: '0 auto',
                        maxWidth: 420,
                        borderRadius: 14,
                        border: '1px solid #BFDBFE',
                        backgroundColor: '#EFF6FF',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 18,
                            color: '#1D4ED8',
                            fontVariationSettings: "'FILL' 1, 'wght' 500",
                            marginTop: 1
                        }}>
                            info
                        </span>
                        <p style={{
                            margin: 0,
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: '#1E3A8A',
                            fontWeight: 650
                        }}>
                            Por ahora, todo el registro operativo lo lleva el auxiliar.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
