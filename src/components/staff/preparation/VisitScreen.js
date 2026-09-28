'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, MapPin, Plus, Trash2, X, Undo2 } from 'lucide-react';
import { coordinates, durationLabel, MAX_SEQUENCE_ITEMS, snapshot, usableAudio, visitLabel } from '@/lib/narration-preparation.mjs';
import { preparationItem, preparationContentChanged, derivePreparation, normalizePreparationItems, hasCreatedNarration } from '@/lib/preparation-model.mjs';
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
        return [...byId.values()];
    }, [data.catalog,catalogUpdates]);
    const audio = useNarrationAudio();
    const panelRef = useRef(null);
    const [mobileView,setMobileView] = useState('map');
    const [picker,setPicker] = useState(false);
    const [rehearsing,setRehearsing] = useState(false);
    const [locating,setLocating] = useState(false);
    const [selected,setSelected] = useState(null);
    const [pendingBehavior,setPendingBehavior] = useState('route');
    const [reusing,setReusing] = useState(false);
    const [preferences,setPreferences] = useState(() => Object.fromEntries((data.preferences || []).map(item => [item.poi_id,item.behavior])));
    const [preferenceState,setPreferenceState] = useState({ busy:false, message:'' });
    const reducedMotion = useReducedMotion();
    const [feedback,setFeedback] = useState('');
    useEffect(() => { if (!plan.message) return; setFeedback(plan.message); const timer = setTimeout(() => setFeedback(''),2600); return () => clearTimeout(timer); }, [plan.message]);
    const [lastAddedId,setLastAddedId] = useState(null);
    useEffect(() => { if (!lastAddedId) return; const timer = setTimeout(() => setLastAddedId(null),900); return () => clearTimeout(timer); }, [lastAddedId]);
    const lat = plan.context.school_location?.latitude, lng = plan.context.school_location?.longitude;
    const location = useMemo(() => coordinates(lat,lng), [lat,lng]);
    const suggestedSchoolLocation = coordinates(visit.ubicacion_lat,visit.ubicacion_lng);
    const choosing = locating || !location;
    const derived = useMemo(() => derivePreparation(plan.items,plan.context), [plan.items,plan.context]);
    const mapPreparation = useMemo(() => ({ items:plan.items, geometry:derived.geometry, activeId:selected }), [plan.items,derived.geometry,selected]);
    const versions = useMemo(() => catalog.map(poi => ({ ...poi, ...snapshot(poi,'general') })), [catalog]);
    const narratedIds = useMemo(() => new Set(catalog.filter(hasCreatedNarration).map(poi => String(poi.id))), [catalog]);
    const selectedIds = useMemo(() => new Set(plan.items.map(item => item.id)), [plan.items]);
    const selectedItem = plan.items.find(item => item.id === selected);
    const current = versions.find(poi => String(poi.id) === selected) || selectedItem;
    const behavior = selectedItem?.behavior || pendingBehavior;
    const stale = preparationContentChanged(plan.items,catalog);
    const ready = plan.status === 'ready' && !plan.dirty && !stale;
    const playable = plan.items.length > 0 && plan.items.every(item => usableAudio(item.audio_url)) && !stale;
    const canConfirm = derived.canConfirm && !stale && !plan.dirty && plan.saveState === 'saved';
    const saveLabel = plan.saveState === 'saving' ? 'Guardando cambios…' : plan.saveState === 'pending' ? 'Cambios pendientes' : plan.saveState === 'conflict' ? 'Revisión necesaria' : plan.saveState === 'error' ? 'Guardado pendiente' : plan.revision ? 'Guardado' : 'Borrador';
    const previous = data.plans.filter(p => p.visit_id !== visit.id && p.items.length).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
    const select = id => { audio.stop(); setSelected(String(id)); setPendingBehavior(preferences[String(id)] || 'route'); setPreferenceState({busy:false,message:''}); setMobileView('map'); };
    const add = (poi, intent = preferences[String(poi.id)] || 'route') => {
        if (plan.locked || plan.items.length >= MAX_SEQUENCE_ITEMS || selectedIds.has(String(poi.id))) return;
        const source = catalog.find(item => String(item.id) === String(poi.id));
        if (!source) return;
        plan.edit([...plan.items,preparationItem(source,'general',intent)], undefined, `${poi.name} se agregó a la experiencia`);
        setLastAddedId(String(poi.id));
    };
    const removeSelected = () => {
        if (!selectedItem || plan.locked) return;
        audio.stop();
        plan.edit(plan.items.filter(item => item.id !== selectedItem.id),undefined,`${selectedItem.name} se quitó del recorrido`);
        setSelected(null);
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
    const refreshItems = items => items.map(item => {
        const source = catalog.find(poi => String(poi.id) === item.id);
        return source ? preparationItem(source,'general',item.behavior) : item;
    });
    const summary = `${derived.points.length} ${derived.points.length === 1 ? 'punto de ruta' : 'puntos de ruta'} · ${derived.references.length} ${derived.references.length === 1 ? 'referencia' : 'referencias'}`;
    const step = choosing ? 'school' : mobileView === 'sequence' ? 'review' : 'map';
    const openReview = () => { audio.stop(); panelRef.current?.scrollTo(0,0); setLocating(false); setMobileView('sequence'); };
    return <main className={styles.planner} data-step={step} data-mobile-view={mobileView}>
        <header className={styles.header}>
            <div className={styles.heading}><Link href="/staff/cronograma" aria-label="Volver al cronograma"><ArrowLeft size={20}/></Link><div><small>PREPARAR EXPERIENCIA<span className={styles.visitDate}> · {visitLabel(visit.fecha_programada)}</span></small><h1 title={visit.nombre_escuela}>{visit.nombre_escuela}</h1></div><div className={styles.headerActions}><button className={styles.undo} aria-label="Deshacer último cambio" title="Deshacer" disabled={!plan.canUndo || plan.locked} onClick={plan.undo}><Undo2 size={17}/></button><span className={styles.save} data-state={plan.saveState} title={saveLabel} aria-live="polite">{saveLabel}</span></div></div>
            <nav className={styles.steps} aria-label="Pasos para preparar la experiencia">
                {[['school','Escuela'],['map','Mapa'],['review','Revisar']].map(([key,label],index) => <button key={key} type="button" aria-current={step===key?'step':undefined} disabled={(index>0&&!location)||(key==='school'&&plan.locked)} onClick={() => {if(key==='review'){openReview();return;}audio.stop();if(key==='school'){setLocating(true);setMobileView('map');}else{setLocating(false);setMobileView('map');}}}>{step===key && <motion.i className={styles.activeStep} layoutId="preparation-active-step" transition={reducedMotion?{duration:0}:{type:'spring',stiffness:380,damping:36}}/>}<span>{index===0&&location?<Check size={13}/>:index+1}</span><b>{label}</b>{key==='review'&&plan.items.length>0&&<small>· {plan.items.length}</small>}</button>)}
            </nav>
        </header>
        <AnimatePresence>{feedback && <motion.p key={feedback} className={styles.feedback} role="status" initial={reducedMotion?false:{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={reducedMotion?{opacity:0}:{opacity:0,y:-8}} transition={{duration:.22}}>{feedback}</motion.p>}</AnimatePresence>
        {plan.error && <div className={styles.notice} role="alert">{plan.error}<button onClick={plan.saveState === 'conflict' ? plan.loadSaved : plan.retry}>{plan.saveState === 'conflict' ? 'Revisar versión guardada' : 'Reintentar guardado'}</button></div>}
        {plan.localError && <p role="alert" className={styles.notice}>{plan.localError}</p>}
        {plan.recoverable && <div className={styles.notice}>Conservamos tu borrador anterior. Puedes usarlo para reemplazar esta versión.<button disabled={plan.locked} onClick={plan.recover}>Usar mi borrador</button></div>}
        {choosing ? <section className={styles.locationPicker}><TakeoffMap purpose="school" schoolName={visit.nombre_escuela} initial={location ? {latitude:lat,longitude:lng} : suggestedSchoolLocation ? {latitude:suggestedSchoolLocation[0],longitude:suggestedSchoolLocation[1]} : null} busy={plan.locked} onCancel={location ? () => setLocating(false) : undefined} onConfirm={point => {plan.edit(plan.items,{...plan.context,school_location:point},'Escuela confirmada como inicio y regreso');setLocating(false);}}/></section>
        : <>
            <div className={styles.workspace}>
                <div className={styles.mapColumn}><PreparationMap userId={data.userId} schoolLocation={location} schoolName={visit.nombre_escuela} catalog={catalog} preparation={mapPreparation} onSelect={poi => select(poi.id)} onNarrationSaved={poi => {if(!poi?.id)return;setCatalogUpdates(previous => [...previous.filter(item => String(item.id)!==String(poi.id)),poi]);select(poi.id);}}/>
                    <div className={styles.legend} aria-label="Leyenda del mapa"><span><i className={styles.legendRoute}/> Recorrido</span><span><i className={styles.legendReady}/> Con narración</span><span><i className={styles.legendMissing}/> Sin narración</span></div>
                </div>
                <motion.aside ref={panelRef} layout className={styles.sidePanel} aria-label="Preparación de la experiencia" transition={{layout:reducedMotion?{duration:0}:{type:'spring',stiffness:380,damping:36}}}>
                    {current && <section className={styles.place} aria-label="Lugar seleccionado"><div className={styles.placeHeading}><div><small>{selectedItem ? 'EN TU EXPERIENCIA' : 'LUGAR SELECCIONADO'}</small><h2>{current.name}</h2><span className={styles.narrationState} data-created={hasCreatedNarration(current)}>{hasCreatedNarration(current) ? 'Con narración' : 'Sin narración'}</span></div><button aria-label="Cerrar lugar" onClick={() => {audio.stop();setSelected(null);}}><X size={20}/></button></div>
                        {!current.is_general_topic && <div className={styles.behavior}><label><input type="checkbox" checked={behavior==='reference'} disabled={plan.locked} onChange={event => changeBehavior(event.target.checked?'reference':'route')}/><span>Punto de referencia</span></label></div>}
                        {!selectedItem && <button className={styles.primary} disabled={plan.locked || plan.items.length>=MAX_SEQUENCE_ITEMS} onClick={() => add(current,behavior)}><Plus size={17}/>Agregar a la experiencia</button>}
                        {selectedItem && <div className={styles.selectedActions}><p className={styles.added}><Check size={15}/>Agregado · posición {plan.items.indexOf(selectedItem)+1}</p><button className={styles.removePoint} disabled={plan.locked} onClick={removeSelected}><Trash2 size={15}/>Quitar del recorrido</button></div>}
                        <details className={styles.placeDetails}><summary>Detalles</summary><p className={styles.description}>{current.description || (current.is_general_topic ? 'Tema general.' : 'Lugar de la experiencia.')}</p><div className={styles.placeSecondary}>{usableAudio(current.audio_url) && <button onClick={() => audio.toggle(current)}><Headphones size={16}/>{audio.id===current.id && audio.status==='playing'?'Pausar':'Escuchar muestra'} · {durationLabel(current.audio_duration_seconds)}</button>}{!current.is_general_topic && preferences[selected]!==behavior && <button disabled={preferenceState.busy} onClick={rememberBehavior}>{preferenceState.busy?'Recordando…':'Recordar esta opción para otras visitas'}</button>}</div>{preferenceState.message && <p role="status">{preferenceState.message}</p>}</details>
                    </section>}
                    <section className={styles.sequence} aria-label="Tu experiencia" data-new-item={Boolean(lastAddedId)}><div className={styles.sequenceHeading}>{step==='map'?<button className={styles.openExperience} onClick={openReview} aria-label="Abrir recorrido para revisar y confirmar"><strong>Tu experiencia</strong><ArrowRight size={16}/></button>:<h2>Revisar recorrido</h2>}{ready && <span className={styles.ready}><Check size={14}/>Confirmada</span>}<button className={styles.libraryButton} onClick={() => {audio.stop();setPicker(true);}}><BookOpen size={16}/>Biblioteca</button></div><p>{summary}</p>
                        {stale && <Notice action={<button className={styles.secondary} disabled={plan.locked} onClick={() => plan.edit(refreshItems(plan.items),undefined,'Lugares actualizados; revisa la experiencia')}>Actualizar lugares</button>}>Cambió un lugar. Actualízalo o quítalo antes de confirmar.</Notice>}
                        {!!derived.missingLocations.length && <p className={styles.notice}>Hay {derived.missingLocations.length} lugares sin ubicación. No se dibujan como destinos; complétalos en Narraciones o quítalos.</p>}
                        <div className={styles.home}><MapPin size={17}/><span><strong>Escuela</strong><small>Inicio · Home Point</small></span></div>
                        {!plan.items.length ? <div className={styles.empty}><h3>Elige el primer lugar</h3><p>Toca un punto del mapa o busca en la biblioteca. Aparecerá aquí en el orden de la experiencia.</p><button className={styles.textButton} onClick={() => setPicker(true)}><BookOpen size={17}/>Abrir biblioteca</button></div> : <VisitSequence items={plan.items} locked={plan.locked} edit={plan.edit} audio={audio} onSelect={step==='map' ? openReview : select} newItemId={lastAddedId} narratedIds={narratedIds}/>}
                        <div className={styles.home}><MapPin size={17}/><span><strong>Escuela</strong><small>Regreso</small></span></div>
                        {plan.items.length>0 && <div className={styles.sequenceFooter}><button className={styles.primary} disabled={!canConfirm || ready} onClick={() => plan.save('ready')}><Check size={17}/>{ready?'Experiencia confirmada':'Confirmar experiencia'}</button><button className={styles.textButton} disabled={!playable} onClick={() => {audio.stop();setRehearsing(true);}}><Headphones size={17}/>Escuchar secuencia</button></div>}
                        <details className={styles.more}><summary>Más opciones</summary><div>{previous.length>0 && <button className={styles.textButton} disabled={plan.locked} onClick={() => setReusing(true)}>Reutilizar una experiencia</button>}<Link href="/staff/narraciones" className={styles.textButton}>Abrir Narraciones</Link>{flightRehearsalEnabled && <Link href="/staff/ensayo" className={styles.textButton}>Ensayo libre 3D</Link>}</div></details>
                    </section>
                </motion.aside>
            </div>
        </>}
        {audio.error && <p className={styles.notice} role="alert">{audio.error}</p>}
        {picker && <PreparationDialog title="Biblioteca de lugares" onClose={() => {audio.stop();setPicker(false);}}><NarrationLibrary catalog={versions} selectedIds={plan.items.map(item=>item.id)} onAdd={add} addDisabled={plan.locked || plan.items.length>=MAX_SEQUENCE_ITEMS} audio={audio} schoolLocation={location}/><button className={styles.primary} onClick={() => {audio.stop();setPicker(false);}}>Listo</button></PreparationDialog>}
        {rehearsing && <Rehearsal items={plan.items} audio={audio} onClose={() => {audio.stop();setRehearsing(false);}}/>}
        {reusing && <PreparationDialog title="Reutilizar experiencia" onClose={() => setReusing(false)}><p>Reemplaza la secuencia actual y conserva esta escuela. Puedes deshacer el cambio.</p>{previous.map(previousPlan => <button key={previousPlan.id} className={styles.secondary} disabled={plan.locked || previousPlan.items.some(item=>!catalog.some(poi=>String(poi.id)===item.id))} onClick={() => {plan.edit(refreshItems(normalizePreparationItems(previousPlan.items,catalog)),undefined,'Experiencia reutilizada');setReusing(false);}}>{previousPlan.visit?.nombre_escuela || visitLabel(previousPlan.visit_date)} · {previousPlan.items.length} lugares</button>)}</PreparationDialog>}
    </main>;
}
