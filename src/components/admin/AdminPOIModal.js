'use client';

import PhaseNarrativeEditor from '@/components/shared/PhaseNarrativeEditor';

export default function AdminPOIModal({ poi, ...props }) {
    if (!poi) return null;
    return <PhaseNarrativeEditor key={poi.id || 'new'} poi={poi} embedded {...props} />;
}
