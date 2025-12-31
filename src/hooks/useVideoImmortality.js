import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook "Video Immortality"
 * Garantiza que un video se reproduzca o se maneje su fallo elegantemente.
 *
 * @param {Object} videoRef - Referencia al elemento de video
 * @param {boolean} isInView - Si el elemento está visible (IntersectionObserver)
 * @returns {Object} { isPlaying, isError, attemptPlay }
 */
export function useVideoImmortality(videoRef, isInView) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isError, setIsError] = useState(false);
    const attemptRef = useRef(0);

    // Función "Fuerza Bruta" para intentar reproducir
    const attemptPlay = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            // Resetear estado de error si reintentamos
            if (video.error) {
                console.log("Re-cargando video debido a error previo...");
                video.load();
            }

            // Promesa de Play
            await video.play();
            setIsPlaying(true);
            setIsError(false);
            // console.log("Video playing successfully");
        } catch (error) {
            console.warn("Fallo de Autoplay (Intento " + attemptRef.current + "):", error.name);
            setIsPlaying(false);

            // Si es NotAllowedError (Política de Audio/Batería), no podemos hacer nada automático más que esperar interacción.
            // Si es AbortError (interrumpido por scroll), reintentamos suavemente.
            if (error.name !== 'NotAllowedError') {
                setIsError(true);
            }
        }
    }, [videoRef]);

    // Efecto: Reaccionar a Visibilidad y Estado
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isInView) {
            // Si entra en vista y no está sonando, intentar.
            if (!isPlaying) {
                attemptPlay();
            }
        } else {
            // Si sale de vista, pausar (Standard behavior)
            video.pause();
            setIsPlaying(false);
        }
    }, [isInView, attemptPlay, isPlaying, videoRef]);

    // Efecto: Watchdog para "Stalling" (Red lenta)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleWaiting = () => {
            // console.log("Video stalled/waiting...");
            // Si se queda esperando mucho, podríamos forzar un reinicio de src simple
        };

        const handlePlaying = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('pause', handlePause);

        // "Wake Up" para iOS Low Power Mode (A veces suspende la carga)
        if (isInView && video.paused && !isError) {
            const checkInterval = setInterval(() => {
                if (video.paused && video.readyState > 2) {
                    attemptPlay();
                }
            }, 2000);
            return () => clearInterval(checkInterval);
        }

        return () => {
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('pause', handlePause);
        };
    }, [isInView, isError, attemptPlay, videoRef]);

    return { isPlaying, isError, attemptPlay };
}
