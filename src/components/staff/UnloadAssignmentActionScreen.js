'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, ChevronRight, Loader2, Mic, DoorOpen, Truck, ArrowRight, Play, Pause, Trash2 } from 'lucide-react';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import useVoiceRecorder from '@/hooks/useVoiceRecorder';

export default function UnloadAssignmentActionScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const [selectedOption, setSelectedOption] = useState(null); // 'inside' | 'outside'
    const [unloadNote, setUnloadNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const firstName = profile?.full_name?.split(' ')[0] || 'Docente';
    const roleName = ROLE_LABELS[profile?.role] || 'Docente';

    // Voice recorder
    const {
        isRecording, isProcessing, hasRecording, audioBlob, audioUrl, duration,
        error: micError, startRecording, stopRecording, reset: resetVoice
    } = useVoiceRecorder();

    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ctaNotice, setCtaNotice] = useState('');

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) { audioRef.current.pause(); }
        else { audioRef.current.play(); }
        setIsPlaying(!isPlaying);
    };

    // Reset playing state when audio ends
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const onEnd = () => setIsPlaying(false);
        el.addEventListener('ended', onEnd);
        return () => el.removeEventListener('ended', onEnd);
    }, [audioUrl]);

    useEffect(() => {
        if (!ctaNotice) return;

        const timer = setTimeout(() => {
            setCtaNotice('');
        }, 2400);

        return () => clearTimeout(timer);
    }, [ctaNotice]);

    const fmtSec = (s) => {
        const m = Math.floor(s / 60);
        const ss = String(s % 60).padStart(2, '0');
        return `${m}:${ss}`;
    };

    const handleConfirm = async () => {
        if (!selectedOption) return;

        if (isRecording) {
            setCtaNotice('Termina la grabacion de audio antes de confirmar.');
            return;
        }

        if (isProcessing) {
            setCtaNotice('Espera un momento, estamos cerrando la grabacion de audio.');
            return;
        }

        setCtaNotice('');
        setIsSaving(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            // Upload voice note if exists
            let voiceUrl = null;
            let voiceDuration = null;
            if (audioBlob) {
                const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
                const filename = `voice_${journeyId}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('staff-arrival')
                    .upload(filename, audioBlob, { contentType: audioBlob.type });
                if (uploadError) throw uploadError;
                voiceUrl = supabase.storage.from('staff-arrival').getPublicUrl(filename).data.publicUrl;
                voiceDuration = duration;
            }

            const { data: currentData } = await supabase
                .from('staff_journeys')
                .select('meta')
                .eq('id', journeyId)
                .single();

            const currentMeta = currentData?.meta || {};

            const newMeta = {
                ...currentMeta,
                unload_access: selectedOption,
                unload_note: unloadNote || null,
                unload_assigned_by: userId,
                unload_assigned_at: now,
                ...(voiceUrl && { unload_voice_url: voiceUrl, unload_voice_duration: voiceDuration }),
            };

            const { error } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'waiting_dropzone',
                    meta: newMeta,
                    updated_at: now
                })
                .eq('id', journeyId);

            if (error) throw error;
            console.log('Unload assignment saved:', newMeta);
        } catch (e) {
            console.error('Error saving assignment:', e);
            alert('Error al guardar. Intenta de nuevo.');
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#F3F6F8',
            color: '#1e293b', minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={firstName}
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
                display: 'flex', flexDirection: 'column',
                padding: '8px 24px 24px',
                alignItems: 'center',
                overflowY: 'auto'
            }}>
                <div style={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 16,
                    paddingBottom: 8,
                    width: '100%', maxWidth: 380
                }}>
                    {/* ── SVG Office Illustration ── */}
                    <div style={{
                        width: '100%', maxWidth: 260,
                        position: 'relative'
                    }}>
                        <div style={{
                            position: 'absolute', inset: 12,
                            background: 'linear-gradient(135deg, #DBEAFE 0%, #EEF2FF 100%)',
                            borderRadius: '50%', filter: 'blur(30px)', opacity: 0.6
                        }} />
                        <svg style={{ width: '100%', height: 'auto', position: 'relative', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.06))' }} fill="none" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="200" cy="150" r="130" fill="#EBF5FF" />
                            <ellipse cx="200" cy="240" rx="110" ry="12" fill="#CBD5E1" />
                            {/* Desk */}
                            <path d="M120 180 L280 180 L280 240 L120 240 Z" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
                            <path d="M120 180 L280 180 L270 160 L130 160 Z" fill="#E2E8F0" />
                            {/* Blue container on desk */}
                            <rect x="130" y="190" width="140" height="60" rx="4" fill="#3B82F6" />
                            <rect x="140" y="190" width="10" height="60" rx="4" fill="#60A5FA" />
                            {/* Monitor */}
                            <rect x="160" y="140" width="50" height="35" rx="2" fill="#1E293B" />
                            <path d="M180 175 L190 175 L192 180 L178 180 Z" fill="#475569" />
                            <rect x="163" y="143" width="44" height="28" rx="1" fill="#334155" />
                            {/* Papers */}
                            <rect x="220" y="165" width="20" height="15" rx="1" fill="#FFFFFF" transform="rotate(5 230 170)" />
                            <rect x="225" y="163" width="20" height="15" rx="1" fill="#F1F5F9" transform="rotate(-2 235 168)" />
                            {/* Plant */}
                            <path d="M310 240 C310 240 310 220 310 210" stroke="#166534" strokeLinecap="round" strokeWidth="3" />
                            <path d="M310 230 Q330 210 335 190 Q300 200 310 230 Z" fill="#22C55E" />
                            <path d="M310 220 Q290 200 285 180 Q320 190 310 220 Z" fill="#4ADE80" />
                            <path d="M310 240 L300 240 L302 215 L318 215 L320 240 Z" fill="#B45309" />
                            {/* DIRECCIÓN sign */}
                            <rect x="140" y="80" width="120" height="40" rx="4" fill="#1E293B" />
                            <rect x="143" y="83" width="114" height="34" rx="3" fill="#334155" />
                            <text x="200" y="105" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" letterSpacing="1">DIRECCIÓN</text>
                            {/* Sign poles */}
                            <line x1="160" y1="60" x2="160" y2="80" stroke="#94A3B8" strokeWidth="2" />
                            <line x1="240" y1="60" x2="240" y2="80" stroke="#94A3B8" strokeWidth="2" />
                            {/* Person */}
                            <circle cx="215" cy="135" r="14" fill="#FCA5A5" />
                            <path d="M215 135 Q225 125 225 140 L228 150 L202 150 L205 140 Q205 125 215 135" fill="#1E293B" />
                            <path d="M200 150 Q215 180 230 150 L230 165 L200 165 Z" fill="#3B82F6" />
                        </svg>
                    </div>

                    {/* ── Text block ── */}
                    <div style={{ textAlign: 'center', maxWidth: 320 }}>
                        <h2 style={{
                            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                            lineHeight: 1.2, marginBottom: 4, color: '#1e293b'
                        }}>
                            Ir a Dirección
                        </h2>
                        <p style={{
                            fontSize: 14, color: '#64748b',
                            lineHeight: 1.5, fontWeight: 400, margin: 0
                        }}>
                            Confirma dónde haremos la descarga
                        </p>
                    </div>

                    {/* ── Access option pills ── */}
                    <p style={{
                        fontSize: 10, fontWeight: 600, color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        margin: '0 0 -8px', textAlign: 'center', width: '100%'
                    }}>
                        Selecciona el tipo de acceso
                    </p>
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                        <button
                            onClick={() => setSelectedOption('inside')}
                            style={{
                                flex: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '12px 14px',
                                backgroundColor: selectedOption === 'inside' ? '#2563EB' : 'white',
                                color: selectedOption === 'inside' ? 'white' : '#475569',
                                borderRadius: 999,
                                border: selectedOption === 'inside' ? '1px solid #2563EB' : '1px solid #e2e8f0',
                                fontSize: 13, fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: selectedOption === 'inside' ? '0 4px 12px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.04)'
                            }}
                        >
                            <DoorOpen size={18} style={{ flexShrink: 0 }} />
                            Acceso dentro
                        </button>
                        <button
                            onClick={() => setSelectedOption('outside')}
                            style={{
                                flex: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '12px 14px',
                                backgroundColor: selectedOption === 'outside' ? '#2563EB' : 'white',
                                color: selectedOption === 'outside' ? 'white' : '#475569',
                                borderRadius: 999,
                                border: selectedOption === 'outside' ? '1px solid #2563EB' : '1px solid #e2e8f0',
                                fontSize: 13, fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: selectedOption === 'outside' ? '0 4px 12px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.04)'
                            }}
                        >
                            <Truck size={18} style={{ flexShrink: 0 }} />
                            Descarga afuera
                        </button>
                    </div>

                    {/* ── White Note Card ── */}
                    <div style={{
                        width: '100%',
                        backgroundColor: 'white',
                        borderRadius: 20, padding: 16,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        border: '1px solid #e2e8f0',
                        display: 'flex', flexDirection: 'column', gap: 10
                    }}>
                        <p style={{
                            fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            color: '#2563EB', margin: 0
                        }}>
                            Nota para auxiliar
                        </p>

                        {/* Textarea with mic */}
                        <div style={{ position: 'relative' }}>
                            <textarea
                                value={unloadNote}
                                onChange={(e) => setUnloadNote(e.target.value)}
                                placeholder="Ej: Entra por la puerta lateral..."
                                maxLength={150}
                                style={{
                                    width: '100%',
                                    padding: '12px 48px 12px 14px',
                                    borderRadius: 14,
                                    border: 'none',
                                    backgroundColor: '#F1F5F9',
                                    color: '#1e293b',
                                    fontSize: 14,
                                    minHeight: 72,
                                    resize: 'none',
                                    outline: 'none',
                                    lineHeight: 1.5
                                }}
                            />
                            {/* Mic button */}
                            {!hasRecording && !isRecording && !isProcessing && (
                                <button
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        if (typeof e.currentTarget.setPointerCapture === 'function') {
                                            try {
                                                e.currentTarget.setPointerCapture(e.pointerId);
                                            } catch {
                                                // noop
                                            }
                                        }
                                        startRecording();
                                    }}
                                    onPointerUp={(e) => {
                                        e.preventDefault();
                                        stopRecording();
                                        if (typeof e.currentTarget.releasePointerCapture === 'function') {
                                            try {
                                                e.currentTarget.releasePointerCapture(e.pointerId);
                                            } catch {
                                                // noop
                                            }
                                        }
                                    }}
                                    onPointerLeave={(e) => { if (isRecording) stopRecording(); }}
                                    onPointerCancel={(e) => {
                                        e.preventDefault();
                                        if (isRecording) stopRecording();
                                    }}
                                    style={{
                                        position: 'absolute', bottom: 8, right: 8,
                                        width: 34, height: 34,
                                        borderRadius: '50%',
                                        backgroundColor: '#DBEAFE',
                                        border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title="Mantén presionado para grabar"
                                >
                                    <Mic size={16} color="#2563EB" />
                                </button>
                            )}
                        </div>

                        {/* Recording overlay */}
                        {isRecording && (
                            <div
                                onPointerUp={(e) => { e.preventDefault(); stopRecording(); }}
                                onPointerCancel={(e) => { e.preventDefault(); stopRecording(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '12px 16px',
                                    backgroundColor: '#FEE2E2',
                                    borderRadius: 14,
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    backgroundColor: '#EF4444',
                                    animation: 'pulse 1s ease-in-out infinite'
                                }} />
                                <span style={{ fontSize: 14, fontWeight: 700, flex: 1, color: '#991B1B' }}>
                                    Grabando… {fmtSec(duration)}
                                </span>
                                <span style={{ fontSize: 11, color: '#B91C1C' }}>Suelta para detener</span>
                            </div>
                        )}

                        {isProcessing && (
                            <div
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '12px 16px',
                                    backgroundColor: '#EFF6FF',
                                    borderRadius: 14
                                }}
                            >
                                <Loader2 className="animate-spin" size={16} color="#2563EB" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>
                                    Cerrando grabacion de audio...
                                </span>
                            </div>
                        )}

                        {/* Mini player */}
                        {hasRecording && audioUrl && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 12px',
                                backgroundColor: '#F1F5F9',
                                borderRadius: 14,
                                color: '#1e293b'
                            }}>
                                <audio ref={audioRef} src={audioUrl} preload="metadata" />
                                <button
                                    onClick={togglePlay}
                                    style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        backgroundColor: '#2563EB', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0
                                    }}
                                >
                                    {isPlaying ? <Pause size={16} color="white" /> : <Play size={16} color="white" style={{ marginLeft: 2 }} />}
                                </button>
                                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: '#334155' }}>
                                    Nota de voz · {fmtSec(duration)}
                                </span>
                                <button
                                    onClick={() => { setIsPlaying(false); resetVoice(); }}
                                    style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        backgroundColor: '#FEE2E2', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0
                                    }}
                                    title="Borrar nota de voz"
                                >
                                    <Trash2 size={14} color="#EF4444" />
                                </button>
                            </div>
                        )}

                        {/* Mic error */}
                        {micError && (
                            <p style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', margin: 0 }}>{micError}</p>
                        )}
                    </div>

                    {/* ── Dark CTA button ── */}
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedOption || isSaving}
                        style={{
                            width: '100%',
                            padding: '15px',
                            backgroundColor: (!selectedOption || isSaving) ? '#CBD5E1' : (isRecording || isProcessing) ? '#475569' : '#1e293b',
                            color: (!selectedOption || isSaving) ? '#94A3B8' : 'white',
                            borderRadius: 999,
                            border: 'none',
                            fontSize: 15, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: (!selectedOption || isSaving) ? 'none' : (isRecording || isProcessing) ? 'none' : '0 8px 20px -6px rgba(30,41,59,0.4)',
                            cursor: (!selectedOption || isSaving) ? 'default' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : (
                            <>
                                {isRecording
                                    ? 'Termina el audio para confirmar'
                                    : isProcessing
                                        ? 'Procesando audio...'
                                        : 'Listo, confirmar'}
                                {!isRecording && !isProcessing && <ArrowRight size={18} />}
                            </>
                        )}
                    </button>

                    {ctaNotice && (
                        <p style={{
                            margin: '-2px 4px 0',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#B45309',
                            textAlign: 'center'
                        }}>
                            {ctaNotice}
                        </p>
                    )}
                </div>
            </main>

            {/* Pulse animation for recording */}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
}
