'use client';

import { useState, useEffect } from 'react';

export default function SupervisorLayout({ children }) {
    const [isOnline, setIsOnline] = useState(true); // Always true on first render to match SSR

    useEffect(() => {
        // Sync real browser status after hydration
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div
            className="min-h-screen bg-background-dark text-slate-100 antialiased"
            style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
        >
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">wifi_off</span>
                    Sin conexión — los datos pueden estar desactualizados
                </div>
            )}
            {children}
        </div>
    );
}
