'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildCulturalPoiQuery, parseCulturalPois, radarBounds } from '@/lib/cultural-pois.mjs';

export default function useRehearsalRadar(flight, saved) {
    const [visible, setVisible] = useState(false);
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState('idle');
    const request = useRef(null);
    const cached = useRef(false);
    useEffect(() => () => { const pending = request.current; request.current = null; pending?.abort(); }, []);

    const search = useCallback(async () => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const center = { ...flight.current };
        setVisible(true);
        setStatus('loading');
        const timeout = setTimeout(() => controller.abort(), 25000);
        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST', body: new URLSearchParams({ data: buildCulturalPoiQuery(radarBounds(center)) }), signal: controller.signal,
            });
            if (!response.ok) throw new Error('Radar no disponible');
            const data = await response.json();
            if (data.remark) throw new Error('Consulta incompleta');
            const found = parseCulturalPois(data.elements, center, saved);
            if (request.current !== controller) return;
            cached.current = true;
            setItems(found);
            setStatus(found.length ? 'ready' : 'empty');
        } catch {
            if (request.current === controller) setStatus('error');
        } finally {
            clearTimeout(timeout);
            if (request.current === controller) request.current = null;
        }
    }, [flight, saved]);

    const toggle = useCallback(() => {
        if (visible) {
            const pending = request.current;
            request.current = null;
            pending?.abort();
            setVisible(false);
            if (status === 'loading') setStatus(cached.current ? (items.length ? 'ready' : 'empty') : 'idle');
        } else if (cached.current) setVisible(true);
        else void search();
    }, [search, status, visible, items.length]);
    return { visible, items, status, toggle, search };
}
