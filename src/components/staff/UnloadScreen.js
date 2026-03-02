'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';

/* ─── Inline Voice Player ─── */
function VoicePlayer({ url, duration }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const onEnd = () => setIsPlaying(false);
        el.addEventListener('ended', onEnd);
        return () => el.removeEventListener('ended', onEnd);
    }, [url]);

    const toggle = () => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play();
        setIsPlaying(!isPlaying);
    };

    const fmtSec = (s) => {
        if (!s && s !== 0) return '';
        const m = Math.floor(s / 60);
        const ss = String(Math.round(s) % 60).padStart(2, '0');
        return `${m}:${ss}`;
    };

    return (
        <div style={{
            marginTop: 10,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            backgroundColor: '#F1F5F9',
            borderRadius: 12
        }}>
            <audio ref={audioRef} src={url} preload="metadata" />
            <button
                onClick={toggle}
                style={{
                    width: 40, height: 40, borderRadius: '50%',
                    backgroundColor: '#2563EB', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0
                }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'white' }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                </span>
            </button>
            <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: 0 }}>Nota de voz</p>
                {duration != null && (
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{fmtSec(duration)}</p>
                )}
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563EB' }}>graphic_eq</span>
        </div>
    );
}

/* ─── Animated Unload Scene Illustration ─── */
export function TruckIllustration() {
    return (
        <div style={{
            width: '100%', maxWidth: 420,
            backgroundColor: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
            overflow: 'hidden'
        }}>
            <svg viewBox="0 0 1200 500" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: 'auto' }}>
                <defs>
                    <filter id="shadow-soft" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#94a3b8" floodOpacity="0.2" />
                    </filter>
                    <filter id="shadow-hard" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.15" />
                    </filter>
                </defs>

                {/* ── Background ── */}
                <rect x="0" y="0" width="1200" height="500" fill="#f8fafc" />

                {/* School silhouette */}
                <g opacity="0.6">
                    <rect x="500" y="100" width="400" height="250" rx="8" fill="#e2e8f0" />
                    <rect x="550" y="150" width="60" height="40" rx="4" fill="#cbd5e1" />
                    <rect x="650" y="150" width="60" height="40" rx="4" fill="#cbd5e1" />
                    <rect x="750" y="150" width="60" height="40" rx="4" fill="#cbd5e1" />
                    <rect x="630" y="70" width="140" height="30" rx="6" fill="#cbd5e1" />
                    <text x="700" y="90" fontFamily="sans-serif" fontWeight="bold" fontSize="16" fill="#64748b" textAnchor="middle" letterSpacing="2">ESCUELA</text>
                </g>

                {/* Ground */}
                <rect x="0" y="350" width="1200" height="150" fill="#f1f5f9" />
                <line x1="0" y1="350" x2="1200" y2="350" stroke="#cbd5e1" strokeWidth="6" />

                {/* ── Vehicle ── */}
                <g transform="translate(50, 160)">
                    <ellipse cx="160" cy="190" rx="140" ry="10" fill="#cbd5e1" />
                    <circle cx="90" cy="180" r="24" fill="#1e293b" />
                    <circle cx="90" cy="180" r="10" fill="#94a3b8" />
                    <circle cx="260" cy="180" r="24" fill="#1e293b" />
                    <circle cx="260" cy="180" r="10" fill="#94a3b8" />
                    <rect x="30" y="40" width="130" height="130" rx="8" fill="#64748b" />
                    <path d="M 160 30 L 300 30 Q 320 30 330 60 L 350 120 Q 360 140 360 180 L 160 180 Z" fill="#3b82f6" />
                    <path d="M 160 40 L 290 40 Q 305 40 315 65 L 330 110 L 160 110 Z" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="4" strokeLinejoin="round" />
                    <path d="M 20 20 L 160 20 L 160 180 L 20 180 Z" fill="none" stroke="#ffffff" strokeWidth="16" strokeLinejoin="round" filter="url(#shadow-soft)" />
                    <path d="M 20 20 L 160 20 L 160 180 L 20 180 Z" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinejoin="round" />
                </g>

                {/* ── Drone landing pad ── */}
                <ellipse cx="900" cy="380" rx="150" ry="40" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="4" strokeDasharray="15 10" />

                {/* Orange cones */}
                <g>
                    <g transform="translate(770, 350)">
                        <polygon points="-8,10 8,10 0,-15" fill="#ea580c" />
                        <polygon points="-5,-2 5,-2 3,-8 -3,-8" fill="#ffffff" />
                        <ellipse cx="0" cy="10" rx="12" ry="4" fill="#c2410c" opacity="0.5" />
                    </g>
                    <g transform="translate(1030, 350)">
                        <polygon points="-8,10 8,10 0,-15" fill="#ea580c" />
                        <polygon points="-5,-2 5,-2 3,-8 -3,-8" fill="#ffffff" />
                        <ellipse cx="0" cy="10" rx="12" ry="4" fill="#c2410c" opacity="0.5" />
                    </g>
                    <g transform="translate(730, 410)">
                        <polygon points="-12,15 12,15 0,-25" fill="#f97316" filter="url(#shadow-hard)" />
                        <polygon points="-8,-2 8,-2 5,-12 -5,-12" fill="#ffffff" />
                        <ellipse cx="0" cy="15" rx="18" ry="5" fill="#ea580c" />
                    </g>
                    <g transform="translate(1070, 410)">
                        <polygon points="-12,15 12,15 0,-25" fill="#f97316" filter="url(#shadow-hard)" />
                        <polygon points="-8,-2 8,-2 5,-12 -5,-12" fill="#ffffff" />
                        <ellipse cx="0" cy="15" rx="18" ry="5" fill="#ea580c" />
                    </g>
                </g>

                {/* ── Drone ── */}
                <g transform="translate(930, 360)" filter="url(#shadow-soft)">
                    <ellipse cx="0" cy="30" rx="35" ry="10" fill="#94a3b8" opacity="0.3" />
                    <line x1="-25" y1="25" x2="-15" y2="10" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
                    <line x1="25" y1="25" x2="15" y2="10" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
                    <line x1="-40" y1="0" x2="40" y2="0" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
                    <ellipse cx="-40" cy="-5" rx="25" ry="4" fill="#3b82f6" opacity="0.8" />
                    <ellipse cx="40" cy="-5" rx="25" ry="4" fill="#3b82f6" opacity="0.8" />
                    <rect x="-20" y="-10" width="40" height="20" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="3" />
                    <circle cx="0" cy="5" r="5" fill="#0f172a" />
                </g>

                {/* ── Pilot (with controller) ── */}
                <g transform="translate(830, 260)">
                    <ellipse cx="0" cy="120" rx="20" ry="6" fill="#94a3b8" opacity="0.4" />
                    <line x1="-10" y1="60" x2="-10" y2="120" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
                    <line x1="10" y1="60" x2="10" y2="120" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
                    <rect x="-22" y="5" width="44" height="65" rx="16" fill="#3b82f6" />
                    <circle cx="0" cy="-20" r="22" fill="#ffedd5" />
                    <path d="M -22 -20 A 22 22 0 0 1 22 -20 Z" fill="#1e3a8a" />
                    <line x1="-25" y1="-20" x2="5" y2="-20" stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" />
                    <circle cx="-10" cy="-10" r="3" fill="#0f172a" />
                    <circle cx="5" cy="-10" r="3" fill="#0f172a" />
                    <path d="M -8 -2 Q -1 -2 4 -2" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round">
                        <animate attributeName="d"
                            values="M -8 -2 Q -1 -2 4 -2; M -8 -2 Q -1 -2 4 -2; M -8 -4 Q -1 4 4 -4; M -8 -4 Q -1 4 4 -4"
                            keyTimes="0; 0.6; 0.65; 1" dur="6s" repeatCount="indefinite" />
                    </path>
                    <path d="M 15 20 L 25 40 L -5 45" fill="none" stroke="#2563eb" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="-20" y="35" width="25" height="15" rx="4" fill="#334155" />
                    <line x1="-15" y1="35" x2="-20" y2="20" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
                    <path d="M -15 20 L -20 40 L -10 42" fill="none" stroke="#2563eb" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                {/* ── Route guide ── */}
                <path d="M 250 380 L 760 380" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" strokeDasharray="15 15" />
                <path d="M 250 380 L 760 380" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100">
                    <animate attributeName="stroke-dashoffset" values="100; 100; 0; 0; 100" keyTimes="0; 0.1; 0.6; 0.95; 1" dur="6s" repeatCount="indefinite" />
                </path>

                {/* ── Walking operative ── */}
                <g>
                    <animateTransform attributeName="transform" type="translate"
                        values="180,260; 180,260; 700,260; 700,260; 180,260"
                        keyTimes="0; 0.15; 0.6; 0.9; 1"
                        dur="6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0; 1; 1; 0; 0" keyTimes="0; 0.05; 0.85; 0.9; 1" dur="6s" repeatCount="indefinite" />
                    <ellipse cx="0" cy="120" rx="25" ry="6" fill="#94a3b8" opacity="0.4" />
                    <g>
                        <animateTransform attributeName="transform" type="translate"
                            values="0,0; 0,-6; 0,0; 0,-6; 0,0"
                            dur="0.6s" repeatCount="indefinite" />
                        <g>
                            <line x1="-10" y1="60" x2="-20" y2="120" stroke="#1e293b" strokeWidth="14" strokeLinecap="round">
                                <animate attributeName="x2" values="-20; 20; -20" dur="1.2s" repeatCount="indefinite" />
                            </line>
                            <line x1="10" y1="60" x2="20" y2="120" stroke="#1e293b" strokeWidth="14" strokeLinecap="round">
                                <animate attributeName="x2" values="20; -20; 20" dur="1.2s" repeatCount="indefinite" />
                            </line>
                        </g>
                        <rect x="-22" y="5" width="44" height="65" rx="16" fill="#3b82f6" />
                        <path d="M -15 5 L -15 70 M 15 5 L 15 70" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
                        <circle cx="0" cy="-20" r="22" fill="#ffedd5" />
                        <path d="M -22 -20 A 22 22 0 0 1 22 -20 Z" fill="#1e3a8a" />
                        <line x1="5" y1="-20" x2="30" y2="-20" stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" />
                        <circle cx="5" cy="-10" r="3" fill="#0f172a" />
                        <circle cx="15" cy="-10" r="3" fill="#0f172a" />
                        <path d="M 6 0 Q 10 4 14 0" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M -10 20 L -15 50 L 10 50" fill="none" stroke="#1e3a8a" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="10" cy="50" r="7" fill="#ffedd5" />

                        {/* Electronic equipment crate */}
                        <g>
                            <animateTransform attributeName="transform" type="translate"
                                values="25,10; 25,10; 25,10; 25,75; 25,75"
                                keyTimes="0; 0.15; 0.6; 0.65; 1" dur="6s" repeatCount="indefinite" />
                            <rect x="-25" y="-20" width="50" height="45" rx="6" fill="#facc15" stroke="#ca8a04" strokeWidth="4" />
                            <circle cx="0" cy="2" r="14" fill="#ffffff" />
                            <polygon points="-3,-5 4,-5 0,3 6,3 -2,12 -1,4 -7,4" fill="#3b82f6" />
                        </g>

                        {/* Front arm (retracts after drop) */}
                        <g>
                            <animate attributeName="opacity" values="1; 1; 1; 0; 0" keyTimes="0; 0.6; 0.65; 0.7; 1" dur="6s" repeatCount="indefinite" />
                            <path d="M 10 20 L 15 50 L 40 50" fill="none" stroke="#3b82f6" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="40" cy="50" r="7" fill="#ffedd5" />
                        </g>
                    </g>
                </g>

                {/* ── Success feedback bubble ── */}
                <g transform="translate(725, 230)">
                    <animateTransform attributeName="transform" type="translate"
                        values="725,250; 725,250; 725,210; 725,230; 725,230"
                        keyTimes="0; 0.65; 0.7; 0.75; 1" dur="6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.64; 0.65; 0.9; 0.95" dur="6s" repeatCount="indefinite" />
                    <circle cx="0" cy="0" r="30" fill="#10b981" filter="url(#shadow-soft)" />
                    <path d="M -12 -3 L -2 7 L 14 -9" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            </svg>
        </div>
    );
}

