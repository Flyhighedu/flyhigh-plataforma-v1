'use client';

import { useMemo } from 'react';
import TacticalMapScreen from '@/components/staff/TacticalMapScreen';
import styles from './VisitPlanner.module.css';

export default function PreparationMap({ userId, schoolLocation, schoolName, onSelect, onNarrationSaved, catalog, preparation }) {
    const lat = schoolLocation?.[0], lng = schoolLocation?.[1];
    const initialCenter = useMemo(() => ({ lat, lng, zoom: 15 }), [lat, lng]);
    const referencePoint = useMemo(() => ({ id: '__school__', name: schoolName || 'Escuela', latitude: lat, longitude: lng, category: 'school', _reference: true }), [lat, lng, schoolName]);
    return <div className={styles.mapFrame} role="region" aria-label="Mapa de la experiencia">
        <TacticalMapScreen
            userId={userId}
            embedded
            preparationMode
            initialCenter={initialCenter}
            referencePoint={referencePoint}
            catalog={catalog}
            preparation={preparation}
            onNarrationSelect={onSelect}
            onNarrationSaved={onNarrationSaved}
        />
    </div>;
}
