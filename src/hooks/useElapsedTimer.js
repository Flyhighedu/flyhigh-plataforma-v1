'use client';

// ═══════════════════════════════════════════════════════════════
// useElapsedTimer — Self-ticking elapsed time hook
// ═══════════════════════════════════════════════════════════════
// This hook returns the elapsed seconds since `startMs`.
// It ticks internally every second and only re-renders the
// component where it's called — NOT the entire parent tree.
//
// This was created to solve the #1 performance problem:
// StaffOperationLegacy (2035 lines) was re-rendering every
// second because of a global setNowMs(Date.now()) state update.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';

/**
 * @param {number} startMs - Epoch ms when the timer started (0 = inactive)
 * @param {boolean} active - Whether the timer should be ticking (default true)
 * @returns {number} elapsed seconds since startMs (0 if inactive)
 */
export default function useElapsedTimer(startMs, active = true) {
    const [elapsed, setElapsed] = useState(() => {
        if (!startMs || startMs <= 0 || !active) return 0;
        return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    });

    const startMsRef = useRef(startMs);
    const activeRef = useRef(active);

    // Keep refs in sync
    useEffect(() => { startMsRef.current = startMs; }, [startMs]);
    useEffect(() => { activeRef.current = active; }, [active]);

    useEffect(() => {
        if (!startMs || startMs <= 0 || !active) {
            setElapsed(0);
            return;
        }

        // Compute immediately
        setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));

        const id = setInterval(() => {
            if (startMsRef.current > 0 && activeRef.current) {
                setElapsed(Math.max(0, Math.floor((Date.now() - startMsRef.current) / 1000)));
            }
        }, 1000);

        return () => clearInterval(id);
    }, [startMs, active]);

    return elapsed;
}
