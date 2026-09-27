'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { swipeDestination } from '@/lib/narration-gestures.mjs';
import styles from './PhaseNarrativeEditor.module.css';

export default function NarrationCarousel({ items, selectedId, versions, onSelect, disabled, children, hintSeenRef }) {
    const index = items.findIndex(item => item.id === selectedId);
    const frame = useRef(null);
    const gesture = useRef(null);
    const hintTimer = useRef(null);
    const suppressClick = useRef(false);
    const [offset, setOffset] = useState(0);
    const [settling, setSettling] = useState(false);
    const controls = useAnimationControls();
    const reduced = useReducedMotion();

    useEffect(() => {
        if (items.length < 2 || hintSeenRef.current || disabled || reduced) return;
        hintTimer.current = setTimeout(() => { hintSeenRef.current = true; controls.start({ x: [0, -26, 4, 0], transition: { duration: .85 } }); }, 650);
        return () => { clearTimeout(hintTimer.current); controls.stop(); };
    }, [controls, disabled, hintSeenRef, items.length, reduced]);

    async function finish(event, cancelled = false) {
        const start = gesture.current;
        gesture.current = null;
        if (!start) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        const target = cancelled ? index : swipeDestination({ index, count: items.length, dx, dy, elapsed: performance.now() - start.time, width: frame.current?.clientWidth || 320 });
        if (target !== index) {
            setSettling(true);
            await controls.start({ x: target > index ? -(frame.current.clientWidth + 16) : frame.current.clientWidth + 16, transition: { duration: reduced ? 0 : .18, ease: 'easeOut' } });
            onSelect(items[target].id);
        }
        if (target === index && start.horizontal) await controls.start({ x: 0, transition: { duration: reduced ? 0 : .2, ease: 'easeOut' } });
        else controls.set({ x: 0 });
        setOffset(0); setSettling(false);
    }

    return <>
        <div ref={frame} className={styles.carousel} role="group" aria-roledescription="carrusel" aria-label="Guiones por nivel" onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
            onPointerDown={event => {
                suppressClick.current = false;
                if (disabled || settling || !event.isPrimary || event.button !== 0 || event.target.closest('button,input,textarea,select,audio,summary,a')) return;
                clearTimeout(hintTimer.current); hintSeenRef.current = true; controls.stop();
                gesture.current = { x: event.clientX, y: event.clientY, time: performance.now(), horizontal: false };
            }}
            onPointerMove={event => {
                const start = gesture.current;
                if (!start) return;
                const dx = event.clientX - start.x, dy = event.clientY - start.y;
                if (!start.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
                if (!start.horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    start.horizontal = true; suppressClick.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                }
                if (!start.horizontal) return;
                const edge = (index === 0 && dx > 0) || (index === items.length - 1 && dx < 0);
                const value = edge ? dx * .18 : dx;
                setOffset(value); controls.set({ x: value });
            }} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
            <motion.div className={styles.carouselTrack} animate={controls} style={{ userSelect: offset ? 'none' : undefined }}>
                {[index - 1, index + 1].filter(i => items[i]).map(i => <div key={items[i].id} aria-hidden="true" className={styles.carouselNeighbor} style={{ left: i < index ? 'calc(-100% - 16px)' : 'calc(100% + 16px)' }}><h2>{items[i].label}</h2><p>{versions[items[i].id]?.narrative_script}</p></div>)}
                <div className={styles.scriptCanvas}>{children}</div>
            </motion.div>
        </div>
        {items.length > 1 && <nav className={styles.positionDots} aria-label="Seleccionar nivel educativo">{items.map(item => <button type="button" key={item.id} aria-label={item.label} aria-current={item.id === selectedId ? 'true' : undefined} disabled={disabled || settling} onClick={() => { clearTimeout(hintTimer.current); hintSeenRef.current = true; controls.set({ x: 0 }); onSelect(item.id); }}><span /></button>)}</nav>}
    </>;
}
