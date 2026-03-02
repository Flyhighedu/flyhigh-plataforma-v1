'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

function HeadphonesStorageHero() {
    return (
        <div className="mx-auto mb-3 w-full max-w-[260px]">
            <svg viewBox="0 0 320 220" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Audifonos en resguardo">
                <defs>
                    <linearGradient id="hp-shell" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0F172A" />
                        <stop offset="100%" stopColor="#334155" />
                    </linearGradient>
                    <linearGradient id="hp-core" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2563EB" />
                        <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                    <filter id="hp-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#0F172A" floodOpacity="0.25" />
                    </filter>
                </defs>

                <circle cx="160" cy="112" r="86" fill="#DBEAFE" opacity="0.55" />
                <circle cx="160" cy="112" r="72" fill="#EFF6FF" opacity="0.9" />

                <g filter="url(#hp-soft-shadow)">
                    <path d="M68 126c0-50 41-91 92-91s92 41 92 91" fill="none" stroke="url(#hp-shell)" strokeWidth="18" strokeLinecap="round" />

                    <rect x="66" y="122" width="38" height="68" rx="18" fill="url(#hp-shell)" />
                    <rect x="216" y="122" width="38" height="68" rx="18" fill="url(#hp-shell)" />

                    <rect x="74" y="132" width="22" height="45" rx="10" fill="#111827" />
                    <rect x="224" y="132" width="22" height="45" rx="10" fill="#111827" />

                    <circle cx="85" cy="154" r="5" fill="url(#hp-core)">
                        <animate attributeName="opacity" values="1;0.45;1" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="235" cy="154" r="5" fill="url(#hp-core)">
                        <animate attributeName="opacity" values="1;0.45;1" dur="1.8s" begin="0.25s" repeatCount="indefinite" />
                    </circle>
                </g>

                <g opacity="0.5">
                    <path d="M115 54c14-12 30-17 45-17" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" fill="none" />
                    <path d="M205 54c-12-10-25-15-40-16" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" fill="none" />
                </g>
            </svg>
        </div>
    );
}

export default function HeadphonesStorageScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.HEADPHONES_STORAGE}
            title="Guardar audifonos"
            description="Retira, enrolla y protege audifonos para cierre seguro de operacion."
            iconName="headphones"
            checklistMetaKey="global_headphones_storage_checks"
            doneFlagKey="global_headphones_stored"
            checklistItems={[
                { id: 'headphones_powered_off', label: 'Audífonos apagados' },
                { id: 'headphones_folded', label: 'Audífonos plegados' },
                { id: 'headphones_in_containers', label: 'Audífonos en sus contenedores' }
            ]}
            nextClosureStep={CLOSURE_STEPS.SEAT_FOLDING}
            lockToPilot={true}
            controlScope="global_headphones_storage"
            headerLayout="canvas"
            heroContent={<HeadphonesStorageHero />}
            buttonLabel="Audifonos resguardados"
            doneLabel="Audifonos resguardados"
            successMessage="Checklist global de audifonos completado."
        />
    );
}
