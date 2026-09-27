// A separate, lazy engine for the isolated 3D preview. The existing MapLibre
// renderer is not changed, and Google's credential never enters this module.
let library;
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

export async function createGoogle3dEngine({ container, credits, visitId, initial, gimbal, signal, onError }) {
    const C = await loadCesium();
    signal.throwIfAborted();
    // Check authorization/configuration before creating a WebGL context. This
    // fetch is the only root request; Cesium consumes its already-fetched JSON.
    const rootUrl = `/api/review-lab/google-3d?visit=${encodeURIComponent(visitId)}`;
    const response = await fetch(rootUrl, { signal, cache: 'no-store' });
    const root = await response.json();
    if (!response.ok) throw new Error(root.error || 'Google 3D no está disponible.');
    signal.throwIfAborted();
    const widget = new C.CesiumWidget(container, {
        globe: false, baseLayer: false, skyBox: false, skyAtmosphere: false,
        creditContainer: credits, creditViewport: container,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
        useBrowserRecommendedResolution: true, targetFrameRate: 30,
        showRenderLoopErrors: false, contextOptions: { webgl: { antialias: false } },
    });
    const scene = widget.scene;
    scene.backgroundColor = C.Color.fromCssColorString('#b9d7e8');
    scene.screenSpaceCameraController.enableInputs = false;
    scene.postProcessStages.fxaa.enabled = false;
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
    let lastCamera;
    let lastSurface = 0;
    let sampledHeight;
    let markerCursor = 0;
    const remove = () => {
        if (disposed) return;
        disposed = true;
        signal.removeEventListener('abort', remove);
        entries.clear(); overlay.remove();
        URL.revokeObjectURL(rootBlob);
        if (!widget.isDestroyed()) widget.destroy();
    };
    signal.addEventListener('abort', remove, { once: true });
    scene.renderError.addEventListener(() => { if (!disposed) onError('El dispositivo no pudo seguir dibujando el relieve. Puedes volver al ensayo actual.'); });
    try {
        // All children are absolute same-origin URLs. A transient object URL
        // avoids requesting a second billable root; it is never persisted.
        tileset = await C.Cesium3DTileset.fromUrl(rootBlob, {
            showCreditsOnScreen: true, maximumScreenSpaceError: 12,
            cacheBytes: 96 * 1024 * 1024, maximumCacheOverflowBytes: 32 * 1024 * 1024,
            preloadWhenHidden: false, preloadFlightDestinations: false,
        });
        if (signal.aborted) { tileset.destroy(); signal.throwIfAborted(); }
        scene.primitives.add(tileset);
        tileset.tileVisible.addEventListener(() => { rendered++; container.dataset.tilesRendered = String(rendered); });
        tileset.tileFailed.addEventListener(() => { failed++; container.dataset.tileFailures = String(failed); });
        scene.camera.setView({ destination: C.Cartesian3.fromDegrees(initial.longitude, initial.latitude, 10000), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 } });
        scene.requestRender();
        if (!scene.sampleHeightSupported) throw new Error('Este dispositivo no permite calcular la posición sobre el relieve. Usa el ensayo actual.');
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
        sampledHeight = baseHeight;
        container.dataset.groundReady = 'true';
        const setCamera = state => {
            if (disposed) return;
            const now = performance.now();
            if (now - lastSurface > 250 && (!lastCamera || lastCamera.latitude !== state.latitude || lastCamera.longitude !== state.longitude)) {
                lastSurface = now;
                const height = scene.sampleHeight(C.Cartographic.fromDegrees(state.longitude, state.latitude));
                if (Number.isFinite(height)) sampledHeight = height;
            }
            lastCamera = { ...state };
            const altitude = sampledHeight + Math.max(2, state.altitude);
            scene.camera.setView({ destination: C.Cartesian3.fromDegrees(state.longitude, state.latitude, altitude), orientation: { heading: C.Math.toRadians(state.heading), pitch: C.Math.toRadians(gimbal()), roll: 0 } });
            // Diagnostics contain no coordinates or credentials.
            container.dataset.cameraHeight = (scene.camera.positionCartographic.height - sampledHeight).toFixed(2);
            container.dataset.cameraPitch = C.Math.toDegrees(scene.camera.pitch).toFixed(0);
            scene.requestRender();
        };
        scene.postRender.addEventListener(() => {
            if (disposed) return;
            const markers = [...entries];
            // Amortize optional label-height sampling, rather than ray-casting
            // hundreds of markers each frame. No sampled values are persisted.
            for (let n = 0; n < Math.min(2, markers.length); n++) {
                const entry = markers[markerCursor++ % markers.length];
                const height = scene.sampleHeight(C.Cartographic.fromDegrees(entry.longitude, entry.latitude));
                if (Number.isFinite(height)) entry.height = height;
            }
            for (const entry of markers) {
                const point = C.Cartesian3.fromDegrees(entry.longitude, entry.latitude, (entry.height ?? baseHeight) + 3);
                const direction = C.Cartesian3.subtract(point, scene.camera.positionWC, new C.Cartesian3());
                const xy = scene.cartesianToCanvasCoordinates(point);
                const visible = xy && C.Cartesian3.dot(direction, scene.camera.directionWC) > 0 && xy.x >= -40 && xy.x <= container.clientWidth + 40 && xy.y >= -40 && xy.y <= container.clientHeight + 40;
                entry.element.style.visibility = visible ? 'visible' : 'hidden';
                if (visible) entry.element.style.transform = `translate(${xy.x}px,${xy.y}px) translate(-50%,-100%)`;
            }
        });
        const addMarker = (element, poi) => {
            element.style.position = 'absolute'; element.style.left = '0'; element.style.top = '0'; element.style.pointerEvents = 'auto';
            element.classList.add('flight-google-marker');
            const entry = { element, latitude: poi.latitude, longitude: poi.longitude };
            entries.add(entry); overlay.append(element); scene.requestRender();
            return { remove: () => { entries.delete(entry); element.remove(); if (!disposed) scene.requestRender(); } };
        };
        setCamera(initial);
        container.dataset.engine = 'google-3d';
        return { remove, resize: () => { if (!disposed) { widget.resize(); scene.requestRender(); } }, setCamera, addMarker };
    } catch (error) {
        remove();
        if (error.name === 'AbortError') throw error;
        // Never forward Cesium resource errors (they include full resource URLs).
        throw new Error(/^No se pudo|^El relieve|^Este dispositivo/.test(error.message) ? error.message : 'No se pudo iniciar Google 3D. Revisa la conexión y vuelve a intentarlo.');
    }
}
