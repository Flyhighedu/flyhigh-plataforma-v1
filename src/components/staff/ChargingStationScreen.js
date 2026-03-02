'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

function ChargingStationHero() {
    return (
        <div className="mx-auto mb-2 w-full max-w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_36px_-20px_rgba(15,23,42,0.35)]">
            <svg viewBox="0 0 780 320" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                <defs>
                    <linearGradient id="chg-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#EFF6FF" />
                        <stop offset="100%" stopColor="#F8FAFC" />
                    </linearGradient>
                    <linearGradient id="chg-core" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                </defs>
                <rect width="780" height="320" fill="url(#chg-bg)" />

                <rect x="62" y="70" width="130" height="188" rx="16" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="4" />
                <rect x="230" y="52" width="170" height="206" rx="20" fill="#1E293B" />
                <rect x="248" y="72" width="134" height="110" rx="12" fill="#0EA5E9" opacity="0.2" />
                <path d="M286 124H324" stroke="#0EA5E9" strokeWidth="8" strokeLinecap="round" />
                <path d="M304 106V142" stroke="#0EA5E9" strokeWidth="8" strokeLinecap="round" />
                <circle cx="314" cy="210" r="11" fill="#38BDF8" />

                <rect x="450" y="84" width="90" height="154" rx="12" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="4" />
                <rect x="576" y="84" width="90" height="154" rx="12" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="4" />

                <path d="M410 124C468 124 454 161 498 161" fill="none" stroke="url(#chg-core)" strokeWidth="8" strokeLinecap="round" />
                <path d="M410 176C468 176 454 161 624 161" fill="none" stroke="url(#chg-core)" strokeWidth="8" strokeLinecap="round" />

                <circle cx="498" cy="161" r="9" fill="#22D3EE">
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />
                </circle>
                <circle cx="624" cy="161" r="9" fill="#22D3EE">
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" begin="0.25s" repeatCount="indefinite" />
                </circle>
            </svg>
        </div>
    );
}

export default function ChargingStationScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.ELECTRONICS_CHARGING}
            title="Estación de Carga"
            description="Conecta las baterías, gafas y controles a sus centros de carga correspondientes. Asegúrate de que los indicadores LED estén encendidos."
            iconName="battery_charging_full"
            headerLayout="canvas"
            layoutDensity="compact"
            heroContent={<ChargingStationHero />}
            doneFlagKey="pilot_electronics_charged"
            prerequisites={[
                {
                    key: 'global_equipment_unloaded',
                    keys: ['global_equipment_unloaded', 'closure_equipment_unload_done'],
                    label: 'Equipo descargado en base'
                },
                {
                    key: 'pilot_return_inventory_done',
                    keys: ['pilot_return_inventory_done'],
                    label: 'Inventario de retorno confirmado'
                }
            ]}
            nextClosureStep={CLOSURE_STEPS.CHECKOUT}
            allowedRoles={['pilot']}
            waitMessage="Esperando al piloto para completar la estación de carga."
            buttonLabel="Estación de carga confirmada"
            doneLabel="Carga confirmada"
            successMessage="Estación de carga confirmada."
        />
    );
}
