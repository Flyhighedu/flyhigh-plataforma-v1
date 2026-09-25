'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

export const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600';
export const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600';
export const card = 'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_-28px_rgba(7,26,51,0.35)]';

export function PreparationShell({ title, subtitle, back = '/staff/dashboard', backLabel = 'Inicio', children, action }) {
    return <main className="min-h-[100svh] bg-[#f3f7fb] pb-12 text-[#071a33]">
        <header className="bg-[#06182c] px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
            <div className="mx-auto max-w-3xl">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <Link href={back} className="inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-slate-300 hover:text-white"><ArrowLeft size={19} />{backLabel}</Link>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">FlyHigh · Preparación</span>
                </div>
                <div className="flex items-start justify-between gap-3"><h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>{action}</div>
                {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{subtitle}</p>}
            </div>
        </header>
        <div className="mx-auto max-w-3xl space-y-5 px-4 pt-5">{children}</div>
    </main>;
}

export function Notice({ children, action }) {
    return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        <div className="flex gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1">{children}{action && <div className="mt-3">{action}</div>}</div></div>
    </div>;
}

export function LoadingPreparation() {
    return <div role="status" aria-label="Cargando preparación" className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Cargando…</div>
        {[1, 2, 3].map(n => <div key={n} className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />)}
    </div>;
}

export function usePreparationData(visitId) {
    const [state, setState] = useState({ loading: true, data: null, error: '' });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/staff/preparation${visitId ? `?visit=${encodeURIComponent(visitId)}` : ''}`, { cache: 'no-store', signal: controller.signal })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'No se pudo cargar la preparación.');
                return data;
            })
            .then(data => setState({ data, loading: false, error: '' }))
            .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message }); });
        return () => controller.abort();
    }, [visitId, attempt]);
    return { ...state, retry: () => { setState({ loading: true, data: null, error: '' }); setAttempt(n => n + 1); } };
}

export function planLabel(plan, visit) {
    if (!plan?.items.length) return 'Sin narraciones seleccionadas';
    const ready = plan.status === 'ready' && !plan.content_changed && plan.visit_date === visit.fecha_programada;
    return `${ready ? 'Lista' : 'Borrador'} · ${plan.items.length} narraciones`;
}
