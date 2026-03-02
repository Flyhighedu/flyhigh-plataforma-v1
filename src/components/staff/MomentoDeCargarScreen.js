'use client';

import { Clock3, Loader2 } from 'lucide-react';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';

function firstName(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [head] = normalized.split(/\s+/);
    return head || fallback;
}

function LoadingTransitIllustration() {
    return (
        <div className="w-full max-w-[320px]">
            <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                <defs>
                    <filter id="mdc-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#94a3b8" floodOpacity="0.15" />
                    </filter>
                    <path id="mdc-ruta-colocacion" d="M 175 245 L 220 220 L 330 220" />
                </defs>

                <rect x="50" y="50" width="500" height="300" rx="150" fill="#F0F5FF" />
                <line x1="100" y1="310" x2="500" y2="310" stroke="#CBD5E1" strokeWidth="6" strokeLinecap="round" />

                <g>
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,0; 0,4; 0,0; 0,0" keyTimes="0; 0.6; 0.65; 0.75; 1" dur="4s" repeatCount="indefinite" />
                    <line x1="260" y1="310" x2="470" y2="310" stroke="#94A3B8" strokeWidth="10" strokeLinecap="round" opacity="0.4" />
                    <rect x="250" y="140" width="140" height="150" rx="12" fill="#E2E8F0" />
                    <path d="M 250 140 L 378 140 Q 390 140 390 152 L 390 278 Q 390 290 378 290 L 250 290" fill="none" stroke="#FFFFFF" strokeWidth="12" strokeLinejoin="round" filter="url(#mdc-soft-shadow)" />
                    <path d="M 250 140 L 378 140 Q 390 140 390 152 L 390 278 Q 390 290 378 290 L 250 290" fill="none" stroke="#CBD5E1" strokeWidth="4" strokeLinejoin="round" />
                    <path d="M 380 180 L 450 180 Q 470 180 475 200 L 485 240 Q 490 250 490 260 L 490 280 Q 490 290 480 290 L 380 290 Z" fill="#3B82F6" stroke="#2563EB" strokeWidth="4" strokeLinejoin="round" />
                    <path d="M 390 190 L 445 190 Q 455 190 460 200 L 470 230 Q 472 235 465 235 L 390 235 Z" fill="#BFDBFE" stroke="#93C5FD" strokeWidth="3" strokeLinejoin="round" />
                    <rect x="475" y="260" width="10" height="15" rx="5" fill="#FEF08A" />
                    <g transform="translate(300, 290)">
                        <circle cx="0" cy="0" r="22" fill="#1E293B" />
                        <circle cx="0" cy="0" r="10" fill="#CBD5E1" />
                    </g>
                    <g transform="translate(430, 290)">
                        <circle cx="0" cy="0" r="22" fill="#1E293B" />
                        <circle cx="0" cy="0" r="10" fill="#CBD5E1" />
                    </g>
                </g>

                <g>
                    <animateMotion dur="4s" repeatCount="indefinite" keyTimes="0; 0.1; 0.6; 0.9; 1" keyPoints="0; 0; 1; 1; 0" calcMode="linear">
                        <mpath href="#mdc-ruta-colocacion" />
                    </animateMotion>
                    <animate attributeName="opacity" values="0; 1; 1; 1; 0" keyTimes="0; 0.05; 0.6; 0.9; 0.95" dur="4s" repeatCount="indefinite" />
                    <rect x="-20" y="-20" width="40" height="40" rx="6" fill="#FBBF24" stroke="#D97706" strokeWidth="3" />
                    <line x1="-20" y1="0" x2="20" y2="0" stroke="#D97706" strokeWidth="3" opacity="0.5" />
                    <rect x="-8" y="-20" width="16" height="40" fill="#F59E0B" opacity="0.4" />
                </g>

                <g>
                    <ellipse cx="150" cy="310" rx="20" ry="4" fill="#94A3B8" opacity="0.4" />
                    <line x1="140" y1="260" x2="140" y2="310" stroke="#1E293B" strokeWidth="12" strokeLinecap="round" />
                    <line x1="160" y1="260" x2="160" y2="310" stroke="#1E293B" strokeWidth="12" strokeLinecap="round" />
                    <rect x="125" y="200" width="50" height="65" rx="16" fill="#3B82F6" />
                    <circle cx="150" cy="170" r="22" fill="#FDE68A" />
                    <path d="M 128 160 A 22 22 0 0 1 172 160 Z" fill="#1E3A8A" />
                    <g>
                        <animateTransform attributeName="transform" type="rotate" values="-20 150 215; -35 150 215; -35 150 215; -20 150 215; -20 150 215" keyTimes="0; 0.2; 0.6; 0.8; 1" dur="4s" repeatCount="indefinite" />
                        <line x1="150" y1="215" x2="175" y2="245" stroke="#60A5FA" strokeWidth="14" strokeLinecap="round" />
                        <circle cx="175" cy="245" r="7" fill="#FCD34D" />
                    </g>
                </g>
            </svg>
        </div>
    );
}

export default function MomentoDeCargarScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh,
    subtitleOverride,
    onPrimaryAction,
    primaryActionLabel = 'Carga lista',
    primaryActionDisabled = false,
    primaryActionLoading = false
}) {
    const meta = parseMeta(missionInfo?.meta);
    const firstNameLabel = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';
    const hasPrimaryAction = typeof onPrimaryAction === 'function';

    const vehicleReady =
        meta.aux_vehicle_positioned === true ||
        meta.closure_vehicle_positioning_done === true;

    const subtitle = subtitleOverride || (
        vehicleReady
            ? 'El vehículo está en posición. Es momento de subir el equipo al contenedor.'
            : 'Ve acercando el equipo a la puerta. El auxiliar llegará pronto con el vehículo.'
    );

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F3F6F8] text-slate-800">
            <SyncHeader
                firstName={firstNameLabel}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load"
                onDemoStart={onRefresh}
            />

            <main className={`mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-5 pt-6 text-center ${hasPrimaryAction ? 'pb-24' : 'pb-10'}`}>
                <LoadingTransitIllustration />

                <div className="mt-5 max-w-[390px] transition-all duration-300">
                    <h2 className="m-0 text-[28px] font-extrabold leading-tight tracking-tight text-slate-800">
                        Momento de cargar
                    </h2>
                    <p className="mt-3 text-[15px] font-medium leading-relaxed text-slate-600 transition-colors duration-300">
                        {subtitle}
                    </p>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                    <Clock3 size={15} />
                    {vehicleReady ? 'Vehículo listo para cargar' : 'Esperando vehículo en posición'}
                </div>
            </main>

            {hasPrimaryAction ? (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#F3F6F8] via-[#F3F6F8F2] to-transparent px-5 pb-5 pt-4">
                    <div className="mx-auto w-full max-w-[420px]">
                        <button
                            type="button"
                            onClick={onPrimaryAction}
                            disabled={primaryActionDisabled}
                            className={getPrimaryCtaClasses(primaryActionDisabled)}
                        >
                            {primaryActionLoading ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <Loader2 size={17} className="animate-spin" />
                                    Confirmando...
                                </span>
                            ) : (
                                primaryActionLabel
                            )}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
