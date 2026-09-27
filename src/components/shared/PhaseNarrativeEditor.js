'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, Headphones, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { EngineSelector, ImageSelector } from './SharedNarrativeFactory';
import { EDUCATION_PHASES, curriculumReference, educationPhase, hasUsableResearch } from '@/lib/education-phases.mjs';
import { editNarration, emptyNarration, narrationStatus, readNarrations, serializeNarrations } from '@/lib/narrative-versions.mjs';
import { poiImageUrlForBrowser } from '@/lib/poi-image-url.mjs';
import { localReviewAudioPath } from '@/lib/review-audio.mjs';
import { NARRATION_PHASES, hasScript, missingPhases, pendingReviews, pendingAudios, initialNarrationStep, runNarrationBatch } from '@/lib/narration-workflow.mjs';
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
    const [phaseId, setPhaseId] = useState(() => readOnly && poi.narrative_script ? 'general' : (pendingReviews(readNarrations(poi))[0]?.id || 'phase_2'));
    const [step, setStep] = useState(() => initialNarrationStep(poi, readNarrations(poi)));
    const [reviewMode, setReviewMode] = useState('scripts');
    const [manualResearch, setManualResearch] = useState(false);
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
    const audioSrc = localReviewAudioPath(current.audio_url) ? `/api/review-lab/audio?url=${encodeURIComponent(current.audio_url)}` : current.audio_url;
    const wordCount = current.narrative_script.trim().split(/\s+/).filter(Boolean).length;
    const generalTopic = isGeneralTopic || poi.is_general_topic || ((poi.latitude ?? poi.lat) == null && (poi.longitude ?? poi.lng) == null);
    const draftCount = Object.entries(versions).filter(([id, version]) => id !== 'general' && version.narrative_script.trim()).length;
    const missing = missingPhases(versions);
    const unreviewed = pendingReviews(versions);
    const withoutAudio = pendingAudios(versions);
    const researchReady = hasUsableResearch(research);

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
        stepHeadingRef.current?.focus({ preventScroll: true });
    }, [step, reviewMode, phaseId]);

    function selectPhase(id) {
        audioRef.current?.pause();
        setPhaseId(id);
    }

    function startReview(nextVersions = versions) {
        selectPhase(pendingReviews(nextVersions)[0]?.id || NARRATION_PHASES.find(item => hasScript(nextVersions[item.id]))?.id || 'phase_2');
        setReviewMode('scripts');
        setStep(3);
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
        finally { requests.current.delete(controller); lock.current = false; setBusy(null); setProgress(null); }
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

    function generateMissingScripts() {
        run('scripts', async signal => {
            if (!researchReady) { setStep(1); return; }
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
            if (!signal.aborted && !missingPhases(next).length) startReview(next);
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

    function approveAndContinue() {
        const next = editNarration(versions, phaseId, { reviewed_at: new Date().toISOString() });
        setVersions(next); setDirty(true);
        const pending = pendingReviews(next);
        if (pending.length) { selectPhase(pending[0].id); bodyRef.current?.scrollTo({ top: 0 }); }
        else if (missingPhases(next).length) setStep(researchReady ? 2 : 1);
        else { setReviewMode('audio'); setFailures({}); }
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

    const busyLabel = busy?.kind === 'save' ? 'Guardando…' : busy?.kind === 'research' ? 'Investigando el lugar…' : progress ? `${busy.kind === 'audios' ? 'Creando audio' : 'Creando guion'} ${progress.index} de ${progress.total} · ${educationPhase(progress.phase).shortLabel}` : 'Preparando…';
    let primaryLabel, primaryAction, primaryDisabled = !!busy || !!proposal || title.trim().length < 2;
    if (step === 1) {
        primaryLabel = researchReady ? 'Usar esta investigación y continuar' : generalTopic ? 'Investigar este tema' : 'Investigar este lugar';
        primaryAction = researchReady ? () => setStep(2) : () => run('research', researchPlace);
    } else if (step === 2) {
        primaryLabel = missing.length ? (missing.length === 5 ? 'Crear los 5 guiones' : `Crear ${missing.length === 1 ? 'la versión faltante' : `las ${missing.length} versiones faltantes`}`) : 'Revisar los guiones';
        primaryAction = missing.length ? generateMissingScripts : () => startReview();
    } else if (phaseId === 'general' && reviewMode === 'scripts') {
        primaryLabel = 'Continuar con las fases'; primaryAction = () => missing.length ? setStep(researchReady ? 2 : 1) : startReview();
    } else if (reviewMode === 'audio') {
        primaryLabel = withoutAudio.length ? `Generar ${withoutAudio.length === 1 ? 'el audio pendiente' : `los ${withoutAudio.length} audios pendientes`}` : 'Guardar y terminar';
        primaryAction = withoutAudio.length ? generateMissingAudios : save;
    } else {
        primaryLabel = !hasScript(current) ? 'Completar las fases' : !current.reviewed_at ? (unreviewed.length > 1 ? 'Aprobar y continuar' : missing.length ? 'Aprobar y completar las fases' : 'Aprobar y ver audios') : unreviewed.length ? 'Revisar el siguiente guion' : missing.length ? 'Completar las fases' : 'Continuar a los audios';
        primaryAction = !hasScript(current) ? () => setStep(researchReady ? 2 : 1) : !current.reviewed_at ? approveAndContinue : unreviewed.length ? () => selectPhase(unreviewed[0].id) : missing.length ? () => setStep(researchReady ? 2 : 1) : () => { setReviewMode('audio'); setFailures({}); };
        primaryDisabled ||= hasScript(current) && !current.learning_goal.trim();
    }
    const researchField = <><label htmlFor={uid + '-research'}>Investigación y fuentes</label><textarea id={uid + '-research'} rows={9} value={research} disabled={!!busy} onChange={event => { setResearch(event.target.value); setDirty(true); }} placeholder="Información verificada del lugar, con sus fuentes." /><p className={styles.hint}>Comprueba los datos y las fuentes. Esta investigación será la base de las cinco versiones.</p></>;
    const versionPicker = <div className={styles.phaseGrid} role="group" aria-label="Versiones por nivel educativo">
        {(readOnly ? EDUCATION_PHASES : NARRATION_PHASES.filter(item => hasScript(versions[item.id]))).map(item => <button type="button" key={item.id} disabled={!!busy || !!proposal} aria-pressed={item.id === phaseId} onClick={() => selectPhase(item.id)}><strong>{item.shortLabel}</strong><small>{narrationStatus(versions[item.id], item.id)}</small></button>)}
    </div>;
    const scriptEditor = <>
        <div className={styles.currentHeading}><div><span className={styles.eyebrow}>{phase.number ? `Fase ${phase.number} · ${phase.grades}` : 'Versión original'}</span><h3>{phase.audience}</h3></div><span className={styles.status}>{narrationStatus(current, phaseId)}</span></div>
        {phase.number && <div className={styles.goal}><label htmlFor={uid + '-goal'}>Propósito de aprendizaje</label>{readOnly ? <p>{current.learning_goal || 'Pendiente de revisión.'}</p> : <textarea id={uid + '-goal'} rows={2} disabled={!!busy || !!proposal} value={current.learning_goal} placeholder={phase.goal} maxLength={220} onChange={event => edit({ learning_goal: event.target.value })} />}</div>}
        {proposal && <div className={styles.proposal} aria-label="Propuesta de guion"><span className={styles.eyebrow}>Nueva propuesta · por revisar</span><p>{proposal.narrative_script}</p><p className={styles.hint}>{proposal.learning_goal}</p>{proposal.review_note && <p className={styles.hint}>{proposal.review_note}</p>}<div className={styles.actions}><button type="button" className={styles.primary} onClick={() => { const { phaseId: target, ...changes } = proposal; setVersions(previous => editNarration(previous, target, changes)); setDirty(true); setProposal(null); }}>Usar esta propuesta</button><button type="button" onClick={() => setProposal(null)}>Descartar</button></div><small>Reemplaza únicamente este guion. Su audio deberá generarse de nuevo.</small></div>}
        <div className={styles.scriptHeading}><label htmlFor={uid + '-script'}>Guion para narrar</label><span>{wordCount} palabras</span></div>
        {readOnly ? <p className={styles.readScript}>{current.narrative_script || 'Aún no hay una narración para este nivel.'}</p> : <textarea className={styles.script} id={uid + '-script'} value={current.narrative_script} rows={7} maxLength={10000} disabled={!!busy || !!proposal} onChange={event => edit({ narrative_script: event.target.value })} placeholder="Escribe el guion de esta versión." />}
        {!readOnly && <p className={styles.hint}>{wordCount > phase.maxWords ? `Extensión sugerida: hasta ${phase.maxWords} palabras. ` : ''}Puedes editar el texto. Al aprobar, confirmas que revisaste los hechos, el lenguaje y su pertinencia educativa.</p>}
        {reference && <details className={styles.reference}><summary><BookOpen size={16} /> Fundamento educativo <ChevronDown size={16} /></summary><p><strong>{reference.field}</strong></p><p>{reference.content}</p><p>{reference.summary}</p><p className={styles.hint}>{reference.scope}</p><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.sourceTitle} ↗</a><p className={styles.hint}>Relación propuesta para revisión; no es una certificación de la SEP.</p>{current.review_note && <p>{current.review_note}</p>}</details>}
        {!readOnly && <details className={styles.instructions}><summary>Ajustar el enfoque o crear otra propuesta <ChevronDown size={16} /></summary><fieldset className={styles.fields} disabled={!!busy || !!proposal}>
            {phase.number && <><label htmlFor={uid + '-focus'}>Relación curricular</label><select id={uid + '-focus'} value={current.curriculum_focus} onChange={event => edit({ curriculum_focus: event.target.value })}><option value="context">Según el contenido del lugar</option><option value="nature">Naturaleza y cuidado del entorno</option></select><p className={styles.hint}>En secundaria, el referente de naturaleza se centra en agua y cuencas.</p></>}
            <label htmlFor={uid + '-notes'}>Ideas que quieres incluir</label><textarea id={uid + '-notes'} rows={2} value={current.custom_instructions} maxLength={2000} onChange={event => edit({ custom_instructions: event.target.value })} />
            <button type="button" disabled={!researchReady || title.trim().length < 2} onClick={generateScript}><Sparkles size={16} />Crear otra propuesta</button>{!researchReady && <p className={styles.hint}>Completa primero la investigación para crear otra propuesta.</p>}
        </fieldset></details>}
        {(readOnly || current.audio_url || phaseId === 'general') && <section className={styles.audio} aria-label="Audio de esta versión"><div className={styles.audioHeading}><Headphones size={19} /><div><strong>Audio de esta versión</strong><p>{current.audio_url ? (current.audio_duration_seconds ? `${current.audio_duration_seconds} segundos` : 'Disponible para escuchar') : 'Pendiente de generar'}</p></div></div>{current.audio_url && <audio key={phaseId + current.audio_url} ref={audioRef} controls preload="none" src={audioSrc} onError={() => setError('No se pudo cargar este audio. Comprueba tu conexión y vuelve a intentarlo.')} />}{!readOnly && <button type="button" disabled={!!busy || !!proposal || !hasScript(current) || (!!phase.number && (!current.reviewed_at || !current.learning_goal.trim()))} onClick={generateAudio}>{current.audio_url ? 'Regenerar este audio' : 'Generar este audio'}</button>}</section>}
    </>;
    const editor = <section ref={panelRef} className={styles.editor} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-label="Editor de narraciones por nivel educativo" onKeyDown={onKeyDown}>
        <header className={styles.header}>
            <div className={styles.headerTop}><span>{readOnly ? 'Biblioteca oficial' : 'Estudio de narraciones'}</span><button type="button" onClick={requestClose} disabled={committing} aria-label="Cerrar editor"><X size={20} /></button></div>
            {readOnly ? <h2>{title}</h2> : <><label className={styles.srOnly} htmlFor={uid + '-name'}>Nombre del lugar o tema</label><input id={uid + '-name'} value={title} disabled={!!busy || !!proposal} onChange={event => { setTitle(event.target.value); setDirty(true); }} placeholder="Nombre del lugar o tema" maxLength={240} /></>}
            {!readOnly && <nav className={styles.steps} aria-label="Pasos para crear narraciones">{['Investigar', 'Crear', 'Revisar'].map((label, index) => <button type="button" key={label} aria-current={step === index + 1 ? 'step' : undefined} disabled={!!busy || !!proposal || (index === 1 && !researchReady) || (index === 2 && !draftCount)} onClick={() => index === 2 ? startReview() : setStep(index + 1)}><span>{index + 1}</span>{label}</button>)}</nav>}
        </header>
        <div ref={bodyRef} className={styles.body}>
            {error && <div className={styles.error} role="alert">{error}<button type="button" aria-label="Cerrar mensaje" onClick={() => setError('')}><X size={16} /></button></div>}
            {busy && <div className={styles.busy} role="status"><Loader2 size={18} className={styles.spin} /><span>{busyLabel}</span>{['scripts', 'audios'].includes(busy.kind) && <button type="button" onClick={() => { for (const controller of requests.current) controller.abort(); }}>Detener</button>}</div>}
            {readOnly ? <><p className={styles.hint}>Elige una versión para leerla o escuchar su audio.</p>{versionPicker}{scriptEditor}<details className={styles.research}><summary>Investigación y fuentes</summary><p className={styles.readScript}>{research || 'Investigación no disponible.'}</p></details></> : <>
                <div className={styles.intro}><span className={styles.eyebrow}>PASO {step} DE 3</span><h2 ref={stepHeadingRef} tabIndex={-1}>{step === 1 ? 'Todo empieza con una buena investigación' : step === 2 ? 'Un lugar. Cinco formas de contarlo.' : reviewMode === 'audio' ? 'Dales voz a tus guiones' : phaseId === 'general' ? 'Tu narración original' : 'Revisa un guion a la vez'}</h2><p>{step === 1 ? 'Reunimos los datos y las fuentes una sola vez. Después los adaptamos a cada nivel educativo.' : step === 2 ? 'Crearemos las versiones de preescolar, primaria y secundaria a partir de la misma investigación.' : reviewMode === 'audio' ? 'Los guiones aprobados están listos para convertirse en audio. También puedes guardarlos y hacerlo después.' : phaseId === 'general' ? 'Se conserva por separado de las cinco versiones educativas.' : 'Lee el texto, ajusta lo que necesites y apruébalo para continuar con el siguiente.'}</p></div>
                {step === 1 && <>
                    {research || manualResearch ? researchField : <div className={styles.emptyResearch}><BookOpen size={32} /><strong>{generalTopic ? 'Conozcamos este tema' : 'Conozcamos este lugar'}</strong><p>Empieza con el botón de abajo. Aquí aparecerá la investigación para que puedas revisarla.</p><button type="button" disabled={!!busy} onClick={() => setManualResearch(true)}>Ya tengo una investigación</button></div>}
                    {researchReady && <div className={styles.success}><Check size={18} />Investigación disponible para las cinco fases.</div>}
                    <details className={styles.instructions}><summary>Opciones de investigación <ChevronDown size={16} /></summary>{research && <button type="button" disabled={!!busy} onClick={() => run('research', researchPlace)}>Actualizar investigación</button>}<p className={styles.hint}>Actualizarla no reemplaza los guiones que ya existen.</p><div className={styles.engine}><EngineSelector activeEngine={engine} setActiveEngine={setEngine} tavilyUsage={usage} readOnly={!!busy} /></div></details>
                </>}
                {step === 2 && <>
                    <div className={styles.sectionHeading}><strong>{draftCount} de 5 guiones creados</strong><span>Solo completaremos los faltantes</span></div><progress className={styles.progress} value={draftCount} max={5} aria-label="Guiones creados" />
                    <div className={styles.phaseList}>{NARRATION_PHASES.map(item => <div className={styles.phaseRow} key={item.id} data-phase={item.id}><span className={hasScript(versions[item.id]) ? styles.doneIcon : styles.phaseIcon}>{hasScript(versions[item.id]) ? <Check size={18} /> : progress?.phase === item.id ? <Loader2 size={18} className={styles.spin} /> : item.number}</span><div><strong>{item.shortLabel}</strong><p>{item.grades} · Fase {item.number}</p>{failures[item.id] && <small role="alert" className={styles.failure}>{failures[item.id]}</small>}</div><span className={styles.rowStatus}>{hasScript(versions[item.id]) ? 'Creado' : failures[item.id] ? 'Reintentar' : progress?.phase === item.id ? 'Creando…' : 'Por crear'}</span></div>)}</div>
                    <p className={styles.hint}>Cada versión tendrá su propio guion y propósito de aprendizaje. Los guiones existentes se conservan.</p>
                    {!!draftCount && !!missing.length && <button type="button" disabled={!!busy} onClick={() => startReview()}>Revisar los guiones disponibles</button>}
                    <details className={styles.instructions}><summary>Escribir una versión manualmente <ChevronDown size={16} /></summary><p className={styles.hint}>Si ya tienes un guion, puedes incorporarlo sin generarlo de nuevo.</p><div className={styles.actions}>{NARRATION_PHASES.map(item => <button type="button" key={item.id} disabled={!!busy} onClick={() => { selectPhase(item.id); setReviewMode('scripts'); setStep(3); }}>{item.shortLabel}</button>)}</div></details>
                </>}
                {step === 3 && (reviewMode === 'scripts' ? <>
                    {phaseId !== 'general' && <><div className={styles.sectionHeading}><strong>{draftCount - unreviewed.length} de 5 guiones aprobados</strong><span>Puedes volver a cualquiera</span></div>{versionPicker}</>}{scriptEditor}
                    {!current.learning_goal.trim() && phase.number && <p className={styles.hint}>Añade el propósito de aprendizaje para aprobar este guion.</p>}
                </> : <><div className={styles.phaseList}>{NARRATION_PHASES.map(item => { const version = versions[item.id] || emptyNarration(); const src = localReviewAudioPath(version.audio_url) ? `/api/review-lab/audio?url=${encodeURIComponent(version.audio_url)}` : version.audio_url; return <div key={item.id} className={styles.audioCard}><div className={styles.sectionHeading}><strong>{item.shortLabel}</strong><span>{version.audio_url ? 'Audio listo' : progress?.phase === item.id ? 'Generando…' : 'Audio pendiente'}</span></div>{version.audio_url && <audio controls preload="none" src={src} />}{failures[item.id] && <p className={styles.failure} role="alert">{failures[item.id]}</p>}<button type="button" disabled={!!busy} onClick={() => { selectPhase(item.id); setReviewMode('scripts'); }}>Revisar guion</button></div>; })}</div><p className={styles.hint}>Escucha los audios antes de utilizarlos con un grupo. Guardar conserva también los borradores.</p></>)}
                {hasScript(versions.general) && !(step === 3 && phaseId === 'general' && reviewMode === 'scripts') && <details className={styles.original}><summary>Tu narración original se conserva</summary><p className={styles.readScript}>{versions.general.narrative_script}</p>{versions.general.audio_url && <audio controls preload="none" src={localReviewAudioPath(versions.general.audio_url) ? `/api/review-lab/audio?url=${encodeURIComponent(versions.general.audio_url)}` : versions.general.audio_url} />}<button type="button" disabled={!!busy || !!proposal} onClick={() => { selectPhase('general'); setReviewMode('scripts'); setStep(3); }}>Editar narración original</button></details>}
                <details className={styles.cover}><summary>Portada y opciones del punto <ChevronDown size={16} /></summary>{imageUrl && <Image unoptimized width={600} height={160} src={poiImageUrlForBrowser(imageUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)} alt="Portada seleccionada" />}<ImageSelector poiImages={images} selectedImageUrl={imageUrl} setSelectedImageUrl={url => { setImageUrl(url); setDirty(true); }} isLoadingImages={busy?.kind === 'images'} fetchPoiImages={() => run('images', async signal => { const data = await post('/api/poi-images', { poiName: title, context: geoContext }, signal); setImages(data.images || []); })} readOnly={!!busy || !!proposal} />{onDelete && poi.id && !String(poi.id).startsWith('temp-') && <button type="button" className={styles.danger} disabled={!!busy} onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Eliminar punto</button>}</details>
            </>}
        </div>
        <footer className={styles.footer}>
            {confirmClose ? <div className={styles.confirm} role="alert"><p>{busy ? 'Al salir se cancelará la tarea y perderás los cambios sin guardar.' : 'Tienes cambios o una propuesta sin guardar.'}</p><div className={styles.actions}><button type="button" onClick={() => setConfirmClose(false)}>Seguir editando</button><button type="button" className={styles.danger} onClick={onClose}>Salir sin guardar</button></div></div>
                : confirmDelete ? <div className={styles.confirm} role="alert"><p>Se eliminará el punto con todas sus versiones.</p><div className={styles.actions}><button type="button" disabled={!!busy} onClick={() => setConfirmDelete(false)}>Conservar</button><button type="button" disabled={!!busy} className={styles.danger} onClick={() => run('delete', async () => { await onDelete(poi.id); })}>Eliminar punto</button></div></div>
                : readOnly ? <button type="button" className={styles.primary} onClick={onClose}>Cerrar</button> : <>
                    <button type="button" className={styles.primary} disabled={primaryDisabled} onClick={primaryAction}>{busy ? <Loader2 size={18} className={styles.spin} /> : <ArrowRight size={18} />}{busy ? busyLabel : primaryLabel}</button>
                    <div className={styles.footerSecondary}>{step > 1 && <button type="button" disabled={!!busy || !!proposal} onClick={() => reviewMode === 'audio' ? setReviewMode('scripts') : setStep(step - 1)}>Atrás</button>}<button type="button" disabled={!!busy || !!proposal || title.trim().length < 2} onClick={save}>Guardar borrador y salir</button></div>
                    {proposal && <small>Usa o descarta la propuesta antes de continuar.</small>}
                </>}
        </footer>
    </section>;
    return embedded ? editor : <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>{editor}</div>;
}
