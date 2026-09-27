'use client';
import { useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import styles from './NarrationLibrary.module.css';
export default function MapPlacePreview({ poi, existing, onClose, onContinue }) {
    const ref = useRef(null);
    useEffect(() => {
        const dialog = ref.current;
        const previous = document.activeElement;
        dialog.showModal();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const rect = dialog.getBoundingClientRect();
            const origin = poi._origin;
            dialog.animate([{ opacity: 0, transform: origin ? 'translate(' + (origin.x - rect.x - rect.width/2) + 'px,' + (origin.y - rect.y - rect.height/2) + 'px) scale(.2)' : 'translateY(18px)' }, { opacity: 1, transform: 'translate(0,0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
        return () => { dialog.close(); previous?.focus?.(); };
    }, [poi]);
    return <dialog ref={ref} className={styles.createDialog} aria-labelledby="place-preview-title" onCancel={event => { event.preventDefault(); onClose(); }}><div className={styles.dialogHeading}><MapPin size={25}/><h2 id="place-preview-title">{poi.name || 'Nuevo lugar'}</h2><button className={styles.secondary} aria-label="Cerrar" onClick={onClose}><X size={19}/></button></div><p className="mb-5 text-sm text-slate-500">{existing ? 'Este lugar ya tiene una narración.' : poi.description || 'Crea la narración de este punto del mapa.'}</p><button className={styles.primary} onClick={() => onContinue(existing)}>{existing ? 'Abrir narración' : 'Crear narración'}</button></dialog>;
}
