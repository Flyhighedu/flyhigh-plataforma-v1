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
        serial: "FLP-001 // 2025",
        priority: true // Optimization hint
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
        buffer.width = 200;  // Mayor resolución para más detalle
        buffer.height = 120;
        const bctx = buffer.getContext('2d');

        // Función mejorada para dibujar nubes más definidas
        // Función mejorada para dibujar nubes más definidas con optimización de enteros
        const drawpuffy = (x, y, r, opacity) => {
            // Optimización: Redondear coordenadas para evitar sub-pixel rendering costoso
            const ix = (x + 0.5) << 0;
            const iy = (y + 0.5) << 0;
            const ir = (r + 0.5) << 0;

            const g = bctx.createRadialGradient(ix, iy, 0, ix, iy, ir);
            // Centro más sólido, bordes más definidos
            g.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
            g.addColorStop(0.3, `rgba(255, 255, 255, ${opacity * 0.9})`);
            g.addColorStop(0.6, `rgba(255, 255, 255, ${opacity * 0.5})`);
            g.addColorStop(0.85, `rgba(255, 255, 255, ${opacity * 0.15})`);
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            bctx.fillStyle = g;
            bctx.beginPath();
            bctx.arc(ix, iy, ir, 0, Math.PI * 2);
            bctx.fill();
        };

        // Nube más compleja y definida con más bultos
        // Capa base (más grande y suave)
        drawpuffy(100, 60, 55, 0.7);

        // Cuerpo principal (más denso)
        drawpuffy(100, 55, 40, 0.95);
        drawpuffy(60, 65, 35, 0.85);
        drawpuffy(140, 65, 35, 0.85);

        // Bultos superiores (definición)
        drawpuffy(75, 40, 28, 0.8);
        drawpuffy(125, 40, 28, 0.8);
        drawpuffy(100, 35, 25, 0.75);

        // Detalles pequeños (textura)
        drawpuffy(45, 70, 20, 0.6);
        drawpuffy(155, 70, 20, 0.6);
        drawpuffy(85, 30, 15, 0.5);
        drawpuffy(115, 30, 15, 0.5);

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

            // Optimización: Dibujo con enteros
            const drawX = (c.x * (width / 100)) << 0;
            const drawY = currentY << 0;

            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.rotate(c.rotate);
            ctx.scale(scale, scale);
            ctx.drawImage(bufferRef.current, -80, -50);
            ctx.restore();
        });
    }, [elements, progress]);


    useEffect(() => {
        let raf;
        let frameCount = 0;
        const loop = () => {
            // Throttling: Dibujar solo cada 2 frames (~30 FPS para background)
            // Libera thread para UI a 60 FPS
            if (frameCount % 2 === 0) {
                draw();
            }
            frameCount++;
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [draw]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-[5]"
            width={typeof window !== 'undefined' ? window.innerWidth * 0.5 : 100}
            height={typeof window !== 'undefined' ? window.innerHeight * 0.5 : 100}
            style={{ width: '100%', height: '100%', willChange: 'transform, opacity' }}
        />
    );
});
UnifiedSkyEngine.displayName = 'UnifiedSkyEngine';


const CelestialAscentBackground = ({ progress }) => {
    // Cielo con más color desde el inicio para ver las nubes
    // Cielo mejorado: Tonos más ricos y "mágicos" (Azure -> Stratosphere)
    const skyGradient = useTransform(progress, [0, 0.08, 0.4, 0.7, 1], [
        "linear-gradient(to bottom, #7dd3fc, #bfdbfe, #eff6ff)",       // INICIO: Día claro y brillante (Sky-300 -> Blue-200 -> Blue-50)
        "linear-gradient(to bottom, #38bdf8, #93c5fd, #bfdbfe)",      // Ascenso: Azul vivo (Sky-400 -> Blue-300)
        "linear-gradient(to bottom, #0ea5e9, #60a5fa, #93c5fd)",      // Altura: Azul profundo (Sky-500 -> Blue-400)
        "linear-gradient(to bottom, #0284c7, #3b82f6, #60a5fa)",      // Estratósfera: Azul intenso (Sky-600 -> Blue-500)
        "linear-gradient(to bottom, #0c4a6e, #1d4ed8, #2563eb)"       // Espacio: Navy profundo a Azul Real (Sky-900 -> Blue-700)
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
            style={{ scale: springScale, opacity: springOpacity, willChange: 'transform' }}
            className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]"
        />
    );
});
NavigationDot.displayName = 'NavigationDot';

