'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Headphones, Loader2, Save, Sparkles, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { EngineSelector, ImageSelector } from './SharedNarrativeFactory';
import { EDUCATION_PHASES, curriculumReference, educationPhase, hasUsableResearch } from '@/lib/education-phases.mjs';
import { editNarration, emptyNarration, narrationStatus, readNarrations, serializeNarrations } from '@/lib/narrative-versions.mjs';
import { poiImageUrlForBrowser } from '@/lib/poi-image-url.mjs';
import { localReviewAudioPath } from '@/lib/review-audio.mjs';
import styles from './PhaseNarrativeEditor.module.css';

async function post(url, body, signal) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const data = await response.json();
    if (!response.ok || data.allFailed) throw new Error(data.error || 'No se pudo completar la solicitud. Intenta de nuevo.');
    return data;
}

// Both entry points use this editor. The general narration remains in legacy
// fields; switching an educational phase never changes playback in operations.
export default function PhaseNarrativeEditor({ poi, onClose, onSave, onDelete, readOnly = false, embedded = false, isGeneralTopic = false, geoContext = '' }) {
    const uid = useId();
    const [title, setTitle] = useState(poi.name || '');
    const [research, setResearch] = useState(poi.research_article || '');
    const [versions, setVersions] = useState(() => readNarrations(poi));
    const [phaseId, setPhaseId] = useState(poi.narrative_script ? 'general' : 'phase_3');
    const [imageUrl, setImageUrl] = useState(poi.image_url || null);
    const [images, setImages] = useState([]);
    const [engine, setEngine] = useState('gemini');
    const [usage, setUsage] = useState(null);
    const [keywords, setKeywords] = useState(poi.trigger_keywords || []);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    const [proposal, setProposal] = useState(null);
    const [confirmClose, setConfirmClose] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [dirty, setDirty] = useState(false);
    const requests = useRef(new Set());
    const lock = useRef(false);
    const panelRef = useRef(null);
    const audioRef = useRef(null);
    const phase = educationPhase(phaseId);
    const current = versions[phaseId] || emptyNarration();
    const reference = curriculumReference(phaseId, current.curriculum_focus);
    const activeBusy = busy?.phase === phaseId;
    const committing = busy?.kind === 'save' || busy?.kind === 'delete';
    const audioSrc = localReviewAudioPath(current.audio_url) ? `/api/review-lab/audio?url=${encodeURIComponent(current.audio_url)}` : current.audio_url;
    const wordCount = current.narrative_script.trim().split(/\s+/).filter(Boolean).length;
    const generalTopic = isGeneralTopic || poi.is_general_topic || ((poi.latitude ?? poi.lat) == null && (poi.longitude ?? poi.lng) == null);
    const draftCount = Object.entries(versions).filter(([id, version]) => id !== 'general' && version.narrative_script.trim()).length;

    function requestClose() {
        if (committing) return;
        if (busy || dirty || proposal) setConfirmClose(true);
        else onClose();
    }

    useEffect(() => {
        const pending = requests.current;
        return () => { for (const controller of pending) controller.abort(); };
    }, []);

    useEffect(() => {
        if (!dirty && !busy && !proposal) return;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, busy, proposal]);

    useEffect(() => {
        const previous = document.activeElement;
        if (!embedded) panelRef.current?.querySelector('button')?.focus();
        return () => previous?.focus?.();
    }, [embedded]);

    function edit(changes) {
        if (readOnly) return;
        setVersions(previous => editNarration(previous, phaseId, changes));
        setDirty(true);
    }

    async function run(kind, work) {
        if (readOnly || lock.current) return;
        lock.current = true;
        const controller = new AbortController();
        requests.current.add(controller);
        setBusy({ kind, phase: phaseId });
        setError('');
        try { await work(controller.signal); }
        catch (failure) { if (failure.name !== 'AbortError') setError(failure.message || 'Revisa tu conexión e intenta de nuevo.'); }
        finally { requests.current.delete(controller); lock.current = false; setBusy(null); }
    }

    async function researchPlace(signal) {
        if (title.trim().length < 2) throw new Error('Escribe el nombre del lugar o tema para investigarlo.');
        const data = await post('/api/poi-deep-research', {
            name: title.trim(), type: poi.description || '', context: geoContext,
            lat: poi.latitude ?? poi.lat, lon: poi.longitude ?? poi.lng, preferredEngine: engine,
        }, signal);
        if (!hasUsableResearch(data.article)) throw new Error('La investigación no devolvió información suficiente. Agrega un texto con fuentes o vuelve a intentarlo.');
        setResearch(data.article); setDirty(true);
        if (data.images?.length) setImages(data.images);
        if (data.keywords?.length) setKeywords(data.keywords);
        if (data.tavilyUsage) setUsage(data.tavilyUsage);
        return data.article;
    }

    function generateScript() {
        const targetPhase = phaseId;
        run('script', async signal => {
            const article = hasUsableResearch(research) ? research : await researchPlace(signal);
            const data = await post('/api/poi-generate-script', {
                poiName: title.trim(), lat: poi.latitude ?? poi.lat, lng: poi.longitude ?? poi.lng,
                researchArticle: article, customInstructions: current.custom_instructions,
                phaseId: targetPhase, curriculumFocus: current.curriculum_focus, learningGoal: current.learning_goal,
            }, signal);
            if (!data.script?.trim()) throw new Error('No se recibió un guion. Tu versión anterior se conserva.');
            setProposal({ phaseId: targetPhase, narrative_script: data.script, learning_goal: data.learning_goal || current.learning_goal,
                review_note: data.review_note || '', curriculum_focus: current.curriculum_focus });
        });
    }

    function generateAudio() {
        const targetPhase = phaseId;
        const script = current.narrative_script;
        run('audio', async signal => {
            const data = await post('/api/poi-generate-audio', { poiId: poi.id || 'draft', narrativeScript: script, phaseId: targetPhase }, signal);
            if (!data.audio_url) throw new Error('No se recibió un audio. Puedes reintentar.');
            setVersions(previous => {
                if (previous[targetPhase]?.narrative_script !== script) return previous;
                return { ...previous, [targetPhase]: { ...previous[targetPhase], audio_url: data.audio_url,
                    audio_duration_seconds: data.audio_duration_seconds ?? null, audio_generated_at: new Date().toISOString() } };
            });
            setDirty(true);
        });
    }

    function save() {
        run('save', async () => {
            const payload = {
                name: title.trim(), description: poi.description?.trim() || (generalTopic ? 'Tema general' : 'Punto de interés'),
                latitude: generalTopic ? null : (poi.latitude ?? poi.lat), longitude: generalTopic ? null : (poi.longitude ?? poi.lng),
                category: poi.category || 'landmark', is_favorite: poi.is_favorite || false,
                research_article: research || null, ...serializeNarrations(versions), image_url: imageUrl,
                is_general_topic: !!generalTopic, trigger_keywords: keywords.length ? keywords : null,
                ...(embedded ? { is_official: true } : {}),
                ...(poi.id && !String(poi.id).startsWith('temp-') ? { id: poi.id } : {}),
            };
            await onSave(payload);
            setDirty(false);
        });
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') { event.stopPropagation(); requestClose(); }
        if (embedded || event.key !== 'Tab') return;
        const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], audio[controls]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }

    const editor = <section ref={panelRef} className={styles.editor} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-label="Editor de narraciones por nivel educativo" onKeyDown={onKeyDown}>
        <header className={styles.header}>
            <div className={styles.headerTop}><span>{readOnly ? 'Biblioteca oficial' : generalTopic ? 'Tema general' : 'Punto de interés'}</span><button type="button" onClick={requestClose} disabled={committing} aria-label="Cerrar editor"><X size={20} /></button></div>
            {readOnly ? <h2>{title}</h2> : <><label className={styles.srOnly} htmlFor={uid + '-name'}>Nombre del lugar o tema</label><input id={uid + '-name'} value={title} disabled={!!busy} onChange={event => { setTitle(event.target.value); setDirty(true); }} placeholder="Nombre del lugar o tema" maxLength={240} /></>}
            <p>Un lugar, distintas formas de aprender.</p>
        </header>
        <div className={styles.body}>
            <div className={styles.sectionHeading}><h3>¿Para quién es la narración?</h3><span>{draftCount}/5 fases con guion</span></div>
            <div className={styles.phaseGrid} role="group" aria-label="Versiones por nivel educativo">
                {EDUCATION_PHASES.map(item => <button type="button" key={item.id} aria-pressed={item.id === phaseId} onClick={() => { audioRef.current?.pause(); setPhaseId(item.id); }}>
                    <strong>{item.shortLabel}</strong><span>{item.grades}{item.number ? ` · Fase ${item.number}` : ''}</span><small>{narrationStatus(versions[item.id], item.id)}</small>
                </button>)}
            </div>
            {phaseId === 'general' && <p className={styles.hint}>Esta es la versión original. Las adaptaciones por fase se guardan por separado.</p>}
            {readOnly && <p className={styles.hint}>Contenido oficial. Puedes consultar las versiones y escuchar los audios disponibles.</p>}
            <div className={styles.currentHeading}><h3>{phase.audience}</h3><span className={styles.status}>{narrationStatus(current, phaseId)}</span></div>
            {error && <div className={styles.error} role="alert">{error}<button type="button" aria-label="Cerrar mensaje" onClick={() => setError('')}><X size={16} /></button></div>}
            {busy && <p className={styles.busy} role="status"><Loader2 size={16} className={styles.spin} />{busy.kind === 'save' ? 'Guardando todas las versiones…' : `${busy.kind === 'audio' ? 'Creando audio' : busy.kind === 'research' ? 'Investigando' : busy.kind === 'images' ? 'Buscando imágenes' : 'Preparando propuesta'} · ${educationPhase(busy.phase).label}`}</p>}
            <fieldset className={styles.fields} disabled={readOnly || activeBusy || busy?.kind === 'save'}>
                {phase.number && <div className={styles.goal}>
                    <label htmlFor={uid + '-goal'}>¿Qué queremos que comprendan?</label>
                    {readOnly ? <p>{current.learning_goal || 'Propósito pendiente de definir.'}</p> : <textarea id={uid + '-goal'} rows={2} value={current.learning_goal} placeholder={phase.goal} maxLength={220} onChange={event => edit({ learning_goal: event.target.value })} />}
                </div>}
                {!readOnly && <details className={styles.instructions}><summary>Ajustar el enfoque <ChevronDown size={16} /></summary>
                    {phase.number && <><label htmlFor={uid + '-focus'}>Relación curricular</label><select id={uid + '-focus'} value={current.curriculum_focus} onChange={event => edit({ curriculum_focus: event.target.value })}><option value="context">Según el contenido del lugar</option><option value="nature">Naturaleza y cuidado del entorno</option></select><p className={styles.hint}>Elige un referente pertinente. En secundaria, el de naturaleza se centra en agua y cuencas.</p></>}
                    <label htmlFor={uid + '-notes'}>Ideas que quieres incluir</label><textarea id={uid + '-notes'} rows={2} value={current.custom_instructions} maxLength={2000} placeholder="Por ejemplo: destacar cómo se relaciona este lugar con la comunidad." onChange={event => edit({ custom_instructions: event.target.value })} />
                </details>}
                {!readOnly && <button type="button" className={styles.generate} disabled={!!busy || !!proposal || title.trim().length < 2} onClick={generateScript}><Sparkles size={17} />{current.narrative_script ? 'Crear otra propuesta' : 'Crear propuesta de guion'}</button>}
            </fieldset>
            {proposal && proposal.phaseId !== phaseId && <button type="button" className={styles.proposalNotice} onClick={() => setPhaseId(proposal.phaseId)}>Propuesta preparada para {educationPhase(proposal.phaseId).label}. Revisar →</button>}
            {proposal?.phaseId === phaseId && <div className={styles.proposal} aria-label="Propuesta de guion" role="status"><span className={styles.eyebrow}>Nueva propuesta · por revisar</span><p>{proposal.narrative_script}</p>{proposal.learning_goal && <p className={styles.hint}>Propósito: {proposal.learning_goal}</p>}{proposal.review_note && <p className={styles.hint}>{proposal.review_note}</p>}<div className={styles.actions}><button type="button" className={styles.primary} onClick={() => { const { phaseId: target, ...changes } = proposal; setVersions(previous => editNarration(previous, target, changes)); setDirty(true); setProposal(null); }}>Usar esta propuesta</button><button type="button" onClick={() => setProposal(null)}>Descartar</button></div><small>Al usarla, el guion anterior de esta fase se reemplaza y su audio debe regenerarse.</small></div>}
            <div className={styles.scriptHeading}><label htmlFor={uid + '-script'}>Guion para narrar</label><span>{wordCount} palabras</span></div>
            {readOnly ? <p className={styles.readScript}>{current.narrative_script || 'Aún no hay una narración para este nivel.'}</p> : <textarea className={styles.script} id={uid + '-script'} value={current.narrative_script} rows={6} maxLength={10000} disabled={activeBusy || busy?.kind === 'save'} onChange={event => edit({ narrative_script: event.target.value })} placeholder="Crea una propuesta o escribe el guion de esta versión." />}
            {!readOnly && wordCount > phase.maxWords && <p className={styles.hint}>Extensión sugerida: hasta {phase.maxWords} palabras. Puedes ajustar el texto después de escucharlo.</p>}
            {reference && <details className={styles.reference}><summary><BookOpen size={16} /> Fundamento educativo <ChevronDown size={16} /></summary><p><strong>{reference.field}</strong></p><p>{reference.content}</p><p>{reference.summary}</p><p className={styles.hint}>{reference.scope}</p><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.sourceTitle} ↗</a><p className={styles.hint}>Relación propuesta para revisión; no es una certificación de la SEP.</p>{current.review_note && <p>{current.review_note}</p>}</details>}
            {!readOnly && phase.number && current.narrative_script && <label className={styles.review}><input type="checkbox" checked={!!current.reviewed_at} disabled={activeBusy || busy?.kind === 'save'} onChange={event => edit({ reviewed_at: event.target.checked ? new Date().toISOString() : null })} /><span>Revisé los hechos, el lenguaje y la pertinencia educativa de este guion.</span></label>}
            <section className={styles.audio} aria-label="Audio de esta versión"><div className={styles.audioHeading}><Headphones size={19} /><div><strong>Audio de esta versión</strong><p>{current.audio_url ? (current.audio_duration_seconds ? `${current.audio_duration_seconds} segundos · duración real` : 'Disponible para escuchar') : 'Pendiente de generar'}</p></div></div>
                {current.audio_url && <audio key={phaseId + current.audio_url} ref={audioRef} controls preload="none" src={audioSrc} onError={() => setError('No se pudo cargar este audio. Comprueba tu conexión y vuelve a intentarlo.')} />}
                {!readOnly && <><button type="button" disabled={!!busy || !current.narrative_script.trim() || (!!phase.number && (!current.reviewed_at || !current.learning_goal.trim()))} onClick={generateAudio}>{current.audio_url ? 'Regenerar audio' : 'Generar audio'}</button>{phase.number && !current.reviewed_at && <p className={styles.hint}>Revisa el guion antes de crear su audio. Puedes guardar el borrador ahora.</p>}</>}
            </section>
            <details className={styles.research}><summary><BookOpen size={16} /> Investigación del lugar <span>Común a todas las fases</span></summary>{readOnly ? <p className={styles.readScript}>{research || 'Investigación no disponible.'}</p> : <><label htmlFor={uid + '-research'}>Información y fuentes</label><textarea id={uid + '-research'} rows={8} value={research} disabled={!!busy} onChange={event => { setResearch(event.target.value); setDirty(true); }} placeholder="Pega la investigación y sus fuentes, o investiga el lugar." /><p className={styles.hint}>Verifica los datos y sus fuentes antes de aprobar una narración.</p><button type="button" disabled={!!busy || title.trim().length < 2} onClick={() => run('research', researchPlace)}>{research ? 'Actualizar investigación' : 'Investigar lugar'}</button><details className={styles.engine}><summary>Motor de investigación</summary><EngineSelector activeEngine={engine} setActiveEngine={setEngine} tavilyUsage={usage} readOnly={!!busy} /></details></>}</details>
            {!readOnly && <details className={styles.cover}><summary>Portada del punto <ChevronDown size={16} /></summary>{imageUrl && <Image unoptimized width={600} height={160} src={poiImageUrlForBrowser(imageUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)} alt="Portada seleccionada" />}<ImageSelector poiImages={images} selectedImageUrl={imageUrl} setSelectedImageUrl={url => { setImageUrl(url); setDirty(true); }} isLoadingImages={busy?.kind === 'images'} fetchPoiImages={() => run('images', async signal => { const data = await post('/api/poi-images', { poiName: title, context: geoContext }, signal); setImages(data.images || []); })} readOnly={false} /></details>}
        </div>
        <footer className={styles.footer}>
            {confirmClose ? <div className={styles.confirm} role="alert"><p>{busy ? 'Hay una tarea en curso. Al salir se cancelará y perderás los cambios sin guardar.' : 'Tienes cambios o una propuesta sin guardar.'}</p><div className={styles.actions}><button type="button" onClick={() => setConfirmClose(false)}>Seguir editando</button><button type="button" className={styles.danger} onClick={onClose}>Salir sin guardar</button></div></div>
                : confirmDelete ? <div className={styles.confirm} role="alert"><p>Se eliminará el punto con todas sus versiones.</p><div className={styles.actions}><button type="button" disabled={!!busy} onClick={() => setConfirmDelete(false)}>Conservar</button><button type="button" disabled={!!busy} className={styles.danger} onClick={() => run('delete', async () => { await onDelete(poi.id); })}>Eliminar punto</button></div></div>
                : readOnly ? <button type="button" className={styles.primary} onClick={onClose}>Cerrar</button>
                    : <><div className={styles.saveHint}><span>{dirty ? 'Cambios sin guardar' : 'Puedes guardar y continuar después'}</span><small>Se guardan todas las versiones, incluso sin audio.</small></div><div className={styles.actions}>{onDelete && poi.id && !String(poi.id).startsWith('temp-') && <button type="button" aria-label="Eliminar punto" disabled={!!busy} onClick={() => setConfirmDelete(true)}><Trash2 size={19} /></button>}<button type="button" className={styles.primary} disabled={!!busy || !!proposal || title.trim().length < 2} onClick={save}>{busy?.kind === 'save' ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}Guardar cambios</button></div>{proposal && <small>Usa o descarta la propuesta antes de guardar.</small>}</>}
        </footer>
    </section>;
    return embedded ? editor : <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>{editor}</div>;
}
