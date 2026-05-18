import { createModel } from 'vosk-browser';

let model = null;
let recognizer = null;

self.onmessage = async (e) => {
    const { action, data } = e.data;

    if (action === 'init') {
        const { modelUrl, sampleRate } = data;
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
            // data is expected to be a Float32Array containing PCM audio
            // The sample rate is 16000 as configured in AudioContext
            recognizer.acceptWaveformFloat(data, 16000);
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
