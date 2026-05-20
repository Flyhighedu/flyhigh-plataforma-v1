/* global importScripts, Module */
'use strict';

// ═══════════════════════════════════════════════════════════════
// ESTADO GLOBAL DEL WORKER
// ═══════════════════════════════════════════════════════════════
let recognizer = null;
let audioBuffer = null;
let nativeSampleRate = 48000;
const targetSampleRate = 16000;
let kwsSearchId = null;
let currentWakeWord = 'COMPUTADORA';
let isReady = false;
let moduleReady = false;
let pendingInit = null; // Cola para init que llega antes de que Module esté listo
let frameCount = 0;

// ═══════════════════════════════════════════════════════════════
// CARGA DIFERIDA DE POCKETSPHINX.JS CON ESPERA DE RUNTIME
// ═══════════════════════════════════════════════════════════════
// pocketsphinx.js es un binario Emscripten que registra sus clases
// (Recognizer, AudioBuffer, Config, VectorWords, etc.) via embind
// DESPUÉS de que el runtime inicializa. importScripts es síncrono
// para el JS, pero la inicialización del heap y los datos embebidos
// es asíncrona. Debemos esperar a onRuntimeInitialized.

// Configurar el callback ANTES de importar el script
if (typeof Module === 'undefined') {
    var Module = {};
}
Module['onRuntimeInitialized'] = function() {
    console.log('[Pocketsphinx Worker] ✅ Module runtime inicializado');
    console.log('[Pocketsphinx Worker] Clases disponibles:', {
        Config: typeof Module.Config,
        Recognizer: typeof Module.Recognizer,
        AudioBuffer: typeof Module.AudioBuffer,
        VectorWords: typeof Module.VectorWords,
        Integers: typeof Module.Integers,
        ReturnType: typeof Module.ReturnType,
    });
    moduleReady = true;

    // Si había un init pendiente (llegó antes de que Module estuviera listo), ejecutarlo ahora
    if (pendingInit) {
        console.log('[Pocketsphinx Worker] Ejecutando init pendiente con wake word:', pendingInit.wakeWord);
        nativeSampleRate = pendingInit.deviceSampleRate || 48000;
        initPocketSphinx(pendingInit.wakeWord || 'computadora');
        pendingInit = null;
    }
};

console.log('[Pocketsphinx Worker] Cargando pocketsphinx.js...');
try {
    importScripts('/pocketsphinx/pocketsphinx.js');
    console.log('[Pocketsphinx Worker] pocketsphinx.js cargado (script parsed). moduleReady =', moduleReady);
} catch (err) {
    console.error('[Pocketsphinx Worker] ❌ ERROR FATAL al cargar pocketsphinx.js:', err);
    self.postMessage({ type: 'error', error: 'No se pudo cargar pocketsphinx.js: ' + (err.message || err) });
}

