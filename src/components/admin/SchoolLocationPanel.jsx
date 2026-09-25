'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { validCoordinates } from '@/lib/school-locations.mjs';

function LocationMap({ lat, lng }) {
    const element = useRef(null);
    useEffect(() => {
        let map, cancelled = false;
        import('leaflet').then(({ default: L }) => {
            if (cancelled || !element.current) return;
            map = L.map(element.current, { scrollWheelZoom: false }).setView([lat, lng], 16);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
            L.circleMarker([lat, lng], { radius: 9, color: '#1d4ed8', fillOpacity: .8 }).addTo(map);
        });
        return () => { cancelled = true; map?.remove(); };
    }, [lat, lng]);
    return <div ref={element} className="relative z-0 h-56 rounded-xl" aria-label="Mapa para revisar la ubicación de la escuela" />;
}
const statuses = { ambiguous: 'CCT duplicado: revisión manual necesaria.', turn_review: 'El turno no coincide o está incompleto.', invalid_coordinates: 'Coordenadas o turno inválidos.', preserve_location: 'La ubicación existente se conserva; no se sobrescribe.' };
export default function SchoolLocationPanel({ school, editing, onCatalogChanged }) {
    const [open, setOpen] = useState(false);
    const [projects, setProjects] = useState([]);
    const [project, setProject] = useState('');
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const cct = school?.cct || query.trim().toUpperCase();
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/admin/school-locations', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => setProjects(data?.projects || [])).catch(() => {});
        return () => controller.abort();
    }, []);
    if (process.env.NEXT_PUBLIC_FLYHIGH_REVIEW_LAB !== '1') return null;
    const located = school?.ubicacion_verificada_at && validCoordinates(school.ubicacion_lat, school.ubicacion_lng);
    async function search() {
        setBusy(true); setMessage(''); setConfirmed(false);
        try {
            const response = await fetch(`/api/admin/school-locations?project=${encodeURIComponent(project)}&cct=${encodeURIComponent(cct)}`, { cache: 'no-store' });
            const data = await response.json(); if (!response.ok) throw new Error(data.error);
            setResult(data);
        } catch (error) { setMessage(error.message); } finally { setBusy(false); }
    }
    async function apply(body) {
        setBusy(true); setMessage('');
        try {
            const source = result?.candidates.find(row => row.id === body.sourceId);
            const expected = source && Object.fromEntries(['project_id', 'cct', 'nombre', 'turno', 'latitud', 'longitud'].map(key => [key, source[key]]));
            const response = await fetch('/api/admin/school-locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, expected, confirmed: true }) });
            const data = await response.json(); if (!response.ok) throw new Error(data.error);
            if (body.action === 'confirm-catalog') await onCatalogChanged(data.data);
            setResult(null); setConfirmed(false);
            setMessage(body.action === 'fill-visit' ? 'Ubicación incorporada a esa visita local. El historial no cambió.' : 'Catálogo local actualizado. Puedes agendar con esta ubicación; ninguna visita existente se modificó.');
        } catch (error) { setMessage(error.message); } finally { setBusy(false); }
    }
    return <section className="space-y-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm neu-text">
        <div className="flex items-center gap-2 font-bold"><MapPin size={17} />Ubicación de la escuela · prueba local</div>
        <p className="text-xs neu-text-sub">{editing ? 'Editar la visita no cambia su ubicación. Las visitas anteriores, de hoy, iniciadas o archivadas quedan excluidas de la incorporación.' : located ? 'Al agendar se guardará una copia de estas coordenadas en la nueva visita.' : 'Sin ubicación verificada. Puedes agendar, pero la simulación seguirá bloqueada hasta confirmar una ubicación.'}</p>
        {located && <><p>{school.ubicacion_lat.toFixed(6)}, {school.ubicacion_lng.toFixed(6)} · {school.ubicacion_fuente?.project_name}</p><LocationMap lat={school.ubicacion_lat} lng={school.ubicacion_lng} /></>}
        <button type="button" onClick={() => setOpen(!open)} className="rounded-xl border border-cyan-500/40 px-3 py-2 font-semibold">{open ? 'Cerrar revisión' : 'Buscar en Inteligencia / revisar visitas futuras'}</button>
        {open && <div className="space-y-3">
            <p className="text-xs">Selecciona la fuente expresamente. No se combinan proyectos ni se reemplazan datos comerciales.</p>
            <label className="block">Proyecto de Inteligencia<select value={project} disabled={busy} onChange={e => { setProject(e.target.value); setResult(null); setConfirmed(false); }} className="mt-1 w-full rounded-lg border p-2 neu-input-inset"><option value="">Elige un proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            {school ? <p>CCT: <strong>{cct}</strong> · Turno del catálogo: {school.turno || 'Sin turno'}</p> : <label className="block">CCT completo<input value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setResult(null); setConfirmed(false); }} maxLength={40} className="mt-1 w-full rounded-lg border p-2 neu-input-inset" placeholder="CCT de la escuela que deseas incorporar" /></label>}
            <button type="button" disabled={busy || !project || !cct} onClick={search} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">{busy ? 'Comprobando…' : 'Revisar coincidencia'}</button>
            {result && !result.candidates.length && <p>No hay coincidencia exacta en este proyecto. No se modificó nada.</p>}
            {result?.candidates.map(source => <div key={source.id} className="space-y-2 rounded-xl border border-slate-400/30 p-3">
                <strong>{source.nombre}</strong><p>{source.cct} · {source.turno || 'Sin turno'} · {source.municipio}</p>
                {validCoordinates(source.latitud, source.longitud) && <><p>{source.latitud.toFixed(6)}, {source.longitud.toFixed(6)}</p><LocationMap lat={source.latitud} lng={source.longitud} /></>}
                {source.status === 'candidate' ? <><label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Revisé CCT, nombre, turno y el punto en el mapa; corresponde a esta escuela.</label><button type="button" disabled={!confirmed || busy} onClick={() => apply({ action: 'confirm-catalog', sourceId: source.id })} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">{result.catalog ? 'Completar ubicación del catálogo local' : 'Incorporar escuela al catálogo local'}</button></> : <p role="status">{statuses[source.status] || 'Requiere revisión manual.'}</p>}
            </div>)}
            {result?.catalog?.ubicacion_verificada_at && result.visits.length > 0 && <div className="space-y-2"><p className="font-bold">Visitas futuras sin ubicación (se aplican una por una)</p>{result.visits.map(v => <button key={v.id} type="button" disabled={busy} className="block w-full rounded-lg border p-3 text-left" onClick={() => { if (window.confirm(`Incorporar SOLO las coordenadas verificadas a la visita #${v.id}: ${v.nombre_escuela}, ${v.fecha_programada}, ${v.turno}? No se cambiarán otros datos.`)) apply({ action: 'fill-visit', visitId: v.id }); }}>Incorporar a #{v.id} · {v.fecha_programada} · {v.turno}</button>)}</div>}
        </div>}
        {message && <p role="status" className="font-medium">{message}</p>}
    </section>;
}
