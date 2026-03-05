'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * usePWAInstall — Hook that provides PWA install capabilities.
 * 
 * Works by reading from the global `window.__pwaInstallPrompt` which is captured
 * by an inline script in <head> (injected via layout.js) BEFORE React hydrates.
 * This guarantees the `beforeinstallprompt` event is never missed.
 * 
 * Returns:
 *   canInstall: boolean — true if install is available (Android) or is iOS in browser
 *   isInstalled: boolean — true if running as installed PWA
 *   isIOS: boolean — true if on iOS Safari
 *   install: () => void — triggers native install (Android) or shows iOS guide
 *   showIOSGuide: boolean — if true, render iOS instructions
 *   dismissIOSGuide: () => void
 */
export default function usePWAInstall() {
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        // Already installed as PWA?
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (standalone) {
            setIsInstalled(true);
            return;
        }

        // Detect iOS
        const ua = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
        setIsIOS(ios);

        if (ios) {
            // iOS can always "install" via Add to Home Screen
            setCanInstall(true);
            return;
        }

        // Android/Chrome: check if the global captured the event
        if (window.__pwaInstallPrompt) {
            setCanInstall(true);
        }

        // Also listen for late-firing events
        const handler = (e) => {
            e.preventDefault();
            window.__pwaInstallPrompt = e;
            setCanInstall(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Listen for successful install
        const installed = () => {
            setIsInstalled(true);
            setCanInstall(false);
        };
        window.addEventListener('appinstalled', installed);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installed);
        };
    }, []);

    const install = useCallback(async () => {
        if (isIOS) {
            setShowIOSGuide(true);
            return;
        }

        const prompt = window.__pwaInstallPrompt;
        if (!prompt) return;

        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setCanInstall(false);
        }
        window.__pwaInstallPrompt = null;
    }, [isIOS]);

    const dismissIOSGuide = useCallback(() => {
        setShowIOSGuide(false);
    }, []);

    return {
        canInstall,
        isInstalled,
        isIOS,
        install,
        showIOSGuide,
        dismissIOSGuide
    };
}
