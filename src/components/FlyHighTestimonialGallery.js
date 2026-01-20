'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence, useInView } from 'framer-motion';
import { X, Play, Wind, ChevronDown, Sparkles, MapPin, Plane } from 'lucide-react';

const testimonials = [
    { id: 1, image: '/img/Estoy viendo la fabrica.png', name: 'Escuela Benito Juárez', videoUrl: '/videos/reel1.mp4', author: 'Mtra. Lucina', quote: 'HABÍA UNA ALEGRÍA QUE VIBRABA EN EL PATIO.', location: 'Uruapan, Mich.', serial: 'FLP-001' },
    { id: 2, image: '/img/EDU Patrocinios.png', name: 'Primaria Altamirano', videoUrl: '/videos/reel2.mp4', author: 'Mtra. Xatziri', quote: 'DESCUBRIMOS UNA CHISPA INCREÍBLE EN ELLOS.', location: 'Fábrica San Pedro', serial: 'FLP-002' },
    { id: 3, image: '/img/Portada 2 niños.jpg', name: 'Secundaria Nicolás Bravo', videoUrl: '/videos/reel3.mp4', author: 'Mtra. Karina', quote: 'LO IMPOSIBLE HOY ES UNA HERRAMIENTA REAL.', location: 'Parque Nacional', serial: 'FLP-003' },
    { id: 4, image: '/img/Patio altamirano.png', name: 'Colegio Vasco de Quiroga', videoUrl: '/videos/reel4.mp4', author: 'Mtro. Carlos', quote: 'VER SU CIUDAD DESDE ARRIBA LES CAMBIÓ LA VIDA.', location: 'Centro Histórico', serial: 'FLP-004' },
    { id: 5, image: '/img/EDU Patrocinios11.png', name: 'Escuela Eduardo Ruiz', videoUrl: '/videos/reel5.mp4', author: 'Mtra. Elena', quote: 'AHORA SABEN QUE PUEDEN LLEGAR A LAS NUBES.', location: 'Volcán Paricutín', serial: 'FLP-005' },
];

function TestimonialCard({ item, index, scrollXProgress, onClick }) {
    const step = 1 / (testimonials.length - 1);
    const center = index * step;
    const margin = step * 0.8;

    const scale = useTransform(
        scrollXProgress,
        [center - margin, center, center + margin],
        [0.95, 1.12, 0.95]
    );

    const opacity = useTransform(
        scrollXProgress,
        [center - margin, center, center + margin],
        [0.7, 1, 0.7]
    );

    return (
        <motion.div
            onClick={onClick}
            style={{
                scale,
                opacity,
                willChange: 'transform, opacity',
                transform: 'translate3d(0,0,0)',
                transformStyle: 'preserve-3d'
            }}
            className="relative shrink-0 rounded-2xl overflow-hidden bg-white/95 border border-white/20 shadow-xl w-[200px] h-[280px] md:w-[260px] md:h-[340px] cursor-pointer snap-center"
        >
            <Image
                src={item.image}
                fill
                className="object-cover"
                alt={item.name}
                quality={75}
                loading="lazy"
                sizes="(max-width: 768px) 200px, 260px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>

            <div className="absolute bottom-4 left-4 right-4 z-10">
                <p className="text-white text-xs md:text-sm font-bold leading-tight drop-shadow-md">
                    {item.name}
                </p>
                <div className="h-0.5 w-6 bg-violet-400 rounded-full mt-1.5 overflow-hidden"></div>
            </div>
        </motion.div>
    );
}

function PaginationDot({ index, scrollXProgress, testimonialsCount }) {
    const step = 1 / (testimonialsCount - 1);
    const center = index * step;
    const margin = step / 2;

    const width = useTransform(
        scrollXProgress,
        [center - margin, center, center + margin],
        [8, 24, 8]
    );

    const opacity = useTransform(
        scrollXProgress,
        [center - margin, center, center + margin],
        [0.3, 1, 0.3]
    );

    return (
        <motion.div
            style={{ width, opacity }}
            className="h-2 rounded-full bg-violet-600 shadow-sm"
        />
    );
}

// === REELS/TIKTOK STYLE PLAYER ===
function FlyPlayer({ isOpen, onClose, testimonials, currentIndex, setCurrentIndex }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    const testimonial = testimonials[currentIndex];
    const hasNext = currentIndex < testimonials.length - 1;
    const hasPrev = currentIndex > 0;

    const onNext = () => hasNext && setCurrentIndex(currentIndex + 1);
    const onPrev = () => hasPrev && setCurrentIndex(currentIndex - 1);

    const playerContent = (
        <AnimatePresence>
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 right-0 bottom-0 bg-black overflow-hidden flex flex-col"
                style={{
                    zIndex: 99999,
                    height: '100dvh',
                    width: '100vw',
                    position: 'fixed'
                }}
            >
                <div className="relative flex-1 flex flex-col">
                    {/* Gestural Navigation Layer */}
                    <motion.div
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y < -100 && hasNext) onNext();
                            else if (info.offset.y > 100 && hasPrev) onPrev();
                            else if (info.offset.y > 200) onClose();
                        }}
                        className="absolute inset-0 z-10 touch-none"
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
                            muted
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
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-transform"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Right Side Actions (TikTok Style) */}
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
                            <div className="flex items-center gap-2 text-violet-400">
                                <MapPin size={12} fill="currentColor" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{testimonial.location}</span>
                            </div>
                            <h2 className="text-3xl font-black text-white leading-none tracking-tighter uppercase italic drop-shadow-lg">
                                @{testimonial.author.replace('Mtra. ', '').replace('Mtro. ', '').toLowerCase()}
                            </h2>
                            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4">
                                <p className="text-white text-sm font-medium leading-tight">"{testimonial.quote.toLowerCase()}"</p>
                                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-2">{testimonial.name}</p>
                            </div>
                        </div>

                        {/* Progress Dots */}
                        <div className="absolute bottom-20 inset-x-8 flex items-center justify-center gap-2">
                            {testimonials.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-6 bg-violet-500' : 'w-1 bg-white/30'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Navigation Guide */}
                    <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-1 opacity-30 pointer-events-none">
                        <ChevronDown size={14} className="text-white animate-bounce" />
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">Desliza para más</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );

    // Renderizar en document.body usando Portal para escapar del z-index stacking context
    return createPortal(playerContent, document.body);
}

