'use client';

import { useLayoutEffect, useRef } from 'react';
import styles from './PhaseNarrativeEditor.module.css';

export function GrowingTextarea({ value, ...props }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const element = ref.current;
        const resize = () => { element.style.height = 'auto'; element.style.height = `${element.scrollHeight + 2}px`; };
        resize();
        let width = element.clientWidth;
        const observer = new ResizeObserver(() => {
            if (width !== element.clientWidth) { width = element.clientWidth; resize(); }
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [value]);
    return <textarea {...props} ref={ref} value={value} rows={1} />;
}

export default function NarrationDocument({ text, label }) {
    return <article className={styles.document} aria-label={label}>{text.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
        const lines = block.split('\n');
        return <div key={index}>{lines.map((line, lineIndex) => /^#{1,6}\s/.test(line)
            ? <h3 key={lineIndex}>{line.replace(/^#{1,6}\s+/, '')}</h3>
            : <p key={lineIndex}>{line}</p>)}</div>;
    })}</article>;
}
