"use client";
import React, { useRef, useState, useEffect, useLayoutEffect, memo, forwardRef } from 'react';
import {
    Play, X, MapPin, ChevronUp, ChevronDown, Wind, ArrowRight, Plane
} from 'lucide-react';
import MobileGallery from './MobileGallery';

// --- STYLES: HEARTBEAT & CURSOR (Desktop Only mostly) ---
const CURSOR_CSS = `
  .custom-cursor {
    pointer-events: none;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9999;
    display: none;
    backface-visibility: hidden;
    transform-style: preserve-3d;
    will-change: transform;
  }
  @media (hover: hover) {
    .custom-cursor { display: block; }
  }
  .stroke-text { -webkit-text-stroke: 1px #e2e8f0; color: transparent; }
  @keyframes subtle-zoom { from { transform: scale(1.1); } to { transform: scale(1); } }
  .animate-subtle-zoom { animation: subtle-zoom 20s infinite alternate ease-in-out; }
`;

// --- DATA: MAIN GALLERY (Shared Source) ---
export const GALLERY_COLUMNS = [
    {
        id: 'col-intro',
        type: 'intro',
        items: [
            {
                id: 1,
                name: "SANTI",
                location: "Volcán Paricutín",
                videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-little-boy-wearing-a-superhero-cape-standing-in-a-field-28499-large.mp4",
                thumbUrl: "/img/Portada Altamirano Uruapan.jpg",
                type: "media-tall",
                rotation: "rotate-[-1deg]",
                serial: "FLP-001 // 2025"
            }
        ]
    },
    {
        id: 'col-text-1',
        type: 'text-canvas',
        items: [
            {
                id: 'q1',
                type: 'kinetic-quote',
                quote: "¡Había una alegría que se sentía en todo el patio!",
                author: "Mtra. Lucina",
                school: "Esc. Ignacio Manuel Altamirano",
                offset: "self-start mt-20"
            }
        ]
    },
    {
        id: 'col-media-mix-1',
        type: 'media-stack',
        items: [
            {
                id: 2,
                name: "XIMENA",
                location: "Fábrica San Pedro",
                videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-a-green-jungle-3486-large.mp4",
                thumbUrl: "/img/Portada 2 niños.jpg",
                type: "media-box",
                rotation: "rotate-[1deg]",
                offset: "self-end",
                serial: "FLP-002 // 2025"
            },
            {
                id: 8, // Non-sequential ID preserved from original
                name: "CAMILA",
                location: "El Mirador",
                videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-airplane-taking-off-in-the-sunset-103-large.mp4",
                thumbUrl: "/img/Patio altamirano.png",
                type: "media-box",
                rotation: "rotate-[-1deg]",
                offset: "self-start -ml-12",
                serial: "FLP-008 // 2025"
            }
        ]
    },
    {
        id: 'col-text-2',
        type: 'text-canvas',
        items: [
            {
                id: 'q2',
                type: 'kinetic-quote',
                quote: "Nos dimos cuenta de que tienen una chispa increíble.",
                author: "Mtra. Xatziri",
                school: "Esc. Ignacio Manuel Altamirano",
                offset: "self-center scale-110"
            }
        ]
    },
    {
        id: 'col-media-wide',
        type: 'media-stack',
        items: [
            {
                id: 3,
                name: "MATEO",
                location: "Parque Nacional",
                videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-drone-flying-over-a-rural-area-in-the-mountains-43958-large.mp4",
                thumbUrl: "/img/Estoy viendo la fabrica.png",
                type: "media-wide",
                rotation: "rotate-[1deg]",
                offset: "self-center",
                serial: "FLP-003 // 2025",
                overlayText: "¡estoy viendo la fábrica de san pedro!"
            }
        ]
    },
    {
        id: 'col-text-3',
        type: 'text-canvas',
        items: [
            {
                id: 'q3',
                type: 'kinetic-quote',
                quote: "Lo que parecía imposible, hoy es una herramienta real.",
                author: "Mtra. Karina",
                school: "Esc. Ignacio Manuel Altamirano",
                offset: "self-end mb-32"
            }
        ]
    },
    {
        id: 'col-final-mix',
        type: 'media-stack',
        items: [
            {
                id: 4,
                name: "VALERIA",
                location: "Centro Histórico",
                videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-playing-with-a-paper-plane-in-the-sun-33066-large.mp4",
                thumbUrl: "https://images.unsplash.com/photo-1549603590-779831519d18?w=600&h=800&fit=crop",
                type: "media-tall",
                rotation: "rotate-[-1deg]",
                offset: "self-start",
                serial: "FLP-004 // 2025"
            },
            {
                id: 5,
                name: "DIEGO",
                location: "La Tzararacua",
                videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-boy-looking-at-the-sky-scenery-4384-large.mp4",
                thumbUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
                type: "media-wide",
                rotation: "rotate-[1deg]",
                offset: "self-end -ml-20",
                serial: "FLP-005 // 2025"
            }
        ]
    }
];

