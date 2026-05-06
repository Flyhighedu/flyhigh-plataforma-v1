'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect: Rutas Maestras is now a sub-tab of Recursos Humanos
export default function RutasMaestrasRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/admin/hr-rutas'); }, [router]);
    return null;
}
