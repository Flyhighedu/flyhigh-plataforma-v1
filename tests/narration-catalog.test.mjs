import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogAudio, catalogStatus, filterNarrations, findExistingPlace } from '../src/lib/narration-catalog.mjs';
const official = { id:'official_1', name:'Ángel de la Independencia', is_official:true, latitude:19.42, longitude:-99.16, narrative_script:'General', audio_url:'general.mp3' };
const personal = { id:'2', name:'El agua', is_general_topic:true, narrative_versions:{ phase_2:{ narrative_script:'Preescolar', audio_url:'phase2.mp3' } } };
test('catalog combines accent-insensitive search, ownership, content and pending filters', () => {
    assert.deepEqual(filterNarrations([official, personal], { query:'angel', source:'official', kind:'places', pending:true }), [official]);
    assert.deepEqual(filterNarrations([official, personal], { source:'personal', kind:'topics' }), [personal]);
    assert.deepEqual(filterNarrations([official, personal], { source:'official', kind:'topics' }), []);
});
test('audio selection never substitutes general for a missing educational phase', () => {
    assert.equal(catalogAudio(official,'phase_2'),null);
    assert.equal(catalogAudio(official,'general').audio_url,'general.mp3');
    assert.equal(catalogAudio(personal,'phase_2').audio_url,'phase2.mp3');
    assert.equal(catalogStatus(official).label,'Solo narración general');
    assert.equal(catalogStatus(personal).ready,false);
});
test('duplicate discovery requires matching name and nearby coordinates, never a topic', () => {
    assert.equal(findExistingPlace([official], {name:'Angel de la Independencia', latitude:19.4201, longitude:-99.16}),official);
    assert.equal(findExistingPlace([official], {...official,latitude:20}),null);
    assert.equal(findExistingPlace([official], {...official,name:'Otro lugar'}),null);
    assert.equal(findExistingPlace([personal], {...personal,latitude:0,longitude:0}),null);
});
