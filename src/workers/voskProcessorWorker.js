import { createModel } from 'vosk-browser';

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
const VOSK_SAMPLE_RATE = 16000;
const AMNESIA_INTERVAL_MS = 30000; // [PERF FIX] 30s gives Vosk more acoustic context (was 10s)

// ═══════════════════════════════════════════════════════════════
// ESTADO (mínimo)
// ═══════════════════════════════════════════════════════════════
let model = null;
let recognizer = null;
let nativeSampleRate = 48000;
let voskSampleRate = VOSK_SAMPLE_RATE;
let amnesiaTimer = null;
let running = false;
let directPort = null; // [PERF] MessagePort from AudioWorklet — bypasses main thread

// ═══════════════════════════════════════════════════════════════
// DOWNSAMPLER (48kHz → 16kHz)
// ═══════════════════════════════════════════════════════════════
function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) return buffer;
    if (inputSampleRate < outputSampleRate) return buffer;
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════
// RECREAR RECOGNIZER (limpieza total, sin arrastrar nada)
// ═══════════════════════════════════════════════════════════════
function recreateRecognizer() {
    if (!model) return;

    // Liberar el recognizer anterior (memoria WASM)
    if (recognizer) {
        try { recognizer.remove(); } catch (e) {
            console.warn('[Vosk] Error al liberar recognizer anterior:', e.message);
        }
        recognizer = null;
    }

    // Crear uno nuevo, completamente limpio
    recognizer = new model.KaldiRecognizer(voskSampleRate);
    recognizer.setWords(true);

    // Eventos: simplemente reenviar al hilo principal
    recognizer.on('result', (message) => {
        const text = message.result?.text || '';
        if (text) {
            self.postMessage({ type: 'final', result: message.result });
        }
    });

    recognizer.on('partialresult', (message) => {
        const text = message.result?.partial || '';
        if (text) {
            self.postMessage({ type: 'partial', result: message.result });
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// AMNESIA: reseteo limpio cada 10 segundos
// ═══════════════════════════════════════════════════════════════
function startAmnesiaTimer() {
    clearInterval(amnesiaTimer);
    amnesiaTimer = setInterval(() => {
        if (!running) return;
        console.log('[Vosk] Amnesia: reseteando recognizer (30s)');
        recreateRecognizer();
        self.postMessage({ type: 'cycle_reset' });
    }, AMNESIA_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════
self.onmessage = async (e) => {
    const { action, data } = e.data;

    // ─── CONNECT-PORT: Direct audio from AudioWorklet (bypass main thread) ───
    if (action === 'connect-port') {
        directPort = data.port;
        directPort.onmessage = (portEvent) => {
            // Audio arrives pre-downsampled at 16kHz from the bridge worklet
            if (portEvent.data.action === 'process' && recognizer && running) {
                try {
                    const rawData = portEvent.data.data instanceof Float32Array
                        ? portEvent.data.data
                        : new Float32Array(portEvent.data.data);
                    // Already at 16kHz — feed directly to recognizer
                    recognizer.acceptWaveformFloat(rawData, VOSK_SAMPLE_RATE);
                } catch (err) {
                    self.postMessage({ type: 'error', error: err.message });
                }
            }
        };
        console.log('[Vosk] ✅ Direct MessagePort connected — audio bypasses main thread');
    }

    // ─── DISCONNECT-PORT: Remove direct audio path ───
    if (action === 'disconnect-port') {
        if (directPort) {
            directPort.onmessage = null;
            directPort.close();
            directPort = null;
        }
    }

    // ─── INIT: cargar modelo + crear recognizer + arrancar timer ───
    if (action === 'init') {
        const { modelUrl, sampleRate, deviceSampleRate } = data;
        nativeSampleRate = deviceSampleRate || 48000;
        voskSampleRate = sampleRate || VOSK_SAMPLE_RATE;

        try {
            self.postMessage({ type: 'status', status: 'booting' });
            model = await createModel(modelUrl);
            recreateRecognizer();
            running = true;
            startAmnesiaTimer();
            self.postMessage({ type: 'status', status: 'ready' });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    // ─── PROCESS: alimentar audio al recognizer (fallback from main thread) ───
    if (action === 'process' && recognizer && running) {
        try {
            const rawData = data instanceof Float32Array ? data : new Float32Array(data);
            // Data from main thread is still at native sample rate — downsample
            const downsampled = downsampleBuffer(rawData, nativeSampleRate, VOSK_SAMPLE_RATE);
            recognizer.acceptWaveformFloat(downsampled, VOSK_SAMPLE_RATE);
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    // ─── RESET: recrear recognizer limpio + reiniciar timer ───
    if (action === 'reset') {
        console.log('[Vosk] Reset solicitado');
        recreateRecognizer();
        startAmnesiaTimer();
        self.postMessage({ type: 'cycle_reset' });
    }

    // ─── DESTROY: liberar todo ───
    if (action === 'destroy') {
        running = false;
        clearInterval(amnesiaTimer);
        if (directPort) {
            directPort.onmessage = null;
            try { directPort.close(); } catch (e) {}
            directPort = null;
        }
        if (recognizer) {
            try { recognizer.remove(); } catch (e) {}
            recognizer = null;
        }
        if (model) {
            try { model.terminate(); } catch (e) {}
            model = null;
        }
    }
};
