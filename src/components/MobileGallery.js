"use client";
import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, useTransform, useScroll, useSpring, useVelocity, useMotionValueEvent, animate, useMotionValue, AnimatePresence, useTime } from 'framer-motion';
import { Play, ArrowUp, Wind, Cloud, Sparkles, MapPin, MousePointer2, Bird, Plane, X, ChevronDown, Triangle, Heart, MessageCircle } from 'lucide-react';

const testimonials = [
    {
        id: "01",
        quote: "HABÍA UNA ALEGRÍA QUE VIBRABA EN EL PATIO.",
        author: "Mtra. Lucina",
        school: "Esc. I.M. Altamirano",
        image: "/img/Portada Altamirano Uruapan.jpg",
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-little-boy-wearing-a-superhero-cape-standing-in-a-field-28499-large.mp4",
        location: "Volcán Paricutín",
        serial: "FLP-001 // 2025"
    },
    {
        id: "02",
        quote: "DESCUBRIMOS UNA CHISPA INCREÍBLE EN ELLOS.",
        author: "Mtra. Xatziri",
        school: "Esc. Benito Juárez",
        image: "/img/Portada 2 niños.jpg",
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-green-jungle-3486-large.mp4",
        location: "Fábrica San Pedro",
        serial: "FLP-002 // 2025"
    },
    {
        id: "03",
        quote: "LO IMPOSIBLE HOY ES UNA HERRAMIENTA REAL.",
        author: "Mtra. Karina",
        school: "Colegio La Paz",
        image: "/img/Estoy viendo la fabrica.png",
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-drone-flying-over-a-rural-area-in-the-mountains-43958-large.mp4",
        location: "Parque Nacional",
        serial: "FLP-003 // 2025"
    }
];

// --- COMPONENTES ATMOSFÉRICOS ---

// --- MOTOR ATMOSFÉRICO UNIFICADO (Optimización para Gama Baja) ---

const UnifiedSkyEngine = memo(({ progress }) => {
    const canvasRef = useRef(null);
    const bufferRef = useRef(null);

    const elements = useMemo(() => ({
        clouds: Array.from({ length: 16 }).map((_, i) => {
            const isForeground = i % 3 === 0;
            return {
                type: 'cloud',
                x: Math.random() * 120 - 10,
                y: Math.random() * 500 - 100,
                scale: isForeground ? (Math.random() * 4 + 6) : (Math.random() * 3 + 2),
                speed: isForeground ? (Math.random() * 2.5 + 1.5) : (Math.random() * 0.8 + 0.4),
                rotate: Math.random() * 360,
                opacity: isForeground ? (Math.random() * 0.2 + 0.3) : (Math.random() * 0.3 + 0.4),
                isForeground
            };
        })
    }), []);

    useEffect(() => {
        const buffer = document.createElement('canvas');
        buffer.width = 160;
        buffer.height = 100;
        const bctx = buffer.getContext('2d');

        // Dibujamos una forma de nube más definida con múltiples círculos
        const drawpuffy = (x, y, r, opacity) => {
            const g = bctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
            g.addColorStop(0.7, `rgba(255, 255, 255, ${opacity * 0.4})`);
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            bctx.fillStyle = g;
            bctx.beginPath();
            bctx.arc(x, y, r, 0, Math.PI * 2);
            bctx.fill();
        };

        // Componemos la nube: Centro principal y bultos laterales
        drawpuffy(80, 50, 45, 0.8);  // Centro
        drawpuffy(45, 55, 30, 0.6);  // Izquierda
        drawpuffy(115, 55, 30, 0.6); // Derecha
        drawpuffy(65, 35, 25, 0.5);  // Arriba Izq
        drawpuffy(95, 35, 25, 0.5);  // Arriba Der

        bufferRef.current = buffer;
    }, []);

    const timeRef = useRef(0);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !bufferRef.current) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const p = progress.get();
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        // Incrementar tiempo para animación automática (más rápido)
        timeRef.current += 1;

        // DIBUJAR NUBES (Parallax + Animación automática)
        elements.clouds.forEach(c => {
            // Combinar progreso del scroll con movimiento automático basado en tiempo
            const scrollMovement = p * c.speed * 2500;
            const autoMovement = timeRef.current * c.speed * 4; // Movimiento más rápido
            const currentY = ((c.y + scrollMovement + autoMovement) % (height * 4)) - height;

            if (currentY < -400 || currentY > height + 400) return;

            const scale = c.scale * (width / 400);
            ctx.globalAlpha = c.opacity * Math.max(0.6, Math.min(1, (1.2 - p) * 3));

            ctx.save();
            ctx.translate(c.x * (width / 100), currentY);
            ctx.rotate(c.rotate);
            ctx.scale(scale, scale);
            ctx.drawImage(bufferRef.current, -80, -50);
            ctx.restore();
        });
    }, [elements, progress]);


    useEffect(() => {
        let raf;
        const loop = () => { draw(); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-[5]"
            width={window.innerWidth * 0.5}
            height={window.innerHeight * 0.5}
            style={{ width: '100%', height: '100%', willChange: 'transform' }}
        />
    );
});
UnifiedSkyEngine.displayName = 'UnifiedSkyEngine';


