'use client';

import { useState, useEffect } from 'react';
import { Loader2, ArrowDown, Truck } from 'lucide-react';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';

export default function WaitingUnloadAssignmentScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    // Animation state
    const [dotIndex, setDotIndex] = useState(0);

    const firstName = profile?.full_name?.split(' ')[0] || 'Operativo';
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    useEffect(() => {
        const interval = setInterval(() => {
            setDotIndex(prev => (prev + 1) % 4);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const dots = '.'.repeat(dotIndex);

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
                alignItems: 'center',
                padding: '24px 24px 0', textAlign: 'center',
                gap: 20
            }}>
                {/* ── SVG Truck Illustration ── */}
                <div style={{
                    width: '100%', maxWidth: 260,
                    position: 'relative', marginTop: 8
                }}>
                    {/* Soft glow */}
                    <div style={{
                        position: 'absolute', inset: 20,
                        background: '#DBEAFE',
                        borderRadius: '50%', filter: 'blur(40px)', opacity: 0.6
                    }} />
                    <svg style={{
                        width: '100%', height: 'auto', position: 'relative',
                        filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.06))'
                    }} viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="truckGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style={{ stopColor: '#3B82F6', stopOpacity: 1 }} />
                                <stop offset="100%" style={{ stopColor: '#2563EB', stopOpacity: 1 }} />
                            </linearGradient>
                        </defs>
                        {/* Shadow ellipse */}
                        <ellipse cx="200" cy="240" rx="140" ry="20" fill="#CBD5E1" opacity="0.5" />
                        {/* Truck body */}
                        <rect x="120" y="130" width="160" height="80" rx="6" fill="url(#truckGrad2)" />
                        {/* Cabin */}
                        <rect x="280" y="150" width="50" height="60" rx="4" fill="#60A5FA" />
                        {/* Cabin window */}
                        <rect x="290" y="160" width="30" height="30" rx="3" fill="#EBF8FF" opacity="0.8" />
                        {/* Wheels */}
                        <circle cx="150" cy="210" r="18" fill="#1F2937" />
                        <circle cx="150" cy="210" r="6" fill="#4B5563" />
                        <circle cx="240" cy="210" r="18" fill="#1F2937" />
                        <circle cx="240" cy="210" r="6" fill="#4B5563" />
                        <circle cx="300" cy="210" r="18" fill="#1F2937" />
                        <circle cx="300" cy="210" r="6" fill="#4B5563" />
                        {/* Left cone */}
                        <path d="M80,230 L100,180 L120,230 Z" fill="#F97316" />
                        <rect x="90" y="195" width="20" height="5" fill="white" opacity="0.8" transform="skewX(-5)" />
                        <rect x="85" y="215" width="30" height="5" fill="white" opacity="0.8" transform="skewX(-5)" />
                        {/* Right cone */}
                        <path d="M340,230 L360,180 L380,230 Z" fill="#F97316" />
                        <rect x="350" y="195" width="20" height="5" fill="white" opacity="0.8" transform="skewX(5)" />
                        <rect x="345" y="215" width="30" height="5" fill="white" opacity="0.8" transform="skewX(5)" />
                        {/* Animated dots */}
                        <circle cx="200" cy="100" r="5" fill="#3B82F6">
                            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="220" cy="100" r="5" fill="#3B82F6">
                            <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.3s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="240" cy="100" r="5" fill="#3B82F6">
                            <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.6s" repeatCount="indefinite" />
                        </circle>
                    </svg>
                </div>

                {/* ── Title + Subtitle ── */}
                <div style={{ maxWidth: 300 }}>
                    <h2 style={{
                        fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                        lineHeight: 1.2, marginBottom: 8, color: '#1F2937'
                    }}>
                        Esperando indicación{dots}
                    </h2>
                    <p style={{
                        fontSize: 14, color: '#6B7280',
                        lineHeight: 1.6, fontWeight: 400, margin: 0
                    }}>
                        El Docente está en Dirección asignando la zona de descarga.
                    </p>
                </div>

                {/* ── Live Instruction Panel (conditional) ── */}
                {(missionInfo?.meta?.unload_access || missionInfo?.meta?.unload_note) && (
                    <div style={{
                        width: '100%',
                        backgroundColor: 'white',
                        borderRadius: 16, padding: 16,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'left'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                backgroundColor: '#22C55E'
                            }} />
                            <span style={{
                                fontSize: 11, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                color: '#64748b'
                            }}>
                                En vivo
                            </span>
                        </div>

                        {missionInfo?.meta?.unload_access && (
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', margin: '0 0 4px' }}>
                                Acceso: {missionInfo.meta.unload_access === 'inside' ? 'Dentro del plantel' : 'Sin acceso / Afuera'}
                            </p>
                        )}

                        {missionInfo?.meta?.unload_note && (
                            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                                &quot;{missionInfo.meta.unload_note}&quot;
                            </p>
                        )}
                    </div>
                )}

                {/* ── "Siguiente paso" Info Card ── */}
                <div style={{
                    width: '100%',
                    background: 'rgba(37,99,235,0.08)',
                    border: '1px solid rgba(37,99,235,0.15)',
                    borderRadius: 16, padding: '16px 16px 16px 20px',
                    position: 'relative', overflow: 'hidden',
                    textAlign: 'left'
                }}>
                    {/* Left accent bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0,
                        width: 3, height: '100%',
                        backgroundColor: '#3B82F6'
                    }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            backgroundColor: '#3B82F6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
                        }}>
                            <ArrowDown size={18} color="white" />
                        </div>
                        <div>
                            <p style={{
                                fontSize: 10, fontWeight: 700, color: '#3B82F6',
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                margin: '0 0 4px'
                            }}>
                                Siguiente Paso
                            </p>
                            <p style={{
                                fontSize: 13, fontWeight: 500, color: '#1F2937',
                                lineHeight: 1.5, margin: 0
                            }}>
                                Acomodar vehículo y descargar equipo (primero: electrónico).
                            </p>
                        </div>
                    </div>
                    {/* Faded watermark */}
                    <Truck
                        size={72}
                        style={{
                            position: 'absolute', bottom: -8, right: -8,
                            color: '#3B82F6', opacity: 0.05,
                            transform: 'rotate(12deg)'
                        }}
                    />
                </div>
            </main>

            {/* ── Status Footer ── */}
            <footer style={{ padding: '20px 24px 32px', textAlign: 'center' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    borderRadius: 999,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    border: '1px solid #F3F4F6'
                }}>
                    {/* Green ping dot */}
                    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
                        <span style={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%',
                            backgroundColor: '#4ADE80',
                            opacity: 0.75,
                            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
                        }} />
                        <span style={{
                            position: 'relative', display: 'inline-flex',
                            width: 10, height: 10,
                            borderRadius: '50%',
                            backgroundColor: '#22C55E'
                        }} />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>
                        No cierres la app (los datos se guardan)
                    </span>
                </div>
            </footer>

            <style jsx>{`
                @keyframes ping {
                    75%, 100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
}
