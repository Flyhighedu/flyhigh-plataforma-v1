"use client";
import React, { useRef, useEffect } from 'react';
import { Quote } from 'lucide-react';

export default function EscuelasIntro() {
    const textRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-8');
                        entry.target.style.opacity = '1';
                    }
                });
            },
            { threshold: 0.2 }
        );

        if (textRef.current) {
            observer.observe(textRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <section className="relative z-30 pt-16 pb-0 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div ref={textRef} className="relative z-10 opacity-0 duration-1000 fill-mode-forwards text-center">

                    {/* Editorial Eyebrow */}
                    <span className="block text-blue-600 font-bold tracking-widest uppercase text-xs mb-4">
                        NUEVAS PERSPECTIVAS
                    </span>

                    <div className="space-y-2 max-w-4xl mx-auto flex flex-col items-center">
                        {/* Direct Headline */}
                        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none uppercase">
                            Eleva el nivel de<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                                tu escuela.
                            </span>
                        </h2>

                        <div className="w-24 h-1 bg-slate-100 mx-auto rounded-full mt-2 mb-0"></div>

                        {/* Inspirational Manifesto */}
                        <div className="text-lg md:text-2xl text-slate-600 font-medium leading-relaxed tracking-tight max-w-2xl mx-auto">
                            No solo los llevamos a volar; encendemos vocaciones.
                            <strong className="block text-slate-900 mt-2">
                                Creemos en nutrir a los niños inspirándolos a mirar más allá de su entorno.
                            </strong>
                        </div>

                    </div>

                </div>
            </div>
        </section>
    );
}
