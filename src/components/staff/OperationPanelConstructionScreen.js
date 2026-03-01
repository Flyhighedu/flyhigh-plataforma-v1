'use client';

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
