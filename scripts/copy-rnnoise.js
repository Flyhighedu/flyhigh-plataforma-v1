/**
 * copy-rnnoise.js — Copia los assets de RNNoise a public/rnnoise/
 * 
 * Se ejecuta automáticamente en postinstall o manualmente con:
 *   node scripts/copy-rnnoise.js
 * 
 * Copia:
 *   - dist/rnnoise/workletProcessor.js → public/rnnoise/workletProcessor.js
 *   - dist/rnnoise.wasm               → public/rnnoise/rnnoise.wasm
 *   - dist/rnnoise_simd.wasm          → public/rnnoise/rnnoise_simd.wasm
 */
const fs = require('fs');
const path = require('path');

const PKG_DIR = path.resolve(__dirname, '..', 'node_modules', '@sapphi-red', 'web-noise-suppressor', 'dist');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'rnnoise');

const FILES = [
    { src: path.join(PKG_DIR, 'rnnoise', 'workletProcessor.js'), dest: path.join(OUT_DIR, 'workletProcessor.js') },
    { src: path.join(PKG_DIR, 'rnnoise.wasm'), dest: path.join(OUT_DIR, 'rnnoise.wasm') },
    { src: path.join(PKG_DIR, 'rnnoise_simd.wasm'), dest: path.join(OUT_DIR, 'rnnoise_simd.wasm') },
];

// Create output directory
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log(`[copy-rnnoise] Created ${OUT_DIR}`);
}

let copied = 0;
for (const { src, dest } of FILES) {
    if (!fs.existsSync(src)) {
        console.warn(`[copy-rnnoise] ⚠️  Source not found, skipping: ${src}`);
        continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`[copy-rnnoise] ✅ ${path.basename(src)} → public/rnnoise/`);
    copied++;
}

console.log(`[copy-rnnoise] Done. ${copied}/${FILES.length} files copied.`);
