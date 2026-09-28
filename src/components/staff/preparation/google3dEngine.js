// A separate, lazy engine for the isolated 3D preview. The existing MapLibre
// renderer is not changed, and Google's credential never enters this module.
import { aboveSurface, surfaceEnvelope, QUALITY } from '@/lib/flight-cockpit.mjs';
import { distanceMeters } from '@/lib/flight-rehearsal.mjs';
let library;
export const preloadGoogle3d = () => loadCesium();
function loadCesium() {
    if (window.Cesium) return Promise.resolve(window.Cesium);
    if (library) return library;
    window.CESIUM_BASE_URL = '/api/review-lab/cesium/';
    library = new Promise((resolve, reject) => {
        if (!document.querySelector('link[data-flight-cesium]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet'; css.href = '/api/review-lab/cesium/Widgets/widgets.css'; css.dataset.flightCesium = 'true';
            document.head.append(css);
        }
        const script = document.createElement('script');
        script.src = '/api/review-lab/cesium/Cesium.js';
        script.onload = () => resolve(window.Cesium);
        script.onerror = () => { script.remove(); library = null; reject(new Error('No se pudo cargar el motor 3D. Recarga la prueba.')); };
        document.head.append(script);
    });
    return library;
}

export async function createGoogle3dEngine({ container, credits, visitId, freeFlight = false, initial, gimbal, signal, onError, onCorrection, onCandidate, onSurfaceStatus, onLoadStage, quality = 'high' }) {
    onLoadStage?.('Preparando la vista 3D');
    const C = await loadCesium();
    signal.throwIfAborted();
    // Check authorization/configuration before creating a WebGL context. This
    // fetch is the only root request; Cesium consumes its already-fetched JSON.
    const rootUrl = freeFlight ? "/api/review-lab/google-3d?mode=free" : `/api/review-lab/google-3d?visit=${encodeURIComponent(visitId)}`;
    onLoadStage?.('Conectando con Google Maps');
    const response = await fetch(rootUrl, { signal, cache: 'no-store' });
    const root = await response.json();
    if (!response.ok) throw new Error(root.error || 'Google 3D no está disponible.');
    signal.throwIfAborted();
    // CesiumJS is the open-source renderer; we do not use Cesium ion services.
    // Keep a compact, truthful engine credit, plus ALL Google/provider credits.
    C.CreditDisplay.cesiumCredit = new C.Credit('<a href="https://cesium.com/" target="_blank" rel="noopener noreferrer">CesiumJS</a>', true);
    const widget = new C.CesiumWidget(container, {
        globe: false, baseLayer: false, skyBox: false, skyAtmosphere: false,
        creditContainer: credits, creditViewport: container,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
        useBrowserRecommendedResolution: true, targetFrameRate: 60,
        showRenderLoopErrors: false, contextOptions: { webgl: { antialias: false } },
    });
    const scene = widget.scene;
    scene.backgroundColor = C.Color.fromCssColorString('#b9d7e8');
    scene.screenSpaceCameraController.enableInputs = false;
    scene.postProcessStages.fxaa.enabled = true;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    container.append(overlay);
    const entries = new Set();
    const rootBlob = URL.createObjectURL(new Blob([JSON.stringify(root, (_key, value) => typeof value === 'string' && value.startsWith('/api/review-lab/google-3d?') ? new URL(value, location.origin).href : value)], { type: 'application/json' }));
    let tileset;
    let disposed = false;
    let baseHeight;
    let rendered = 0;
    let failed = 0;
    let current = { ...initial };
    let surface;
    let takeoff = { ...initial };
    let probing = false;
    let probed;
    let selecting = false;
    let candidate;
    let candidatePin;
    let picker;
    let guardTimer;
    let guardQueued = false;
    let surfaceDirty = false;
    let markerCursor = 0;
    let markerHeightTime = 0;
    let markerLayoutTime = 0;
    let markerHeightRevision = 0;
    const markerPoint = new C.Cartesian3();
    const markerDirection = new C.Cartesian3();
    const markerPixel = new C.Cartesian2();
    const remove = () => {
        if (disposed) return;
        disposed = true;
        signal.removeEventListener('abort', remove);
        entries.clear(); overlay.remove();
        clearInterval(guardTimer);
        picker?.destroy();
        URL.revokeObjectURL(rootBlob);
        if (!widget.isDestroyed()) widget.destroy();
    };
    signal.addEventListener('abort', remove, { once: true });
    scene.renderError.addEventListener(() => { if (!disposed) onError('El dispositivo no pudo seguir dibujando el relieve. Puedes volver al ensayo actual.'); });
    try {
        // All children are absolute same-origin URLs. A transient object URL
        // avoids requesting a second billable root; it is never persisted.
        tileset = await C.Cesium3DTileset.fromUrl(rootBlob, {
            showCreditsOnScreen: true, maximumScreenSpaceError: QUALITY[quality].error,
            cacheBytes: QUALITY[quality].memory * 1024 * 1024, maximumCacheOverflowBytes: 64 * 1024 * 1024,
            preloadWhenHidden: false, preloadFlightDestinations: false,
            cullRequestsWhileMoving: false, foveatedScreenSpaceError: false, foveatedTimeDelay: 0,
            dynamicScreenSpaceErrorFactor: 4,
        });
        if (signal.aborted) { tileset.destroy(); signal.throwIfAborted(); }
        scene.primitives.add(tileset);
        const setQuality = id => {
            const preset = QUALITY[id] || QUALITY.high;
            tileset.maximumScreenSpaceError = preset.error;
            const memory = navigator.deviceMemory && navigator.deviceMemory <= 4 ? Math.min(preset.memory, 256) : preset.memory;
            tileset.cacheBytes = memory * 1024 * 1024;
            widget.resolutionScale = Math.min(window.devicePixelRatio || 1, preset.pixels);
            container.dataset.quality = id;
            container.dataset.tileCacheMb = String(memory);
            container.dataset.movingDetail = 'continuous';
            widget.resize(); scene.requestRender();
        };
        setQuality(quality);
        tileset.tileLoad.addEventListener(() => { surfaceDirty = true; markerHeightRevision++; });
        tileset.tileVisible.addEventListener(() => { rendered++; container.dataset.tilesRendered = String(rendered); });
        tileset.tileFailed.addEventListener(() => { failed++; container.dataset.tileFailures = String(failed); });
        scene.camera.setView({ destination: C.Cartesian3.fromDegrees(initial.longitude, initial.latitude, 10000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 } });
        scene.requestRender();
        if (!scene.sampleHeightSupported) throw new Error('Este dispositivo no permite calcular la posición sobre el relieve. Usa el ensayo actual.');
        onLoadStage?.('Comprobando la superficie de despegue');
        const points = [C.Cartographic.fromDegrees(initial.longitude, initial.latitude)];
        let timeout;
        try {
            const heights = await Promise.race([
                scene.sampleHeightMostDetailed(points),
                new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('El relieve de esta ubicación no terminó de cargar. Vuelve a intentarlo.')), 45000); }),
            ]);
            signal.throwIfAborted();
            baseHeight = heights[0]?.height;
            if (!Number.isFinite(baseHeight)) throw new Error('No se pudo confirmar el relieve de esta ubicación. Usa el ensayo actual.');
        } finally { clearTimeout(timeout); }
        surface = baseHeight;
        container.dataset.groundReady = 'true';
        const measure = async position => {
            const points = [C.Cartographic.fromDegrees(position.longitude, position.latitude)];
            let timer;
            try {
                const result = await Promise.race([scene.sampleHeightMostDetailed(points, [], 2), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('No se pudo confirmar la superficie. Elige otro punto o vuelve a intentarlo.')), 30000); })]);
                signal.throwIfAborted();
                if (!Number.isFinite(result[0]?.height)) throw new Error('No se pudo confirmar la superficie. Elige otro punto.');
                return result[0].height;
            } finally { clearTimeout(timer); }
        };
        const visibleSurface = position => scene.sampleHeight(C.Cartographic.fromDegrees(position.longitude, position.latitude), [], 2);
        const apply = state => {
            const safe = aboveSurface(state.altitude, baseHeight, surface);
            current = { ...state, altitude: safe.altitude };
            scene.camera.setView({ destination: C.Cartesian3.fromDegrees(current.longitude, current.latitude, safe.height), orientation: { heading: C.Math.toRadians(current.heading), pitch: C.Math.toRadians(gimbal()), roll: 0 } });
            container.dataset.cameraHeight = (scene.camera.positionCartographic.height - baseHeight).toFixed(2);
            container.dataset.surfaceClearance = (scene.camera.positionCartographic.height - surface).toFixed(2);
            container.dataset.cameraPitch = C.Math.toDegrees(scene.camera.pitch).toFixed(0);
            onCorrection?.(current);
            scene.requestRender();
            return current;
        };
        const setCamera = state => {
            if (disposed || selecting) return current;
            const moved = state.latitude !== current.latitude || state.longitude !== current.longitude;
            // Rotation/tilt does not change the ground underneath the aircraft;
            // the separate streamed-terrain guard handles refinement in place.
            const renderedSurface = moved ? visibleSurface(state) : surface;
            const detailed = distanceMeters(state, takeoff) < .05 ? baseHeight : probed && distanceMeters(state, probed) < .15 ? probed.height : undefined;
            const nextSurface = surfaceEnvelope(renderedSurface, detailed, moved ? undefined : surface);
            if (!Number.isFinite(nextSurface)) {
                // Never move horizontally into unmeasured space. At most one
                // asynchronous sample; it is for this visible flight only.
                if (!probing) {
                    probing = true;
                    onSurfaceStatus?.('Esperando superficie…');
                    measure(state).then(height => { probed = { ...state, height }; }).catch(() => { if (!disposed) onSurfaceStatus?.('No se confirmó la superficie. Movimiento detenido.'); }).finally(() => { probing = false; });
                }
                return apply({ ...state, latitude: current.latitude, longitude: current.longitude });
            }
            surface = nextSurface;
            onSurfaceStatus?.('');
            return apply(state);
        };
        // Re-check even while hovering or paused: streamed detail can raise the
        // visible surface without any input. Never lower the known same-point
        // floor or replace a detailed measurement with a coarse rendered LOD.
        const guardSurface = () => {
            if (disposed || selecting) return;
            const next = surfaceEnvelope(surface, visibleSurface(current));
            if (next > surface) { surface = next; apply(current); }
        };
        guardTimer = setInterval(guardSurface, 250);
        scene.postRender.addEventListener(() => {
            if (disposed) return;
            if (surfaceDirty && !guardQueued && !selecting) {
                surfaceDirty = false; guardQueued = true;
                queueMicrotask(() => { guardQueued = false; guardSurface(); });
            }
            // Marker overlays are deliberately cheaper than the 3D camera.
            // Height sampling runs at ~8 Hz, while DOM marker layout is capped
            // at 30 Hz so a dense POI view cannot consume the 60 fps budget.
            const now = performance.now();
            if (now - markerHeightTime > 120) {
                markerHeightTime = now;
                const markers = [...entries];
                for (let n = 0; n < markers.length; n++) {
                    const entry = markers[markerCursor++ % markers.length];
                    if (entry.element.style.display === 'none' || distanceMeters(current, entry) > 3500 || entry.revision === markerHeightRevision || now - entry.sampledAt < 2000) continue;
                    const height = scene.sampleHeight(entry.cartographic);
                    if (Number.isFinite(height)) entry.height = height;
                    entry.revision = markerHeightRevision; entry.sampledAt = now;
                    break;
                }
            }
            if (now - markerLayoutTime < 1000 / 30) return;
            markerLayoutTime = now;
            const labelPositions = [];
            for (const entry of entries) {
                if (entry.element.style.display === 'none') continue;
                if (!entry.street && !entry.home && distanceMeters(current, entry) > 4000) {
                    if (entry.visible !== false) { entry.element.style.visibility = 'hidden'; entry.visible = false; }
                    continue;
                }
                const point = C.Cartesian3.fromDegrees(entry.longitude, entry.latitude, (entry.height ?? baseHeight) + 3, undefined, markerPoint);
                const direction = C.Cartesian3.subtract(point, scene.camera.positionWC, markerDirection);
                const xy = scene.cartesianToCanvasCoordinates(point, markerPixel);
                let visible = xy && C.Cartesian3.dot(direction, scene.camera.directionWC) > 0 && xy.x >= -40 && xy.x <= container.clientWidth + 40 && xy.y >= -40 && xy.y <= container.clientHeight + 40;
                if (visible && entry.street) {
                    visible = Number.isFinite(entry.height) && distanceMeters(current, entry) < 2200 && !labelPositions.some(p => Math.abs(p.x - xy.x) < 150 && Math.abs(p.y - xy.y) < 30);
                    if (visible) labelPositions.push({ x: xy.x, y: xy.y });
                }
                if (entry.visible !== Boolean(visible)) { entry.element.style.visibility = visible ? 'visible' : 'hidden'; entry.visible = Boolean(visible); }
                if (visible) {
                    const transform = `translate(${xy.x.toFixed(1)}px,${xy.y.toFixed(1)}px) translate(-50%,-100%)`;
                    if (entry.transform !== transform) { entry.element.style.transform = transform; entry.transform = transform; }
                }
            }
        });
        const addMarker = (element, poi) => {
            element.style.position = 'absolute'; element.style.left = '0'; element.style.top = '0'; element.style.pointerEvents = 'auto';
            element.classList.add('flight-google-marker');
            const entry = { element, latitude: poi.latitude, longitude: poi.longitude, street: poi.source === 'osm-street', home: poi.source === 'home', cartographic: C.Cartographic.fromDegrees(poi.longitude, poi.latitude), sampledAt: -Infinity, revision: -1 };
            if (entry.street) element.style.pointerEvents = 'none';
            entries.add(entry); overlay.append(element); container.dataset.overlayMarkerCount = String(entries.size); scene.requestRender();
            return { remove: () => { entries.delete(entry); element.remove(); container.dataset.overlayMarkerCount = String(entries.size); if (!disposed) scene.requestRender(); } };
        };
        let streetPrimitive;
        let streetMarkers = [];
        const setStreets = roads => {
            if (disposed) return;
            streetMarkers.forEach(marker => marker.remove()); streetMarkers = [];
            if (streetPrimitive) scene.groundPrimitives.remove(streetPrimitive);
            streetPrimitive = null;
            if (roads.length) {
                streetPrimitive = scene.groundPrimitives.add(new C.GroundPolylinePrimitive({
                    geometryInstances: roads.map(road => new C.GeometryInstance({ geometry: new C.GroundPolylineGeometry({ positions: C.Cartesian3.fromDegreesArray(road.geometry.flatMap(point => [point.lon, point.lat])), width: 2 }) })),
                    appearance: new C.PolylineMaterialAppearance({ material: C.Material.fromType('Color', { color: C.Color.fromCssColorString('#fce5a0').withAlpha(.65) }) }),
                    classificationType: C.ClassificationType.CESIUM_3D_TILE,
                }));
                const names = new Set();
                for (const road of roads) {
                    if (names.has(road.name) || names.size >= 40) continue;
                    names.add(road.name);
                    const label = document.createElement('span'); label.textContent = road.name;
                    label.dataset.streetLabel = 'true';
                    label.style.cssText = 'font:600 11px/1.3 sans-serif;color:white;text-shadow:0 1px 2px #000,1px 0 2px #000,-1px 0 2px #000;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis';
                    streetMarkers.push(addMarker(label, road));
                }
            }
            container.dataset.streetCount = String(roads.length);
            scene.requestRender();
        };
        const homeElement = document.createElement('span');
        homeElement.textContent = 'H';
        homeElement.style.cssText = 'display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#facc15;color:#111827;border:3px solid white;font:900 18px/1 sans-serif;box-shadow:0 0 0 5px rgba(250,204,21,.22),0 8px 24px rgba(0,0,0,.35);pointer-events:none';
        homeElement.title = 'Punto de inicio · escuela';
        homeElement.setAttribute('aria-label', 'Punto de inicio · escuela');
        const homePosition = position => ({ ...position, source: 'home' });
        let homePin = addMarker(homeElement, homePosition(takeoff));
        const beginSelection = () => {
            if (disposed) return;
            selecting = true; candidate = null; onCandidate?.(null);
            const controller = scene.screenSpaceCameraController;
            controller.enableInputs = true; controller.enableTilt = false; controller.enableLook = false;
            scene.camera.setView({ destination: C.Cartesian3.fromDegrees(current.longitude, current.latitude, surface + 1800), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 } });
            container.dataset.selectingOrigin = 'true';
            scene.requestRender();
        };
        const cancelSelection = () => {
            selecting = false; candidate = null; candidatePin?.remove(); candidatePin = null;
            scene.screenSpaceCameraController.enableInputs = false;
            container.dataset.selectingOrigin = 'false';
            apply(current);
        };
        picker = new C.ScreenSpaceEventHandler(widget.canvas);
        picker.setInputAction(click => {
            if (!selecting) return;
            const point = scene.pickPositionSupported && scene.pickPosition(click.position);
            if (!point) { onSurfaceStatus?.('Espera a que cargue el mapa y toca una superficie visible.'); return; }
            const geographic = C.Cartographic.fromCartesian(point);
            candidate = { latitude: C.Math.toDegrees(geographic.latitude), longitude: C.Math.toDegrees(geographic.longitude) };
            const pin = homeElement.cloneNode(true); pin.textContent = '+';
            candidatePin?.remove(); candidatePin = addMarker(pin, candidate);
            onSurfaceStatus?.(''); onCandidate?.(candidate);
        }, C.ScreenSpaceEventType.LEFT_CLICK);
        const confirmSelection = async position => {
            if (position) { selecting = true; candidate = { ...position }; }
            if (!candidate) throw new Error('Elige un punto en el mapa.');
            const selected = { ...candidate };
            const height = await measure(selected);
            if (disposed || !selecting || candidate?.latitude !== selected.latitude || candidate?.longitude !== selected.longitude) throw new Error('El punto cambió. Confirma otra vez.');
            baseHeight = surfaceEnvelope(height, visibleSurface(selected)); surface = baseHeight;
            takeoff = { ...selected }; probed = null;
            homePin.remove(); homePin = addMarker(homeElement, homePosition(takeoff));
            current = { ...takeoff, altitude: 24, heading: 0 };
            cancelSelection();
            return { ...current };
        };
        setCamera(initial);
        onLoadStage?.('Afinando el entorno inicial');
        // Ground sampling alone is not readiness: wait for the actual view to
        // draw and settle before exposing controls. No fixed artificial delay.
        const firstRendered = rendered;
        await new Promise((resolve, reject) => {
            const started = performance.now();
            let stableSince;
            const aborted = () => { clearInterval(timer); reject(new DOMException('Aborted', 'AbortError')); };
            const timer = setInterval(() => {
                if (disposed || signal.aborted) { aborted(); return; }
                const now = performance.now();
                if (tileset.tilesLoaded && rendered > firstRendered) stableSince ??= now;
                else stableSince = undefined;
                if (stableSince && now - stableSince >= 400) {
                    clearInterval(timer); signal.removeEventListener('abort', aborted); resolve();
                } else if (now - started > 35000) {
                    clearInterval(timer); signal.removeEventListener('abort', aborted);
                    reject(new Error('El entorno inicial no terminó de cargar. Reintenta con una conexión estable.'));
                }
            }, 100);
            signal.addEventListener('abort', aborted, { once: true });
        });
        container.dataset.initialViewReady = 'true';
        container.dataset.engine = 'google-3d';
        return { remove, resize: () => { if (!disposed) { widget.resize(); scene.requestRender(); } }, setCamera, addMarker, setQuality, setStreets, beginSelection, cancelSelection, confirmSelection };
    } catch (error) {
        remove();
        if (error.name === 'AbortError') throw error;
        // Never forward Cesium resource errors (they include full resource URLs).
        throw new Error(/^No se pudo|^El relieve|^Este dispositivo/.test(error.message) ? error.message : 'No se pudo iniciar Google 3D. Revisa la conexión y vuelve a intentarlo.');
    }
}
