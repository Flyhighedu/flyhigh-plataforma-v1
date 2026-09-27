import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, PHASES, defaultGradeForNarration, narrationForGrade, phaseForGrade, phaseProgress } from '../src/lib/narration-phases.mjs';

test('los nueve grados se agrupan en las cuatro fases de educación básica', () => {
    assert.equal(GRADES.length, 9);
    assert.deepEqual(PHASES.map(phase => phase.grades.length), [3, 2, 2, 2]);
    assert.equal(phaseForGrade('primaria4'), 'phase4');
    assert.equal(phaseForGrade('primaria6'), 'phase5');
    assert.equal(phaseForGrade('otro'), null);
});

test('una variante incompleta no toma el audio general o de otra fase', () => {
    const poi = { narrative_script: 'Guion general', audio_url: 'https://audio.test/general.wav', phase_variants: { phase3: { script: 'Guion fase 3' } } };
    const resolved = narrationForGrade(poi, 'primaria1');
    assert.equal(resolved.narrative_script, 'Guion fase 3');
    assert.equal(resolved.audio_url, null);
    assert.equal(resolved.version_general, false);
    assert.equal(narrationForGrade(poi, 'primaria3').version_label, 'Versión general');
    assert.equal(phaseProgress(poi).filter(item => item.script).length, 1);
});

test('el audio general heredado se puede escuchar aunque falte su transcripción', () => {
    const resolved = narrationForGrade({ id: 'legacy', audio_url: 'https://audio.test/legacy.wav' }, null);
    assert.equal(resolved.version_label, 'Versión general');
    assert.equal(resolved.audio_url, 'https://audio.test/legacy.wav');
});

test('la ficha abre el contenido existente sin pedir grado', () => {
    assert.equal(defaultGradeForNarration({ narrative_script: 'Ya existe' }), null);
    assert.equal(defaultGradeForNarration({ audio_url: 'https://audio.test/general.wav' }), null);
    const phaseOnly = { phase_variants: { phase4: { script: 'Guion de tercero y cuarto' } } };
    assert.equal(defaultGradeForNarration(phaseOnly), 'primaria3');
    assert.equal(narrationForGrade(phaseOnly, defaultGradeForNarration(phaseOnly)).narrative_script, 'Guion de tercero y cuarto');
});
