'use client';
import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { BookOpen, Check, Headphones, Loader2, MapPin, Pause, Play, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { EDUCATION_PHASES } from '@/lib/education-phases.mjs';
import { catalogAudio, catalogStatus, filterNarrations } from '@/lib/narration-catalog.mjs';
import { poiImageUrlForBrowser } from '@/lib/poi-image-url.mjs';
import useNarrationAudio from '@/components/staff/preparation/useNarrationAudio';
import { narrationOrigin } from './useNarrationEntrance';
import styles from './NarrationLibrary.module.css';

function Cover({ poi }) {
    const [failed, setFailed] = useState(false);
    return <span className={styles.cover}>{poi.image_url && !failed
        ? <Image width={76} height={86} unoptimized alt="" src={poiImageUrlForBrowser(poi.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL)} onError={() => setFailed(true)}/>
        : poi.is_general_topic ? <BookOpen size={28}/> : <MapPin size={28}/>}</span>;
}
export default function NarrationCatalog({ pois, onOpen, onDelete, admin = false, active = true, highlightedId }) {
    const uid = useId();
    const [query, setQuery] = useState('');
    const [source, setSource] = useState('all');
    const [kind, setKind] = useState('all');
    const [pending, setPending] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [phaseId, setPhaseId] = useState('general');
    const audio = useNarrationAudio();
    const stopAudio = audio.stop;
    const reduced = useReducedMotion();
    const entries = filterNarrations(pois, { query, source, kind, pending });
    const playingPoi = pois.find(poi => catalogAudio(poi, phaseId)?.id === audio.id);
    const phase = EDUCATION_PHASES.find(item => item.id === phaseId);
    useEffect(() => { if (!active) stopAudio(); }, [active, stopAudio]);
    const open = (poi, element) => { audio.stop(); onOpen({ ...poi, _origin: narrationOrigin(element), _initialPhase: phaseId }); };
    return <section className={styles.catalog} aria-label={admin ? 'Narraciones oficiales' : 'Biblioteca de narraciones'}>
        <div className={styles.searchRow}><label className={styles.search}><Search size={20}/><input aria-label="Buscar narraciones" placeholder="Buscar una narración" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={18}/></button>}</label><button className={styles.secondary} aria-label="Filtros" aria-expanded={filtersOpen} aria-controls={uid + '-filters'} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={19}/>{(kind !== 'all' || pending) && <span className={styles.filterDot}/>}</button></div>
        <div className={styles.catalogControls}>
            {!admin && <div className={styles.chips} aria-label="Origen de las narraciones">{[['all','Todas'],['official','Oficiales'],['personal','Personales']].map(([value,label]) => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}</div>}
            <label className={styles.phaseSelect}><Headphones size={17}/><span className={styles.srOnly}>Versión para escuchar</span><select value={phaseId} onChange={event => { audio.stop(); setPhaseId(event.target.value); }}>{EDUCATION_PHASES.map(item => <option key={item.id} value={item.id}>{item.id === 'general' ? 'General' : item.label}</option>)}</select></label>
        </div>
        {filtersOpen && <div id={uid + '-filters'} className={styles.filterPanel}><label>Contenido<select value={kind} onChange={event => setKind(event.target.value)}><option value="all">Lugares y temas</option><option value="places">Lugares</option><option value="topics">Temas generales</option></select></label><label className={styles.checkLabel}><input type="checkbox" checked={pending} onChange={event => setPending(event.target.checked)}/>Solo pendientes</label></div>}
        {audio.error && <p role="alert" className={styles.error}>{audio.error}</p>}
        <div className={styles.grid}>{entries.map(poi => {
            const status = catalogStatus(poi);
            const sample = catalogAudio(poi, phaseId);
            const playing = sample && audio.id === sample.id && audio.status === 'playing';
            const loading = sample && audio.id === sample.id && audio.status === 'loading';
            return <motion.article key={poi.id} className={styles.card} data-highlighted={highlightedId === poi.id} initial={false} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .2 }}>
                <button className={styles.cardOpen} onClick={event => open(poi, event.currentTarget)}><Cover key={poi.image_url || poi.id} poi={poi}/><span className={styles.cardText}><span className={styles.meta}>{poi.is_official || admin ? 'Oficial' : 'Personal'} · {poi.is_general_topic ? 'Tema' : 'Lugar'}</span><h2>{poi.name}</h2><span className={styles.status} data-ready={status.ready}>{status.ready && <Check size={14}/>} {status.label}</span></span></button>
                <div className={styles.cardActions}><button className={styles.listen} disabled={!sample || loading} aria-label={(playing ? 'Pausar ' : 'Escuchar ') + poi.name + ' · ' + phase.label} onClick={() => audio.toggle(sample)}>{loading ? <Loader2 size={17} className={styles.spin}/> : playing ? <Pause size={17}/> : <Play size={17}/>} {loading ? 'Cargando…' : playing ? 'Pausar' : sample ? 'Escuchar' : 'Audio pendiente'}</button><button className={styles.textButton} onClick={event => open(poi, event.currentTarget.closest('article'))}>{!status.ready && (!poi.is_official || admin) ? 'Continuar' : 'Ver guiones'}</button>{onDelete && <button className={styles.deleteButton} aria-label={'Eliminar ' + poi.name} onClick={() => onDelete(poi.id)}><Trash2 size={17}/></button>}</div>
            </motion.article>;
        })}</div>
        {!entries.length && <div className={styles.empty}><BookOpen size={32}/><h2>{pois.length ? 'No encontramos narraciones' : 'Tu biblioteca comienza aquí'}</h2><p>{pois.length ? 'Prueba otro nombre o ajusta los filtros.' : 'Crea una narración de un lugar o de un tema.'}</p>{pois.length > 0 && <button className={styles.secondary} onClick={() => { setQuery(''); setKind('all'); setSource('all'); setPending(false); }}>Limpiar filtros</button>}</div>}
        {playingPoi && <div className={styles.player} role="region" aria-label="Reproducción actual"><button className={styles.listen} disabled={audio.status === 'loading'} onClick={() => audio.toggle(catalogAudio(playingPoi, phaseId))} aria-label={audio.status === 'playing' ? 'Pausar audio' : 'Reproducir audio'}>{audio.status === 'playing' ? <Pause size={20}/> : <Play size={20}/>}</button><div><strong>{playingPoi.name}</strong><small>{phase.label} · {Math.floor(audio.time)} / {Math.floor(audio.duration)} s</small><progress aria-label="Progreso del audio" value={audio.time} max={audio.duration || 1}/></div><button className={styles.secondary} aria-label="Cerrar reproductor" onClick={audio.stop}><X size={19}/></button></div>}
    </section>;
}
