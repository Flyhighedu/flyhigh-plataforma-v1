import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinates, snapshot, moveItem, mergePreparedSources } from '../src/lib/narration-preparation.mjs';
import { preparationItem as item, buildPreparationSequence, derivePreparation, normalizePreparationItems, preparationContentChanged, clusterMapPoints, groupPreparationMapPoints, hasCreatedNarration } from '../src/lib/preparation-model.mjs';
import { createPreparationStore, restorePreparation } from '../src/lib/preparation-store.mjs';
const catalog = [
 {id:'a',name:'Huatápera',latitude:19.417,longitude:-102.055,audio_url:'https://example.test/a.wav',narrative_script:'Museo',audio_duration_seconds:20},
 {id:'b',name:'Cerro',latitude:19.43,longitude:-102.07,audio_url:'https://example.test/b.wav'},
 {id:'c',name:'Parque',latitude:19.416,longitude:-102.057,audio_url:'https://example.test/c.wav'},
 {id:'d',name:'Tema',is_general_topic:true,audio_url:'https://example.test/d.wav'},
 {id:'e',name:'Sin coordenadas',latitude:null,longitude:null,audio_url:'https://example.test/e.wav'},
];
const context={phase_id:'general',school_location:{latitude:19.415,longitude:-102.054}};
const items=[item(catalog[0]),item(catalog[1],'general','reference'),item(catalog[2])];
const initial={items,context,revision:2,status:'draft',dirty:false};
const ack=(sent,status='draft')=>({items:sent.items,preparation_context:sent.context,revision:sent.revision+1,status});
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function store(overrides={}) {return createPreparationStore({initial,persist:async sent=>ack(sent),cache:()=>{},clearCache:()=>{},delay:1,...overrides});}
test('One narrative sequence derives school → physical stops → school, excluding references and themes',()=>{
 const derived=derivePreparation([...items,item(catalog[3])],context);
 assert.deepEqual(derived.geometry,[context.school_location,items[0].location,items[2].location,context.school_location]);
 assert.deepEqual(derived.references.map(p=>p.id),['b']);assert.equal(derived.canConfirm,true);
 assert.deepEqual(derivePreparation(moveItem(items,1,1),context).geometry,derived.geometry);
 assert.notDeepEqual(derivePreparation(moveItem(items,2,-1).reverse(),context).geometry,derived.geometry);
 assert.deepEqual(derivePreparation(items,{}).geometry,[]);
});
test('Removing a selected stop redraws the canonical route and shifts the remaining order',()=>{
 const remaining=items.filter(item=>item.id!=='a');
 const derived=derivePreparation(remaining,context);
 assert.deepEqual(remaining.map(item=>item.id),['b','c']);
 assert.deepEqual(derived.geometry,[context.school_location,items[2].location,context.school_location]);
 assert.deepEqual(derived.references.map(item=>item.id),['b']);
});
test('Geography rejects absent, whitespace, boolean and out-of-range data, keeping valid zero',()=>{
 for(const pair of [[null,0],[' ',0],[false,0],[[],0],[91,0],[0,181],[undefined,0]]) assert.equal(coordinates(...pair),null);
 assert.deepEqual(coordinates('0','0'),[0,0]);
 const missing=[item(catalog[4])];assert.equal(derivePreparation(missing,context).canConfirm,false);
 assert.equal(derivePreparation(missing,context).points.length,0);
 assert.throws(()=>buildPreparationSequence(['e'],catalog,'ready'),/ubicación/);
 assert.equal(buildPreparationSequence(['e'],catalog,'draft')[0].location,null);
});
test('Legacy metadata upgrades without replacing narratives or ordering; explicit intent overrides previous',()=>{
 const legacy=[snapshot(catalog[1]),{...snapshot(catalog[0]),narrative_script:'Contenido guardado'}];
 const upgraded=normalizePreparationItems(legacy,catalog);
 assert.deepEqual(upgraded.map(p=>p.id),['b','a']);assert.equal(upgraded[0].behavior,'route');
 assert.equal(upgraded[1].narrative_script,'Contenido guardado');assert.equal(legacy[0].model_version,undefined);
 assert.equal(buildPreparationSequence(['b'],catalog,'draft',[items[1]])[0].behavior,'reference');
 assert.equal(buildPreparationSequence([{id:'b',behavior:'route'}],catalog,'draft',[items[1]])[0].behavior,'route');
 assert.throws(()=>buildPreparationSequence([{id:'a',behavior:'fly'}],catalog,'draft'));
});
test('Place preparation detects geography, name, topic or deleted source changes, independently of audio',()=>{
 assert.equal(preparationContentChanged(items,catalog),false);
 for(const change of [{latitude:20},{name:'Otro nombre'},{is_general_topic:true}]) assert.equal(preparationContentChanged(items,[{...catalog[0],...change},...catalog.slice(1)]),true);
 for(const change of [{audio_duration_seconds:21},{audio_url:'https://example.test/new.wav'}]) assert.equal(preparationContentChanged(items,[{...catalog[0],...change},...catalog.slice(1)]),false);
 assert.equal(preparationContentChanged(items,catalog.slice(1)),true);
 const merged=mergePreparedSources(catalog,[items[1]]);assert.equal(merged[1].behavior,undefined);assert.equal(merged[1].location,undefined);
});
test('A place without audio can be added and confirmed; location and a nonempty route are still required',()=>{
 const silent={...catalog[0],audio_url:null,narrative_script:null};
 const prepared=buildPreparationSequence([{id:'a',behavior:'route'}],[silent],'ready');
 assert.equal(prepared[0].audio_url,null);
 assert.equal(derivePreparation(prepared,context).canConfirm,true);
 assert.throws(()=>buildPreparationSequence([],catalog,'ready'),/al menos un lugar/);
});
test('Display clustering neither loses POIs nor changes canonical order',()=>{
 const groups=clusterMapPoints(catalog.slice(0,3),p=>({x:p.id==='c'?200:1,y:1}),64);
 assert.deepEqual(groups.map(g=>g.map(p=>p.id)),[['a','b'],['c']]);assert.deepEqual(items.map(p=>p.id),['a','b','c']);
});
test('A narrated place stays visible while only unexplored places cluster at distant zoom',()=>{
 const points=[catalog[0],{id:'new-1',name:'Iglesia',source:'osm-radar'},
  {id:'new-2',name:'Puente',source:'osm-radar'}];
 const project=()=>({x:1,y:1});
 const far=groupPreparationMapPoints(points,project,12);
 assert.deepEqual(far.narrated.map(p=>p.id),['a']);
 assert.deepEqual(far.groups.map(group=>group.map(p=>p.id)),[['new-1','new-2']]);
 const close=groupPreparationMapPoints(points,project,14);
 assert.deepEqual(close.groups.map(group=>group.map(p=>p.id)),[['new-1'],['new-2']]);
});
test('Map distinguishes created narration from an unexplored place across educational versions',()=>{
 assert.equal(hasCreatedNarration(catalog[0]),true);
 assert.equal(hasCreatedNarration({...catalog[0],narrative_script:null,audio_url:null}),false);
 assert.equal(hasCreatedNarration({id:'phase-only',narrative_versions:{phase_2:{narrative_script:'Historia'}}}),true);
 assert.equal(hasCreatedNarration({id:'osm_node_1',source:'osm-radar',narrative_script:'untrusted'}),false);
 assert.equal(hasCreatedNarration({id:'empty',narrative_script:'  '}),false);
});
test('A late acknowledgment preserves newer edits and serializes the next write with the new revision',async()=>{
 const calls=[];let resolveFirst;
 const s=store({persist:async sent=>{calls.push(sent);if(calls.length===1)return new Promise(resolve=>{resolveFirst=()=>resolve(ack(sent));});return ack(sent);}});s.start();
 s.edit(items.slice(0,2));const saving=s.save();s.edit([items[2],items[0]]);assert.equal(s.getSnapshot().items[0].id,'c');
 await s.save();assert.equal(calls.length,1);resolveFirst();await saving;
 assert.deepEqual(s.getSnapshot().items.map(p=>p.id),['c','a']);assert.equal(s.getSnapshot().revision,3);
 await tick();assert.equal(calls.length,2);assert.equal(calls[1].revision,3);assert.equal(s.getSnapshot().saveState,'saved');s.stop();
});
test('Undo covers add, remove, reorder and behavior, including edits during saving',async()=>{
 const s=store();
 for(const next of [[...items,item(catalog[3])],items.slice(1),moveItem(items,0,1),items.map((p,i)=>i? p:{...p,behavior:'reference'})]){
  s.edit(next);assert.equal(s.getSnapshot().canUndo,true);s.undo();assert.deepEqual(s.getSnapshot().items,items);assert.equal(s.getSnapshot().canUndo,false);
 }
 assert.equal(s.getSnapshot().status,'draft');assert.equal(s.getSnapshot().context.review,null);
});
test('Network failure retains the local draft and retry saves the current version',async()=>{
 let fail=true,cache;
 const s=store({cache:value=>{cache=value;},persist:async sent=>{if(fail)throw Error('Sin conexión');return ack(sent);}});
 s.edit(items.slice(1));await s.save();assert.equal(s.getSnapshot().saveState,'error');assert.equal(cache.items.length,2);
 s.edit([items[1]]);fail=false;await s.save();assert.equal(s.getSnapshot().saveState,'saved');assert.equal(s.getSnapshot().items.length,1);
});
test('Conflict blocks writes, preserves a recoverable copy, and restores on the newly loaded revision',async()=>{
 let recovery,cleared=false;
 const s=store({persist:async()=>{throw Object.assign(Error('Conflicto'),{status:409});},saveRecovery:v=>{recovery=v;},clearRecovery:()=>{cleared=true;}});
 s.edit([items[1]]);await s.save();s.edit([]);assert.equal(s.getSnapshot().items.length,1);
 s.loadSaved({...ack({...initial,revision:8}),items:[items[0]]});assert.equal(s.getSnapshot().revision,9);assert.deepEqual(recovery.items,[items[1]]);
 s.recover();assert.deepEqual(s.getSnapshot().items,[items[1]]);assert.equal(s.getSnapshot().revision,9);assert.equal(s.getSnapshot().dirty,true);assert.equal(cleared,true);
});
test('Recovery storage failure never discards the local draft',()=>{
 const s=store({saveRecovery:()=>{throw Error('Quota');}});s.edit([items[1]]);s.loadSaved(ack(initial));
 assert.deepEqual(s.getSnapshot().items,[items[1]]);assert.match(s.getSnapshot().localError,/conservar/);
});
test('Reload restores pending work, detects revision/date conflicts, and ignores corrupt cache',()=>{
 const plan={...ack(initial),visit_date:'2026-09-28'};const visit={fecha_programada:'2026-09-28'};
 const cached={items:[items[1]],context,revision:3,date:visit.fecha_programada};
 assert.equal(restorePreparation(plan,cached,visit,catalog).dirty,true);assert.equal(restorePreparation(plan,cached,visit,catalog).conflict,false);
 assert.equal(restorePreparation(plan,{...cached,revision:2},visit,catalog).conflict,true);
 assert.equal(restorePreparation(plan,{...cached,date:'2026-09-29'},visit,catalog).conflict,true);
 assert.equal(restorePreparation(plan,{...cached,items:[null]},visit,catalog).dirty,false);
 const legacy=restorePreparation({...plan,items:[snapshot(catalog[0])]},null,visit,catalog);assert.equal(legacy.items[0].behavior,'route');assert.ok(legacy.items[0].location);
});
