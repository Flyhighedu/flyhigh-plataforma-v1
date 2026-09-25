'use client';

import Link from 'next/link';
import NarrationLibrary from '@/components/staff/preparation/NarrationLibrary';
import useNarrationAudio from '@/components/staff/preparation/useNarrationAudio';
import { PreparationShell, LoadingPreparation, Notice, usePreparationData, secondary, card } from '@/components/staff/preparation/PreparationUI';

export default function Page() {
    const { data, loading, error, retry } = usePreparationData();
    const audio = useNarrationAudio();
    return <PreparationShell title="Narraciones" subtitle="Explora lugares y temas. Escucha su voz y conoce lo que puedes contar.">
        <div className={card}><h2 className="font-bold">¿Preparando una visita?</h2><p className="mt-1 text-sm text-slate-500">Elige una escuela para guardar las narraciones en el orden en que las usarás.</p><Link href="/staff/cronograma" onClick={audio.stop} className={`${secondary} mt-3`}>Ir al cronograma</Link></div>
        {loading ? <LoadingPreparation /> : error ? <Notice action={<button onClick={retry} className={secondary}>Reintentar</button>}>{error}</Notice> : <NarrationLibrary catalog={data.catalog} audio={audio} />}
    </PreparationShell>;
}
