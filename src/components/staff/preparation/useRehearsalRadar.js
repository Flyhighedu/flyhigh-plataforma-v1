'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { distanceMeters } from '@/lib/flight-rehearsal.mjs';

export default function useRehearsalRadar(flight, saved, kind = 'pois') {
    const [visible, setVisible] = useState(false);
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState('idle');
    const request = useRef(null);
    const cached = useRef(false);
    const cachedCenter = useRef(null);
    useEffect(() => () => { const pending = request.current; request.current = null; pending?.abort(); }, []);

    const search = useCallback(async () => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const center = { ...flight.current };
        setVisible(true);
        setStatus('loading');
        if (cachedCenter.current && distanceMeters(center, cachedCenter.current) > 600) { setItems([]); cached.current = false; }
        const timeout = setTimeout(() => controller.abort(), 35000);
        try {
            const response = await fetch(`/api/review-lab/map-context?kind=${kind}&lat=${center.latitude}&lng=${center.longitude}`, { signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error('Radar no disponible');
            const data = await response.json();
            if (!Array.isArray(data.items)) throw new Error('Consulta incompleta');
            const found = kind === 'streets' ? data.items : data.items.filter(poi => !saved.some(other => other.name?.trim().toLocaleLowerCase('es') === poi.name.toLocaleLowerCase('es') && distanceMeters(other, poi) < 75));
            if (request.current !== controller) return;
            cached.current = true;
            cachedCenter.current = center;
            setItems(found);
            setStatus(found.length ? 'ready' : 'empty');
        } catch {
            if (request.current === controller) setStatus('error');
        } finally {
            clearTimeout(timeout);
            if (request.current === controller) request.current = null;
        }
    }, [flight, saved, kind]);

    const toggle = useCallback(() => {
        if (visible) {
            const pending = request.current;
            request.current = null;
            pending?.abort();
            setVisible(false);
            if (status === 'loading') setStatus(cached.current ? (items.length ? 'ready' : 'empty') : 'idle');
        } else if (cached.current && distanceMeters(flight.current, cachedCenter.current) < 600) setVisible(true);
        else void search();
    }, [search, status, visible, items.length, flight]);
    useEffect(() => {
        if (kind !== 'streets' || !visible || status === 'loading' || status === 'error') return;
        const timer = setInterval(() => { if (cachedCenter.current && distanceMeters(flight.current, cachedCenter.current) > 600) void search(); }, 8000);
        return () => clearInterval(timer);
    }, [kind, visible, status, flight, search]);
    return { visible, items, status, toggle, search };
}
