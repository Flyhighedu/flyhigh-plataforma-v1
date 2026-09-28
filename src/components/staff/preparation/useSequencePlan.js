'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { preparationItemFingerprint, normalizePreparationItems } from '@/lib/preparation-model.mjs';
import { createPreparationStore, restorePreparation } from '@/lib/preparation-store.mjs';

export default function useSequencePlan({ visit, userId, initialPlan, catalog = [] }) {
    const [store] = useState(() => {
        const key = `flyhigh:visit-draft:${userId}:${visit.id}`;
        const read = suffix => { try { return JSON.parse(localStorage.getItem(key + suffix)); } catch { return null; } };
        return createPreparationStore({
            initial: restorePreparation(initialPlan, read(''), visit, catalog, read(':recovery')),
            cache: state => localStorage.setItem(key, JSON.stringify({ items: state.items, context: state.context, revision: state.revision, date: visit.fecha_programada })),
            clearCache: () => localStorage.removeItem(key),
            saveRecovery: value => localStorage.setItem(key + ':recovery', JSON.stringify(value)),
            clearRecovery: () => localStorage.removeItem(key + ':recovery'),
            persist: async (state, status) => {
                const response = await fetch('/api/staff/preparation', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelVersion: 2, visitId: visit.id, visitDate: visit.fecha_programada, revision: state.revision,
                        selections: state.items.map(item => ({ id: item.id, behavior: item.behavior })),
                        context: { ...state.context, phase_id: 'general' }, status, fingerprints: state.items.map(preparationItemFingerprint) }) });
                const result = await response.json();
                if (!response.ok) throw Object.assign(new Error(result.error || 'No se pudo guardar. Tu borrador se conserva.'), { status: response.status });
                return result.plan;
            },
        });
    });
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => { store.start(); return store.stop; }, [store]);
    useEffect(() => {
        if (!state.dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [state.dirty]);
    const [recoveryError, setRecoveryError] = useState('');
    const loadSaved = async () => {
        try {
            const response = await fetch(`/api/staff/preparation?visit=${visit.id}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo cargar la versión guardada.');
            const plan = data.plans.find(item => item.visit_id === visit.id);
            store.loadSaved(plan ? { ...plan, items: normalizePreparationItems(plan.items, data.catalog), status: plan.content_changed ? 'draft' : plan.status } : null);
            setRecoveryError('');
        } catch (error) { setRecoveryError(error.message); }
    };
    return { ...state, error: recoveryError || state.error, edit: store.edit, save: store.save,
        undo: store.undo, recover: store.recover, loadSaved, locked: state.saveState === 'conflict', retry: () => store.save('draft') };
}
