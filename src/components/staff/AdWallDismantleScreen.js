'use client';

import ClosureTaskScreen from './ClosureTaskScreen';
import { AD_WALL_INSTALL_ILLUSTRATION_SVG } from './AuxAdWallInstallScreen';
import { CLOSURE_STEPS } from '@/constants/closureFlow';

function reverseSvgAnimationValues(svgMarkup) {
    return String(svgMarkup || '').replace(/values="([^"]+)"/g, (match, rawValues) => {
        const parts = rawValues
            .split(';')
            .map((token) => token.trim())
            .filter(Boolean);

        if (parts.length < 2) return match;
        return `values="${parts.reverse().join('; ')}"`;
    });
}

function removeInstallSuccessBadge(svgMarkup) {
    return String(svgMarkup || '').replace(
        '<g transform="translate(450, 180)">',
        '<g transform="translate(450, 180)" display="none">'
    );
}

const AD_WALL_DISMANTLE_ILLUSTRATION_SVG = removeInstallSuccessBadge(
    reverseSvgAnimationValues(AD_WALL_INSTALL_ILLUSTRATION_SVG)
);

function AdWallDismantleHero() {
    return (
        <div style={{
            width: '100%',
            maxWidth: 312,
            margin: '2px auto 6px',
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid #E2E8F0',
            boxShadow: '0 18px 38px -20px rgba(15, 23, 42, 0.2)',
            overflow: 'hidden'
        }}>
            <div dangerouslySetInnerHTML={{ __html: AD_WALL_DISMANTLE_ILLUSTRATION_SVG }} />
        </div>
    );
}

export default function AdWallDismantleScreen(props) {
    return (
        <ClosureTaskScreen
            {...props}
            screenKey={CLOSURE_STEPS.AD_WALL_DISMANTLE}
            title="Desmontar muro publicitario"
            description="Pliega lona y estructura para resguardo en contenedor."
            iconName="construction"
            headerLayout="canvas"
            layoutDensity="compact"
            heroContent={<AdWallDismantleHero />}
            checklistMetaKey="closure_ad_wall_dismantle_checks"
            doneFlagKey="aux_adwall_dismantled"
            checklistItems={[
                { id: 'canvas_dismounted', label: 'Lona desmontada' },
                { id: 'canvas_folded', label: 'Lona doblada' },
                { id: 'wall_stored', label: 'Muro plegado y guardado en funda' }
            ]}
            nextClosureStep={CLOSURE_STEPS.DRONE_STORAGE}
            allowedRoles={['assistant']}
            waitMessage="Esperando al auxiliar para desmontar el muro."
            buttonLabel="Muro desmontado"
            doneLabel="Muro desmontado"
            successMessage="Muro desmontado y sincronizado."
        />
    );
}
