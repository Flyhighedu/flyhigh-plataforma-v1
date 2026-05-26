// ═══════════════════════════════════════════════════════════════
// audio-vosk-bridge-worklet.js — Zero Main Thread Audio Pipeline
// ═══════════════════════════════════════════════════════════════
// This worklet replaces audio-feeder-worklet.js with a dual-mode
// processor optimized for Vosk speech recognition:
//
// MODE 1 (MessagePort connected — Vosk):
//   Audio never touches the main thread.
//   VAD + downsampling happen HERE (audio thread).
//   Voice-active frames go directly to the Vosk Worker
//   via a MessagePort. Main thread only gets VAD state.
//
// MODE 2 (No MessagePort — fallback for pocketsphinx/tfjs):
//   Audio frames are sent to main thread via port.postMessage
//   exactly like the old audio-feeder-worklet.js.
//
// Buffer: 4096 samples (~85ms at 48kHz) for lower latency
// (was 8192 = ~170ms in the old worklet).
// ═══════════════════════════════════════════════════════════════

const BUFFER_SIZE = 4096;
const VOSK_SAMPLE_RATE = 16000;
const VAD_TRAILING_FRAMES = 4; // ~340ms of trailing audio after voice stops

class AudioVoskBridgeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this._buffer = new Float32Array(BUFFER_SIZE);
        this._writeIndex = 0;

        // MessagePort to Vosk Worker (null = fallback to main thread)
        this._voskPort = null;

        // VAD state
        this._vadTrailingCounter = 0;
        this._lastVadState = false;
        this._sensitivity = 1.0; // 0.0 to 1.0 (from calibrator slider)

        // Listen for configuration messages from main thread
        this.port.onmessage = (e) => {
            if (e.data.type === 'connect-vosk-port') {
                this._voskPort = e.data.port;
                console.log('[VoskBridge] ✅ MessagePort connected — audio bypasses main thread');
            }
            if (e.data.type === 'disconnect-vosk-port') {
                this._voskPort = null;
            }
            if (e.data.type === 'set-sensitivity') {
                this._sensitivity = e.data.sensitivity;
            }
        };
    }

    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0]; // 128 samples per render quantum

        // Accumulate samples into buffer
        for (let i = 0; i < channelData.length; i++) {
            this._buffer[this._writeIndex++] = channelData[i];
        }

        // Process when buffer is full
        if (this._writeIndex >= BUFFER_SIZE) {
            this._processBuffer();
            this._writeIndex = 0;
        }

        return true; // Keep processor alive
    }

    _processBuffer() {
        // ── VAD: Calculate energy ──
        let sum = 0;
        let maxVal = 0;
        for (let i = 0; i < BUFFER_SIZE; i++) {
            const sample = this._buffer[i];
            sum += sample * sample;
            const abs = sample < 0 ? -sample : sample;
            if (abs > maxVal) maxVal = abs;
        }
        const energy = Math.sqrt(sum / BUFFER_SIZE);

        // Dynamic threshold from sensitivity (same formula as useVoiceCopilot)
        const sensitivity = this._sensitivity;
        const vadThreshold = sensitivity >= 1.0 ? 0 : (1.0 - sensitivity) * 0.04;
        const isVoiceActive = energy >= vadThreshold;

        // Trailing frames: keep sending audio for a bit after voice stops
        if (isVoiceActive) {
            this._vadTrailingCounter = VAD_TRAILING_FRAMES;
        } else if (this._vadTrailingCounter > 0) {
            this._vadTrailingCounter--;
        }

        const shouldSendAudio = isVoiceActive || this._vadTrailingCounter > 0;

        // ── Notify main thread of VAD state changes (lightweight, for UI) ──
        if (shouldSendAudio !== this._lastVadState) {
            this._lastVadState = shouldSendAudio;
            this.port.postMessage({ type: 'vad-state', isVoiceActive: shouldSendAudio });
        }

        // ── Send audio ──
        if (shouldSendAudio) {
            if (this._voskPort) {
                // ✅ DIRECT PATH: Downsample + send directly to Vosk Worker
                // Audio NEVER touches the main thread.
                const downsampled = this._downsample(this._buffer, sampleRate, VOSK_SAMPLE_RATE);
                this._voskPort.postMessage(
                    { action: 'process', data: downsampled },
                    [downsampled.buffer] // Transfer ownership — zero copy
                );
            } else {
                // ⚠️ FALLBACK: Send raw frame to main thread (pocketsphinx/tfjs/etc)
                const frame = new Float32Array(this._buffer);
                this.port.postMessage(
                    { type: 'audio-frame', frame: frame, peak: maxVal },
                    [frame.buffer]
                );
            }
        }
    }

    /**
     * Downsample audio buffer from inputRate to outputRate.
     * Uses simple averaging — good enough for speech recognition.
     */
    _downsample(buffer, inputRate, outputRate) {
        if (inputRate === outputRate) return new Float32Array(buffer);
        if (inputRate < outputRate) return new Float32Array(buffer);

        const ratio = inputRate / outputRate;
        const newLength = Math.round(buffer.length / ratio);
        const result = new Float32Array(newLength);
        let outIdx = 0;
        let bufIdx = 0;

        while (outIdx < result.length) {
            const nextBufIdx = Math.round((outIdx + 1) * ratio);
            let accum = 0;
            let count = 0;
            for (let i = bufIdx; i < nextBufIdx && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[outIdx] = count > 0 ? accum / count : 0;
            outIdx++;
            bufIdx = nextBufIdx;
        }

        return result;
    }
}

registerProcessor('audio-vosk-bridge-processor', AudioVoskBridgeProcessor);
