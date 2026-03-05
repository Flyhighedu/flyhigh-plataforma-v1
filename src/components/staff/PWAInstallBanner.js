'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import usePWAInstall from '@/hooks/usePWAInstall';

/**
 * PWAInstallBanner — Floating banner for /staff/dashboard.
 * Uses usePWAInstall hook which reads from global __pwaInstallPrompt.
 * Only shows in browser mode (not when running as installed PWA).
 */
export default function PWAInstallBanner() {
    const { canInstall, isInstalled, isIOS, install, showIOSGuide, dismissIOSGuide } = usePWAInstall();
    const [dismissed, setDismissed] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Don't show if installed or recently dismissed
        if (isInstalled) return;

        const dismissedAt = localStorage.getItem('flyhigh_pwa_banner_dismissed');
        if (dismissedAt) {
            const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
            if (Date.now() - Number(dismissedAt) < THREE_DAYS) {
                setDismissed(true);
                return;
            }
        }

        // Delay show for smooth UX (let the page load first)
        const timer = setTimeout(() => setVisible(true), 2000);
        return () => clearTimeout(timer);
    }, [isInstalled]);

    const handleDismiss = () => {
        setVisible(false);
        setDismissed(true);
        localStorage.setItem('flyhigh_pwa_banner_dismissed', String(Date.now()));
    };

    if (!canInstall || isInstalled || dismissed || !visible) return null;

    return (
        <>
            <div className="fixed bottom-4 left-4 right-4 z-[9990] animate-in slide-in-from-bottom-5 duration-500">
                <div className="mx-auto max-w-md rounded-2xl bg-gradient-to-r from-[#0165b8] to-[#0185e4] p-3.5 shadow-2xl shadow-blue-900/40 border border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/20 flex-shrink-0">
                        <img src="/img/app-icon.png" alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-xs leading-tight">Instala la app</p>
                        <p className="text-blue-100/70 text-[10px] leading-snug">Más rápida y funciona sin internet</p>
                    </div>
                    <button
                        onClick={install}
                        className="px-3.5 py-2 rounded-xl bg-white text-[#0165b8] font-bold text-xs flex items-center gap-1.5 hover:bg-blue-50 active:scale-[0.97] transition-all shadow-md flex-shrink-0"
                    >
                        {isIOS ? <Share size={13} /> : <Download size={13} />}
                        Instalar
                    </button>
                    <button onClick={handleDismiss} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0" aria-label="Cerrar">
                        <X size={14} className="text-white/70" />
                    </button>
                </div>
            </div>

            {/* iOS Guide */}
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
                                    <p className="text-xs text-slate-500 mt-0.5">El ícono <Share size={12} className="inline text-blue-500" /> en la barra de Safari.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Selecciona &quot;Añadir a Inicio&quot;</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Desliza hacia abajo en el menú.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Toca &quot;Añadir&quot;</p>
                                    <p className="text-xs text-slate-500 mt-0.5">¡Listo! Aparecerá en tu pantalla de inicio.</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={dismissIOSGuide} className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors">
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
