'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Navigation, Search, X } from 'lucide-react';
import styles from './NarrationLibrary.module.css';
export default function NarrationMapSearch({ onSelect, onLocate }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const request = useRef(null);
    useEffect(() => () => request.current?.abort(), []);
    async function search(event) {
        event.preventDefault();
        request.current?.abort();
        const controller = new AbortController(); request.current = controller;
        setBusy(true); setError(''); setResults([]);
        try {
            const response = await fetch('/api/staff/map-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'place-search', query: query.trim() }), signal: controller.signal });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo buscar la zona.');
            setResults(data.locations || []);
            if (!data.locations?.length) setError('No encontramos ese lugar. Prueba con el nombre de la ciudad.');
        } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
        finally { if (!controller.signal.aborted) setBusy(false); }
    }
    return <div className={styles.mapSearch}><form onSubmit={search} className={styles.searchRow}><label className={styles.search}><Search size={18}/><input aria-label="Buscar ciudad o lugar" placeholder="Ciudad o lugar" value={query} onChange={event => setQuery(event.target.value)} maxLength={160}/></label><button className={styles.secondary} type="submit" aria-label="Buscar lugar" disabled={busy || query.trim().length < 3}>{busy ? <Loader2 size={18} className={styles.spin}/> : <Search size={18}/>}</button><button className={styles.secondary} type="button" aria-label="Mi ubicación" onClick={onLocate}><Navigation size={18}/></button></form>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {!!results.length && <div className={styles.mapResults}><button className={styles.secondary} onClick={() => setResults([])} aria-label="Cerrar resultados"><X size={18}/></button>{results.map(item => <button key={item.id} onClick={() => { onSelect(item); setQuery(item.name.split(',')[0]); setResults([]); }}>{item.name}</button>)}</div>}
    </div>;
}
