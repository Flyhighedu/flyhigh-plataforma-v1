'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, Plus, Search, X } from 'lucide-react';
import { GRADES, narrationForGrade, phaseProgress } from '@/lib/narration-phases.mjs';
import { coordinates, durationLabel, usableAudio } from '@/lib/narration-preparation.mjs';
import { PreparationDialog } from './NarrationLibrary';
import NarrationEditor from './NarrationEditor';
import useNarrationAudio from './useNarrationAudio';

const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr: false, loading: () => <div className="h-72 rounded-2xl bg-slate-100" /> });
const accents = ['#e55337', '#e4a026', '#16958a', '#7456bb'];

export default function NarrationsScreen({ initialCatalog, userId }) {
    const [catalog, setCatalog] = useState(initialCatalog);
    const [grade, setGrade] = useState('');
    const [query, setQuery] = useState('');
    const [source, setSource] = useState('all');
    const [type, setType] = useState('all');
    const [mapOpen, setMapOpen] = useState(true);
    const [activeId, setActiveId] = useState(null);
    const [editor, setEditor] = useState(undefined);
    const audio = useNarrationAudio();
    const swipeStart = useRef(null);

    const chooseGrade = value => { audio.stop(); setGrade(value); };
    const entries = useMemo(() => catalog.filter(item => {
        if (source === 'official' && !item.is_official) return false;
        if (source === 'personal' && item.is_official) return false;
        if (type === 'places' && item.is_general_topic) return false;
        if (type === 'topics' && !item.is_general_topic) return false;
        return `${item.name} ${item.description || ''}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'));
    }).sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog, query, source, type]);
    const markers = useMemo(() => entries.filter(item => !item.is_general_topic && coordinates(item.latitude, item.longitude)).map(item => ({ id: item.id, name: item.name, lat: item.latitude, lng: item.longitude })), [entries]);
    const activeIndex = entries.findIndex(item => String(item.id) === String(activeId));
    const active = activeIndex >= 0 ? entries[activeIndex] : null;
    const resolved = active && grade ? narrationForGrade(active, grade) : null;
    const playItem = resolved ? { ...resolved, id: `${active.id}:${resolved.version_phase || 'general'}` } : null;
    const playing = audio.id === playItem?.id && audio.status === 'playing';
    const move = direction => { audio.stop(); if (entries.length) setActiveId(entries[(activeIndex + direction + entries.length) % entries.length].id); };
    const closeDetail = () => { audio.stop(); setActiveId(null); };
    const openDetail = id => { audio.stop(); setActiveId(id); };
    const saveRecord = item => setCatalog(previous => {
        const index = previous.findIndex(p => String(p.id) === String(item.id));
        return index < 0 ? [item, ...previous] : previous.map(p => String(p.id) === String(item.id) ? item : p);
    });
    const openEditor = item => { audio.stop(); setActiveId(null); setEditor(item || null); };

    return <main className="min-h-[100svh] bg-white pb-16 text-[#142338]">
        <header className="bg-[#1264b8] px-4 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
            <div className="mx-auto max-w-5xl"><div className="flex items-center justify-between gap-3"><Link href="/staff/dashboard" onClick={audio.stop} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={18} />Inicio</Link><span className="text-xs font-bold tracking-wide">FlyHigh · Piloto</span></div>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-extrabold tracking-tight">Narraciones</h1><p className="mt-1 max-w-lg text-sm text-white/90">Explora lugares y temas. Elige el grado para escuchar la versión adecuada.</p></div><button onClick={() => openEditor(null)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 font-bold text-[#1264b8] shadow-sm"><Plus size={18} />Crear narración</button></div>
            </div>
        </header>
        <div className="mx-auto max-w-5xl space-y-5 px-4 pt-5">
            <section className="rounded-2xl border border-[#1264b8] bg-white p-4"><label htmlFor="narration-grade" className="block text-sm font-bold">¿Qué grado tiene el grupo?</label><div className="mt-2 flex flex-wrap items-center gap-3"><select id="narration-grade" value={grade} onChange={event => chooseGrade(event.target.value)} className="min-h-12 min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-semibold outline-blue-600"><option value="">Selecciona un grado</option>{GRADES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><p className="max-w-sm text-xs leading-relaxed text-slate-600">La aplicación relaciona ese grado con su fase; no tienes que elegir la fase.</p></div></section>
            <section aria-label="Explorar narraciones" className="space-y-3"><label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3"><Search size={19} className="text-slate-500" /><input aria-label="Buscar lugares o temas" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar lugar o tema" className="min-w-0 flex-1 outline-none" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={17} /></button>}</label><div className="flex flex-wrap gap-2">{[['all', 'Todas'], ['official', 'Oficiales'], ['personal', 'Mis narraciones']].map(([value, label]) => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)} className={`min-h-10 rounded-full border px-4 text-sm font-bold ${source === value ? 'border-[#1264b8] bg-[#1264b8] text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}</div><div className="flex flex-wrap gap-2">{[['all', 'Lugares y temas'], ['places', 'Lugares'], ['topics', 'Temas']].map(([value, label]) => <button key={value} aria-pressed={type === value} onClick={() => setType(value)} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${type === value ? 'border-[#142338] bg-[#142338] text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}</div></section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between gap-3 p-4"><div><h2 className="font-extrabold">Mapa de lugares</h2><p className="text-xs text-slate-600">{markers.length} con ubicación · Los temas se muestran solo en la lista</p></div><button onClick={() => setMapOpen(value => !value)} aria-expanded={mapOpen} className="min-h-10 rounded-xl border border-slate-300 px-3 text-xs font-bold">{mapOpen ? 'Ocultar' : 'Mostrar'}</button></div>{mapOpen && <div className="px-3 pb-3"><PreparationMap markers={markers} selectedId={activeId} onSelect={openDetail} /></div>}</section>
            <section><div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-xl font-extrabold">Explorar narraciones</h2><span className="text-xs text-slate-500">{entries.length} fichas</span></div><div className="grid gap-3 sm:grid-cols-2">{entries.map((item, index) => {
                const version = grade ? narrationForGrade(item, grade) : null;
                const progress = phaseProgress(item);
                const label = item.is_general_topic ? 'Tema' : 'Lugar';
                return <button key={item.id} onClick={() => openDetail(item.id)} className="group relative min-h-36 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_4px_0_#e2e8f0] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-blue-600"><span aria-hidden="true" className="absolute bottom-0 right-0 top-0 w-2" style={{ backgroundColor: accents[index % accents.length] }} /><div className="flex items-center gap-2 text-xs font-bold"><span style={{ color: accents[index % accents.length] }}>{label}</span><span className="text-slate-300">·</span><span className="text-slate-600">{item.is_official ? 'Oficial' : 'Mía'}</span></div><h3 className="mt-3 pr-4 text-lg font-extrabold leading-tight">{item.name}</h3><p className="mt-2 line-clamp-2 pr-5 text-sm leading-snug text-slate-600">{item.description || (item.is_general_topic ? 'Tema sin ubicación en el mapa' : 'Explora el guion y el audio de este lugar')}</p><div className="mt-4 flex items-center justify-between gap-2 pr-3 text-xs font-semibold text-slate-600"><span>{!grade ? 'Elige grado para escuchar' : version?.version_general ? 'Versión general' : version?.narrative_script ? `${progress.filter(p => p.script).length}/4 fases con guion` : 'Versión pendiente'}</span><ChevronRight size={18} /></div></button>;
            })}</div>{!entries.length && <p className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-600">No hay fichas con esos filtros. Prueba otra búsqueda.</p>}</section>
            <Link href="/staff/cronograma" onClick={audio.stop} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#1264b8]">¿Preparando una visita? Ir al cronograma →</Link>
        </div>
        {active && <PreparationDialog title={active.name} onClose={closeDetail}><div onTouchStart={event => { swipeStart.current = [event.touches[0].clientX, event.touches[0].clientY]; }} onTouchEnd={event => { if (!swipeStart.current) return; const dx = event.changedTouches[0].clientX - swipeStart.current[0]; const dy = event.changedTouches[0].clientY - swipeStart.current[1]; swipeStart.current = null; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); }}>
            <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#1264b8] px-3 py-1.5 text-white">{active.is_official ? 'Oficial · Administración' : 'Personal · Piloto'}</span><span className="rounded-full border border-slate-300 px-3 py-1.5">{active.is_general_topic ? 'Tema' : 'Lugar'}</span></div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{active.description || (active.is_general_topic ? 'Este tema no aparece en el mapa.' : 'Un lugar en el mapa.')}</p>
            <label className="mt-5 block text-sm font-bold">Grado del grupo<select value={grade} onChange={event => chooseGrade(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Selecciona un grado</option>{GRADES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            {!grade ? <p className="mt-5 rounded-xl border border-[#1264b8] bg-white p-4 text-sm">Selecciona el grado para ver qué narración corresponde.</p> : <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-[#1264b8]">{resolved.version_label}{resolved.version_general ? ' · Este contenido aún no está adaptado por fase' : ''}</p><h3 className="mt-2 font-extrabold">Guion</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{resolved.narrative_script || 'Esta versión aún no tiene guion.'}</p><div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-4"><button disabled={!usableAudio(resolved.audio_url)} onClick={() => audio.toggle(playItem)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1264b8] px-4 text-sm font-bold text-white disabled:bg-slate-300">{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? 'Pausar' : 'Escuchar'}</button><span className="text-xs text-slate-600">{usableAudio(resolved.audio_url) ? durationLabel(resolved.audio_duration_seconds) : 'Audio pendiente'}</span></div>{audio.error && <p role="alert" className="mt-2 text-xs text-red-700">{audio.error}</p>}</div>}
            {!active.is_official && <button onClick={() => openEditor(active)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#1264b8] font-bold text-[#1264b8]">Editar mi ficha</button>}
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4"><button onClick={() => move(-1)} disabled={entries.length < 2} aria-label="Narración anterior" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold disabled:opacity-40"><ChevronLeft size={19} />Anterior</button><span className="text-xs text-slate-500">{activeIndex + 1} de {entries.length}</span><button onClick={() => move(1)} disabled={entries.length < 2} aria-label="Siguiente narración" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold disabled:opacity-40">Siguiente<ChevronRight size={19} /></button></div>
        </div></PreparationDialog>}
        {editor !== undefined && <NarrationEditor item={editor} userId={userId} markers={markers} onSaved={saveRecord} onClose={() => setEditor(undefined)} />}
    </main>;
}
