'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// useFlightAudio — Flight Audio Engine
// ═══════════════════════════════════════════════════════════════
// Manages the full audio lifecycle for flight operations:
//   1. Fetches soundtrack catalog from the server
//   2. Handles the "First Touch" to unlock AudioContext (Safari/iOS)
//   3. Crossfades between boarding ↔ in_flight music phases
//   4. Auto-ducks music when the AI Copilot is narrating
//   5. Provides a mini-player interface (play/pause/skip)
//
// Flight Phases:
//   cold     → No audio initialized (waiting for "Preparar Cabina")
//   boarding  → Boarding music playing in loop, mic OFF
//   in_flight → In-flight music playing, mic ON, ducking enabled
// ═══════════════════════════════════════════════════════════════

const CROSSFADE_DURATION_MS = 1500;
const DUCK_FADE_MS = 500;
const DUCK_VOLUME = 0.05;
const FULL_VOLUME = 1.0;

// ── Volume fade utility using requestAnimationFrame ──
function fadeVolume(audioElement, targetVolume, durationMs, onComplete) {
    if (!audioElement) {
        if (onComplete) onComplete();
        return () => {};
    }

    const startVolume = audioElement.volume;
    const delta = targetVolume - startVolume;
    if (Math.abs(delta) < 0.01) {
        audioElement.volume = targetVolume;
        if (onComplete) onComplete();
        return () => {};
    }

    const startTime = performance.now();
    let rafId = null;
    let cancelled = false;

    const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Exponential ease-out for natural audio fade
        const eased = 1 - Math.pow(1 - progress, 3);
        audioElement.volume = Math.max(0, Math.min(1, startVolume + delta * eased));

        if (progress < 1) {
            rafId = requestAnimationFrame(tick);
        } else {
            audioElement.volume = targetVolume;
            if (onComplete) onComplete();
        }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
        cancelled = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
    };
}

