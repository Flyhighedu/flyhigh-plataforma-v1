'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crosshair, Eye, EyeOff, Headphones, MapPin, Maximize2, Minimize2, Pause, Play, Radar, Loader2, SlidersHorizontal } from 'lucide-react';
import { coordinates, distanceKm, usableAudio } from '@/lib/narration-preparation.mjs';
import { advanceFlight, closestPoi, distanceMeters, fallbackZoom, flightCamera, FLIGHT_LIMITS, FLIGHT_SPEEDS, flightLimitsForSpeed } from '@/lib/flight-rehearsal.mjs';
import { advanceGimbal, createFlightProfiles, DEFAULT_PROFILES, tuneControls, virtualLimits } from '@/lib/flight-cockpit.mjs';
import FlightSettings from './FlightSettings';
import { LoadingPreparation, Notice, secondary, usePreparationData } from './PreparationUI';
import useNarrationAudio from './useNarrationAudio';
import useFlightFullscreen from './useFlightFullscreen';
import useRehearsalRadar from './useRehearsalRadar';
import { FloatingJoystick, RelativeGimbal } from './FlightControls';
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
        sky: { 'sky-color': '#b9d7e8', 'horizon-color': '#e2edf3', 'sky-horizon-blend': 0.3 },
        sources: {
            basemap: {
                type: 'raster', tiles: [BASEMAP_URL], tileSize: 256, maxzoom: 19,
                attribution: BASEMAP_CREDITS,
            },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 0 } }],
    };
}

function createMarkerElement(kind, name, selected = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.title = name;
    element.setAttribute('aria-label', name);
    element.style.cssText = 'display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:3px solid white;box-shadow:0 5px 16px rgba(0,0,0,.35);color:white;font-weight:900;cursor:pointer;';
    element.dataset.poiKind = kind;
    element.style.background = kind === 'school' ? '#2563eb' : selected ? '#f59e0b' : kind === 'radar' ? '#7c3aed' : kind === 'audio' ? '#0891b2' : '#64748b';
    element.textContent = kind === 'school' ? 'E' : selected ? '★' : kind === 'radar' ? '◇' : '•';
    return element;
}

function formatDistance(value) {
    return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
}

