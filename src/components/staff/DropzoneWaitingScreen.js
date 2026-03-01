'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import SyncHeader from './SyncHeader';

/* ─── Voice Player (light theme variant) ─── */
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
                    width: 36, height: 36, borderRadius: '50%',
                    backgroundColor: '#2563EB', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0
                }}
            >
                {isPlaying
                    ? <Pause size={16} color="white" />
                    : <Play size={16} color="white" style={{ marginLeft: 2 }} />
                }
            </button>
            <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', margin: 0 }}>Nota de voz</p>
                {duration != null && (
                    <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{fmtSec(duration)}</p>
                )}
            </div>
        </div>
    );
}

export default function DropzoneWaitingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    auxName,
    onRefresh
}) {
    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#F3F4F6',
            color: '#111827', minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={profile?.full_name?.split(' ')[0]}
                roleName={profile?.role === 'pilot' ? 'Piloto' : 'Docente'}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load"
                onDemoStart={onRefresh}
            />

            {/* Main Content */}
            <main style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center',
                padding: '24px 24px 0', textAlign: 'center',
                gap: 20
            }}>
                {/* ── Animated Isometric Scene ── */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 0' }}>
                    <svg viewBox="0 0 600 500" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 300 }}>
                        <defs>
                            <filter id="dz-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="12" stdDeviation="15" floodColor="#94a3b8" floodOpacity="0.4" />
                            </filter>
                            <filter id="dz-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1e293b" floodOpacity="0.3" />
                            </filter>
                            <path id="dz-iso-path" d="M 280 190 L 310 205 L 250 235 L 310 265 L 290 275" />
                        </defs>

                        {/* Circle background */}
                        <circle cx="300" cy="250" r="230" fill="#f0f5ff" stroke="#ffffff" strokeWidth="8" filter="url(#dz-soft-shadow)" />

                        {/* Isometric platform */}
                        <g>
                            <polygon points="100,215 300,315 500,215 300,115" fill="#dbeafe" filter="url(#dz-drop-shadow)" />
                            <polygon points="100,200 300,300 300,320 100,220" fill="#cbd5e1" />
                            <polygon points="300,300 500,200 500,220 300,320" fill="#94a3b8" />
                            <polygon points="100,200 300,300 500,200 300,100" fill="#f8fafc" />
                        </g>

                        {/* Building shadows */}
                        <g fill="#e2e8f0" opacity="0.7">
                            <polygon points="260,200 350,245 350,175 300,180" />
                            <polygon points="320,280 440,220 455,227 335,287" />
                        </g>

                        {/* Dropzone */}
                        <g>
                            <polygon points="260,270 310,295 340,280 290,255" fill="#dcfce7" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 4">
                                <animate attributeName="fill" values="#dcfce7; #dcfce7; #86efac; #dcfce7; #dcfce7" keyTimes="0; 0.74; 0.75; 0.9; 1" dur="6s" repeatCount="indefinite" />
                            </polygon>
                        </g>

                        {/* School building */}
                        <g>
                            <polygon points="180,160 260,200 260,130 180,90" fill="#cbd5e1" />
                            <polygon points="200,160 215,167.5 215,147.5 200,140" fill="#94a3b8" />
                            <polygon points="225,172.5 240,180 240,160 225,152.5" fill="#94a3b8" />
                            <polygon points="260,200 300,180 300,110 260,130" fill="#f1f5f9" />
                            <polygon points="270,195 290,185 290,155 270,165" fill="#64748b" />
                            <line x1="280" y1="190" x2="280" y2="160" stroke="#475569" strokeWidth="1.5" />
                            <polygon points="180,90 260,130 300,110 220,70" fill="#e2e8f0" />
                            <polygon points="180,90 260,130 260,135 180,95" fill="#94a3b8" />
                            <polygon points="260,130 300,110 300,115 260,135" fill="#cbd5e1" />
                        </g>

                        {/* Truck */}
                        <g>
                            <ellipse cx="375" cy="265" rx="8" ry="4" fill="#1e293b" />
                            <ellipse cx="405" cy="250" rx="8" ry="4" fill="#1e293b" />
                            <polygon points="330,255 360,270 360,220 330,205" fill="#2563eb" />
                            <polygon points="360,270 440,230 440,180 360,220" fill="#1d4ed8" />
                            <polygon points="330,205 360,220 440,180 410,165" fill="#60a5fa" />
                            <line x1="380" y1="260" x2="380" y2="210" stroke="#1e40af" strokeWidth="1.5" opacity="0.5" />
                            <line x1="400" y1="250" x2="400" y2="200" stroke="#1e40af" strokeWidth="1.5" opacity="0.5" />
                            <line x1="420" y1="240" x2="420" y2="190" stroke="#1e40af" strokeWidth="1.5" opacity="0.5" />
                            <ellipse cx="315" cy="275" rx="7" ry="3.5" fill="#1e293b" />
                            <polygon points="300,270 320,280 320,250 300,240" fill="#3b82f6" />
                            <polygon points="320,280 350,265 350,235 320,250" fill="#2563eb" />
                            <polygon points="300,240 320,250 350,235 330,225" fill="#93c5fd" />
                            <polygon points="305,262 315,267 315,252 305,247" fill="#bfdbfe" />
                        </g>

                        {/* Trees */}
                        <g>
                            <line x1="170" y1="205" x2="170" y2="220" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
                            <ellipse cx="170" cy="205" rx="14" ry="12" fill="#34d399" filter="url(#dz-drop-shadow)" />
                            <ellipse cx="166" cy="202" rx="6" ry="4" fill="#6ee7b7" />
                            <line x1="390" y1="165" x2="390" y2="180" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
                            <ellipse cx="390" cy="165" rx="16" ry="14" fill="#34d399" filter="url(#dz-drop-shadow)" />
                            <ellipse cx="385" cy="161" rx="8" ry="5" fill="#6ee7b7" />
                        </g>

                        {/* Navigation route */}
                        <path d="M 280 190 L 310 205 L 250 235 L 310 265 L 290 275" fill="none" stroke="#9ca3af" strokeWidth="3" strokeDasharray="6 6" />
                        <path d="M 280 190 L 310 205 L 250 235 L 310 265 L 290 275" fill="none" stroke="#3b82f6" strokeWidth="4" pathLength="100" strokeDasharray="100" strokeDashoffset="100">
                            <animate attributeName="stroke-dashoffset" values="100; 100; 0; 0; 100" keyTimes="0; 0.08; 0.75; 0.95; 1" dur="6s" repeatCount="indefinite" />
                        </path>

                        {/* Animated operative */}
                        <g>
                            <animateMotion dur="6s" repeatCount="indefinite" keyTimes="0; 0.08; 0.75; 0.95; 1" keyPoints="0; 0; 1; 1; 0" calcMode="linear">
                                <mpath href="#dz-iso-path" />
                            </animateMotion>
                            <animate attributeName="opacity" values="1; 1; 0; 0; 1" keyTimes="0; 0.74; 0.75; 0.95; 1" dur="6s" repeatCount="indefinite" />
                            <g transform="translate(0, -18)">
                                <path d="M -7 18 C -7 10 -4 2 0 2 C 4 2 7 10 7 18 Z" fill="#1e3a8a" filter="url(#dz-drop-shadow)" />
                                <circle cx="0" cy="0" r="7" fill="#3b82f6" filter="url(#dz-drop-shadow)" />
                            </g>
                        </g>

                        {/* Success check */}
                        <g transform="translate(290, 275)">
                            <animate attributeName="opacity" values="0; 0; 1; 1; 0" keyTimes="0; 0.74; 0.75; 0.95; 1" dur="6s" repeatCount="indefinite" />
                            <animateTransform attributeName="transform" type="translate" values="290,275; 290,275; 290,250; 290,255; 290,255" keyTimes="0; 0.74; 0.75; 0.8; 1" dur="6s" repeatCount="indefinite" />
                            <ellipse cx="0" cy="0" rx="16" ry="8" fill="#059669" />
                            <ellipse cx="0" cy="-3" rx="16" ry="8" fill="#10b981" />
                            <path d="M -7 -3 L -2 2 L 8 -5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    </svg>
                </div>

                {/* ── Title + Subtitle ── */}
                <div style={{ maxWidth: 300 }}>
                    <h2 style={{
                        fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                        lineHeight: 1.2, marginBottom: 6, color: '#111827'
                    }}>
                        Ve a la zona de descarga
                    </h2>
                    <p style={{
                        fontSize: 14, color: '#6B7280',
                        lineHeight: 1.6, fontWeight: 400, margin: 0
                    }}>
                        {auxName || 'El Auxiliar'} está acomodando el vehículo.{'\n'}En un momento seguimos.
                    </p>
                </div>

                {/* ── Teacher Instruction Card ── */}
                {missionInfo?.meta && (missionInfo.meta.unload_access || missionInfo.meta.unload_note || missionInfo.meta.unload_voice_url) && (
                    <div style={{
                        width: '100%',
                        backgroundColor: 'white',
                        borderRadius: 14, padding: '16px 18px',
                        borderLeft: '4px solid #2563EB',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                        textAlign: 'left',
                        position: 'relative', overflow: 'hidden'
                    }}>
                        {/* Faded school icon watermark */}
                        <div style={{
                            position: 'absolute', right: 12, top: 12,
                            opacity: 0.05, fontSize: 56, color: '#111827',
                            lineHeight: 1
                        }}>
                            🎓
                        </div>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <p style={{
                                fontSize: 10, fontWeight: 700, color: '#2563EB',
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                margin: '0 0 6px'
                            }}>
                                Indicación Docente
                            </p>
                            {missionInfo.meta.unload_access && (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Acceso:</span>
                                    <span style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>
                                        {missionInfo.meta.unload_access === 'inside' ? 'DENTRO' : 'AFUERA'}
                                    </span>
                                </div>
                            )}
                            {missionInfo.meta.unload_note && (
                                <p style={{ fontSize: 14, color: '#6B7280', margin: '2px 0 0', lineHeight: 1.4 }}>
                                    Nota: {missionInfo.meta.unload_note}
                                </p>
                            )}
                            {missionInfo.meta.unload_voice_url && (
                                <VoicePlayer
                                    url={missionInfo.meta.unload_voice_url}
                                    duration={missionInfo.meta.unload_voice_duration}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* ── "Nota Siguiente" Card ── */}
                <div style={{
                    width: '100%',
                    backgroundColor: 'white',
                    borderRadius: 14, padding: '14px 16px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    border: '1px solid #F3F4F6',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    textAlign: 'left'
                }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: '#EFF6FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: 1
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <circle cx="12" cy="17" r="1" fill="#2563EB" stroke="none" />
                        </svg>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: 1.4, margin: 0 }}>
                        <span style={{ color: '#2563EB' }}>Nota Siguiente:</span> Descargar equipo (primero: electrónico).
                    </p>
                </div>
            </main>

            {/* ── Footer ── */}
            <footer style={{
                padding: '16px 24px 32px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    color: '#6B7280'
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                        Regla: Nada se deja en la calle.
                    </span>
                </div>
            </footer>
        </div>
    );
}