export default function FlyHighTestimonialGallery() {
    const [modalOpen, setModalOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeCardIndex, setActiveCardIndex] = useState(0); // Para virtualización
    const containerRef = useRef(null);
    const headerRef = useRef(null);
    const isHeaderInView = useInView(headerRef, { once: true, margin: '-100px' });

    const { scrollXProgress } = useScroll({
        container: containerRef,
        axis: 'x'
    });

    // Actualizar índice activo basado en scroll (para virtualización)
    useEffect(() => {
        const unsubscribe = scrollXProgress.on('change', (value) => {
            const newIndex = Math.round(value * (testimonials.length - 1));
            if (newIndex !== activeCardIndex) {
                setActiveCardIndex(newIndex);
            }
        });
        return () => unsubscribe();
    }, [scrollXProgress, activeCardIndex]);

    const buttonScale = useTransform(
        scrollXProgress,
        [0, 0.05, 0.2, 0.25, 0.3, 0.45, 0.5, 0.55, 0.7, 0.75, 0.8, 0.95, 1],
        [1.25, 1, 1, 1.25, 1, 1, 1.25, 1, 1, 1.25, 1, 1, 1.25]
    );

    const handleCardClick = (index) => {
        setCurrentIndex(index);
        setModalOpen(true);
    };

    return (
        <section
            className="relative w-full min-h-screen py-20 md:py-32 bg-slate-50 overflow-hidden z-[80] flex flex-col justify-center"
            style={{ contain: 'layout paint' }}
        >
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-200/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>

            {/* Header con animación de entrada */}
            <motion.div
                ref={headerRef}
                className="text-center mb-6 md:mb-16 px-4"
                initial={{ opacity: 0, y: 40 }}
                animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
                <motion.h2
                    className="font-['Outfit',sans-serif] font-black text-4xl md:text-6xl text-slate-900 leading-[0.9] tracking-tighter mb-3 md:mb-6"
                    initial={{ opacity: 0, y: 30 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                    Momentos Que <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Inspiran</span>
                </motion.h2>
                <motion.p
                    className="text-slate-500 text-sm md:text-xl leading-relaxed max-w-2xl mx-auto text-pretty"
                    initial={{ opacity: 0, y: 20 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                    Revive la experiencia de los niños que ya están <span className="font-bold text-violet-600">conquistando el cielo</span> con <span className="font-bold text-slate-900">FlyHigh</span>.
                </motion.p>
            </motion.div>

            {/* Carousel */}
            <div className="relative w-full mb-4">
                <div
                    ref={containerRef}
                    className="flex gap-8 overflow-x-auto w-full px-[50vw] pb-10 pt-10 no-scrollbar snap-x snap-mandatory overscroll-x-contain"
                    style={{
                        paddingLeft: 'calc(50% - 100px)',
                        paddingRight: 'calc(50% - 130px)',
                        WebkitOverflowScrolling: 'touch',
                        contain: 'content',
                        scrollbarWidth: 'none'
                    }}
                >
                    <style jsx>{`
                        .no-scrollbar::-webkit-scrollbar { display: none; }
                        @media (min-width: 768px) {
                            div[style*="padding-left"] {
                                padding-left: calc(50% - 130px) !important;
                                padding-right: calc(50% - 130px) !important;
                            }
                        }
                    `}</style>

                    {testimonials.map((item, index) => {
                        // VIRTUALIZACIÓN: Solo renderizar cards cercanas al índice activo
                        const isVisible = Math.abs(index - activeCardIndex) <= 1;

                        if (!isVisible) {
                            // Placeholder vacío para mantener el espaciado
                            return (
                                <div
                                    key={item.id}
                                    className="shrink-0 w-[200px] h-[280px] md:w-[260px] md:h-[340px] snap-center"
                                    aria-hidden="true"
                                />
                            );
                        }

                        return (
                            <TestimonialCard
                                key={item.id}
                                item={item}
                                index={index}
                                scrollXProgress={scrollXProgress}
                                onClick={() => handleCardClick(index)}
                            />
                        );
                    })}
                </div>

                {/* Pagination Dots */}
                <div className="flex justify-center mt-2">
                    <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-200/40 backdrop-blur-sm border border-white/40 shadow-sm">
                        {testimonials.map((_, index) => (
                            <PaginationDot
                                key={index}
                                index={index}
                                scrollXProgress={scrollXProgress}
                                testimonialsCount={testimonials.length}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center px-4 mt-6">
                <motion.button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => handleCardClick(2)}
                    style={{
                        scale: buttonScale,
                        willChange: 'transform'
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs tracking-wider uppercase border border-white/20 active:scale-95 transition-transform duration-200"
                >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Ver Momento</span>
                </motion.button>
            </div>

            {/* TikTok/Reels Style Player */}
            <FlyPlayer
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                testimonials={testimonials}
                currentIndex={currentIndex}
                setCurrentIndex={setCurrentIndex}
            />
        </section>
    );
}

