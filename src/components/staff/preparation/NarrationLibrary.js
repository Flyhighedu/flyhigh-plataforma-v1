'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Headphones, Loader2, Pause, Play, Plus, Search, X } from 'lucide-react';
import { coordinates, distanceKm, durationLabel, usableAudio } from '@/lib/narration-preparation.mjs';
import { Notice, secondary } from './PreparationUI';

export function PreparationDialog({ title, onClose, children }) {
    const ref = useRef(null);
    useEffect(() => {
        const dialog = ref.current;
        const previous = document.activeElement;
        const overflow = document.body.style.overflow;
        dialog.showModal(); document.body.style.overflow = 'hidden';
        return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
    }, []);
    return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="preparation-dialog-title" className="m-auto max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-2xl rounded-3xl bg-white p-0 text-[#071a33] shadow-2xl backdrop:bg-slate-950/60">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
            <h2 id="preparation-dialog-title" className="text-lg font-extrabold">{title}</h2>
            <button autoFocus onClick={onClose} aria-label="Cerrar" className={secondary}><X size={19} /></button>
        </div><div className="space-y-4 p-4 sm:p-6">{children}</div>
    </dialog>;
}

export default function NarrationLibrary({ catalog, selectedIds = [], onAdd, addDisabled = false, audio, schoolLocation, initialQuery = '' }) {
    const [query, setQuery] = useState(initialQuery);
    const [category, setCategory] = useState('all');
    const [expanded, setExpanded] = useState(null);
    const entries = useMemo(() => catalog.map(p => ({ ...p, distance: distanceKm(schoolLocation, coordinates(p.latitude, p.longitude)) }))
        .filter(p => (category === 'all' || (category === 'general' ? p.is_general_topic : !p.is_general_topic)) && `${p.name} ${p.description || ''}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.name.localeCompare(b.name, 'es')), [catalog, category, query, schoolLocation]);
    return <>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-400"><Search size={19} /><input aria-label="Buscar narraciones" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar una narración" className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={18} /></button>}</label>
        <div className="flex flex-wrap gap-2" aria-label="Tipo de narración">
            {[['all', 'Todas'], ['places', 'Lugares'], ['general', 'Temas generales']].map(([key, label]) => <button key={key} onClick={() => setCategory(key)} aria-pressed={category === key} className={`min-h-10 rounded-full px-4 text-xs font-bold ${category === key ? 'bg-[#071a33] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}
        </div>
        {schoolLocation && <p className="text-xs text-slate-500">Lugares ordenados por distancia aproximada a la escuela, en línea recta.</p>}
        {audio.error && <Notice>{audio.error}</Notice>}
        {!entries.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><Search size={25} className="mx-auto mb-3 text-slate-400" /><p className="font-bold">No encontramos narraciones</p><p className="mt-1 text-sm text-slate-500">Prueba otro nombre o cambia el filtro.</p></div>}
        <div className="space-y-3">{entries.map(p => {
            const selected = selectedIds.includes(String(p.id));
            const playing = audio.id === p.id && audio.status === 'playing';
            const loading = audio.id === p.id && audio.status === 'loading';
            const available = usableAudio(p.audio_url);
            return <article key={p.id} className={`rounded-2xl border bg-white p-4 ${selected ? 'border-blue-300' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Headphones size={20} /></span><div className="min-w-0 flex-1"><h3 className="font-bold leading-snug">{p.name}</h3><p className="mt-1 text-xs text-slate-500">{p.is_general_topic ? 'Tema' : 'Lugar'} · {p.is_official ? 'Oficial' : 'Personal'}{p.distance != null && ` · ${p.distance.toFixed(1)} km`}</p><p className="mt-1 text-xs text-slate-500">{p.version_label ? `${p.version_label} · ` : ''}{available ? durationLabel(p.audio_duration_seconds) : 'Audio pendiente'}</p></div></div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button disabled={!available || loading} onClick={() => audio.toggle(p)} aria-label={`${playing ? 'Pausar' : 'Escuchar'} ${p.name}`} className={secondary}>{loading ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pausar' : 'Escuchar'}</button>
                    {onAdd && <button disabled={selected || !available || addDisabled} onClick={() => onAdd(p)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700 disabled:text-slate-500">{selected ? <Check size={17} /> : <Plus size={17} />}{selected ? 'Agregada' : 'Agregar'}</button>}
                    {p.narrative_script && <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} aria-expanded={expanded === p.id} className="min-h-11 px-2 text-xs font-semibold text-slate-600">{expanded === p.id ? 'Cerrar guion' : 'Ver guion'}</button>}
                </div>
                {expanded === p.id && <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">{p.narrative_script}</p>}
            </article>;
        })}</div>
        <div className="border-t border-slate-200 pt-4"><p className="mb-2 text-xs text-slate-500">¿Falta un lugar o necesitas editar una narración personal?</p><Link href="/staff/narraciones" onClick={audio.stop} className={secondary}><Plus size={16} />Ir a Narraciones</Link></div>
    </>;
}
