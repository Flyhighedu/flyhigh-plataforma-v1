export const PHASES = [
    { key: 'phase2', label: 'Preescolar', grades: ['preescolar1', 'preescolar2', 'preescolar3'], guidance: 'Niñas y niños de preescolar. Una idea concreta, palabras cotidianas y una observación cercana. No uses diminutivos ni datos abstractos.' },
    { key: 'phase3', label: '1.º y 2.º de primaria', grades: ['primaria1', 'primaria2'], guidance: 'Primero y segundo de primaria. Explica una relación sencilla de causa y efecto con ejemplos observables; evita vocabulario técnico sin explicación.' },
    { key: 'phase4', label: '3.º y 4.º de primaria', grades: ['primaria3', 'primaria4'], guidance: 'Tercero y cuarto de primaria. Conecta el lugar o tema con su comunidad, función o historia mediante una relación clara y concreta.' },
    { key: 'phase5', label: '5.º y 6.º de primaria', grades: ['primaria5', 'primaria6'], guidance: 'Quinto y sexto de primaria. Presenta contexto, impacto o un matiz relevante, con lenguaje claro y sin convertirlo en una lección larga.' },
];

export const GRADES = PHASES.flatMap(phase => phase.grades.map((key, index) => ({
    key,
    label: key.startsWith('preescolar') ? `${index + 1}.º de preescolar` : `${key.slice(-1)}.º de primaria`,
    phase: phase.key,
})));

export function phaseForGrade(grade) {
    return GRADES.find(item => item.key === grade)?.phase || null;
}

export function narrationForGrade(poi, grade) {
    const phase = phaseForGrade(grade);
    const variant = phase && poi?.phase_variants?.[phase];
    if (variant?.script) return {
        ...poi,
        narrative_script: variant.script,
        audio_url: variant.audio_url || null,
        audio_duration_seconds: variant.audio_duration_seconds || null,
        audio_generated_at: variant.audio_generated_at || null,
        version_label: PHASES.find(item => item.key === phase)?.label,
        version_phase: phase,
        version_general: false,
    };
    if (poi?.narrative_script) return { ...poi, version_label: 'Versión general', version_phase: null, version_general: true };
    return { ...poi, narrative_script: null, audio_url: null, version_label: phase ? 'Versión pendiente' : 'Sin grado elegido', version_phase: phase, version_general: false };
}

export function phaseProgress(poi) {
    const variants = poi?.phase_variants || {};
    return PHASES.map(({ key }) => ({ key, script: Boolean(variants[key]?.script), audio: Boolean(variants[key]?.audio_url) }));
}
