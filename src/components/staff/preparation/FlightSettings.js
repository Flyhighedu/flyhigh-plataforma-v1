'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';
import { DEFAULT_PROFILES, FLIGHT_MODES, TUNING_FIELDS } from '@/lib/flight-cockpit.mjs';
import styles from './FlightRehearsalScreen.module.css';

export default function FlightSettings({ profiles, setProfiles, activeMode, ceiling, setCeiling, quality, setQuality, onClose }) {
    const dialog = useRef(null);
    const [page, setPage] = useState('control');
    const [mode, setMode] = useState(activeMode);
    useEffect(() => { dialog.current.showModal(); }, []);
    const profile = profiles[mode];
    const modeLabel = FLIGHT_MODES.find(item => item.id === mode).label;
    const change = (key, value) => setProfiles(previous => ({ ...previous, [mode]: { ...previous[mode], [key]: Number(value) } }));
    return <dialog ref={dialog} className={styles.settings} onCancel={onClose} onClose={onClose} aria-labelledby="flight-settings-title" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className={styles.settingsBody}>
            <header>{page === 'tuning' && <button onClick={() => setPage('control')} aria-label="Volver a Control"><ArrowLeft size={18} /></button>}<h2 id="flight-settings-title">{page === 'tuning' ? 'Ajustes de ganancia y Expo' : 'Ajustes del ensayo'}</h2><button onClick={onClose} aria-label="Cerrar ajustes"><X size={20} /></button></header>
            <p className={styles.modelCaption}>Referencia: DJI Air 3S · RC 2</p>
            {page !== 'tuning' && <nav className={styles.settingsTabs} aria-label="Secciones de ajustes">{[['safety', 'Seguridad'], ['control', 'Control'], ['image', 'Imagen']].map(([id, label]) => <button key={id} aria-pressed={page === id} onClick={() => setPage(id)}>{label}</button>)}</nav>}
            {page === 'control' && <section>
                <button className={styles.settingsEntry} onClick={() => setPage('tuning')}><span><strong>Ajustes de ganancia y Expo</strong><small>Aeronave, respuesta de los sticks y gimbal</small></span><ChevronRight size={20} /></button>
                <p className={styles.modelCaption}>Modo 3 · Izquierda: avance y traslación. Derecha: altura y giro.</p>
            </section>}
            {page === 'tuning' && <>
                <nav className={styles.settingsTabs} aria-label="Perfil de vuelo que se está editando">{FLIGHT_MODES.map(item => <button key={item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}</nav>
                <small>Editando {modeLabel} · Modo de vuelo activo: {FLIGHT_MODES.find(item => item.id === activeMode).label}</small>
                {['Aeronave', 'Expo', 'Gimbal'].map(group => <fieldset key={group}><legend>{group}</legend>{TUNING_FIELDS.filter(field => field.group === group).map(field => <label className={styles.tuningRow} key={field.key}>
                    <span>{field.label}</span><output>{profile[field.key].toFixed(field.step < .1 ? 2 : field.step < 1 ? 1 : 0)}{field.unit && ` ${field.unit}`}</output>
                    <input aria-label={field.label} data-tuning-field={field.key} type="range" min={field.min} max={field.max} step={field.step} value={profile[field.key]} onChange={event => change(field.key, event.target.value)} />
                </label>)}</fieldset>)}
                <button className={styles.resetProfile} onClick={() => setProfiles(previous => ({ ...previous, [mode]: { ...DEFAULT_PROFILES[mode] } }))}>Restablecer {modeLabel}</button>
                <small>Perfiles independientes durante este ensayo. Respuesta simulada y valores iniciales propios; no modifica el dron ni replica su firmware.</small>
            </>}
            {page === 'safety' && <fieldset><legend>Altura máxima virtual</legend><label>Límite del ensayo<select aria-label="Altura máxima virtual" value={ceiling} onChange={e => setCeiling(Number(e.target.value))}><option value={120}>120 m</option><option value={300}>300 m</option><option value={500}>500 m</option></select></label><small>Altura respecto al despegue. Solo simulación; no cambia límites ni autoriza vuelos de un dron real. La protección de la malla tiene prioridad.</small></fieldset>}
            {page === 'image' && <fieldset><legend>Imagen</legend><label>Calidad<select aria-label="Calidad del relieve" value={quality} onChange={e => setQuality(e.target.value)}><option value="high">Alta</option><option value="balanced">Equilibrada</option></select></label><small>Alta pide más detalle y usa más memoria y datos. No añade detalle que Google no tenga en esta zona.</small></fieldset>}
        </div>
    </dialog>;
}
