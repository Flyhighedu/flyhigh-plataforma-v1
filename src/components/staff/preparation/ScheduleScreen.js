'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { CalendarDays, ChevronRight, List, Map, MapPin } from 'lucide-react';
import { coordinates, visitLabel } from '@/lib/narration-preparation.mjs';
import { PreparationShell, LoadingPreparation, Notice, usePreparationData, planLabel, secondary, card } from './PreparationUI';

const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl bg-slate-200" /> });

export default function ScheduleScreen() {
    const { data, loading, error, retry } = usePreparationData();
    const [view, updateView] = useState(() => { try { return sessionStorage.getItem('flyhigh:calendar:view') === 'map' ? 'map' : 'list'; } catch { return 'list'; } });
    const [selectedId, updateSelectedId] = useState(() => { try { return Number(sessionStorage.getItem('flyhigh:calendar:selected')) || null; } catch { return null; } });
    const setView = value => { updateView(value); try { sessionStorage.setItem('flyhigh:calendar:view', value); } catch { /* Session preference is optional. */ } };
    const setSelectedId = value => { updateSelectedId(value); try { sessionStorage.setItem('flyhigh:calendar:selected', String(value)); } catch { /* Session preference is optional. */ } };
    const markers = useMemo(() => (data?.visits || []).filter(v => coordinates(v.ubicacion_lat, v.ubicacion_lng)).map(v => ({ id: v.id, name: v.nombre_escuela, lat: v.ubicacion_lat, lng: v.ubicacion_lng, school: true })), [data]);
    const selected = data?.visits.find(v => v.id === selectedId);
    const visitCard = visit => <Link key={visit.id} href={`/staff/visitas/${visit.id}`} className={`${card} flex items-start gap-4 transition hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-600`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><CalendarDays size={23} /></span>
        <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold capitalize text-blue-700">{visitLabel(visit.fecha_programada)}</span>
            <span className="mt-1 block text-lg font-extrabold leading-tight">{visit.nombre_escuela}</span>
            <span className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} />{visit.colonia || 'Ubicación por confirmar'}</span>
            <span className="mt-3 block text-xs font-semibold text-slate-600">{planLabel(data.plans.find(p => p.visit_id === visit.id), visit)}</span>
            {!coordinates(visit.ubicacion_lat, visit.ubicacion_lng) && <span className="mt-1 block text-xs text-slate-500">Sin ubicación en el mapa</span>}
        </span><ChevronRight size={18} className="mt-4 shrink-0 text-slate-400" />
    </Link>;
    return <PreparationShell title="Cronograma" subtitle="Consulta tus próximas visitas y prepara cada una con anticipación.">
        {loading ? <LoadingPreparation /> : error ? <Notice action={<button onClick={retry} className={secondary}>Reintentar</button>}>{error}</Notice> : <>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-500">{data.visits.length} visitas programadas</p>
                <div aria-label="Vista del cronograma" className="flex rounded-xl border border-slate-200 bg-white p-1">
                    {[['list', List, 'Lista'], ['map', Map, 'Mapa']].map(([key, Icon, label]) => <button key={key} onClick={() => setView(key)} aria-pressed={view === key} className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold ${view === key ? 'bg-[#071a33] text-white' : 'text-slate-600'}`}><Icon size={16} />{label}</button>)}
                </div>
            </div>
            {!data.visits.length && <div className={`${card} py-10 text-center`}><CalendarDays size={32} className="mx-auto mb-3 text-blue-500" /><h2 className="font-bold">Tu cronograma está despejado</h2><p className="mt-2 text-sm text-slate-500">Cuando se programe una visita, podrás prepararla aquí.</p><Link href="/staff/narraciones" className={`${secondary} mt-5`}>Explorar narraciones</Link></div>}
            {view === 'map' && data.visits.length > 0 && <><PreparationMap markers={markers} onSelect={setSelectedId} selectedId={selectedId} />{selected && visitCard(selected)}<p className="text-xs text-slate-500">Todas las visitas siguen disponibles abajo, incluidas las que no tienen ubicación.</p></>}
            <div className="space-y-3">{data.visits.map(visitCard)}</div>
            {data.visits.length === 300 && <p className="text-sm text-slate-500">Se muestran las próximas 300 visitas.</p>}
        </>}
    </PreparationShell>;
}
