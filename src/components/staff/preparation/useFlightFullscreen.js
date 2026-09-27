'use client';

import { useCallback, useEffect, useState } from 'react';

export default function useFlightFullscreen(screenRef) {
    const [fullscreen, setFullscreen] = useState(false);
    const [notice, setNotice] = useState('');
    useEffect(() => {
        const changed = () => {
            const active = document.fullscreenElement === screenRef.current;
            setFullscreen(active);
            if (!active) { window.screen.orientation?.unlock?.(); setNotice(''); }
        };
        document.addEventListener('fullscreenchange', changed);
        return () => { document.removeEventListener('fullscreenchange', changed); window.screen.orientation?.unlock?.(); };
    }, [screenRef]);
    const toggle = useCallback(async () => {
        setNotice('');
        if (document.fullscreenElement) { await document.exitFullscreen(); return; }
        if (!screenRef.current?.requestFullscreen) {
            setNotice('Este navegador no permite pantalla completa. Gira el celular para usar la vista horizontal.');
            return;
        }
        try {
            await screenRef.current.requestFullscreen({ navigationUI: 'hide' });
            try { await window.screen.orientation.lock('landscape'); }
            catch { if (window.innerHeight > window.innerWidth) setNotice('Gira el celular para ver el ensayo en horizontal.'); }
        } catch {
            setNotice('El navegador no permitió pantalla completa. Puedes continuar y girar el celular.');
        }
    }, [screenRef]);
    return { fullscreen, notice, toggle };
}
