'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clamp } from '@/lib/flight-rehearsal.mjs';
import styles from './FlightRehearsalScreen.module.css';

export function FloatingJoystick({ controlRef, label, side, onChange }) {
    const pad = useRef(null);
    const drag = useRef(null);
    const [center, setCenter] = useState(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const stop = useCallback(() => {
        drag.current = null;
        setCenter(null);
        setKnob({ x: 0, y: 0 });
        onChange({ x: 0, y: 0 });
    }, [onChange]);
    useImperativeHandle(controlRef, () => ({
        start(event, bounds) {
            if (drag.current) return false;
            const radius = pad.current.getBoundingClientRect().width / 2;
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, maximum: radius * 0.62 };
            setCenter({ x: clamp(event.clientX - bounds.left, radius + 8, bounds.width - radius - 8), y: clamp(event.clientY - bounds.top, radius + 8, bounds.height - radius - 24), radius });
            setKnob({ x: 0, y: 0 });
            onChange({ x: 0, y: 0 });
            return true;
        },
        move(event) {
            const start = drag.current;
            if (start?.id !== event.pointerId) return;
            let x = event.clientX - start.x;
            let y = event.clientY - start.y;
            const length = Math.hypot(x, y);
            if (length > start.maximum) { x *= start.maximum / length; y *= start.maximum / length; }
            setKnob({ x, y });
            // Small touch jitter should not start a flight movement.
            onChange(length < 3 ? { x: 0, y: 0 } : { x: x / start.maximum, y: -y / start.maximum });
        },
        end(event) { if (drag.current?.id === event.pointerId) stop(); },
        stop,
    }), [onChange, stop]);
    useEffect(() => {
        const hidden = () => { if (document.hidden) stop(); };
        window.addEventListener('blur', stop);
        window.addEventListener('resize', stop);
        document.addEventListener('visibilitychange', hidden);
        return () => { window.removeEventListener('blur', stop); window.removeEventListener('resize', stop); document.removeEventListener('visibilitychange', hidden); };
    }, [stop]);
    return <div className={`${styles.joystick} pointer-events-none absolute z-10 select-none text-center text-white`} style={center ? { left: center.x, top: center.y, transform: `translate(-50%, -${center.radius}px)` } : { bottom: 32, [side]: 20 }}>
        <div ref={pad} role="application" aria-label={label} className="pointer-events-auto relative h-28 w-28 touch-none rounded-full border border-white/35 bg-slate-950/55 shadow-lg sm:h-32 sm:w-32">
            <span className="absolute inset-x-3 top-1/2 h-px bg-white/20" />
            <span className="absolute inset-y-3 left-1/2 w-px bg-white/20" />
            <span className="absolute left-1/2 top-1/2 h-11 w-11 rounded-full border border-cyan-200/60 bg-cyan-400/30" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
    </div>;
}

export function RelativeGimbal({ value, onChange }) {
    const drag = useRef(null);
    const release = event => { if (drag.current?.id === event.pointerId) drag.current = null; };
    return <div className={`${styles.gimbal} absolute right-3 top-[18rem] z-10 flex h-44 w-12 flex-col items-center rounded-2xl border border-white/20 bg-slate-950/75 py-2`}>
        <span className="text-[8px] font-black uppercase text-slate-200">Gimbal</span>
        <div role="slider" tabIndex={0} aria-label="Inclinación del gimbal" aria-valuemin={-90} aria-valuemax={0} aria-valuenow={value} aria-valuetext={`${value} grados`} aria-orientation="vertical"
            className={`${styles.gimbalTrack} relative mt-2 h-28 w-10 touch-none cursor-ns-resize rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-300`}
            onPointerDown={event => {
                event.stopPropagation();
                if (drag.current) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { id: event.pointerId, y: event.clientY, value, height: event.currentTarget.getBoundingClientRect().height };
            }}
            onPointerMove={event => {
                if (drag.current?.id !== event.pointerId) return;
                onChange(Math.round(clamp(drag.current.value + (drag.current.y - event.clientY) / drag.current.height * 90, -90, 0)));
            }}
            onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
            onKeyDown={event => {
                const increment = event.shiftKey ? 5 : 1;
                const next = { ArrowUp: value + increment, ArrowRight: value + increment, ArrowDown: value - increment, ArrowLeft: value - increment, Home: -90, End: 0 }[event.key];
                if (next !== undefined) { event.preventDefault(); onChange(clamp(next, -90, 0)); }
            }}>
            <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-slate-400" />
            <span className="absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-cyan-500" style={{ height: `${(value + 90) / 90 * 100}%` }} />
            <span className="absolute left-1/2 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-400" style={{ bottom: `${(value + 90) / 90 * 100}%` }} />
        </div>
    </div>;
}
