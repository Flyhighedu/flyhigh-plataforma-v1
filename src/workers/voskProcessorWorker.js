import { createModel } from 'vosk-browser';

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
const VOSK_SAMPLE_RATE = 16000;
const AMNESIA_INTERVAL_MS = 10000; // Reseteo limpio cada 10 segundos

// ═══════════════════════════════════════════════════════════════
// ESTADO (mínimo)
// ═══════════════════════════════════════════════════════════════
let model = null;
let recognizer = null;
let nativeSampleRate = 48000;
let voskSampleRate = VOSK_SAMPLE_RATE;
let amnesiaTimer = null;
let running = false;
let currentGrammar = null; // Guardar la gramática actual para recreaciones y amnesia

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
function recreateRecognizer(grammarStr = null) {
    if (!model) return;

    currentGrammar = grammarStr;

    // Liberar el recognizer anterior (memoria WASM)
    if (recognizer) {
        try { recognizer.remove(); } catch (e) {
            console.warn('[Vosk] Error al liberar recognizer anterior:', e.message);
        }
        recognizer = null;
    }

    // Crear uno nuevo, opcionalmente con gramática restringida
    try {
        if (grammarStr) {
            console.log('[Vosk] Creando recognizer con gramática:', grammarStr);
            recognizer = new model.KaldiRecognizer(voskSampleRate, grammarStr);
        } else {
            console.log('[Vosk] Creando recognizer con diccionario completo');
            recognizer = new model.KaldiRecognizer(voskSampleRate);
        }
    } catch (e) {
        console.error('[Vosk] Error al instanciar KaldiRecognizer:', e);
        // Fallback a diccionario completo si falla la gramática
        recognizer = new model.KaldiRecognizer(voskSampleRate);
    }
    
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
        console.log('[Vosk] Amnesia: reseteando recognizer (10s)');
        recreateRecognizer(currentGrammar);
        self.postMessage({ type: 'cycle_reset' });
    }, AMNESIA_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════
self.onmessage = async (e) => {
    const { action, data } = e.data;

    // ─── INIT: cargar modelo + crear recognizer + arrancar timer ───
    if (action === 'init') {
        const { modelUrl, sampleRate, deviceSampleRate, grammar } = data;
        nativeSampleRate = deviceSampleRate || 48000;
        voskSampleRate = sampleRate || VOSK_SAMPLE_RATE;

        try {
            self.postMessage({ type: 'status', status: 'booting' });
            model = await createModel(modelUrl);
            recreateRecognizer(grammar || null);
            running = true;
            startAmnesiaTimer();
            self.postMessage({ type: 'status', status: 'ready' });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    // ─── PROCESS: alimentar audio al recognizer ───
    if (action === 'process' && recognizer && running) {
        try {
            const rawData = data instanceof Float32Array ? data : new Float32Array(data);
            const downsampled = downsampleBuffer(rawData, nativeSampleRate, VOSK_SAMPLE_RATE);
            recognizer.acceptWaveformFloat(downsampled, VOSK_SAMPLE_RATE);
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    // ─── RESET: recrear recognizer limpio + reiniciar timer ───
    if (action === 'reset') {
        const targetGrammar = data?.grammar || null;
        console.log('[Vosk] Reset solicitado con gramática:', targetGrammar);
        recreateRecognizer(targetGrammar);
        startAmnesiaTimer();
        self.postMessage({ type: 'cycle_reset' });
    }

    // ─── DESTROY: liberar todo ───
    if (action === 'destroy') {
        running = false;
        clearInterval(amnesiaTimer);
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
