'use client';

import React from 'react';
import { Play } from 'lucide-react';

export default function Trailer() {
    return (
        <section className="relative w-full bg-[#0B1120] -mt-20 sm:-mt-40 rounded-t-[2.5rem] sm:rounded-t-[4rem] z-30 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.8)] pb-32 overflow-hidden">
            <div className="w-full pt-6 pb-2 relative z-20">
                <p className="text-[10px] sm:text-xs text-center text-slate-500 uppercase tracking-[0.3em] font-bold opacity-60 mb-6">
                    Impulsado por Visionarios
                </p>
                <LogoCarousel />
            </div>

            <div className="relative w-full mt-10">
                <div className="relative z-30 text-center mb-[-60px] sm:mb-[-100px] pointer-events-none">
                    <h2 className="font-['Outfit',sans-serif] font-bold text-3xl sm:text-6xl text-white tracking-tight drop-shadow-xl">
                        ¿Alguna vez soñaste con <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C6FF] to-[#0072FF] filter drop-shadow-[0_0_25px_rgba(0,198,255,0.6)]">volar?</span>
                    </h2>
                </div>

                <div className="relative group w-full aspect-video sm:aspect-[21/9] max-w-7xl mx-auto video-vignette opacity-80 hover:opacity-100 transition-opacity duration-1000">
                    <video
                        className="w-full h-full object-cover"
                        poster="https://images.pexels.com/photos/17427616/pexels-photo-17427616/free-photo-of-nino-jugando-juego-gafas-de-realidad-virtual.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
                        controls
                        playsInline
                    >
                        <source src="https://videos.pexels.com/video-files/3205908/3205908-hd_720_1280_25fps.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity duration-500">
                        <div className="w-20 h-20 sm:w-28 sm:h-28 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30 shadow-[0_0_60px_rgba(255,255,255,0.15)]">
                            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-1" />
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#0B1120] to-transparent pointer-events-none z-20"></div>

                <div className="relative z-30 text-center -mt-10 px-4">
                    <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto font-light leading-relaxed">
                        Uniendo 30,000 voluntades en un solo latido. Sé testigo de la movilización ciudadana más grande de nuestra historia para recordarle a la niñez que su comunidad cree en ellos.
                    </p>
                </div>
            </div>

            <style jsx>{`
        .mask-fade-edges {
          mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
        }
        .video-vignette {
          mask-image: radial-gradient(circle at center, black 60%, transparent 100%);
          -webkit-mask-image: radial-gradient(circle at center, black 60%, transparent 100%);
        }
      `}</style>
        </section>
    );
}

function LogoCarousel() {
    const scrollRef = React.useRef(null);
    const [isPaused, setIsPaused] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [startX, setStartX] = React.useState(0);
    const [scrollLeft, setScrollLeft] = React.useState(0);

    const logos = [
        { src: "https://placehold.co/150x50/transparent/white?text=Secretaría+Cultura", alt: "Secretaría Cultura" },
        { src: "https://placehold.co/120x50/transparent/white?text=Tec+Monterrey", alt: "Tec Monterrey" },
        { src: "https://placehold.co/100x50/transparent/white?text=POSIBLE", alt: "POSIBLE" },
        { src: "https://placehold.co/140x50/transparent/white?text=Museo", alt: "Museo" },
        { src: "https://placehold.co/130x50/transparent/white?text=Empresa+Aliada", alt: "Empresa Aliada" },
        { src: "https://placehold.co/150x50/transparent/white?text=Secretaría+Cultura", alt: "Secretaría Cultura" },
    ];

    // Duplicate logos for infinite effect (4 sets)
    const extendedLogos = [...logos, ...logos, ...logos, ...logos];

    React.useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        let animationFrameId;
        const speed = 0.5;

        const animate = () => {
            if (!isPaused && !isDragging) {
                container.scrollLeft += speed;
                checkScroll();
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPaused, isDragging]);

    const checkScroll = () => {
        const container = scrollRef.current;
        if (!container) return;

        const totalWidth = container.scrollWidth;
        const oneSetWidth = totalWidth / 4;

        if (container.scrollLeft >= oneSetWidth * 3) {
            container.scrollLeft -= oneSetWidth;
        } else if (container.scrollLeft <= 0) {
            container.scrollLeft += oneSetWidth;
        }
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setIsPaused(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
        setIsPaused(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsPaused(false);
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        scrollRef.current.scrollLeft = scrollLeft - walk;
        checkScroll();
    };

    return (
        <div
            className="relative flex overflow-hidden w-full mask-fade-edges"
        >
            <div
                ref={scrollRef}
                className="flex gap-16 items-center min-w-full px-4 overflow-x-hidden"
                style={{ userSelect: 'none' }}
            >
                {extendedLogos.map((logo, index) => (
                    <img
                        key={index}
                        src={logo.src}
                        className="h-6 sm:h-8 object-contain brightness-0 invert opacity-50 hover:opacity-100 transition-opacity duration-300 shrink-0 pointer-events-none"
                        alt={logo.alt}
                    />
                ))}
            </div>
        </div>
    );
}
