'use client';

import PhaseNarrativeEditor from '@/components/shared/PhaseNarrativeEditor';

export default function POIDetailModal({ isOpen, poi, readOnly = false, ...props }) {
    if (!isOpen || !poi) return null;
    return <PhaseNarrativeEditor key={poi.id || 'new'} poi={poi} readOnly={readOnly || !!poi.is_official} {...props} />;
}
