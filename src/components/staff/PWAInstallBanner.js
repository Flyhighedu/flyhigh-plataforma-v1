'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * PWAInstallBanner — Persistent install prompt for /staff/* routes.
 * 
 * Android/Chrome: Uses beforeinstallprompt API to trigger native install.
 * iOS/Safari: Shows manual instructions since Safari doesn't support the API.
 * 
 * The banner reappears on every visit until the app is installed or
 * the user explicitly dismisses it (stored in localStorage for 7 days).
 */
export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed as PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (isStandalone) {
            setIsInstalled(true);
            return;
        }

        // Check dismiss cooldown (7 days)
        const dismissedAt = localStorage.getItem('flyhigh_pwa_dismissed');
        if (dismissedAt) {
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - Number(dismissedAt) < SEVEN_DAYS) return;
        }

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
        setIsIOS(ios);

        if (ios) {
            // iOS doesn't fire beforeinstallprompt — show banner directly
            setShowBanner(true);
        }

        // Android/Chrome: capture the install prompt
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Detect if app gets installed
        window.addEventListener('appinstalled', () => {
            setShowBanner(false);
            setIsInstalled(true);
            setDeferredPrompt(null);
        });

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = useCallback(async () => {
        if (isIOS) {
            setShowIOSGuide(true);
            return;
        }
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowBanner(false);
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
    }, [deferredPrompt, isIOS]);

    const handleDismiss = useCallback(() => {
        setShowBanner(false);
        setShowIOSGuide(false);
        localStorage.setItem('flyhigh_pwa_dismissed', String(Date.now()));
    }, []);

    if (!showBanner || isInstalled) return null;

    return (
        <>
            {/* Main install banner */}
            <div className="fixed bottom-0 left-0 right-0 z-[9990] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-5 duration-500">
                <div className="relative mx-auto max-w-md rounded-2xl bg-gradient-to-r from-[#0165b8] to-[#0185e4] p-4 shadow-2xl shadow-blue-900/40 border border-white/10">
                    {/* Dismiss button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-3 right-3 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={16} className="text-white/70" />
                    </button>

                    <div className="flex items-center gap-3.5">
                        {/* App icon */}
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0 shadow-lg border border-white/20">
                            <img src="/img/app-icon.png" alt="Fly High Ops" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-sm leading-tight">Instala Fly High Ops</h3>
                            <p className="text-blue-100/80 text-xs mt-0.5 leading-snug">
                                Acceso directo, funciona sin internet y es más rápida.
                            </p>
                        </div>
                    </div>

                    {/* Install button */}
                    <button
                        onClick={handleInstall}
                        className="mt-3 w-full py-2.5 rounded-xl bg-white text-[#0165b8] font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-[0.98] transition-all shadow-md"
                    >
                        {isIOS ? (
                            <>
                                <Share size={16} />
                                Añadir a Inicio
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Instalar App
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* iOS step-by-step guide overlay */}
            {showIOSGuide && (
                <div className="fixed inset-0 z-[9991] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-500 mb-[env(safe-area-inset-bottom)]">
                        <h3 className="text-lg font-extrabold text-slate-900 text-center">Instalar en iPhone</h3>
                        <p className="text-slate-500 text-xs text-center mt-1 mb-5">Sigue estos 3 pasos:</p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Toca el botón Compartir</p>
                                    <p className="text-xs text-slate-500 mt-0.5">El ícono <Share size={12} className="inline text-blue-500" /> en la barra de Safari (abajo).</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Selecciona "Añadir a Inicio"</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Desliza hacia abajo en el menú para encontrarlo.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Toca "Añadir"</p>
                                    <p className="text-xs text-slate-500 mt-0.5">¡Listo! La app aparecerá en tu pantalla de inicio.</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDismiss}
                            className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