export const MEDIA_ITEMS = GALLERY_COLUMNS.flatMap(col => col.items).filter(item => item.type && item.type.startsWith('media'));

// Mobile data removed


// Pre-calculate flat map for loop efficiency (Desktop)
const ALL_ITEMS_MAP = {};
GALLERY_COLUMNS.forEach(col => col.items.forEach(item => ALL_ITEMS_MAP[item.id] = item));

const SPONSOR_LOGOS = [
    { src: "/img/logo sp Negro.png", x: 20, y: 15, rot: -2, w: "w-40 md:w-80" },
    { src: "/img/bonanza.png", x: 45, y: 65, rot: 3, w: "w-36 md:w-72" },
    { src: "/img/logo RV Fresh.png", x: 70, y: 30, rot: 2, w: "w-32 md:w-64" },
    { src: "/img/Logo Madobox.png", x: 75, y: 75, rot: -1, w: "w-40 md:w-76" }
];

// --- UTILS ---
const lerp = (start, end, factor) => start + (end - start) * factor;

const getStyles = (type) => {
    switch (type) {
        case 'media-tall': return 'w-[40vh] h-[75vh] md:w-[50vh] md:h-[80vh]';
        case 'media-box': return 'w-[35vh] h-[35vh] md:w-[45vh] md:h-[45vh]';
        case 'media-wide': return 'w-[50vh] h-[30vh] md:w-[70vh] md:h-[40vh]';
        case 'kinetic-quote': return 'w-[80vw] md:w-[60vh]';
        default: return '';
    }
};

