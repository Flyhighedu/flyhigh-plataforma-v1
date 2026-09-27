import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { NARRATION_PHASES, hasScript } from '@/lib/narration-workflow.mjs';
import { educationPhase } from '@/lib/education-phases.mjs';
import styles from './PhaseNarrativeEditor.module.css';

export function StoryIllustration({ active = false }) {
    return <svg viewBox="0 0 320 150" className={`${styles.illustration} ${active ? styles.illustrationActive : ''}`} fill="none" aria-hidden="true">
        <ellipse cx="160" cy="77" rx="126" ry="62" fill="#EFF5FF" />
        <path d="M160 70Q70 60 38 105M160 70Q110 65 96 120M160 70V128M160 70Q210 65 224 120M160 70Q250 60 282 105" stroke="#BDD2F5" strokeWidth="2" strokeDasharray="4 5" />
        <g className={styles.floatingBook}><rect x="130" y="18" width="60" height="68" rx="13" fill="#2563EB" /><path d="M145 37H175M145 47H175M145 57H165" stroke="white" strokeWidth="3" strokeLinecap="round" /><circle cx="180" cy="75" r="15" fill="#D9F6E7" /><path d="m174 75 4 4 8-9" stroke="#15804D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></g>
        {[38, 96, 160, 224, 282].map((x, index) => <g key={x} className={styles.storyCard} style={{ animationDelay: `${index * 160}ms` }}><rect x={x - 18} y={index === 0 || index === 4 ? 94 : 106} width="36" height="34" rx="9" fill="white" stroke="#BDD2F5" /><path d={`M${x - 8} ${index === 0 || index === 4 ? 106 : 118}h16m-16 7h10`} stroke="#6092E4" strokeWidth="2" strokeLinecap="round" /></g>)}
    </svg>;
}

export default function NarrationGeneration({ kind, versions, progress, failures, researchStage }) {
    const research = kind === 'research';
    const audio = kind === 'audios';
    const [messageIndex, setMessageIndex] = useState(0);
    useEffect(() => {
        if (!research) return;
        const timer = setInterval(() => setMessageIndex(index => index + 1), 6500);
        return () => clearInterval(timer);
    }, [research]);
    const friendlyMessages = [researchStage || 'Buscando información del lugar', 'Cada lugar tiene una historia que merece contarse.', 'Una buena historia empieza con información confiable.', 'Estamos preparando la base para contarlo a cada nivel.', 'La búsqueda sigue en curso. Gracias por esperar.'];
    const researchMessage = friendlyMessages[messageIndex % friendlyMessages.length];
    const complete = item => audio ? !!versions[item.id]?.audio_url : hasScript(versions[item.id]);
    const count = NARRATION_PHASES.filter(complete).length;
    return <section className={styles.generation} aria-label="Generación en curso">
        <StoryIllustration active />
        <div role="status" aria-live="polite" aria-atomic="true"><span className={styles.eyebrow}>{research ? 'CONOCIENDO EL LUGAR' : audio ? 'DANDO VOZ A TUS HISTORIAS' : 'UNA HISTORIA PARA CADA NIVEL'}</span><h2 tabIndex={-1}>{research ? 'Preparando tu investigación' : audio ? 'Tus guiones están tomando voz' : 'Tus cinco versiones están tomando forma'}</h2>{!research && <p>{`${count} de 5 ${audio ? 'audios listos' : 'guiones terminados'}`}</p>}<p key={research ? researchMessage : undefined} className={styles.generationCurrent}>{research ? researchMessage : progress ? `${audio ? 'Grabando' : 'Preparando'} · ${educationPhase(progress.phase).label}` : 'Un momento…'}</p></div>
        {!research && <><progress value={count} max={5} aria-label={audio ? 'Audios listos' : 'Guiones terminados'} /><div className={styles.generationList}>{NARRATION_PHASES.map(item => <div key={item.id} data-state={complete(item) ? 'done' : failures[item.id] ? 'failed' : progress?.phase === item.id ? 'active' : 'pending'}><span>{complete(item) ? <Check size={17} /> : progress?.phase === item.id ? <Loader2 className={styles.spin} size={17} /> : <span className={styles.dot} />}</span><strong>{item.shortLabel}</strong><small>{complete(item) ? 'Listo' : failures[item.id] ? 'Pendiente de reintento' : progress?.phase === item.id ? 'Creando…' : 'En espera'}</small></div>)}</div></>}
    </section>;
}
