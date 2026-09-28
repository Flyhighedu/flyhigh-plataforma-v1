'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { narrationOrigin } from '@/components/shared/useNarrationEntrance';
import { coordinates } from '@/lib/narration-preparation.mjs';
import { clusterMapPoints, hasCreatedNarration } from '@/lib/preparation-model.mjs';
import styles from './PreparationLayers.module.css';
import surface from './PreparationMapLibre.module.css';

const LeafletFallback = dynamic(() => import('../TacticalMapLeaflet'), { ssr: false });
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const wrapLongitude = value => ((value + 180) % 360 + 360) % 360 - 180;

function mapStyle(session) {
    const query = session ? new URLSearchParams({ kind: 'tile', session: session.session,
        expires: String(session.expires), permit: session.permit }).toString() : '';
    return { version: 8, sources: { basemap: {
        type: 'raster', tileSize: session?.tileSize || 256, maxzoom: 19,
        tiles: [session ? `/api/staff/preparation-map?${query}&z={z}&x={x}&y={y}` : OSM_TILES],
    } }, layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 0 } }] };
}

function leafletBoundsFromMap(map) {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    return { _southWest: sw, _northEast: ne, getCenter: () => bounds.getCenter(), isValid: () => true };
}

function markerElement(poi, kind, number, active, narrated, labelVisible) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${styles.pin} ${styles[kind]} ${narrated ? styles.narrated : styles.unnarrated}`;
    button.dataset.poiId = String(poi.id);
    button.dataset.behavior = kind;
    button.dataset.narration = narrated ? 'created' : 'missing';
    button.setAttribute('aria-label', `${number ? `${number}. ` : ''}${poi.name}${kind === 'school' ? ', inicio y regreso' : kind === 'route' ? ', punto de ruta' : kind === 'reference' ? ', referencia' : narrated ? ', con narración' : ', sin narración'}`);
    button.setAttribute('aria-pressed', String(active));
    const symbol = document.createElement('span');
    symbol.className = styles.symbol;
    symbol.textContent = number || (kind === 'school' ? '🏫' : kind === 'discovery' ? '+' : '');
    button.append(symbol);
    if (labelVisible) {
        const label = document.createElement('span');
        label.className = styles.label;
        label.textContent = poi.name;
        button.append(label);
    }
    return button;
}

function markerWrapper(button) {
    const wrapper = document.createElement('div');
    wrapper.className = styles.marker;
    wrapper.style.width = '44px';
    wrapper.style.height = '44px';
    wrapper.append(button);
    for (const type of ['mousedown', 'touchstart', 'pointerdown'])
        button.addEventListener(type, event => event.stopPropagation());
    return wrapper;
}

export default function PreparationMapLibre(props) {
    const { pois = [], suggestedPois = [], preparation, referencePoint, mapCenter, userLocation } = props;
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const maplibreRef = useRef(null);
    const markersRef = useRef([]);
    const popupRef = useRef(null);
    const latest = useRef(props);
    latest.current = props;
    const sessionRef = useRef(null);
    const providerRef = useRef('osm');
    const longPressRef = useRef(false);
    const [ready, setReady] = useState(false);
    const [leaflet, setLeaflet] = useState(false);
    const [provider, setProvider] = useState('osm');
    const [copyright, setCopyright] = useState('');
    const [creditsReady, setCreditsReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current || leaflet) return;
        let disposed = false;
        let map = null;
        let observer = null;
        let loadTimer = null;
        let pressTimer = null;
        let suppressTimer = null;
        let pressPoint = null;
        let creditAbort = null;
        let creditTimer = null;
        let tileRetryTimer = null;
        let tileRetryCount = 0;
        const controller = new AbortController();
        const stopPress = () => { clearTimeout(pressTimer); pressTimer = null; };
        const suppressNextTap = () => {
            longPressRef.current = true;
            clearTimeout(suppressTimer);
            suppressTimer = setTimeout(() => { longPressRef.current = false; }, 850);
        };
        const switchToLeaflet = () => {
            if (disposed) return;
            stopPress();
            clearTimeout(loadTimer);
            clearTimeout(creditTimer);
            clearTimeout(tileRetryTimer);
            creditAbort?.abort();
            observer?.disconnect();
            map?.remove();
            map = null;
            mapRef.current = null;
            setLeaflet(true);
        };
        const switchToOsm = () => {
            if (disposed || providerRef.current === 'osm') return;
            providerRef.current = 'osm';
            sessionRef.current = null;
            clearTimeout(tileRetryTimer);
            setProvider('osm');
            setCopyright('');
            setCreditsReady(false);
            map?.setStyle(mapStyle(null));
        };
        const updateCredits = () => {
            if (!map || providerRef.current !== 'google' || !sessionRef.current) return;
            clearTimeout(creditTimer);
            creditAbort?.abort();
            creditAbort = new AbortController();
            const signal = creditAbort.signal;
            let attempts = 0;
            const refresh = async () => {
                if (signal.aborted || !map || providerRef.current !== 'google') return;
                const bounds = map.getBounds();
                const wholeWorld = bounds.getEast() - bounds.getWest() >= 360;
                const params = new URLSearchParams({ kind: 'viewport', session: sessionRef.current.session,
                    expires: String(sessionRef.current.expires), permit: sessionRef.current.permit,
                    zoom: String(Math.min(19, Math.max(0, Math.round(map.getZoom())))),
                    north: String(Math.min(85.05113, bounds.getNorth())),
                    south: String(Math.max(-85.05113, bounds.getSouth())),
                    east: String(wholeWorld ? 180 : wrapLongitude(bounds.getEast())),
                    west: String(wholeWorld ? -180 : wrapLongitude(bounds.getWest())),
                });
                try {
                    const response = await fetch(`/api/staff/preparation-map?${params}`, { signal });
                    if (!response.ok) throw new Error('credits');
                    const data = await response.json();
                    if (typeof data.copyright !== 'string') throw new Error('credits');
                    if (!disposed && providerRef.current === 'google') {
                        setCopyright(data.copyright);
                        setCreditsReady(true);
                    }
                } catch {
                    if (disposed || signal.aborted) return;
                    const delays = [1200, 3000, 6000];
                    if (attempts < delays.length) creditTimer = setTimeout(refresh, delays[attempts++]);
                    else switchToOsm();
                }
            };
            creditTimer = setTimeout(refresh, 250);
        };
        const reportBounds = () => {
            if (!map) return;
            clearTimeout(tileRetryTimer);
            tileRetryTimer = null;
            tileRetryCount = 0;
            latest.current.onBoundsChange?.(leafletBoundsFromMap(map));
            updateCredits();
        };
        const start = async () => {
            let satellite = null;
            try {
                const response = await fetch('/api/staff/preparation-map?kind=session', { signal: controller.signal });
                if (response.ok) satellite = await response.json();
            } catch { /* OpenStreetMap remains available. */ }
            if (disposed) return;
            try {
                const maplibreModule = await import('maplibre-gl');
                if (disposed) return;
                const maplibregl = maplibreModule.default || maplibreModule;
                maplibreRef.current = maplibregl;
                maplibregl.setWorkerUrl(new URL('/api/map-assets/maplibre-gl-worker.mjs', window.location.origin).href);
                const center = coordinates(mapCenter?.lat, mapCenter?.lng) || coordinates(userLocation?.lat, userLocation?.lng) || [19.4326, -99.1332];
                map = new maplibregl.Map({ container: containerRef.current, style: mapStyle(satellite),
                    center: [center[1], center[0]], zoom: mapCenter?.zoom || 14, pitch: 35, bearing: 0,
                    minZoom: 2, maxZoom: 19, maxPitch: 60, touchPitch: true, touchZoomRotate: true,
                    dragRotate: false, attributionControl: false, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
                    canvasContextAttributes: { antialias: false },
                });
                mapRef.current = map;
                if (satellite) {
                    sessionRef.current = satellite;
                    providerRef.current = 'google';
                    setProvider('google');
                }
                observer = new ResizeObserver(() => map?.resize());
                observer.observe(containerRef.current);
                loadTimer = setTimeout(switchToLeaflet, 35000);
                map.on('load', () => { clearTimeout(loadTimer); if (!disposed) { setReady(true); reportBounds(); } });
                map.on('moveend', reportBounds);
                map.on('error', event => {
                    const message = event?.error?.message || '';
                    if (/webgl|worker|context/i.test(message)) switchToLeaflet();
                    else if (providerRef.current === 'google' && tileRetryCount < 2 && !tileRetryTimer) {
                        const delay = tileRetryCount++ === 0 ? 1200 : 4000;
                        tileRetryTimer = setTimeout(() => {
                            tileRetryTimer = null;
                            if (map?.getSource('basemap')) map.refreshTiles('basemap');
                        }, delay);
                    }
                });
                map.on('webglcontextlost', switchToLeaflet);
                map.on('click', event => {
                    if (longPressRef.current) { longPressRef.current = false; return; }
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) latest.current.onMapTap?.(event.lngLat.lat, event.lngLat.lng,
                        { x: rect.x + event.point.x, y: rect.y + event.point.y });
                });
                map.on('mousedown', event => {
                    if (event.originalEvent.button !== 0) return;
                    stopPress();
                    pressPoint = event.point;
                    pressTimer = setTimeout(() => {
                        suppressNextTap();
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) latest.current.onLongPress?.(event.lngLat.lat, event.lngLat.lng,
                            { x: rect.x + event.point.x, y: rect.y + event.point.y });
                    }, 600);
                });
                map.on('mousemove', event => {
                    if (pressPoint && Math.hypot(event.point.x - pressPoint.x, event.point.y - pressPoint.y) > 10) stopPress();
                });
                map.on('mouseup', stopPress);
                map.on('touchstart', event => {
                    stopPress();
                    if (event.originalEvent.touches?.length !== 1) return;
                    pressTimer = setTimeout(() => {
                        suppressNextTap();
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) latest.current.onLongPress?.(event.lngLat.lat, event.lngLat.lng,
                            { x: rect.x + event.point.x, y: rect.y + event.point.y });
                    }, 600);
                });
                map.on('touchmove', stopPress);
                map.on('touchend', stopPress);
                map.on('contextmenu', event => {
                    if (longPressRef.current) return;
                    stopPress();
                    suppressNextTap();
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) latest.current.onLongPress?.(event.lngLat.lat, event.lngLat.lng,
                        { x: rect.x + event.point.x, y: rect.y + event.point.y });
                });
            } catch { switchToLeaflet(); }
        };
        start();
        return () => {
            disposed = true;
            controller.abort();
            creditAbort?.abort();
            clearTimeout(loadTimer);
            clearTimeout(creditTimer);
            clearTimeout(tileRetryTimer);
            clearTimeout(suppressTimer);
            stopPress();
            observer?.disconnect();
            popupRef.current?.remove();
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];
            map?.remove();
            mapRef.current = null;
        };
    // The map instance is created once. Current props are read through latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaflet]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready || !coordinates(mapCenter?.lat, mapCenter?.lng)) return;
        map.easeTo({ center: [Number(mapCenter.lng), Number(mapCenter.lat)], zoom: mapCenter.zoom || 14,
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 });
    }, [mapCenter, ready]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready || !coordinates(userLocation?.lat, userLocation?.lng)) return;
        map.easeTo({ center: [Number(userLocation.lng), Number(userLocation.lat)], zoom: 14,
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 });
    }, [userLocation, ready]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready || !preparation) return;
        const renderRoute = () => {
            if (!map.isStyleLoaded()) return;
            const data = { type: 'Feature', geometry: { type: 'LineString',
                coordinates: preparation.geometry.map(point => [Number(point.longitude), Number(point.latitude)]) }, properties: {} };
            if (!map.getSource('preparation-route')) map.addSource('preparation-route', { type: 'geojson', data });
            else map.getSource('preparation-route').setData(data);
            if (!map.getLayer('preparation-route-casing')) map.addLayer({ id: 'preparation-route-casing', type: 'line', source: 'preparation-route',
                paint: { 'line-color': '#fff', 'line-width': 8 } });
            if (!map.getLayer('preparation-route-line')) map.addLayer({ id: 'preparation-route-line', type: 'line', source: 'preparation-route',
                paint: { 'line-color': '#2462d3', 'line-width': 4 } });
        };
        renderRoute();
        map.on('style.load', renderRoute);
        return () => map.off('style.load', renderRoute);
    }, [ready, preparation, provider]);

    useEffect(() => {
        const map = mapRef.current;
        const maplibregl = maplibreRef.current;
        if (!map || !maplibregl || !ready || !preparation) return;
        const render = () => {
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];
            popupRef.current?.remove();
            popupRef.current = null;
            const selected = new Set(preparation.items.map(item => String(item.id)));
            const labelAreas = [];
            const labelFits = (poi, force = false) => {
                const pixel = map.project([Number(poi.longitude), Number(poi.latitude)]);
                const width = Math.min(140, Math.max(45, (poi.name || '').length * 6 + 14));
                const area = { left: pixel.x - width / 2 - 3, right: pixel.x + width / 2 + 3,
                    top: pixel.y + 17, bottom: pixel.y + 45 };
                if (!force && (area.left < 2 || area.right > map.getCanvas().clientWidth - 2 ||
                    labelAreas.some(other => area.left < other.right && area.right > other.left && area.top < other.bottom && area.bottom > other.top))) return false;
                labelAreas.push(area);
                return true;
            };
            const addMarker = (poi, kind, number = '', forced = false) => {
                const active = String(poi.id) === String(preparation.activeId);
                const narrated = hasCreatedNarration(pois.find(item => String(item.id) === String(poi.id)) || poi);
                const button = markerElement(poi, kind, number, active, narrated, forced || labelFits(poi));
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    if (kind !== 'school') (kind === 'discovery' ? latest.current.onSuggestedPoiClick : latest.current.onMarkerClick)?.(
                        { ...poi, _origin: narrationOrigin(button) });
                });
                const marker = new maplibregl.Marker({ element: markerWrapper(button), anchor: 'center',
                    pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
                    .setLngLat([Number(poi.longitude), Number(poi.latitude)]).addTo(map);
                markersRef.current.push(marker);
            };
            if (coordinates(referencePoint?.latitude, referencePoint?.longitude)) {
                labelFits(referencePoint, true);
                addMarker(referencePoint, 'school', '', true);
            }
            preparation.items.forEach((item, index) => {
                if (item.is_general_topic || !coordinates(item.location?.latitude, item.location?.longitude)) return;
                const poi = { ...item, ...item.location };
                labelFits(poi, true);
                addMarker(poi, item.behavior, String(index + 1), true);
            });
            const bounds = map.getBounds();
            const visible = [...pois.map(poi => ({ ...poi, _kind: 'available' })),
                ...suggestedPois.map(poi => ({ ...poi, _kind: 'discovery' }))]
                .filter(poi => !selected.has(String(poi.id)) && !poi.is_general_topic &&
                    coordinates(poi.latitude, poi.longitude) && bounds.contains([Number(poi.longitude), Number(poi.latitude)]));
            const groups = clusterMapPoints(visible, poi => map.project([Number(poi.longitude), Number(poi.latitude)]),
                map.getZoom() >= 17 ? 56 : 80);
            for (const group of groups.filter(group => group.length === 1 && hasCreatedNarration(group[0])))
                addMarker(group[0], group[0]._kind);
            for (const group of groups.filter(group => group.length === 1 && !hasCreatedNarration(group[0])))
                addMarker(group[0], group[0]._kind);
            for (const group of groups.filter(group => group.length > 1)) {
                const lng = group.reduce((sum, poi) => sum + Number(poi.longitude), 0) / group.length;
                const lat = group.reduce((sum, poi) => sum + Number(poi.latitude), 0) / group.length;
                const button = document.createElement('button');
                button.type = 'button'; button.className = styles.cluster;
                button.textContent = String(group.length);
                button.setAttribute('aria-label', `${group.length} lugares disponibles, acercar o ver lista`);
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    if (map.getZoom() < 18) map.fitBounds(group.map(poi => [Number(poi.longitude), Number(poi.latitude)]),
                        { maxZoom: Math.min(18, map.getZoom() + 2), padding: 50, duration: 350 });
                    else {
                        const list = document.createElement('div'); list.className = styles.clusterList;
                        group.forEach(poi => {
                            const entry = document.createElement('button'); entry.type = 'button'; entry.textContent = poi.name;
                            entry.onclick = () => {
                                popupRef.current?.remove();
                                (poi._kind === 'discovery' ? latest.current.onSuggestedPoiClick : latest.current.onMarkerClick)?.(poi);
                            };
                            list.append(entry);
                        });
                        popupRef.current?.remove();
                        popupRef.current = new maplibregl.Popup({ maxWidth: '260px' }).setLngLat([lng, lat]).setDOMContent(list).addTo(map);
                    }
                });
                markersRef.current.push(new maplibregl.Marker({ element: markerWrapper(button), anchor: 'center',
                    pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([lng, lat]).addTo(map));
            }
        };
        render();
        map.on('moveend', render);
        return () => { map.off('moveend', render); markersRef.current.forEach(marker => marker.remove()); markersRef.current = []; };
    }, [ready, pois, suggestedPois, preparation, referencePoint]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready || !preparation?.activeId) return;
        const item = preparation.items.find(point => String(point.id) === String(preparation.activeId));
        const point = item?.location || pois.find(point => String(point.id) === String(preparation.activeId));
        if (coordinates(point?.latitude, point?.longitude)) map.panTo([Number(point.longitude), Number(point.latitude)], { duration: 300 });
    }, [ready, preparation?.activeId, preparation?.items, pois]);

    if (leaflet) return <LeafletFallback {...props} />;
    return <>
        <div ref={containerRef} className={surface.map}
            style={{ visibility: provider === 'google' && !creditsReady ? 'hidden' : 'visible' }} />
        {ready && <div className={surface.controls} aria-label="Controles del mapa">
            <button type="button" aria-label="Acercar" onClick={() => mapRef.current?.zoomIn()}>+</button>
            <button type="button" aria-label="Alejar" onClick={() => mapRef.current?.zoomOut()}>−</button>
            <button type="button" aria-label="Volver al norte y vista plana" title="Norte · vista plana"
                onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 350 })}>N</button>
            <button type="button" className={surface.fit} onClick={() => {
                const points = preparation?.geometry || [];
                if (points.length) mapRef.current?.fitBounds(points.map(point => [Number(point.longitude), Number(point.latitude)]),
                    { padding: 55, maxZoom: 16, duration: 350 });
            }}>Centrar ruta</button>
        </div>}
        <div className={surface.attribution} aria-label="Créditos del mapa">
            {provider === 'google' ? <><span className={surface.google}>Google Maps</span>{copyright && <span>{copyright}</span>}</> :
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>}
        </div>
    </>;
}
