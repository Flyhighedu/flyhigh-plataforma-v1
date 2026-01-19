'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { X, Play } from 'lucide-react';

const testimonials = [
    { id: 1, image: '/img/Estoy viendo la fabrica.png', name: 'Escuela Benito Juárez', videoUrl: '/videos/reel1.mp4' },
    { id: 2, image: '/img/EDU Patrocinios.png', name: 'Primaria Altamirano', videoUrl: '/videos/reel2.mp4' },
    { id: 3, image: '/img/Portada 2 niños.jpg', name: 'Secundaria Nicolás Bravo', videoUrl: '/videos/reel3.mp4' },
    { id: 4, image: '/img/Patio altamirano.png', name: 'Colegio Vasco de Quiroga', videoUrl: '/videos/reel4.mp4' },
    { id: 5, image: '/img/EDU Patrocinios11.png', name: 'Escuela Eduardo Ruiz', videoUrl: '/videos/reel5.mp4' },
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

export default function FlyHighTestimonialGallery() {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const containerRef = useRef(null);

    const { scrollXProgress } = useScroll({
        container: containerRef,
        axis: 'x'
    });

    const buttonScale = useTransform(
        scrollXProgress,
        [0, 0.05, 0.2, 0.25, 0.3, 0.45, 0.5, 0.55, 0.7, 0.75, 0.8, 0.95, 1],
        [1.25, 1, 1, 1.25, 1, 1, 1.25, 1, 1, 1.25, 1, 1, 1.25]
    );



    const handleCardClick = (videoUrl) => {
        setSelectedVideo(videoUrl);
        setModalOpen(true);
    };

    return (
        <section className="relative w-full py-20 md:py-32 bg-slate-50 overflow-hidden z-[80]" style={{ contain: 'layout paint' }}>
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-200/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>

            {/* Header */}
            <div className="text-center mb-10 md:mb-16 px-4">
                <h2 className="font-['Outfit',sans-serif] text-3xl md:text-5xl font-bold text-slate-900 mb-3">
                    Momentos Que <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Inspiran</span>
                </h2>
                <p className="text-slate-500 text-sm md:text-base max-w-lg mx-auto">
                    Revive la experiencia de los niños que ya están <span className="font-bold text-violet-600">conquistando el cielo</span> con <span className="font-bold text-slate-900">FlyHigh</span>.
                </p>
            </div>

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
                            onClick={() => {
                                handleCardClick(item.videoUrl);
                            }}
                        />
                    ))}
                </div>

                {/* Pagination Dots - Design Premium & High Performance */}
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
                    onClick={() => handleCardClick('/videos/reel3.mp4')}
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

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
                    <div className="relative w-full max-w-md aspect-[9/16]" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            suppressHydrationWarning
                            onClick={() => setModalOpen(false)}
                            className="absolute -top-12 right-0 z-[1001] w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <video
                            src={selectedVideo}
                            className="w-full h-full object-cover rounded-2xl shadow-2xl border border-white/10"
                            autoPlay
                            loop
                            playsInline
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
