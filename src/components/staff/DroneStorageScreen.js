'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

export default function DroneStorageScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.DRONE_STORAGE}
            title="Resguardar dron"
            description="Guarda dron y control para evitar golpes durante el retorno."
            iconName="flight"
            checklistMetaKey="global_drone_storage_checks"
            doneFlagKey="pilot_drones_stored"
            checklistItems={[
                { id: 'store_drone_and_controller', label: 'Apagar dron y control y meter a sus contenedores y maletines' },
                { id: 'landing_pad_stored', label: 'Pista de aterrizaje guardada' },
                { id: 'cones_stacked', label: 'Conos apilados' }
            ]}
            nextClosureStep={CLOSURE_STEPS.GLASSES_STORAGE}
            allowedRoles={['pilot']}
            waitMessage="Esperando al piloto para guardar el dron."
            buttonLabel="Pista y Equipo Resguardados"
            doneLabel="Pista y equipo resguardados"
            successMessage="Resguardo de dron completado."
        />
    );
}
