'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { coordinates } from '@/lib/narration-preparation.mjs';
import TakeoffMap from './TakeoffMap';
import { LoadingPreparation, Notice, PreparationShell, secondary, usePreparationData } from './PreparationUI';
import useNarrationAudio from './useNarrationAudio';
import styles from './FlightRehearsalScreen.module.css';
const RehearsalMap = dynamic(() => import('./FlightRehearsalScreen').then(module => module.RehearsalMap), {ssr:false});
const visit = { id:null, nombre_escuela:'Ensayo libre' };
const selected = new Set();
export default function FreeFlightScreen() {
    const {data,loading,error,retry} = usePreparationData();
    const [departure,setDeparture] = useState(null);
    const audio = useNarrationAudio();
    const router = useRouter();
    const pois = useMemo(() => (data?.catalog || []).filter(poi => !poi.is_general_topic && coordinates(poi.latitude,poi.longitude)).map(poi => ({...poi,latitude:Number(poi.latitude),longitude:Number(poi.longitude)})), [data?.catalog]);
    if (loading || error) return <PreparationShell title="Ensayo con relieve 3D">{loading ? <LoadingPreparation/> : <Notice action={<button className={secondary} onClick={retry}>Reintentar</button>}>{error}</Notice>}</PreparationShell>;
    if (!departure) return <main className={styles.screen}><TakeoffMap onConfirm={setDeparture} onCancel={() => router.push('/staff/dashboard')}/></main>;
    return <RehearsalMap visit={visit} pois={pois} selectedIds={selected} audio={audio} departure={departure} google3d freeFlight onExit={() => { audio.stop(); router.push('/staff/dashboard'); }}/>;
}