// --- COMPONENT: FILM GRAIN ---
const FilmGrain = memo(() => (
    <svg className="film-grain w-full h-full pointer-events-none fixed inset-0 z-[100] opacity-[0.04]" style={{ willChange: 'opacity', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}>
        <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
));

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DESKTOP COMPONENTS (ORIGINAL LOGIC)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//

// --- COMPONENT: SPONSOR WATERMARK LAYER (ForwardRef) ---
const SponsorWatermarkLayer = memo(forwardRef((props, ref) => {
    const { logosRef } = ref || {};
    return (
        <div
            ref={ref?.container}
            className="absolute inset-0 pointer-events-none select-none z-[-1] will-change-transform"
            style={{ width: '500vw', backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
        >
            {SPONSOR_LOGOS.map((logo, idx) => (
                <div
                    key={idx}
                    ref={el => { if (logosRef && logosRef.current) logosRef.current[idx] = el; }}
                    className="absolute grayscale opacity-[0.14] will-change-transform"
                    style={{
                        left: `${logo.x}vw`,
                        top: `${logo.y}%`,
                        transform: `rotate(${logo.rot}deg) translate3d(0,0,0)`,
                        backfaceVisibility: 'hidden'
                    }}
                >
                    <img
                        src={logo.src}
                        alt="Sponsor Watermark"
                        className={`${logo.w} h-auto object-contain filter`}
                        loading="lazy"
                    />
                </div>
            ))}
        </div>
    );
}));
SponsorWatermarkLayer.displayName = 'SponsorWatermarkLayer';

// --- COMPONENT: TOPOGRAPHIC BACKGROUND (ForwardRef) ---
const TopographicBackground = memo(forwardRef((props, ref) => {
    const { line1, line2, circle } = ref || {};
    return (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}>
            <div ref={line1} className="absolute top-[20%] left-0 w-[200vw] h-[1px] bg-slate-300 transform -rotate-12 will-change-transform" style={{ backfaceVisibility: 'hidden' }} />
            <div ref={line2} className="absolute bottom-[30%] left-0 w-[200vw] h-[1px] bg-slate-300 transform rotate-6 will-change-transform" style={{ backfaceVisibility: 'hidden' }} />
            <div ref={circle} className="absolute top-[50%] left-[50%] w-[50vh] h-[50vh] rounded-full border border-slate-200/50 will-change-transform" style={{ backfaceVisibility: 'hidden' }} />
        </div>
    );
}));
TopographicBackground.displayName = 'TopographicBackground';

// --- COMPONENT: CUSTOM CURSOR (Zero-Rerender Logic) ---
const CustomCursor = memo(forwardRef((props, ref) => {
    const cursorRef = useRef(null);
    const pos = useRef({ x: 0, y: 0 });
    const targetPos = useRef({ x: 0, y: 0 });
    const contentRef = useRef(null);

    useLayoutEffect(() => {
        const handleMouseMove = (e) => {
            targetPos.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        const animate = () => {
            if (!cursorRef.current || !contentRef.current || !ref.current) return;

            const state = ref.current; // cursorStateRef from parent

            pos.current.x = lerp(pos.current.x, targetPos.current.x, 0.15);
            pos.current.y = lerp(pos.current.y, targetPos.current.y, 0.15);

            let x = pos.current.x;
            let y = pos.current.y;

            if (state.isHovering && state.center) {
                const dx = state.center.x - pos.current.x;
                const dy = state.center.y - pos.current.y;
                x += dx * 0.35;
                y += dy * 0.35;

                // Manual styles to avoid React re-renders for cursor visual state
                cursorRef.current.style.width = '128px'; // 32 * 4
                cursorRef.current.style.height = '128px';
                cursorRef.current.style.marginLeft = '-64px';
                cursorRef.current.style.marginTop = '-64px';
                cursorRef.current.style.opacity = '1';
                cursorRef.current.style.boxShadow = '0 0 40px rgba(255,255,255,0.1)';

                contentRef.current.style.display = 'block';
                contentRef.current.style.opacity = '1';
            } else {
                cursorRef.current.style.width = '0px';
                cursorRef.current.style.height = '0px';
                cursorRef.current.style.opacity = '0';
                contentRef.current.style.display = 'none';
            }

            cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            requestAnimationFrame(animate);
        };
        const raf = requestAnimationFrame(animate);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(raf);
        };
    }, [ref]);

    return (
        <div
            ref={cursorRef}
            className="custom-cursor flex items-center justify-center transition-all duration-500 ease-out border-white/20 bg-white/10 backdrop-blur-md border-[1px] rounded-full opacity-0 overflow-hidden"
        >
            <div
                ref={contentRef}
                style={{ display: 'none', WebkitFontSmoothing: 'antialiased', backfaceVisibility: 'hidden' }}
                className="text-[10px] font-black text-white tracking-widest text-center uppercase animate-in fade-in zoom-in duration-300 antialiased"
            >
                VER EN<br />FLY PLAY
            </div>
        </div>
    );
}));
CustomCursor.displayName = 'CustomCursor';

// --- COMPONENT: MURAL MEDIA ITEM (ForwardRef) ---
const MuralMedia = memo(forwardRef(({ item, onOpen, handleMediaHover }, ref) => {
    return (
        <div
            ref={ref}
            className={`relative group cursor-none overflow-visible rounded-[2rem] md:rounded-[3rem] 
                ${getStyles(item.type)} ${item.offset} z-10 will-change-transform
                bg-white shadow-2xl transition-all duration-700 cubic-bezier(0.19, 1, 0.22, 1)
                hover:shadow-fuchsia-200/50 hover:scale-[1.02]`}
            onClick={() => onOpen(item.id)}
            onMouseEnter={(e) => handleMediaHover(e, true)}
            onMouseLeave={(e) => handleMediaHover(e, false)}
            style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
        >
            <div className="absolute inset-0 overflow-hidden rounded-[2rem] md:rounded-[3rem] pointer-events-none" style={{ backfaceVisibility: 'hidden' }}>
                <img
                    src={item.thumbUrl}
                    className="w-full h-full object-cover opacity-95 transition-transform duration-1000 group-hover:scale-110"
                    alt={item.name}
                    style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" style={{ backfaceVisibility: 'hidden' }} />
            </div>
            {item.overlayText && (
                <div className="absolute inset-x-8 bottom-10 z-20 pointer-events-none" style={{ backfaceVisibility: 'hidden' }}>
                    <p
                        className="font-black text-white text-xl md:text-3xl leading-[0.9] tracking-tighter uppercase drop-shadow-2xl opacity-90 group-hover:scale-105 transition-transform duration-700 origin-left antialiased"
                        style={{ fontFamily: 'Montserrat, sans-serif', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)', willChange: 'transform' }}
                    >
                        {item.overlayText}
                    </p>
                </div>
            )}
            <div className="absolute -top-6 left-2 font-mono text-[8px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 tracking-tighter uppercase whitespace-nowrap antialiased" style={{ backfaceVisibility: 'hidden' }}>
                {item.serial} // LATERAL: {item.location}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ backfaceVisibility: 'hidden' }}>
                <div className="relative flex flex-col items-center animate-pulse duration-[3000ms]">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform" style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}>
                        <Play size={24} fill="white" className="text-white ml-1 opacity-90" />
                    </div>
                    <span className="text-[9px] font-medium text-white/60 uppercase tracking-[0.2em] mt-2 antialiased" style={{ backfaceVisibility: 'hidden' }}>
                        VER HISTORIA
                    </span>
                </div>
            </div>
            <div className="absolute bottom-8 right-8 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-all group-hover:translate-x-1" style={{ backfaceVisibility: 'hidden' }}>
                <span className="text-[10px] text-white font-black uppercase tracking-widest hidden md:block drop-shadow-lg antialiased" style={{ backfaceVisibility: 'hidden' }}>Fly Play</span>
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 shadow-[0_0_10px_rgba(232,33,184,0.8)]" />
            </div>
        </div>
    );
}));
MuralMedia.displayName = 'MuralMedia';

// --- COMPONENT: KINETIC QUOTE (ForwardRef) ---
const KineticQuote = memo(forwardRef(({ item }, ref) => {
    return (
        <div
            ref={ref}
            className={`relative z-40 flex flex-col ${item.offset} transition-opacity duration-1000 ease-out pointer-events-none will-change-transform`}
            style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
        >
            <div className="relative animate-in slide-in-from-bottom-8 duration-1000 fade-in" style={{ backfaceVisibility: 'hidden' }}>
                <span className="text-[10rem] text-slate-200 absolute -top-16 -left-12 font-serif -z-10 opacity-50 select-none" style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}>“</span>
                <p
                    className="font-black text-slate-900 leading-[0.9] tracking-tight max-w-[85vw] md:max-w-[45vw] antialiased"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(2.5rem, 8vw, 6rem)', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)', willChange: 'transform', WebkitFontSmoothing: 'antialiased' }}
                >
                    {item.quote}
                </p>
            </div>
            <div className="mt-8 flex items-center gap-4" style={{ backfaceVisibility: 'hidden' }}>
                <div className="h-[2px] w-12 bg-fuchsia-500" />
                <div className="flex flex-col">
                    <h4 className="font-bold text-slate-900 text-sm md:text-lg uppercase tracking-wider antialiased" style={{ fontFamily: 'Montserrat, sans-serif', backfaceVisibility: 'hidden' }}>{item.author}</h4>
                    <span className="text-slate-400 text-xs font-medium antialiased" style={{ backfaceVisibility: 'hidden' }}>{item.school}</span>
                </div>
            </div>
        </div>
    );
}));
KineticQuote.displayName = 'KineticQuote';

