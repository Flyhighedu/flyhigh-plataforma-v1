'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

export default function StaffLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Dynamic import to avoid build issues if lib files require env vars not ready yet
        // But standard import above is fine given structure.


        const supabase = createClient();

        try {
            let errorResult;

            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                errorResult = error;
                if (!error) {
                    alert('Registro exitoso! Por favor inicia sesión (o verifica tu email si es necesario).');
                    setIsSignUp(false); // Switch back to login
                    setLoading(false);
                    return;
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                errorResult = error;
            }

            const authError = errorResult;

            if (authError) {
                throw authError; // triggers catch
            }

            router.push('/staff');
            router.refresh(); // Refresh to update middleware protection state via cookies if needed
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleTestLogin = async () => {
        setLoading(true);
        const supabase = createClient();
        const testEmail = 'staff_test@flyhigh.com';
        const testPass = 'flyhigh_test_123';

        try {
            // Attempt login
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: testEmail,
                password: testPass
            });

            if (loginError) {
                // If invalid login, maybe user doesn't exist. Try to create it.
                if (loginError.message.includes("Invalid login")) {
                    const { error: signUpError } = await supabase.auth.signUp({
                        email: testEmail,
                        password: testPass
                    });

                    if (signUpError) throw signUpError;

                    // After signup, try login again
                    const { error: retryError } = await supabase.auth.signInWithPassword({
                        email: testEmail,
                        password: testPass
                    });
                    if (retryError) throw retryError;
                } else {
                    throw loginError;
                }
            }

            router.push('/staff/dashboard');
            router.refresh();

        } catch (err) {
            console.error("Test login failed:", err);
            alert("Error en Modo Test: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-slate-900">Staff Access</h1>
                    <p className="mt-2 text-sm text-slate-600">Identifícate para iniciar operaciones.</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="mt-1 block w-full px-3 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="staff@flyhigh.edu"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Contraseña</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="mt-1 block w-full px-3 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-4 border border-red-200">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">Error de acceso</h3>
                                    <div className="mt-2 text-sm text-red-700">
                                        <p>{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Procesando...</>
                            ) : (
                                isSignUp ? 'Registrarse' : 'Iniciar Sesión'
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
                        </button>
                    </div>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={handleTestLogin}
                        disabled={loading}
                        className="w-full py-2 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        🚀 Entrar como Tester (Auth Real)
                    </button>
                </div>
            </div>
        </div>
    );
}
