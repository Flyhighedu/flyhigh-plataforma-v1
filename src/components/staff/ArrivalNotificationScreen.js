'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

export default function ArrivalNotificationScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.ARRIVAL_NOTIFICATION}
            title="Notificar llegada a base"
            description="Avisa al equipo de base para habilitar descarga y recepcion."
            iconName="campaign"
            checklistMetaKey="closure_arrival_notification_checks"
            doneFlagKey="aux_arrival_notified"
            checklistItems={[
                { id: 'notify_base', label: 'Notificar hora estimada de llegada' },
                { id: 'confirm_access', label: 'Confirmar acceso y punto de descarga' }
            ]}
            prerequisites={[
                {
                    key: 'aux_return_route_started',
                    keys: ['aux_return_route_started', 'closure_return_route_done'],
                    label: 'Ruta de retorno iniciada'
                }
            ]}
            nextClosureStep={CLOSURE_STEPS.EQUIPMENT_UNLOAD}
            allowedRoles={['assistant']}
            waitMessage="Esperando al auxiliar para notificar llegada a base."
            buttonLabel="Llegada notificada"
            doneLabel="Llegada notificada"
            successMessage="Llegada notificada a base."
        />
    );
}
