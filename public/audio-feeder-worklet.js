// ═══════════════════════════════════════════════════════════════
// audio-feeder-worklet.js — AudioWorkletProcessor
// ═══════════════════════════════════════════════════════════════
// Replaces the deprecated ScriptProcessorNode to avoid
// GC pressure on the main thread. This processor runs in its
// own real-time audio thread with zero-copy input buffers.
//
// Responsibilities:
//   1. Calculate peak amplitude for Voice Activity Detection (VAD)
//   2. Forward audio frames to the main thread via port.postMessage
//
// The main thread then applies VAD gating and forwards to the
// Vosk/PocketSphinx worker — keeping the audio thread lean.
// ═══════════════════════════════════════════════════════════════

class AudioFeederProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Accumulation buffer — we batch 8192 samples before posting
        // to match the old ScriptProcessor buffer size and avoid
        // flooding the main thread with tiny 128-sample messages.
        this._buffer = new Float32Array(8192);
        this._writeIndex = 0;
    }

    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0]; // mono channel (128 samples per quantum)

        // Append to accumulation buffer
        for (let i = 0; i < channelData.length; i++) {
            this._buffer[this._writeIndex++] = channelData[i];
        }

        // When we've accumulated a full 8192-sample frame, send it
        if (this._writeIndex >= 8192) {
            // Calculate peak amplitude for VAD (cheap — no sqrt needed)
            let maxVal = 0;
            for (let i = 0; i < 8192; i++) {
                const abs = Math.abs(this._buffer[i]);
                if (abs > maxVal) maxVal = abs;
            }

            // Clone the buffer for transfer (the internal buffer stays reusable)
            const frame = new Float32Array(this._buffer);

            this.port.postMessage({
                type: 'audio-frame',
                frame: frame,
                peak: maxVal
            }, [frame.buffer]); // Transfer ownership — zero copy

            this._writeIndex = 0;
        }

        return true; // Keep processor alive
    }
}

registerProcessor('audio-feeder-processor', AudioFeederProcessor);
