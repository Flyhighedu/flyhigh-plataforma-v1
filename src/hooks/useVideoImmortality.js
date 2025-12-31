import { useState, useEffect, useRef, useCallback } from 'react';

export const useVideoImmortality = (videoRef) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false); // Play blocked by policy (Low Power Mode)
    const [isStalled, setIsStalled] = useState(false); // Network stall
    const retryCount = useRef(0);
    const MAX_RETRIES = 3;

    // Intentar reproducir de forma segura
    const attemptPlay = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            // Reset flags
            setIsBlocked(false);

            await video.play();
            setIsPlaying(true);
            setIsStalled(false);
            // console.log("Video Immortality: Play Success");
        } catch (error) {
            console.warn("Video Immortality: Play Failed", error.name);

            if (error.name === 'NotAllowedError') {
                // Bloqueado por política (Low Power Mode o falta de interacción)
                setIsBlocked(true);
            } else if (error.name === 'AbortError') {
                // Interrumpido por otro load
            } else {
                // Otro error (búfer, formato)
                setIsStalled(true);
            }
        }
    }, [videoRef]);

    // Recuperación de red (Network Wake-Up)
    const wakeUpNetwork = useCallback(() => {
        const video = videoRef.current;
        if (!video || retryCount.current >= MAX_RETRIES) return;

        console.log("Video Immortality: Waking up network...");
        const currentTime = video.currentTime;
        // Truco: Reasignar src fuerza al navegador a reiniciar el buffer
        const currentSrc = video.currentSrc || video.src;
        video.src = currentSrc;
        video.load();
        video.currentTime = currentTime;
        retryCount.current++;
        attemptPlay();
    }, [attemptPlay, videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Auto-Play al montar (Intento inicial)
        attemptPlay();

        // Listeners de estado
        const handlePlaying = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleStalled = () => {
            console.warn("Video Immortality: Stalled detected");
            setIsStalled(true);
            // Intentar revivir si lleva mucho tiempo
            setTimeout(() => {
                if (video.networkState === 2) { // NETWORK_LOADING
                    // Esperar un poco mas
                } else {
                    wakeUpNetwork();
                }
            }, 2000);
        };

        video.addEventListener('playing', handlePlaying);
        video.addEventListener('pause', handlePause);
        video.addEventListener('stalled', handleStalled);
        video.addEventListener('waiting', handleStalled);

        // Global Interaction Unlock (Capa 2)
        // Si estamos bloqueados, cualquier toque en la pantalla debería intentar desbloquear
        const handleGlobalInteraction = () => {
            if (isBlocked || !isPlaying) {
                attemptPlay();
            }
        };

        window.addEventListener('touchstart', handleGlobalInteraction, { passive: true });
        window.addEventListener('click', handleGlobalInteraction, { passive: true });

        return () => {
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('stalled', handleStalled);
            video.removeEventListener('waiting', handleStalled);
            window.removeEventListener('touchstart', handleGlobalInteraction);
            window.removeEventListener('click', handleGlobalInteraction);
        };
    }, [videoRef, attemptPlay, isBlocked, isPlaying, wakeUpNetwork]);

    return {
        isPlaying,
        isBlocked,
        isStalled,
        forcePlay: attemptPlay // Método expuesto para el botón de rescate
    };
};
