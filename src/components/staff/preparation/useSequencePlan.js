'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fingerprint } from '@/lib/narration-preparation.mjs';

function restore(key, initialPlan, visit) {
    const fallback = { items: initialPlan?.items || [], grade: initialPlan?.grade || '', status: initialPlan?.status || 'draft', dirty: false, conflict: false };
    if (initialPlan?.content_changed || (initialPlan && initialPlan.visit_date !== visit.fecha_programada)) fallback.status = 'draft';
    try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (!cached || !Array.isArray(cached.items) || cached.items.length > 40 || cached.items.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string')) return fallback;
        return { items: cached.items, grade: cached.grade || '', status: 'draft', dirty: true, conflict: cached.revision !== (initialPlan?.revision || 0) || cached.date !== visit.fecha_programada };
    } catch { return fallback; }
}

export default function useSequencePlan({ visit, userId, initialPlan }) {
    const key = `flyhigh:visit-draft:${userId}:${visit.id}`;
    const [draft, setDraft] = useState(() => restore(key, initialPlan, visit));
    const [revision, setRevision] = useState(initialPlan?.revision || 0);
    const [savedSources, setSavedSources] = useState([]);
    const [saveState, setSaveState] = useState(() => draft.conflict ? 'conflict' : draft.dirty ? 'pending' : 'saved');
    const [error, setError] = useState(() => draft.conflict ? 'Hay un borrador local de otra versión de esta visita. Revisa la versión guardada antes de continuar.' : '');
    const [localError, setLocalError] = useState('');
    const busy = useRef(false);

    const cache = useCallback((items, grade, baseRevision) => {
        try { localStorage.setItem(key, JSON.stringify({ items, grade, revision: baseRevision, date: visit.fecha_programada })); setLocalError(''); }
        catch { setLocalError('No pudimos guardar una copia en este dispositivo. Espera la confirmación de guardado antes de salir.'); }
    }, [key, visit.fecha_programada]);

    const edit = useCallback((items, grade = draft.grade) => {
        if (busy.current || saveState === 'conflict') return;
        cache(items, grade, revision);
        setDraft({ items, grade, status: 'draft', dirty: true, conflict: false });
        setError(''); setSaveState('pending');
    }, [cache, draft.grade, revision, saveState]);

    const save = useCallback(async status => {
        if (busy.current || saveState === 'conflict') return;
        busy.current = true; setSaveState('saving'); setError('');
        try {
            const response = await fetch('/api/staff/preparation', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visitId: visit.id, visitDate: visit.fecha_programada, revision, ids: draft.items.map(p => p.id), grade: draft.grade || null, status, fingerprints: draft.items.map(fingerprint) }),
            });
            const result = await response.json();
            if (!response.ok) {
                setSaveState(response.status === 409 ? 'conflict' : 'error');
                setError(result.error || 'No se pudo guardar. Tu borrador se conserva en este dispositivo.');
                return;
            }
            setRevision(result.plan.revision);
            // The server may have a more recent source than the loaded catalog.
            // Keep the picker and stale-content checks aligned with what was saved.
            setSavedSources(result.plan.items);
            setDraft({ items: result.plan.items, grade: result.plan.grade || '', status: result.plan.status, dirty: false, conflict: false });
            setSaveState('saved');
            try { localStorage.removeItem(key); } catch { /* Server copy is already safe. */ }
        } catch {
            setSaveState('error'); setError('No se pudo guardar. Comprueba la conexión y reintenta antes de dejar la secuencia lista.');
        } finally { busy.current = false; }
    }, [draft.items, draft.grade, key, revision, saveState, visit.id, visit.fecha_programada]);

    useEffect(() => {
        if (!draft.dirty || saveState !== 'pending') return;
        const timer = setTimeout(() => save('draft'), 500);
        return () => clearTimeout(timer);
    }, [draft.dirty, save, saveState]);

    useEffect(() => {
        if (!draft.dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [draft.dirty]);

    const discardLocal = () => {
        try { localStorage.removeItem(key); } catch { /* Reload still obtains the server copy. */ }
        window.location.reload();
    };
    return { ...draft, revision, savedSources, saveState, error, localError, edit, save,
        locked: saveState === 'saving' || saveState === 'conflict',
        retry: () => save('draft'), discardLocal };
}
