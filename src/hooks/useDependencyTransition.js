'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// =====================================================
// useDependencyTransition — Central state manager for
// the DependencyTransitionOverlay.
//
// Guarantees:
// - Visible duration stays in UX target window
// - External events are queued (no silent drops)
// - Fast duplicate payloads are de-duped
// =====================================================

const OVERLAY_DURATION_MS = 2500;
const EXIT_BUFFER_MS = 220;
const DEDUPE_WINDOW_MS = 2700;

function buildPayloadKey(data) {
    if (!data) return '';

    return String(
        data.transitionKey ||
        `${data.triggerName || ''}|${data.triggerRole || ''}|${data.actionText || ''}|${data.nextPhaseText || ''}|${data.hasEvidence ? 1 : 0}`
    );
}

export default function useDependencyTransition() {
    const [overlayData, setOverlayData] = useState(null);

    const queueRef = useRef([]);
    const isShowingRef = useRef(false);
    const timerRef = useRef(null);
    const afterExitTimerRef = useRef(null);
    const lastShownMapRef = useRef(new Map());

    const clearTimers = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (afterExitTimerRef.current) {
            clearTimeout(afterExitTimerRef.current);
            afterExitTimerRef.current = null;
        }
    }, []);

    const processQueue = useCallback(function runQueue() {
        if (isShowingRef.current) return;

        const next = queueRef.current.shift();
        if (!next) return;

        isShowingRef.current = true;
        setOverlayData(next);

        timerRef.current = setTimeout(() => {
            setOverlayData(null);

            afterExitTimerRef.current = setTimeout(() => {
                isShowingRef.current = false;
                runQueue();
            }, EXIT_BUFFER_MS);
        }, OVERLAY_DURATION_MS);
    }, []);

    const triggerTransition = useCallback((payload) => {
        if (!payload) return false;

        const key = buildPayloadKey(payload);
        if (!key) return false;

        const now = Date.now();
        const lastShownAt = lastShownMapRef.current.get(key) || 0;
        if (now - lastShownAt < DEDUPE_WINDOW_MS) {
            return false;
        }

        lastShownMapRef.current.set(key, now);

        queueRef.current.push({ ...payload, transitionKey: key });
        processQueue();
        return true;
    }, [processQueue]);

    const dismissOverlay = useCallback(() => {
        clearTimers();
        queueRef.current = [];
        isShowingRef.current = false;
        setOverlayData(null);
    }, [clearTimers]);

    useEffect(() => () => {
        clearTimers();
    }, [clearTimers]);

    return {
        overlayData,
        triggerTransition,
        dismissOverlay,
        isVisible: overlayData !== null,
        OVERLAY_DURATION_MS
    };
}
