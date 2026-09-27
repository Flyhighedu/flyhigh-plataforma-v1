'use client';
import { useEffect, useRef } from 'react';
import { BookOpen, MapPin, X } from 'lucide-react';
import styles from './NarrationLibrary.module.css';
export default function CreateNarrationDialog({ onClose, onPlace, onTopic }) {
    const ref = useRef(null);
    useEffect(() => {
        const previous = document.activeElement;
        const dialog = ref.current;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) dialog.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
        return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
    }, []);
    return <dialog ref={ref} className={styles.createDialog} aria-labelledby="create-narration-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
        <div className={styles.dialogHeading}><h2 id="create-narration-title">Crear narración</h2><button className={styles.secondary} onClick={onClose} aria-label="Cerrar"><X size={19}/></button></div>
        <button className={styles.createChoice} onClick={onPlace}><MapPin size={27}/><span><strong>De un lugar</strong><small>Encuéntralo en el mapa</small></span></button>
        <button className={styles.createChoice} onClick={onTopic}><BookOpen size={27}/><span><strong>De un tema</strong><small>Crea una historia sin ubicación</small></span></button>
    </dialog>;
}
