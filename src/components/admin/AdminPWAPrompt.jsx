'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';

export default function AdminPWAPrompt() {
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Check if already dismissed or already installed
        const dismissed = localStorage.getItem('admin_pwa_prompt_dismissed');
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        
        if (dismissed || isStandalone) return;

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Check for Android install prompt (captured in app/layout.js)
        if (window.__pwaInstallPrompt) {
            setDeferredPrompt(window.__pwaInstallPrompt);
        }

        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        
        // Show the prompt for mobile users after a short delay
        if (isMobile) {
            const timer = setTimeout(() => setIsVisible(true), 2500);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            };
        }
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('admin_pwa_prompt_dismissed', 'true');
    };

    const handleInstall = async () => {
        if (isIOS) return;

        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsVisible(false);
                localStorage.setItem('admin_pwa_prompt_dismissed', 'true');
            }
            setDeferredPrompt(null);
            window.__pwaInstallPrompt = null;
        } else {
            alert('Haz clic en los 3 puntos del navegador y selecciona "Instalar aplicación" o "Agregar a la pantalla principal".');
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[99999] animate-premium-in">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl flex flex-col gap-3">
                <button 
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
                
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div className="pr-4">
                        <h3 className="text-white font-bold text-sm">Instalar Admin Panel</h3>
                        <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                            Agrega esta herramienta a tu inicio para acceso rápido a misiones y reportes.
                        </p>
                    </div>
                </div>

                <div className="mt-2">
                    {isIOS ? (
                        <div className="bg-white/5 rounded-xl p-3 text-xs text-slate-200 border border-white/5">
                            <p className="flex items-center gap-2 mb-2 font-medium text-white">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                                Toca Compartir <Share size={14} className="ml-1 opacity-70" />
                            </p>
                            <p className="flex items-center gap-2 font-medium text-white">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">2</span>
                                Toca "Agregar a inicio" <PlusSquare size={14} className="ml-1 opacity-70" />
                            </p>
                        </div>
                    ) : (
                        <button 
                            onClick={handleInstall}
                            className="w-full bg-white text-blue-600 hover:bg-slate-50 font-bold text-sm py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Instalar Aplicación
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
