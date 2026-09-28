'use client';

import { useMemo } from 'react';
import TacticalMapScreen from '@/components/staff/TacticalMapScreen';
import styles from './VisitPlanner.module.css';

export default function PreparationMap({ userId, schoolLocation, schoolName, onSelect, onNarrationSaved }) {
    const initialCenter = useMemo(() => ({ lat: schoolLocation[0], lng: schoolLocation[1], zoom: 15 }), [schoolLocation]);
    const referencePoint = useMemo(() => ({ id: '__school__', name: schoolName || 'Escuela', latitude: schoolLocation[0], longitude: schoolLocation[1], category: 'school', _reference: true }), [schoolLocation, schoolName]);
    return <div className={styles.mapFrame}>
        <TacticalMapScreen
            userId={userId}
            embedded
            preparationMode
            initialCenter={initialCenter}
            referencePoint={referencePoint}
            onNarrationSelect={onSelect}
            onNarrationSaved={onNarrationSaved}
        />
    </div>;
}
