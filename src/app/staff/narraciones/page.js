'use client';

import Link from 'next/link';
import NarrationsScreen from '@/components/staff/preparation/NarrationsScreen';
import { LoadingPreparation, Notice, usePreparationData, secondary } from '@/components/staff/preparation/PreparationUI';

export default function Page() {
    const { data, loading, error, retry } = usePreparationData();
    if (!loading && !error) return <NarrationsScreen initialCatalog={data.catalog} userId={data.userId} />;
    return <main className="min-h-[100svh] bg-white text-[#142338]">
        <header className="bg-[#1264b8] px-4 pb-7 pt-[max(1.25rem,env(safe-area-inset-top))] text-white"><div className="mx-auto max-w-5xl"><Link href="/staff/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold">← Inicio</Link><h1 className="mt-5 text-3xl font-extrabold">Narraciones</h1></div></header>
        <div className="mx-auto max-w-5xl px-4 pt-5">{loading ? <LoadingPreparation /> : <Notice action={<button onClick={retry} className={secondary}>Reintentar</button>}>{error}</Notice>}</div>
    </main>;
}
