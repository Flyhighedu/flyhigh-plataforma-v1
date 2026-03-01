'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertCircle, Plane } from 'lucide-react';

export default function StaffLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showTestModal, setShowTestModal] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes('Invalid login')) {
                    throw new Error('Credenciales incorrectas. Verifica tu email y contraseña.');
                }
                if (authError.message.includes('banned')) {
                    throw new Error('Tu cuenta ha sido desactivada. Contacta al administrador.');
                }
                throw authError;
            }

            // Verificar que sea un staff activo
            const { data: { user } } = await supabase.auth.getUser();
            console.log('Login User ID:', user?.id);

            if (!user?.id) {
                await supabase.auth.signOut();
                throw new Error('No pudimos validar tu sesión. Intenta iniciar sesión nuevamente.');
            }

            const { data: profile, error: profileError } = await supabase
                .from('staff_profiles')
                .select('role, is_active, full_name')
                .eq('user_id', user.id)
                .maybeSingle();

            console.log('Profile Fetch:', { profile, profileError });

            if (profileError) {
                await supabase.auth.signOut();
                console.error('Profile Error Details:', profileError);
                throw new Error('No pudimos validar tu perfil operativo. Intenta nuevamente o contacta a tu coordinador.');
            }

            if (!profile) {
                await supabase.auth.signOut();
                throw new Error('Tu cuenta no tiene un perfil operativo asignado. Contacta a tu coordinador.');
            }

            if (!profile.is_active) {
                await supabase.auth.signOut();
                throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
            }

            // Redirigir al dashboard
            router.push('/staff/dashboard');
            router.refresh();

        } catch (err) {
            console.error('Login Error:', err);
            const rawMessage = err?.message || '';
            const safeMessages = new Set([
                'Credenciales incorrectas. Verifica tu email y contraseña.',
                'Tu cuenta ha sido desactivada. Contacta al administrador.',
                'No pudimos validar tu sesión. Intenta iniciar sesión nuevamente.',
                'No pudimos validar tu perfil operativo. Intenta nuevamente o contacta a tu coordinador.',
                'Tu cuenta no tiene un perfil operativo asignado. Contacta a tu coordinador.',
                'Tu cuenta está desactivada. Contacta al administrador.'
            ]);

            setError(
                safeMessages.has(rawMessage)
                    ? rawMessage
                    : 'No pudimos iniciar sesión. Intenta nuevamente o contacta a tu coordinador.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
                        <Plane className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900">
                        FlyHigh<span className="text-blue-500">Ops</span>
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">Identifícate para iniciar operaciones.</p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="staff-email" className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                            <input
                                id="staff-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="block w-full px-4 py-3.5 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="staff-password" className="block text-sm font-semibold text-slate-700 mb-1">Contraseña</label>
                            <input
                                id="staff-password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="block w-full px-4 py-3.5 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/20 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <><Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" /> Ingresando...</>
                        ) : (
                            'Iniciar Sesión'
                        )}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-400 pt-4">
                    Tu cuenta la crea el administrador.<br />
                    Si no tienes acceso, contacta a tu coordinador.
                </p>

                {/* Test Mode Button */}
                <div className="pt-6 border-t border-slate-100 mt-6">
                    <button
                        type="button"
                        onClick={() => setShowTestModal(true)}
                        className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-200 border-dashed flex items-center justify-center gap-2"
                    >
                        <span>🛠️</span> Entrar en modo test
                    </button>
                </div>
            </div>
            {showTestModal && <TestModeModal onClose={() => setShowTestModal(false)} />}
        </div>
    );
}

// Helper function for TestModeModal
const getFirstName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts[0];
};

// Role labels for display in TestModeModal
const ROLE_LABELS = {
    pilot: 'Piloto',
    assistant: 'Auxiliar',
    teacher: 'Docente',
    // Add other roles if necessary
};

// Subcomponente para el Modal de Test
function TestModeModal({ onClose }) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState(null);

    useEffect(() => {
        const fetchProfiles = async () => {
            const supabase = createClient();
            try {
                const { data, error } = await supabase.rpc('get_active_staff_profiles_for_test');

                if (error) {
                    console.error('Error fetching profiles via RPC:', error);
                    return;
                }

                if (data) {
                    console.log('✅ Profiles loaded via RPC:', data.length);
                    setProfiles(data);
                    if (data.length > 0) {
                        setSelectedProfile(data[0]);
                    }
                }
            } catch (err) {
                console.error('Unexpected error fetching profiles:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfiles();
    }, []);

    const handleEnterTest = () => {
        if (!selectedProfile) return;
        console.log('🚀 Entering Test Mode with:', selectedProfile);

        // Guardar configuración de test en localStorage con perfil REAL de suplantación
        const testConfig = {
            active: true,
            impersonatedProfile: selectedProfile, // Guardamos el perfil real completo
            role: selectedProfile.role,
            timestamp: new Date().toISOString()
        };
        sessionStorage.setItem('flyhigh_test_mode', JSON.stringify(testConfig));

        // Set cookie for middleware bypass
        document.cookie = "flyhigh_test_mode=true; path=/; max-age=86400; SameSite=Lax";

        // Forzar navegación completa para asegurar que el Dashboard lea el localStorage limpio
        window.location.href = '/staff/dashboard';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                <div className="bg-amber-400 p-4 text-center shrink-0">
                    <h3 className="text-lg font-black text-black">MODO TEST (IMPERSONACIÓN)</h3>
                    <p className="text-xs font-semibold text-amber-900 opacity-80">Selecciona un operativo real para simular</p>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-amber-500" /></div>
                    ) : (
                        profiles.map(profile => (
                            <button
                                key={profile.id}
                                type="button"
                                onClick={() => {
                                    console.log('👆 Clicked profile:', profile.full_name, profile.id);
                                    setSelectedProfile(profile);
                                }}
                                className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${selectedProfile?.id === profile.id
                                    ? 'border-amber-500 bg-amber-50 shadow-md transform scale-[1.02]'
                                    : 'border-slate-100 hover:border-amber-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${profile.role === 'pilot' ? 'bg-blue-500' :
                                    profile.role === 'assistant' ? 'bg-amber-500' : 'bg-purple-500'
                                    }`}>
                                    {getFirstName(profile.full_name).charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{profile.full_name}</div>
                                    <div className="text-xs text-slate-500 capitalize">{ROLE_LABELS[profile.role] || profile.role}</div>
                                </div>
                                {selectedProfile?.id === profile.id && <div className="ml-auto text-amber-600">●</div>}
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-white border border-slate-200 font-bold text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={!selectedProfile}
                        onClick={handleEnterTest}
                        className="flex-1 py-3 px-4 bg-black text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Entrar
                    </button>
                </div>
            </div>
        </div>
    );
}
