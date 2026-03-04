'use client';

import { Loader2, WifiOff, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * PendingSyncBanner — Floating notification banner.
 * Shows when there are pending offline uploads waiting in IndexedDB.
 */
export default function PendingSyncBanner({ pendingCount, isSyncing, lastSyncResult, onSyncNow }) {
    if (pendingCount === 0 && !isSyncing) return null;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[100] pointer-events-none flex justify-center">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border bg-white/95 backdrop-blur-md shadow-[0_20px_40px_-20px_rgba(0,0,0,0.3)] overflow-hidden">
                {/* Progress bar */}
                {isSyncing && (
                    <div className="h-1 bg-blue-100">
                        <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
                    </div>
                )}

                <div className="px-4 py-3 flex items-center gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isSyncing
                            ? 'bg-blue-50 text-blue-600'
                            : !isOnline
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-slate-100 text-slate-600'
                        }`}>
                        {isSyncing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : !isOnline ? (
                            <WifiOff size={18} />
                        ) : (
                            <AlertTriangle size={18} />
                        )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-tight">
                            {isSyncing
                                ? 'Sincronizando evidencia...'
                                : `${pendingCount} archivo${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`
                            }
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            {isSyncing
                                ? 'No cierres la app'
                                : !isOnline
                                    ? 'Se sincronizará al reconectar'
                                    : 'Toca para sincronizar ahora'
                            }
                        </p>
                    </div>

                    {/* Sync button */}
                    {!isSyncing && isOnline && onSyncNow && (
                        <button
                            onClick={onSyncNow}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold"
                        >
                            Sync
                        </button>
                    )}

                    {/* Success flash */}
                    {lastSyncResult && lastSyncResult.synced > 0 && !isSyncing && (
                        <div className="flex-shrink-0 flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={14} />
                            <span className="text-[10px] font-bold">{lastSyncResult.synced} ✓</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