export default function useFlightAudio({ copilotVoiceState = 'off' } = {}) {
    // ── State ──
    const [flightPhase, setFlightPhase] = useState('cold'); // cold | boarding | in_flight
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [soundtracks, setSoundtracks] = useState({ boarding: [], inFlight: [] });
    const [soundtracksLoaded, setSoundtracksLoaded] = useState(false);

    // ── Refs ──
    const boardingAudioRef = useRef(null);
    const flightAudioRef = useRef(null);
    const boardingIndexRef = useRef(0);
    const flightIndexRef = useRef(0);
    const fadeCleanupRef = useRef(null);
    const duckCleanupRef = useRef(null);
    const phaseRef = useRef('cold');
    const isDuckedRef = useRef(false);

    useEffect(() => { phaseRef.current = flightPhase; }, [flightPhase]);

    // ── Fetch soundtracks on mount ──
    useEffect(() => {
        let cancelled = false;

        const fetchTracks = async () => {
            try {
                const res = await fetch('/api/official-soundtracks-audio');
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setSoundtracks({
                        boarding: data.boarding || [],
                        inFlight: data.inFlight || []
                    });
                    setSoundtracksLoaded(true);
                }
            } catch (err) {
                console.warn('[FlightAudio] Failed to fetch soundtracks:', err);
            }
        };

        fetchTracks();
        return () => { cancelled = true; };
    }, []);

    // ── Helper: Get active audio element for current phase ──
    const getActiveAudio = useCallback(() => {
        if (phaseRef.current === 'in_flight') return flightAudioRef.current;
        if (phaseRef.current === 'boarding') return boardingAudioRef.current;
        return null;
    }, []);

    // ── Helper: Create and configure an <audio> element ──
    const createAudioElement = useCallback((track, loop = true) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.loop = loop;
        audio.volume = 0;
        audio.src = track.public_url;
        return audio;
    }, []);

    // ── Helper: Pick next track from a playlist (sequential) ──
    const getNextBoardingTrack = useCallback(() => {
        if (!soundtracks.boarding.length) return null;
        const idx = boardingIndexRef.current % soundtracks.boarding.length;
        boardingIndexRef.current = idx + 1;
        return soundtracks.boarding[idx];
    }, [soundtracks.boarding]);

    const getNextFlightTrack = useCallback(() => {
        if (!soundtracks.inFlight.length) return null;
        const idx = flightIndexRef.current % soundtracks.inFlight.length;
        flightIndexRef.current = idx + 1;
        return soundtracks.inFlight[idx];
    }, [soundtracks.inFlight]);

    // ══════════════════════════════════════════════════════
    // prepareCabin() — FIRST TOUCH (must be called from onClick)
    // ══════════════════════════════════════════════════════
    const prepareCabin = useCallback(() => {
        if (phaseRef.current !== 'cold') return true;
        if (!soundtracks.boarding.length) {
            console.warn('[FlightAudio] No boarding tracks available');
            setFlightPhase('boarding'); // Allow phase transition even without music
            return true;
        }

        const track = getNextBoardingTrack();
        if (!track) return false;

        setIsLoading(true);
        setHasError(false);

        // Create audio SYNCHRONOUSLY inside the click handler (Safari requirement)
        const audio = createAudioElement(track, false);

        audio.oncanplaythrough = () => {
            setIsLoading(false);
        };

        audio.onended = () => {
            // Auto-advance to next boarding track
            if (phaseRef.current === 'boarding' && soundtracks.boarding.length > 1) {
                const nextTrack = getNextBoardingTrack();
                if (nextTrack) {
                    audio.load(); // Release previous decode buffer
                    audio.src = nextTrack.public_url;
                    audio.play().catch(() => {});
                    setCurrentTrack(nextTrack);
                }
            } else if (phaseRef.current === 'boarding') {
                // Single track: loop manually
                audio.currentTime = 0;
                audio.play().catch(() => {});
            }
        };

        audio.onerror = () => {
            setIsLoading(false);
            setHasError(true);
            console.warn('[FlightAudio] Boarding audio load error');
        };

        // CRITICAL: play() must be called synchronously from onClick
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    fadeVolume(audio, FULL_VOLUME, 800);
                    setIsPlaying(true);
                    setIsLoading(false);
                })
                .catch((err) => {
                    console.warn('[FlightAudio] Boarding play blocked:', err);
                    setHasError(true);
                    setIsLoading(false);
                });
        }

        boardingAudioRef.current = audio;
        setCurrentTrack(track);
        setFlightPhase('boarding');
        return true;
    }, [soundtracks.boarding, getNextBoardingTrack, createAudioElement]);

    // ══════════════════════════════════════════════════════
    // transitionToFlight() — Crossfade boarding → in_flight
    // ══════════════════════════════════════════════════════
    const transitionToFlight = useCallback(() => {
        if (phaseRef.current === 'in_flight') return;

        // Cancel any ongoing fade
        if (fadeCleanupRef.current) fadeCleanupRef.current();

        const track = getNextFlightTrack();
        if (!track) {
            // No in_flight tracks — just change phase
            setFlightPhase('in_flight');
            return;
        }

        // Create in-flight audio
        const flightAudio = createAudioElement(track, false);

        flightAudio.onended = () => {
            if (phaseRef.current === 'in_flight' && soundtracks.inFlight.length > 1) {
                const nextTrack = getNextFlightTrack();
                if (nextTrack) {
                    flightAudio.load(); // Release previous decode buffer
                    flightAudio.src = nextTrack.public_url;
                    flightAudio.play().catch(() => {});
                    setCurrentTrack(nextTrack);
                }
            } else if (phaseRef.current === 'in_flight') {
                flightAudio.currentTime = 0;
                flightAudio.play().catch(() => {});
            }
        };

        flightAudio.onerror = () => {
            console.warn('[FlightAudio] In-flight audio load error');
        };

        // Start playing in-flight audio at volume 0
        flightAudio.play()
            .then(() => {
                // Crossfade: fade out boarding, fade in flight
                const cleanup1 = fadeVolume(boardingAudioRef.current, 0, CROSSFADE_DURATION_MS, () => {
                    boardingAudioRef.current?.pause();
                });
                const cleanup2 = fadeVolume(flightAudio, isDuckedRef.current ? DUCK_VOLUME : FULL_VOLUME, CROSSFADE_DURATION_MS);

                fadeCleanupRef.current = () => {
                    cleanup1();
                    cleanup2();
                };
            })
            .catch((err) => {
                console.warn('[FlightAudio] In-flight play failed:', err);
            });

        flightAudioRef.current = flightAudio;
        setCurrentTrack(track);
        setFlightPhase('in_flight');
        setIsPlaying(true);
    }, [soundtracks.inFlight, getNextFlightTrack, createAudioElement]);

    // ══════════════════════════════════════════════════════
    // transitionToBoarding() — Crossfade in_flight → boarding
    // ══════════════════════════════════════════════════════
    const transitionToBoarding = useCallback(() => {
        if (phaseRef.current === 'boarding') return;

        if (fadeCleanupRef.current) fadeCleanupRef.current();
        if (duckCleanupRef.current) duckCleanupRef.current();
        isDuckedRef.current = false;

        const track = getNextBoardingTrack();
        
        if (!track) {
            // No boarding tracks — just stop flight audio and change phase
            if (flightAudioRef.current) {
                fadeVolume(flightAudioRef.current, 0, CROSSFADE_DURATION_MS, () => {
                    flightAudioRef.current?.pause();
                    flightAudioRef.current = null;
                });
            }
            setFlightPhase('boarding');
            setCurrentTrack(null);
            return;
        }

        // Reuse existing boarding audio or create new
        let boardingAudio = boardingAudioRef.current;
        if (!boardingAudio || !boardingAudio.src) {
            boardingAudio = createAudioElement(track, false);
            boardingAudioRef.current = boardingAudio;
        } else {
            boardingAudio.src = track.public_url;
        }

        boardingAudio.volume = 0;
        boardingAudio.onended = () => {
            if (phaseRef.current === 'boarding') {
                const nextTrack = getNextBoardingTrack();
                if (nextTrack) {
                    boardingAudio.load(); // Release previous decode buffer
                    boardingAudio.src = nextTrack.public_url;
                    boardingAudio.play().catch(() => {});
                    setCurrentTrack(nextTrack);
                } else {
                    boardingAudio.currentTime = 0;
                    boardingAudio.play().catch(() => {});
                }
            }
        };

        boardingAudio.play()
            .then(() => {
                // Crossfade: fade out flight, fade in boarding
                const cleanup1 = fadeVolume(flightAudioRef.current, 0, CROSSFADE_DURATION_MS, () => {
                    flightAudioRef.current?.pause();
                    flightAudioRef.current = null;
                });
                const cleanup2 = fadeVolume(boardingAudio, FULL_VOLUME, CROSSFADE_DURATION_MS);

                fadeCleanupRef.current = () => {
                    cleanup1();
                    cleanup2();
                };
            })
            .catch((err) => {
                console.warn('[FlightAudio] Boarding resume failed:', err);
            });

        setCurrentTrack(track);
        setFlightPhase('boarding');
        setIsPlaying(true);
    }, [getNextBoardingTrack, createAudioElement]);

    // ══════════════════════════════════════════════════════
    // shutdown() — Stop all audio and cleanup
    // ══════════════════════════════════════════════════════
    const shutdown = useCallback(() => {
        if (fadeCleanupRef.current) fadeCleanupRef.current();
        if (duckCleanupRef.current) duckCleanupRef.current();

        [boardingAudioRef, flightAudioRef].forEach(ref => {
            if (ref.current) {
                try {
                    ref.current.pause();
                    ref.current.src = '';
                    ref.current.load(); // Release resources
                } catch (e) { /* ignore */ }
                ref.current = null;
            }
        });

        isDuckedRef.current = false;
        setFlightPhase('cold');
        setCurrentTrack(null);
        setIsPlaying(false);
        setIsLoading(false);
        setHasError(false);
    }, []);

    // ══════════════════════════════════════════════════════
    // Auto-Ducking — React to copilot voice state
    // ══════════════════════════════════════════════════════
    useEffect(() => {
        if (phaseRef.current !== 'in_flight') return;

        const activeAudio = flightAudioRef.current;
        if (!activeAudio) return;

        if (copilotVoiceState === 'playing') {
            // Duck: lower volume to 20%
            if (!isDuckedRef.current) {
                isDuckedRef.current = true;
                if (duckCleanupRef.current) duckCleanupRef.current();
                duckCleanupRef.current = fadeVolume(activeAudio, DUCK_VOLUME, DUCK_FADE_MS);
            }
        } else {
            // Unduck: restore to 100%
            if (isDuckedRef.current) {
                isDuckedRef.current = false;
                if (duckCleanupRef.current) duckCleanupRef.current();
                duckCleanupRef.current = fadeVolume(activeAudio, FULL_VOLUME, DUCK_FADE_MS);
            }
        }
    }, [copilotVoiceState]);

    // ══════════════════════════════════════════════════════
    // Manual Controls (Mini-Player Plan B)
    // ══════════════════════════════════════════════════════
    const togglePlayPause = useCallback(() => {
        const audio = getActiveAudio();
        if (!audio) return;

        if (audio.paused) {
            audio.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    }, [getActiveAudio]);

    const skipTrack = useCallback(() => {
        const audio = getActiveAudio();
        if (!audio) return;

        let nextTrack;
        if (phaseRef.current === 'boarding') {
            nextTrack = getNextBoardingTrack();
        } else if (phaseRef.current === 'in_flight') {
            nextTrack = getNextFlightTrack();
        }

        if (nextTrack) {
            audio.load(); // Release previous decode buffer
            audio.src = nextTrack.public_url;
            audio.play().catch(() => {});
            setCurrentTrack(nextTrack);
        }
    }, [getActiveAudio, getNextBoardingTrack, getNextFlightTrack]);

    // ── Cleanup on unmount ──
    useEffect(() => {
        return () => {
            if (fadeCleanupRef.current) fadeCleanupRef.current();
            if (duckCleanupRef.current) duckCleanupRef.current();

            [boardingAudioRef, flightAudioRef].forEach(ref => {
                if (ref.current) {
                    try {
                        ref.current.pause();
                        ref.current.src = '';
                        ref.current.load();
                    } catch (e) { /* ignore */ }
                    ref.current = null;
                }
            });
        };
    }, []);

    return {
        // ── State ──
        flightPhase,        // 'cold' | 'boarding' | 'in_flight'
        currentTrack,       // { id, title, artist, public_url } | null
        isPlaying,
        isLoading,
        hasError,
        soundtracksLoaded,
        hasSoundtracks: soundtracks.boarding.length > 0 || soundtracks.inFlight.length > 0,

        // ── Phase Transitions ──
        prepareCabin,       // Must be called from onClick (First Touch)
        transitionToFlight, // Crossfade boarding → in_flight
        transitionToBoarding, // Crossfade in_flight → boarding
        shutdown,           // Stop everything

        // ── Manual Controls (Mini-Player) ──
        togglePlayPause,
        skipTrack,
    };
}
