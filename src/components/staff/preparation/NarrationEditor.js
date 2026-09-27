'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { usableAudio } from '@/lib/narration-preparation.mjs';
import { PHASES } from '@/lib/narration-phases.mjs';
import { PreparationDialog } from './NarrationLibrary';
import { primary, secondary } from './PreparationUI';

async function responseJson(response) {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
    return result;
}

const wordCount = script => script?.trim().split(/\s+/u).filter(Boolean).length || 0;

export default function NarrationEditor({ item, userId, onSaved, onClose }) {
    const [research, setResearch] = useState(item.research_article || '');
    const [reviewed, setReviewed] = useState(false);
    const [variants, setVariants] = useState(item.phase_variants || {});
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const isTopic = item.is_general_topic || (item.latitude == null && item.longitude == null);

    const save = async (nextVariants = variants) => {
        const db = createClient();
        const { data, error: saveError } = await db.from('pilot_pois').update({
            research_article: research.trim() || null,
            phase_variants: nextVariants,
            updated_at: new Date().toISOString(),
        }).eq('id', item.id).eq('user_id', userId).select().single();
        if (saveError) {
            if (['42703', 'PGRST204'].includes(saveError.code)) throw new Error('Las versiones por grado todavía no están habilitadas en la base de datos de este entorno.');
            throw new Error(saveError.message || 'No se pudo guardar.');
        }
        onSaved(data);
        return data;
    };

    const run = async (label, action) => {
        setBusy(label); setError(''); setMessage('');
        try { await action(); } catch (cause) { setError(cause.message || 'Intenta de nuevo.'); }
        finally { setBusy(''); }
    };

    const investigate = () => run('research', async () => {
        const result = await responseJson(await fetch('/api/poi-deep-research', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: item.name, type: isTopic ? 'tema educativo' : item.description || 'lugar',
                context: 'México', lat: isTopic ? null : item.latitude, lon: isTopic ? null : item.longitude,
            }),
        }));
        if (result.allFailed || !result.article || result.article.startsWith('No fue posible')) throw new Error('No hubo investigación suficiente. Puedes revisar la existente o escribirla manualmente.');
        setResearch(result.article); setReviewed(false);
        setMessage('Investigación obtenida. Verifica los hechos antes de generar versiones por grado.');
    });

    const generateScripts = () => run('scripts', async () => {
        if (!reviewed || research.trim().length < 60) throw new Error('Revisa la investigación primero (mínimo 60 caracteres).');
        const result = await Promise.allSettled(PHASES.map(async phase => {
            const data = await responseJson(await fetch('/api/poi-generate-script', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poiName: item.name, researchArticle: research.trim(), educationPhase: phase.key,
                    lat: isTopic ? null : item.latitude, lng: isTopic ? null : item.longitude,
                }),
            }));
            if (!data.script?.trim()) throw new Error(`No se recibió el guion de ${phase.label}.`);
            return { key: phase.key, script: data.script.trim() };
        }));
        const next = { ...variants };
        for (const entry of result) if (entry.status === 'fulfilled') {
            const { key, script } = entry.value;
            next[key] = { ...next[key], script, audio_url: null, audio_duration_seconds: null, audio_generated_at: null };
        }
        if (!result.some(entry => entry.status === 'fulfilled')) throw new Error('No se pudo generar ningún guion. Reintenta.');
        await save(next); setVariants(next);
        setMessage(result.every(entry => entry.status === 'fulfilled')
            ? 'Cuatro guiones guardados. Revísalos antes de generar los audios.'
            : 'Se guardaron los guiones disponibles. Reintenta para completar los pendientes.');
    });

    const generateAudio = () => run('audio', async () => {
        if (!PHASES.every(phase => variants[phase.key]?.script?.trim())) throw new Error('Completa los cuatro guiones antes de generar audio.');
        if (PHASES.some(phase => wordCount(variants[phase.key].script) > 60)) throw new Error('Acorta los guiones a 60 palabras o menos antes de generar audio.');
        let next = { ...variants };
        await save(next);
        const pending = PHASES.filter(phase => !usableAudio(next[phase.key]?.audio_url)).length;
        let completed = 0;
        for (const phase of PHASES) {
            const variant = next[phase.key];
            if (usableAudio(variant.audio_url)) continue;
            setMessage(`Generando audio ${++completed} de ${pending}: ${phase.label}…`);
            try {
                const data = await responseJson(await fetch('/api/poi-generate-audio', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ poiId: item.id, narrativeScript: variant.script }),
                }));
                next = { ...next, [phase.key]: {
                    ...variant, audio_url: data.audio_url,
                    audio_duration_seconds: data.audio_duration_seconds,
                    audio_generated_at: new Date().toISOString(),
                } };
                await save(next); setVariants(next);
            } catch (cause) {
                setVariants(next);
                throw new Error(`${phase.label}: ${cause.message}. Lo completado quedó guardado; reintenta para continuar.`);
            }
        }
        setMessage('Los audios por grado quedaron guardados en tu ficha personal.');
    });

    const updateScript = (key, script) => {
        setVariants(previous => ({ ...previous, [key]: {
            ...previous[key], script, audio_url: null,
            audio_duration_seconds: null, audio_generated_at: null,
        } }));
        setMessage('Al cambiar un guion se invalida su audio. Guarda y vuelve a generarlo.');
    };

    return <PreparationDialog title={`Versiones por grado · ${item.name}`} onClose={busy ? () => {} : onClose}>
        <p className="text-sm leading-relaxed text-slate-600">El lugar o tema, su imagen y su narración general se editan en la ficha del mapa. Aquí solo preparas las versiones por grado.</p>
        <section className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-2"><h3 className="font-bold">1. Investigación base</h3><button disabled={Boolean(busy)} onClick={investigate} className={secondary}>{busy === 'research' ? 'Investigando…' : 'Investigar de nuevo'}</button></div>
            <p className="mt-1 text-xs text-slate-500">Una investigación para todas las versiones. Verifica los datos antes de continuar.</p>
            <textarea value={research} disabled={Boolean(busy)} onChange={event => { setResearch(event.target.value); setReviewed(false); }} rows={7} aria-label="Investigación base" className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed outline-blue-600" />
            <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" disabled={Boolean(busy)} checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1" />He revisado y corregido los datos de esta investigación.</label>
        </section>
        <section className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">2. Guiones por grado</h3><p className="text-xs text-slate-500">La aplicación comparte cada guion entre los grados de su fase.</p></div><button disabled={Boolean(busy) || !reviewed} onClick={generateScripts} className={secondary}>{busy === 'scripts' ? 'Generando…' : 'Generar cuatro'}</button></div>
            <div className="mt-3 space-y-3">{PHASES.map(phase => <label key={phase.key} className="block rounded-2xl border border-slate-200 bg-white p-3 text-sm"><span className="font-bold">{phase.label}</span><textarea value={variants[phase.key]?.script || ''} disabled={Boolean(busy)} onChange={event => updateScript(phase.key, event.target.value)} rows={3} placeholder="Guion pendiente" className="mt-2 w-full rounded-lg border border-slate-200 p-2 leading-relaxed outline-blue-600" /><span className={`text-xs ${wordCount(variants[phase.key]?.script) > 60 ? 'font-bold text-red-700' : 'text-slate-500'}`}>{wordCount(variants[phase.key]?.script)}/60 palabras · {usableAudio(variants[phase.key]?.audio_url) ? 'Audio listo' : 'Audio pendiente'}</span></label>)}</div>
        </section>
        <section className="border-t border-slate-200 pt-4"><h3 className="font-bold">3. Audio con la narradora actual</h3><p className="mt-1 text-xs text-slate-500">La voz y su forma de hablar se conservan.</p><button disabled={Boolean(busy) || !PHASES.every(phase => variants[phase.key]?.script?.trim())} onClick={generateAudio} className={`${primary} mt-3 w-full`}>{busy === 'audio' ? 'Generando audios…' : 'Generar audios pendientes'}</button></section>
        {error && <p role="alert" className="rounded-xl border border-red-600 bg-white p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-xl border border-blue-600 bg-white p-3 text-sm text-blue-800">{message}</p>}
        <button disabled={Boolean(busy)} onClick={() => run('save', async () => { await save(); setMessage('Cambios personales guardados.'); })} className={`${secondary} w-full`}>{busy === 'save' ? 'Guardando…' : 'Guardar cambios'}</button>
    </PreparationDialog>;
}
