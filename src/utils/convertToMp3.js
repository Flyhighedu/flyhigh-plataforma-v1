'use client';

// =====================================================
// convertToMp3.js
//
// Client-side WebM/Opus → MP3 conversion using lamejs.
// Used to prepare audio for OpenAI gpt-4o-audio-preview
// which requires MP3 or WAV format (WebM is not accepted).
//
// FLOW:
//   WebM Blob → AudioContext.decodeAudioData() → PCM → lamejs → MP3 Blob
//
// PERFORMANCE:
//   ~1-2 seconds on mid-range Android for a 45s recording.
//   Runs on the main thread (fast enough for our ~50KB files).
//
// SAFETY:
//   If conversion fails, returns null — caller should
//   fall back to uploading the original WebM.
// =====================================================

import lamejs from 'lamejs';

const MP3_BITRATE = 64; // 64kbps — good quality for voice, ~350KB for 45s

/**
 * Converts a WebM/Opus audio Blob to MP3.
 *
 * @param {Blob} webmBlob - The WebM audio blob from MediaRecorder
 * @returns {Promise<Blob|null>} MP3 blob, or null if conversion fails
 */
export async function convertToMp3(webmBlob) {
    try {
        if (!webmBlob || webmBlob.size === 0) return null;

        // Step 1: Decode WebM to raw PCM using AudioContext
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Step 2: Extract mono channel as Int16 samples
        const channelData = audioBuffer.getChannelData(0); // Mono
        const sampleRate = audioBuffer.sampleRate;
        const samples = new Int16Array(channelData.length);

        for (let i = 0; i < channelData.length; i++) {
            // Clamp float32 [-1, 1] to int16 [-32768, 32767]
            const s = Math.max(-1, Math.min(1, channelData[i]));
            samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Step 3: Encode to MP3 with lamejs
        const encoder = new lamejs.Mp3Encoder(1, sampleRate, MP3_BITRATE);
        const mp3Chunks = [];
        const BLOCK_SIZE = 1152; // LAME standard frame size

        for (let i = 0; i < samples.length; i += BLOCK_SIZE) {
            const chunk = samples.subarray(i, i + BLOCK_SIZE);
            const mp3buf = encoder.encodeBuffer(chunk);
            if (mp3buf.length > 0) {
                mp3Chunks.push(mp3buf);
            }
        }

        // Flush remaining data
        const finalChunk = encoder.flush();
        if (finalChunk.length > 0) {
            mp3Chunks.push(finalChunk);
        }

        // Step 4: Create MP3 Blob
        const mp3Blob = new Blob(mp3Chunks, { type: 'audio/mp3' });

        // Close AudioContext to free resources
        await audioContext.close();

        console.log(`✅ WebM→MP3: ${(webmBlob.size / 1024).toFixed(1)}KB → ${(mp3Blob.size / 1024).toFixed(1)}KB`);
        return mp3Blob;

    } catch (err) {
        console.warn('⚠️ MP3 conversion failed (will use WebM fallback):', err?.message || err);
        return null;
    }
}
