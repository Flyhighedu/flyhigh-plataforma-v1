"use client";
import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, useTransform, useScroll, useSpring, useVelocity, useMotionValueEvent, animate, useMotionValue, AnimatePresence } from 'framer-motion';
import { Play, ArrowUp, Wind, Cloud, Sparkles, MapPin, MousePointer2, Bird, Plane, X, ChevronDown } from 'lucide-react';

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

const SingleCloud = memo(({ cloud, progress, opacity, blur }) => {
    const y = useTransform(progress, [0, 1], ["0%", `${cloud.speed * 200}%`]);
    // Optimizamos el blur: si es muy alto, usamos opacidad en su lugar para reducir Painter cost
    // O limitamos el máximo de blur
    const optimizedBlur = Math.min(blur, 20);

    return (
        <motion.div
            style={{
                top: cloud.top, left: cloud.left, scale: cloud.scale, opacity,
                filter: optimizedBlur > 0 ? `blur(${optimizedBlur}px)` : 'none',
                y,
                willChange: 'transform',
                transform: 'translateZ(0)'
            }}
            className="absolute"
        >
            <Cloud className="text-white w-64 h-64" />
        </motion.div>
    );
});
SingleCloud.displayName = 'SingleCloud';

const CloudLayer = memo(({ progress, count, depth, size, opacity, blur }) => {
    const clouds = useMemo(() => Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 120 - 10}%`,
        scale: Math.random() * size + 0.5,
        speed: (Math.random() * 0.5 + 0.5) * depth,
        delay: Math.random() * 2
    })), [count, depth, size]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {clouds.map(c => (
                <SingleCloud key={c.id} cloud={c} progress={progress} opacity={opacity} blur={blur} />
            ))}
        </div>
    );
});
CloudLayer.displayName = 'CloudLayer';

const AtmosphericCanvas = memo(({ progress, velocity, type = 'stardust' }) => {
    const canvasRef = useRef(null);
    const particles = useMemo(() => {
        const count = type === 'stardust' ? 30 : 12;
        return Array.from({ length: count }).map(() => ({
            x: Math.random() * 100,
            y: Math.random() * 200 - 50,
            size: type === 'stardust' ? Math.random() * 2 + 1 : Math.random() * 1.5 + 0.5,
            speed: Math.random() * 0.5 + 0.2,
            drift: Math.random() * 40 - 20,
            opacity: Math.random() * 0.5 + 0.3,
            length: type === 'wind' ? Math.random() * 100 + 50 : 0
        }));
    }, [type]);

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const p = progress.get();
        const v = velocity.get();
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const vFactor = Math.abs(v) / 1000;
        const globalAlpha = type === 'wind' ? Math.min(0.6, vFactor) : 0.4 + vFactor * 0.4;

        ctx.globalAlpha = globalAlpha;
        ctx.fillStyle = "white";

        particles.forEach(part => {
            const currentY = ((part.y + (p * part.speed * 400)) % 240 - 70) * (height / 100);
            const currentX = (part.x + (p * part.drift)) * (width / 100);

            if (type === 'stardust') {
                ctx.beginPath();
                ctx.arc(currentX, currentY, part.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (type === 'wind' && vFactor > 0.1) {
                const stretch = 1 + vFactor * 2;
                ctx.save();
                ctx.translate(currentX, currentY);
                ctx.scale(1, stretch);
                ctx.globalAlpha = Math.min(0.3, vFactor * 0.5);
                ctx.fillRect(-part.size / 2, -part.length / 2, part.size, part.length);
                ctx.restore();
            }
        });
    }, [particles, progress, type, velocity]);

    useEffect(() => {
        let raf;
        const loop = () => {
            animate();
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [animate]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{ width: '100%', height: '100%', willChange: 'transform' }}
            width={400} // Resolución interna baja para performance extrema
            height={800}
        />
    );
});
AtmosphericCanvas.displayName = 'AtmosphericCanvas';

const SunHalo = memo(({ progress }) => {
    const haloOpacity = useTransform(progress, [0, 0.5, 1], [0.3, 0.6, 0.2]);
    const haloScale = useTransform(progress, [0, 1], [1, 1.5]);
    const haloY = useTransform(progress, [0, 1], ["20%", "-20%"]);

    return (
        <motion.div
            style={{ opacity: haloOpacity, scale: haloScale, y: haloY, willChange: 'transform' }}
            className="absolute top-[-10%] left-[-10%] w-[120%] aspect-square rounded-full pointer-events-none z-0 transform-gpu"
        >
            <div className="absolute inset-0 bg-gradient-radial from-amber-200/30 via-orange-400/5 to-transparent blur-[80px]" />
            <div className="absolute inset-0 bg-gradient-radial from-white/10 via-transparent to-transparent blur-[40px] translate-x-[-10%] translate-y-[-10%]" />
        </motion.div>
    );
});
SunHalo.displayName = 'SunHalo';

const SingleFauna = memo(({ element, index, progress }) => {
    const y = useTransform(progress, [0, 1], ["-20%", `${element.speed * 400}%`]);
    const x = useTransform(progress, [0, 1], ["0%", index % 2 === 0 ? "150%" : "-150%"]);
    const rotate = useTransform(progress, [0, 1], [0, index % 2 === 0 ? 45 : -45]);
    const Icon = element.type;
    return (
        <motion.div
            style={{
                top: element.top, left: element.left, scale: element.scale, opacity: element.opacity || 0.4, y, x, rotate,
                willChange: 'transform, opacity'
            }}
            className="absolute text-white/40 z-[2]"
        >
            <Icon size={48} />
        </motion.div>
    );
});
SingleFauna.displayName = 'SingleFauna';

const CelestialFauna = ({ progress }) => {
    const elements = useMemo(() => [
        { type: Plane, top: "15%", left: "30%", speed: 6.0, scale: 0.25, opacity: 0.15 },
        { type: Plane, top: "45%", left: "70%", speed: 4.2, scale: 0.3, opacity: 0.12 },
        { type: Bird, top: "65%", left: "10%", speed: 8.5, scale: 0.15, opacity: 0.1 },
        { type: Bird, top: "85%", left: "80%", speed: 7.2, scale: 0.12, opacity: 0.08 }
    ], []);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
            {elements.map((e, i) => (
                <SingleFauna key={i} element={e} index={i} progress={progress} />
            ))}
        </div>
    );
};

const CelestialAscentBackground = ({ progress, velocity }) => {
    const skyGradient = useTransform(progress, [0, 0.4, 0.7, 1], [
        "linear-gradient(to bottom, #7dd3fc, #bae6fd, #ffffff)", // Mañana
        "linear-gradient(to bottom, #38bdf8, #7dd3fc, #bae6fd)", // Ascenso medio
        "linear-gradient(to bottom, #0284c7, #38bdf8, #7dd3fc)", // Altura alta
        "linear-gradient(to bottom, #0c4a6e, #0284c7, #38bdf8)"  // Espacio cercano
    ]);

    return (
        <motion.div style={{ background: skyGradient }} className="absolute inset-0 z-0 overflow-hidden pointer-events-none transform-gpu contain-paint">
            {/* Atmósfera en un solo Canvas (Optimización Extrema) */}
            <AtmosphericCanvas progress={progress} velocity={velocity} type="stardust" />
            <AtmosphericCanvas progress={progress} velocity={velocity} type="wind" />

            {/* CAPA 1: Horizonte Nublado (Muy Lejano) */}
            <CloudLayer progress={progress} count={6} depth={0.2} size={0.4} opacity={0.3} blur={20} />

            {/* CAPA 2: Cirros Estratificados (Lejanos) */}
            <CloudLayer progress={progress} count={4} depth={0.5} size={0.8} opacity={0.4} blur={10} />

            {/* CAPA 3: Elementos de Vida (Aves/Aviones) */}
            <CelestialFauna progress={progress} />

            {/* CAPA 4: Cúmulos Cinematográficos (Medios) */}
            <CloudLayer progress={progress} count={8} depth={1.2} size={1.8} opacity={0.5} blur={5} />

            {/* CAPA 5: Fly-by Clouds (Ultra Cercanos) */}
            <CloudLayer progress={progress} count={3} depth={3.5} size={4.5} opacity={0.3} blur={0} />

            {/* CAPA 6: Niebla Volumétrica Inferior (Ground Haze) */}
            <motion.div
                style={{ opacity: useTransform(progress, [0, 0.2], [0.6, 0]) }}
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white via-white/50 to-transparent z-[10]"
            />
        </motion.div>
    );
};

const SingleDot = memo(({ index, progress, totalPoints }) => {
    const target = index / (totalPoints - 1);
    const active = useTransform(progress, [target - 0.1, target, target + 0.1], [0.2, 1, 0.2]);
    const scale = useTransform(active, [0.2, 1], [1, 1.6]);
    return (
        <motion.div style={{ opacity: active, scale, willChange: 'transform' }} className="relative pointer-events-none transform-gpu">
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
        </motion.div>
    );
});
SingleDot.displayName = 'SingleDot';

const NavigationDots = memo(({ progress, count }) => {
    return (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <SingleDot key={i} index={i} progress={progress} totalPoints={count} />
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
    const scaleValues = isLast ? [0.9, 1, 0.85] : [0.9, 1, 0.9];

    const yRange = isLast ? [centerPoint - 0.1, centerPoint, 1] : [centerPoint - 0.1, centerPoint, centerPoint + 0.1];
    const yValues = isLast ? [150, 0, -100] : [150, 0, -150];

    const opacity = useTransform(progress, opacityRange, opacityValues);
    const scale = useTransform(progress, scaleRange, scaleValues);
    const y = useTransform(progress, yRange, yValues);

    const rotateX = useTransform(velocity, [-500, 500], [-10, 10]);
    const skewY = useTransform(velocity, [-500, 500], [-4, 4]);

    const [pointerEnabled, setPointerEnabled] = useState(false);
    useMotionValueEvent(opacity, "change", (v) => {
        if (v > 0.8 && !pointerEnabled) setPointerEnabled(true);
        else if (v <= 0.8 && pointerEnabled) setPointerEnabled(false);
    });

    return (
        <motion.div
            style={{
                opacity, scale, y, rotateX, skewY,
                pointerEvents: pointerEnabled ? 'auto' : 'none',
                willChange: 'transform, opacity',
                transform: 'translateZ(0)'
            }}
            className="absolute w-[80vw] max-w-[340px] aspect-[9/16] bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden border border-white/10"
        >
            <img
                src={testimonial.image}
                className="absolute inset-0 w-full h-full object-cover"
                alt="Card"
                loading="lazy"
                decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[9px] font-black text-white w-fit tracking-widest uppercase italic uppercase tracking-[0.2em]">Nivel {testimonial.id}</div>
                <button onClick={() => onOpen(index)} className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center mx-auto shadow-xl active:scale-90 transition-transform"><Play className="fill-white text-white ml-1 w-6 h-6" /></button>
                <div className="space-y-4">
                    <h3 className="text-2xl font-black text-white leading-tight italic drop-shadow-lg">"{testimonial.quote}"</h3>
                    <div className="flex items-center gap-3 border-t border-white/10 pt-4">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 font-black text-white shadow-lg text-lg italic">{testimonial.author.charAt(6)}</div>
                        <div><p className="text-[10px] font-black text-white uppercase tracking-wider leading-none mb-1">{testimonial.author}</p><p className="text-[8px] font-bold text-white/50 uppercase tracking-widest leading-none italic">{testimonial.school}</p></div>
                    </div>
                </div>
            </div>
            <div className="absolute top-8 left-8 text-white/30 font-mono text-[9px] tracking-tight">{testimonial.serial}</div>
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
            className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col pointer-events-auto"
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

    const totalPoints = testimonials.length + 2; // Intro + Cards + Outro
    const snapPoints = useMemo(() => Array.from({ length: totalPoints }).map((_, i) => i / (totalPoints - 1)), [totalPoints]);

    useEffect(() => {
        const checkPosition = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const locked = rect.top <= 10 && rect.bottom >= window.innerHeight;
            setIsLocked(locked);
        };
        window.addEventListener('scroll', checkPosition, { passive: true });
        return () => window.removeEventListener('scroll', checkPosition);
    }, []);

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
        <section ref={containerRef} className="relative w-full h-[500vh]">
            <div ref={stickyRef} className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-white shadow-2xl">

                {/* NUEVO MOTOR CELESTIAL ASCENT */}
                {isMounted && <CelestialAscentBackground progress={springProgress} velocity={velocity} />}
                <NavigationDots progress={springProgress} count={totalPoints} />


                <div className="absolute inset-0 flex flex-col pt-24 pointer-events-none">

                    {/* INTRO */}
                    <motion.div
                        style={{
                            opacity: useTransform(springProgress, [0, 0.15], [1, 0]),
                            y: useTransform(springProgress, [0, 0.15], [0, -40]),
                            scale: useTransform(springProgress, [0, 0.15], [1, 0.9])
                        }}
                        className="relative z-10 px-8 text-center will-change-transform"
                    >
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/40 bg-white/10 backdrop-blur-xl mb-6 shadow-2xl">
                            <Sparkles size={16} className="text-white animate-pulse" />
                            <span className="text-[12px] font-black text-white tracking-[0.2em] uppercase italic">Ascenso Celestial</span>
                        </div>
                        <h2 className="text-6xl font-black text-white tracking-tighter leading-[0.8] font-[Montserrat] drop-shadow-2xl italic">HACIA LO<br /><span className="text-blue-100 uppercase not-italic">DESCONOCIDO</span></h2>
                        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2.5 }} className="mt-12 text-white/50"><Wind size={30} className="mx-auto" /></motion.div>
                    </motion.div>

                    {/* ARTICULATED CARDS (Virtual Motion) */}
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                        {testimonials.map((t, i) => (
                            <TestimonialCard key={t.id} testimonial={t} index={i} progress={springProgress} velocity={velocity} onOpen={openPlayer} totalCards={testimonials.length} />
                        ))}
                    </div>
                </div>

                {/* CTA FINAL ARMÓNICO */}
                <motion.div
                    style={{
                        opacity: useTransform(springProgress, [0.85, 1], [0, 1]),
                        y: useTransform(springProgress, [0.85, 1], [40, 0])
                    }}
                    className="absolute bottom-16 inset-x-0 z-50 flex flex-col items-center justify-center px-8 pointer-events-none"
                >
                    <div className="pointer-events-auto text-center w-full max-w-[320px]">
                        <motion.button
                            onClick={() => openPlayer(0)}
                            whileTap={{ scale: 0.95 }}
                            className="group w-full bg-white text-slate-950 rounded-[24px] py-4 px-6 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all border border-slate-100"
                        >
                            <div className="text-left font-black leading-none">
                                <span className="block text-lg uppercase tracking-tight mb-0.5">VER MEJORES MOMENTOS</span>
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest italic font-bold">En Fly Play</span>
                            </div>
                            <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center group-hover:rotate-[360deg] transition-transform duration-1000">
                                <Play size={18} className="text-white fill-white" />
                            </div>
                        </motion.button>
                        <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] animate-pulse">Desliza para finalizar</p>
                    </div>
                </motion.div>

            </div>

            {/* PLAYER OVERLAY */}
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

        </section>
    );
}