// --- COMPONENT: FLY PLAYER (No Changes) ---
const FlyPlayer = ({ isOpen, onClose, initialId }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showPlane, setShowPlane] = useState(false);

    useEffect(() => {
        if (initialId) {
            const idx = MEDIA_ITEMS.findIndex(t => t.id === initialId);
            if (idx !== -1) setCurrentIndex(idx);
        }
    }, [initialId]);

    if (!isOpen) return null;
    const current = MEDIA_ITEMS[currentIndex];
    const triggerPlane = () => { setShowPlane(true); setTimeout(() => setShowPlane(false), 2000); };
    const next = () => currentIndex < MEDIA_ITEMS.length - 1 && setCurrentIndex(p => p + 1);
    const prev = () => currentIndex > 0 && setCurrentIndex(p => p - 1);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-500">
            <div className="relative w-full h-[100dvh] md:w-[90vw] md:h-[90vh] md:max-w-6xl md:rounded-[3rem] overflow-hidden bg-black shadow-2xl md:border-[1px] md:border-white/10 flex flex-col md:flex-row">
                <div className="w-full md:w-2/3 h-2/3 md:h-full relative bg-slate-900 border-b border-white/5 md:border-b-0 md:border-r">
                    <video key={current.id} src={current.videoUrl} className="w-full h-full object-cover" autoPlay loop playsInline />
                    <button onClick={onClose} className="absolute top-6 right-6 z-20 md:hidden bg-black/50 p-2 rounded-full text-white"><X size={24} /></button>
                </div>
                <div className="w-full md:w-1/3 h-1/3 md:h-full bg-slate-900 text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><Wind size={200} /></div>
                    <div className="space-y-6 relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="animate-in slide-in-from-left-4 duration-500 delay-150">
                                <h2 className="text-4xl md:text-6xl font-black font-sans tracking-tighter leading-[0.9] mb-2">{current.name}</h2>
                                <div className="flex items-center gap-2 text-fuchsia-400"><MapPin size={14} /><span className="text-xs font-bold uppercase tracking-widest">{current.location}</span></div>
                            </div>
                            <button onClick={onClose} className="hidden md:block bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all hover:scale-110"><X size={20} /></button>
                        </div>
                    </div>
                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <button className="flex-1 bg-white text-slate-900 py-4 rounded-full font-bold text-sm hover:bg-slate-100 transition-all">Apadrinar Vuelo</button>
                            <button onClick={triggerPlane} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-95"><Plane size={20} /></button>
                        </div>
                        <div className="flex items-center justify-between pt-6 border-t border-white/10 font-mono text-xs">
                            <span className="text-slate-500">0{currentIndex + 1} / 0{MEDIA_ITEMS.length}</span>
                            <div className="flex gap-4">
                                <button onClick={prev} disabled={currentIndex === 0} className="hover:text-fuchsia-400 disabled:opacity-20"><ChevronUp size={24} /></button>
                                <button onClick={next} disabled={currentIndex === MEDIA_ITEMS.length - 1} className="hover:text-fuchsia-400 disabled:opacity-20"><ChevronDown size={24} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DESKTOP GALLERY CONTROLLER ---
