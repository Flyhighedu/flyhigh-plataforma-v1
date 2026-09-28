'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, BookOpen, Check, Headphones, MapPin, Plus, X, Undo2, Eye } from 'lucide-react';
import { coordinates, durationLabel, MAX_SEQUENCE_ITEMS, snapshot, usableAudio, visitLabel, mergePreparedSources } from '@/lib/narration-preparation.mjs';
import { preparationItem, preparationContentChanged, derivePreparation, normalizePreparationItems } from '@/lib/preparation-model.mjs';
import { EDUCATION_PHASES, educationPhase } from '@/lib/education-phases.mjs';
import { PreparationShell, LoadingPreparation, Notice, usePreparationData, secondary } from './PreparationUI';
import NarrationLibrary, { PreparationDialog } from './NarrationLibrary';
import Rehearsal from './Rehearsal';
import VisitSequence from './VisitSequence';
import TakeoffMap from './TakeoffMap';
import useNarrationAudio from './useNarrationAudio';
import useSequencePlan from './useSequencePlan';
import styles from './VisitPlanner.module.css';
const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr:false, loading:() => <p role="status">Cargando mapa de la escuela…</p> });
export default function VisitScreen({ visitId, flightRehearsalEnabled = false }) {
    const { data, loading, error, retry } = usePreparationData(visitId);
    if (loading || error) return <PreparationShell title="Preparar visita" back="/staff/cronograma" backLabel="Cronograma">{loading ? <LoadingPreparation/> : <Notice action={<button className={secondary} onClick={retry}>Reintentar</button>}>{error}</Notice>}</PreparationShell>;
    return <VisitEditor key={visitId + ':' + data.userId} visit={data.visits[0]} data={data} flightRehearsalEnabled={flightRehearsalEnabled}/>;
}
function VisitEditor({ visit, data, flightRehearsalEnabled }) {
    const initialPlan = data.plans.find(p => p.visit_id === visit.id);
    const plan = useSequencePlan({ visit, userId:data.userId, initialPlan, catalog:data.catalog });
    const [catalogUpdates,setCatalogUpdates] = useState([]);
    const catalog = useMemo(() => {
        const byId = new Map(data.catalog.map(poi => [String(poi.id),poi]));
        catalogUpdates.forEach(poi => byId.set(String(poi.id),poi));
        return mergePreparedSources([...byId.values()], plan.savedSources);
    }, [data.catalog,plan.savedSources,catalogUpdates]);
    const audio = useNarrationAudio();
    const [mobileView,setMobileView] = useState('map');
    const [picker,setPicker] = useState(false);
    const [rehearsing,setRehearsing] = useState(false);
    const [locating,setLocating] = useState(false);
    const [selected,setSelected] = useState(null);
    const [pendingBehavior,setPendingBehavior] = useState('route');
    const [reusing,setReusing] = useState(false);
    const [levelChange,setLevelChange] = useState(null);
    const [preferences,setPreferences] = useState(() => Object.fromEntries((data.preferences || []).map(item => [item.poi_id,item.behavior])));
    const [preferenceState,setPreferenceState] = useState({ busy:false, message:'' });
    const phaseId = plan.context.phase_id;
    const phase = educationPhase(phaseId);
    const school = plan.context.school_location;
    const lat = school?.latitude, lng = school?.longitude;
    const location = useMemo(() => coordinates(lat,lng), [lat,lng]);
    const suggestedSchoolLocation = coordinates(visit.ubicacion_lat,visit.ubicacion_lng);
    const choosing = locating || !location;
    const derived = useMemo(() => derivePreparation(plan.items,plan.context), [plan.items,plan.context]);
    const mapPreparation = useMemo(() => ({ items:plan.items, geometry:derived.geometry, activeId:selected }), [plan.items,derived.geometry,selected]);
    const versions = useMemo(() => catalog.map(poi => ({ ...poi, ...snapshot(poi,phaseId) })), [catalog,phaseId]);
    const selectedIds = useMemo(() => new Set(plan.items.map(item => item.id)), [plan.items]);
    const selectedItem = plan.items.find(item => item.id === selected);
    const current = versions.find(poi => String(poi.id) === selected) || selectedItem;
    const behavior = selectedItem?.behavior || pendingBehavior;
    const stale = preparationContentChanged(plan.items,catalog);
    const ready = plan.status === 'ready' && !plan.dirty && !stale;
    const playable = plan.items.length > 0 && plan.items.every(item => usableAudio(item.audio_url)) && !stale;
    const canConfirm = derived.canConfirm && !stale && !plan.dirty && plan.saveState === 'saved';
    const duration = plan.items.length && plan.items.every(item => Number(item.audio_duration_seconds)>0)
        ? durationLabel(plan.items.reduce((sum,item) => sum + Number(item.audio_duration_seconds),0)) + ' de narración' : 'Duración de narraciones por confirmar';
    const saveLabel = plan.saveState === 'saving' ? 'Guardando cambios…' : plan.saveState === 'pending' ? 'Cambios pendientes' : plan.saveState === 'conflict' ? 'Revisión necesaria' : plan.saveState === 'error' ? 'Guardado pendiente' : plan.revision ? 'Guardado' : 'Borrador';
    const previous = data.plans.filter(p => p.visit_id !== visit.id && p.items.length).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
    const select = id => { audio.stop(); setSelected(String(id)); setPendingBehavior(preferences[String(id)] || 'route'); setPreferenceState({busy:false,message:''}); setMobileView('map'); };
    const add = (poi, intent = preferences[String(poi.id)] || 'route') => {
        if (plan.locked || plan.items.length >= MAX_SEQUENCE_ITEMS || selectedIds.has(String(poi.id))) return;
        const source = catalog.find(item => String(item.id) === String(poi.id));
        if (!source || !usableAudio(snapshot(source,phaseId).audio_url)) return;
        plan.edit([...plan.items,preparationItem(source,phaseId,intent)], undefined, `${poi.name} se agregó a la experiencia`);
    };
    const changeBehavior = value => {
        if (selectedItem) plan.edit(plan.items.map(item => item.id === selected ? {...item,behavior:value} : item), undefined,
            value === 'reference' ? `${current.name} es una referencia. El recorrido no pasa por ese punto.` : `${current.name} es un punto de ruta`);
        else setPendingBehavior(value);
    };
    const rememberBehavior = async () => {
        const id = selected, intent = behavior;
        setPreferenceState({busy:true,message:''});
        try {
            const response = await fetch('/api/staff/preparation', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({poiId:id,behavior:intent})});
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'No se pudo recordar esta opción.');
            setPreferences(previous => ({...previous,[id]:intent}));
            setPreferenceState({busy:false,message:'Recordado para tus próximas visitas. Puedes cambiarlo en cada una.'});
        } catch (error) { setPreferenceState({busy:false,message:error.message}); }
    };
    const refreshItems = (items, nextPhase = phaseId) => items.map(item => {
        const source = catalog.find(poi => String(poi.id) === item.id);
        return source ? preparationItem(source,nextPhase,item.behavior) : item;
    });
    const changePhase = next => { audio.stop(); plan.edit(refreshItems(plan.items,next),{...plan.context,phase_id:next},'Nivel de narraciones actualizado'); setLevelChange(null); };
    const summary = `${derived.points.length} ${derived.points.length === 1 ? 'punto de ruta' : 'puntos de ruta'} · ${derived.references.length} ${derived.references.length === 1 ? 'referencia' : 'referencias'}`;
    return <main className={styles.planner} data-mobile-view={mobileView}>
        <header className={styles.header}>
            <div className={styles.heading}><Link href="/staff/cronograma" aria-label="Volver al cronograma"><ArrowLeft size={20}/></Link><div><small>PREPARAR EXPERIENCIA · {visitLabel(visit.fecha_programada)}</small><h1>{visit.nombre_escuela}</h1></div>
                {location && <button disabled={plan.locked} onClick={() => {audio.stop();setLocating(true);setMobileView('map');}} aria-label="Cambiar ubicación de la escuela"><MapPin size={20}/></button>}
            </div>
        </header>
        <div className={styles.statusBar}><p role="status" aria-live="polite">{plan.message || (school ? 'La escuela es el inicio y el regreso.' : 'Confirma dónde está la escuela.')}</p><button className={styles.undo} disabled={!plan.canUndo || plan.locked} onClick={plan.undo}><Undo2 size={16}/>Deshacer</button><span className={styles.save}>{saveLabel}</span></div>
        {plan.error && <div className={styles.notice} role="alert">{plan.error}<button onClick={plan.saveState === 'conflict' ? plan.loadSaved : plan.retry}>{plan.saveState === 'conflict' ? 'Revisar versión guardada' : 'Reintentar guardado'}</button></div>}
        {plan.localError && <p role="alert" className={styles.notice}>{plan.localError}</p>}
        {plan.recoverable && <div className={styles.notice}>Conservamos tu borrador anterior. Puedes usarlo para reemplazar esta versión.<button disabled={plan.locked} onClick={plan.recover}>Usar mi borrador</button></div>}
        {choosing ? <section className={styles.locationPicker}><p className={styles.locationHint}>Coloca la escuela bajo el marcador. Será el inicio y el regreso de tu experiencia.</p><TakeoffMap purpose="school" schoolName={visit.nombre_escuela} initial={location ? {latitude:lat,longitude:lng} : suggestedSchoolLocation ? {latitude:suggestedSchoolLocation[0],longitude:suggestedSchoolLocation[1]} : null} busy={plan.locked} onCancel={location ? () => setLocating(false) : undefined} onConfirm={point => {plan.edit(plan.items,{...plan.context,school_location:point},'Escuela confirmada como inicio y regreso');setLocating(false);}}/></section>
        : <>
            <div className={styles.toolbar}><label><Headphones size={16}/><select aria-label="Nivel de las narraciones" value={phaseId} disabled={plan.locked} onChange={event => plan.items.length ? setLevelChange(event.target.value) : changePhase(event.target.value)}>{EDUCATION_PHASES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className={styles.secondary} onClick={() => {audio.stop();setPicker(true);}}><Plus size={17}/>Agregar lugares</button><div className={styles.mobileTabs} aria-label="Vista de preparación"><button aria-pressed={mobileView==='map'} onClick={() => setMobileView('map')}>Mapa</button><button aria-pressed={mobileView==='sequence'} onClick={() => setMobileView('sequence')}>Secuencia · {plan.items.length}</button></div></div>
            <div className={styles.workspace}>
                <div className={styles.mapColumn}><PreparationMap userId={data.userId} schoolLocation={location} schoolName={visit.nombre_escuela} catalog={catalog} preparation={mapPreparation} onSelect={poi => select(poi.id)} onNarrationSaved={poi => {if(!poi?.id)return;setCatalogUpdates(previous => [...previous.filter(item => String(item.id)!==String(poi.id)),poi]);select(poi.id);}}/>
                    <div className={styles.legend}><span><i/> Recorrido físico</span><span><Eye size={13}/> Referencia: sin desplazamiento</span></div>
                </div>
                <aside className={styles.sidePanel} aria-label="Preparación de la experiencia">
                    {current && <section className={styles.place} aria-label="Lugar seleccionado"><div className={styles.placeHeading}><div><small>{selectedItem ? 'EN TU EXPERIENCIA' : 'LUGAR SELECCIONADO'}</small><h2>{current.name}</h2></div><button aria-label="Cerrar lugar" onClick={() => {audio.stop();setSelected(null);}}><X size={20}/></button></div>
                        <p className={styles.description}>{current.description || (current.is_general_topic ? 'Una narración para acompañar la experiencia.' : 'Un lugar para incluir en la experiencia de la escuela.')}</p>
                        {!current.is_general_topic && <div className={styles.behavior}><label><input type="checkbox" checked={behavior==='reference'} disabled={plan.locked} onChange={event => changeBehavior(event.target.checked?'reference':'route')}/><span>Punto de referencia</span></label><p>{behavior==='reference'?'Se incluye en la narración. El recorrido no pasa por sus coordenadas.':'El recorrido se aproxima a este lugar.'}</p></div>}
                        {!selectedItem && <button className={styles.primary} disabled={plan.locked || !usableAudio(current.audio_url) || plan.items.length>=MAX_SEQUENCE_ITEMS} onClick={() => add(current,behavior)}><Plus size={17}/>{usableAudio(current.audio_url)?'Agregar a la experiencia':'Audio pendiente para este nivel'}</button>}
                        {selectedItem && <p className={styles.added}><Check size={15}/>Agregado · posición {plan.items.indexOf(selectedItem)+1}</p>}
                        <div className={styles.placeSecondary}><button disabled={!usableAudio(current.audio_url)} onClick={() => audio.toggle(current)}><Headphones size={16}/>{audio.id===current.id && audio.status==='playing'?'Pausar':'Escuchar'} · {durationLabel(current.audio_duration_seconds)}</button>
                            {!current.is_general_topic && preferences[selected]!==behavior && <button disabled={preferenceState.busy} onClick={rememberBehavior}>{preferenceState.busy?'Recordando…':'Recordar esta opción para otras visitas'}</button>}
                        </div>{preferenceState.message && <p role="status">{preferenceState.message}</p>}{!usableAudio(current.audio_url) && <p>Esta narración necesita audio de {phase.label}. Puedes elegir otro nivel o completarla en Narraciones.</p>}
                    </section>}
                    <section className={styles.sequence} aria-label="Tu experiencia"><div className={styles.sequenceHeading}><h2>Tu experiencia</h2>{ready && <span className={styles.ready}><Check size={14}/>Confirmada</span>}</div><p>{summary}</p>
                        {stale && <Notice action={<button className={styles.secondary} disabled={plan.locked} onClick={() => plan.edit(refreshItems(plan.items),undefined,'Contenido actualizado; revisa la experiencia')}>Actualizar contenido</button>}>Cambió un lugar o una narración. Actualízalo o quítalo antes de confirmar.</Notice>}
                        {!!derived.missingLocations.length && <p className={styles.notice}>Hay {derived.missingLocations.length} lugares sin ubicación. No se dibujan como destinos; complétalos en Narraciones o quítalos.</p>}
                        {plan.items.some(item => !usableAudio(item.audio_url)) && <p className={styles.notice}>Hay narraciones sin audio para este nivel. Puedes elegir otro nivel o quitarlas.</p>}
                        <div className={styles.home}><MapPin size={17}/><span><strong>Escuela</strong><small>Inicio · Home Point</small></span></div>
                        {!plan.items.length ? <div className={styles.empty}><h3>Elige el primer lugar</h3><p>Toca un punto del mapa o busca en la biblioteca. Aparecerá aquí en el orden de la experiencia.</p><button className={styles.textButton} onClick={() => setPicker(true)}><BookOpen size={17}/>Abrir biblioteca</button></div> : <VisitSequence items={plan.items} locked={plan.locked} edit={plan.edit} audio={audio} onSelect={select}/>}
                        <div className={styles.home}><MapPin size={17}/><span><strong>Escuela</strong><small>Regreso</small></span></div>
                        {plan.items.length>0 && <div className={styles.sequenceFooter}><p>{duration}</p><button className={styles.primary} disabled={!canConfirm || ready} onClick={() => plan.save('ready')}><Check size={17}/>{ready?'Experiencia confirmada':'Confirmar experiencia'}</button><button className={styles.textButton} disabled={!playable} onClick={() => {audio.stop();setRehearsing(true);}}><Headphones size={17}/>Escuchar secuencia</button></div>}
                        <details className={styles.more}><summary>Más opciones</summary><div>{previous.length>0 && <button className={styles.textButton} disabled={plan.locked} onClick={() => setReusing(true)}>Reutilizar una experiencia</button>}<Link href="/staff/narraciones" className={styles.textButton}>Abrir Narraciones</Link>{flightRehearsalEnabled && <Link href="/staff/ensayo" className={styles.textButton}>Ensayo libre 3D</Link>}</div></details>
                    </section>
                </aside>
            </div>
            <button className={styles.sequencePeek} onClick={() => setMobileView('sequence')}><span><strong>{plan.items.length} lugares y temas</strong><small>{summary}</small></span><span>Ver secuencia →</span></button>
        </>}
        {audio.error && <p className={styles.notice} role="alert">{audio.error}</p>}
        {picker && <PreparationDialog title="Agregar a la experiencia" onClose={() => {audio.stop();setPicker(false);}}><NarrationLibrary catalog={versions} selectedIds={plan.items.map(item=>item.id)} onAdd={add} addDisabled={plan.locked || plan.items.length>=MAX_SEQUENCE_ITEMS} audio={audio} schoolLocation={location}/><button className={styles.primary} onClick={() => {audio.stop();setPicker(false);}}>Listo</button></PreparationDialog>}
        {rehearsing && <Rehearsal items={plan.items} audio={audio} onClose={() => {audio.stop();setRehearsing(false);}}/>}
        {levelChange && <PreparationDialog title="Cambiar nivel" onClose={() => setLevelChange(null)}><p>Se usarán las versiones de {educationPhase(levelChange)?.label}. Las que no tengan audio quedarán pendientes.</p><button className={styles.primary} onClick={() => changePhase(levelChange)}>Cambiar nivel</button></PreparationDialog>}
        {reusing && <PreparationDialog title="Reutilizar experiencia" onClose={() => setReusing(false)}><p>Reemplaza la secuencia actual y conserva esta escuela. Puedes deshacer el cambio.</p>{previous.map(previousPlan => <button key={previousPlan.id} className={styles.secondary} disabled={plan.locked || previousPlan.items.some(item=>!catalog.some(poi=>String(poi.id)===item.id))} onClick={() => {plan.edit(refreshItems(normalizePreparationItems(previousPlan.items,catalog)),undefined,'Experiencia reutilizada');setReusing(false);}}>{previousPlan.visit?.nombre_escuela || visitLabel(previousPlan.visit_date)} · {previousPlan.items.length} narraciones</button>)}</PreparationDialog>}
    </main>;
}
