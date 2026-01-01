'use client';

import React, { useEffect, useState } from 'react';
import { Inter, Syne } from 'next/font/google';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import Navbar from '@/components/Navbar';
import PatrocinadoresHero from '@/components/Patrocinadores/PatrocinadoresHero';
import SponsorsGrid from '@/components/Patrocinadores/SponsorsGrid';
import PatrocinadoresAllies from '@/components/Patrocinadores/PatrocinadoresAllies';
import PortalOverlay from '@/components/Patrocinadores/PortalOverlay';
import FloatingButton from '@/components/Patrocinadores/FloatingButton';

// Configure fonts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-syne' });

export default function Page() {
    const [isPortalOpen, setIsPortalOpen] = useState(false);

    // Initial Animation Setup
    useEffect(() => {
        gsap.registerPlugin(ScrollTrigger);

        // Select all elements with .reveal-node class
        const nodes = gsap.utils.toArray(".reveal-node");

        nodes.forEach(node => {
            gsap.to(node, {
                scrollTrigger: {
                    trigger: node,
                    start: "top 90%", // Trigger when top of element hits 90% viewport height
                    toggleActions: "play none none none"
                },
                opacity: 1,
                y: 0,
                duration: 1,
                ease: "power3.out"
            });
        });

        // Cleanup function
        return () => {
            ScrollTrigger.getAll().forEach(t => t.kill());
        };
    }, []);

    // Handle Body Overflow when Modal is open
    useEffect(() => {
        if (isPortalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isPortalOpen]);

    const togglePortals = () => {
        setIsPortalOpen(prev => !prev);
    };

    const scrollToSponsors = () => {
        const element = document.getElementById('sponsors');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <main className={`${inter.variable} ${syne.variable} font-sans bg-white text-[#1A1A1A] overflow-x-hidden min-h-screen relative selection:bg-blue-100 selection:text-blue-900`}>

            <style jsx global>{`
                /* Utilizado para los títulos display */
                .font-syne { font-family: var(--font-syne), sans-serif; }
                
                /* Clase base para animaciones de entrada */
                .reveal-node { 
                    opacity: 0; 
                    transform: translateY(30px); 
                    will-change: transform, opacity;
                }
            `}</style>

            {/* Navigation (Global) */}
            <Navbar />

            {/* Sections */}
            <PatrocinadoresHero onScrollToSponsors={scrollToSponsors} />
            <SponsorsGrid />
            <PatrocinadoresAllies />

            {/* Interactive Elements */}
            <FloatingButton onClick={togglePortals} />
            <PortalOverlay isOpen={isPortalOpen} onClose={() => setIsPortalOpen(false)} />

        </main>
    );
}
