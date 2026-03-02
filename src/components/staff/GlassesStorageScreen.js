'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

export default function GlassesStorageScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.GLASSES_STORAGE}
            title="Guardar gafas"
            description="Retira, limpia y guarda gafas para evitar danos en traslado a base."
            iconName="visibility"
            checklistMetaKey="global_glasses_storage_checks"
            doneFlagKey="global_glasses_stored"
            checklistItems={[
                { id: 'collect_glasses', label: 'Recolectar gafas de cada asiento' },
                { id: 'verify_lenses', label: 'Verificar lentes sin danos visibles' },
                { id: 'store_case', label: 'Guardar gafas y cableado en estuche' }
            ]}
            nextClosureStep={CLOSURE_STEPS.HEADPHONES_STORAGE}
            lockToPilot={true}
            controlScope="global_glasses_storage"
            buttonLabel="Gafas resguardadas"
            doneLabel="Gafas resguardadas"
            successMessage="Checklist global de gafas completado."
        />
    );
}
