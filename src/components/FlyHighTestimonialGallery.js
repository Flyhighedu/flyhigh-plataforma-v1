'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence, useInView } from 'framer-motion';
import { X, Play, Wind, ChevronDown, Sparkles, MapPin, Plane } from 'lucide-react';

const testimonials = [
    { id: 1, image: '/img/portada otilio montaño.png', name: 'Escuela Otilio Montaño', videoUrl: '/videos/Comprimido otilio montaño.mp4', author: 'Mtra. Rocío', quote: 'EL VUELO LES ABRIÓ LOS OJOS A UN NUEVO MUNDO.', location: 'Uruapan, Mich.', serial: 'FLP-001' },
    { id: 2, image: '/img/portada altamirano.png', name: 'Primaria Altamirano', videoUrl: '/videos/altamirano.mp4', author: 'Mtra. Xatziri', quote: 'UNA EXPERIENCIA QUE MARCÓ SUS VIDAS PARA SIEMPRE.', location: 'Uruapan, Mich.', serial: 'FLP-002' },
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
    const [isPaused, setIsPaused] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isLandscapeVideo, setIsLandscapeVideo] = useState(false);
    const [isLandscapeMode, setIsLandscapeMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef(null);

    useEffect(() => {
        setMounted(true);

        // Detect device orientation changes
        const handleOrientationChange = () => {
            const isLandscape = window.innerWidth > window.innerHeight;
            setIsLandscapeMode(isLandscape);
        };

        handleOrientationChange();
        window.addEventListener('resize', handleOrientationChange);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            setMounted(false);
            window.removeEventListener('resize', handleOrientationChange);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    // Reset pause state and detect video orientation when changing videos
    useEffect(() => {
        setIsPaused(false);
        setIsLandscapeVideo(false);
        setIsLoading(true);

        const video = videoRef.current;
        if (!video) return;

        // Ensure video is unmuted
        video.muted = false;

        // Force play with audio - user already interacted by clicking "Ver Momento"
        const attemptPlay = () => {
            video.play().catch((err) => {
                // If autoplay with audio fails, try muted then unmute
                video.muted = true;
                video.play().then(() => {
                    // Unmute after play starts
                    setTimeout(() => {
                        video.muted = false;
                    }, 100);
                }).catch(() => { });
            });
        };

        // Detect video aspect ratio when metadata loads
        const handleLoadedMetadata = () => {
            if (video) {
                const { videoWidth, videoHeight } = video;
                setIsLandscapeVideo(videoWidth > videoHeight);
                attemptPlay();
            }
        };

        // When enough data is loaded, try to play
        const handleCanPlayThrough = () => {
            setIsLoading(false);
            attemptPlay();
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('canplaythrough', handleCanPlayThrough);

        // Initial play attempt
        attemptPlay();

        // Check if already loaded
        if (video.videoWidth > 0) {
            handleLoadedMetadata();
        }

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('canplaythrough', handleCanPlayThrough);
        };
    }, [currentIndex]);

    const handleTapToPause = () => {
        if (videoRef.current) {
            if (isPaused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
            setIsPaused(!isPaused);
        }
    };

    if (!isOpen || !mounted) return null;

    const testimonial = testimonials[currentIndex];
    const hasNext = currentIndex < testimonials.length - 1;
    const hasPrev = currentIndex > 0;

    const onNext = () => hasNext && setCurrentIndex(currentIndex + 1);
    const onPrev = () => hasPrev && setCurrentIndex(currentIndex - 1);

    // Use object-contain for landscape videos in portrait mode to preserve aspect ratio
    const videoObjectFit = isLandscapeVideo && !isLandscapeMode ? 'object-contain' : 'object-cover';

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
                <div className="relative flex-1 flex flex-col items-center justify-center">
                    {/* Gestural Navigation Layer */}
                    <motion.div
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y < -100 && hasNext) onNext();
                            else if (info.offset.y > 100 && hasPrev) onPrev();
                            else if (info.offset.y > 200) onClose();
                        }}
                        onClick={handleTapToPause}
                        className="absolute inset-0 z-10 touch-none cursor-pointer"
                    />

                    {/* Video Content */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <video
                            ref={videoRef}
                            key={testimonial.id}
                            src={testimonial.videoUrl}
                            className={`w-full h-full ${videoObjectFit}`}
                            autoPlay
                            loop
                            playsInline
                            preload="auto"
                            onLoadStart={() => setIsLoading(true)}
                            onWaiting={() => setIsLoading(true)}
                            onCanPlay={() => setIsLoading(false)}
                            onPlaying={() => setIsLoading(false)}
                        />
                    </div>

                    {/* Loading Spinner */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                            >
                                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Rotate Hint for Landscape Videos in Portrait Mode */}
                    <AnimatePresence>
                        {isLandscapeVideo && !isLandscapeMode && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute top-20 inset-x-0 flex justify-center z-30 pointer-events-none"
                            >
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-white animate-pulse">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                                    </svg>
                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Gira para pantalla completa</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pause Indicator */}
                    <AnimatePresence>
                        {isPaused && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none"
                            >
                                <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
                                    <Play size={40} fill="white" className="text-white ml-1" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                    <div className="absolute right-4 bottom-40 flex flex-col gap-6 z-20 items-center pointer-events-none">
                        {/* Me Gusta */}
                        <button
                            onClick={() => setIsLiked(!isLiked)}
                            className="flex flex-col items-center pointer-events-auto group"
                        >
                            <motion.div
                                animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
                                className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center group-active:scale-90 transition-all ${isLiked
                                    ? 'bg-red-500 border-red-400 text-white'
                                    : 'bg-white/10 border-white/20 text-white'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                </svg>
                            </motion.div>
                            <span className="text-[9px] font-black text-white mt-1 drop-shadow-sm uppercase">Me gusta</span>
                        </button>

                        {/* Agenda */}
                        <a href="/escuelas" className="flex flex-col items-center pointer-events-auto group">
                            <div className="w-12 h-12 rounded-full bg-violet-500/80 backdrop-blur-md border border-violet-400/50 flex items-center justify-center text-white group-active:scale-90 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                            </div>
                            <span className="text-[9px] font-black text-white mt-1 drop-shadow-sm uppercase">Agenda</span>
                        </a>

                        {/* Dona */}
                        <button
                            onClick={() => document.getElementById('impact-engine')?.scrollIntoView({ behavior: 'smooth' }) || onClose()}
                            className="flex flex-col items-center pointer-events-auto group"
                        >
                            <div className="w-12 h-12 rounded-full bg-amber-500/80 backdrop-blur-md border border-amber-400/50 flex items-center justify-center text-white group-active:scale-90 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1014.625 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 109.375 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                            </div>
                            <span className="text-[9px] font-black text-white mt-1 drop-shadow-sm uppercase">Dona</span>
                        </button>
                    </div>

                    {/* Bottom Metadata - Minimal */}
                    <div className="absolute bottom-0 inset-x-0 p-4 pb-6 bg-gradient-to-t from-black/60 to-transparent z-20 pointer-events-none">
                        <div className="flex-1 min-w-0">
                            {/* School Name */}
                            <h2 className="text-lg font-black text-white leading-tight tracking-tight uppercase drop-shadow-lg truncate">
                                {testimonial.name}
                            </h2>
                            {/* Location Badge */}
                            <div className="flex items-center gap-1.5 mt-1">
                                <MapPin size={10} className="text-violet-400" fill="currentColor" />
                                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">{testimonial.location}</span>
                            </div>
                        </div>
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

                    {testimonials.map((item, index) => (
                        <TestimonialCard
                            key={item.id}
                            item={item}
                            index={index}
                            scrollXProgress={scrollXProgress}
                            onClick={() => handleCardClick(index)}
                        />
                    ))}
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
                    onClick={() => handleCardClick(activeCardIndex)}
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

