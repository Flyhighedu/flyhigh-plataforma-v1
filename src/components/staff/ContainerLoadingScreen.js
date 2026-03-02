'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

export default function ContainerLoadingScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.CONTAINER_LOADING}
            title="Cargar contenedores"
            description="Carga equipo en orden para salida a base. Espera hasta tener vehiculo listo."
            iconName="inventory"
            checklistMetaKey="global_container_loading_checks"
            doneFlagKey="pilot_containers_loaded"
            checklistItems={[
                { id: 'load_electronics', label: 'Subir contenedores de electronica' },
                { id: 'load_structures', label: 'Subir estructuras y accesorios' },
                { id: 'secure_containers', label: 'Asegurar contenedores para traslado' }
            ]}
            prerequisites={[
                {
                    key: 'aux_vehicle_positioned',
                    keys: ['aux_vehicle_positioned', 'closure_vehicle_positioning_done'],
                    label: 'Vehiculo posicionado para carga'
                }
            ]}
            nextClosureStep={CLOSURE_STEPS.RETURN_ROUTE}
            allowedRoles={['pilot']}
            waitMessage="Esperando al piloto para completar la carga de contenedores."
            buttonLabel="Carga completada"
            doneLabel="Carga completada"
            successMessage="Carga final completada, ruta de retorno habilitada."
        />
    );
}
