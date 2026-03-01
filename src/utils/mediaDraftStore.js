const DB_NAME = 'flyhigh_media_drafts';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

function hasIndexedDb() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb() {
    return new Promise((resolve, reject) => {
        if (!hasIndexedDb()) {
            reject(new Error('IndexedDB unavailable'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed opening IndexedDB'));
    });
}

async function withStore(mode, run) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        let result;

        try {
            result = run(store);
        } catch (error) {
            reject(error);
            return;
        }

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
}

export async function saveMediaDraft(key, blob) {
    if (!key || !blob) return;

    if (!hasIndexedDb()) return;

    await withStore('readwrite', (store) => {
        store.put({ blob, savedAt: Date.now() }, key);
    });
}

export async function loadMediaDraft(key) {
    if (!key || !hasIndexedDb()) return null;

    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            const data = request.result;
            resolve(data?.blob || null);
        };

        request.onerror = () => reject(request.error || new Error('Failed reading media draft'));
    });
}

export async function deleteMediaDraft(key) {
    if (!key || !hasIndexedDb()) return;

    await withStore('readwrite', (store) => {
        store.delete(key);
    });
}

export function downloadMediaBlob(blob, filename) {
    if (!blob || typeof window === 'undefined') return;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
