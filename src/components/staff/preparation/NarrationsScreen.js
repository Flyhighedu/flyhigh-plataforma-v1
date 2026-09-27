'use client';
/* eslint-disable @next/next/no-img-element -- El selector existente guarda imágenes de orígenes externos variables. */

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Pause, Play, Search, X } from 'lucide-react';
import { GRADES, PHASES, defaultGradeForNarration, narrationForGrade, phaseProgress } from '@/lib/narration-phases.mjs';
import { poiCategory } from '@/lib/poi-presentation.mjs';
import { coordinates, durationLabel, usableAudio } from '@/lib/narration-preparation.mjs';
import { PreparationDialog } from './NarrationLibrary';
import NarrationEditor from './NarrationEditor';
import useNarrationAudio from './useNarrationAudio';

const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr: false, loading: () => <div className="h-72 rounded-2xl bg-slate-100" /> });
const accents = ['#e55337', '#e4a026', '#16958a', '#7456bb'];
const isTopic = item => item.is_general_topic || (item.latitude == null && item.longitude == null);

function PlaceVisual({ item, color, large = false }) {
    const category = poiCategory(item);
    return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden text-white ${large ? 'h-44 w-full rounded-2xl text-6xl' : 'h-32 w-28 rounded-xl text-4xl sm:w-32'}`} style={{ backgroundColor: color }}>
        <span aria-hidden="true">{category.emoji}</span>
        {item.image_url && <img src={item.image_url} alt={large ? `Imagen de ${item.name}` : ''} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
        <span className="absolute bottom-2 left-2 rounded-md bg-[#142338] px-2 py-1 text-xs font-bold">{category.emoji} {category.label}</span>
    </div>;
}

export default function NarrationsScreen({ initialCatalog, userId }) {
    const [catalog, setCatalog] = useState(initialCatalog);
    const [grade, setGrade] = useState('');
    const [query, setQuery] = useState('');
    const [source, setSource] = useState('all');
    const [type, setType] = useState('all');
    const [mapOpen, setMapOpen] = useState(true);
    const [activeId, setActiveId] = useState(null);
    const [editor, setEditor] = useState(null);
    const audio = useNarrationAudio();
    const swipeStart = useRef(null);

    const entries = useMemo(() => catalog.filter(item => {
        if (source === 'official' && !item.is_official) return false;
        if (source === 'personal' && item.is_official) return false;
        if (type === 'places' && isTopic(item)) return false;
        if (type === 'topics' && !isTopic(item)) return false;
        return `${item.name} ${item.description || ''}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'));
    }).sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog, query, source, type]);
    const markers = useMemo(() => entries.filter(item => !isTopic(item) && coordinates(item.latitude, item.longitude)).map(item => ({ id: item.id, name: item.name, lat: item.latitude, lng: item.longitude })), [entries]);
    const activeIndex = entries.findIndex(item => String(item.id) === String(activeId));
    const active = activeIndex >= 0 ? entries[activeIndex] : null;
    const generalExists = Boolean(active?.narrative_script || active?.audio_url);
    const firstPhase = active && PHASES.find(phase => active.phase_variants?.[phase.key]?.script);
    const effectiveGrade = grade || defaultGradeForNarration(active);
    const resolved = active ? narrationForGrade(active, effectiveGrade) : null;
    const playItem = resolved ? { ...resolved, id: `${active.id}:${resolved.version_phase || 'general'}` } : null;
    const playing = audio.id === playItem?.id && audio.status === 'playing';
    const hasPhaseVersions = Boolean(firstPhase);

    const openDetail = id => { audio.stop(); setGrade(''); setActiveId(id); };
    const closeDetail = () => { audio.stop(); setGrade(''); setActiveId(null); };
    const chooseGrade = value => { audio.stop(); setGrade(value); };
    const move = direction => { audio.stop(); if (entries.length) setActiveId(entries[(activeIndex + direction + entries.length) % entries.length].id); };
    const saveRecord = item => setCatalog(previous => previous.map(p => String(p.id) === String(item.id) ? item : p));
    const openEditor = item => { audio.stop(); setActiveId(null); setEditor(item); };
    const closeEditor = () => { const id = editor?.id; setEditor(null); if (id) setActiveId(id); };

    return <main className="min-h-[100svh] bg-white pb-16 text-[#142338]">
        <header className="bg-[#1264b8] px-4 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
            <div className="mx-auto max-w-5xl">
                <div className="flex items-center justify-between gap-3"><Link href="/staff/dashboard" onClick={audio.stop} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={18} />Inicio</Link><span className="text-xs font-bold tracking-wide">FlyHigh · Piloto</span></div>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-extrabold tracking-tight">Narraciones</h1><p className="mt-1 max-w-lg text-sm text-white/90">Explora tus lugares y temas. Abre una ficha para leerla y escucharla.</p></div><Link href="/staff/mapeo?from=narraciones" onClick={audio.stop} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 font-bold text-[#1264b8] shadow-sm"><MapPin size={18} />Crear desde el mapa</Link></div>
            </div>
        </header>
        <div className="mx-auto max-w-5xl space-y-5 px-4 pt-5">
            <p className="text-sm leading-relaxed text-slate-600">Para agregar un lugar, abre el mapa, activa el radar y toca uno de los puntos encontrados. Ahí permanecen la investigación con IA y la elección de imagen.</p>
            <section aria-label="Explorar narraciones" className="space-y-3">
                <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3"><Search size={19} className="text-slate-500" /><input aria-label="Buscar lugares o temas" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar lugar o tema" className="min-w-0 flex-1 outline-none" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={17} /></button>}</label>
                <div className="flex flex-wrap gap-2">{[['all', 'Todas'], ['official', 'Oficiales'], ['personal', 'Mis narraciones']].map(([value, label]) => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)} className={`min-h-10 rounded-full border px-4 text-sm font-bold ${source === value ? 'border-[#1264b8] bg-[#1264b8] text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}</div>
                <div className="flex flex-wrap gap-2">{[['all', 'Lugares y temas'], ['places', 'Lugares'], ['topics', 'Temas']].map(([value, label]) => <button key={value} aria-pressed={type === value} onClick={() => setType(value)} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${type === value ? 'border-[#142338] bg-[#142338] text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}</div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 p-4"><div><h2 className="font-extrabold">Mapa de lugares guardados</h2><p className="text-xs text-slate-600">{markers.length} con ubicación · El radar para descubrir nuevos está en «Crear desde el mapa»</p></div><button onClick={() => setMapOpen(value => !value)} aria-expanded={mapOpen} className="min-h-10 rounded-xl border border-slate-300 px-3 text-xs font-bold">{mapOpen ? 'Ocultar' : 'Mostrar'}</button></div>{mapOpen && <div className="px-3 pb-3"><PreparationMap markers={markers} selectedId={activeId} onSelect={openDetail} /></div>}</section>
            <section><div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-xl font-extrabold">Explorar narraciones</h2><span className="text-xs text-slate-500">{entries.length} fichas</span></div>
                <div className="grid gap-3 sm:grid-cols-2">{entries.map((item, index) => {
                    const progress = phaseProgress(item);
                    const status = item.audio_url ? 'Lista para escuchar' : item.narrative_script ? 'Guion disponible' : progress.some(p => p.script) ? 'Versiones por grado' : 'En preparación';
                    return <button key={item.id} onClick={() => openDetail(item.id)} className="flex min-h-36 items-stretch gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-[0_4px_0_#e2e8f0] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-blue-600">
                        <PlaceVisual item={item} color={accents[index % accents.length]} />
                        <span className="flex min-w-0 flex-1 flex-col px-1 py-2"><span className="text-xs font-bold text-[#1264b8]">{item.is_official ? 'Oficial' : 'Personal'} · {isTopic(item) ? 'Tema' : 'Lugar'}</span><span className="mt-2 line-clamp-2 text-lg font-extrabold leading-tight">{item.name}</span><span className="mt-auto flex items-center justify-between gap-1 pt-2 text-xs font-semibold text-slate-600"><span>{status}</span><ChevronRight size={18} className="shrink-0" /></span></span>
                    </button>;
                })}</div>
                {!entries.length && <p className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-600">No hay fichas con esos filtros. Prueba otra búsqueda.</p>}
            </section>
            <Link href="/staff/cronograma" onClick={audio.stop} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1264b8]">¿Preparando una visita? Ir al cronograma →</Link>
        </div>
        {active && <PreparationDialog title={active.name} onClose={closeDetail}><div onTouchStart={event => { swipeStart.current = [event.touches[0].clientX, event.touches[0].clientY]; }} onTouchEnd={event => { if (!swipeStart.current) return; const dx = event.changedTouches[0].clientX - swipeStart.current[0]; const dy = event.changedTouches[0].clientY - swipeStart.current[1]; swipeStart.current = null; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); }}>
            <PlaceVisual item={active} color={accents[activeIndex % accents.length]} large />
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#1264b8] px-3 py-1.5 text-white">{active.is_official ? 'Oficial · Administración' : 'Personal · Piloto'}</span><span className="rounded-full border border-slate-300 px-3 py-1.5">{isTopic(active) ? 'Tema' : 'Lugar'}</span></div>
            {active.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{active.description}</p>}
            {hasPhaseVersions && <label className="mt-5 block text-sm font-bold">Versión para escuchar<select value={grade || (generalExists ? '' : firstPhase?.grades[0] || '')} onChange={event => chooseGrade(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="" disabled={!generalExists}>Versión general</option>{GRADES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Solo si necesitas adaptar la narración a un grupo concreto.</span></label>}
            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-[#1264b8]">{resolved.version_label}{resolved.version_general && hasPhaseVersions ? ' · Aún no adaptada a ese grado' : ''}</p><h3 className="mt-2 font-extrabold">Narración</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{resolved.narrative_script || (usableAudio(resolved.audio_url) ? 'El texto no está disponible, pero puedes escuchar el audio.' : 'Esta ficha todavía no tiene una narración guardada.')}</p><div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-4"><button disabled={!usableAudio(resolved.audio_url)} onClick={() => audio.toggle(playItem)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1264b8] px-4 text-sm font-bold text-white disabled:bg-slate-300">{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? 'Pausar' : 'Escuchar narración'}</button><span className="text-xs text-slate-600">{usableAudio(resolved.audio_url) ? durationLabel(resolved.audio_duration_seconds) : 'Audio pendiente'}</span></div>{audio.error && <p role="alert" className="mt-2 text-xs text-red-700">{audio.error}</p>}</section>
            {!active.is_official && <div className="mt-4 grid gap-2 sm:grid-cols-2"><Link href={`/staff/mapeo?poi=${encodeURIComponent(active.id)}&from=narraciones`} onClick={audio.stop} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#1264b8] px-3 text-center text-sm font-bold text-[#1264b8]">Editar ficha, imagen y audio</Link><button onClick={() => openEditor(active)} className="min-h-11 rounded-xl border border-[#1264b8] px-3 text-sm font-bold text-[#1264b8]">{hasPhaseVersions ? 'Editar versiones por grado' : 'Crear versiones por grado'}</button></div>}
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4"><button onClick={() => move(-1)} disabled={entries.length < 2} aria-label="Narración anterior" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold disabled:opacity-40"><ChevronLeft size={19} />Anterior</button><span className="text-xs text-slate-500">{activeIndex + 1} de {entries.length}</span><button onClick={() => move(1)} disabled={entries.length < 2} aria-label="Siguiente narración" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold disabled:opacity-40">Siguiente<ChevronRight size={19} /></button></div>
        </div></PreparationDialog>}
        {editor && <NarrationEditor item={editor} userId={userId} onSaved={saveRecord} onClose={closeEditor} />}
    </main>;
}
