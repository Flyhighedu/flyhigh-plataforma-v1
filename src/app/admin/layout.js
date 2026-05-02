'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Lock, AlertCircle, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminPWAPrompt from '@/components/admin/AdminPWAPrompt';

export default function AdminRouteLayout({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const pathParts = pathname.split('/').filter(Boolean);
    const activeTab = pathParts.length > 1 ? pathParts[1] : 'bd';

    useEffect(() => {
        setIsMounted(true);
        const hasCookie = document.cookie.includes('flyhigh_admin_auth=');
        if (hasCookie) setIsAuthenticated(true);

        // Inject Admin PWA Manifest to override the global one
        let manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            manifestLink = document.createElement('link');
            manifestLink.rel = 'manifest';
            document.head.appendChild(manifestLink);
        }
        manifestLink.href = '/admin-manifest.json';

        // Register Admin Service Worker (isolated from Staff App)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin/' })
                .then(() => console.log('Admin Service Worker registered successfully.'))
                .catch((err) => console.error('Error registering Admin Service Worker:', err));
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        try {
            const res = await fetch('/api/admin-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
            } else {
                const data = await res.json();
                setLoginError(data.error || 'Contraseña incorrecta. Intenta de nuevo.');
            }
        } catch (err) {
            setLoginError('Error de conexión. Intenta de nuevo.');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/admin-auth', { method: 'DELETE' });
        setIsAuthenticated(false);
        setPassword('');
        router.push('/admin');
    };

    const globalStyles = (
        <style dangerouslySetInnerHTML={{
            __html: `
            :root {
                --neu-bg: #f8fafc;
                --neu-surface: #ffffff;
                --neu-shadow-light: #ffffff;
                --neu-shadow-dark: #e2e8f0;
                --neu-text: #1e293b;
                --neu-text-sub: #64748b;
                --neu-accent: #0ea5e9;
            }
            .dark {
                --neu-bg: #0f172a;
                --neu-surface: #1e293b;
                --neu-shadow-light: #00000040;
                --neu-shadow-dark: #00000099;
                --neu-text: #f8fafc;
                --neu-text-sub: #94a3b8;
                --neu-accent: #38bdf8;
            }
            .neu-bg-screen { background-color: var(--neu-bg); color: var(--neu-text); }
            @keyframes premiumFadeInUp {
                from { opacity: 0; transform: translateY(15px) scale(0.99); filter: blur(4px); }
                to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
            }
            .animate-premium-in { animation: premiumFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; will-change: opacity, transform, filter; }
            @keyframes premiumFadeOutDown {
                from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                to { opacity: 0; transform: translateY(15px) scale(0.99); filter: blur(4px); }
            }
            .animate-premium-out { animation: premiumFadeOutDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; will-change: opacity, transform, filter; }
            .neu-card { background: var(--neu-surface); box-shadow: 12px 12px 24px var(--neu-shadow-dark), -12px -12px 24px var(--neu-shadow-light); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.8); }
            .dark .neu-card { border: 1px solid rgba(255, 255, 255, 0.05); }
            .neu-input-inset { background: var(--neu-bg); box-shadow: inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light); border: 1px solid transparent; border-radius: 12px; color: var(--neu-text); transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
            .neu-input-inset:focus-within, .neu-input-inset:active { box-shadow: inset 5px 5px 10px var(--neu-shadow-dark), inset -5px -5px 10px var(--neu-shadow-light); border-color: var(--neu-accent); outline: none; }
            .neu-input-inset::placeholder { color: var(--neu-text-sub); opacity: 0.7; }
            .neu-list-item { background: var(--neu-surface); box-shadow: 6px 6px 12px var(--neu-shadow-dark), -6px -6px 12px var(--neu-shadow-light); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.8); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
            .dark .neu-list-item { border: 1px solid rgba(255, 255, 255, 0.05); }
            .neu-list-item:hover { transform: translateY(-4px); box-shadow: 10px 10px 20px var(--neu-shadow-dark), -10px -10px 20px var(--neu-shadow-light); }
            .neu-list-item:active { transform: scale(0.97) translateY(0); box-shadow: 2px 2px 5px var(--neu-shadow-dark), -2px -2px 5px var(--neu-shadow-light); }
            .neu-action-select { appearance: none; background: var(--neu-surface); box-shadow: inset 2px 2px 5px var(--neu-shadow-dark), inset -2px -2px 5px var(--neu-shadow-light); border-radius: 12px; padding: 6px 12px; font-size: 0.75rem; font-weight: 700; color: var(--neu-text); border: none; outline: none; cursor: pointer; }
            .neu-text { color: var(--neu-text); }
            .neu-text-sub { color: var(--neu-text-sub); }
            `
        }} />
    );

    if (!isMounted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--neu-bg)' }}>
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <main className="min-h-screen neu-bg-screen flex items-center justify-center p-4">
                {globalStyles}
                <div className="w-full max-w-md animate-premium-in">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl shadow-lg shadow-blue-500/30 mb-6">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2 neu-text">
                            Acceso <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Restringido</span>
                        </h1>
                        <p className="neu-text-sub text-sm">Panel de Administración · Fly High Edu</p>
                    </div>

                    <div className="neu-card p-10 max-w-md w-full relative z-10 text-center">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold neu-text-sub uppercase tracking-wider mb-3">
                                    <Lock size={14} /> Contraseña de Administrador
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 neu-text-sub" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="Ingresa la contraseña"
                                        className="w-full neu-input-inset pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-mono tracking-widest"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {loginError && (
                                <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-500/20 text-red-500 border border-red-500/30">
                                    <AlertCircle size={16} />
                                    {loginError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loginLoading || !password}
                                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loginLoading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Verificando...</>
                                ) : (
                                    <><Lock size={18} /> Ingresar al Panel</>
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-slate-600 text-xs mt-6">
                        Acceso exclusivo para administradores autorizados.
                    </p>
                </div>
                <AdminPWAPrompt />
            </main>
        );
    }

    return (
        <AdminLayout
            activeTab={activeTab}
            setActiveTab={(tab) => router.push(`/admin/${tab}`)}
            isAuthenticated={isAuthenticated}
            onLogout={handleLogout}
        >
            {globalStyles}
            {children}
            <AdminPWAPrompt />
        </AdminLayout>
    );
}
