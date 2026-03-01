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
                    backgroundColor: '#007AFF', border: 'none',
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
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#007AFF' }}>graphic_eq</span>
        </div>
    );
}

export default function DropzoneActionScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const [loading, setLoading] = useState(false);


    const handleZaraLista = async () => {
        setLoading(true);
        try {
            const supabase = createClient();

            // 1. Log Event
            await supabase.from('staff_prep_events').insert({
                journey_id: journeyId,
                user_id: userId,
                event_type: 'dropzone_ready',
                payload: { timestamp: new Date().toISOString() }
            });

            // 2. Set Global State
            await supabase.from('staff_journeys')
                .update({
                    mission_state: 'unload',
                    updated_at: new Date().toISOString()
                })
                .eq('id', journeyId);

        } catch (e) {
            console.error('Error updating dropzone state:', e);
            setLoading(false);
        }
    };

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#F3F4F6',
            color: '#1F2937', minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={profile?.full_name?.split(' ')[0]}
                roleName="Auxiliar"
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
                gap: 16, paddingBottom: 130
            }}>
                {/* ── Isometric Diorama Illustration ── */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 4px' }}>
                    <svg viewBox="0 0 1000 800" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 320 }}>
                        <defs>
                            <filter id="dza-shadow-diorama" x="-10%" y="-10%" width="120%" height="130%">
                                <feDropShadow dx="0" dy="30" stdDeviation="25" floodColor="#475569" floodOpacity="0.25" />
                            </filter>
                            <filter id="dza-shadow-car" x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="15" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.4" />
                            </filter>
                            <filter id="dza-glow-brake" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="dza-glow-path" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>

                        {/* Plataforma Base */}
                        <g id="dza-plataforma">
                            <polygon points="500,100 950,325 450,575 0,350" fill="#cbd5e1" filter="url(#dza-shadow-diorama)" transform="translate(0, 20)" />
                            <polygon points="500,100 950,325 450,575 0,350" fill="#e2e8f0" />
                            <polygon points="0,350 450,575 450,625 0,400" fill="#94a3b8" />
                            <polygon points="450,575 950,325 950,375 450,625" fill="#64748b" />
                        </g>

                        {/* Almacén */}
                        <g id="dza-almacen">
                            <polygon points="0,350 300,500 300,200 0,50" fill="#cbd5e1" />
                            <polygon points="300,500 550,375 550,75 300,200" fill="#f1f5f9" />
                            <polygon points="0,50 300,200 550,75 250,-75" fill="#f8fafc" />
                            <polygon points="0,50 300,200 300,210 0,60" fill="#94a3b8" />
                            <polygon points="300,200 550,75 550,85 300,210" fill="#cbd5e1" />
                            <polygon points="320,490 480,410 480,210 320,290" fill="#64748b" />
                            <line x1="320" y1="470" x2="480" y2="390" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="450" x2="480" y2="370" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="430" x2="480" y2="350" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="410" x2="480" y2="330" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="390" x2="480" y2="310" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="370" x2="480" y2="290" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="350" x2="480" y2="270" stroke="#475569" strokeWidth="2" />
                            <line x1="320" y1="330" x2="480" y2="250" stroke="#475569" strokeWidth="2" />
                            <polygon points="310,500 320,495 320,290 310,295" fill="#eab308" />
                            <polygon points="310,295 320,290 480,210 470,215" fill="#facc15" />
                            <polygon points="480,210 490,205 490,410 480,415" fill="#ca8a04" />
                        </g>

                        {/* Zona de Estacionamiento */}
                        <g id="dza-zona-estacionamiento">
                            <polygon points="780,190 920,260 840,300 700,230" fill="none" stroke="#94a3b8" strokeWidth="4" strokeDasharray="10 8" />
                            <text x="795" y="260" fontFamily="sans-serif" fontWeight="bold" fontSize="30" fill="#94a3b8" transform="skewX(-26.5) rotate(26.5)">P</text>
                        </g>

                        {/* Zona de Descarga */}
                        <g id="dza-zona-descarga">
                            <polygon points="380,510 520,440 600,480 460,550" fill="#dcfce7" fillOpacity="0.5" stroke="#22c55e" strokeWidth="4" strokeDasharray="12 6">
                                <animate attributeName="fill-opacity" values="0.5; 0.5; 0.9; 0.5; 0.5" keyTimes="0; 0.55; 0.65; 0.9; 1" dur="6s" repeatCount="indefinite" />
                            </polygon>
                        </g>

                        {/* Ruta de Navegación */}
                        <g id="dza-ruta-guia">
                            <path d="M 810 245 L 490 495" fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" filter="url(#dza-glow-path)">
                                <animate attributeName="stroke-dashoffset" values="100; 100; 0; 0; 100" keyTimes="0; 0.05; 0.55; 0.95; 1" dur="6s" repeatCount="indefinite" />
                            </path>
                        </g>

                        {/* Vehículo Animado */}
                        <g id="dza-vehiculo-animado">
                            <animateTransform attributeName="transform" type="translate"
                                values="810,245; 810,245; 490,495; 485,499; 490,495; 490,495; 810,245"
                                keyTimes="0; 0.1; 0.6; 0.63; 0.68; 0.9; 1"
                                dur="6s" repeatCount="indefinite" />
                            <g>
                                <animateTransform attributeName="transform" type="rotate"
                                    values="0 -80 50; 0 -80 50; 0 -80 50; 3 -80 50; 0 -80 50; 0 -80 50; 0 -80 50"
                                    keyTimes="0; 0.1; 0.6; 0.63; 0.68; 0.9; 1"
                                    dur="6s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 1; 1; 1; 0" keyTimes="0; 0.05; 0.15; 0.9; 1" dur="6s" repeatCount="indefinite" />

                                {/* Sombra */}
                                <polygon points="120,-30 40,-70 -160,30 -80,70" fill="#0f172a" opacity="0.5" filter="url(#dza-shadow-car)" />
                                {/* Rueda trasera izq */}
                                <ellipse cx="60" cy="-30" rx="14" ry="24" fill="#020617" />
                                {/* Frente */}
                                <polygon points="-160,30 -60,80 -60,40 -160,-10" fill="#ffffff" />
                                <polygon points="-150,20 -70,60 -70,50 -150,10" fill="#0f172a" />
                                <polygon points="-150,5 -130,15 -130,5 -150,-5" fill="#fef08a" />
                                <polygon points="-80,40 -60,50 -60,40 -80,30" fill="#fef08a" />
                                {/* Lateral derecho */}
                                <polygon points="-60,80 120,-10 120,-30 -60,60" fill="#cbd5e1" />
                                <path d="M -60,60 L 120,-30 L 100,-60 L 0,-20 L -30,-10 Z" fill="#e2e8f0" />
                                {/* Ruedas visibles */}
                                <ellipse cx="-40" cy="55" rx="14" ry="24" fill="#0f172a" />
                                <ellipse cx="-40" cy="55" rx="8" ry="14" fill="#94a3b8" />
                                <ellipse cx="90" cy="-10" rx="14" ry="24" fill="#0f172a" />
                                <ellipse cx="90" cy="-10" rx="8" ry="14" fill="#94a3b8" />
                                {/* Cofre y techo */}
                                <polygon points="-160,-10 -60,40 -20,-10 -110,-50" fill="#f8fafc" />
                                <polygon points="-50,-60 40,-15 80,-65 -10,-110" fill="#f8fafc" />
                                {/* Cristales */}
                                <polygon points="-110,-50 -20,-10 -50,-60 -10,-110" fill="#1e293b" />
                                <polygon points="-100,-50 -30,-15 -45,-45 -90,-70" fill="#334155" />
                                <polygon points="-20,-15 80,-65 100,-60 0,-20" fill="#0f172a" />
                                <polygon points="30,-30 40,-25 50,-50 40,-55" fill="#cbd5e1" />
                                {/* Detalles */}
                                <polygon points="-10,-10 0,-5 0,5 -10,0" fill="#f8fafc" />
                                <polygon points="10,-10 20,-5 20,-2 10,-7" fill="#f1f5f9" />
                                <polygon points="70,-40 80,-35 80,-32 70,-37" fill="#f1f5f9" />
                                {/* Luz de freno */}
                                <polygon points="115,-32 120,-30 120,-20 115,-22" fill="#991b1b">
                                    <animate attributeName="fill" values="#991b1b; #991b1b; #ff0000; #991b1b; #991b1b" keyTimes="0; 0.59; 0.6; 0.75; 1" dur="6s" repeatCount="indefinite" />
                                </polygon>
                            </g>
                        </g>

                        {/* Checkmark de Confirmación */}
                        <g transform="translate(490, 460)">
                            <animate attributeName="opacity" values="0; 0; 0; 1; 1; 0" keyTimes="0; 0.64; 0.65; 0.9; 0.95; 1" dur="6s" repeatCount="indefinite" />
                            <animateTransform attributeName="transform" type="translate"
                                values="490,460; 490,460; 490,380; 490,400; 490,400"
                                keyTimes="0; 0.64; 0.65; 0.7; 1" dur="6s" repeatCount="indefinite" />
                            <ellipse cx="0" cy="0" rx="30" ry="15" fill="#059669" filter="url(#dza-shadow-car)" />
                            <ellipse cx="0" cy="-8" rx="30" ry="15" fill="#10b981" />
                            <path d="M -12 -8 L -2 2 L 18 -12" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    </svg>
                </div>

                {/* ── Title + Subtitle ── */}
                <div style={{ maxWidth: 320 }}>
                    <h2 style={{
                        fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em',
                        lineHeight: 1.2, marginBottom: 10, color: '#111827'
                    }}>
                        Acomoda el vehículo
                    </h2>
                    <p style={{
                        fontSize: 14, color: '#6B7280',
                        lineHeight: 1.6, fontWeight: 400, margin: 0
                    }}>
                        Colócalo en la zona de descarga segura y despejada para iniciar el proceso de instalación.
                    </p>
                </div>

                {/* ── Indicación Docente Card ── */}
                {missionInfo?.meta && (missionInfo.meta.unload_access || missionInfo.meta.unload_note || missionInfo.meta.unload_voice_url) && (
                    <div style={{
                        width: '100%',
                        backgroundColor: 'white',
                        borderRadius: 20, padding: '20px 20px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                        border: '1px solid #F1F5F9',
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        textAlign: 'left'
                    }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            backgroundColor: '#EFF6FF', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginTop: 2
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                fontSize: 10, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                color: '#9CA3AF', margin: '0 0 6px'
                            }}>
                                Indicación Docente
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    {missionInfo.meta.unload_access && (
                                        <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
                                            Acceso: {missionInfo.meta.unload_access === 'inside' ? 'DENTRO' : 'AFUERA'}
                                        </p>
                                    )}
                                    {missionInfo.meta.unload_note && (
                                        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
                                            Nota: {missionInfo.meta.unload_note}
                                        </p>
                                    )}
                                </div>
                                <div style={{
                                    backgroundColor: '#DCFCE7',
                                    color: '#15803D',
                                    padding: '5px 12px',
                                    borderRadius: 999,
                                    fontSize: 12, fontWeight: 700,
                                    flexShrink: 0, marginLeft: 12
                                }}>
                                    Confirmado
                                </div>
                            </div>
                            {missionInfo.meta.unload_voice_url && (
                                <VoicePlayer
                                    url={missionInfo.meta.unload_voice_url}
                                    duration={missionInfo.meta.unload_voice_duration}
                                />
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* ── Fixed CTA ── */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                padding: '12px 24px 28px',
                background: 'linear-gradient(0deg, #F3F4F6 85%, transparent)',
                zIndex: 30
            }}>
                <button
                    onClick={handleZaraLista}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '17px 20px',
                        backgroundColor: loading ? '#93C5FD' : '#2563EB',
                        color: 'white',
                        borderRadius: 14,
                        border: 'none',
                        fontSize: 16, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 8px 24px -8px rgba(37,99,235,0.5)'
                    }}
                >
                    {loading && <Loader2 className="animate-spin" size={18} />}
                    {loading ? 'Registrando...' : 'Listo, Ya me acomodé'}
                    {!loading && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    )}
                </button>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, marginTop: 12, opacity: 0.5
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>
                        No cierres la app (los datos se guardan)
                    </span>
                </div>
            </div>


        </div>
    );
}
