'use client';

import { useState, useEffect, useCallback } from 'react';
import { subscribeSyncStatus, getSyncStatus, startBackgroundDrain } from '@/utils/offlineSyncManager';

/**
 * React hook that subscribes to the background upload queue status.
 * Returns live counts of pending/failed uploads for UI indicators.
 *
 * @returns {{ pendingCount: number, failedCount: number, total: number, isSynced: boolean, refresh: () => void }}
 */
export default function useUploadQueueStatus() {
    const [status, setStatus] = useState({ pending: 0, failed: 0, total: 0 });

    useEffect(() => {
        // Subscribe to real-time status changes from the drain loop
        const unsub = subscribeSyncStatus((snapshot) => {
            setStatus(snapshot);
        });

        // Also poll every 10s as a safety net (e.g. if drain loop isn't running)
        const poll = setInterval(async () => {
            try {
                const s = await getSyncStatus();
                setStatus({ pending: s.pending, failed: s.failed, total: s.total });
                // If there are pending items but drain isn't running, restart it
                if (s.total > 0) startBackgroundDrain();
            } catch { }
        }, 10_000);

        return () => {
            unsub();
            clearInterval(poll);
        };
    }, []);

    const refresh = useCallback(async () => {
        try {
            const s = await getSyncStatus();
            setStatus({ pending: s.pending, failed: s.failed, total: s.total });
        } catch { }
    }, []);

    return {
        pendingCount: status.pending,
        failedCount: status.failed,
        total: status.total,
        isSynced: status.total === 0,
        refresh
    };
}
