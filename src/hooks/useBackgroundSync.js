'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncAllPending, getSyncStatus } from '@/utils/offlineSyncManager';

const SYNC_INTERVAL_MS = 30000; // 30 seconds

/**
 * useBackgroundSync — React hook for automatic background sync.
 * 
 * Listens to navigator.onLine events. When connection returns,
 * triggers syncAllPending(). Runs periodic sync every 30s when online.
 * 
 * @returns {{ pendingCount, isSyncing, lastSyncResult, syncNow, syncStatus }}
 */
export default function useBackgroundSync() {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState(null);
    const [syncStatus, setSyncStatus] = useState(null);
    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    const refreshStatus = useCallback(async () => {
        try {
            const status = await getSyncStatus();
            if (mountedRef.current) {
                setSyncStatus(status);
                setPendingCount(status.total);
            }
        } catch (e) {
            console.error('[useBackgroundSync] Status refresh error:', e);
        }
    }, []);

    const syncNow = useCallback(async () => {
        if (isSyncing) return null;
        setIsSyncing(true);
        try {
            const result = await syncAllPending();
            if (mountedRef.current) {
                setLastSyncResult(result);
                await refreshStatus();
            }
            return result;
        } catch (e) {
            console.error('[useBackgroundSync] Sync error:', e);
            return { synced: 0, failed: 0, total: 0, error: e.message };
        } finally {
            if (mountedRef.current) setIsSyncing(false);
        }
    }, [isSyncing, refreshStatus]);

    // Listen for online/offline events
    useEffect(() => {
        mountedRef.current = true;

        const handleOnline = () => {
            syncNow();
        };

        window.addEventListener('online', handleOnline);
        return () => {
            mountedRef.current = false;
            window.removeEventListener('online', handleOnline);
        };
    }, [syncNow]);

    // Periodic sync when online
    useEffect(() => {
        refreshStatus(); // Initial check

        intervalRef.current = setInterval(() => {
            if (navigator.onLine) {
                refreshStatus();
                syncNow();
            }
        }, SYNC_INTERVAL_MS);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [refreshStatus, syncNow]);

    return {
        pendingCount,
        isSyncing,
        lastSyncResult,
        syncStatus,
        syncNow,
        refreshStatus
    };
}
