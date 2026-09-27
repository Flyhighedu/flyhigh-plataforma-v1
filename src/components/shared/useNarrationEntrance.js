'use client';
import { useLayoutEffect, useRef } from 'react';

export function narrationOrigin(element) {
    if (!element?.getBoundingClientRect) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, element };
}

export default function useNarrationEntrance(ref, origin, onClose) {
    const closing = useRef(false);
    useLayoutEffect(() => {
        const panel = ref.current;
        if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const rect = panel.getBoundingClientRect();
        const dx = origin ? origin.x - rect.x - rect.width / 2 : 0;
        const dy = origin ? origin.y - rect.y - rect.height / 2 : 20;
        const animation = panel.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${origin ? .08 : .97})`, opacity: .2, borderRadius: '32px' },
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ], { duration: origin ? 420 : 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
        const contents = [...panel.children].map(child => child.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: origin ? 140 : 0, fill: 'backwards' }));
        return () => { animation.cancel(); contents.forEach(item => item.cancel()); };
    }, [origin, ref]);
    return async () => {
        if (closing.current) return;
        closing.current = true;
        const panel = ref.current;
        if (panel && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const rect = panel.getBoundingClientRect();
            const target = origin?.element?.isConnected ? narrationOrigin(origin.element) : null;
            const visible = target && target.x >= 0 && target.x <= window.innerWidth && target.y >= 0 && target.y <= window.innerHeight;
            try { await panel.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: visible ? `translate(${target.x - rect.x - rect.width / 2}px, ${target.y - rect.y - rect.height / 2}px) scale(.08)` : 'translateY(12px) scale(.97)', opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' }).finished; } catch { /* unmounted */ }
        }
        onClose();
    };
}
