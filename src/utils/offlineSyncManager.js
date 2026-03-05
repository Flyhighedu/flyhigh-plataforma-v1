/**
 * offlineSyncManager.js — Central IndexedDB-based sync engine.
 * 
 * Replaces the localStorage-only offlineQueue.js with a proper
 * blob-capable storage layer using IndexedDB via idb-keyval.
 * 
 * Handles both image and audio blobs with background sync,
 * exponential backoff, and status tracking.
 */

import { get, set, del, keys, entries } from 'idb-keyval';
import { createClient } from '@/utils/supabase/client';

const SYNC_PREFIX = 'flyhigh_sync_';

/**
 * Generate a unique key for a pending upload.
 */
function generateKey() {
    return `${SYNC_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Save a pending upload to IndexedDB.
 * 
 * @param {Object} entry
 * @param {File|Blob} entry.file - The compressed image or audio blob
 * @param {string} entry.storageBucket - Supabase Storage bucket name
 * @param {string} entry.storagePath - File path within the bucket
 * @param {Object} entry.dbMutation - DB mutation to execute after upload
 * @param {string} entry.dbMutation.table - Table name
 * @param {string} entry.dbMutation.matchColumn - Column to match (e.g. 'id')
 * @param {string} entry.dbMutation.matchValue - Value to match
 * @param {Object} entry.dbMutation.data - Data to update/insert
 * @param {Object} [entry.eventLog] - Optional staff_events log entry
 * @param {string} [entry.label] - Human-readable label for the UI
 * @returns {Promise<string>} The generated key
 */
export async function savePendingUpload(entry) {
    const key = generateKey();
    const record = {
        file: entry.file,
        storageBucket: entry.storageBucket,
        storagePath: entry.storagePath,
        dbMutation: entry.dbMutation,
        eventLog: entry.eventLog || null,
        label: entry.label || entry.storagePath,
        contentType: entry.file?.type || 'application/octet-stream',
        status: 'pending',         // pending | uploading | synced | failed
        createdAt: Date.now(),
        lastAttempt: null,
        attempts: 0,
        lastError: null
    };
    await set(key, record);
    return key;
}

/**
 * Get all pending upload entries from IndexedDB.
 * @returns {Promise<Array<{key: string, ...record}>>}
 */
export async function getPendingUploads() {
    const allKeys = await keys();
    const syncKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(SYNC_PREFIX));
    const results = [];

    for (const key of syncKeys) {
        const record = await get(key);
        if (record && record.status !== 'synced') {
            results.push({ key, ...record });
        }
    }

    return results.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Check if there are any pending (unsynced) uploads.
 * @returns {Promise<boolean>}
 */
export async function hasPendingUploads() {
    const pending = await getPendingUploads();
    return pending.length > 0;
}

/**
 * Remove a synced entry from IndexedDB.
 * @param {string} key
 */
export async function removePendingUpload(key) {
    await del(key);
}

/**
 * Sync a single pending upload entry.
 * @param {string} key
 * @param {Object} record
 * @returns {Promise<boolean>} true if synced successfully
 */
async function syncOne(key, record) {
    const supabase = createClient();

    try {
        // Mark as uploading
        await set(key, { ...record, status: 'uploading', lastAttempt: Date.now() });

        // 1. Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(record.storageBucket)
            .upload(record.storagePath, record.file, {
                upsert: true,
                contentType: record.contentType
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(record.storageBucket)
            .getPublicUrl(record.storagePath);
        const publicUrl = urlData?.publicUrl;

        // 2. Execute DB mutation if provided
        if (record.dbMutation) {
            const { table, matchColumn, matchValue, data } = record.dbMutation;

            // Replace placeholder {{PUBLIC_URL}} with actual URL
            const resolvedData = {};
            for (const [k, v] of Object.entries(data)) {
                resolvedData[k] = v === '{{PUBLIC_URL}}' ? publicUrl : v;
            }

            const { error: dbError } = await supabase
                .from(table)
                .update(resolvedData)
                .eq(matchColumn, matchValue);

            if (dbError) throw dbError;
        }

        // 3. Log event if provided
        if (record.eventLog) {
            const logEntry = { ...record.eventLog };
            if (logEntry.payload?.url === '{{PUBLIC_URL}}') {
                logEntry.payload = { ...logEntry.payload, url: publicUrl };
            }
            await supabase.from('staff_events').insert(logEntry).catch(() => { });
        }

        // 4. Remove from IndexedDB on success
        await del(key);
        return true;

    } catch (err) {
        console.error(`[OfflineSync] Failed to sync ${key}:`, err);
        const updated = {
            ...record,
            status: 'failed',
            lastAttempt: Date.now(),
            attempts: (record.attempts || 0) + 1,
            lastError: err?.message || 'Unknown error'
        };
        await set(key, updated);
        return false;
    }
}

/**
 * Attempt to sync all pending uploads.
 * @returns {Promise<{synced: number, failed: number, total: number}>}
 */
export async function syncAllPending() {
    if (!navigator.onLine) {
        return { synced: 0, failed: 0, total: 0, offline: true };
    }

    const pending = await getPendingUploads();
    let synced = 0;
    let failed = 0;

    for (const entry of pending) {
        const success = await syncOne(entry.key, entry);
        if (success) synced++;
        else failed++;
    }

    return { synced, failed, total: pending.length, offline: false };
}

/**
 * Get sync status summary.
 * @returns {Promise<{total: number, pending: number, failed: number, items: Array}>}
 */
export async function getSyncStatus() {
    const allKeys = await keys();
    const syncKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(SYNC_PREFIX));
    const items = [];
    let pending = 0;
    let failed = 0;

    for (const key of syncKeys) {
        const record = await get(key);
        if (!record) continue;
        if (record.status === 'synced') {
            // Clean up synced entries
            await del(key);
            continue;
        }
        items.push({
            key,
            label: record.label,
            status: record.status,
            createdAt: record.createdAt,
            lastError: record.lastError,
            contentType: record.contentType
        });
        if (record.status === 'failed') failed++;
        else pending++;
    }

    return { total: items.length, pending, failed, items };
}

// ═══════════════════════════════════════════════════════════
//  LOCAL STEP / PROGRESS PERSISTENCE (crash recovery)
// ═══════════════════════════════════════════════════════════

const STEP_PREFIX = 'flyhigh_step_';

/**
 * Save the user's current operational progress to IndexedDB.
 * Called on every step/state advancement for instant crash recovery.
 *
 * @param {string} journeyId
 * @param {Object} progress
 * @param {number} progress.currentStep - 0-3 stepper index
 * @param {string} progress.missionState - e.g. 'seat_deployment', 'OPERATION'
 * @param {string} [progress.role] - user's role
 * @param {boolean} [progress.showBrief] - brief screen state
 * @param {string|null} [progress.auxFlowState]
 * @param {string|null} [progress.teacherFlowState]
 * @param {boolean} [progress.checkInDone] - whether user has checked in
 */
export async function saveLocalProgress(journeyId, progress) {
    if (!journeyId) return;
    try {
        const key = `${STEP_PREFIX}${journeyId}`;
        await set(key, {
            ...progress,
            savedAt: Date.now()
        });
    } catch (e) {
        console.warn('[OfflineSync] Failed to save local progress:', e);
    }
}

/**
 * Retrieve saved progress for crash recovery.
 * @param {string} journeyId
 * @returns {Promise<Object|null>}
 */
export async function getLocalProgress(journeyId) {
    if (!journeyId) return null;
    try {
        const key = `${STEP_PREFIX}${journeyId}`;
        const data = await get(key);
        if (!data) return null;

        // Expire after 24 hours (stale data protection)
        const MAX_AGE_MS = 24 * 60 * 60 * 1000;
        if (Date.now() - (data.savedAt || 0) > MAX_AGE_MS) {
            await del(key);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('[OfflineSync] Failed to read local progress:', e);
        return null;
    }
}

/**
 * Clear saved progress (call on successful checkout or journey end).
 * @param {string} journeyId
 */
export async function clearLocalProgress(journeyId) {
    if (!journeyId) return;
    try {
        await del(`${STEP_PREFIX}${journeyId}`);
    } catch (e) {
        console.warn('[OfflineSync] Failed to clear local progress:', e);
    }
}

// ═══════════════════════════════════════════════════════════
//  OPTIMISTIC UPLOAD ENGINE (background queue + pub/sub)
// ═══════════════════════════════════════════════════════════

/** @type {Set<(status: {pending: number, failed: number, total: number}) => void>} */
const _subscribers = new Set();
let _drainInterval = null;
let _drainBackoffMs = 15_000;
const DRAIN_MIN_MS = 15_000;
const DRAIN_MAX_MS = 120_000;

/** Notify all subscribers with latest sync status */
async function _notifySubscribers() {
    try {
        const status = await getSyncStatus();
        const snapshot = { pending: status.pending, failed: status.failed, total: status.total };
        _subscribers.forEach(fn => { try { fn(snapshot); } catch { } });
    } catch { }
}

/**
 * Subscribe to sync status changes.
 * @param {(status: {pending: number, failed: number, total: number}) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeSyncStatus(callback) {
    _subscribers.add(callback);
    // Immediately fire with current status
    _notifySubscribers();
    return () => { _subscribers.delete(callback); };
}

/**
 * Start the background drain loop with exponential backoff.
 * Idempotent — multiple calls are safe.
 */
export function startBackgroundDrain() {
    if (_drainInterval) return; // already running

    const tick = async () => {
        if (!navigator.onLine) return;

        try {
            const result = await syncAllPending();
            if (result.total === 0) {
                // Nothing left — stop draining
                stopBackgroundDrain();
                _notifySubscribers();
                return;
            }
            if (result.failed > 0) {
                // Exponential backoff on failures
                _drainBackoffMs = Math.min(_drainBackoffMs * 2, DRAIN_MAX_MS);
            } else {
                // Reset backoff on success
                _drainBackoffMs = DRAIN_MIN_MS;
            }
            _notifySubscribers();
        } catch (err) {
            console.warn('[OfflineSync] Drain tick error:', err);
            _drainBackoffMs = Math.min(_drainBackoffMs * 2, DRAIN_MAX_MS);
        }

        // Re-schedule with current backoff
        if (_drainInterval) {
            clearTimeout(_drainInterval);
            _drainInterval = setTimeout(tick, _drainBackoffMs);
        }
    };

    _drainBackoffMs = DRAIN_MIN_MS;
    _drainInterval = setTimeout(tick, 500); // first tick fast
}

/** Stop the background drain loop. */
export function stopBackgroundDrain() {
    if (_drainInterval) {
        clearTimeout(_drainInterval);
        _drainInterval = null;
    }
}

/**
 * Enqueue an optimistic upload: fires an instant DB mutation, saves the blob
 * to IndexedDB, and starts the background drain loop.
 *
 * The instant mutation sets a `_status: 'uploading'` flag so the admin dashboard
 * can show a skeleton placeholder while the heavy upload is in progress.
 *
 * @param {Object} opts
 * @param {File|Blob} opts.file            - Compressed image blob
 * @param {string}    opts.storageBucket   - Supabase Storage bucket
 * @param {string}    opts.storagePath     - File path within bucket
 * @param {Object}    [opts.instantMutation] - Lightweight DB write to execute NOW
 * @param {string}    opts.instantMutation.table
 * @param {string}    opts.instantMutation.matchColumn
 * @param {*}         opts.instantMutation.matchValue
 * @param {Object}    opts.instantMutation.data - Data to .update() immediately
 * @param {Object}    [opts.dbMutation]    - DB write to execute AFTER upload completes
 * @param {Object}    [opts.eventLog]      - Optional staff_events log entry
 * @param {string}    [opts.label]         - Human-readable label
 * @returns {Promise<string>} The IDB key for the queued upload
 */
export async function enqueueOptimisticUpload(opts) {
    const supabase = createClient();

    // 1. Fire instant mutation (lightweight — no blob, just marks 'uploading')
    if (opts.instantMutation) {
        const { table, matchColumn, matchValue, data } = opts.instantMutation;
        try {
            await supabase.from(table).update(data).eq(matchColumn, matchValue);
        } catch (err) {
            console.warn('[OfflineSync] Instant mutation failed (non-blocking):', err);
        }
    }

    // 2. Queue the heavy blob upload for background processing
    const key = await savePendingUpload({
        file: opts.file,
        storageBucket: opts.storageBucket,
        storagePath: opts.storagePath,
        dbMutation: opts.dbMutation || null,
        eventLog: opts.eventLog || null,
        label: opts.label || opts.storagePath
    });

    // 3. Start background drain (idempotent)
    startBackgroundDrain();

    // 4. Notify subscribers
    _notifySubscribers();

    return key;
}
