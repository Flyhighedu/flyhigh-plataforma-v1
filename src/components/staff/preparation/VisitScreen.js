'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUp, Check, ChevronRight, Gamepad2, Headphones, MapPin, Plus, Trash2 } from 'lucide-react';
import { coordinates, distanceKm, durationLabel, MAX_SEQUENCE_ITEMS, moveItem, sequenceChanged, snapshot, usableAudio, visitLabel } from '@/lib/narration-preparation.mjs';
import { PreparationShell, LoadingPreparation, Notice, usePreparationData, primary, secondary, card } from './PreparationUI';
import NarrationLibrary, { PreparationDialog } from './NarrationLibrary';
import Rehearsal from './Rehearsal';
import useNarrationAudio from './useNarrationAudio';
import useSequencePlan from './useSequencePlan';

const PreparationMap = dynamic(() => import('./PreparationMap'), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl bg-slate-200" /> });

export default function VisitScreen({ visitId, flightRehearsalEnabled = false }) {
    const { data, loading, error, retry } = usePreparationData(visitId);
    return <PreparationShell title="Preparar visita" subtitle="Elige qué contar, define el orden y déjalo preparado." back="/staff/cronograma" backLabel="Cronograma">
        {loading ? <LoadingPreparation /> : error ? <Notice action={<button className={secondary} onClick={retry}>Reintentar</button>}>{error}</Notice> : <VisitEditor key={`${visitId}:${data.userId}`} visit={data.visits[0]} data={data} flightRehearsalEnabled={flightRehearsalEnabled} />}
    </PreparationShell>;
}

function VisitEditor({ visit, data, flightRehearsalEnabled }) {
    const initialPlan = data.plans.find(p => p.visit_id === visit.id);
    const plan = useSequencePlan({ visit, userId: data.userId, initialPlan });
    const catalog = useMemo(() => data.catalog.map(source => ({ ...source, ...plan.savedSources.find(item => item.id === String(source.id)) })), [data.catalog, plan.savedSources]);
    const audio = useNarrationAudio();
    const [picker, setPicker] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [rehearsing, setRehearsing] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);
    const [mapSelected, setMapSelected] = useState(null);
    const [reusing, setReusing] = useState(false);
    const schoolLocation = useMemo(() => coordinates(visit.ubicacion_lat, visit.ubicacion_lng), [visit.ubicacion_lat, visit.ubicacion_lng]);
    const nearby = useMemo(() => !schoolLocation ? [] : catalog.filter(p => !p.is_general_topic && usableAudio(p.audio_url)).map(p => ({ ...p, distance: distanceKm(schoolLocation, coordinates(p.latitude, p.longitude)) })).filter(p => p.distance != null && p.distance <= 10).sort((a, b) => a.distance - b.distance), [catalog, schoolLocation]);
    const markers = useMemo(() => !schoolLocation ? [] : [{ id: `school-${visit.id}`, name: visit.nombre_escuela, school: true, lat: schoolLocation[0], lng: schoolLocation[1] }, ...nearby.map(p => ({ id: p.id, name: p.name, lat: p.latitude, lng: p.longitude }))], [nearby, schoolLocation, visit.id, visit.nombre_escuela]);
    const selectedPoi = nearby.find(p => p.id === mapSelected);
    const stale = sequenceChanged(plan.items, catalog);
    const available = plan.items.length > 0 && plan.items.every(p => usableAudio(p.audio_url)) && !stale;
    const ready = plan.status === 'ready' && !plan.dirty && !stale;
    const total = plan.items.reduce((sum, p) => sum + (Number(p.audio_duration_seconds) || 0), 0);
    const allDurations = plan.items.every(p => Number(p.audio_duration_seconds) > 0);
    const previous = data.plans.filter(p => p.visit_id !== visit.id && p.items.length > 0).sort((a, b) => Number(Boolean(visit.cct && b.visit?.cct === visit.cct)) - Number(Boolean(visit.cct && a.visit?.cct === visit.cct)) || b.updated_at.localeCompare(a.updated_at));
    const add = poi => {
        if (plan.items.length >= MAX_SEQUENCE_ITEMS || plan.items.some(p => p.id === String(poi.id))) return;
        plan.edit([...plan.items, snapshot(poi)]);
    };
    const openPicker = (query = '') => { audio.stop(); setPickerQuery(query); setPicker(true); };
    const closePicker = () => { audio.stop(); setPicker(false); };
    return <>
        <section className={card}>
            <p className="text-xs font-bold capitalize text-blue-700">{visitLabel(visit.fecha_programada)}{visit.turno ? ` · ${visit.turno}` : ''}</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight">{visit.nombre_escuela}</h2>
            <p className="mt-3 flex items-start gap-2 text-sm text-slate-500"><MapPin size={17} className="shrink-0" />{visit.colonia || 'Dirección por confirmar'}</p>
        </section>

        {flightRehearsalEnabled && <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-5 shadow-[0_12px_36px_-28px_rgba(7,26,51,0.35)]">
            <div className="flex items-start gap-3"><span className="rounded-2xl bg-cyan-600 p-3 text-white"><Gamepad2 size={22} /></span><div><h2 className="font-extrabold text-cyan-950">Ensayo de vuelo</h2><p className="mt-1 text-sm leading-relaxed text-cyan-900/70">Explora el entorno con controles Modo 3 y visualiza tus puntos de interés.</p></div></div>
            {schoolLocation
                ? <Link href={`/staff/visitas/${visit.id}/simulacion`} onClick={audio.stop} className={`${primary} mt-4 w-full !bg-cyan-700 hover:!bg-cyan-800`}><Gamepad2 size={18} />Abrir simulador</Link>
                : <button disabled className={`${secondary} mt-4 w-full`}><MapPin size={18} />Requiere ubicación confirmada</button>}
            <Link href={`/staff/visitas/${visit.id}/simulacion-3d`} onClick={audio.stop} className={`${secondary} mt-3 w-full`}><MapPin size={18} />{schoolLocation ? 'Probar relieve 3D' : 'Elegir despegue y probar 3D'}</Link><p className="mt-2 text-xs text-cyan-900/75">Google Maps · Prueba local con consumo de API. Puedes elegir un despegue temporal sin cambiar la ubicación escolar. No sirve para navegar un dron real.</p>
        </section>}

        <section className={card} aria-labelledby="sequence-heading">
            <div className="flex items-start justify-between gap-3"><div><h2 id="sequence-heading" className="text-xl font-extrabold">Tu secuencia</h2><p className="mt-1 text-sm text-slate-500">Se reproducirá en este orden.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{ready ? 'Lista' : 'Borrador'}</span></div>
            <p role="status" aria-live="polite" className="mt-3 text-xs text-slate-500">{plan.saveState === 'saving' ? 'Guardando…' : plan.saveState === 'pending' ? 'Cambios pendientes de guardar…' : plan.saveState === 'error' || plan.saveState === 'conflict' ? 'No se han guardado los cambios' : plan.revision ? 'Guardado' : 'Aún no has preparado esta visita'}</p>
            {plan.error && <div className="mt-4"><Notice action={plan.saveState === 'conflict' ? <button className={secondary} onClick={plan.discardLocal}>Descartar cambios locales y cargar lo guardado</button> : <div className="flex flex-wrap gap-2"><button className={secondary} onClick={plan.retry}>Reintentar guardado</button><button className={secondary} onClick={() => window.location.reload()}>Recargar biblioteca</button></div>}>{plan.error}</Notice></div>}
            {plan.localError && <div className="mt-3"><Notice>{plan.localError}</Notice></div>}
            {stale && <div className="mt-4"><Notice action={<button disabled={plan.locked} className={secondary} onClick={() => plan.edit(plan.items.map(item => { const latest = catalog.find(p => String(p.id) === item.id); return latest ? snapshot(latest) : item; }))}>Actualizar contenido seleccionado</button>}>Una narración cambió o ya no está disponible. Revisa su contenido y elimina las que no estén disponibles antes de confirmar.</Notice></div>}
            {initialPlan && initialPlan.visit_date !== visit.fecha_programada && <p className="mt-3 text-sm text-amber-800">Esta visita cambió de fecha. Revisa la secuencia y confírmala para el nuevo día.</p>}
            {!plan.items.length ? <div className="my-5 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center"><Headphones size={30} className="mx-auto text-blue-500" /><h3 className="mt-3 font-bold">¿Qué vas a contar en esta visita?</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">Agrega narraciones y acomódalas como las utilizarás. Puedes ensayar antes de dejarlas listas.</p></div> : <ol className="mt-5 space-y-3">{plan.items.map((item, index) => <li key={item.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="text-sm font-bold leading-snug">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{durationLabel(item.audio_duration_seconds)}</p>{!catalog.some(p => String(p.id) === item.id) && <p className="mt-1 text-xs text-red-700">Ya no está disponible. Quítala de la secuencia.</p>}</div></div>
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2"><button className={secondary} aria-label={`Subir ${item.name}`} disabled={index === 0 || plan.locked} onClick={() => plan.edit(moveItem(plan.items, index, -1))}><ArrowUp size={17} /></button><button className={secondary} aria-label={`Bajar ${item.name}`} disabled={index === plan.items.length - 1 || plan.locked} onClick={() => plan.edit(moveItem(plan.items, index, 1))}><ArrowDown size={17} /></button><button disabled={plan.locked} onClick={() => plan.edit(plan.items.filter(p => p.id !== item.id))} aria-label={`Quitar ${item.name} de la secuencia`} className={`${secondary} ml-auto !border-transparent !px-3`}><Trash2 size={16} /><span className="text-xs">Quitar</span></button></div>
            </li>)}</ol>}
            <button onClick={() => openPicker()} disabled={plan.locked || plan.items.length >= MAX_SEQUENCE_ITEMS} className={`${secondary} mt-4 w-full`}><Plus size={18} />Agregar narración</button>
            {plan.items.length >= MAX_SEQUENCE_ITEMS && <p className="mt-2 text-xs text-slate-500">Puedes incluir hasta 40 narraciones.</p>}
            {plan.items.length > 0 && <p className="mt-3 text-center text-xs text-slate-500">{plan.items.length} narraciones · {allDurations ? `${durationLabel(total)} de audio` : 'Duración total por confirmar'}</p>}
            {previous.length > 0 && <button disabled={plan.locked} onClick={() => setReusing(true)} className="mt-4 min-h-11 w-full text-sm font-semibold text-blue-700">Reutilizar una preparación anterior</button>}
        </section>

        <section className={`${card} space-y-3`}>
            <button className={`${secondary} w-full`} disabled={!available || plan.locked || plan.dirty || plan.saveState !== 'saved'} onClick={() => { audio.stop(); setRehearsing(true); }}><Headphones size={18} />Ensayar secuencia</button>
            <button className={`${primary} w-full`} disabled={!available || plan.locked || plan.dirty || plan.saveState !== 'saved' || ready} onClick={() => plan.save('ready')}><Check size={18} />{ready ? 'Secuencia lista' : 'Dejar lista la secuencia'}</button>
            <p className="text-center text-xs leading-relaxed text-slate-500">{ready ? 'El orden está confirmado. Puedes reutilizarlo con los grupos de esta visita. Si lo modificas, volverá a borrador.' : 'Guardar conserva tus cambios. Confirmar deja preparado el orden que utilizarás.'}</p>
        </section>

        <section className={card}><h2 className="text-lg font-extrabold">Alrededor de la escuela</h2><p className="mt-2 text-sm text-slate-500">Explora lugares con narración a menos de 10 km. La distancia es aproximada, en línea recta.</p>
            {!schoolLocation ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">La escuela aún no tiene ubicación confirmada. Puedes preparar tu secuencia desde la biblioteca.</p> : <>
                <button onClick={() => setMapOpen(v => !v)} aria-expanded={mapOpen} className={`${secondary} mt-4 w-full`}><MapPin size={17} />{mapOpen ? 'Cerrar mapa' : `Explorar lugares cercanos (${nearby.length})`}</button>
                {mapOpen && <div className="mt-4 space-y-3"><PreparationMap markers={markers} selectedId={mapSelected} onSelect={setMapSelected} />{!nearby.length && <p className="text-sm text-slate-500">Todavía no hay narraciones de lugares en este radio. Explora la biblioteca para agregar otros lugares o temas generales.</p>}
                    {selectedPoi && <button className={`${primary} w-full`} disabled={plan.locked} onClick={() => openPicker(selectedPoi.name)}>Escuchar y agregar: {selectedPoi.name}<ChevronRight size={16} /></button>}
                    <ul className="divide-y divide-slate-100">{nearby.map(p => <li key={p.id}><button disabled={plan.locked} onClick={() => openPicker(p.name)} className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"><span className="text-sm font-semibold">{p.name}<span className="mt-1 block text-xs font-normal text-slate-500">{p.distance.toFixed(1)} km · {durationLabel(p.audio_duration_seconds)}</span></span><ChevronRight size={17} className="shrink-0 text-blue-600" /></button></li>)}</ul>
                </div>}
            </>}
        </section>
        {picker && <PreparationDialog title="Agregar narraciones" onClose={closePicker}>
            <p role="status" className="text-sm font-semibold text-blue-700">{plan.items.length} en tu secuencia · Se agregan al final</p>
            <NarrationLibrary catalog={catalog} selectedIds={plan.items.map(p => p.id)} onAdd={add} addDisabled={plan.locked || plan.items.length >= MAX_SEQUENCE_ITEMS} audio={audio} schoolLocation={schoolLocation} initialQuery={pickerQuery} />
            <button className={`${primary} sticky bottom-0 w-full shadow-lg`} onClick={closePicker}>Volver a mi secuencia</button>
        </PreparationDialog>}
        {rehearsing && <Rehearsal items={plan.items} audio={audio} onClose={() => { audio.stop(); setRehearsing(false); }} />}
        {reusing && <PreparationDialog title="Reutilizar preparación" onClose={() => setReusing(false)}><p className="text-sm text-slate-600">Reemplazará tu selección actual con un nuevo borrador. Las otras visitas conservarán su preparación.</p>{previous.map(p => {
            const missing = p.items.some(item => !catalog.some(source => String(source.id) === item.id));
            return <button key={p.id} disabled={plan.locked || missing} className={`${secondary} w-full !justify-start !text-left`} onClick={() => { plan.edit(p.items.map(item => snapshot(catalog.find(source => String(source.id) === item.id)))); setReusing(false); }}><span>{p.visit?.nombre_escuela || `Visita del ${visitLabel(p.visit_date)}`}<span className="mt-1 block text-xs font-normal text-slate-500">{p.items.length} narraciones · {visitLabel(p.visit_date)}</span>{missing && <span className="mt-1 block text-xs text-amber-800">Contiene narraciones que ya no están disponibles</span>}</span></button>;
        })}</PreparationDialog>}
    </>;
}
