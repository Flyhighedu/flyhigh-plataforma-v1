'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { durationLabel } from '@/lib/narration-preparation.mjs';
import { PreparationDialog } from './NarrationLibrary';
import { Notice, primary, secondary } from './PreparationUI';

export default function Rehearsal({ items, audio, onClose }) {
    const [index, setIndex] = useState(0);
    const [complete, setComplete] = useState(false);
    const [message, setMessage] = useState('');
    const item = items[index];
    const { stop, onEnded } = audio;
    useEffect(() => {
        onEnded(() => {
            stop();
            if (index + 1 < items.length) { setIndex(index + 1); setMessage('Audio terminado. La siguiente narración está preparada.'); }
            else { setComplete(true); setMessage('Terminaste de ensayar la secuencia.'); }
        });
        return () => onEnded(null);
    }, [index, items.length, onEnded, stop]);
    useEffect(() => () => stop(), [stop]);
    const active = audio.id === item.id;
    return <PreparationDialog title="Ensayar secuencia" onClose={onClose}>
        <p className="text-xs font-semibold text-slate-500">Ensayo · No inicia ni registra un vuelo</p>
        <div className="rounded-3xl bg-[#0a2b55] p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{complete ? 'Ensayo terminado' : `Narración ${index + 1} de ${items.length}`}</p>
            <h3 className="mt-4 text-2xl font-extrabold leading-tight">{complete ? 'Tu secuencia, de principio a fin' : item.name}</h3>
            <p className="mt-3 text-sm text-blue-100">{complete ? 'Puedes repetir el ensayo o volver a preparar la visita.' : 'Reproduce cuando corresponda. La siguiente esperará tu indicación.'}</p>
            {!complete && <>
                <progress aria-label="Progreso del audio" className="mt-6 h-1.5 w-full accent-cyan-300" value={active ? audio.time : 0} max={active && audio.duration ? audio.duration : 1} />
                <p className="mt-2 text-xs text-blue-100">{active && audio.time > 0 ? durationLabel(audio.time) : '0:00'} / {durationLabel(active && audio.duration ? audio.duration : item.audio_duration_seconds)}</p>
                <button className={`${primary} mt-5 w-full !bg-white !text-[#0a2b55]`} disabled={audio.status === 'loading'} onClick={() => audio.toggle(item)}>{active && audio.status === 'playing' ? <Pause size={21} /> : <Play size={21} />}{active && audio.status === 'playing' ? 'Pausar' : active && audio.status === 'paused' ? 'Continuar' : audio.status === 'loading' ? 'Cargando audio…' : 'Reproducir narración'}</button>
            </>}
        </div>
        <p role="status" aria-live="polite" className="text-sm font-medium text-slate-600">{message}</p>
        {audio.error && <Notice>{audio.error}<button className={`${secondary} mt-3`} onClick={() => audio.toggle(item)}>Reintentar audio</button></Notice>}
        {!complete && <>
            <div className="flex flex-wrap gap-2"><button onClick={() => { stop(); setMessage('Audio detenido. Puedes reproducirlo desde el inicio.'); }} className={secondary}><Square size={15} />Detener</button><button onClick={() => { stop(); if (index + 1 < items.length) { setIndex(index + 1); setMessage('Narración omitida. La siguiente está preparada.'); } else { setComplete(true); setMessage('Secuencia finalizada.'); } }} className={`${secondary} ml-auto`}>Omitir<ChevronRight size={16} /></button></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Después</p><p className="mt-1 font-bold">{items[index + 1]?.name || 'Fin de la secuencia'}</p></div>
        </>}
        {complete && <><button className={`${primary} w-full`} onClick={onClose}><Check size={18} />Volver a la preparación</button><button className={`${secondary} w-full`} onClick={() => { stop(); setIndex(0); setComplete(false); setMessage(''); }}><RotateCcw size={16} />Ensayar de nuevo</button></>}
    </PreparationDialog>;
}
