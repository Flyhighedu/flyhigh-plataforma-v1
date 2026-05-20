// ═══════════════════════════════════════════════════════════════
// AUDIO PROCESSOR WORKER PARA GEMINI LIVE API
// ═══════════════════════════════════════════════════════════════

let nativeSampleRate = 48000;
const targetSampleRate = 16000;

// Downsampling de tasa nativa a 16000Hz
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
        result[offsetResult] = count > 0 ? Math.max(-1, Math.min(1, accum / count)) : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

// Convertir Float32Array (-1.0 a 1.0) a Int16Array (16-bit PCM Little Endian)
function floatToInt16PCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        // Escalar a 16-bit int signed
        const sample = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(i * 2, sample, true); // true = Little Endian
    }
    return buffer;
}

// Convertir ArrayBuffer a cadena Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return self.btoa(binary);
}

self.onmessage = (e) => {
    const { action, data } = e.data;

    if (action === 'init') {
        nativeSampleRate = data.deviceSampleRate || 48000;
        self.postMessage({ type: 'status', status: 'ready' });
    }

    if (action === 'process') {
        try {
            const rawData = data instanceof Float32Array ? data : new Float32Array(data);
            
            // 1. Downsampling a 16kHz
            const downsampled = downsampleBuffer(rawData, nativeSampleRate, targetSampleRate);
            
            // 2. Convertir a PCM 16 bits
            const pcmBuffer = floatToInt16PCM(downsampled);
            
            // 3. Convertir a Base64
            const base64Data = arrayBufferToBase64(pcmBuffer);
            
            // Enviar de vuelta el bloque listo para el WebSocket
            self.postMessage({ type: 'audioBlock', base64: base64Data });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }
};
