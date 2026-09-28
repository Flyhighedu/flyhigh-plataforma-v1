'use client';
import { useRef, useState } from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, GripVertical, Headphones, Trash2 } from 'lucide-react';
import { durationLabel, moveItem, usableAudio } from '@/lib/narration-preparation.mjs';
import { educationPhase } from '@/lib/education-phases.mjs';
import styles from './VisitPlanner.module.css';
function Row({ item, index, count, locked, onMove, onRemove, onListen, onStart, onEnd }) {
    const controls = useDragControls();
    const reduced = useReducedMotion();
    return <Reorder.Item as="li" value={item} dragListener={false} dragControls={controls} className={styles.sequenceItem} onDragStart={onStart} onDragEnd={onEnd} transition={{ duration: reduced ? 0 : .2 }}>
        <div className={styles.itemTop}><button className={styles.grip} disabled={locked} aria-label={'Arrastrar ' + item.name} onPointerDown={event => { if (!locked) controls.start(event); }}><GripVertical size={18}/></button><span className={styles.order}>{index+1}</span><div><h3>{item.name}</h3><small>{educationPhase(item.phase_id || 'general')?.label} · {durationLabel(item.audio_duration_seconds)}</small></div></div>
        <div className={styles.itemActions}><button className={styles.secondary} disabled={locked || index === 0} aria-label={'Subir ' + item.name} onClick={() => onMove(-1)}><ArrowUp size={15}/></button><button className={styles.secondary} disabled={locked || index === count-1} aria-label={'Bajar ' + item.name} onClick={() => onMove(1)}><ArrowDown size={15}/></button><button className={styles.textButton} disabled={!usableAudio(item.audio_url)} onClick={onListen}><Headphones size={16}/>Escuchar</button><button className={styles.textButton} disabled={locked} aria-label={'Quitar ' + item.name} onClick={onRemove}><Trash2 size={16}/></button></div>
    </Reorder.Item>;
}
export default function VisitSequence({ items, locked, edit, audio }) {
    const [dragItems, setDragItems] = useState(null);
    const latest = useRef(items);
    const values = dragItems || items;
    return <Reorder.Group as="ol" axis="y" values={values} className={styles.sequenceList} onReorder={next => { latest.current = next; setDragItems(next); }}>{values.map((item,index) => <Row key={item.id} item={item} index={index} count={items.length} locked={locked} onStart={() => { latest.current = items; }} onEnd={() => { edit(latest.current); setDragItems(null); }} onMove={direction => edit(moveItem(items,index,direction))} onRemove={() => { audio.stop(); edit(items.filter(entry => entry.id !== item.id)); }} onListen={() => audio.toggle(item)}/>)}</Reorder.Group>;
}
