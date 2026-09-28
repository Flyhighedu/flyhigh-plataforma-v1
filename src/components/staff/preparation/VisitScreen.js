'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BookOpen, Check, ChevronRight, Headphones, MapPin, Plus, X } from 'lucide-react';
import { coordinates, durationLabel, MAX_SEQUENCE_ITEMS, sequenceChanged, snapshot, usableAudio, visitLabel, mergePreparedSources } from '@/lib/narration-preparation.mjs';
import { EDUCATION_PHASES, educationPhase } from '@/lib/education-phases.mjs';
import { PreparationShell, LoadingPreparation, Notice, usePreparationData, secondary } from './PreparationUI';
import NarrationLibrary, { PreparationDialog } from './NarrationLibrary';
import Rehearsal from './Rehearsal';
import VisitSequence from './VisitSequence';
import TakeoffMap from './TakeoffMap';
import useNarrationAudio from './useNarrationAudio';
import useSequencePlan from './useSequencePlan';
import styles from './VisitPlanner.module.css';
const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr:false, loading:() => <p role="status">Cargando mapa…</p> });
const RehearsalMap = dynamic(() => import('./FlightRehearsalScreen').then(module => module.RehearsalMap), { ssr:false, loading:() => <p role="status">Preparando relieve…</p> });
export default function VisitScreen({ visitId, flightRehearsalEnabled = false }) {
    const { data, loading, error, retry } = usePreparationData(visitId);
    if (loading || error) return <PreparationShell title="Preparar visita" back="/staff/cronograma" backLabel="Cronograma">{loading ? <LoadingPreparation/> : <Notice action={<button className={secondary} onClick={retry}>Reintentar</button>}>{error}</Notice>}</PreparationShell>;
    return <VisitEditor key={visitId + ':' + data.userId} visit={data.visits[0]} data={data} flightRehearsalEnabled={flightRehearsalEnabled}/>;
}
function VisitEditor({ visit, data, flightRehearsalEnabled }) {
    const initialPlan = data.plans.find(p => p.visit_id === visit.id);
    const plan = useSequencePlan({ visit, userId:data.userId, initialPlan });
    const [catalogUpdates,setCatalogUpdates] = useState([]);
    const catalog = useMemo(() => {
        const byId = new Map(data.catalog.map(poi => [String(poi.id),poi]));
        catalogUpdates.forEach(poi => byId.set(String(poi.id),poi));
        return mergePreparedSources([...byId.values()], plan.savedSources);
    }, [data.catalog,plan.savedSources,catalogUpdates]);
    const audio = useNarrationAudio();
    const reduced = useReducedMotion();
    const [tab,setTab] = useState('explore');
    const [picker,setPicker] = useState(false);
    const [rehearsing,setRehearsing] = useState(false);
    const [locating,setLocating] = useState(false);
    const [selected,setSelected] = useState(null);
    const [flight,setFlight] = useState(false);
    const [flightRoute,setFlightRoute] = useState(false);
    const [reusing,setReusing] = useState(false);
    const [levelChange,setLevelChange] = useState(null);
    const tabRefs = useRef([]);
    const phaseId = plan.context.phase_id;
    const phase = educationPhase(phaseId);
    const school = plan.context.school_location;
    const suggestedSchoolLocation = useMemo(() => coordinates(visit.ubicacion_lat,visit.ubicacion_lng), [visit.ubicacion_lat,visit.ubicacion_lng]);
    const location = useMemo(() => school ? coordinates(school.latitude,school.longitude) : null, [school]);
    const choosing = locating || !location;
    const versions = useMemo(() => catalog.map(poi => ({ ...poi, ...snapshot(poi,phaseId) })), [catalog,phaseId]);
    // Engine inputs deliberately ignore save acknowledgments and selection changes.
    const flightPois = useMemo(() => catalog.filter(poi => !poi.is_general_topic && coordinates(poi.latitude,poi.longitude)).map(poi => ({ ...poi, ...snapshot(poi,phaseId), latitude:Number(poi.latitude), longitude:Number(poi.longitude) })), [catalog,phaseId]);
    const selectedIds = useMemo(() => new Set(plan.items.map(item => item.id)), [plan.items]);
    const current = versions.find(poi => String(poi.id) === String(selected));
    const stale = sequenceChanged(plan.items,catalog);
    const ready = plan.status === 'ready' && !plan.dirty && !stale;
    const playable = plan.items.length > 0 && plan.items.every(item => usableAudio(item.audio_url)) && !stale;
    const canConfirm = playable && !!location && !plan.locked && !plan.dirty && plan.saveState === 'saved';
    const total = plan.items.reduce((sum,item) => sum + Number(item.audio_duration_seconds || 0),0);
    const duration = plan.items.length && plan.items.every(item => Number(item.audio_duration_seconds)>0) ? durationLabel(total) + ' de narración' : 'Duración por confirmar';
    const saveLabel = plan.saveState === 'saving' ? 'Guardando…' : plan.saveState === 'pending' ? 'Cambios pendientes' : ['error','conflict'].includes(plan.saveState) ? 'No se pudo guardar' : plan.revision ? 'Guardado' : 'Borrador';
    const previous = data.plans.filter(p => p.visit_id !== visit.id && p.items.length).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
    const add = poi => {
        if (plan.locked || plan.items.length >= MAX_SEQUENCE_ITEMS || selectedIds.has(String(poi.id))) return;
        const source = catalog.find(item => String(item.id) === String(poi.id));
        if (!source || !usableAudio(snapshot(source,phaseId).audio_url)) return;
        plan.edit([...plan.items,snapshot(source,phaseId)]);
    };
    const changePhase = next => {
        audio.stop();
        plan.edit(plan.items.map(item => { const source = catalog.find(poi => String(poi.id) === item.id); return source ? snapshot(source,next) : item; }), { ...plan.context,phase_id:next });
        setLevelChange(null);
    };
    const stopAndTab = value => { audio.stop(); setTab(value); };
    const route = <div className={styles.sequence}>
        <h2>Tu recorrido</h2><p>{plan.items.length} narraciones · {duration}</p>{ready && <span className={styles.ready}><Check size={13}/> Recorrido confirmado</span>}
        {stale && <Notice action={<button className={styles.secondary} disabled={plan.locked} onClick={() => plan.edit(plan.items.map(item => { const latest = catalog.find(poi => String(poi.id) === item.id); return latest ? snapshot(latest,item.phase_id || 'general') : item; }))}>Actualizar narraciones</button>}>Hay contenido que cambió o ya no está disponible. Actualiza o quítalo antes de confirmar.</Notice>}
        {plan.items.some(item => !usableAudio(item.audio_url)) && <div className={styles.notice}>Hay narraciones sin audio para este nivel. Puedes quitarlas o elegir otro nivel.</div>}
        {!plan.items.length ? <div className={styles.empty}><Headphones size={28}/><h3>Elige tu primera narración</h3><p>Toca un lugar en el mapa o abre la biblioteca.</p></div> : <VisitSequence items={plan.items} locked={plan.locked} edit={plan.edit} audio={audio}/>}
        <div className={styles.actions}><button className={styles.secondary} onClick={() => { audio.stop(); setPicker(true); }}><Plus size={17}/>Agregar tema o narración</button>{previous.length > 0 && <button className={styles.textButton} disabled={plan.locked} onClick={() => setReusing(true)}>Reutilizar recorrido</button>}</div>
        <div className={styles.sequenceFooter}><button className={styles.secondary} disabled={!playable} onClick={() => { audio.stop(); setRehearsing(true); }}><Headphones size={17}/>Escuchar recorrido</button><button className={styles.primary} disabled={!canConfirm || ready} onClick={() => plan.save('ready')}><Check size={17}/>{ready ? 'Confirmado' : 'Confirmar recorrido'}</button></div>
        {audio.error && <p role="alert">{audio.error}</p>}
    </div>;
    const errors = <>{plan.error && <div className={styles.notice} role="alert">{plan.error}<button className={styles.textButton} onClick={plan.saveState === 'conflict' ? plan.discardLocal : plan.retry}>{plan.saveState === 'conflict' ? 'Cargar versión guardada' : 'Reintentar'}</button></div>}{plan.localError && <div role="alert" className={styles.notice}>{plan.localError}</div>}</>;
    return <div className={styles.planner}>
        <header className={styles.header}><div className={styles.heading}><Link href="/staff/cronograma" aria-label="Volver al cronograma"><ArrowLeft size={20}/></Link><div><small>PREPARAR VISITA · {visitLabel(visit.fecha_programada)}</small><h1>{visit.nombre_escuela}</h1></div>{location && <button disabled={plan.locked} onClick={() => { audio.stop(); setLocating(true); setTab('explore'); }} aria-label="Cambiar ubicación de la escuela"><MapPin size={20}/></button>}</div>
            <div className={styles.tabs} role="tablist" aria-label="Preparar visita">{[['explore','Explorar'],['route','Tu recorrido · ' + plan.items.length]].map(([value,label],index) => { const disabled = value === 'route' && !location; return <button key={value} ref={el => { tabRefs.current[index]=el; }} role="tab" disabled={disabled} aria-selected={tab===value} aria-controls={'visit-'+value} id={'visit-tab-'+value} tabIndex={tab===value ? 0 : -1} onClick={() => !disabled && stopAndTab(value)} onKeyDown={event => { if (disabled) return; if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const next=event.key==='Home'?0:event.key==='End'?1:1-index; if (next === 1 && !location) return; stopAndTab(next?'route':'explore'); tabRefs.current[next]?.focus(); } }}>{tab===value && <motion.i layoutId="visit-tab" className={styles.activeTab} transition={{ duration:reduced?0:.25 }}/>}<span>{label}</span></button>; })}</div>
        </header>
        {errors}<p className={styles.save} role="status">{saveLabel}{school ? ' · Ubicación confirmada' : ' · Paso 1: confirma la ubicación'}</p>
        <div className={styles.body} id="visit-route" role="tabpanel" aria-labelledby="visit-tab-route" hidden={tab!=='route'}>{route}</div>
        {!flight && <div className={styles.body} id="visit-explore" role="tabpanel" aria-labelledby="visit-tab-explore" hidden={tab!=='explore'}>
            {choosing ? <><p className={styles.locationHint}><strong>Paso 1 de 2 · Confirma la escuela.</strong> Colócala bajo el marcador; después abriremos el mapa de lugares y narraciones cercanas.</p><div className={styles.locationPicker}><TakeoffMap purpose="school" schoolName={visit.nombre_escuela} initial={location ? {latitude:location[0],longitude:location[1]} : suggestedSchoolLocation ? {latitude:suggestedSchoolLocation[0],longitude:suggestedSchoolLocation[1]} : null} busy={plan.locked} onCancel={location ? () => setLocating(false) : undefined} onConfirm={point => { plan.edit(plan.items,{...plan.context,school_location:point}); setLocating(false); }}/></div></> : <>
                <div className={styles.toolbar}><label><Headphones size={17}/><select aria-label="Nivel de las narraciones" value={phaseId} disabled={plan.locked} onChange={event => plan.items.length ? setLevelChange(event.target.value) : changePhase(event.target.value)}>{EDUCATION_PHASES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><div className={styles.mode}><button aria-pressed="true">Mapa</button>{flightRehearsalEnabled && <button onClick={() => { audio.stop(); setFlight(true); }}>Vuelo 3D</button>}<button onClick={() => setPicker(true)} aria-label="Abrir biblioteca"><BookOpen size={18}/></button></div></div>
                <p className={styles.exploreHint}><strong>Paso 2 de 2 · Explora alrededor de la escuela.</strong> Verás las narraciones que ya existen y, en amarillo, lugares cercanos para los que puedes crear una narración.</p>
                <div className={styles.workspace}><div className={styles.mapColumn}><PreparationMap userId={data.userId} schoolLocation={location} schoolName={visit.nombre_escuela} onSelect={poi => { audio.stop(); setSelected(String(poi.id)); }} onNarrationSaved={poi => { if (!poi?.id) return; setCatalogUpdates(previous => [...previous.filter(item => String(item.id) !== String(poi.id)),poi]); setSelected(String(poi.id)); }}/>{current && <motion.section className={styles.place} key={current.id} initial={reduced?false:{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{duration:.24}} aria-label="Lugar seleccionado"><div className={styles.placeHeading}><h2>{current.name}</h2><button aria-label="Cerrar lugar" onClick={() => { audio.stop(); setSelected(null); }}><X size={20}/></button></div><p>{phase.label} · {durationLabel(current.audio_duration_seconds)}</p><div className={styles.actions}><button className={styles.secondary} disabled={!usableAudio(current.audio_url)} onClick={() => audio.toggle(current)}><Headphones size={17}/>{audio.id===current.id && audio.status==='playing'?'Pausar':'Escuchar'}</button><button className={styles.primary} disabled={plan.locked || !usableAudio(current.audio_url) || selectedIds.has(String(current.id)) || plan.items.length>=MAX_SEQUENCE_ITEMS} onClick={() => add(current)}>{selectedIds.has(String(current.id))?'Agregado':usableAudio(current.audio_url)?'Agregar al recorrido':'Audio pendiente'}</button></div>{!usableAudio(current.audio_url) && <p>{current.is_official?'Solicita esta versión a coordinación.':'Esta versión aún necesita audio.'}</p>}{audio.error && <p role="alert">{audio.error}</p>}</motion.section>}</div><aside className={styles.desktopSequence}>{route}</aside></div>
                <button className={styles.routeBar} onClick={() => stopAndTab('route')}><span><strong>{plan.items.length} narraciones</strong><small>{duration}</small></span><span>Ver recorrido <ChevronRight size={17}/></span></button>
            </>}
        </div>}
        {flight && location && <div className={styles.flight}><RehearsalMap visit={visit} schoolLocation={location} departure={{latitude:location[0],longitude:location[1]}} pois={flightPois} selectedIds={selectedIds} selectedOrder={plan.items.map(item=>item.id)} audio={audio} google3d onAdd={add} addDisabled={plan.locked || plan.items.length>=MAX_SEQUENCE_ITEMS} onExit={() => { audio.stop(); setFlight(false); }} onOpenRoute={() => { audio.stop(); setFlightRoute(true); }} paused={flightRoute || picker || rehearsing || reusing} /><p className={styles.flightSave} role="status">{saveLabel}</p>{flightRoute && <PreparationDialog title="Tu recorrido" onClose={() => { audio.stop(); setFlightRoute(false); }}>{errors}{route}</PreparationDialog>}</div>}
        {picker && <PreparationDialog title="Agregar narraciones" onClose={() => { audio.stop(); setPicker(false); }}><p>{phase.label} · {plan.items.length}/{MAX_SEQUENCE_ITEMS} seleccionadas</p><NarrationLibrary catalog={versions} selectedIds={plan.items.map(item=>item.id)} onAdd={add} addDisabled={plan.locked || plan.items.length>=MAX_SEQUENCE_ITEMS} audio={audio} schoolLocation={location}/><button className={styles.primary} onClick={() => { audio.stop(); setPicker(false); }}>Listo</button></PreparationDialog>}
        {rehearsing && <Rehearsal items={plan.items} audio={audio} onClose={() => { audio.stop(); setRehearsing(false); }}/>}
        {levelChange && <PreparationDialog title="Cambiar nivel" onClose={() => setLevelChange(null)}><p>El recorrido usará las versiones de {educationPhase(levelChange)?.label}. Las que no tengan audio quedarán pendientes.</p><button className={styles.primary} onClick={() => changePhase(levelChange)}>Cambiar nivel</button></PreparationDialog>}
        {reusing && <PreparationDialog title="Reutilizar recorrido" onClose={() => setReusing(false)}><p>Reemplaza la selección actual; conserva la ubicación de esta escuela.</p>{previous.map(previousPlan => <button key={previousPlan.id} className={styles.secondary} disabled={plan.locked || previousPlan.items.some(item=>!catalog.some(poi=>String(poi.id)===item.id))} onClick={() => { plan.edit(previousPlan.items.map(item=>snapshot(catalog.find(poi=>String(poi.id)===item.id),phaseId))); setReusing(false); }}>{previousPlan.visit?.nombre_escuela || visitLabel(previousPlan.visit_date)} · {previousPlan.items.length} narraciones</button>)}</PreparationDialog>}
    </div>;
}
