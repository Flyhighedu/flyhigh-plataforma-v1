'use client';

import React, { useEffect } from 'react';
// MaestrosHeader removed as it is now integrated into the Hero/Brutalist design
import MaestrosHero from '@/components/Maestros/MaestrosHero';
import MaestrosTransition from '@/components/Maestros/MaestrosTransition';
import MaestrosShowcase from '@/components/Maestros/MaestrosShowcase';
import MaestrosEmotion from '@/components/Maestros/MaestrosEmotion';
import MaestrosCTA from '@/components/Maestros/MaestrosCTA';

export default function Page() {
    useEffect(() => {
        // 1. REVEAL ON SCROLL (Intersection Observer)
        // This observes elements inside the child components
        const revealElements = document.querySelectorAll('.reveal-text, .reveal-up');

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    if (entry.target.classList.contains('reveal-text')) {
                        entry.target.classList.add('visible');
                    }
                }
            });
        }, { threshold: 0.1 });

        revealElements.forEach(el => revealObserver.observe(el));

        return () => {
            revealObserver.disconnect();
        };
    }, []);

    return (
        <div className="maestros-page-wrapper">
            {/* FONTS & ICONS */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;800&family=Oswald:wght@500;700&family=Space+Grotesk:wght@300;500;700&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

            <style dangerouslySetInnerHTML={{
                __html: `
            /* --- VARIABLES & RESET --- */
            :root {
                --primary: #000000;
                --secondary: #ffffff;
                --accent-cyan: #00f2ea;
                --accent-pink: #ff0050;
                --glass-bg: rgba(255, 255, 255, 0.05);
                --glass-border: rgba(255, 255, 255, 0.1);
                --text-main: #1a1a1a;
                --text-muted: #666;
                --font-display: 'Montserrat', sans-serif;
                --font-tech: 'Space Grotesk', sans-serif;
                --font-giant: 'Oswald', sans-serif;
            }

            .maestros-page-wrapper * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            .maestros-page-wrapper {
                background-color: var(--secondary);
                color: var(--text-main);
                font-family: var(--font-display);
                overflow-x: hidden;
                width: 100%;
                min-height: 100vh;
            }
            
            /* GLOBAL UTILITIES USED BY CHILDREN */
            .reveal-text {
                opacity: 0;
                transform: translateY(30px);
                transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .reveal-text.visible {
                opacity: 1;
                transform: translateY(0);
            }
        `}} />

            {/* HEADER removed, integrated in Hero */}
            <MaestrosHero />
            <MaestrosTransition />
            <MaestrosShowcase />
            <MaestrosEmotion />
            <MaestrosCTA />

        </div>
    );
}
