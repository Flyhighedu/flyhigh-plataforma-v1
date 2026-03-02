'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { TruckIllustration } from './UnloadScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

function EquipmentUnloadHero() {
    return (
        <div className="mx-auto mb-2 w-full max-w-[340px]">
            <TruckIllustration />
        </div>
    );
}

export default function EquipmentUnloadScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.EQUIPMENT_UNLOAD}
            title="Descargar equipo"
            description="Descarga en base y coloca el equipo directamente en estaciones de recarga."
            iconName="unarchive"
            headerLayout="canvas"
            layoutDensity="compact"
            heroContent={<EquipmentUnloadHero />}
            checklistMetaKey="closure_equipment_unload_checks"
            doneFlagKey="global_equipment_unloaded"
            checklistItems={[
                { id: 'unload_electronics', label: 'Bajar equipo electrónico (contenedores)' },
                { id: 'equipment_at_charging_stations', label: 'Equipo ubicado en estaciones de recarga' }
            ]}
            prerequisites={[
                {
                    key: 'aux_arrival_notified',
                    keys: ['aux_arrival_notified', 'closure_arrival_notification_done'],
                    label: 'Llegada notificada en base'
                }
            ]}
            nextClosureStep={CLOSURE_STEPS.RETURN_INVENTORY}
            allowedRoles={['assistant', 'pilot', 'teacher']}
            waitMessage="Esperando al equipo para completar descarga."
            buttonLabel="Descarga completada"
            doneLabel="Descarga completada"
            successMessage="Descarga de equipo completada."
        />
    );
}
