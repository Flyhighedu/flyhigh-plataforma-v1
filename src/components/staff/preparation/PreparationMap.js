'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { coordinates } from '@/lib/narration-preparation.mjs';

// Names go to Leaflet as text nodes, never interpolated into HTML.
export default function PreparationMap({ markers, onSelect, selectedId }) {
    const container = useRef(null);
    const [tileError, setTileError] = useState(false);
    const callback = useRef(onSelect);
    useEffect(() => { callback.current = onSelect; }, [onSelect]);
    useEffect(() => {
        const points = markers.filter(m => coordinates(m.lat, m.lng));
        if (!container.current || !points.length) return;
        const map = L.map(container.current, { scrollWheelZoom: false }).setView([points[0].lat, points[0].lng], 14);
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
        }).addTo(map);
        tiles.on('tileerror', () => setTileError(true));
        tiles.on('tileload', () => setTileError(false));
        for (const point of points) {
            const label = document.createElement('span');
            label.textContent = point.name;
            const icon = L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18],
                html: `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${point.school ? '#2563eb' : '#0f766e'};border:3px solid white;box-shadow:0 2px 8px #0003;color:white;font-weight:bold">${point.school ? 'E' : '•'}</span>` });
            const marker = L.marker([point.lat, point.lng], { icon, title: point.name, alt: point.name, keyboard: true }).addTo(map).bindTooltip(label);
            marker.on('click', () => callback.current?.(point.id));
            if (String(point.id) === String(selectedId)) marker.openTooltip();
        }
        if (points.length > 1) map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [32, 32], maxZoom: 15 });
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(container.current);
        return () => { observer.disconnect(); map.remove(); };
    }, [markers, selectedId]);
    if (!markers.some(m => coordinates(m.lat, m.lng))) return <p className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">Todavía no hay ubicaciones confirmadas para mostrar en el mapa. Puedes continuar desde la lista.</p>;
    return <div>
        <div ref={container} role="region" aria-label="Mapa de escuelas y lugares" className="relative z-0 h-72 overflow-hidden rounded-2xl border border-slate-200 sm:h-96" />
        {tileError && <p role="status" className="mt-2 text-xs text-amber-800">No se pudo cargar parte del mapa. La lista sigue disponible.</p>}
        <p className="mt-2 text-xs text-slate-500">Azul: escuela · Verde: lugar con narración. También puedes seleccionarlos desde la lista.</p>
    </div>;
}