function RehearsalMap({ visit, pois, selectedIds, audio, google3d = false }) {
    const confirmedLocation = coordinates(visit.ubicacion_lat, visit.ubicacion_lng);
    const needsOrigin = google3d && !confirmedLocation;
    // Reference view only; a missing school location requires explicit takeoff.
    const [schoolLatitude, schoolLongitude] = confirmedLocation || [19.4169, -102.0555];
    const container = useRef(null);
    const screenRef = useRef(null);
    const googleCredits = useRef(null);
    const immersive = useFlightFullscreen(screenRef);
    const updateCamera = useRef(null);
    const map = useRef(null);
    const aircraftMarker = useRef(null);
    const aircraftArrow = useRef(null);
    const poiMarkers = useRef([]);
    const addRadarMarker = useRef(null);
    const leftControl = useRef(null);
    const rightControl = useRef(null);
    const controls = useRef({ forward: 0, strafe: 0, climb: 0, yaw: 0 });
    const flight = useRef({ latitude: schoolLatitude, longitude: schoolLongitude, altitude: 24, heading: 0 });
    const origin = useRef({ latitude: schoolLatitude, longitude: schoolLongitude });
    const filteredControls = useRef({});
    const tuningRef = useRef(DEFAULT_PROFILES.normal);
    const [profiles, setProfiles] = useState(createFlightProfiles);
    const gimbalTarget = useRef(DEFAULT_GIMBAL);
    const gimbalMotion = useRef({ angle: DEFAULT_GIMBAL, velocity: 0 });
    const [ceiling, setCeiling] = useState(120);
    const [quality, setQuality] = useState('high');
    const qualityRef = useRef(quality);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [picking, setPicking] = useState(needsOrigin);
    const [candidate, setCandidate] = useState(null);
    const [originBusy, setOriginBusy] = useState(false);
    const [surfaceStatus, setSurfaceStatus] = useState('');
    const [temporaryOrigin, setTemporaryOrigin] = useState(false);
    const radar = useRehearsalRadar(flight, pois);
    const speedLimits = useRef(flightLimitsForSpeed('normal'));
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
    const [speedId, setSpeedId] = useState('normal');

    const reset = useCallback(() => {
        flight.current = { ...origin.current, altitude: 24, heading: 0 };
        aircraftMarker.current?.setLngLat([origin.current.longitude, origin.current.latitude]);
        if (aircraftArrow.current) aircraftArrow.current.style.transform = 'rotate(0deg)';
        controls.current = { forward: 0, strafe: 0, climb: 0, yaw: 0 };
        filteredControls.current = {};
        leftControl.current?.stop();
        rightControl.current?.stop();
        updateCamera.current?.(flight.current);
        setHud({ altitude: flight.current.altitude, heading: 0, nearest: null, distance: 0, horizontal: 0, vertical: 0 });
    }, []);

    useEffect(() => {
        running.current = playing && !settingsOpen && !picking;
        if (!running.current) { leftControl.current?.stop(); rightControl.current?.stop(); controls.current = { forward: 0, strafe: 0, climb: 0, yaw: 0 }; filteredControls.current = {}; gimbalTarget.current = gimbal.current; gimbalMotion.current = { angle: gimbal.current, velocity: 0 }; }
    }, [playing, settingsOpen, picking]);
    useEffect(() => { tuningRef.current = profiles[speedId]; }, [profiles, speedId]);
    useEffect(() => {
        const stop = () => { controls.current = { forward: 0, strafe: 0, climb: 0, yaw: 0 }; filteredControls.current = {}; gimbalTarget.current = gimbal.current; gimbalMotion.current = { angle: gimbal.current, velocity: 0 }; };
        const hidden = () => { if (document.hidden) stop(); };
        window.addEventListener('blur', stop); window.addEventListener('resize', stop);
        document.addEventListener('visibilitychange', hidden);
        return () => { window.removeEventListener('blur', stop); window.removeEventListener('resize', stop); document.removeEventListener('visibilitychange', hidden); };
    }, []);
    useEffect(() => {
        speedLimits.current = google3d ? virtualLimits(speedId, ceiling, profiles) : flightLimitsForSpeed(speedId);
        filteredControls.current = {};
    }, [speedId, ceiling, google3d, profiles]);
    useEffect(() => { qualityRef.current = quality; map.current?.setQuality?.(quality); }, [quality]);
    useEffect(() => {
        if (!ready || !radar.visible || !addRadarMarker.current) return;
        const markers = radar.items.map(poi => addRadarMarker.current(poi));
        return () => markers.forEach(marker => marker.remove());
    }, [ready, radar.visible, radar.items]);
    useEffect(() => {
        if (!google3d) { gimbal.current = gimbalAngle; updateCamera.current?.(flight.current); }
    }, [gimbalAngle, google3d]);
    useEffect(() => {
        showPoisRef.current = showPois;
        poiMarkers.current.forEach(entry => { entry.element.style.display = showPois ? 'flex' : 'none'; });
    }, [showPois]);

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();
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
                    let tiltChanged = false;
                    if (google3d) {
                        const motion = advanceGimbal(gimbalMotion.current, gimbalTarget.current, tuningRef.current, elapsed);
                        tiltChanged = motion.angle !== gimbal.current;
                        gimbalMotion.current = motion;
                        gimbal.current = motion.angle;
                        if (tiltChanged) setGimbalAngle(Math.round(motion.angle * 10) / 10);
                    }
                    const previous = flight.current;
                    filteredControls.current = google3d ? tuneControls(controls.current, filteredControls.current, tuningRef.current, elapsed) : controls.current;
                    const limits = google3d && previous.altitude > speedLimits.current.maximumAltitudeMeters ? { ...speedLimits.current, maximumAltitudeMeters: previous.altitude } : speedLimits.current;
                    flight.current = advanceFlight(previous, filteredControls.current, elapsed, limits);
                    const current = flight.current;
                    if (tiltChanged || current.latitude !== previous.latitude || current.longitude !== previous.longitude || current.altitude !== previous.altitude || current.heading !== previous.heading) {
                        moveAircraft(current);
                        moveCamera(current);
                    }
                    if (time - latestHud > 180) {
                        latestHud = time;
                        const actual = flight.current;
                        setHud({ altitude: actual.altitude, heading: actual.heading, nearest: closestPoi(actual, pois, 3000), distance: distanceMeters(actual, origin.current), horizontal: elapsed ? distanceMeters(actual, previous) / elapsed : 0, vertical: elapsed ? (actual.altitude - previous.altitude) / elapsed : 0 });
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
                addRadarMarker.current = poi => {
                    const marker = L.marker([poi.latitude, poi.longitude], {
                        icon: L.divIcon({ className: '', html: createMarkerElement('radar', poi.name).outerHTML, iconSize: [34, 34], iconAnchor: [17, 34] }),
                    }).addTo(instance);
                    marker.on('click', () => setActivePoi(poi));
                    return marker;
                };

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

        if (google3d) {
            import('./google3dEngine').then(async ({ createGoogle3dEngine }) => {
                if (disposed) return;
                const engine = await createGoogle3dEngine({ container: container.current, credits: googleCredits.current, visitId: visit.id,
                    initial: flight.current, gimbal: () => gimbal.current, signal: controller.signal,
                    onError: message => { if (!disposed) { setMapError(message); setPlaying(false); } },
                    onCorrection: corrected => {
                        if (disposed) return;
                        const lifted = Math.abs(corrected.altitude - flight.current.altitude) > .05;
                        flight.current = { ...corrected };
                        if (lifted) setHud(previous => ({ ...previous, altitude: corrected.altitude }));
                    },
                    onCandidate: value => { if (!disposed) setCandidate(value); },
                    onSurfaceStatus: value => { if (!disposed) setSurfaceStatus(value); }, quality: qualityRef.current,
                });
                if (disposed) { engine.remove(); return; }
                map.current = engine;
                // Camera is the aircraft in this renderer; no redundant arrow.
                aircraftMarker.current = { setLngLat: () => {} };
                if (!needsOrigin) engine.addMarker(createMarkerElement('school', visit.nombre_escuela), { latitude: schoolLatitude, longitude: schoolLongitude });
                const addPoi = (poi, kind) => {
                    const element = createMarkerElement(kind, poi.name, selectedIds.has(String(poi.id)));
                    element.addEventListener('click', event => { event.stopPropagation(); setActivePoi(poi); });
                    return { element, marker: engine.addMarker(element, poi) };
                };
                for (const poi of pois) {
                    const entry = addPoi(poi, usableAudio(poi.audio_url) ? 'audio' : 'poi');
                    entry.element.style.display = showPoisRef.current ? 'flex' : 'none';
                    poiMarkers.current.push(entry);
                }
                addRadarMarker.current = poi => addPoi(poi, 'radar').marker;
                setReady(true);
                beginFlightLoop(() => {}, engine.setCamera);
                if (needsOrigin) engine.beginSelection();
            }).catch(error => { if (!disposed && error.name !== 'AbortError') setMapError(error.message || 'No se pudo abrir la prueba 3D.'); });
        } else import('maplibre-gl').then(maplibreModule => {
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
                maxPitch: 90,
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
                addRadarMarker.current = poi => {
                    const element = createMarkerElement('radar', poi.name);
                    element.addEventListener('click', event => { event.stopPropagation(); setActivePoi(poi); });
                    return new maplibregl.Marker({ element }).setLngLat([poi.longitude, poi.latitude]).addTo(instance);
                };
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
                else if (event?.error?.message) setMapError('No se pudo cargar parte del mapa. Comprueba tu conexión.');
            });
            instance.on('sourcedata', () => { if (instance.isSourceLoaded('basemap')) setMapError(''); });
        }).catch(startCompatibleMap);
        const observer = new ResizeObserver(() => { map.current?.resize?.(); updateCamera.current?.(flight.current); });
        observer.observe(container.current);
        return () => {
            disposed = true;
            controller.abort();
            observer.disconnect();
            clearTimeout(loadTimer);
            cancelAnimationFrame(frame);
            poiMarkers.current = [];
            aircraftMarker.current = null;
            updateCamera.current = null;
            addRadarMarker.current = null;
            map.current?.remove();
            map.current = null;
        };
    }, [pois, schoolLatitude, schoolLongitude, selectedIds, visit.nombre_escuela, visit.id, google3d, needsOrigin]);

    const left = useCallback(value => { controls.current.forward = value.y; controls.current.strafe = value.x; }, []);
    const right = useCallback(value => { controls.current.climb = value.y; controls.current.yaw = value.x; }, []);
    const currentPoi = activePoi?.source === 'osm-radar' ? (radar.visible && radar.items.some(poi => poi.id === activePoi.id) ? activePoi : (showPois ? hud.nearest?.poi : null)) : (showPois ? activePoi || hud.nearest?.poi : null);
    const currentDistance = currentPoi ? closestPoi(flight.current, [currentPoi])?.distance : null;

    const endPointer = event => { leftControl.current?.end(event); rightControl.current?.end(event); };
    const chooseOrigin = () => { audio.stop(); setPicking(true); setMapError(''); map.current?.beginSelection(); };
    const confirmOrigin = async () => {
        setOriginBusy(true); setMapError('');
        try {
            const state = await map.current.confirmSelection();
            origin.current = { latitude: state.latitude, longitude: state.longitude };
            flight.current = state;
            setTemporaryOrigin(true); setPicking(false); setPlaying(true);
            setHud({ altitude: state.altitude, heading: 0, nearest: null, distance: 0, horizontal: 0, vertical: 0 });
        } catch (error) { setMapError(error.message); }
        finally { setOriginBusy(false); }
    };
    return <main ref={screenRef} className={`${styles.screen} ${google3d ? styles.googleLayout : ''}`}
        onPointerDown={event => {
            if (picking || settingsOpen || !ready) return;
            if (event.button !== 0 || event.target.closest('button, a, input, select, label, header, section, [role="slider"]')) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientY - bounds.top < bounds.height * 0.42) return;
            const control = event.clientX - bounds.left < bounds.width / 2 ? leftControl : rightControl;
            if (control.current?.start(event, bounds)) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }
        }}
        onPointerMove={event => { leftControl.current?.move(event); rightControl.current?.move(event); }}
        onPointerUp={endPointer} onPointerCancel={endPointer} onLostPointerCapture={endPointer}>
        {/* MapLibre's unlayered position:relative overrides Tailwind utilities.
            Keep the full-screen geometry explicit for both map engines, and
            contain Leaflet's high pane z-index beneath the flight controls. */}
        <div ref={container} style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }} aria-label="Mapa del ensayo de vuelo" />
        {!picking && <div className={styles.touchZones} aria-hidden="true"><div /><div /></div>}
        {!ready && !mapError && <div className="absolute inset-0 grid place-items-center bg-[#07121e]"><p role="status" className="animate-pulse text-sm font-semibold text-cyan-100">{google3d ? 'Cargando relieve de Google…' : 'Preparando cabina…'}</p></div>}

        <header className={`${styles.header} pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-[max(.75rem,env(safe-area-inset-top))]`}>
            <div className="pointer-events-auto flex items-center gap-2">
                <Link href={`/staff/visitas/${visit.id}`} onClick={audio.stop} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 backdrop-blur-md" aria-label="Volver a preparar visita"><ArrowLeft size={20} /></Link>
                <div className="min-w-0 flex-1 [text-shadow:0_1px_4px_#000]"><p className="truncate text-sm font-black">{google3d ? 'Ensayo con relieve 3D' : 'Ensayo de vuelo'}</p><p className="truncate text-[10px] text-white">{temporaryOrigin ? 'Despegue temporal · ' : ''}{visit.nombre_escuela}</p></div>
                {google3d && !picking && <button onClick={() => setSettingsOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/25 bg-slate-950/70" aria-label="Ajustes del ensayo"><SlidersHorizontal size={19} /></button>}
                <button onClick={immersive.toggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/25 bg-slate-950/70" aria-label={immersive.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa horizontal'} title={immersive.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa horizontal'}>{immersive.fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button>
            </div>
            {!google3d && <div className={`${styles.hud} pointer-events-auto mt-2 grid grid-cols-3 gap-1.5 text-center`}>
                <div className="rounded-xl border border-white/15 bg-slate-950/75 px-2 py-1.5" title={google3d ? 'Altura virtual sobre el relieve cargado. No es un instrumento de navegación.' : 'Límite del ensayo: 120 m sobre suelo plano'}><p className="text-[9px] text-slate-300">ALTURA</p><p className="text-xs font-black tabular-nums">{hud.altitude.toFixed(1)} m</p><p className="text-[8px] text-slate-300">Máx. {FLIGHT_LIMITS.maximumAltitudeMeters} m</p></div>
                <div className="rounded-xl border border-white/15 bg-slate-950/75 px-2 py-1.5"><p className="text-[9px] text-slate-300">RUMBO</p><p className="text-xs font-black tabular-nums">{String(Math.round(hud.heading)).padStart(3, '0')}°</p></div>
                <div className="rounded-xl border border-white/15 bg-slate-950/75 px-2 py-1.5"><p className="text-[9px] text-slate-300">GIMBAL</p><p className="text-xs font-black tabular-nums">{gimbalAngle}°</p></div>
            </div>}
        </header>

        {google3d && !picking && <section className={styles.telemetry} aria-label="Telemetría del ensayo">
            <div title="Altura respecto al despegue"><p>ALTURA</p><strong>{hud.altitude.toFixed(1)} m</strong><small>Máx. {ceiling} m</small></div>
            <div title="Distancia al despegue"><p>DISTANCIA</p><strong>{formatDistance(hud.distance || 0)}</strong></div>
            <div><p>VELOCIDAD</p><strong>{(playing && !settingsOpen ? hud.horizontal || 0 : 0).toFixed(1)} m/s</strong></div>
            <div><p>VERTICAL</p><strong>{(playing && !settingsOpen ? hud.vertical || 0 : 0).toFixed(1)} m/s</strong></div>
            <div><p>RUMBO</p><strong>{String(Math.round(hud.heading)).padStart(3, '0')}°</strong><small>Gimbal {gimbalAngle}°</small></div>
        </section>}

        {!picking && <><div className={`${styles.tools} absolute right-3 top-36 z-10 flex flex-col gap-2`}>
            <button onClick={() => setShowPois(value => !value)} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 shadow-lg" aria-pressed={showPois} title="Lugares guardados y narraciones" aria-label={showPois ? 'Ocultar puntos de interés' : 'Mostrar puntos de interés'}>{showPois ? <Eye size={19} /> : <EyeOff size={19} />}</button>
            <button onClick={radar.toggle} className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/20 shadow-lg ${radar.visible ? 'bg-violet-700' : 'bg-slate-950/75'}`} aria-pressed={radar.visible} aria-label={radar.visible ? 'Ocultar radar de lugares' : 'Explorar lugares cercanos'} title="Radar cultural · 3 km">{radar.status === 'loading' ? <Loader2 size={19} className="animate-spin" /> : <Radar size={19} />}</button>
            <button onClick={reset} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 shadow-lg" aria-label={google3d ? 'Regresar al despegue' : 'Regresar a la escuela'}><Crosshair size={19} /></button>
            {google3d && <button disabled={!ready} onClick={chooseOrigin} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-slate-950/65 shadow-lg" aria-label="Elegir despegue en el mapa"><MapPin size={19} /></button>}
        </div>

        <RelativeGimbal value={gimbalAngle} onChange={google3d ? value => { gimbalTarget.current = value; } : setGimbalAngle} />
        <label className={styles.speed}><span>{google3d ? 'Modo de vuelo' : 'Velocidad'}</span><select aria-label="Velocidad del ensayo" value={speedId} onChange={event => setSpeedId(event.target.value)}>{FLIGHT_SPEEDS.map(speed => <option key={speed.id} value={speed.id}>{google3d ? { slow: 'C · Cine', normal: 'N · Normal', fast: 'S · Sport' }[speed.id] : speed.label} · {google3d ? profiles[speed.id].horizontal : speed.horizontalMetersPerSecond} m/s</option>)}</select></label></>}
        {radar.visible && <section className={styles.radarStatus} aria-label="Estado del radar"><p role="status">{radar.status === 'loading' ? 'Buscando lugares a 3 km…' : radar.status === 'error' ? 'El radar no respondió. Intenta de nuevo.' : radar.status === 'empty' ? 'Sin lugares adicionales a 3 km.' : `${radar.items.length} lugares · radio 3 km`}</p><button disabled={radar.status === 'loading'} onClick={radar.search}>Buscar aquí</button></section>}

        {(mapError || surfaceStatus || immersive.notice || mapMode === 'compatible') && <p role="status" className={`${styles.status} absolute left-3 right-16 top-36 z-10 rounded-xl border border-cyan-300/25 bg-slate-950/85 px-3 py-2 text-xs text-cyan-50`}>{mapError || surfaceStatus || immersive.notice || 'Vista compatible: altura y gimbal se representan con acercamiento.'}</p>}

        {!picking && currentPoi && <section className={`${styles.poi} absolute bottom-40 left-1/2 z-10 w-[min(82vw,22rem)] -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-xl sm:bottom-44`}>
            <div className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-cyan-300" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{currentPoi.name}</p><p className="mt-0.5 text-[10px] text-slate-300">{currentPoi.source === 'osm-radar' ? 'Radar cultural · Sin narración' : selectedIds.has(String(currentPoi.id)) ? 'En tu secuencia' : usableAudio(currentPoi.audio_url) ? 'Narración disponible' : 'Audio pendiente'}{currentDistance != null && ` · ${formatDistance(currentDistance)}`}</p></div>{activePoi && <button onClick={() => setActivePoi(null)} className="px-1 text-xs text-slate-300">Cerrar</button>}</div>
            {usableAudio(currentPoi.audio_url) && <button onClick={() => audio.toggle(currentPoi)} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/20 text-xs font-bold text-cyan-100"><Headphones size={15} />{audio.id === currentPoi.id && audio.status === 'playing' ? 'Pausar narración' : 'Escuchar narración'}</button>}
        </section>}

        {!picking && <><button onClick={() => setPlaying(value => !value)} className={`${styles.pause} absolute bottom-5 left-1/2 z-20 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border border-white/30 bg-cyan-500 text-slate-950 shadow-xl`} aria-label={playing ? 'Pausar simulación' : 'Continuar simulación'}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
        <FloatingJoystick controlRef={leftControl} side="left" label="Movimiento" onChange={left} />
        <FloatingJoystick controlRef={rightControl} side="right" label="Altura · giro" onChange={right} /></>}
        {google3d && picking && <section className={styles.originPicker} aria-label="Elegir despegue temporal"><h2>Elegir despegue</h2><p>{needsOrigin && !temporaryOrigin ? 'La escuela no tiene ubicación confirmada. ' : ''}Mueve el mapa y toca el punto de partida. Solo se usará en este ensayo.</p><p>{candidate ? `${candidate.latitude.toFixed(5)}, ${candidate.longitude.toFixed(5)}` : 'Selecciona una superficie del mapa'}</p><div>{(!needsOrigin || temporaryOrigin) && <button disabled={originBusy} onClick={() => { map.current.cancelSelection(); setPicking(false); setMapError(''); }}>Cancelar</button>}<button disabled={!candidate || originBusy} onClick={confirmOrigin}>{originBusy ? 'Verificando superficie…' : 'Despegar aquí'}</button></div></section>}
        {settingsOpen && <FlightSettings profiles={profiles} setProfiles={setProfiles} activeMode={speedId} ceiling={ceiling} setCeiling={setCeiling} quality={quality} setQuality={setQuality} onClose={() => setSettingsOpen(false)} />}
        {google3d ? <div className={styles.googleCredits}><span className={styles.googleBrand}>Google Maps</span><div ref={googleCredits} />{radar.visible && <span>Lugares del radar © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></span>}</div>
            : <div className={styles.credits}><span dangerouslySetInnerHTML={{ __html: BASEMAP_CREDITS }} />{ARCGIS_KEY && radar.visible && <span> · Lugares © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></span>}</div>}
    </main>;
}

export default function FlightRehearsalScreen({ visitId, google3d = false }) {
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
        if (!google3d && (latitude == null || longitude == null)) return [];
        return (data?.catalog || [])
            .filter(item => !item.is_general_topic && coordinates(item.latitude, item.longitude))
            .map(item => ({ ...item, latitude: Number(item.latitude), longitude: Number(item.longitude), distance: distanceKm([latitude ?? 19.4169, longitude ?? -102.0555], coordinates(item.latitude, item.longitude)) }))
            .filter(item => google3d || (item.distance != null && item.distance <= 10))
            .sort((a, b) => Number(selectedIds.has(String(b.id))) - Number(selectedIds.has(String(a.id))) || a.distance - b.distance);
    }, [data?.catalog, latitude, longitude, selectedIds, google3d]);

    if (loading) return <div className="min-h-[100svh] bg-slate-950 p-5 text-white"><LoadingPreparation /></div>;
    if (error) return <div className="min-h-[100svh] bg-slate-950 p-5 text-white"><Notice action={<button className={secondary} onClick={retry}>Reintentar</button>}>{error}</Notice></div>;
    if (!location && !google3d) return <div className="min-h-[100svh] bg-[#f3f7fb] p-5 text-[#071a33]"><Link href={`/staff/visitas/${visitId}`} className={secondary}><ArrowLeft size={18} />Volver</Link><div className="mt-5"><Notice>Esta visita necesita una ubicación confirmada antes de ensayar el vuelo.</Notice></div></div>;
    return <RehearsalMap key={`${visit.id}:${latitude}:${longitude}:${google3d}`} visit={visit} pois={pois} selectedIds={selectedIds} audio={audio} google3d={google3d} />;
}
