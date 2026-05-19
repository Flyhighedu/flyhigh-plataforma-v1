import { createModel } from 'vosk-browser';

let model = null;
let recognizer = null;
let currentSampleRate = 16000;
let nativeSampleRate = 48000;

// ═══════════════════════════════════════════════════════════════
// AUDIO DOWNSAMPLER (ejecutado en el Worker thread para liberar el hilo principal)
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

self.onmessage = async (e) => {
    const { action, data } = e.data;

    if (action === 'init') {
        const { modelUrl, sampleRate, deviceSampleRate } = data;
        currentSampleRate = sampleRate; // 16000 (Vosk target)
        nativeSampleRate = deviceSampleRate || 48000; // Tasa nativa del micrófono
        try {
            self.postMessage({ type: 'status', status: 'booting' });
            model = await createModel(modelUrl);
            
            recognizer = new model.KaldiRecognizer(sampleRate);
            recognizer.setWords(true);
            
            recognizer.on("result", (message) => {
                self.postMessage({ type: 'final', result: message.result });
            });
            
            recognizer.on("partialresult", (message) => {
                self.postMessage({ type: 'partial', result: message.result });
            });
            
            self.postMessage({ type: 'status', status: 'ready' });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    if (action === 'process' && recognizer) {
        try {
            // Recibimos audio crudo a la tasa nativa del dispositivo.
            // Downsampling se hace AQUÍ en el Worker thread, liberando el hilo principal de la UI.
            const rawData = data instanceof Float32Array ? data : new Float32Array(data);
            const downsampled = downsampleBuffer(rawData, nativeSampleRate, currentSampleRate);
            recognizer.acceptWaveformFloat(downsampled, currentSampleRate);
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    if (action === 'reset' && recognizer) {
        recognizer.reset();
    }
    
    if (action === 'destroy' && recognizer) {
        recognizer.free();
        model.free();
        recognizer = null;
        model = null;
    }
};