export default function UnloadScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleUnloadReady = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { error } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'seat_deployment',
                    updated_at: now
                })
                .eq('id', journeyId);

            if (error) throw error;
        } catch (error) {
            console.error('Error moving to seat deployment:', error);
            alert('No se pudo confirmar la descarga. Intenta de nuevo.');
            setIsSubmitting(false);
        }
    };

    const meta = missionInfo?.meta || {};
    const hasTeacherInstruction = meta.unload_access || meta.unload_note || meta.unload_voice_url;
    const hasPilotPhoto = !!meta.pilot_spot_photo_url;

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
                firstName={profile?.full_name?.split(' ')[0]}
                roleName={profile?.role === 'pilot' ? 'Piloto' : (profile?.role === 'teacher' ? 'Docente' : 'Auxiliar')}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load"
                onDemoStart={onRefresh}
            />

            {/* ─── Main Content ─── */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', padding: '32px 24px 0',
                paddingBottom: profile?.role === 'assistant' ? 120 : 0,
            }}>
                {/* Illustration */}
                <div style={{ marginBottom: 16 }}>
                    <TruckIllustration />
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: 24, fontWeight: 700, color: '#2563EB',
                    letterSpacing: '-0.02em', lineHeight: 1.2,
                    marginBottom: 12, textAlign: 'center'
                }}>
                    Vamos a descargar
                </h2>

                {/* Description */}
                <p style={{
                    fontSize: 14, color: '#6B7280', lineHeight: 1.6,
                    textAlign: 'center', maxWidth: 340, marginBottom: 24,
                    fontWeight: 400
                }}>
                    Empiecen con el equipo electrónico y llévenlo a la zona de despegue que indicó el piloto. En un momento seguimos con los contenedores.
                </p>

                {/* Cards Container */}
                <div style={{
                    width: '100%', maxWidth: 380,
                    display: 'flex', flexDirection: 'column', gap: 16
                }}>
                    {/* A) Teacher Instruction Card */}
                    {hasTeacherInstruction && (
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: 16,
                            padding: '20px 20px 20px 24px',
                            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                            border: '1px solid #F3F4F6',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Yellow accent bar */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0,
                                width: 4, height: '100%',
                                backgroundColor: '#FBBF24',
                                borderRadius: '4px 0 0 4px'
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{
                                        fontSize: 10, fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                        color: '#6B7280', marginBottom: 6, margin: '0 0 6px'
                                    }}>
                                        Indicación Docente
                                    </p>
                                    {meta.unload_access && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 18, fontWeight: 700, color: '#1F2937' }}>Acceso:</span>
                                            <span style={{
                                                fontSize: 14, fontWeight: 700,
                                                color: meta.unload_access === 'inside' ? '#16A34A' : '#DC2626',
                                                backgroundColor: meta.unload_access === 'inside' ? '#DCFCE7' : '#FEE2E2',
                                                padding: '2px 10px',
                                                borderRadius: 4
                                            }}>
                                                {meta.unload_access === 'inside' ? 'DENTRO' : 'AFUERA'}
                                            </span>
                                        </div>
                                    )}
                                    {meta.unload_note && (
                                        <p style={{ fontSize: 14, color: '#475569', marginTop: 6, margin: '6px 0 0' }}>
                                            Nota: {meta.unload_note}
                                        </p>
                                    )}
                                </div>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    backgroundColor: '#FEF9C3', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, marginLeft: 12
                                }}>
                                    <span className="material-symbols-outlined" style={{
                                        fontSize: 18, color: '#EAB308',
                                        fontVariationSettings: "'FILL' 1, 'wght' 400"
                                    }}>lightbulb</span>
                                </div>
                            </div>

                            {meta.unload_voice_url && (
                                <VoicePlayer url={meta.unload_voice_url} duration={meta.unload_voice_duration} />
                            )}
                        </div>
                    )}

                    {/* B) Pilot Spot Photo Card */}
                    {hasPilotPhoto ? (
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: 16,
                            padding: 4,
                            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
                            border: '1px solid #F3F4F6'
                        }}>
                            <div style={{
                                position: 'relative',
                                borderRadius: 12, overflow: 'hidden',
                                height: 128, width: '100%'
                            }}>
                                <img
                                    src={meta.pilot_spot_photo_url}
                                    alt="Punto sugerido"
                                    style={{
                                        width: '100%', height: '100%',
                                        objectFit: 'cover', opacity: 0.9,
                                        transition: 'transform 0.5s ease'
                                    }}
                                />
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    padding: '32px 16px 14px',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2), transparent)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'
                                }}>
                                    <div>
                                        <p style={{
                                            fontSize: 10, fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                            color: 'rgba(255,255,255,0.8)',
                                            marginBottom: 2, margin: '0 0 2px'
                                        }}>Punto Sugerido Piloto</p>
                                        <p style={{
                                            fontSize: 14, fontWeight: 600,
                                            color: 'white', margin: 0
                                        }}>
                                            {meta.pilot_spot_note || 'Cancha Principal'}
                                        </p>
                                    </div>
                                    <button style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
                                        backgroundColor: 'rgba(255,255,255,0.15)',
                                        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                                        color: 'white', fontSize: 12, fontWeight: 500,
                                        cursor: 'pointer', transition: 'background-color 0.2s'
                                    }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>map</span>
                                        Ver mapa
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: 16, backgroundColor: 'white',
                            borderRadius: 16, textAlign: 'center',
                            border: '1px dashed #D1D5DB',
                            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.03)'
                        }}>
                            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Aún sin foto del piloto</p>
                        </div>
                    )}

                </div>

                {/* Info Pill */}
                <div style={{
                    width: '100%', maxWidth: 380,
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 999,
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'flex-start',
                    gap: 10, marginTop: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 18, color: '#2563EB', marginTop: 1, flexShrink: 0,
                        fontVariationSettings: "'FILL' 1, 'wght' 400"
                    }}>info</span>
                    <p style={{
                        fontSize: 12, fontWeight: 500,
                        color: '#2563EB', margin: 0, lineHeight: 1.5
                    }}>
                        Nota: Lleva todo directo al interior del plantel para evitar curiosos en la calle.
                    </p>
                </div>
            </main>

            {/* ── Sticky Assistant CTA ── */}
            {profile?.role === 'assistant' && (
                <div style={{
                    position: 'sticky', bottom: 0, left: 0, right: 0,
                    zIndex: 40,
                    padding: '16px 24px 20px',
                    background: 'linear-gradient(to top, rgba(243,244,246,1) 60%, rgba(243,244,246,0.92) 80%, rgba(243,244,246,0) 100%)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                }}>
                    <div style={{ maxWidth: 380, margin: '0 auto' }}>
                        <button
                            onClick={handleUnloadReady}
                            disabled={isSubmitting}
                            style={{
                                width: '100%', padding: '16px',
                                backgroundColor: '#2563EB', color: 'white',
                                borderRadius: 14, border: 'none',
                                fontSize: 17, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 8, cursor: isSubmitting ? 'default' : 'pointer',
                                opacity: isSubmitting ? 0.7 : 1,
                                boxShadow: '0 10px 25px -5px rgba(37,99,235,0.35)',
                                transition: 'opacity 0.2s, transform 0.15s',
                            }}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                            {isSubmitting ? 'Confirmando...' : 'Descarga lista'}
                        </button>
                        <p style={{
                            marginTop: 8, fontSize: 12,
                            color: '#6B7280', textAlign: 'center', margin: '8px 0 0'
                        }}>
                            Confirma cuando el equipo ya está dentro del plantel.
                        </p>
                    </div>
                </div>
            )}

            {/* Bottom bar indicator */}
            <div style={{
                padding: '24px 0 20px', display: 'flex',
                justifyContent: 'center', opacity: 0.3
            }}>
                <div style={{
                    width: '33%', maxWidth: 134, height: 4,
                    backgroundColor: '#9CA3AF', borderRadius: 999
                }} />
            </div>
        </div>
    );
}
