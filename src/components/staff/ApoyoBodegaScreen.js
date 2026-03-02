'use client';

import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';

function firstName(fullName, fallback = 'Operativo') {
    const normalized = String(fullName || '').trim();
    if (!normalized) return fallback;
    const [head] = normalized.split(/\s+/);
    return head || fallback;
}

function WarehouseSupportIllustration() {
    return (
        <div style={{ width: '100%', maxWidth: 260, aspectRatio: '1 / 1', position: 'relative' }}>
            <div style={{
                position: 'absolute',
                inset: 16,
                background: 'linear-gradient(135deg, #DBEAFE 0%, #EEF2FF 100%)',
                borderRadius: '50%',
                filter: 'blur(40px)',
                opacity: 0.7
            }} />
            <svg style={{ width: '100%', height: '100%', position: 'relative', filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.08))' }} fill="none" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <circle cx="200" cy="200" r="140" fill="#EBF5FF" />
                <rect x="80" y="100" width="240" height="200" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="4" />
                <line x1="80" y1="170" x2="320" y2="170" stroke="#CBD5E1" strokeWidth="4" />
                <line x1="80" y1="240" x2="320" y2="240" stroke="#CBD5E1" strokeWidth="4" />
                <g transform="translate(180, 160)">
                    <path d="M20 80C20 80 5 85 5 110V140H75V110C75 85 60 80 60 80" fill="#3B82F6" />
                    <circle cx="40" cy="55" r="25" fill="#FFD7BA" />
                    <path d="M10 50C10 33.4315 23.4315 20 40 20C56.5685 20 70 33.4315 70 50H10Z" fill="#1D4ED8" />
                    <rect x="65" y="45" width="20" height="5" rx="2.5" fill="#1D4ED8" />
                </g>
                <g transform="translate(100, 120)">
                    <rect width="50" height="46" rx="4" fill="#FCD34D" stroke="#F59E0B" strokeWidth="2" />
                    <path d="M10 10L25 25L40 10" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" />
                    <line x1="25" y1="25" x2="25" y2="46" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="2" />
                </g>
                <g transform="translate(240, 190)">
                    <rect width="60" height="46" rx="4" fill="#93C5FD" stroke="#3B82F6" strokeWidth="2" />
                    <path d="M10 10L30 25L50 10" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
                    <line x1="30" y1="25" x2="30" y2="46" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
                </g>
                <g transform="translate(170, 230)">
                    <rect width="70" height="55" rx="6" fill="#FBA778" stroke="#EA580C" strokeWidth="2" />
                    <path d="M10 10L35 30L60 10" stroke="#EA580C" strokeOpacity="0.3" strokeWidth="2" />
                    <line x1="35" y1="30" x2="35" y2="55" stroke="#EA580C" strokeOpacity="0.3" strokeWidth="2" />
                </g>
            </svg>
        </div>
    );
}

export default function ApoyoBodegaScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const firstNameLabel = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    return (
        <div className="flex min-h-screen flex-col overflow-hidden bg-[#F3F6F8] text-slate-800">
            <SyncHeader
                firstName={firstNameLabel}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="warehouse"
                onDemoStart={onRefresh}
            />

            <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-5 pb-28 pt-8 text-center">
                <WarehouseSupportIllustration />

                <h2 className="mt-5 text-[28px] font-extrabold leading-tight tracking-tight text-slate-800">
                    Apoyo en bodega
                </h2>

                <p className="mt-3 max-w-[390px] text-[15px] font-medium leading-relaxed text-slate-600">
                    Mantén la zona ordenada y apoya en logística mientras el piloto concluye inventario y estación de carga.
                </p>
            </main>

            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#F3F6F8] via-[#F3F6F8F2] to-transparent px-5 pb-5 pt-4">
                <div className="mx-auto w-full max-w-[420px]">
                    <button
                        type="button"
                        disabled={true}
                        className={getPrimaryCtaClasses(true)}
                    >
                        Apoyo en bodega activo
                    </button>
                </div>
            </div>
        </div>
    );
}