const NavigationDots = memo(({ progress, count }) => {
    return (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-5 p-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
            {Array.from({ length: count }).map((_, i) => (
                <NavigationDot key={i} index={i} progress={progress} totalPoints={count} />
            ))}
        </div>
    );
});
NavigationDots.displayName = 'NavigationDots';

import { useAnimation } from 'framer-motion';

// Icono Sun que faltaba
const Sun = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 5.106a.75.75 0 001.06 1.06l1.591-1.591a.75.75 0 00-1.061-1.06l-1.59 1.591z" />
    </svg>
);

const PLAYFUL_THEMES = [
    {
        id: 'energy',
        gradient: 'from-amber-400 to-orange-500',
        solidBg: 'bg-orange-500', // Solid Color for Wave
        waveFill: '#f97316', // tailwind orange-500 hex
        shadowColor: 'rgba(249, 115, 22, 0.25)',
        iconColor: 'text-orange-600',
        accentBg: 'bg-orange-50',
        doodle: <Sun className="w-20 h-20 text-white/20 rotate-12" />
    },
    {
        id: 'curiosity',
        gradient: 'from-cyan-400 to-blue-500',
        solidBg: 'bg-cyan-500', // Solid Color for Wave
        waveFill: '#06b6d4', // tailwind cyan-500 hex
        shadowColor: 'rgba(6, 182, 212, 0.25)',
        iconColor: 'text-cyan-600',
        accentBg: 'bg-cyan-50',
        doodle: <Cloud className="w-20 h-20 text-white/20 -rotate-6" />
    },
    {
        id: 'magic',
        gradient: 'from-fuchsia-400 to-purple-500',
        solidBg: 'bg-purple-500', // Solid Color for Wave
        waveFill: '#a855f7', // tailwind purple-500 hex
        shadowColor: 'rgba(168, 85, 247, 0.25)',
        iconColor: 'text-purple-600',
        accentBg: 'bg-purple-50',
        doodle: <Sparkles className="w-20 h-20 text-white/20 rotate-45" />
    }
];

