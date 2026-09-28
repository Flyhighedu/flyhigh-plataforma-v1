'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { coordinates } from '@/lib/narration-preparation.mjs';
import { clusterMapPoints, hasCreatedNarration } from '@/lib/preparation-model.mjs';
import styles from './PreparationLayers.module.css';

export default function usePreparationLayers(mapRef, pois, suggestedPois, preparation, onSelect, onDiscover) {
    const latest = useRef(null);
    useEffect(() => { latest.current = { preparation, onSelect, onDiscover }; }, [preparation, onSelect, onDiscover]);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !preparation) return;
        const layer = L.layerGroup().addTo(map);
        const render = () => {
            layer.clearLayers();
            const selected = new Set(preparation.items.map(item => item.id));
            const labelAreas = [];
            const labelFits = (poi, force = false) => {
                const pixel = map.latLngToContainerPoint([poi.latitude, poi.longitude]);
                const width = Math.min(140, Math.max(45, poi.name.length * 6 + 14));
                const area = { left: pixel.x - width / 2 - 3, right: pixel.x + width / 2 + 3,
                    top: pixel.y + 19, bottom: pixel.y + 42 };
                if (!force && (area.left < 2 || area.right > map.getSize().x - 2 ||
                    labelAreas.some(other => area.left < other.right && area.right > other.left && area.top < other.bottom && area.bottom > other.top))) return false;
                labelAreas.push(area);
                return true;
            };
            const geometry = preparation.geometry.map(p => [p.latitude, p.longitude]);
            if (geometry.length > 2) {
                L.polyline(geometry, { color: '#fff', weight: 8, interactive: false }).addTo(layer);
                L.polyline(geometry, { color: '#2462d3', weight: 4, interactive: false, className: 'preparation-route' }).addTo(layer);
            }
            const marker = (poi, kind, number) => {
                const button = document.createElement('button');
                const narrated = Boolean(number || hasCreatedNarration(poi));
                button.type = 'button'; button.className = `${styles.pin} ${styles[kind]} ${narrated ? styles.narrated : styles.unnarrated}`;
                const active = String(poi.id) === String(preparation.activeId);
                button.dataset.poiId = String(poi.id); button.dataset.behavior = kind;
                button.dataset.narration = narrated ? 'created' : 'missing';
                button.setAttribute('aria-label', `${number ? number + '. ' : ''}${poi.name}${kind === 'reference' ? ', referencia' : kind === 'route' ? ', punto de ruta' : narrated ? ', con narración' : ', sin narración'}`);
                button.setAttribute('aria-pressed', String(active));
                const symbol = document.createElement('span'); symbol.className = styles.symbol;
                symbol.textContent = number || (kind === 'discovery' ? '+' : ''); button.append(symbol);
                if (number || labelFits(poi)) {
                    const label = document.createElement('span'); label.className = styles.label; label.textContent = poi.name; button.append(label);
                }
                button.addEventListener('click', event => { event.stopPropagation(); (kind === 'discovery' ? latest.current.onDiscover : latest.current.onSelect)?.(poi); });
                L.DomEvent.disableClickPropagation(button);
                return L.marker([poi.latitude, poi.longitude], { keyboard: false, title: poi.name,
                    icon: L.divIcon({ html: button, className: styles.marker, iconSize: [44, 44], iconAnchor: [22, 22] }),
                    zIndexOffset: active ? 4500 : number ? 3500 : 0 }).addTo(layer);
            };
            preparation.items.forEach((item, index) => {
                if (!item.is_general_topic && coordinates(item.location?.latitude, item.location?.longitude)) {
                    const poi = { ...item, ...item.location };
                    labelFits(poi, true);
                    marker(poi, item.behavior, String(index + 1));
                }
            });
            const bounds = map.getBounds().pad(.1);
            const available = [...pois.map(p => ({ ...p, _kind: 'available' })), ...suggestedPois.map(p => ({ ...p, _kind: 'discovery' }))]
                .filter(poi => !selected.has(String(poi.id)) && !poi.is_general_topic && coordinates(poi.latitude, poi.longitude) && bounds.contains([poi.latitude, poi.longitude]));
            const groups = clusterMapPoints(available, poi => map.project([poi.latitude, poi.longitude], map.getZoom()), map.getZoom() >= 17 ? 72 : 112);
            for (const group of groups.filter(group => group.length === 1 && hasCreatedNarration(group[0]))) marker(group[0], group[0]._kind);
            for (const group of groups.filter(group => group.length === 1 && !hasCreatedNarration(group[0]))) marker(group[0], group[0]._kind);
            for (const group of groups.filter(group => group.length > 1)) {
                const position = [group.reduce((sum, poi) => sum + Number(poi.latitude), 0) / group.length, group.reduce((sum, poi) => sum + Number(poi.longitude), 0) / group.length];
                const button = document.createElement('button'); button.type = 'button'; button.className = styles.cluster;
                button.textContent = String(group.length); button.setAttribute('aria-label', `${group.length} lugares disponibles, acercar o ver lista`);
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    if (map.getZoom() < 18) map.fitBounds(group.map(p => [p.latitude, p.longitude]), { maxZoom: Math.min(18, map.getZoom() + 2), padding: [50, 50], animate: false });
                    else {
                        const list = document.createElement('div'); list.className = styles.clusterList;
                        group.forEach(poi => { const entry = document.createElement('button'); entry.type = 'button'; entry.textContent = poi.name;
                            entry.onclick = () => { map.closePopup(); (poi._kind === 'discovery' ? latest.current.onDiscover : latest.current.onSelect)?.(poi); }; list.append(entry); });
                        L.popup().setLatLng(position).setContent(list).openOn(map);
                    }
                });
                L.DomEvent.disableClickPropagation(button);
                L.marker(position, { keyboard: false, icon: L.divIcon({ html: button, className: styles.marker, iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(layer);
            }
        };
        render(); map.on('moveend zoomend', render);
        return () => { map.off('moveend zoomend', render); layer.remove(); };
    }, [mapRef, pois, suggestedPois, preparation]);
    const lastActive = useRef(null);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !preparation || preparation.activeId === lastActive.current) return;
        lastActive.current = preparation.activeId;
        const selected = preparation.items.find(p => p.id === preparation.activeId);
        const point = selected?.location || pois.find(p => String(p.id) === preparation.activeId);
        if (coordinates(point?.latitude, point?.longitude)) map.panInside([point.latitude, point.longitude], { padding: [65, 65], animate: false });
    }, [preparation, pois, mapRef]);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !preparation) return;
        const control = L.control({ position: 'topright' });
        control.onAdd = () => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Ver recorrido'; button.className = styles.fit;
            button.onclick = () => {
                const points = latest.current.preparation.geometry;
                if (points.length) map.fitBounds(points.map(p => [p.latitude, p.longitude]), { padding: [55, 55], maxZoom: 16, animate: false });
            };
            L.DomEvent.disableClickPropagation(button); return button;
        };
        control.addTo(map); return () => control.remove();
    // The control reads the current preparation without recreating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRef, Boolean(preparation)]);
}
