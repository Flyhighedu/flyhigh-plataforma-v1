'use client';

import { useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { coordinates, usableAudio } from '@/lib/narration-preparation.mjs';
import { PHASES } from '@/lib/narration-phases.mjs';
import { PreparationDialog } from './NarrationLibrary';
import { primary, secondary } from './PreparationUI';

const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr: false });

async function responseJson(response) {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
    return result;
}
const wordCount = script => script?.trim().split(/\s+/u).filter(Boolean).length || 0;

export default function NarrationEditor({ item, userId, markers, onSaved, onClose }) {
    const [record, setRecord] = useState(item || null);
    const recordRef = useRef(item || null);
    const [kind, setKind] = useState(item?.is_general_topic ? 'topic' : item ? 'place' : null);
    const [name, setName] = useState(item?.name || '');
    const [description, setDescription] = useState(item?.description || '');
    const [location, setLocation] = useState(item ? { latitude: item.latitude, longitude: item.longitude } : null);
    const [research, setResearch] = useState(item?.research_article || '');
    const [reviewed, setReviewed] = useState(false);
    const [variants, setVariants] = useState(item?.phase_variants || {});
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const save = async (nextVariants = variants, nextResearch = research) => {
        if (!kind || !name.trim()) throw new Error('Elige lugar o tema y escribe un nombre.');
        if (kind === 'place' && !coordinates(location?.latitude, location?.longitude)) throw new Error('Marca la ubicación del lugar en el mapa.');
        const fields = {
            name: name.trim(), description: description.trim() || null, category: 'general',
            is_general_topic: kind === 'topic', latitude: kind === 'place' ? location.latitude : null,
            longitude: kind === 'place' ? location.longitude : null,
            research_article: nextResearch.trim() || null, phase_variants: nextVariants,
            updated_at: new Date().toISOString(),
        };
        const db = createClient();
        const result = recordRef.current?.id
            ? await db.from('pilot_pois').update(fields).eq('id', recordRef.current.id).eq('user_id', userId).select().single()
            : await db.from('pilot_pois').insert({ ...fields, user_id: userId, is_favorite: false }).select().single();
        if (result.error) {
            if (['42703', 'PGRST204'].includes(result.error.code)) throw new Error('Falta habilitar las versiones por fase en la base de datos de este entorno.');
            throw new Error(result.error.message || 'No se pudo guardar el borrador.');
        }
        recordRef.current = result.data; setRecord(result.data); onSaved(result.data);
        return result.data;
    };

    const run = async (label, action) => {
        setBusy(label); setError(''); setMessage('');
        try { await action(); } catch (cause) { setError(cause.message || 'Intenta de nuevo.'); }
        finally { setBusy(''); }
    };

    const chooseLocation = useCallback(point => setLocation(point), []);
    const investigate = () => run('research', async () => {
        if (!name.trim()) throw new Error('Escribe el nombre antes de investigar.');
        const result = await responseJson(await fetch('/api/poi-deep-research', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), type: kind === 'topic' ? 'tema educativo' : 'lugar', context: 'México', lat: kind === 'place' ? location?.latitude : null, lon: kind === 'place' ? location?.longitude : null }),
        }));
        if (result.allFailed || !result.article || result.article.startsWith('No fue posible')) throw new Error('No hubo investigación suficiente. Puedes escribirla y revisarla manualmente.');
        setResearch(result.article); setReviewed(false);
        setMessage('Investigación obtenida. Revísala y corrige cualquier dato antes de generar los guiones.');
    });

    const generateScripts = () => run('scripts', async () => {
        if (!reviewed || research.trim().length < 60) throw new Error('Revisa la investigación primero (mínimo 60 caracteres).');
        const result = await Promise.allSettled(PHASES.map(async phase => {
            const body = { poiName: name.trim(), researchArticle: research.trim(), educationPhase: phase.key,
                lat: kind === 'place' ? location?.latitude : null, lng: kind === 'place' ? location?.longitude : null };
            const data = await responseJson(await fetch('/api/poi-generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
            if (!data.script?.trim()) throw new Error(`No se recibió el guion de ${phase.label}.`);
            return { key: phase.key, script: data.script.trim() };
        }));
        const next = { ...variants };
        for (const entry of result) if (entry.status === 'fulfilled') {
            const { key, script } = entry.value;
            next[key] = { ...next[key], script, audio_url: null, audio_duration_seconds: null, audio_generated_at: null };
        }
        if (!result.some(entry => entry.status === 'fulfilled')) throw new Error('No se pudo generar ningún guion. Reintenta.');
        await save(next);
        setVariants(next);
        setMessage(result.every(entry => entry.status === 'fulfilled')
            ? 'Cuatro guiones guardados. Revísalos antes de generar el audio.'
            : 'Se guardaron los guiones disponibles. Reintenta para completar los pendientes.');
    });

    const generateAudio = () => run('audio', async () => {
        if (!PHASES.every(phase => variants[phase.key]?.script?.trim())) throw new Error('Completa los cuatro guiones antes de generar audio.');
        if (PHASES.some(phase => wordCount(variants[phase.key].script) > 60)) throw new Error('Acorta los guiones a 60 palabras o menos antes de generar audio.');
        let next = { ...variants };
        const saved = await save(next);
        let completed = 0;
        const pending = PHASES.filter(phase => !usableAudio(next[phase.key]?.audio_url)).length;
        for (const phase of PHASES) {
            const variant = next[phase.key];
            if (usableAudio(variant.audio_url)) continue;
            setMessage(`Generando audio ${++completed} de ${pending}: ${phase.label}…`);
            try {
                const data = await responseJson(await fetch('/api/poi-generate-audio', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ poiId: saved.id, narrativeScript: variant.script }),
                }));
                next = { ...next, [phase.key]: { ...variant, audio_url: data.audio_url, audio_duration_seconds: data.audio_duration_seconds, audio_generated_at: new Date().toISOString() } };
                await save(next);
                setVariants(next);
            } catch (cause) {
                setVariants(next);
                throw new Error(`${phase.label}: ${cause.message}. Lo completado quedó guardado; reintenta para continuar.`);
            }
        }
        setMessage('Audios guardados. Esta ficha sigue siendo personal del piloto.');
    });

    const updateScript = (key, script) => {
        setVariants(previous => ({ ...previous, [key]: { ...previous[key], script, audio_url: null, audio_duration_seconds: null, audio_generated_at: null } }));
        setMessage('Cambiaste un guion: guarda los cambios y vuelve a generar su audio.');
    };

    return <PreparationDialog title={record ? `Editar ${record.name}` : 'Crear narración'} onClose={busy ? () => {} : onClose}>
        <div className="space-y-5">
            <div><p className="text-sm font-bold">¿Qué vas a narrar?</p><div className="mt-2 grid grid-cols-2 gap-2">{[['place', 'Lugar', 'Aparece en el mapa'], ['topic', 'Tema', 'No tiene ubicación']].map(([value, label, help]) => <button key={value} disabled={Boolean(record)} onClick={() => setKind(value)} aria-pressed={kind === value} className={`min-h-16 rounded-2xl border-2 p-3 text-left ${kind === value ? 'border-blue-600 bg-white' : 'border-slate-200 bg-white'} disabled:opacity-80`}><span className="block font-bold">{label}</span><span className="text-xs text-slate-500">{help}</span></button>)}</div></div>
            {kind && <>
                <label className="block text-sm font-bold">Nombre<input value={name} disabled={Boolean(busy)} maxLength={140} onChange={event => setName(event.target.value)} placeholder={kind === 'place' ? 'Ej. Parque Fundidora' : 'Ej. Cómo funciona un río'} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal outline-blue-600" /></label>
                <label className="block text-sm font-bold">Descripción breve <span className="font-normal text-slate-500">(opcional)</span><input value={description} disabled={Boolean(busy)} maxLength={300} onChange={event => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal outline-blue-600" /></label>
                {kind === 'place' && <div><p className="mb-2 text-sm font-bold">Ubicación del lugar</p><PreparationMap markers={markers} onPick={chooseLocation} picked={location} />{location && <p className="mt-2 text-xs text-slate-600">Punto elegido: {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}</p>}</div>}
                <div className="border-t border-slate-200 pt-5"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">1. Investigación base</h3><button disabled={Boolean(busy)} onClick={investigate} className={secondary}>{busy === 'research' ? 'Investigando…' : 'Investigar'}</button></div><p className="mt-1 text-xs text-slate-500">Una sola investigación para las cuatro versiones. La generación puede equivocarse: verifica los hechos.</p><textarea value={research} disabled={Boolean(busy)} onChange={event => { setResearch(event.target.value); setReviewed(false); }} rows={7} placeholder="Revisa aquí los hechos que usarán los guiones…" className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed outline-blue-600" /><label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" disabled={Boolean(busy)} checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1" />He revisado y corregido los datos de esta investigación.</label></div>
                <div className="border-t border-slate-200 pt-5"><div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">2. Cuatro guiones</h3><p className="text-xs text-slate-500">El piloto elegirá grado; la aplicación usará la fase adecuada.</p></div><button disabled={Boolean(busy) || !reviewed} onClick={generateScripts} className={secondary}>{busy === 'scripts' ? 'Generando…' : 'Generar 4'}</button></div><div className="mt-3 space-y-3">{PHASES.map(phase => <label key={phase.key} className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm"><span className="font-bold">{phase.label}</span><span className="ml-2 text-xs text-slate-500">{phase.grades.length} grados</span><textarea value={variants[phase.key]?.script || ''} disabled={Boolean(busy)} onChange={event => updateScript(phase.key, event.target.value)} rows={3} placeholder="Guion pendiente" className="mt-2 w-full rounded-lg border border-slate-200 p-2 leading-relaxed outline-blue-600" /><span className={`text-xs ${wordCount(variants[phase.key]?.script) > 60 ? 'font-bold text-red-700' : 'text-slate-500'}`}>{wordCount(variants[phase.key]?.script)}/60 palabras · {usableAudio(variants[phase.key]?.audio_url) ? 'Audio listo' : 'Audio pendiente'}</span></label>)}</div></div>
                <div className="border-t border-slate-200 pt-5"><h3 className="font-bold">3. Audio con la narradora actual</h3><p className="mt-1 text-xs text-slate-500">Se mantiene la misma voz. Los cuatro audios se generan después de revisar los textos.</p><button disabled={Boolean(busy) || !PHASES.every(phase => variants[phase.key]?.script?.trim())} onClick={generateAudio} className={`${primary} mt-3 w-full`}>{busy === 'audio' ? 'Generando audios…' : 'Generar audios pendientes'}</button></div>
                {error && <p role="alert" className="rounded-xl border border-red-600 bg-white p-3 text-sm text-red-700">{error}</p>}
                {message && <p role="status" className="rounded-xl border border-blue-600 bg-white p-3 text-sm text-blue-800">{message}</p>}
                <button disabled={Boolean(busy)} onClick={() => run('save', async () => { await save(); setMessage('Borrador personal guardado.'); })} className={`${secondary} w-full`}>{busy === 'save' ? 'Guardando…' : 'Guardar borrador'}</button>
            </>}
        </div>
    </PreparationDialog>;
}
