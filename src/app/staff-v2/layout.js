'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, LogOut, User, Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function StaffLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOnline, setIsOnline] = useState(true);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Si es la página de login, no mostrar la barra superior
    const isLoginPage = pathname === '/staff/login';

    // Detectar online/offline
    useEffect(() => {
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

    // Cargar perfil de staff
    useEffect(() => {
        if (isLoginPage) {
            setLoading(false);
            return;
        }

        const loadProfile = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profileData } = await supabase
                        .from('staff_profiles')
                        .select('full_name, role')
                        .eq('user_id', user.id)
                        .single();
                    if (profileData) setProfile(profileData);
                }
            } catch (e) {
                console.warn('Error loading staff profile:', e);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [isLoginPage]);

    if (isLoginPage) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
                {/* Online/Offline indicator */}
                <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${!isOnline ? 'h-8' : 'h-0'}`}>
                    {!isOnline && (
                        <div className="h-full bg-amber-500 flex items-center justify-center gap-2 text-white text-xs font-bold">
                            <WifiOff size={14} /> Sin conexión
                        </div>
                    )}
                </div>
                {children}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Offline indicator (fixed top banner) */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2">
                    <WifiOff size={14} /> Sin conexión — los datos se guardarán localmente
                </div>
            )}
            {children}
        </div>
    );
}