// ═══════════════════════════════════════════════════════════════
// DOWNSAMPLER Y CONVERSOR DE AUDIO FLOAT32 -> INT16 PCM
// ═══════════════════════════════════════════════════════════════
function processAudioToPCM(floatBuffer) {
    if (nativeSampleRate === targetSampleRate) {
        const pcm = new Int16Array(floatBuffer.length);
        for (let i = 0; i < floatBuffer.length; i++) {
            const s = Math.max(-1.0, Math.min(1.0, floatBuffer[i]));
            pcm[i] = s < 0 ? s * 32768.0 : s * 32767.0;
        }
        return pcm;
    }

    const sampleRateRatio = nativeSampleRate / targetSampleRate;
    const newLength = Math.round(floatBuffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < floatBuffer.length; i++) {
            accum += floatBuffer[i];
            count++;
        }
        const avg = count > 0 ? accum / count : 0;
        const s = Math.max(-1.0, Math.min(1.0, avg));
        result[offsetResult] = s < 0 ? s * 32768.0 : s * 32767.0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════
// TRADUCTOR ESPAÑOL GRAPHEME-TO-PHONEME PARA EL MODELO ACÚSTICO EN
// ═══════════════════════════════════════════════════════════════
function spanishToARPAbet(word) {
    let w = word.toLowerCase().trim();
    // Reemplazamos 'ñ' por el dígrafo 'ny' antes de normalizar,
    // para preservar el sonido palatal nasal en el mapeo fonético
    w = w.replace(/ñ/g, 'ny');
    w = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const phonemes = [];
    let i = 0;

    while (i < w.length) {
        const c = w[i];
        const next = w[i + 1] || '';

        if (c === 'a') { phonemes.push('AA'); i++; }
        else if (c === 'e') { phonemes.push('EH'); i++; }
        else if (c === 'i') { phonemes.push('IY'); i++; }
        else if (c === 'o') { phonemes.push('OW'); i++; }
        else if (c === 'u') { phonemes.push('UW'); i++; }
        else if (c === 'b' || c === 'v') { phonemes.push('B'); i++; }
        else if (c === 'c') {
            if (next === 'h') { phonemes.push('CH'); i += 2; }
            else if (next === 'e' || next === 'i') { phonemes.push('S'); i++; }
            else { phonemes.push('K'); i++; }
        }
        else if (c === 'd') { phonemes.push('D'); i++; }
        else if (c === 'f') { phonemes.push('F'); i++; }
        else if (c === 'g') {
            if (next === 'e' || next === 'i') { phonemes.push('HH'); i++; }
            else { phonemes.push('G'); i++; }
        }
        else if (c === 'h') { i++; } // Muda
        else if (c === 'j') { phonemes.push('HH'); i++; }
        else if (c === 'k') { phonemes.push('K'); i++; }
        else if (c === 'l') {
            if (next === 'l') { phonemes.push('Y'); i += 2; }
            else { phonemes.push('L'); i++; }
        }
        else if (c === 'm') { phonemes.push('M'); i++; }
        else if (c === 'n') {
            if (next === 'y') { phonemes.push('N'); phonemes.push('Y'); i += 2; }
            else { phonemes.push('N'); i++; }
        }
        else if (c === 'p') { phonemes.push('P'); i++; }
        else if (c === 'q') {
            phonemes.push('K');
            if (next === 'u') i += 2; else i++;
        }
        else if (c === 'r') { phonemes.push('R'); i++; }
        else if (c === 's') { phonemes.push('S'); i++; }
        else if (c === 't') { phonemes.push('T'); i++; }
        else if (c === 'w') { phonemes.push('W'); i++; }
        else if (c === 'x') { phonemes.push('K'); phonemes.push('S'); i++; }
        else if (c === 'y') { phonemes.push('Y'); i++; }
        else if (c === 'z') { phonemes.push('S'); i++; }
        else { i++; }
    }

    return phonemes.join(' ');
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE POCKETSPHINX
// ═══════════════════════════════════════════════════════════════
function initPocketSphinx(wakeWordText) {
    try {
        console.log('[Pocketsphinx Worker] Inicializando pocketsphinx con wake word:', wakeWordText);
        isReady = false;
        frameCount = 0;

        // Verificar que Module tiene las clases necesarias
        if (!Module.Config || !Module.Recognizer || !Module.AudioBuffer || !Module.VectorWords || !Module.Integers) {
            const missing = [];
            if (!Module.Config) missing.push('Config');
            if (!Module.Recognizer) missing.push('Recognizer');
            if (!Module.AudioBuffer) missing.push('AudioBuffer');
            if (!Module.VectorWords) missing.push('VectorWords');
            if (!Module.Integers) missing.push('Integers');
            throw new Error('Clases faltantes en Module: ' + missing.join(', ') + '. El runtime de Emscripten no se ha inicializado correctamente.');
        }

        // Limpiar instancias previas
        if (recognizer) {
            try { recognizer.stop(); } catch(e) {}
            try { recognizer.delete(); } catch(e) {}
            recognizer = null;
        }
        if (audioBuffer) {
            try { audioBuffer.delete(); } catch(e) {}
            audioBuffer = null;
        }

        // Configuración de PocketSphinx
        const config = new Module.Config();
        
        // Calcular el umbral (kws_threshold) dinámicamente.
        // Dado que se usa mapeo fonético de español a modelo acústico inglés,
        // se necesitan umbrales muy tolerantes para compensar la discrepancia.
        const vowelCount = (wakeWordText.match(/[aeiou]/gi) || []).length;
        let thresholdStr = '1e-20';
        if (vowelCount <= 2) {
            thresholdStr = '1e-10';
        } else if (vowelCount === 3) {
            thresholdStr = '1e-15';
        } else if (vowelCount === 4) {
            thresholdStr = '1e-20';
        } else {
            thresholdStr = '1e-25';
        }
        console.log(`[Pocketsphinx Worker] Umbral KWS: ${thresholdStr} (${vowelCount} vocales en "${wakeWordText}")`);
        
        config.push_back(['-kws_threshold', thresholdStr]);
        
        // Crear recognizer y buffer de audio
        recognizer = new Module.Recognizer(config);
        audioBuffer = new Module.AudioBuffer();
        config.delete();

        if (!recognizer) {
            throw new Error('Error al instanciar Module.Recognizer');
        }

        // Agregar pronunciaciones fonéticas
        const words = new Module.VectorWords();
        currentWakeWord = wakeWordText.toUpperCase();
        
        const phonetics = spanishToARPAbet(wakeWordText);
        console.log(`[Pocketsphinx Worker] Fonética para "${currentWakeWord}": "${phonetics}"`);
        
        words.push_back([currentWakeWord, phonetics]);
        
        // Variaciones adicionales para "computadora"
        if (currentWakeWord === 'COMPUTADORA') {
            words.push_back(['COMPUTADORA(2)', 'K AA M P Y UW T ER D OW R AH']);
            words.push_back(['COMPUTADORA(3)', 'K AH M P Y UW T AH D AO R AH']);
        }

        const addWordsResult = recognizer.addWords(words);
        words.delete();

        if (addWordsResult !== Module.ReturnType.SUCCESS) {
            throw new Error('Error al registrar palabras: resultado=' + addWordsResult);
        }
        console.log('[Pocketsphinx Worker] ✅ Palabras registradas');

        // Registrar búsqueda KWS
        const ids = new Module.Integers();
        const addKwsResult = recognizer.addKeyword(ids, currentWakeWord);
        
        if (addKwsResult !== Module.ReturnType.SUCCESS) {
            ids.delete();
            throw new Error('Error al añadir keyword: resultado=' + addKwsResult);
        }

        kwsSearchId = ids.get(0);
        ids.delete();
        console.log('[Pocketsphinx Worker] ✅ Keyword registrada con searchId:', kwsSearchId);

        // Activar búsqueda KWS e iniciar reconocimiento
        const switchResult = recognizer.switchSearch(kwsSearchId);
        if (switchResult !== Module.ReturnType.SUCCESS) {
            throw new Error('Error al activar búsqueda KWS: resultado=' + switchResult);
        }

        const startResult = recognizer.start();
        if (startResult !== Module.ReturnType.SUCCESS) {
            throw new Error('Error al iniciar recognizer: resultado=' + startResult);
        }

        isReady = true;
        self.postMessage({ type: 'status', status: 'ready' });
        console.log('[Pocketsphinx Worker] ✅ INICIALIZADO EXITOSAMENTE. Listo para recibir audio.');
    } catch (err) {
        console.error('[Pocketsphinx Worker] ❌ Error crítico en init:', err);
        self.postMessage({ type: 'error', error: err.message || err.toString() });
    }
}

// ═══════════════════════════════════════════════════════════════
// PROCESAMIENTO DE AUDIO EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════
function processFrame(pcmData) {
    if (!recognizer || !isReady) return;

    try {
        frameCount++;

        // Log de diagnóstico cada 100 frames (~10s a 10fps)
        if (frameCount % 100 === 1) {
            // Calcular energía del frame PCM
            let maxPcm = 0;
            let sumPcm = 0;
            for (let i = 0; i < pcmData.length; i++) {
                const abs = Math.abs(pcmData[i]);
                if (abs > maxPcm) maxPcm = abs;
                sumPcm += abs;
            }
            console.log(`[Pocketsphinx Worker] Frame #${frameCount}: ${pcmData.length} muestras, max=${maxPcm}, avg=${Math.round(sumPcm/pcmData.length)}`);
        }

        // Asegurar que el buffer tenga exactamente el tamaño correcto
        if (audioBuffer.size() !== pcmData.length) {
            audioBuffer.delete();
            audioBuffer = new Module.AudioBuffer();
            while (audioBuffer.size() < pcmData.length) {
                audioBuffer.push_back(0);
            }
        }
        for (let i = 0; i < pcmData.length; i++) {
            audioBuffer.set(i, pcmData[i]);
        }

        // Procesar buffer PCM
        const processResult = recognizer.process(audioBuffer);
        if (processResult !== Module.ReturnType.SUCCESS) {
            console.error('[Pocketsphinx Worker] Error en process():', processResult);
            return;
        }

        // Obtener hipótesis actual
        const hyp = recognizer.getHyp();
        if (hyp && hyp.length > 0) {
            console.log('[Pocketsphinx Worker] 🎯 HIPÓTESIS DETECTADA:', hyp);
            
            // La hipótesis de KWS debería contener la wake word registrada
            if (hyp.toUpperCase().includes(currentWakeWord)) {
                console.log('[Pocketsphinx Worker] ✅ WAKE WORD DETECTADA:', currentWakeWord);
                self.postMessage({ type: 'partial', result: { partial: currentWakeWord.toLowerCase() } });
                self.postMessage({ type: 'final', result: { text: currentWakeWord.toLowerCase() } });
                
                // Reiniciar búsqueda para evitar detecciones repetidas
                recognizer.stop();
                recognizer.start();
            }
        }
    } catch (err) {
        console.error('[Pocketsphinx Worker] Error procesando frame:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// CONTROLADOR DE MENSAJES DEL HILO PRINCIPAL
// ═══════════════════════════════════════════════════════════════
self.onmessage = function (e) {
    const { action, data } = e.data;

    if (action === 'init') {
        const { wakeWord, deviceSampleRate } = data;
        console.log(`[Pocketsphinx Worker] Recibido init: wakeWord="${wakeWord}", sampleRate=${deviceSampleRate}, moduleReady=${moduleReady}`);
        
        if (!moduleReady) {
            // Module aún no terminó de inicializar, guardar para después
            console.log('[Pocketsphinx Worker] ⏳ Module NO está listo aún. Encolando init...');
            pendingInit = { wakeWord, deviceSampleRate };
            return;
        }
        
        nativeSampleRate = deviceSampleRate || 48000;
        initPocketSphinx(wakeWord || 'computadora');
    }

    if (action === 'process' && isReady) {
        const pcmData = processAudioToPCM(data);
        processFrame(pcmData);
    }

    if (action === 'reset' && isReady) {
        try {
            recognizer.stop();
            recognizer.start();
            console.log('[Pocketsphinx Worker] Reset ejecutado');
        } catch (err) {
            console.error('[Pocketsphinx Worker] Error en reset:', err);
        }
    }

    if (action === 'destroy') {
        isReady = false;
        moduleReady = false;
        try {
            if (recognizer) {
                recognizer.stop();
                recognizer.delete();
            }
            if (audioBuffer) {
                audioBuffer.delete();
            }
        } catch (err) {
            console.error('[Pocketsphinx Worker] Error en destroy:', err);
        }
        recognizer = null;
        audioBuffer = null;
        self.postMessage({ type: 'status', status: 'destroyed' });
    }
};
