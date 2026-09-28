'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import NarrationMapSearch from '@/components/shared/NarrationMapSearch';
import styles from './FlightRehearsalScreen.module.css';
import 'leaflet/dist/leaflet.css';

export default function TakeoffMap({ initial, onConfirm, onCancel, busy = false, error = '', purpose = 'takeoff', schoolName = '' }) {
    const host = useRef(null), map = useRef(null), locationTicket = useRef(0);
    const initialRef = useRef(initial);
    const [point, setPoint] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [notice, setNotice] = useState('');
    const [locating, setLocating] = useState(false);
    const [chosen, setChosen] = useState(!!initial);
    const observer = useRef(null);
    const locate = () => {
        if (!window.isSecureContext || !navigator.geolocation) { setNotice('Este enlace HTTP no permite usar el GPS. Puedes elegir el punto moviendo el mapa.'); return; }
        const ticket = ++locationTicket.current;
        setLocating(true); setNotice('');
        navigator.geolocation.getCurrentPosition(position => {
            if (ticket !== locationTicket.current || !map.current) return;
            setLocating(false);
            map.current.setView([position.coords.latitude, position.coords.longitude], 17);
            setChosen(true);
            setNotice(`Ubicación aproximada · precisión ${Math.round(position.coords.accuracy)} m`);
        }, () => { if (ticket === locationTicket.current) { setLocating(false); setNotice('No pudimos obtener tu ubicación. Elige el punto en el mapa.'); } }, { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true });
    };
    useEffect(() => {
        let disposed = false;
        if (purpose === 'takeoff') void import('./google3dEngine').then(module => module.preloadGoogle3d()).catch(() => {});
        import('leaflet').then(module => {
            if (disposed) return;
            const L = module.default || module;
            const start = initialRef.current || { latitude: 19.4169, longitude: -102.0555 };
            const instance = L.map(host.current, { zoomControl: true, dragging: true, touchZoom: true, doubleClickZoom: true, scrollWheelZoom: true, zoomAnimation: false }).setView([start.latitude, start.longitude], 16);
            map.current = instance;
            const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
            tiles.on('tileload', () => { if (!disposed) setLoaded(true); });
            tiles.on('tileerror', () => { if (!disposed) setNotice('Algunas partes del mapa no cargaron. Comprueba tu conexión.'); });
            const update = () => { if (disposed || !host.current) return; const p = instance.getCenter(); setPoint({ latitude: p.lat, longitude: p.lng }); host.current.dataset.center = `${p.lat},${p.lng}`; host.current.dataset.zoom = String(instance.getZoom()); };
            instance.on('moveend', update); instance.on('dragend zoomend', () => setChosen(true)); instance.on('click', event => { instance.panTo(event.latlng); setChosen(true); }); update();
            observer.current = new ResizeObserver(() => instance.invalidateSize()); observer.current.observe(host.current);
        }).catch(() => setNotice('No se pudo cargar el selector. Vuelve a intentarlo.'));
        return () => {
            disposed = true;
            // Invalidate callbacks from an outstanding geolocation request.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            locationTicket.current++;
            observer.current?.disconnect();
            map.current?.remove(); map.current = null;
        };
    }, [purpose]);
    return <section className={styles.takeoffMap} aria-label={purpose === 'school' ? 'Ubicar escuela' : 'Mapa de despegue'} onPointerDown={e => e.stopPropagation()}>
        <div ref={host} className={styles.takeoffCanvas} />
        <div className={styles.takeoffCrosshair} aria-hidden="true"><MapPin size={32} fill="#06b6d4" /></div>
        <div className={styles.locationSearch}><NarrationMapSearch onSelect={place => { map.current?.setView([place.lat, place.lng], 17); setChosen(true); }} onLocate={locate}/></div>
        <div className={styles.takeoffHeading}><strong>{purpose === 'school' ? schoolName || 'Ubica la escuela' : 'Elige dónde despegar'}</strong><small>{purpose === 'school' ? 'Coloca la escuela bajo el marcador' : 'Coloca el despegue bajo el marcador'}</small></div>
        <div className={styles.takeoffConfirm}>
            {(error || notice || locating) && <p role="status">{error || (locating ? "Buscando tu ubicación…" : notice)}</p>}
            <div>{onCancel && <button disabled={busy} onClick={onCancel}>Volver</button>}<button disabled={!loaded || !point || !chosen || busy || locating} onClick={() => onConfirm(point)}>{busy ? 'Guardando…' : !loaded ? 'Cargando mapa…' : purpose === 'school' ? 'Usar esta ubicación' : 'Despegar aquí'}</button></div>
        </div>
    </section>;
}
