import test from 'node:test';
import assert from 'node:assert/strict';
import { researchDocument, replaceResearchDocument } from '../src/lib/research-document.mjs';

test('reader removes bibliography, citation markers and raw links without dropping the narrative', () => {
    const raw = '# El río\n\nNace en un [manantial](https://example.org/agua). [1]\n\n## Fuentes de la búsqueda (verificar los datos en sus páginas):\n- https://example.org/agua\n\n## Vida local\n\nLa comunidad cuida el agua.';
    const result = researchDocument(raw);
    assert.equal(result.text, '# El río\n\nNace en un manantial. \n\n## Vida local\n\nLa comunidad cuida el agua.');
    assert.ok(!result.text.includes('https://'));
    assert.ok(!result.text.includes('Fuentes'));
    assert.match(result.references, /https:\/\/example.org\/agua/);
    assert.match(raw, /\[manantial\]/);
});

test('editing keeps provenance without accumulating bibliography headings or URLs', () => {
    const raw = 'Texto original. Fuente: CONANP.\n\nFuentes de la búsqueda:\n- https://example.org/agua';
    assert.equal(researchDocument(raw).text, 'Texto original.');
    let edited = raw;
    for (let i = 0; i < 10; i++) edited = replaceResearchDocument(edited, 'Texto corregido.');
    assert.equal(researchDocument(edited).text, 'Texto corregido.');
    assert.equal(edited.match(/Fuentes de la búsqueda/g).length, 1);
    assert.equal(edited.match(/https:\/\/example.org\/agua/g).length, 1);
    assert.match(edited, /CONANP/);
});

test('ordinary paragraphs and heading names that mention water sources stay intact', () => {
    const text = '## Fuentes de agua\n\nLas fuentes de agua son parte del paisaje.\n\n## Historia\n\nTexto con fechas 1998 y 2020.';
    assert.equal(researchDocument(text).text, text);
    assert.equal(replaceResearchDocument(text, 'Texto nuevo.'), 'Texto nuevo.');
});
