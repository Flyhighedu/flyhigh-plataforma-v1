import { createModel } from 'vosk-browser';

// ═══════════════════════════════════════════════════════════════
// CONSTANTES DE LA MÁQUINA DE ESTADOS
// ═══════════════════════════════════════════════════════════════
const VOSK_SAMPLE_RATE = 16000;
const PATROL_SECONDS = 7;
const OVERLAP_SECONDS = 2.5;
const ACTIVE_LISTEN_SECONDS = 6;
const SAFETY_CAP_MS = 10000; // Real-time cap for patrol cycle
const PATROL_SAMPLES = PATROL_SECONDS * VOSK_SAMPLE_RATE;   // 112,000
const OVERLAP_SAMPLES = OVERLAP_SECONDS * VOSK_SAMPLE_RATE;  // 40,000

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let model = null;
let recognizer = null;
let nativeSampleRate = 48000;

// State Machine: 'IDLE' | 'PATROL' | 'ACTIVE_LISTEN'
let state = 'IDLE';

// Ring Buffer (circular, fixed ~448KB)
let ringBuffer = new Float32Array(PATROL_SAMPLES);
let writePos = 0;
let samplesInCycle = 0;

// Output suppression after overlap re-injection
let suppressOutput = false;
let suppressRemaining = 0;

// Timers
let safetyTimer = null;
let activeListenTimer = null;

// Wake word config
let wakeWordAliases = [
    'computadora', 'computador', 'compu', 'conputadora', 'conmutadora',
    'comutadora', 'como tadora', 'con putadora', 'compu tadora',
    'computura', 'con dictadora', 'computa dora'
];

// ═══════════════════════════════════════════════════════════════
// AUDIO DOWNSAMPLER
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
// RING BUFFER OPERATIONS
// ═══════════════════════════════════════════════════════════════
function pushToRing(chunk) {
    for (let i = 0; i < chunk.length; i++) {
        ringBuffer[writePos] = chunk[i];
        writePos = (writePos + 1) % PATROL_SAMPLES;
    }
    samplesInCycle += chunk.length;
}

function extractOverlap() {
    const overlap = new Float32Array(OVERLAP_SAMPLES);
    let readPos = (writePos - OVERLAP_SAMPLES + PATROL_SAMPLES) % PATROL_SAMPLES;
    for (let i = 0; i < OVERLAP_SAMPLES; i++) {
        overlap[i] = ringBuffer[readPos];
        readPos = (readPos + 1) % PATROL_SAMPLES;
    }
    return overlap;
}

// ═══════════════════════════════════════════════════════════════
// PATROL RESET (amnesia cíclica con solapamiento)
// ═══════════════════════════════════════════════════════════════
function performPatrolReset() {
    if (!recognizer || state !== 'PATROL') return;
    if (samplesInCycle < OVERLAP_SAMPLES) return; // Not enough audio to justify reset

    const t0 = performance.now();
    const overlap = extractOverlap();

    recognizer.reset();

    // Re-inject overlap into fresh recognizer
    recognizer.acceptWaveformFloat(overlap, VOSK_SAMPLE_RATE);

    // Reset ring buffer with overlap at the start
    ringBuffer.fill(0);
    ringBuffer.set(overlap);
    writePos = OVERLAP_SAMPLES;
    samplesInCycle = OVERLAP_SAMPLES;

    // Suppress output until overlap audio is superseded by new audio
    suppressOutput = true;
    suppressRemaining = OVERLAP_SAMPLES;

    // Restart safety timer
    clearTimeout(safetyTimer);
    safetyTimer = setTimeout(performPatrolReset, SAFETY_CAP_MS);

    console.log(`[Vosk SM] PATROL reset: ${(performance.now() - t0).toFixed(1)}ms`);
}

// ═══════════════════════════════════════════════════════════════
// WAKE WORD DETECTION (inside Worker for minimal latency)
// ═══════════════════════════════════════════════════════════════
function normalizeFull(text) {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim();
}

function checkWakeWord(transcript) {
    const norm = normalizeFull(transcript);
    const noSpace = norm.replace(/\s+/g, '');
    for (const alias of wakeWordAliases) {
        const na = normalizeFull(alias);
        if (norm.includes(na) || noSpace.includes(na.replace(/\s+/g, ''))) return true;
    }
    return false;
}

function transitionToActiveListen() {
    if (state === 'ACTIVE_LISTEN') return; // Ignore repeated wake words
    state = 'ACTIVE_LISTEN';
    clearTimeout(safetyTimer); // Pause patrol clock

    clearTimeout(activeListenTimer);
    activeListenTimer = setTimeout(() => {
        if (state === 'ACTIVE_LISTEN') {
            console.log('[Vosk SM] ACTIVE_LISTEN timeout (6s) → PATROL');
            returnToPatrol();
            self.postMessage({ type: 'active_timeout' });
        }
    }, ACTIVE_LISTEN_SECONDS * 1000);

    console.log('[Vosk SM] PATROL → ACTIVE_LISTEN');
    self.postMessage({ type: 'wake' });
}

