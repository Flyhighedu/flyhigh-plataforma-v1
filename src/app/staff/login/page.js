'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertCircle, Plane, Eye, EyeOff, Share } from 'lucide-react';
import usePWAInstall from '@/hooks/usePWAInstall';

export default function StaffLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showTestModal, setShowTestModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [reviewReady, setReviewReady] = useState(false);
    const router = useRouter();
    const { canInstall, isInstalled, install, showIOSGuide, dismissIOSGuide } = usePWAInstall();
    useEffect(() => { setReviewReady(true); }, []);

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

            // Redirigir según rol
            if (profile.role === 'supervisor') {
                router.push('/supervisor/dashboard');
            } else {
                router.push('/staff/dashboard');
            }
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
        <div className="relative min-h-[100svh] overflow-x-hidden bg-[#031426] text-white">
            <div className="fixed inset-0" aria-hidden="true">
                <Image
                    src="/img/staff-login-school.png"
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-[50%_42%] sm:object-[50%_40%]"
                />
            </div>
            <div className="fixed inset-0 bg-gradient-to-b from-[#031426]/5 via-[#031426]/10 to-[#031426]" aria-hidden="true" />
            <div className="fixed inset-x-0 bottom-0 h-[58%] bg-gradient-to-b from-transparent via-[#031b35]/85 to-[#031426]" aria-hidden="true" />

            <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-8">
                <header className="flex flex-col items-center text-center drop-shadow-[0_2px_12px_rgba(0,20,50,0.4)]">
                    <div className="flex items-center justify-center gap-2.5">
                        <Plane className="h-8 w-8 text-white" strokeWidth={1.8} aria-hidden="true" />
                        <h1 className="text-[1.9rem] font-extrabold tracking-[-0.04em] text-white">
                            FlyHigh<span className="text-cyan-300">Ops</span>
                        </h1>
                    </div>
                    <p className="mt-1.5 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-cyan-200/90">
                        Acceso de operaciones
                    </p>
                </header>

                <div className="min-h-[clamp(9rem,28svh,18rem)] flex-1" aria-hidden="true" />

                <main className="w-full">
                    <div className="mb-5">
                        <h2 className="text-4xl font-extrabold tracking-[-0.045em] text-white drop-shadow-sm sm:text-[2.6rem]">
                            Inicia sesión
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-200 sm:text-base">
                            Identifícate para iniciar operaciones.
                        </p>
                    </div>

                    <form className="space-y-4" data-review-ready={reviewReady ? 'true' : 'false'} onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="staff-email" className="block text-sm font-semibold text-white">
                                Correo electrónico
                            </label>
                            <input
                                id="staff-email"
                                name="email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                                aria-invalid={Boolean(error)}
                                className="mt-1 block w-full border-0 border-b border-cyan-300/80 bg-transparent px-0 py-2.5 text-base text-white outline-none transition-colors placeholder:text-slate-300/65 focus:border-cyan-200 focus:ring-0"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="staff-password" className="block text-sm font-semibold text-white">
                                Contraseña
                            </label>
                            <div className="relative mt-1 border-b border-cyan-300/80 transition-colors focus-within:border-cyan-200">
                                <input
                                    id="staff-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    aria-invalid={Boolean(error)}
                                    className="block w-full border-0 bg-transparent px-0 py-2.5 pr-11 text-base text-white outline-none placeholder:text-slate-300/65 focus:ring-0"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-end text-slate-300 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-300/35 bg-red-950/55 px-3.5 py-3 backdrop-blur-sm" role="alert">
                                <div className="flex items-start gap-2.5">
                                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-200" />
                                    <p className="text-sm leading-relaxed text-red-50">{error}</p>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-[0_10px_30px_rgba(0,102,255,0.24)] transition-all hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#031426] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? (
                                <><Loader2 className="-ml-1 mr-2 h-5 w-5 animate-spin" /> Ingresando...</>
                            ) : (
                                'Iniciar sesión'
                            )}
                        </button>
                    </form>

                    <p className="mt-4 text-center text-xs leading-relaxed text-slate-300">
                        Tu cuenta la crea el administrador.<br />
                        Si no tienes acceso, contacta a tu coordinador.
                    </p>

                    {canInstall && !isInstalled && (
                        <div className="mt-3 flex justify-center">
                            <button
                                type="button"
                                onClick={install}
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm transition-all hover:border-cyan-200/50 hover:bg-white/15 hover:text-white active:scale-[0.97]"
                            >
                                <Image src="/img/app-icon.png" alt="" width={16} height={16} className="h-4 w-4 rounded" />
                                Instalar app
                                <span className="text-slate-400">›</span>
                            </button>
                        </div>
                    )}

                    {process.env.NEXT_PUBLIC_FLYHIGH_REVIEW_LAB !== '1' && (
                        <div className="mt-4 border-t border-white/10 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowTestModal(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                            >
                                <span>🛠️</span> Entrar en modo test
                            </button>
                        </div>
                    )}
                </main>
            </div>

            {process.env.NEXT_PUBLIC_FLYHIGH_REVIEW_LAB !== '1' && showTestModal && <TestModeModal onClose={() => setShowTestModal(false)} />}

            {/* ─── iOS Install Guide Overlay ─── */}
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
                                    <p className="text-sm font-bold text-slate-800">Selecciona &quot;Añadir a Inicio&quot;</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Desliza hacia abajo en el menú para encontrarlo.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Toca &quot;Añadir&quot;</p>
                                    <p className="text-xs text-slate-500 mt-0.5">¡Listo! La app aparecerá en tu pantalla de inicio.</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={dismissIOSGuide} className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors">
                            Entendido
                        </button>
                    </div>
                </div>
            )}
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
    supervisor: 'Supervisor',
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