const CelestialAscentBackground = ({ progress }) => {
    // Cielo con más color desde el inicio para ver las nubes
    const skyGradient = useTransform(progress, [0, 0.08, 0.4, 0.7, 1], [
        "linear-gradient(to bottom, #e0f2fe, #bae6fd, #e0f2fe)",       // INICIO: Azul suave visible
        "linear-gradient(to bottom, #bae6fd, #7dd3fc, #e0f2fe)",      // Cielo emergiendo
        "linear-gradient(to bottom, #38bdf8, #7dd3fc, #bae6fd)",      // Ascenso medio
        "linear-gradient(to bottom, #0284c7, #38bdf8, #7dd3fc)",      // Altura alta
        "linear-gradient(to bottom, #0c4a6e, #0284c7, #38bdf8)"       // Espacio cercano
    ]);

    return (
        <motion.div style={{ background: skyGradient }} className="absolute inset-0 z-0 overflow-hidden pointer-events-none transform-gpu contain-paint">
            <UnifiedSkyEngine progress={progress} />


            {/* NIEBLA SUPERIOR - Reducida para ver nubes */}
            <motion.div
                style={{ opacity: useTransform(progress, [0, 0.15], [0.6, 0]) }}
                className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-slate-100/80 via-white/40 to-transparent z-[10]"
            />

            {/* NIEBLA INFERIOR */}
            <motion.div
                style={{ opacity: useTransform(progress, [0, 0.2], [0.3, 0]) }}
                className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/50 to-transparent z-[10]"
            />
        </motion.div>
    );
};

const NavigationDot = memo(({ index, progress, totalPoints }) => {
    const target = index / (totalPoints - 1);
    // Rangos overlapped para transición suave entre dots
    const isActive = useTransform(progress,
        [target - 0.15, target - 0.03, target + 0.03, target + 0.15],
        [0, 1, 1, 0]
    );
    const scale = useTransform(isActive, [0, 0.5, 1], [1, 1.3, 2]);
    const opacity = useTransform(isActive, [0, 0.3, 1], [0.3, 0.6, 1]);
    // Spring más suave para transición fluida
    const springScale = useSpring(scale, { stiffness: 300, damping: 25, mass: 0.8 });
    const springOpacity = useSpring(opacity, { stiffness: 200, damping: 20 });

    return (
        <motion.div
            style={{ scale: springScale, opacity: springOpacity }}
            className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)] will-change-transform"
        />
    );
});
NavigationDot.displayName = 'NavigationDot';

const NavigationDots = memo(({ progress, count }) => {
    return (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <NavigationDot key={i} index={i} progress={progress} totalPoints={count} />
            ))}
        </div>
    );
});
NavigationDots.displayName = 'NavigationDots';