function returnToPatrol() {
    if (!recognizer) return;
    clearTimeout(activeListenTimer);

    const overlap = extractOverlap();
    recognizer.reset();

    ringBuffer.fill(0);
    ringBuffer.set(overlap);
    writePos = OVERLAP_SAMPLES;
    samplesInCycle = OVERLAP_SAMPLES;
    state = 'PATROL';

    recognizer.acceptWaveformFloat(overlap, VOSK_SAMPLE_RATE);
    suppressOutput = true;
    suppressRemaining = OVERLAP_SAMPLES;

    clearTimeout(safetyTimer);
    safetyTimer = setTimeout(performPatrolReset, SAFETY_CAP_MS);
    console.log('[Vosk SM] → PATROL (reset + overlap)');
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════
self.onmessage = async (e) => {
    const { action, data } = e.data;

    if (action === 'init') {
        const { modelUrl, sampleRate, deviceSampleRate, wakeWord } = data;
        nativeSampleRate = deviceSampleRate || 48000;
        if (wakeWord && wakeWord !== 'computadora') {
            wakeWordAliases = [wakeWord];
        }
        try {
            self.postMessage({ type: 'status', status: 'booting' });
            model = await createModel(modelUrl);
            recognizer = new model.KaldiRecognizer(sampleRate || VOSK_SAMPLE_RATE);
            recognizer.setWords(true);

            recognizer.on("result", (message) => {
                if (suppressOutput) return;
                const text = message.result?.text || '';
                if (state === 'PATROL' && text && checkWakeWord(text)) {
                    transitionToActiveListen();
                    self.postMessage({ type: 'final', result: message.result });
                } else if (state === 'ACTIVE_LISTEN') {
                    self.postMessage({ type: 'final', result: message.result });
                }
                // PATROL without wake word → silently discard
            });

            recognizer.on("partialresult", (message) => {
                if (suppressOutput) return;
                const text = message.result?.partial || '';
                if (state === 'PATROL' && text && checkWakeWord(text)) {
                    transitionToActiveListen();
                    self.postMessage({ type: 'partial', result: message.result });
                } else if (state === 'ACTIVE_LISTEN') {
                    self.postMessage({ type: 'partial', result: message.result });
                }
            });

            state = 'PATROL';
            samplesInCycle = 0;
            writePos = 0;
            safetyTimer = setTimeout(performPatrolReset, SAFETY_CAP_MS);
            self.postMessage({ type: 'status', status: 'ready' });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    if (action === 'process' && recognizer && state !== 'IDLE') {
        try {
            const rawData = data instanceof Float32Array ? data : new Float32Array(data);
            const downsampled = downsampleBuffer(rawData, nativeSampleRate, VOSK_SAMPLE_RATE);

            pushToRing(downsampled);
            recognizer.acceptWaveformFloat(downsampled, VOSK_SAMPLE_RATE);

            // Update suppression counter
            if (suppressOutput && suppressRemaining > 0) {
                suppressRemaining -= downsampled.length;
                if (suppressRemaining <= 0) {
                    suppressOutput = false;
                    suppressRemaining = 0;
                }
            }

            // Check patrol cycle completion
            if (state === 'PATROL' && samplesInCycle >= PATROL_SAMPLES) {
                performPatrolReset();
            }
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }

    if (action === 'force_reset') {
        // POI matched — immediate amnesia
        console.log('[Vosk SM] Force reset (POI matched)');
        clearTimeout(activeListenTimer);
        clearTimeout(safetyTimer);
        if (recognizer) recognizer.reset();
        state = 'PATROL';
        samplesInCycle = 0;
        writePos = 0;
        ringBuffer.fill(0);
        suppressOutput = false;
        suppressRemaining = 0;
        safetyTimer = setTimeout(performPatrolReset, SAFETY_CAP_MS);
    }

    if (action === 'reset') {
        // Legacy reset — also resets state machine
        clearTimeout(safetyTimer);
        clearTimeout(activeListenTimer);
        if (recognizer) recognizer.reset();
        state = 'PATROL';
        samplesInCycle = 0;
        writePos = 0;
        ringBuffer.fill(0);
        suppressOutput = false;
        suppressRemaining = 0;
        safetyTimer = setTimeout(performPatrolReset, SAFETY_CAP_MS);
    }

    if (action === 'destroy') {
        clearTimeout(safetyTimer);
        clearTimeout(activeListenTimer);
        state = 'IDLE';
        if (recognizer) { recognizer.free(); recognizer = null; }
        if (model) { model.free(); model = null; }
    }
};
