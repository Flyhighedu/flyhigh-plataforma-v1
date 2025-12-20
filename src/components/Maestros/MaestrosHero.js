'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function MaestrosHero() {
    const trackRef = useRef(null);
    const maskRef = useRef(null);
    const glowRef = useRef(null);
    const contentRef = useRef(null);
    const indicatorRef = useRef(null);

    // Refs for stagger elements
    const badgeRef = useRef(null);
    const headlineRef = useRef(null);
    const subRef = useRef(null);
    const ctaRef = useRef(null);

    useEffect(() => {
        // GSAP Context to ensure cleanup
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: trackRef.current,
                    start: "top top",
                    end: "bottom bottom",
                    scrub: 0.5, // Smooth scrub
                }
            });

            // 1. ZOOM IN (Scale ELEVA massive)
            tl.to([maskRef.current, glowRef.current], {
                scale: 60,
                duration: 10,
                ease: "power2.inOut"
            });

            // 2. Fade out mask just before it pixelates
            tl.to(maskRef.current, { opacity: 0, duration: 2 }, "-=2");

            // 3. Fade out glow and indicator fast
            tl.to([glowRef.current, indicatorRef.current], { opacity: 0, duration: 1 }, 0);

            // 4. Content Appearance (Overlap with zoom end)
            tl.to(contentRef.current, {
                opacity: 1,
                pointerEvents: "all",
                duration: 3,
                ease: "power2.out"
            }, "-=2.5");

            // 5. Stagger elements entry
            tl.from([badgeRef.current, headlineRef.current, subRef.current, ctaRef.current], {
                y: 30,
                opacity: 0,
                duration: 1,
                stagger: 0.1
            }, "-=1.5");

        });

        return () => ctx.revert();
    }, []);

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

            <style jsx>{`
        /* --- VARIABLES --- */
        :root {
            --bg-white: #ffffff;
            --text-black: #111111;
            --brand-cyan: #00f2ea;
            --brand-pink: #ff0050;
            --font-main: 'Montserrat', sans-serif;
            --radius-btn: 50px;
        }

        /* --- 1. VIDEO LAYER --- */
        .video-layer {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100vh;
            z-index: 0;
            overflow: hidden;
        }

        .hero-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.85);
        }

        /* --- 2. MASK CONTAINER --- */
        .mask-container {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100vh;
            z-index: 10;
            background-color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            mix-blend-mode: screen; 
            transform-origin: center center;
            will-change: transform, opacity;
        }

        .giant-word {
            font-family: 'Montserrat', sans-serif;
            font-size: 22vw;
            font-weight: 900;
            color: black;
            text-transform: uppercase;
            letter-spacing: -0.02em;
            margin: 0;
            padding: 0;
            line-height: 0.8;
            white-space: nowrap;
        }

        /* --- 3. GLOW LAYER --- */
        .glow-layer {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100vh;
            z-index: 11;
            pointer-events: none;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .glow-text {
            font-family: 'Montserrat', sans-serif;
            font-size: 22vw;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.02em;
            line-height: 0.8;
            color: transparent;
            text-shadow: 
                -10px -10px 50px rgba(0, 242, 234, 0.25),
                10px 10px 50px rgba(255, 0, 80, 0.25);
            opacity: 1;
        }

        /* --- 4. CONTENT LAYER --- */
        .content-layer {
            position: fixed; /* Fixed so it remains in view after spacer scroll */
            top: 0; left: 0; width: 100%; height: 100vh;
            z-index: 20;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            padding-bottom: 12vh;
            opacity: 0;
            pointer-events: none;
            text-align: center;
            padding-left: 20px;
            padding-right: 20px;
        }

        .badge-pill {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 10px 24px;
            border-radius: 50px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 2rem;
            color: #fff;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-family: 'Montserrat', sans-serif;
        }

        .headline {
            font-family: 'Montserrat', sans-serif;
            font-size: clamp(2.5rem, 5vw, 4.5rem);
            font-weight: 800;
            line-height: 1.1;
            margin-bottom: 1.5rem;
            text-shadow: 0 10px 30px rgba(0,0,0,0.5);
            max-width: 1200px;
        }

        .highlight-sky {
            background: linear-gradient(90deg, #00f2ea, #fff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .sub-headline {
            font-family: 'Montserrat', sans-serif;
            font-size: clamp(1rem, 1.5vw, 1.2rem);
            font-weight: 500;
            line-height: 1.6;
            max-width: 700px;
            margin-bottom: 3rem;
            color: rgba(255,255,255,0.9);
            text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        .cta-btn {
            background: white;
            color: #111;
            padding: 20px 45px;
            border-radius: 50px;
            font-weight: 800;
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 10px 40px rgba(0, 242, 234, 0.3);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: relative;
            overflow: hidden;
            pointer-events: auto;
            font-family: 'Montserrat', sans-serif;
        }

        .cta-btn::before {
            content: ''; position: absolute; top:0; left:0; width:100%; height:100%;
            background: linear-gradient(90deg, #00f2ea, #ff0050);
            opacity: 0; transition: opacity 0.3s; z-index: 0;
        }
        
        .cta-btn span, .cta-btn i { position: relative; z-index: 1; }

        .cta-btn:hover {
            transform: scale(1.05);
            color: white;
            box-shadow: 0 20px 50px rgba(255, 0, 80, 0.4);
        }
        
        .cta-btn:hover::before { opacity: 1; }

        .scroll-indicator {
            position: fixed;
            bottom: 30px; left: 50%; transform: translateX(-50%);
            z-index: 50;
            color: #888;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            mix-blend-mode: multiply;
            font-family: 'Montserrat', sans-serif;
        }

        .scroll-track {
            height: 350vh;
            width: 100%;
            position: relative;
            z-index: 1;
        }
      `}</style>

            {/* 1. VIDEO LAYER */}
            <div className="video-layer">
                <video className="hero-video" autoPlay loop muted playsInline poster="https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1000">
                    <source src="https://videos.pexels.com/video-files/3205934/3205934-uhd_2560_1440_25fps.mp4" type="video/mp4" />
                    Tu navegador no soporta video.
                </video>
            </div>

            {/* 2. MASK CONTAINER */}
            <div className="mask-container" ref={maskRef}>
                <h1 className="giant-word">ELEVA</h1>
            </div>

            {/* 3. GLOW LAYER */}
            <div className="glow-layer">
                <h1 className="glow-text" ref={glowRef}>ELEVA</h1>
            </div>

            {/* 4. CONTENT LAYER */}
            <div className="content-layer" ref={contentRef}>
                <div className="badge-pill" ref={badgeRef}>
                    <i className="fa-solid fa-plane-departure"></i> &nbsp; Capitanes de Misión
                </div>

                <h2 className="headline" ref={headlineRef}>
                    DONDE TERMINA EL PIZARRÓN,<br />
                    <span className="highlight-sky">COMIENZA EL CIELO.</span>
                </h2>

                <p className="sub-headline" ref={subRef}>
                    Tu liderazgo ya no cabe en cuatro paredes.
                    Guía a tu tripulación en una expedición que cambiará su perspectiva para siempre.
                </p>

                <a href="#" className="cta-btn" ref={ctaRef}>
                    <span>Iniciar Misión</span>
                    <i className="fa-solid fa-arrow-right"></i>
                </a>
            </div>

            <div className="scroll-indicator" ref={indicatorRef}>Scroll para Despegar</div>

            <div className="scroll-track" ref={trackRef}></div>
        </>
    );
}