const TestimonialCard = memo(({ testimonial, index, progress, velocity, onOpen, totalCards }) => {
    const isLast = index === totalCards - 1;
    const centerPoint = (index + 1) / (totalCards + 2 - 1);

    // Configuración especial para la última tarjeta
    const opacityRange = isLast ? [centerPoint - 0.1, centerPoint, 0.95, 1] : [centerPoint - 0.1, centerPoint, centerPoint + 0.1];
    const opacityValues = isLast ? [0, 1, 1, 1] : [0, 1, 0];

    const scaleRange = isLast ? [centerPoint - 0.1, centerPoint, 1] : [centerPoint - 0.1, centerPoint, centerPoint + 0.1];
    const scaleValues = isLast ? [0.88, 1, 0.85] : [0.88, 1, 0.88];

    const yRange = isLast ? [centerPoint - 0.1, centerPoint, 1] : [centerPoint - 0.1, centerPoint, centerPoint + 0.1];
    const yValues = isLast ? [120, 0, -80] : [120, 0, -120];

    const opacity = useTransform(progress, opacityRange, opacityValues);
    const scale = useTransform(progress, scaleRange, scaleValues);
    const y = useTransform(progress, yRange, yValues);

    // Sombra dinámica basada en posición
    const shadowOpacity = useTransform(opacity, [0, 0.5, 1], [0, 0.2, 0.4]);
    const zIndex = useTransform(opacity, [0, 0.5, 1], [0, 5, 10]);

    const rotateX = useTransform(velocity, [-500, 500], [-8, 8]);

    const [pointerEnabled, setPointerEnabled] = useState(false);
    useMotionValueEvent(opacity, "change", (v) => {
        if (v > 0.8 && !pointerEnabled) setPointerEnabled(true);
        else if (v <= 0.8 && pointerEnabled) setPointerEnabled(false);
    });

    return (
        <motion.div
            style={{
                opacity, scale, y, rotateX, zIndex,
                pointerEvents: pointerEnabled ? 'auto' : 'none',
                willChange: 'transform, opacity',
                boxShadow: useTransform(shadowOpacity, v => `0 30px 60px rgba(0,0,0,${v}), 0 0 0 1px rgba(255,255,255,0.1)`)
            }}
            className="absolute w-[80vw] max-w-[340px] aspect-[9/16] bg-slate-900 rounded-[32px] overflow-hidden"
        >
            {/* Borde luminoso animado */}
            <div className="absolute inset-0 rounded-[32px] p-[1px] bg-gradient-to-b from-white/30 via-white/5 to-white/20 pointer-events-none" />

            <img
                src={testimonial.image}
                className="absolute inset-0 w-full h-full object-cover"
                alt="Card"
                loading="lazy"
                decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            <div className="absolute inset-0 p-7 flex flex-col justify-between">
                {/* Badge Premium con glow - Eliminado Nivel por UX refinement */}
                <div className="flex items-center justify-end">
                    <div className="text-white/20 font-mono text-[8px] tracking-tight">{testimonial.serial.split(' // ')[0]}</div>
                </div>

                {/* Botón Play con pulse */}
                <motion.button
                    onClick={() => onOpen(index)}
                    whileTap={{ scale: 0.9 }}
                    className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mx-auto shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative"
                >
                    <motion.div
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-full bg-white/20"
                    />
                    <Play className="fill-white text-white ml-1 w-6 h-6 relative z-10" />
                </motion.button>

                {/* Info inferior */}
                <div className="space-y-3">
                    <h3 className="text-xl font-black text-white leading-tight italic drop-shadow-lg">"{testimonial.quote}"</h3>
                    <div className="flex items-center gap-3 border-t border-white/10 pt-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center font-black text-white shadow-lg text-sm">
                            {testimonial.author.charAt(6)}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-wider leading-none mb-0.5">{testimonial.author}</p>
                            <p className="text-[8px] font-medium text-white/50 uppercase tracking-widest leading-none">{testimonial.school}</p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});
TestimonialCard.displayName = 'TestimonialCard';

const MobileFlyPlayer = ({ isOpen, onClose, testimonial, onNext, onPrev, hasNext, hasPrev }) => {
    if (!isOpen || !testimonial) return null;

    return (
        <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[200] bg-black overflow-hidden flex flex-col pointer-events-auto"
        >
            <div className="relative flex-1 flex flex-col">
                {/* Gestural Navigation Layer */}
                <motion.div
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    onDragEnd={(_, info) => {
                        if (info.offset.y < -100 && hasNext) onNext();
                        else if (info.offset.y > 100 && hasPrev) onPrev();
                        else if (info.offset.y > 200) onClose(); // Swipe down to close
                    }}
                    className="absolute inset-0 z-10 touch-none active:cursor-grabbing"
                />

                {/* Video Content */}
                <div className="absolute inset-0">
                    <video
                        key={testimonial.id}
                        src={testimonial.videoUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        playsInline
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
                </div>

                {/* Top Controls */}
                <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-20 pointer-events-none">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                            <Wind size={14} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase italic drop-shadow-lg">Fly Play</span>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-transform">
                        <X size={20} />
                    </button>
                </div>

                {/* Right Side Actions (Tiktok Style) */}
                <div className="absolute right-4 bottom-32 flex flex-col gap-8 z-20 items-center pointer-events-none">
                    <button className="flex flex-col items-center pointer-events-auto group">
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-active:scale-90 transition-transform">
                            <Sparkles size={22} className="fill-white/20" />
                        </div>
                        <span className="text-[9px] font-black text-white mt-1 drop-shadow-sm uppercase">Meta</span>
                    </button>
                    <button className="flex flex-col items-center pointer-events-auto group">
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-active:scale-90 transition-transform">
                            <Plane size={22} className="fill-white/20" />
                        </div>
                        <span className="text-[9px] font-black text-white mt-1 drop-shadow-sm uppercase">Vuelo</span>
                    </button>
                </div>

                {/* Bottom Metadata */}
                <div className="absolute bottom-0 inset-x-0 p-8 pt-20 bg-gradient-to-t from-black/90 to-transparent z-20 pointer-events-none">
                    <div className="space-y-4 max-w-[80%]">
                        <div className="flex items-center gap-2 text-fuchsia-400">
                            <MapPin size={12} fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-widest antialiased">{testimonial.location}</span>
                        </div>
                        <h2 className="text-3xl font-black text-white leading-none tracking-tighter uppercase italic drop-shadow-lg antialiased">@{testimonial.author.replace('Mtra. ', '').toLowerCase()}</h2>
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4">
                            <p className="text-white text-sm font-medium leading-tight antialiased">"{testimonial.quote.toLowerCase()}"</p>
                            <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-2">{testimonial.school}</p>
                        </div>
                    </div>

                    {/* Progress Bar (TikTok style) */}
                    <div className="absolute bottom-12 inset-x-8 flex items-center gap-4">
                        <div className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden">
                            <motion.div
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                                className="w-full h-full bg-fuchsia-500"
                            />
                        </div>
                        <span className="text-[10px] font-mono text-white/40">{testimonial.serial.split(' // ')[0]}</span>
                    </div>
                </div>

                {/* Navigation Guide */}
                <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-1 opacity-20 pointer-events-none antialiased">
                    <ChevronDown size={14} className="text-white animate-bounce" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Desliza para más</span>
                </div>
            </div>
        </motion.div>
    );
};

export default function MobileGallery({ onOpen }) {
    const containerRef = useRef(null);
    const stickyRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [playerOpen, setPlayerOpen] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [introAnimated, setIntroAnimated] = useState(false);
    const isAnimating = useRef(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const openPlayer = (idx) => {
        setSelectedIdx(idx);
        setPlayerOpen(true);
    };

    const nextVideo = () => selectedIdx < testimonials.length - 1 && setSelectedIdx(p => p + 1);
    const prevVideo = () => selectedIdx > 0 && setSelectedIdx(p => p - 1);

    const masterProgress = useMotionValue(0);
    const springProgress = useSpring(masterProgress, { stiffness: 60, damping: 30 });
    const velocity = useVelocity(springProgress);
    const time = useTime();

    // Oscilación sinusoidal para efecto flotante independiente
    const floatY = useTransform(time, t => Math.sin(t / 1000) * 4);
    const floatRotate = useTransform(time, t => Math.sin(t / 2000) * 1.5);

    // Tilt dinámico basado en la velocidad del scroll
    const tiltX = useTransform(velocity, [-3000, 0, 3000], [15, 0, -15]);

    const totalPoints = testimonials.length + 2; // Intro + Cards + Outro
    const snapPoints = useMemo(() => Array.from({ length: totalPoints }).map((_, i) => i / (totalPoints - 1)), [totalPoints]);

    useEffect(() => {
        const checkPosition = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const locked = rect.top <= 10 && rect.bottom >= window.innerHeight;
            setIsLocked(locked);
            // Trigger intro animation when section top reaches 70% of viewport
            const triggerPoint = window.innerHeight * 0.7;
            if (rect.top <= triggerPoint && !introAnimated) {
                setIntroAnimated(true);
            }
        };
        window.addEventListener('scroll', checkPosition, { passive: true });
        checkPosition(); // Check on mount
        return () => window.removeEventListener('scroll', checkPosition);
    }, [introAnimated]);

    useEffect(() => {
        if (playerOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [playerOpen]);

    const handleMove = useCallback((direction, velocityValue = 0) => {
        if (isAnimating.current || !containerRef.current || playerOpen) return;

        let nextIndex = activeIndex;
        if (direction === 'down' && activeIndex < totalPoints - 1) nextIndex++;
        else if (direction === 'up' && activeIndex > 0) nextIndex--;

        if (nextIndex !== activeIndex) {
            isAnimating.current = true;
            setActiveIndex(nextIndex);

            const initialVelocity = Math.min(Math.abs(velocityValue) * 1.5, 3000);
            const sectionTop = containerRef.current.offsetTop;
            const targetScroll = sectionTop + (nextIndex * window.innerHeight);

            // Usamos las físicas sincronizadas ultra-rápidas aprobadas
            const springConfig = { type: "spring", stiffness: 800, damping: 40, mass: 0.08 };

            animate(masterProgress, snapPoints[nextIndex], { ...springConfig, velocity: initialVelocity / 50 });
            animate(window.scrollY, targetScroll, {
                ...springConfig,
                onUpdate: (v) => window.scrollTo(0, v),
                onComplete: () => {
                    setTimeout(() => { isAnimating.current = false; }, 100);
                }
            });
        }
    }, [activeIndex, masterProgress]);

    useEffect(() => {
        const el = stickyRef.current;
        if (!el) return;

        const onWheel = (e) => {
            if (!isLocked) return;
            if (isAnimating.current) { e.preventDefault(); return; }
            const delta = e.deltaY;
            if ((activeIndex === 0 && delta < 0) || (activeIndex === totalPoints - 1 && delta > 0)) return;
            if (e.cancelable) {
                e.preventDefault();
                if (Math.abs(delta) > 20) handleMove(delta > 0 ? 'down' : 'up', delta);
            }
        };

        let touchY = 0;
        let startTime = 0;
        const onTouchStart = (e) => { touchY = e.touches[0].clientY; startTime = Date.now(); };
        const onTouchMove = (e) => {
            if (!isLocked) return;
            const delta = touchY - e.touches[0].clientY;
            if ((activeIndex === 0 && delta < 0) || (activeIndex === totalPoints - 1 && delta > 0)) return;
            if (e.cancelable) e.preventDefault();
        };
        const onTouchEnd = (e) => {
            if (!isLocked || isAnimating.current) return;
            const delta = touchY - e.changedTouches[0].clientY;
            const duration = Date.now() - startTime;
            const touchVelocity = Math.abs(delta / duration) * 1000;
            if (Math.abs(delta) > 30 || touchVelocity > 500) { handleMove(delta > 0 ? 'down' : 'up', touchVelocity); }
        };

        window.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('wheel', onWheel);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [isLocked, activeIndex, handleMove]);

    return (
        <>
            <section ref={containerRef} className="relative w-full h-[500vh] -mt-20 pt-20 z-[75]">
                <div
                    ref={stickyRef}
                    className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-white"
                >

                    {/* NUEVO MOTOR CELESTIAL ASCENT */}
                    {isMounted && <CelestialAscentBackground progress={springProgress} />}
                    <NavigationDots progress={springProgress} count={totalPoints} />


                    <div className="absolute inset-0 flex flex-col pt-24 pointer-events-none">

                        {/* INTRO - PORTADA con ANIMACIÓN DE DESPEGUE */}
                        <motion.div
                            style={{
                                opacity: useTransform(springProgress, [0, 0.08], [1, 0]),
                                y: useTransform(springProgress, [0, 0.08], [0, -40]),
                                scale: useTransform(springProgress, [0, 0.08], [1, 0.95]),
                            }}
                            className="relative z-30 px-6 text-center will-change-transform flex flex-col items-center justify-center min-h-[65vh]"
                        >
                            {/* Badge - Fase 1: 300ms */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={introAnimated ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                                transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500 shadow-lg shadow-violet-500/30 mb-8"
                            >
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-[10px] font-bold text-white tracking-widest uppercase">Fly Play</span>
                            </motion.div>

                            {/* Título Migrante - Esta parte se queda aquí para el layout inicial pero se desvanece */}
                            {/* Para que la migración sea fluida, usaremos un clon fuera de este contenedor */}

                            <div className="text-center mb-8">
                                {/* Intro - Fase 2: 500ms - Cae desde arriba */}
                                <motion.p
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={introAnimated ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
                                    transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className="text-slate-400 text-sm font-semibold tracking-wide uppercase mb-4"
                                >
                                    Los mejores momentos de
                                </motion.p>

                                <div className="h-16" /> {/* Placeholder para el espacio del título */}
                            </div>

                            {/* Estadísticas - Fase 3: 1000ms */}

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={introAnimated ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                                transition={{ delay: 1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-lg overflow-hidden"
                            >
                                <div className="flex items-center justify-center gap-4 px-5 py-3">
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-slate-900 tabular-nums">510</div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">niños</div>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200" />
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-violet-500">∞</div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Emociones</div>
                                    </div>
                                </div>

                                {/* Apartado Delgado Inferior */}
                                <div className="w-full bg-sky-500/5 border-t border-sky-500/10 px-5 py-1.5 text-center">
                                    <p className="text-[9px] font-bold text-sky-600/40 uppercase tracking-[0.15em]">
                                        Aún faltan <span className="text-sky-500 font-black">29,490</span> niños
                                    </p>
                                </div>
                            </motion.div>


                            {/* Scroll indicator - Fase 3: 1300ms */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={introAnimated ? { opacity: 1 } : { opacity: 0 }}
                                transition={{ delay: 1.3, duration: 0.5 }}
                                className="mt-10 flex flex-col items-center gap-1"
                            >
                                <motion.div
                                    animate={introAnimated ? { y: [0, 6, 0] } : {}}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 1.8 }}
                                >
                                    <ChevronDown size={20} className="text-slate-400" />
                                </motion.div>
                                <span className="text-[8px] font-semibold text-slate-400 tracking-widest uppercase">Desliza</span>
                            </motion.div>
                        </motion.div>

                        {/* TÍTULO MIGRANTE (Sticky Header) */}
                        <div className="absolute inset-x-0 top-[36vh] z-[100] flex flex-col items-center pointer-events-none px-6" style={{ perspective: '1200px' }}>
                            <motion.h2
                                style={{
                                    y: useTransform(springProgress, [0.04, 0.25, 0.9], [0, -175, -175], { clamp: true }),
                                    translateY: floatY, // Oscilación constante
                                    scale: useTransform(springProgress, [0.04, 0.25], [1, 0.72], { clamp: true }),
                                    rotateX: tiltX,    // Inercia 3D al scroll
                                    rotateZ: floatRotate, // Balanceo suave
                                    opacity: useTransform(springProgress, [0.9, 0.98], [1, 0], { clamp: true })
                                }}
                                initial={{ opacity: 0, y: 60, scale: 0.9 }}
                                animate={introAnimated ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 60, scale: 0.9 }}
                                transition={{
                                    opacity: { delay: 0.7, duration: 0.7 },
                                    y: { delay: 0.7, duration: 0.7, type: "spring", stiffness: 120, damping: 14 },
                                    scale: { delay: 0.7, duration: 0.7, type: "spring", stiffness: 120, damping: 14 }
                                }}
                                className="font-[Montserrat] tracking-tight leading-[0.95] text-center will-change-transform"
                            >
                                <motion.span
                                    style={{
                                        backgroundSize: '200% 200%',
                                        filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.8)) drop-shadow(0 10px 30px rgba(14,165,233,0.4)) drop-shadow(0 0 40px rgba(255,255,255,0.2))',
                                        color: useTransform(springProgress, [0.12, 0.25], ["rgba(255,255,255,0)", "rgba(255,255,255,1)"], { clamp: true }),
                                        textShadow: '0 0 10px rgba(255,255,255,0.5)'
                                    }}
                                    animate={introAnimated ? { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] } : {}}
                                    transition={{ repeat: Infinity, duration: 6, delay: 1.5 }}
                                    className="text-[2.5rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 tracking-tight"
                                >
                                    ¡EL DÍA QUE VOLARON!
                                </motion.span>
                            </motion.h2>
                        </div>

                        {/* ARTICULATED CARDS (Virtual Motion) */}
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            {testimonials.map((t, i) => (
                                <TestimonialCard key={t.id} testimonial={t} index={i} progress={springProgress} velocity={velocity} onOpen={openPlayer} totalCards={testimonials.length} />
                            ))}
                        </div>
                    </div>

                    {/* CTA FINAL - SIMPLE BAR */}
                    <motion.div
                        style={{
                            opacity: useTransform(springProgress, [0.88, 1], [0, 1]),
                            y: useTransform(springProgress, [0.88, 1], [30, 0])
                        }}
                        className="absolute bottom-10 inset-x-0 z-50 flex flex-col items-center justify-center px-6 pointer-events-none"
                    >
                        <motion.button
                            onClick={() => openPlayer(0)}
                            whileTap={{ scale: 0.97 }}
                            className="pointer-events-auto w-full max-w-[320px] p-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-between shadow-[0_15px_40px_rgba(139,92,246,0.35)]"
                        >
                            <div>
                                <p className="text-white text-lg font-black tracking-tight">Ver Mejores Momentos</p>
                                <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Fly Play</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg">
                                <Play size={22} className="text-violet-600 fill-violet-600 ml-0.5" />
                            </div>
                        </motion.button>
                    </motion.div>
                </div>

            </section>

            {/* PLAYER OVERLAY - Fuera de la sección para z-index global */}
            <AnimatePresence>
                {playerOpen && (
                    <MobileFlyPlayer
                        isOpen={playerOpen}
                        onClose={() => setPlayerOpen(false)}
                        testimonial={testimonials[selectedIdx]}
                        onNext={nextVideo}
                        onPrev={prevVideo}
                        hasNext={selectedIdx < testimonials.length - 1}
                        hasPrev={selectedIdx > 0}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
