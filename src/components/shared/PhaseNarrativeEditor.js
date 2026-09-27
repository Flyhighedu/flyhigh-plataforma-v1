'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Headphones, Loader2, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import NarrationDocument, { GrowingTextarea } from './NarrationDocument';
import NarrationGeneration, { StoryIllustration } from './NarrationGeneration';
import { researchDocument, replaceResearchDocument } from '@/lib/research-document.mjs';
import { EngineSelector, ImageSelector } from './SharedNarrativeFactory';
import { EDUCATION_PHASES, curriculumReference, educationPhase, hasUsableResearch } from '@/lib/education-phases.mjs';
import { editNarration, emptyNarration, narrationStatus, readNarrations, serializeNarrations } from '@/lib/narrative-versions.mjs';
import { poiImageUrlForBrowser } from '@/lib/poi-image-url.mjs';
import { localReviewAudioPath } from '@/lib/review-audio.mjs';
import { NARRATION_PHASES, hasScript, missingPhases, pendingReviews, pendingAudios, initialNarrationStep, confirmNarrations, runNarrationBatch } from '@/lib/narration-workflow.mjs';
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
    const [researchDraft, setResearchDraft] = useState(() => researchDocument(poi.research_article || '').text);
    const [versions, setVersions] = useState(() => readNarrations(poi));
    const [phaseId, setPhaseId] = useState(() => readOnly && poi.narrative_script ? 'general' : (pendingReviews(readNarrations(poi))[0]?.id || NARRATION_PHASES.find(item => hasScript(readNarrations(poi)[item.id]))?.id || 'phase_2'));
    const [step, setStep] = useState(() => initialNarrationStep(poi, readNarrations(poi)));
    const [editingResearch, setEditingResearch] = useState(false);
    const [editingScript, setEditingScript] = useState(false);
    const [notice, setNotice] = useState('');
    const [progress, setProgress] = useState(null);
    const [failures, setFailures] = useState({});
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
    const bodyRef = useRef(null);
    const stepHeadingRef = useRef(null);
    const audioRef = useRef(null);
    const phase = educationPhase(phaseId);
    const current = versions[phaseId] || emptyNarration();
    const reference = curriculumReference(phaseId, current.curriculum_focus);
    const committing = busy?.kind === 'save' || busy?.kind === 'delete';
    const wordCount = current.narrative_script.trim().split(/\s+/).filter(Boolean).length;
    const generalTopic = isGeneralTopic || poi.is_general_topic || ((poi.latitude ?? poi.lat) == null && (poi.longitude ?? poi.lng) == null);
    const draftCount = Object.entries(versions).filter(([id, version]) => id !== 'general' && version.narrative_script.trim()).length;
    const missing = missingPhases(versions);
    const unreviewed = pendingReviews(versions);
    const withoutAudio = pendingAudios(versions);
    const researchText = researchDocument(research).text;
    const researchReady = hasUsableResearch(researchText);

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
        const heading = stepHeadingRef.current || panelRef.current?.querySelector('[aria-label="Generación en curso"] h2');
        (heading || panelRef.current)?.focus({ preventScroll: true });
    }, [step, phaseId, busy?.kind]);

    useEffect(() => { if (error) bodyRef.current?.scrollTo({ top: 0 }); }, [error]);

    function selectPhase(id) {
        audioRef.current?.pause();
        setPhaseId(id);
        setEditingScript(false);
    }

    function startReview(nextVersions = versions) {
        selectPhase(pendingReviews(nextVersions)[0]?.id || NARRATION_PHASES.find(item => hasScript(nextVersions[item.id]))?.id || 'phase_2');
        setStep(2);
    }

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
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.querySelector('button')?.focus();
        return () => { document.body.style.overflow = previousOverflow; previous?.focus?.(); };
    }, []);

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
        setError(''); setNotice('');
        try { await work(controller.signal); }
        catch (failure) { if (failure.name !== 'AbortError') setError(failure.message || 'Revisa tu conexión e intenta de nuevo.'); }
        finally { requests.current.delete(controller); lock.current = false; setBusy(null); setProgress(null); }
    }

    async function researchPlace(signal) {
        if (title.trim().length < 2) throw new Error('Escribe el nombre del lugar o tema para investigarlo.');
        const data = await post('/api/poi-deep-research', {
            name: title.trim(), type: poi.description || '', context: geoContext,
            lat: poi.latitude ?? poi.lat, lon: poi.longitude ?? poi.lng, preferredEngine: engine,
        }, signal);
        if (!hasUsableResearch(researchDocument(data.article).text)) throw new Error('No recibimos información suficiente. Intenta investigar de nuevo.');
        setResearch(data.article); setResearchDraft(researchDocument(data.article).text); setEditingResearch(false); setDirty(true);
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

    function generateMissingScripts() {
        run('scripts', async signal => {
            if (!researchReady) { setStep(1); return; }
            setStep(2); setEditingResearch(false);
            let next = versions;
            setFailures({});
            await runNarrationBatch({
                phases: missingPhases(next), signal,
                onProgress: (item, index, total) => setProgress({ phase: item.id, index: index + 1, total }),
                request: async (item, requestSignal) => {
                    const existing = next[item.id] || emptyNarration();
                    const data = await post('/api/poi-generate-script', {
                        poiName: title.trim(), lat: poi.latitude ?? poi.lat, lng: poi.longitude ?? poi.lng,
                        researchArticle: research, customInstructions: existing.custom_instructions,
                        phaseId: item.id, curriculumFocus: existing.curriculum_focus, learningGoal: existing.learning_goal,
                    }, requestSignal);
                    if (!data.script?.trim()) throw new Error('No se recibió un guion. Vuelve a intentarlo.');
                    return { narrative_script: data.script, learning_goal: data.learning_goal || existing.learning_goal,
                        review_note: data.review_note || '', curriculum_focus: existing.curriculum_focus };
                },
                onResult: (item, result) => { next = editNarration(next, item.id, result); setVersions(next); setDirty(true); },
                onFailure: (item, failure) => setFailures(previous => ({ ...previous, [item.id]: failure.message })),
            });
            startReview(next);
            if (signal.aborted) setNotice('Generación detenida. Los guiones terminados siguen en este borrador.');
        });
    }

    function generateMissingAudios() {
        run('audios', async signal => {
            setFailures({});
            await runNarrationBatch({
                phases: pendingAudios(versions), signal,
                onProgress: (item, index, total) => setProgress({ phase: item.id, index: index + 1, total }),
                request: async (item, requestSignal) => {
                    const data = await post('/api/poi-generate-audio', { poiId: poi.id || 'draft', narrativeScript: versions[item.id].narrative_script, phaseId: item.id }, requestSignal);
                    if (!data.audio_url) throw new Error('No se recibió un audio. Vuelve a intentarlo.');
                    return data;
                },
                onResult: (item, data) => {
                    setVersions(previous => ({ ...previous, [item.id]: { ...previous[item.id], audio_url: data.audio_url, audio_duration_seconds: data.audio_duration_seconds ?? null, audio_generated_at: new Date().toISOString() } }));
                    setDirty(true);
                },
                onFailure: (item, failure) => setFailures(previous => ({ ...previous, [item.id]: failure.message })),
            });
        });
    }

    function confirmAndContinue() {
        const invalid = NARRATION_PHASES.find(item => hasScript(versions[item.id]) && !versions[item.id].learning_goal?.trim());
        if (invalid) { selectPhase(invalid.id); setEditingScript(true); setError('Añade el propósito de aprendizaje de este guion para continuar.'); return; }
        try {
            setVersions(confirmNarrations(versions));
            if (unreviewed.length) setDirty(true);
            setStep(3); setFailures({}); setError('');
        }
        catch (failure) { setError(failure.message); }
    }

    function generateAudio(targetPhase = phaseId) {
        const script = versions[targetPhase]?.narrative_script;
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
        if (event.key !== 'Tab') return;
        const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], audio[controls]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }

    const generating = ['research', 'scripts', 'audios'].includes(busy?.kind);
    const availablePhases = (readOnly ? EDUCATION_PHASES : NARRATION_PHASES).filter(item => hasScript(versions[item.id]));
    const selectable = !readOnly && hasScript(versions.general) ? [...availablePhases, EDUCATION_PHASES[0]] : availablePhases;
    const selectedIndex = selectable.findIndex(item => item.id === phaseId);
    const showPicker = (readOnly || step === 2) && !generating && !!selectable.length;
    const completeLabel = missing.length === 5 ? 'Crear los 5 guiones' : missing.length === 1 ? 'Completar la versión faltante' : `Completar las ${missing.length} versiones faltantes`;
    let primaryLabel, primaryAction;
    const primaryDisabled = !!busy || !!proposal || title.trim().length < 2;
    if (step === 1) {
        primaryLabel = researchReady ? (missing.length ? completeLabel : 'Ver los guiones') : generalTopic ? 'Investigar este tema' : 'Investigar este lugar';
        primaryAction = researchReady ? (missing.length ? generateMissingScripts : () => startReview()) : () => run('research', researchPlace);
    } else if (step === 2) {
        primaryLabel = missing.length ? (researchReady ? completeLabel : 'Investigar para completar') : unreviewed.length ? 'Confirmar guiones y continuar' : 'Continuar a finalizar';
        primaryAction = missing.length ? (researchReady ? generateMissingScripts : () => setStep(1)) : confirmAndContinue;
    } else { primaryLabel = 'Guardar y terminar'; primaryAction = save; }
    const busyLabel = busy?.kind === 'save' ? 'Guardando…' : busy?.kind === 'delete' ? 'Eliminando…' : generating ? 'Creación en curso…' : busy?.kind === 'images' ? 'Buscando portadas…' : busy?.kind === 'audio' ? 'Creando audio…' : 'Preparando otra propuesta…';
    function stopGeneration() {
        for (const controller of requests.current) controller.abort();
        setNotice('Proceso detenido. Los resultados terminados siguen en este borrador.');
    }
    function changeStep(next) {
        audioRef.current?.pause(); setEditingScript(false); setEditingResearch(false); setError(''); setStep(next);
    }
    const audioPlayer = (url, label, ref) => <audio ref={ref} key={url} aria-label={label} controls preload="none" src={localReviewAudioPath(url) ? `/api/review-lab/audio?url=${encodeURIComponent(url)}` : url} onPlay={event => { panelRef.current?.querySelectorAll('audio').forEach(player => { if (player !== event.currentTarget) player.pause(); }); }} onError={() => setError('No se pudo cargar este audio. Comprueba tu conexión e intenta de nuevo.')} />;
    const researchView = <>
        <div className={styles.documentHeading}><div><span className={styles.eyebrow}>LA HISTORIA DETRÁS DEL LUGAR</span><h2 ref={stepHeadingRef} tabIndex={-1}>Tu investigación</h2></div>{!readOnly && <button type="button" disabled={!!busy} onClick={() => setEditingResearch(!editingResearch)}>{editingResearch ? <Check size={17} /> : <Pencil size={17} />}{editingResearch ? 'Terminar edición' : 'Editar investigación'}</button>}</div>
        {editingResearch && !readOnly ? <><label className={styles.srOnly} htmlFor={uid + '-research'}>Texto de la investigación</label><GrowingTextarea id={uid + '-research'} className={styles.documentInput} value={researchDraft} disabled={!!busy} onChange={event => { setResearchDraft(event.target.value); setResearch(replaceResearchDocument(research, event.target.value)); setDirty(true); }} placeholder="Escribe o pega aquí la investigación." /></> : <NarrationDocument text={researchText} label="Investigación del lugar" />}
        {!readOnly && <details className={styles.details}><summary>Opciones de investigación</summary><label htmlFor={uid + '-name'}>Nombre del lugar o tema</label><input id={uid + '-name'} value={title} disabled={!!busy} maxLength={240} onChange={event => { setTitle(event.target.value); setDirty(true); }} /><button type="button" disabled={!!busy} onClick={() => run('research', researchPlace)}>Investigar de nuevo</button><div className={styles.engine}><EngineSelector activeEngine={engine} setActiveEngine={setEngine} tavilyUsage={usage} readOnly={!!busy} /></div></details>}
    </>;
    const scriptView = <>
        <div className={styles.documentHeading}><div><span className={styles.eyebrow}>{phase.number ? `FASE ${phase.number} · ${phase.grades}` : 'NARRACIÓN ORIGINAL'}</span><h2 ref={stepHeadingRef} tabIndex={-1}>{phase.label}</h2></div><span className={styles.status}>{narrationStatus(current, phaseId)}</span></div>
        {phase.number && (editingScript && !readOnly ? <div className={styles.goalEdit}><label htmlFor={uid + '-goal'}>Propósito de aprendizaje</label><GrowingTextarea id={uid + '-goal'} value={current.learning_goal} disabled={!!busy || !!proposal} maxLength={220} placeholder={phase.goal} onChange={event => edit({ learning_goal: event.target.value })} /></div> : <p className={styles.goal}><strong>Para aprender:</strong> {current.learning_goal || 'Propósito pendiente de definir.'}</p>)}
        {proposal ? <section className={styles.proposal} aria-label="Propuesta de guion"><span className={styles.eyebrow}>NUEVA PROPUESTA</span><NarrationDocument text={proposal.narrative_script} label="Nuevo guion propuesto" /><p className={styles.goal}>{proposal.learning_goal}</p><div className={styles.actions}><button type="button" className={styles.primary} onClick={() => { const { phaseId: target, ...changes } = proposal; setVersions(previous => editNarration(previous, target, changes)); setDirty(true); setProposal(null); setEditingScript(false); }}>Usar esta propuesta</button><button type="button" onClick={() => setProposal(null)}>Conservar el anterior</button></div><p className={styles.hint}>Al usarla, se reemplaza este guion y se retira su audio anterior.</p></section> : editingScript && !readOnly ? <><label className={styles.srOnly} htmlFor={uid + '-script'}>Guion para narrar</label><GrowingTextarea id={uid + '-script'} className={styles.documentInput} value={current.narrative_script} disabled={!!busy} maxLength={10000} onChange={event => edit({ narrative_script: event.target.value })} placeholder="Escribe el guion." /></> : <NarrationDocument text={current.narrative_script || 'Esta versión todavía no tiene guion.'} label="Guion para narrar" />}
        {!readOnly && !proposal && <div className={styles.scriptTools}><button type="button" disabled={!!busy} onClick={() => setEditingScript(!editingScript)}>{editingScript ? <Check size={17} /> : <Pencil size={17} />}{editingScript ? 'Terminar edición' : 'Editar guion'}</button><button type="button" disabled={!!busy || !researchReady} onClick={generateScript}><Sparkles size={17} />Crear otra propuesta</button><span>{wordCount} palabras</span></div>}
        {!readOnly && editingScript && <details className={styles.details}><summary>Ajustar el enfoque</summary><fieldset disabled={!!busy || !!proposal}>{phase.number && <><label htmlFor={uid + '-focus'}>Relación curricular</label><select id={uid + '-focus'} value={current.curriculum_focus} onChange={event => edit({ curriculum_focus: event.target.value })}><option value="context">Según el contenido del lugar</option><option value="nature">Naturaleza y cuidado del entorno</option></select></>}<label htmlFor={uid + '-notes'}>Ideas para otra propuesta</label><GrowingTextarea id={uid + '-notes'} value={current.custom_instructions} maxLength={2000} onChange={event => edit({ custom_instructions: event.target.value })} /></fieldset></details>}
        {reference && <details className={styles.details}><summary>Enfoque educativo</summary><p>{reference.summary}</p><p>{reference.scope}</p>{current.review_note && <p>{current.review_note}</p>}</details>}
        {(readOnly || phaseId === 'general') && current.audio_url && <section className={styles.audio} aria-label="Audio de esta versión">{audioPlayer(current.audio_url, 'Escuchar ' + phase.label, audioRef)}</section>}
        {!readOnly && phaseId === 'general' && <button type="button" disabled={!!busy || !!proposal || !hasScript(current)} onClick={() => generateAudio()}><Headphones size={17} />{current.audio_url ? 'Regenerar audio original' : 'Generar audio original'}</button>}
        {readOnly && researchText && <details className={styles.details}><summary>Leer la investigación</summary><NarrationDocument text={researchText} label="Investigación del lugar" /></details>}
    </>;
    const editor = <section ref={panelRef} className={styles.editor} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Editor de narraciones por nivel educativo" onKeyDown={onKeyDown}>
        <header className={styles.header}>
            <div className={styles.headerTop}><div className={styles.identity}><span className={styles.brandIcon}><BookOpen size={19} /></span><div><span className={styles.eyebrow}>{readOnly ? 'BIBLIOTECA OFICIAL' : 'ESTUDIO DE NARRACIONES'}</span><h1 title={title}>{title || (generalTopic ? 'Nuevo tema' : 'Nuevo punto de interés')}</h1></div></div><button type="button" onClick={requestClose} disabled={committing} aria-label="Cerrar editor"><X size={20} /></button></div>
            {!readOnly && <nav className={styles.steps} aria-label="Pasos para crear narraciones">{['Investigación', 'Guiones', 'Finalizar'].map((label, index) => <button type="button" key={label} aria-current={step === index + 1 ? 'step' : undefined} disabled={!!busy || !!proposal || (index === 1 && !draftCount) || (index === 2 && (!!missing.length || !!unreviewed.length))} onClick={() => index === 1 ? startReview() : changeStep(index + 1)}><span>{index + 1}</span>{label}</button>)}</nav>}
            {showPicker && <div className={styles.mobilePicker}><button type="button" aria-label="Versión anterior" disabled={!!busy || !!proposal || selectedIndex <= 0} onClick={() => selectPhase(selectable[selectedIndex - 1].id)}><ChevronLeft size={18} /></button><label className={styles.srOnly} htmlFor={uid + '-version'}>Versión educativa</label><select id={uid + '-version'} value={phaseId} disabled={!!busy || !!proposal} onChange={event => selectPhase(event.target.value)}>{selectable.map(item => <option key={item.id} value={item.id}>{item.label}{item.id === 'general' ? ' · Original' : ''}</option>)}</select><button type="button" aria-label="Versión siguiente" disabled={!!busy || !!proposal || selectedIndex >= selectable.length - 1} onClick={() => selectPhase(selectable[selectedIndex + 1].id)}><ChevronRight size={18} /></button></div>}
        </header>
        <div className={styles.workspace}>
            {showPicker && <nav className={styles.phasePicker} aria-label="Versiones por nivel educativo"><p>TUS VERSIONES</p>{selectable.map(item => <button type="button" key={item.id} disabled={!!busy || !!proposal} aria-pressed={item.id === phaseId} onClick={() => selectPhase(item.id)}><span>{item.label}</span><small>{item.number ? `Fase ${item.number}` : 'Se conserva por separado'}</small></button>)}</nav>}
            <main ref={bodyRef} className={styles.body} data-narration-scroll>
                <div className={styles.content}>
                    {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" aria-label="Cerrar mensaje" onClick={() => setError('')}><X size={16} /></button></div>}
                    {notice && !busy && <p className={styles.notice} role="status">{notice}</p>}
                    {busy && !generating && <p className={styles.busy} role="status"><Loader2 size={17} className={styles.spin} />{busyLabel}</p>}
                    {generating ? <NarrationGeneration kind={busy.kind} versions={versions} progress={progress} failures={failures} /> : readOnly ? scriptView : step === 1 ? <>
                        {!researchText && !editingResearch ? <section className={styles.welcome}><StoryIllustration /><span className={styles.eyebrow}>PRIMERO, CONOZCAMOS SU HISTORIA</span><h2 ref={stepHeadingRef} tabIndex={-1}>{generalTopic ? 'Cada tema tiene algo que contar' : 'Cada lugar tiene algo que contar'}</h2><p>Una investigación para crear las cinco versiones educativas.</p><label htmlFor={uid + '-name'}>{generalTopic ? 'Nombre del tema' : 'Nombre del lugar'}</label><input id={uid + '-name'} value={title} disabled={!!busy} maxLength={240} onChange={event => { setTitle(event.target.value); setDirty(true); }} placeholder={generalTopic ? '¿Sobre qué vamos a contar?' : '¿Qué lugar vamos a conocer?'} /><button type="button" className={styles.textButton} onClick={() => setEditingResearch(true)}>Ya tengo una investigación</button></section> : researchView}
                        {!!draftCount && <button type="button" className={styles.textButton} onClick={() => startReview()}>Ver {draftCount === 1 ? 'el guion existente' : `los ${draftCount} guiones existentes`}</button>}
                    </> : step === 2 ? <>
                        {!!missing.length && <section className={styles.missing} aria-label="Versiones pendientes"><strong>{draftCount ? `${draftCount} de 5 guiones disponibles` : 'Todavía no hay guiones terminados'}</strong><p>{draftCount ? 'Puedes leerlos mientras completas las versiones pendientes.' : 'Puedes reintentar la creación desde el botón de abajo.'}</p>{NARRATION_PHASES.filter(item => failures[item.id]).map(item => <p key={item.id} role="alert"><strong>{item.label}:</strong> {failures[item.id]}</p>)}</section>}
                        {hasScript(current) ? scriptView : !missing.length ? null : <StoryIllustration />}
                    </> : <>
                        <div className={styles.documentHeading}><div><span className={styles.eyebrow}>EL ÚLTIMO TOQUE</span><h2 ref={stepHeadingRef} tabIndex={-1}>Tus narraciones, listas para guardar</h2><p>Agrega audio ahora o guarda los guiones para después.</p></div></div>
                        <section className={styles.finishAudio} aria-label="Audios de las narraciones"><div className={styles.sectionHeading}><h3><Headphones size={20} />Voz para cada nivel</h3><span>{NARRATION_PHASES.filter(item => versions[item.id]?.audio_url).length}/5 audios</span></div>
                            {!!withoutAudio.length && <button type="button" className={styles.audioAction} disabled={!!busy} onClick={generateMissingAudios}><Headphones size={17} />{withoutAudio.length === 1 ? 'Generar el audio pendiente' : `Generar los ${withoutAudio.length} audios pendientes`}</button>}
                            <div className={styles.audioList}>{NARRATION_PHASES.map(item => { const version = versions[item.id] || emptyNarration(); return <div key={item.id} className={styles.audioRow}><div><strong>{item.label}</strong><span>{version.audio_url ? version.audio_duration_seconds ? `${version.audio_duration_seconds} s` : 'Audio listo' : 'Sin audio'}</span></div>{version.audio_url && <>{audioPlayer(version.audio_url, 'Escuchar ' + item.label)}<button type="button" className={styles.textButton} disabled={!!busy} onClick={() => generateAudio(item.id)}>Regenerar audio de {item.label}</button></>}{failures[item.id] && <p role="alert" className={styles.failure}>{failures[item.id]}</p>}</div>; })}</div>
                        </section>
                        <details className={styles.cover}><summary>Personalizar portada <span>Opcional</span></summary>{imageUrl && <Image unoptimized width={600} height={160} src={poiImageUrlForBrowser(imageUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)} alt="Portada seleccionada" />}<ImageSelector poiImages={images} selectedImageUrl={imageUrl} setSelectedImageUrl={url => { setImageUrl(url); setDirty(true); }} isLoadingImages={busy?.kind === 'images'} fetchPoiImages={() => run('images', async signal => { const data = await post('/api/poi-images', { poiName: title, context: geoContext }, signal); setImages(data.images || []); })} readOnly={!!busy} /></details>
                        <details className={styles.details}><summary>Opciones del punto</summary><label htmlFor={uid + '-name'}>Nombre del lugar o tema</label><input id={uid + '-name'} value={title} disabled={!!busy} maxLength={240} onChange={event => { setTitle(event.target.value); setDirty(true); }} />{onDelete && poi.id && !String(poi.id).startsWith('temp-') && <button type="button" className={styles.danger} disabled={!!busy} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Eliminar punto</button>}</details>
                    </>}
                </div>
            </main>
        </div>
        <footer className={styles.footer}>
            {confirmClose ? <div className={styles.confirm} role="alert"><p>{busy ? 'Al salir se cancelará la tarea y perderás los cambios sin guardar.' : 'Tienes cambios o una propuesta sin guardar.'}</p><div className={styles.actions}><button type="button" onClick={() => setConfirmClose(false)}>Seguir editando</button><button type="button" className={styles.danger} onClick={onClose}>Salir sin guardar</button></div></div>
                : confirmDelete ? <div className={styles.confirm} role="alert"><p>Se eliminará el punto con todas sus versiones.</p><div className={styles.actions}><button type="button" disabled={!!busy} onClick={() => setConfirmDelete(false)}>Conservar</button><button type="button" disabled={!!busy} className={styles.danger} onClick={() => run('delete', async () => { await onDelete(poi.id); })}>Eliminar punto</button></div></div>
                : readOnly ? <button type="button" className={styles.primary} onClick={onClose}>Cerrar</button> : generating ? <div className={styles.generatingFooter}><span>Tu trabajo terminado se conserva en este borrador.</span><button type="button" onClick={stopGeneration}>Detener</button></div> : <>
                    <div className={styles.footerMain}><button type="button" className={styles.textButton} disabled={!!busy || !!proposal || title.trim().length < 2} onClick={save}>Guardar borrador y salir</button><button type="button" className={styles.primary} disabled={primaryDisabled} onClick={primaryAction}>{busy ? <Loader2 size={18} className={styles.spin} /> : <ArrowRight size={18} />}{busy ? busyLabel : primaryLabel}</button></div>
                    {step === 2 && !missing.length && !!unreviewed.length && !proposal && <small>Al confirmar, marcas las cinco versiones como revisadas.</small>}{proposal && <small>Usa la propuesta o conserva el guion anterior para continuar.</small>}
                </>}
        </footer>
    </section>;
    return typeof document === 'undefined' ? null : createPortal(<div className={styles.overlay}>{editor}</div>, document.body);
}
