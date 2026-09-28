'use client';
import { useRef } from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, GripVertical, Trash2, Eye, MapPin } from 'lucide-react';
import { moveItem } from '@/lib/narration-preparation.mjs';
import styles from './VisitPlanner.module.css';
function Row({ item, index, count, locked, onMove, onRemove, onSelect, onStart }) {
    const controls = useDragControls();
    const reduced = useReducedMotion();
    return <Reorder.Item as="li" value={item} dragListener={false} dragControls={controls} className={styles.sequenceItem} onDragStart={onStart} transition={{ duration: reduced ? 0 : .18 }}>
        <div className={styles.itemTop}>
            <button className={styles.grip} disabled={locked} aria-label={'Arrastrar ' + item.name} onPointerDown={event => { if (!locked) controls.start(event); }}><GripVertical size={17}/></button>
            <span className={item.behavior === 'reference' ? styles.referenceOrder : styles.order}>{index + 1}</span>
            <button className={styles.itemName} onClick={onSelect}><strong>{item.name}</strong><small>{item.is_general_topic ? 'Tema general' : item.behavior === 'reference' ? 'Referencia · sin desplazamiento' : item.location ? 'Punto de ruta' : 'Ubicación pendiente'}</small></button>
        </div>
        <div className={styles.itemActions}>
            <button disabled={locked || index === 0} aria-label={'Subir ' + item.name} onClick={() => onMove(-1)}><ArrowUp size={16}/></button>
            <button disabled={locked || index === count - 1} aria-label={'Bajar ' + item.name} onClick={() => onMove(1)}><ArrowDown size={16}/></button>
            <span aria-hidden="true">{item.behavior === 'reference' ? <Eye size={15}/> : !item.is_general_topic ? <MapPin size={15}/> : null}</span>
            <button disabled={locked} aria-label={'Quitar ' + item.name} onClick={onRemove}><Trash2 size={16}/></button>
        </div>
    </Reorder.Item>;
}
export default function VisitSequence({ items, locked, edit, audio, onSelect }) {
    const draggingChanged = useRef(false);
    return <Reorder.Group as="ol" axis="y" values={items} className={styles.sequenceList} aria-label="Orden de la experiencia"
        onReorder={next => { edit(next, undefined, 'Orden actualizado', !draggingChanged.current); draggingChanged.current = true; }}>
        {items.map((item,index) => <Row key={item.id} item={item} index={index} count={items.length} locked={locked}
            onStart={() => { draggingChanged.current = false; }}
            onSelect={() => onSelect(item.id)}
            onMove={direction => edit(moveItem(items,index,direction), undefined, `${item.name}: posición ${index + direction + 1}`)}
            onRemove={() => { audio.stop(); edit(items.filter(entry => entry.id !== item.id), undefined, `${item.name} se quitó de la experiencia`); }} />)}
    </Reorder.Group>;
}
