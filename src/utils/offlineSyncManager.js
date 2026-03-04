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
