'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useNarrationAudio() {
    const ref = useRef(null);
    const active = useRef(null);
    const generation = useRef(0);
    const endedHandler = useRef(null);
    const [state, setState] = useState({ id: null, status: 'idle', time: 0, duration: 0, error: '' });
    useEffect(() => {
        const audio = new Audio();
        audio.preload = 'metadata';
        ref.current = audio;
        audio.onplaying = () => setState(s => ({ ...s, status: 'playing', error: '' }));
        audio.onpause = () => { if (!audio.ended) setState(s => ({ ...s, status: 'paused' })); };
        audio.ontimeupdate = () => setState(s => ({ ...s, time: audio.currentTime }));
        audio.onloadedmetadata = () => setState(s => ({ ...s, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
        audio.onended = () => {
            setState(s => ({ ...s, status: 'ended' }));
            endedHandler.current?.();
        };
        audio.onerror = () => setState(s => ({ ...s, status: 'error', error: 'No se pudo reproducir este audio. Comprueba la conexión e intenta de nuevo.' }));
        return () => {
            // Cancel outstanding play promises, including a source changed during cleanup.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            generation.current++;
            audio.onplaying = audio.onpause = audio.ontimeupdate = audio.onloadedmetadata = audio.onended = audio.onerror = null;
            audio.pause(); audio.removeAttribute('src'); audio.load(); ref.current = null;
        };
    }, []);
    const stop = useCallback(() => {
        generation.current++;
        const audio = ref.current;
        if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
        active.current = null;
        setState({ id: null, status: 'idle', time: 0, duration: 0, error: '' });
    }, []);
    const toggle = useCallback(async item => {
        const audio = ref.current;
        if (!audio || !item.audio_url) return;
        if (active.current === item.id && !audio.paused) { audio.pause(); return; }
        const ticket = ++generation.current;
        if (active.current !== item.id || audio.error) {
            audio.pause(); audio.src = item.audio_url; audio.load(); active.current = item.id;
            setState({ id: item.id, status: 'loading', time: 0, duration: 0, error: '' });
        } else {
            if (audio.ended) audio.currentTime = 0;
            setState(s => ({ ...s, status: 'loading', error: '' }));
        }
        try { await audio.play(); }
        catch (error) {
            if (ticket === generation.current && error.name !== 'AbortError') setState(s => ({ ...s, status: 'error', error: 'No se pudo reproducir este audio. Comprueba la conexión e intenta de nuevo.' }));
        }
    }, []);
    const onEnded = useCallback(handler => { endedHandler.current = handler; }, []);
    return { ...state, toggle, stop, onEnded };
}