const DesktopGallery = ({ onOpen }) => {
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const itemsRef = useRef({});
    const sponsorContainerRef = useRef(null);
    const sponsorLogosRef = useRef([]);
    const bgRefs = {
        line1: useRef(null),
        line2: useRef(null),
        circle: useRef(null)
    };

    // Animation Refs
    const targetProgress = useRef(0);
    const currentProgress = useRef(0);
    const maxTranslate = useRef(0);
    const isMobile = useRef(false);

    // Interaction Ref (Zero-Rerender)
    const cursorStateRef = useRef({ isHovering: false, center: null });

    useLayoutEffect(() => {
        const handleResize = () => {
            isMobile.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (trackRef.current && trackRef.current.parentElement) {
                const totalWidth = trackRef.current.scrollWidth;
                const visibleWidth = trackRef.current.parentElement.clientWidth;
                maxTranslate.current = Math.max(0, totalWidth - visibleWidth);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const { top, height } = containerRef.current.getBoundingClientRect();
            const maxScroll = height - window.innerHeight;
            targetProgress.current = Math.max(0, Math.min(1, -top / maxScroll));
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useLayoutEffect(() => {
        // --- CENTRALIZED ANIMATION LOOP ---
        const animate = () => {
            // 1. Calculate Progress
            currentProgress.current = lerp(currentProgress.current, targetProgress.current, 0.06);
            if (Math.abs(targetProgress.current - currentProgress.current) < 0.0001) {
                currentProgress.current = targetProgress.current;
            }
            const progress = currentProgress.current;
            const maxT = maxTranslate.current;

            // 2. Update TRACK
            if (trackRef.current) {
                trackRef.current.style.transform = `translate3d(-${progress * maxT}px, 0, 0)`;
            }

            // 3. Update SPONSORS (Layer -1)
            if (sponsorContainerRef.current) {
                sponsorContainerRef.current.style.transform = `translate3d(-${progress * maxT * 0.07}px, 0, 0)`;
                sponsorLogosRef.current.forEach((el, idx) => {
                    if (!el) return;
                    const config = SPONSOR_LOGOS[idx];
                    const extraDrift = idx === 3 ? (progress * maxT * 0.007) : 0;
                    el.style.transform = `translate3d(-${extraDrift}px, 0, 0) rotate(${config.rot}deg)`;
                });
            }

            // 4. Update TOPOGRAPHIC BG
            const pBg = progress * 0.2;
            if (bgRefs.line1.current) bgRefs.line1.current.style.transform = `translateX(${pBg * -200}px) rotate(-12deg)`;
            if (bgRefs.line2.current) bgRefs.line2.current.style.transform = `translateX(${pBg * -300}px) rotate(6deg)`;
            if (bgRefs.circle.current) bgRefs.circle.current.style.transform = `translateX(${pBg * -100}px)`;

            // 5. Update MEDIA & QUOTES (Iterate Registered items)
            Object.keys(itemsRef.current).forEach(id => {
                const node = itemsRef.current[id];
                const itemData = ALL_ITEMS_MAP[id];
                if (!node || !itemData) return;

                if (itemData.type === 'kinetic-quote') {
                    node.style.transform = `translate3d(${progress * 150}px, 0, 0)`;
                } else if (itemData.type.startsWith('media')) {
                    node.style.transform = `translate3d(-${progress * 50}px, 0, 0) ${itemData.rotation}`;
                }
            });

            requestAnimationFrame(animate);
        };
        const raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, []);

    const handleMediaHover = (e, isEnter) => {
        if (isMobile.current) return;
        if (isEnter) {
            const rect = e.currentTarget.getBoundingClientRect();
            cursorStateRef.current = {
                isHovering: true,
                center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            };
        } else {
            cursorStateRef.current = { isHovering: false, center: null };
        }
    };

    return (
        <div ref={containerRef} className="relative h-[540vh] bg-[#F5F5F7] text-slate-800 selection:bg-fuchsia-200 overflow-visible transform-gpu">
            <style dangerouslySetInnerHTML={{ __html: CURSOR_CSS }} />
            <FilmGrain />
            <CustomCursor ref={cursorStateRef} />

            <div className="sticky top-0 h-[100vh] w-full overflow-hidden">
                <TopographicBackground ref={bgRefs} />
                <SponsorWatermarkLayer ref={{ container: sponsorContainerRef, logosRef: sponsorLogosRef }} />

                <div className="absolute top-8 left-8 md:top-12 md:left-12 z-0 opacity-10 pointer-events-none select-none" style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}>
                    <h1 className="text-[12vw] font-black leading-none text-slate-900 tracking-tighter antialiased" style={{ fontFamily: 'Anton, sans-serif', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)', willChange: 'transform' }}>HISTORIAS</h1>
                </div>

                <div className="w-full h-full relative flex items-center">
                    <div ref={trackRef} className="flex items-center gap-[5vw] md:gap-[10vw] will-change-transform pl-[5vw] md:pl-[12vw] pr-[100vw]" style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}>

                        <div className="flex-shrink-0 w-[80vw] md:w-[30vw] flex flex-col justify-center z-30 px-6 md:px-0" style={{ backfaceVisibility: 'hidden' }}>
                            <div className="w-12 h-1 bg-fuchsia-600 mb-8" style={{ backfaceVisibility: 'hidden' }} />
                            <h2
                                className="text-5xl md:text-8xl font-black text-slate-900 leading-[0.9] tracking-tight mb-8 antialiased"
                                style={{ fontFamily: 'Montserrat, sans-serif', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)', willChange: 'transform' }}
                            >
                                Voces del<br />Viento
                            </h2>
                            <p
                                className="text-slate-500 font-medium text-lg leading-relaxed max-w-sm antialiased"
                                style={{ backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)', willChange: 'transform' }}
                            >
                                Pequeñas historias. Grandes alturas. Un solo propósito.
                            </p>
                        </div>

                        {GALLERY_COLUMNS.map((col) => (
                            <div key={col.id} className="flex flex-col flex-shrink-0 h-full justify-center gap-[6vh]">
                                {col.items.map((item) => {
                                    if (item.type === 'kinetic-quote') {
                                        return <KineticQuote key={item.id} item={item} ref={el => { if (el) itemsRef.current[item.id] = el }} />;
                                    }
                                    return <MuralMedia key={item.id} item={item} onOpen={onOpen} handleMediaHover={handleMediaHover} ref={el => { if (el) itemsRef.current[item.id] = el }} />;
                                })}
                            </div>
                        ))}

                        <div className="flex-shrink-0 w-screen h-full flex items-center justify-center">
                            <div className="text-center group cursor-pointer transition-transform duration-500 hover:scale-105" style={{ backfaceVisibility: 'hidden' }}>
                                <div className="w-32 h-32 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto mb-12 shadow-2xl group-hover:shadow-fuchsia-500/30 transition-all hover:bg-fuchsia-600"><ArrowRight size={48} className="transition-transform group-hover:translate-x-2" /></div>
                                <h3 className="text-6xl md:text-9xl font-black text-slate-900 leading-none mb-6 tracking-tighter antialiased" style={{ fontFamily: 'Montserrat, sans-serif', backfaceVisibility: 'hidden', transform: 'translate3d(0,0,0)' }}>
                                    Es tu<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-blue-600">Turno.</span>
                                </h3>
                                <p className="text-slate-500 font-bold text-xs md:text-sm tracking-[0.3em] uppercase opacity-60 group-hover:opacity-100 transition-opacity antialiased" style={{ backfaceVisibility: 'hidden' }}>INICIA TU PROPIA HISTORIA HOY</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MOBILE COMPONENTS (MAGNETIC GRID)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//

// --- MAIN COMPONENT EXPORT ---
export default function HorizontalGalleryWrapper() {
    const [playerOpen, setPlayerOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    const openPlayer = (id) => {
        setSelectedId(id);
        setPlayerOpen(true);
    };

    return (
        <div className="font-sans text-slate-900 bg-white selection:bg-fuchsia-200">
            {/* 
              Desktop Only Section: 
              Visible only on lg (1024px) and above.
            */}
            <div className="hidden lg:block">
                <DesktopGallery onOpen={openPlayer} />
                <FlyPlayer isOpen={playerOpen} onClose={() => setPlayerOpen(false)} initialId={selectedId} />
            </div>

            {/* 
              Future Mobile Section: 
              Insert here the code for the new mobile replacement.
              It should have 'block lg:hidden'.
            */}
            <div className="block lg:hidden">
                <MobileGallery onOpen={openPlayer} />
            </div>
        </div>
    );
}
