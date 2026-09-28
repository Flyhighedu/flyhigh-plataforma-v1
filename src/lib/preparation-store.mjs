import { preparationFingerprint, normalizePreparationItems } from './preparation-model.mjs';
import { preparationContext } from './narration-preparation.mjs';

// One serial writer. Acknowledgments may advance the server revision, but can
// never replace an edit made while that request was in flight.
export function createPreparationStore({ initial, persist, cache, clearCache, saveRecovery = () => {}, clearRecovery = () => {}, delay = 500 }) {
    let state = { ...initial, savedSources: [], error: initial.conflict ? 'Hay cambios de otra versión. Revisa la versión guardada; tu copia se conserva.' : '',
        localError: '', message: '', canUndo: false, recoverable: initial.recoverable || null,
        saveState: initial.conflict ? 'conflict' : initial.dirty ? 'pending' : 'saved' };
    let version = 0, writing = false, timer, active = false;
    const listeners = new Set(), history = [];
    const emit = changes => { state = { ...state, ...changes }; listeners.forEach(listener => listener()); };
    const writeCache = () => {
        try { cache(state); if (state.localError) emit({ localError: '' }); }
        catch { emit({ localError: 'No se pudo guardar la copia en este dispositivo. Espera el guardado antes de salir.' }); }
    };
    const schedule = () => {
        clearTimeout(timer);
        if (active && !writing && state.dirty && state.saveState === 'pending') timer = setTimeout(() => void save('draft'), delay);
    };
    const edit = (items, context = state.context, message = 'Experiencia actualizada', remember = true) => {
        if (state.saveState === 'conflict') return;
        if (preparationFingerprint(items, context) === preparationFingerprint(state.items, state.context)) return;
        if (remember) { history.push({ items: state.items, context: state.context }); if (history.length > 30) history.shift(); }
        version++;
        emit({ items, context: { ...preparationContext(context), review: null }, status: 'draft', dirty: true,
            saveState: writing ? 'saving' : 'pending', error: '', message, canUndo: history.length > 0 });
        writeCache(); schedule();
    };
    const save = async (status = 'draft') => {
        if (writing || state.saveState === 'conflict') return;
        clearTimeout(timer);
        writing = true;
        const sentVersion = version, sent = state;
        emit({ saveState: 'saving', error: '' });
        try {
            const plan = await persist(sent, status);
            const changed = version !== sentVersion;
            emit({ revision: plan.revision, savedSources: plan.items,
                ...(changed ? { dirty: true, status: 'draft', saveState: 'pending' }
                    : { items: plan.items, context: preparationContext(plan.preparation_context || sent.context), status: plan.status, dirty: false, saveState: 'saved',
                        ...(status === 'ready' ? { message: 'Experiencia confirmada' } : {}) }) });
            if (changed) writeCache();
            else { try { clearCache(); } catch { /* A saved copy remains recoverable. */ } }
        } catch (error) {
            emit({ saveState: error.status === 409 ? 'conflict' : 'error', error: error.message || 'No se pudo guardar. Tu borrador se conserva.', dirty: true, status: 'draft' });
            writeCache();
        } finally { writing = false; schedule(); }
    };
    return {
        getSnapshot: () => state,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        start: () => { active = true; schedule(); }, stop: () => { active = false; clearTimeout(timer); },
        edit, save,
        undo: () => {
            if (state.saveState === 'conflict' || !history.length) return;
            const previous = history.pop(); edit(previous.items, previous.context, 'Cambio deshecho', false);
        },
        loadSaved: plan => {
            if (writing) return;
            const recoverable = { items: state.items, context: state.context };
            // Do not discard the only local copy if recovery storage is full.
            try { saveRecovery(recoverable); clearCache(); }
            catch { emit({ localError: 'No se pudo conservar tu copia. Libera espacio antes de cargar otra versión.' }); return; }
            history.length = 0; version++;
            emit({ items: plan?.items || [], savedSources: plan?.items || [], context: preparationContext(plan?.preparation_context || {}),
                revision: plan?.revision || 0, status: plan?.status || 'draft', dirty: false, saveState: 'saved', error: '',
                canUndo: false, recoverable, message: 'Versión guardada cargada. Tu borrador sigue disponible.' });
        },
        recover: () => {
            if (!state.recoverable || writing || state.saveState === 'conflict') return;
            edit(state.recoverable.items, state.recoverable.context, 'Tu borrador se restauró sobre la versión actual');
            try { clearRecovery(); } catch { /* Retaining an extra recovery copy is safe. */ }
            emit({ recoverable: null });
        },
    };
}

export function restorePreparation(initialPlan, cached, visit, catalog, recoverable = null) {
    const context = preparationContext(initialPlan?.preparation_context || {});
    const fallback = { items: normalizePreparationItems(initialPlan?.items || [], catalog), context,
        revision: initialPlan?.revision || 0, status: initialPlan?.status || 'draft', dirty: false, conflict: false, recoverable };
    if (initialPlan?.content_changed || (initialPlan && initialPlan.visit_date !== visit.fecha_programada)) fallback.status = 'draft';
    if (!cached) return fallback;
    try {
        if (!Array.isArray(cached.items) || cached.items.length > 40 || cached.items.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string') || new Set(cached.items.map(item => item.id)).size !== cached.items.length) return fallback;
        return { ...fallback, items: normalizePreparationItems(cached.items, catalog), context: preparationContext(cached.context || context),
            status: 'draft', dirty: true, conflict: cached.revision !== fallback.revision || cached.date !== visit.fecha_programada };
    } catch { return fallback; }
}
