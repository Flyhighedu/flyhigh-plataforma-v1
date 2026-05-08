'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ═══════════════════════════════════════════════════════════════
// PerformanceReportModal — "Tu Reporte de Hoy"
//
// Receives pre-fetched report data as a prop (no internal fetch).
// The parent (CheckoutScreen) handles the silent background fetch
// so this modal opens INSTANTLY with data already available.
//
// Features:
//   • Typewriter animation for AI narrative
//   • Haptic feedback on dismiss
//   • Score ring with glow
//   • Conditional "Ir a Academia" CTA
//
// SAFETY: 100% non-blocking. Never blocks checkout.
// ═══════════════════════════════════════════════════════════════

// ── Score theming ──

function getScoreTheme(score) {
    if (score >= 90) return { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', glow: 'rgba(16,185,129,0.15)', emoji: '🏆' };
    if (score >= 75) return { color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)', glow: 'rgba(14,165,233,0.15)', emoji: '🎖️' };
    if (score >= 60) return { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', glow: 'rgba(245,158,11,0.15)', emoji: '💪' };
    if (score >= 40) return { color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', glow: 'rgba(249,115,22,0.15)', emoji: '📈' };
    return { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', glow: 'rgba(239,68,68,0.15)', emoji: '⚠️' };
}

function getRoleLabel(role) {
    if (role === 'pilot') return 'Piloto';
    if (role === 'teacher') return 'Docente';
    return 'Operativo';
}

// ── Typewriter hook ──
function useTypewriter(text, speed = 18) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    const indexRef = useRef(0);

    useEffect(() => {
        if (!text) return;
        setDisplayed('');
        setDone(false);
        indexRef.current = 0;

        const interval = setInterval(() => {
            indexRef.current += 1;
            setDisplayed(text.slice(0, indexRef.current));
            if (indexRef.current >= text.length) {
                clearInterval(interval);
                setDone(true);
            }
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed]);

    const skip = () => {
        setDisplayed(text);
        setDone(true);
    };

    return { displayed, done, skip };
}

export default function PerformanceReportModal({ isOpen, onClose, report, role, actorName }) {
    const router = useRouter();
    const { displayed: typedNarrative, done: typingDone, skip: skipTyping } = useTypewriter(
        isOpen ? report?.narrative || '' : '', 18
    );

    // ── Don't render if not open or no data ──
    if (!isOpen || !report) return null;

    const theme = getScoreTheme(report.score);
    const roleLabel = getRoleLabel(role);

    const handleDismiss = () => {
        // Haptic feedback on mobile
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(10);
        }
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleDismiss}
            style={{ animation: 'prm_fadeIn 0.3s ease-out' }}
        >
            <div
                className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-[430px] max-h-[92vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'prm_slideUp 0.45s cubic-bezier(0.16,1,0.3,1)' }}
            >
                {/* ── Close button (always visible) ── */}
                <div className="sticky top-0 z-10 flex justify-end p-3 pb-0 bg-white/80 backdrop-blur-sm rounded-t-3xl">
                    <button
                        onClick={handleDismiss}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 text-sm font-bold transition-colors"
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 pb-8 -mt-2">
                    {/* ── Header: Score medallion ── */}
                    <div className="text-center mb-6">
                        <div
                            className="text-4xl mb-2"
                            style={{
                                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))',
                                animation: 'prm_popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both'
                            }}
                        >
                            {theme.emoji}
                        </div>
                        <p
                            className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-1"
                            style={{ animation: 'prm_fadeSlideUp 0.4s ease-out 0.3s both' }}
                        >
                            Tu Reporte de Hoy
                        </p>
                        <p
                            className="text-lg font-black text-slate-900"
                            style={{ animation: 'prm_fadeSlideUp 0.4s ease-out 0.35s both' }}
                        >
                            {actorName}
                        </p>
                        <p
                            className="text-[11px] font-bold text-slate-500"
                            style={{ animation: 'prm_fadeSlideUp 0.4s ease-out 0.4s both' }}
                        >
                            {roleLabel} • {report.flightCount} {report.flightCount === 1 ? 'vuelo evaluado' : 'vuelos evaluados'}
                        </p>

                        {/* Score ring with entrance animation */}
                        <div
                            className="mx-auto mt-5 w-[100px] h-[100px] rounded-full flex items-center justify-center border-4 shadow-xl"
                            style={{
                                borderColor: theme.color,
                                background: theme.bg,
                                boxShadow: `0 0 40px -5px ${theme.glow}, 0 8px 24px -8px ${theme.glow}`,
                                animation: 'prm_scaleIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s both'
                            }}
                        >
                            <div className="text-center">
                                <span className="text-[32px] font-black tabular-nums leading-none" style={{ color: theme.color }}>
                                    {report.score}
                                </span>
                                <span className="text-[11px] font-bold text-slate-400 block -mt-0.5">/100</span>
                            </div>
                        </div>
                        <p
                            className="mt-2.5 text-sm font-extrabold"
                            style={{ color: theme.color, animation: 'prm_fadeSlideUp 0.4s ease-out 0.7s both' }}
                        >
                            {report.grade}
                        </p>
                    </div>

                    {/* ── AI Narrative with typewriter ── */}
                    <div className="mb-5" style={{ animation: 'prm_fadeSlideUp 0.4s ease-out 0.85s both' }}>
                        <div className="flex items-center gap-2 mb-2.5">
                            <span className="text-sm">🤖</span>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-500 m-0">
                                Tu evaluación de hoy
                            </p>
                        </div>
                        <div
                            className="rounded-2xl border p-4 cursor-pointer"
                            style={{
                                borderColor: 'rgba(99,102,241,0.15)',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04))'
                            }}
                            onClick={!typingDone ? skipTyping : undefined}
                            title={!typingDone ? 'Toca para ver completo' : ''}
                        >
                            <p className="text-[13px] text-slate-700 font-medium leading-[1.75] m-0">
                                {typedNarrative}
                                {!typingDone && (
                                    <span
                                        className="inline-block w-[2px] h-[14px] bg-indigo-400 ml-0.5 align-middle"
                                        style={{ animation: 'prm_blink 0.8s infinite' }}
                                    />
                                )}
                            </p>
                            {!typingDone && (
                                <p className="text-[10px] text-slate-400 font-medium mt-2 m-0 text-right">
                                    Toca para ver completo →
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Academia CTA (only for pilots who need it) ── */}
                    {report.needsAcademia && typingDone && (
                        <div className="mb-4" style={{ animation: 'prm_fadeSlideUp 0.4s ease-out' }}>
                            <button
                                onClick={() => {
                                    if (navigator.vibrate) navigator.vibrate(10);
                                    onClose();
                                    router.push('/staff/academia');
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-extrabold text-[13px] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98] transition-all"
                            >
                                <span className="text-base">📚</span>
                                Ir a la Academia
                            </button>
                            <p className="text-center text-[10px] text-slate-400 font-medium mt-1.5">
                                Estudia los puntos de interés antes de tu próxima misión
                            </p>
                        </div>
                    )}

                    {/* ── Energy badge ── */}
                    {report.energyLabel && report.energyLabel !== 'no disponible' && typingDone && (
                        <div
                            className="flex items-center justify-center gap-2 mb-5"
                            style={{ animation: 'prm_fadeSlideUp 0.3s ease-out' }}
                        >
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Energía vocal</span>
                            <span
                                className="text-[11px] font-extrabold px-3 py-1 rounded-full"
                                style={{
                                    color: report.energyLabel === 'alta' ? '#10B981' : report.energyLabel === 'media' ? '#F59E0B' : '#EF4444',
                                    background: report.energyLabel === 'alta' ? 'rgba(16,185,129,0.1)' : report.energyLabel === 'media' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
                                }}
                            >
                                ⚡ {report.energyLabel === 'alta' ? 'Alta' : report.energyLabel === 'media' ? 'Media' : 'Baja'}
                            </span>
                        </div>
                    )}

                    {/* ── CTA: Dismiss ── */}
                    {typingDone && (
                        <button
                            onClick={handleDismiss}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 text-white font-extrabold text-sm shadow-lg shadow-slate-800/20 hover:shadow-slate-800/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            style={{ animation: 'prm_fadeSlideUp 0.4s ease-out' }}
                        >
                            ✓ Entendido, gracias
                        </button>
                    )}
                </div>
            </div>

            {/* ── Animations ── */}
            <style jsx>{`
                @keyframes prm_fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes prm_slideUp {
                    from { opacity: 0; transform: translateY(60px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes prm_fadeSlideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes prm_popIn {
                    from { opacity: 0; transform: scale(0.5); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes prm_scaleIn {
                    from { opacity: 0; transform: scale(0.6); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes prm_blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}
