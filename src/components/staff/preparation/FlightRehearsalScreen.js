'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crosshair, Eye, EyeOff, Headphones, MapPin, Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import { coordinates, distanceKm, usableAudio } from '@/lib/narration-preparation.mjs';
import { advanceFlight, closestPoi, fallbackZoom, flightCamera } from '@/lib/flight-rehearsal.mjs';
import { LoadingPreparation, Notice, secondary, usePreparationData } from './PreparationUI';
import useNarrationAudio from './useNarrationAudio';
import useFlightFullscreen from './useFlightFullscreen';
import styles from './FlightRehearsalScreen.module.css';
import 'leaflet/dist/leaflet.css';

const ARCGIS_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';
const DEFAULT_GIMBAL = -40;
const BASEMAP_URL = ARCGIS_KEY
    ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(ARCGIS_KEY)}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const BASEMAP_CREDITS = ARCGIS_KEY ? 'Esri, Vantor, Earthstar Geographics y colaboradores' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function mapStyle() {
    return {
        version: 8,
        sources: {
            basemap: {
                type: 'raster', tiles: [BASEMAP_URL], tileSize: 256, maxzoom: 19,
                attribution: BASEMAP_CREDITS,
            },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 0 } }],
    };
}

function VirtualJoystick({ label, hint, onChange }) {
    const pad = useRef(null);
    const pointer = useRef(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const update = useCallback(event => {
        const rectangle = pad.current?.getBoundingClientRect();
        if (!rectangle) return;
        const radius = rectangle.width / 2;
        const maximum = radius * 0.62;
        let x = event.clientX - rectangle.left - radius;
        let y = event.clientY - rectangle.top - radius;
        const magnitude = Math.hypot(x, y);
        if (magnitude > maximum) { x *= maximum / magnitude; y *= maximum / magnitude; }
        setKnob({ x, y });
        onChange({ x: x / maximum, y: -y / maximum });
    }, [onChange]);
    const release = useCallback(event => {
        if (pointer.current !== event.pointerId) return;
        pointer.current = null;
        setKnob({ x: 0, y: 0 });
        onChange({ x: 0, y: 0 });
    }, [onChange]);
    useEffect(() => {
        const stop = () => { pointer.current = null; setKnob({ x: 0, y: 0 }); onChange({ x: 0, y: 0 }); };
        const hidden = () => { if (document.hidden) stop(); };
        window.addEventListener('blur', stop);
        document.addEventListener('visibilitychange', hidden);
        return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden); };
    }, [onChange]);
    return <div className="select-none text-center text-white">
        <div
            ref={pad}
            role="application"
            aria-label={label}
            className="relative h-28 w-28 touch-none rounded-full border border-white/35 bg-slate-950/55 shadow-[inset_0_0_32px_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-md sm:h-32 sm:w-32"
            onPointerDown={event => { if (pointer.current !== null) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
            onPointerMove={event => { if (pointer.current === event.pointerId) update(event); }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
        >
            <span className="absolute inset-x-3 top-1/2 h-px bg-white/15" />
            <span className="absolute inset-y-3 left-1/2 w-px bg-white/15" />
            <span className="absolute left-1/2 top-1/2 h-11 w-11 rounded-full border border-cyan-200/60 bg-cyan-400/30 shadow-[0_4px_18px_rgba(34,211,238,0.35)]" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
        <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em]">{label}</p>
        <p className="text-[9px] text-slate-300">{hint}</p>
    </div>;
}

function createMarkerElement(kind, name, selected = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.title = name;
    element.setAttribute('aria-label', name);
    element.style.cssText = 'display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:3px solid white;box-shadow:0 5px 16px rgba(0,0,0,.35);color:white;font-weight:900;cursor:pointer;';
    element.style.background = kind === 'school' ? '#2563eb' : selected ? '#f59e0b' : kind === 'audio' ? '#0891b2' : '#64748b';
    element.textContent = kind === 'school' ? 'E' : selected ? '★' : '•';
    return element;
}

function formatDistance(value) {
    return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
}

function RehearsalMap({ visit, pois, selectedIds, audio }) {
    const [schoolLatitude, schoolLongitude] = coordinates(visit.ubicacion_lat, visit.ubicacion_lng);
    const container = useRef(null);
    const screenRef = useRef(null);
    const immersive = useFlightFullscreen(screenRef);
    const updateCamera = useRef(null);
    const map = useRef(null);
    const aircraftMarker = useRef(null);
    const aircraftArrow = useRef(null);
    const poiMarkers = useRef([]);
    const controls = useRef({ forward: 0, strafe: 0, climb: 0, yaw: 0 });
    const flight = useRef({ latitude: schoolLatitude, longitude: schoolLongitude, altitude: 24, heading: 0 });
    const running = useRef(true);
    const gimbal = useRef(DEFAULT_GIMBAL);
    const showPoisRef = useRef(true);
    const [ready, setReady] = useState(false);
    const [mapError, setMapError] = useState('');
    const [mapMode, setMapMode] = useState('3d');
    const [playing, setPlaying] = useState(true);
    const [showPois, setShowPois] = useState(true);
    const [gimbalAngle, setGimbalAngle] = useState(DEFAULT_GIMBAL);
    const [hud, setHud] = useState({ altitude: 24, heading: 0, nearest: null });
    const [activePoi, setActivePoi] = useState(null);

    const reset = useCallback(() => {
        flight.current = { latitude: schoolLatitude, longitude: schoolLongitude, altitude: 24, heading: 0 };
        aircraftMarker.current?.setLngLat([schoolLongitude, schoolLatitude]);
        if (aircraftArrow.current) aircraftArrow.current.style.transform = 'rotate(0deg)';
        controls.current = { forward: 0, strafe: 0, climb: 0, yaw: 0 };
        updateCamera.current?.(flight.current);
        setHud({ altitude: 24, heading: 0, nearest: null });
    }, [schoolLatitude, schoolLongitude]);

    useEffect(() => { running.current = playing; }, [playing]);
    useEffect(() => {
        gimbal.current = gimbalAngle;
        updateCamera.current?.(flight.current);
    }, [gimbalAngle]);
    useEffect(() => {
        showPoisRef.current = showPois;
        poiMarkers.current.forEach(entry => { entry.element.style.display = showPois ? 'flex' : 'none'; });
    }, [showPois]);

    useEffect(() => {
        let disposed = false;
        let fallbackStarted = false;
        let loadTimer;
        let frame = 0;
        let latestHud = 0;
        let latestFrame = 0;
        let lastTime = performance.now();

        const beginFlightLoop = (moveAircraft, moveCamera) => {
            cancelAnimationFrame(frame);
            updateCamera.current = moveCamera;
            moveCamera(flight.current);
            const tick = time => {
                if (disposed) return;
                if (time - latestFrame < 1000 / 30) { frame = requestAnimationFrame(tick); return; }
                latestFrame = time;
                const elapsed = Math.min((time - lastTime) / 1000, 0.1);
                lastTime = time;
                if (running.current && aircraftMarker.current) {
                    const previous = flight.current;
                    flight.current = advanceFlight(previous, controls.current, elapsed);
                    const current = flight.current;
                    if (current.latitude !== previous.latitude || current.longitude !== previous.longitude || current.altitude !== previous.altitude || current.heading !== previous.heading) {
                        moveAircraft(current);
                        moveCamera(current);
                    }
                    if (time - latestHud > 180) {
                        latestHud = time;
                        setHud({ altitude: current.altitude, heading: current.heading, nearest: closestPoi(current, pois, 3000) });
                    }
                }
                frame = requestAnimationFrame(tick);
            };
            frame = requestAnimationFrame(tick);
        };

        const startCompatibleMap = async reason => {
            if (disposed || fallbackStarted || !container.current) return;
            fallbackStarted = true;
            clearTimeout(loadTimer);
            cancelAnimationFrame(frame);
            updateCamera.current = null;
            poiMarkers.current = [];
            setReady(false);
            console.warn('Flight rehearsal: switching to compatible map.', reason);
            try { map.current?.remove(); } catch { /* A failed WebGL map may be only partially initialized. */ }
            map.current = null;
            container.current.replaceChildren();
            try {
                const leafletModule = await import('leaflet');
                const L = leafletModule.default || leafletModule;
                if (disposed || !container.current) return;
                const instance = L.map(container.current, { zoomControl: false, attributionControl: false, zoomSnap: 0, zoomAnimation: false, fadeAnimation: false }).setView([flight.current.latitude, flight.current.longitude], fallbackZoom(gimbal.current, flight.current.altitude));
                L.tileLayer(BASEMAP_URL, {
                    maxZoom: 22,
                    maxNativeZoom: 19,
                    attribution: BASEMAP_CREDITS,
                }).addTo(instance);
                const adapter = {
                    remove: () => instance.remove(),
                    resize: () => instance.invalidateSize({ animate: false }),
                };
                map.current = adapter;

                const aircraft = L.marker([schoolLatitude, schoolLongitude], {
                    icon: L.divIcon({ className: '', html: '<div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:999px;background:rgba(3,105,161,.9);border:3px solid white;box-shadow:0 8px 26px rgba(0,0,0,.45);color:white"><div data-aircraft-arrow style="font-size:24px;line-height:1;transform-origin:center">▲</div></div>', iconSize: [48, 48], iconAnchor: [24, 24] }),
                }).addTo(instance);
                aircraftArrow.current = aircraft.getElement()?.querySelector('[data-aircraft-arrow]') || null;
                aircraftMarker.current = { setLngLat: ([lng, lat]) => aircraft.setLatLng([lat, lng]) };

                L.marker([schoolLatitude, schoolLongitude], {
                    icon: L.divIcon({ className: '', html: createMarkerElement('school', visit.nombre_escuela).outerHTML, iconSize: [34, 34], iconAnchor: [17, 34] }),
                }).addTo(instance);
                for (const poi of pois) {
                    const sourceElement = createMarkerElement(usableAudio(poi.audio_url) ? 'audio' : 'poi', poi.name, selectedIds.has(String(poi.id)));
                    const marker = L.marker([poi.latitude, poi.longitude], {
                        icon: L.divIcon({ className: '', html: sourceElement.outerHTML, iconSize: [34, 34], iconAnchor: [17, 34] }),
                    }).addTo(instance);
                    const renderedElement = marker.getElement()?.querySelector('button') || marker.getElement();
                    if (renderedElement) renderedElement.style.display = showPoisRef.current ? 'flex' : 'none';
                    marker.on('click', () => setActivePoi(poi));
                    poiMarkers.current.push({ marker, element: renderedElement || sourceElement });
                }
                setMapMode('compatible');
                setMapError('');
                setReady(true);
                beginFlightLoop(current => {
                    aircraft.setLatLng([current.latitude, current.longitude]);
                    if (aircraftArrow.current) aircraftArrow.current.style.transform = `rotate(${current.heading}deg)`;
                }, current => instance.setView([current.latitude, current.longitude], fallbackZoom(gimbal.current, current.altitude), { animate: false }));
            } catch (fallbackError) {
                console.error('Flight rehearsal compatible map failed:', fallbackError);
                if (!disposed) setMapError('No se pudo iniciar el mapa. Comprueba la conexión y vuelve a intentarlo.');
            }
        };

        import('maplibre-gl').then(maplibreModule => {
            if (disposed || !container.current) return;
            const maplibregl = maplibreModule.default || maplibreModule;
            // Serve the native ESM worker and its shared module at stable URLs.
            // Webpack cannot resolve MapLibre's dynamically constructed worker URL.
            maplibregl.setWorkerUrl(new URL('/api/map-assets/maplibre-gl-worker.mjs', window.location.origin).href);
            const instance = new maplibregl.Map({
                container: container.current,
                style: mapStyle(),
                center: [schoolLongitude, schoolLatitude],
                zoom: 16.5,
                pitch: 90 + DEFAULT_GIMBAL,
                bearing: 0,
                attributionControl: false,
                maxPitch: 75,
                maxZoom: 24,
                interactive: false,
                pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
                canvasContextAttributes: { antialias: false },
            });
            map.current = instance;
            loadTimer = setTimeout(() => {
                if (!instance.isStyleLoaded()) startCompatibleMap(new Error('El motor 3D no terminó de iniciar.'));
            }, 15000);
            instance.on('webglcontextlost', () => startCompatibleMap(new Error('Se perdió el contexto gráfico.')));
            instance.on('load', () => {
                if (disposed || fallbackStarted) return;
                clearTimeout(loadTimer);
                setReady(true);
                const aircraft = document.createElement('div');
                aircraft.style.cssText = 'display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:999px;background:rgba(3,105,161,.9);border:3px solid white;box-shadow:0 8px 26px rgba(0,0,0,.45);color:white;';
                const arrow = document.createElement('div');
                arrow.textContent = '▲';
                arrow.style.cssText = 'font-size:24px;line-height:1;transform-origin:center;';
                aircraft.appendChild(arrow);
                aircraftArrow.current = arrow;
                aircraftMarker.current = new maplibregl.Marker({ element: aircraft, anchor: 'center' }).setLngLat([schoolLongitude, schoolLatitude]).addTo(instance);

                const school = createMarkerElement('school', visit.nombre_escuela);
                new maplibregl.Marker({ element: school }).setLngLat([schoolLongitude, schoolLatitude]).addTo(instance);
                for (const poi of pois) {
                    const element = createMarkerElement(usableAudio(poi.audio_url) ? 'audio' : 'poi', poi.name, selectedIds.has(String(poi.id)));
                    element.style.display = showPoisRef.current ? 'flex' : 'none';
                    element.addEventListener('click', event => { event.stopPropagation(); setActivePoi(poi); });
                    const marker = new maplibregl.Marker({ element }).setLngLat([poi.longitude, poi.latitude]).addTo(instance);
                    poiMarkers.current.push({ marker, element });
                }
                beginFlightLoop(current => {
                    aircraftMarker.current?.setLngLat([current.longitude, current.latitude]);
                    if (aircraftArrow.current) aircraftArrow.current.style.transform = `rotate(${current.heading}deg)`;
                }, current => instance.jumpTo(flightCamera(instance, current, gimbal.current)));
            });
            instance.on('error', event => {
                if (/webgl|worker|context/i.test(event?.error?.message || '')) startCompatibleMap(event.error);
                else if (event?.error?.message) setMapError('No se pudo cargar parte de la imagen satelital. Comprueba tu conexión.');
            });
            instance.on('sourcedata', () => { if (instance.isSourceLoaded('basemap')) setMapError(''); });
        }).catch(startCompatibleMap);
        const observer = new ResizeObserver(() => { map.current?.resize?.(); updateCamera.current?.(flight.current); });
        observer.observe(container.current);
        return () => {
            disposed = true;
            observer.disconnect();
            clearTimeout(loadTimer);
            cancelAnimationFrame(frame);
            poiMarkers.current = [];
            aircraftMarker.current = null;
            updateCamera.current = null;
            map.current?.remove();
            map.current = null;
        };
    }, [pois, schoolLatitude, schoolLongitude, selectedIds, visit.nombre_escuela]);

    const left = useCallback(value => { controls.current.forward = value.y; controls.current.strafe = value.x; }, []);
    const right = useCallback(value => { controls.current.climb = value.y; controls.current.yaw = value.x; }, []);
    const currentPoi = activePoi || hud.nearest?.poi;
    const currentDistance = currentPoi ? closestPoi(flight.current, [currentPoi])?.distance : null;

    return <main ref={screenRef} className={styles.screen}>
        {/* MapLibre's unlayered position:relative overrides Tailwind utilities.
            Keep the full-screen geometry explicit for both map engines, and
            contain Leaflet's high pane z-index beneath the flight controls. */}
        <div ref={container} style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }} aria-label="Mapa del ensayo de vuelo" />
        {!ready && !mapError && <div className="absolute inset-0 grid place-items-center bg-[#07121e]"><p className="animate-pulse text-sm font-semibold text-cyan-100">Preparando cabina…</p></div>}

        <header className={`${styles.header} pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-slate-950/90 to-transparent px-3 pb-12 pt-[max(.75rem,env(safe-area-inset-top))]`}>
            <div className="pointer-events-auto flex items-center gap-2">
                <Link href={`/staff/visitas/${visit.id}`} onClick={audio.stop} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 backdrop-blur-md" aria-label="Volver a preparar visita"><ArrowLeft size={20} /></Link>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">Ensayo de vuelo</p><p className="truncate text-[10px] text-slate-300">{visit.nombre_escuela}</p></div>
                <button onClick={immersive.toggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/25 bg-slate-950/70" aria-label={immersive.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa horizontal'} title={immersive.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa horizontal'}>{immersive.fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button>
            </div>
            <div className={`${styles.hud} pointer-events-auto mt-2 grid grid-cols-3 gap-1.5 text-center`}>
                <div className="rounded-xl border border-white/15 bg-slate-950/60 px-2 py-1.5 backdrop-blur"><p className="text-[9px] text-slate-300">ALTURA</p><p className="text-xs font-black tabular-nums">{hud.altitude.toFixed(1)} m</p></div>
                <div className="rounded-xl border border-white/15 bg-slate-950/60 px-2 py-1.5 backdrop-blur"><p className="text-[9px] text-slate-300">RUMBO</p><p className="text-xs font-black tabular-nums">{String(Math.round(hud.heading)).padStart(3, '0')}°</p></div>
                <div className="rounded-xl border border-white/15 bg-slate-950/60 px-2 py-1.5 backdrop-blur"><p className="text-[9px] text-slate-300">GIMBAL</p><p className="text-xs font-black tabular-nums">{gimbalAngle}°</p></div>
            </div>
        </header>

        <div className={`${styles.tools} absolute right-3 top-36 z-10 flex flex-col gap-2`}>
            <button onClick={() => setShowPois(value => !value)} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 shadow-lg backdrop-blur-md" aria-label={showPois ? 'Ocultar puntos de interés' : 'Mostrar puntos de interés'}>{showPois ? <Eye size={19} /> : <EyeOff size={19} />}</button>
            <button onClick={reset} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 shadow-lg backdrop-blur-md" aria-label="Regresar a la escuela"><Crosshair size={19} /></button>
        </div>

        <label className={`${styles.gimbal} absolute right-3 top-[15rem] z-10 flex h-44 w-11 flex-col items-center rounded-2xl border border-white/20 bg-slate-950/65 py-2 shadow-lg backdrop-blur-md`}>
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-300">Gimbal</span>
            <input aria-label="Inclinación del gimbal" type="range" min="-90" max="-20" step="1" value={gimbalAngle} onChange={event => setGimbalAngle(Number(event.target.value))} className="mt-2 h-28 w-5 [writing-mode:vertical-lr] [direction:rtl]" />
        </label>

        {(mapError || immersive.notice || mapMode === 'compatible') && <p role="status" className={`${styles.status} absolute left-3 right-16 top-36 z-10 rounded-xl border border-cyan-300/25 bg-slate-950/85 px-3 py-2 text-xs text-cyan-50`}>{mapError || immersive.notice || 'Vista compatible: altura y gimbal se representan con acercamiento.'}</p>}

        {showPois && currentPoi && <section className={`${styles.poi} absolute bottom-40 left-1/2 z-10 w-[min(82vw,22rem)] -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-xl sm:bottom-44`}>
            <div className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-cyan-300" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{currentPoi.name}</p><p className="mt-0.5 text-[10px] text-slate-300">{selectedIds.has(String(currentPoi.id)) ? 'En tu secuencia' : usableAudio(currentPoi.audio_url) ? 'Narración disponible' : 'Audio pendiente'}{currentDistance != null && ` · ${formatDistance(currentDistance)}`}</p></div>{activePoi && <button onClick={() => setActivePoi(null)} className="px-1 text-xs text-slate-300">Cerrar</button>}</div>
            {usableAudio(currentPoi.audio_url) && <button onClick={() => audio.toggle(currentPoi)} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/20 text-xs font-bold text-cyan-100"><Headphones size={15} />{audio.id === currentPoi.id && audio.status === 'playing' ? 'Pausar narración' : 'Escuchar narración'}</button>}
        </section>}

        <button onClick={() => setPlaying(value => !value)} className="absolute bottom-5 left-1/2 z-20 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border border-white/30 bg-cyan-500 text-slate-950 shadow-xl" aria-label={playing ? 'Pausar simulación' : 'Continuar simulación'}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
        <div className={`${styles.joystick} absolute bottom-4 left-4 z-10`}><VirtualJoystick label="Movimiento" hint="Avance · traslación" onChange={left} /></div>
        <div className={`${styles.joystick} absolute bottom-4 right-4 z-10`}><VirtualJoystick label="Altura · giro" hint="Sube · baja · rota" onChange={right} /></div>
        <div className={styles.credits}>{!ARCGIS_KEY && <span>Mapa de calles · Satélite pendiente · </span>}<span dangerouslySetInnerHTML={{ __html: BASEMAP_CREDITS }} /></div>
    </main>;
}

export default function FlightRehearsalScreen({ visitId }) {
    const { data, loading, error, retry } = usePreparationData(visitId);
    const audio = useNarrationAudio();
    const visit = data?.visits?.[0];
    const location = coordinates(visit?.ubicacion_lat, visit?.ubicacion_lng);
    const latitude = location?.[0];
    const longitude = location?.[1];
    // Metadata polling replaces visits every four seconds. Keep map inputs tied
    // to their actual source fields so that a refresh never tears down WebGL.
    const selectedIds = useMemo(() => new Set((data?.plans?.find(item => item.visit_id === visit?.id)?.items || []).map(item => String(item.id))), [data?.plans, visit?.id]);
    const pois = useMemo(() => {
        if (latitude == null || longitude == null) return [];
        return (data?.catalog || [])
            .filter(item => !item.is_general_topic && coordinates(item.latitude, item.longitude))
            .map(item => ({ ...item, latitude: Number(item.latitude), longitude: Number(item.longitude), distance: distanceKm([latitude, longitude], coordinates(item.latitude, item.longitude)) }))
            .filter(item => item.distance != null && item.distance <= 10)
            .sort((a, b) => Number(selectedIds.has(String(b.id))) - Number(selectedIds.has(String(a.id))) || a.distance - b.distance);
    }, [data?.catalog, latitude, longitude, selectedIds]);

    if (loading) return <div className="min-h-[100svh] bg-slate-950 p-5 text-white"><LoadingPreparation /></div>;
    if (error) return <div className="min-h-[100svh] bg-slate-950 p-5 text-white"><Notice action={<button className={secondary} onClick={retry}>Reintentar</button>}>{error}</Notice></div>;
    if (!location) return <div className="min-h-[100svh] bg-[#f3f7fb] p-5 text-[#071a33]"><Link href={`/staff/visitas/${visitId}`} className={secondary}><ArrowLeft size={18} />Volver</Link><div className="mt-5"><Notice>Esta visita necesita una ubicación confirmada antes de ensayar el vuelo.</Notice></div></div>;
    return <RehearsalMap key={`${visit.id}:${latitude}:${longitude}`} visit={visit} pois={pois} selectedIds={selectedIds} audio={audio} />;
}
