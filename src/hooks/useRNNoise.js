'use client';

import { useState, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// Feature Flag — Kill Switch for RNNoise
// Set to false to completely bypass noise suppression.
// The audio pipeline will work exactly as before.
// ═══════════════════════════════════════════════════════════════
const ENABLE_RNNOISE = true;

// Static asset paths (copied by scripts/copy-rnnoise.js)
const WORKLET_PATH = '/rnnoise/workletProcessor.js';
const WASM_PATH = '/rnnoise/rnnoise.wasm';
const WASM_SIMD_PATH = '/rnnoise/rnnoise_simd.wasm';

/**
 * useRNNoise — Isolated hook for RNNoise noise suppression.
 * 
 * Provides a single function `connectRNNoise(audioCtx, sourceNode)`
 * that ALWAYS returns an AudioNode:
 *   - If RNNoise loads OK → returns the RnnoiseWorkletNode (clean audio)
 *   - If disabled or error → returns sourceNode directly (bypass)
 * 
 * The caller (useVoiceCopilot) doesn't need any conditional logic.
 * 
 * Status exposed for UI:
 *   'idle'     — not yet initialized
 *   'disabled' — ENABLE_RNNOISE is false
 *   'loading'  — worklet + WASM loading in progress
 *   'active'   — noise suppression is processing audio
 *   'error'    — failed to load, bypassed safely
 */
export function useRNNoise() {
    const [rnnoiseStatus, setRnnoiseStatus] = useState('idle');
    const rnnoiseNodeRef = useRef(null);

    /**
     * Insert RNNoise into the audio graph.
     * @param {AudioContext} audioCtx
     * @param {AudioNode} sourceNode — the mic source node
     * @returns {AudioNode} — either rnnoiseNode or sourceNode (bypass)
     */
    const connectRNNoise = useCallback(async (audioCtx, sourceNode) => {
        if (!ENABLE_RNNOISE) {
            setRnnoiseStatus('disabled');
            console.log('[RNNoise] ⏭️ Deshabilitado por Feature Flag');
            return sourceNode;
        }

        // [PERF] Auto-disable on low-end devices to save CPU for Vosk
        // On a mid-range phone with tethering, every bit of CPU matters.
        // The external lavalier mic already captures clean audio.
        if (typeof navigator !== 'undefined') {
            const ram = navigator.deviceMemory || 8;
            const cores = navigator.hardwareConcurrency || 8;
            if (ram <= 4 || cores <= 4) {
                setRnnoiseStatus('disabled');
                console.log(`[RNNoise] ⏭️ Auto-disabled on low-end device (RAM=${ram}GB, cores=${cores})`);
                return sourceNode;
            }
        }

        try {
            setRnnoiseStatus('loading');
            console.log('[RNNoise] ⏳ Cargando worklet + WASM...');

            // Step 1: Register the AudioWorklet processor
            await audioCtx.audioWorklet.addModule(WORKLET_PATH);

            // Step 2: Load WASM binary (with SIMD detection)
            const { loadRnnoise, RnnoiseWorkletNode } = await import('@sapphi-red/web-noise-suppressor');
            const wasmBinary = await loadRnnoise({
                url: WASM_PATH,
                simdUrl: WASM_SIMD_PATH
            });

            // Step 3: Create the RNNoise worklet node
            const rnnoiseNode = new RnnoiseWorkletNode(audioCtx, {
                wasmBinary,
                maxChannels: 1
            });
            rnnoiseNodeRef.current = rnnoiseNode;

            // Step 4: Wire it into the graph
            // source → rnnoiseNode → (returned to caller for further chaining)
            sourceNode.connect(rnnoiseNode);

            setRnnoiseStatus('active');
            console.log('[RNNoise] ✅ Supresión de ruido IA activa');

            return rnnoiseNode;

        } catch (err) {
            console.error('[RNNoise] ❌ Error cargando, bypass activado:', err);
            setRnnoiseStatus('error');
            // Safe fallback — return the raw source, pipeline continues unaffected
            return sourceNode;
        }
    }, []);

    /**
     * Cleanup: disconnect and destroy the RNNoise node.
     */
    const disconnectRNNoise = useCallback(() => {
        if (rnnoiseNodeRef.current) {
            try {
                rnnoiseNodeRef.current.disconnect();
                if (typeof rnnoiseNodeRef.current.destroy === 'function') {
                    rnnoiseNodeRef.current.destroy();
                }
            } catch (e) { /* ignore */ }
            rnnoiseNodeRef.current = null;
        }
        setRnnoiseStatus('idle');
    }, []);

    return {
        rnnoiseStatus,
        connectRNNoise,
        disconnectRNNoise
    };
}
