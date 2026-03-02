'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

function AuxRecordingChargingHero() {
    return (
        <div className="mx-auto mb-2 w-full max-w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_36px_-20px_rgba(15,23,42,0.35)]">
            <svg viewBox="0 0 780 320" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
                <defs>
                    <linearGradient id="aux-rec-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#F0F9FF" />
                        <stop offset="100%" stopColor="#F8FAFC" />
                    </linearGradient>
                    <linearGradient id="aux-rec-core" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0284C7" />
                        <stop offset="100%" stopColor="#0EA5E9" />
                    </linearGradient>
                </defs>

                <rect width="780" height="320" fill="url(#aux-rec-bg)" />

                <rect x="58" y="78" width="202" height="170" rx="16" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="4" />
                <circle cx="130" cy="162" r="34" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="4" />
                <circle cx="130" cy="162" r="17" fill="#0EA5E9" opacity="0.35" />
                <rect x="176" y="118" width="60" height="78" rx="10" fill="#F8FAFC" stroke="#7DD3FC" strokeWidth="3" />
                <rect x="186" y="136" width="40" height="12" rx="6" fill="#38BDF8" opacity="0.3" />
                <rect x="186" y="156" width="40" height="12" rx="6" fill="#38BDF8" opacity="0.3" />

                <rect x="294" y="56" width="186" height="206" rx="18" fill="#0F172A" />
                <rect x="316" y="78" width="142" height="116" rx="12" fill="#0EA5E9" opacity="0.18" />
                <path d="M348 128H392" stroke="#22D3EE" strokeWidth="8" strokeLinecap="round" />
                <path d="M370 108V148" stroke="#22D3EE" strokeWidth="8" strokeLinecap="round" />
                <circle cx="388" cy="220" r="12" fill="#38BDF8" />

                <rect x="540" y="82" width="164" height="164" rx="16" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="4" />
                <rect x="566" y="110" width="24" height="72" rx="12" fill="#38BDF8" />
                <rect x="596" y="124" width="74" height="44" rx="12" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="3" />
                <rect x="610" y="178" width="46" height="12" rx="6" fill="#38BDF8" opacity="0.35" />

                <path d="M488 130C532 130 528 152 558 152" fill="none" stroke="url(#aux-rec-core)" strokeWidth="8" strokeLinecap="round" />
                <path d="M488 188C532 188 528 170 610 170" fill="none" stroke="url(#aux-rec-core)" strokeWidth="8" strokeLinecap="round" />

                <circle cx="558" cy="152" r="8" fill="#22D3EE">
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="610" cy="170" r="8" fill="#22D3EE">
                    <animate attributeName="opacity" values="1;0.35;1" dur="1.5s" begin="0.25s" repeatCount="indefinite" />
                </circle>
            </svg>
        </div>
    );
}

export default function AuxRecordingChargingScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.ELECTRONICS_CHARGING}
            title="Carga de Audiovisuales"
            description="Asegúrate de conectar correctamente la cámara y los micrófonos a sus estaciones de recarga para la siguiente jornada."
            iconName="videocam"
            headerLayout="canvas"
            layoutDensity="compact"
            heroContent={<AuxRecordingChargingHero />}
            doneFlagKey="aux_recording_charging_done"
            doneAtKey="aux_recording_charging_done_at"
            doneByKey="aux_recording_charging_done_by"
            doneByNameKey="aux_recording_charging_done_by_name"
            prerequisites={[
                {
                    key: 'global_equipment_unloaded',
                    keys: ['global_equipment_unloaded', 'closure_equipment_unload_done'],
                    label: 'Equipo descargado en base'
                },
                {
                    key: 'pilot_return_inventory_done',
                    keys: ['pilot_return_inventory_done', 'closure_return_inventory_done'],
                    label: 'Inventario de retorno confirmado por piloto'
                }
            ]}
            nextClosureStep={CLOSURE_STEPS.CHECKOUT}
            allowedRoles={['assistant']}
            waitMessage="Esperando al auxiliar para conectar equipo de grabación."
            buttonLabel="Equipo de grabación conectado"
            doneLabel="Grabación conectada"
            successMessage="Equipo de grabación conectado."
            extraMetaPatch={({ now, userId, actorName }) => ({
                closure_recording_charging_done: true,
                closure_recording_charging_done_at: now,
                closure_recording_charging_done_by: userId,
                closure_recording_charging_done_by_name: actorName
            })}
        />
    );
}
