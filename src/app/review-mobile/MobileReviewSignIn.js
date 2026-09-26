'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const labels = { pilot: 'Piloto', teacher: 'Maestra', assistant: 'Auxiliar', supervisor: 'Supervisión general' };
export default function MobileReviewSignIn() {
    const router = useRouter();
    const params = useSearchParams();
    const [error, setError] = useState('');
    const role = params.get('role');
    const tokenHash = params.get('token_hash');
    const next = params.get('next') || '/staff/dashboard';
    const invalid = !tokenHash || !labels[role] || (!next.startsWith('/staff/') && !next.startsWith('/supervisor/'));
    const visibleError = invalid ? 'Este enlace local no es válido. Genera un QR nuevo desde la Mesa.' : error;
    useEffect(() => {
        if (invalid) return;
        let cancelled = false;
        createClient().auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' }).then(({ error: authError }) => {
            if (cancelled) return;
            if (authError) setError('El enlace expiró o ya fue utilizado. Genera un QR nuevo desde la Mesa.');
            else router.replace(next);
        }).catch(() => { if (!cancelled) setError('No se pudo conectar con el laboratorio local.'); });
        return () => { cancelled = true; };
    }, [invalid, next, role, router, tokenHash]);
    return <main className="grid min-h-[100svh] place-items-center bg-[#06182c] p-6 text-white">
        <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-7 text-center shadow-2xl backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-200">FlyHigh · revisión local</p>
            <h1 className="mt-3 text-2xl font-extrabold">{visibleError ? 'No pudimos abrir la sesión' : `Abriendo ${labels[role] || 'perfil'}…`}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{visibleError || 'Mantén este celular en la misma red que la computadora y deja abierta la Mesa de revisión.'}</p>
        </section>
    </main>;
}
