'use client';

import React, { useState, useEffect } from 'react';
import { School } from 'lucide-react';

export default function FloatingCTA() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const scrollContainer = document.querySelector('main');
        if (!scrollContainer) return;

        const handleScroll = () => {
            // Mostrar botón cuando se ha scrolleado más del 30% de la altura de la ventana
            if (scrollContainer.scrollTop > window.innerHeight * 0.3) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        // Initial check
        handleScroll();

        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToBenefits = () => {
        document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
                }`}
        >
            <button
                onClick={scrollToBenefits}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black text-[10px] sm:text-xs py-3 px-6 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.4)] flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group tracking-widest uppercase border-0"
            >
                <div className="bg-white/20 p-1.5 rounded-full group-hover:bg-white/30 transition-colors backdrop-blur-sm">
                    <School size={16} className="text-white" />
                </div>
                <span>Registrar Escuela</span>
            </button>
        </div>
    );
}