const TestimonialCard = memo(({ testimonial, index, progress, velocity, onOpen, totalCards }) => {
    const isLast = index === totalCards - 1;
    const centerPoint = (index + 1) / (totalCards + 2 - 1);
    const theme = PLAYFUL_THEMES[index % PLAYFUL_THEMES.length];

    // Configuración especial para la última tarjeta
    const opacityRange = isLast ? [centerPoint - 0.1, centerPoint, 0.95, 1] : [centerPoint - 0.1, centerPoint, centerPoint + 0.1];
    const opacityValues = isLast ? [0, 1, 1, 1] : [0, 1, 0];

    const scaleRange = isLast ? [centerPoint - 0.1, centerPoint, 1] : [centerPoint - 0.1, centerPoint, centerPoint + 0.1];
    const scaleValues = isLast ? [0.88, 1, 0.98] : [0.88, 1, 0.88];

    // Sync: Termina en 0.90
    const yRange = isLast ? [centerPoint - 0.1, centerPoint, centerPoint + 0.15] : [centerPoint - 0.1, centerPoint, centerPoint + 0.15];
    const yValues = isLast ? [120, 0, -130] : [120, 0, -120];

    const opacity = useTransform(progress, opacityRange, opacityValues);
    const scale = useTransform(progress, scaleRange, scaleValues);
    const y = useTransform(progress, yRange, yValues);

    const zIndex = useTransform(opacity, [0, 0.5, 1], [0, 5, 10]);
    const rotateX = useTransform(velocity, [-500, 500], [-5, 5]); // Menos rotación para que se vea más sólido
    const rotate = useTransform(velocity, [-500, 500], [-2, 2]); // Leve rotación Z para juego

    const [pointerEnabled, setPointerEnabled] = useState(false);

    // Animación "Push" Caricaturesca
    const buttonControls = useAnimation();
    const hasAnimatedRef = useRef(false);

    useMotionValueEvent(opacity, "change", (v) => {
        // Habilitar puntero
        if (v > 0.8 && !pointerEnabled) setPointerEnabled(true);
        else if (v <= 0.8 && pointerEnabled) setPointerEnabled(false);

        // Disparar animación Push 1 segundo después de entrar
        if (v > 0.5 && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            setTimeout(() => {
                buttonControls.start({
                    scale: [1, 0.8, 1.15, 0.9, 1.05, 1],
                    transition: { duration: 0.8, ease: "anticipate" } // Caricature bounce
                });
            }, 1000);
        }
    });

    return (
        <motion.div
            style={{
                opacity, scale, y, rotateX, rotateZ: rotate, zIndex,
                pointerEvents: pointerEnabled ? 'auto' : 'none',
                willChange: 'transform, opacity',
                filter: `drop-shadow(0 20px 30px ${theme.shadowColor})` // Sombra de color suave
            }}
            className="absolute w-[76vw] max-w-[340px] aspect-[9/15] bg-white rounded-[40px] p-2" // P-2 crea el borde blanco grueso
        >
            <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-slate-100 flex flex-col">

                {/* 1. IMAGEN (Parte Superior Flexible) */}
                <div className="relative flex-1 w-full overflow-hidden">
                    <img
                        src={testimonial.image}
                        className="absolute inset-0 w-full h-full object-cover"
                        alt="Card"
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        decoding="async"
                    />

                    {/* Serial Label */}
                    <div className="absolute top-4 left-4 px-2 py-1 bg-black/20 backdrop-blur-sm rounded-md border border-white/10">
                        <span className="font-mono text-[8px] font-bold text-white/60 tracking-widest">{testimonial.serial.split('//')[0]}</span>
                    </div>
                </div>

                {/* 2. OLA DE COLOR (Footer Sólido) */}
                <div className="relative z-10">
                    {/* Wave SVG Conector - Sube -1px para evitar gap */}
                    <div className="absolute bottom-full left-0 right-0 h-8 md:h-12 w-full overflow-hidden leading-[0]">
                        <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full block">
                            <path d="M0.00,49.98 C149.99,150.00 349.20,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" fill={theme.waveFill}></path>
                        </svg>
                    </div>

                    {/* Bloque Sólido */}
                    <div className={`${theme.solidBg} px-6 pb-6 pt-2 text-center flex flex-col items-center`}>
                        <h3 className="text-[1.1rem] font-black text-white leading-tight tracking-tight drop-shadow-sm mb-4">
                            "{testimonial.quote}"
                        </h3>

                        {/* Botón Píldora "Ver Momento" */}
                        <motion.button
                            animate={buttonControls}
                            onClick={() => onOpen(index)}
                            whileTap={{ scale: 0.95 }}
                            style={{ willChange: 'transform' }}
                            suppressHydrationWarning
                            className="bg-white px-5 py-2.5 rounded-full flex items-center gap-2 shadow-lg group active:shadow-sm transition-all"
                        >
                            <span className={`text-[10px] font-black uppercase tracking-wider ${theme.iconColor}`}>
                                Ver Momento
                            </span>
                            <span className={`w-5 h-5 rounded-full ${theme.solidBg} flex items-center justify-center`}>
                                <Play size={10} className="text-white fill-white ml-0.5" />
                            </span>
                        </motion.button>
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
                    <button onClick={onClose} style={{ willChange: 'transform' }} className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-transform">
                        <X size={20} />
                    </button>
                </div>

                {/* Right Side Actions (Tiktok Style) */}
                <div className="absolute right-4 bottom-32 flex flex-col gap-8 z-20 items-center pointer-events-none">
                    <button className="flex flex-col items-center pointer-events-auto group">
                        <div style={{ willChange: 'transform' }} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-active:scale-90 transition-transform">
                            <Sparkles size={22} className="fill-white/20" />
                        </div>
                        <span className="text-[9px] font-black text-white mt-1 drop-shadow-sm uppercase">Meta</span>
                    </button>
                    <button className="flex flex-col items-center pointer-events-auto group">
                        <div style={{ willChange: 'transform' }} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-active:scale-90 transition-transform">
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

// --- COMPONENTES DE ANIMACIÓN (TOON PHYSICS) ---

const ElasticChar = memo(({ char, index, totalIndex, progress, smoothVelocity, toonSkew, toonTracking }) => {
    // Staggered Start: Cada letra empieza un poco después que la anterior
    // Delta de 0.003 asegura una ola rápida pero perceptible
    const start = 0.04 + (totalIndex * 0.003);

    // Trayectoria O(1) - Trajectory Locking (Zero-Drift)
    // Se satura rápido (0.15) y se queda fijo en -130px para siempre
    const y = useTransform(progress,
        [start, start + 0.08, start + 0.15],
        [0, -60, -130]
    );

    // Opacidad / Color individual (Scroll Physics)
    const color = useTransform(progress, [start, start + 0.1], ['#0ea5e9', '#ffffff']);
    const shadowOpacity = useTransform(progress, [start, start + 0.1], [0, 0.5]);

    // GPU Optimization: Usamos textShadow en lugar de filter: drop-shadow
    // Evita la creación de texturas offscreen costosas
    const textShadow = useTransform(shadowOpacity, v =>
        `0 ${20 * v}px ${40 * v}px rgba(0,0,0,${v})`
    );

    // Opacidad base para desaparición final (Scroll Physics)
    // Sync de Salida: Desaparece junto con la llegada de la última tarjeta (0.75 -> 0.90)
    const opacity = useTransform(progress,
        [0, start + 0.08, 0.75, 0.90],
        [1, 0.6, 0.6, 0],
        { clamp: true }
    );

    // Variantes de Entrada (Falling Sky Intro)
    const entranceVariants = {
        hidden: { y: -150, opacity: 0, rotateX: 90 },
        visible: {
            y: 0,
            opacity: 1,
            rotateX: 0,
            transition: { type: "spring", damping: 12, stiffness: 200 }
        }
    };

    return (
        // WRAPPER: Maneja la entrada "Caída del Cielo"
        <motion.span variants={entranceVariants} style={{ display: 'inline-block', transformStyle: 'preserve-3d' }}>
            {/* CORE: Maneja las Físicas de Scroll (Jelly/Morph) */}
            <motion.span
                style={{
                    display: 'inline-block',
                    y,
                    skewX: toonSkew,
                    letterSpacing: toonTracking,
                    color,
                    textShadow,
                    opacity
                }}
                className="will-change-transform"
            >
                {char === ' ' ? '\u00A0' : char}
            </motion.span>
        </motion.span>
    );
});
ElasticChar.displayName = 'ElasticChar';

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

    // --- HYPER-TOON PHYSICS ENGINE V2 ---
    // Configuración "Jelly" (Pudín): Alto stiffness, muy bajo damping para vibración
    const jellyConfig = { stiffness: 700, damping: 12, mass: 0.5 };
    const smoothVelocity = useSpring(velocity, jellyConfig);

    // 1. Deformación Extrema (Smear Frame)
    const toonScaleY = useTransform(smoothVelocity, [-3000, 0, 3000], [1.6, 1, 1.6]);
    const toonScaleX = useTransform(smoothVelocity, [-3000, 0, 3000], [0.6, 1, 0.6]);

    // 2. Rotación Pendular (Swing)
    // El título se "cuelga" de la inercia
    const leanRotate = useTransform(smoothVelocity, [-3000, 3000], [15, -15]);

    // 3. Elastic Lag (Posición Y con rebote propio)
    // YA NO SE USA GLOBALMENTE - Se movió a ElasticChar para el efecto Stagger

    // 4. Morphing Text (Deformación Estructural de Letras)
    // Shear Stress: Inclinación violenta por velocidad ("Viento")
    const toonSkew = useTransform(smoothVelocity, [-3000, 3000], [-25, 25]);
    // Kern-Breathing: Compresión aerodinámica en movimiento
    const toonTracking = useTransform(smoothVelocity, [-3000, 0, 3000], ["-0.05em", "0.05em", "-0.05em"]);

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

                    {/* CONTENEDOR MAESTRO DE PORTADA (Flex Stack Vertical) */}
                    {/* Reajuste: Alineación superior (Top-Aligned) para aprovechar espacio vertical */}
                    <div className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none px-6 pt-32 pb-20">

                        {/* 1. Badge Superior */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={introAnimated ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                            style={{ opacity: useTransform(springProgress, [0, 0.05], [1, 0]) }}
                            transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 200, damping: 15 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500 shadow-lg shadow-violet-500/30 mb-8"
                        >
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-bold text-white tracking-widest uppercase">Fly Play</span>
                        </motion.div>

                        {/* 2. Texto Introductorio */}
                        <motion.p
                            initial={{ opacity: 0, y: -20 }}
                            animate={introAnimated ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
                            style={{ opacity: useTransform(springProgress, [0, 0.05], [1, 0]) }}
                            transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="text-slate-400 text-sm font-semibold tracking-wide uppercase mb-6"
                        >
                            Los mejores momentos de
                        </motion.p>

                        {/* 3. TÍTULO PRINCIPAL (En Flujo Natural) */}
                        <div className="relative z-10 mb-10" style={{ perspective: '1200px' }}>
                            <motion.h2
                                variants={{
                                    hidden: { opacity: 1 },
                                    visible: {
                                        opacity: 1,
                                        transition: { staggerChildren: 0.04, delayChildren: 0.2 }
                                    }
                                }}
                                initial="hidden"
                                animate={introAnimated ? "visible" : "hidden"}
                                style={{
                                    // Transformaciones globales del contenedor (Rotate, Tilt)
                                    scale: useTransform(springProgress, [0, 0.04, 0.25], [1, 1.1, 1]),
                                    rotateX: tiltX,
                                    rotateZ: leanRotate, // El balanceo sigue siendo global

                                    // La deformación estructural global también aplica para coherencia
                                    scaleY: toonScaleY,
                                    scaleX: toonScaleX,
                                }}
                                className="font-[Montserrat] text-[2.4rem] font-black tracking-[0.05em] uppercase leading-[1.05] text-center flex flex-col items-center"
                            >
                                {/* LÍNEA 1: ¡EL DÍA QUE */}
                                <span className="flex justify-center w-full">
                                    {Array.from("¡EL DÍA QUE").map((char, i) => (
                                        <ElasticChar
                                            key={`l1-${i}`}
                                            char={char}
                                            index={i}
                                            totalIndex={i} // Índice corrido para el stagger
                                            progress={springProgress}
                                            smoothVelocity={smoothVelocity}
                                            toonSkew={toonSkew}
                                            toonTracking={toonTracking}
                                        />
                                    ))}
                                </span>
                                {/* LÍNEA 2: VOLARON! */}
                                <span className="flex justify-center w-full">
                                    {Array.from("VOLARON!").map((char, i) => (
                                        <ElasticChar
                                            key={`l2-${i}`}
                                            char={char}
                                            index={i}
                                            totalIndex={i + 12} // Offset para que siga la ola después de la primera línea
                                            progress={springProgress}
                                            smoothVelocity={smoothVelocity}
                                            toonSkew={toonSkew}
                                            toonTracking={toonTracking}
                                        />
                                    ))}
                                </span>
                            </motion.h2>
                        </div>

                        {/* 4. Tarjeta de Estadísticas (Empujada naturalmente) */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={introAnimated ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                            transition={{ delay: 1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            // Desvanecimiento al scrollear para limpiar la vista
                            style={{
                                opacity: useTransform(springProgress, [0, 0.05], [1, 0])
                            }}
                            className="flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-lg overflow-hidden relative z-20"
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
                            <div className="w-full bg-sky-500/5 border-t border-sky-500/10 px-5 py-1.5 text-center">
                                <p className="text-[9px] font-bold text-sky-600/40 uppercase tracking-[0.15em]">
                                    Aún faltan <span className="text-sky-500 font-black">29,490</span> niños
                                </p>
                            </div>
                        </motion.div>

                        {/* 5. Scroll Indicator */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={introAnimated ? { opacity: 1 } : { opacity: 0 }}
                            transition={{ delay: 1.3, duration: 0.5 }}
                            style={{ opacity: useTransform(springProgress, [0, 0.05], [1, 0]) }}
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

                    </div>


                    {/* ARTICULATED CARDS (Virtual Motion) */}
                    {/* Bajamos MÁS las tarjetas (pt-52) para abrir el 'Header-Card Gap' */}
                    <div className="absolute inset-0 flex items-center justify-center p-6 pt-52 z-30">
                        {testimonials.map((t, i) => (
                            <TestimonialCard key={t.id} testimonial={t} index={i} progress={springProgress} velocity={velocity} onOpen={openPlayer} totalCards={testimonials.length} />
                        ))}
                    </div>
                </div>

                {/* CTA FINAL - SIMPLE BAR */}
                <motion.div
                    style={{
                        // Sync Total con Tarjeta (0.75 -> 0.90)
                        // Ambos inician y terminan exactamente al mismo tiempo
                        opacity: useTransform(springProgress, [0.75, 0.90], [0, 1]),
                        y: useTransform(springProgress, [0.75, 0.90], [50, 0])
                    }}
                    className="absolute bottom-14 inset-x-0 z-50 flex flex-col items-center justify-center px-6 pointer-events-none"
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
            </section >

            {/* PLAYER OVERLAY - Fuera de la sección para z-index global */}
            < AnimatePresence >
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
                )
                }
            </AnimatePresence >
        </>
    );
}
