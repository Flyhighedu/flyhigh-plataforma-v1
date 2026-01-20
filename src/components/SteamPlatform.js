'use client';

import React, { useEffect, useRef } from 'react';
import { Users, Wind, Zap, Eye, Gamepad2, Lock } from 'lucide-react';
import gsap from 'gsap';

export default function SteamPlatform() {
    const sectionRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        // Create GSAP animation
        animationRef.current = gsap.to(".iphone-dark", {
            y: -15,
            duration: 4,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        });

        // Pause animation when section is not visible (Performance optimization)
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (animationRef.current) {
                    entry.isIntersecting ? animationRef.current.play() : animationRef.current.pause();
                }
            },
            { threshold: 0.1 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => {
            observer.disconnect();
            if (animationRef.current) {
                animationRef.current.kill();
            }
        };
    }, []);

    return (
        <section
            ref={sectionRef}
            className="pt-2 md:pt-24 pb-8 md:pb-48 bg-gradient-to-b from-white via-[#F5F7FA] to-white relative z-[70] flex flex-col justify-center min-h-[100svh]"
            style={{
                contain: 'layout paint',
                overscrollBehavior: 'none',
                contentVisibility: 'auto',
                containIntrinsicSize: '0 900px'
            }}
        >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 w-full">
                <div className="bg-[#0B1120] rounded-[2rem] sm:rounded-[3.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden relative border border-white/5 group">
                    <div className="absolute -right-20 -top-20 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[#7000FF]/10 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute -left-20 -bottom-20 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[#FF0055]/10 rounded-full blur-[100px] animate-pulse"></div>

                    <div className="flex flex-col md:flex-row items-center p-4 sm:p-12 gap-4 md:gap-16">
                        <div className="w-full md:w-[40%] flex justify-center relative order-2 md:order-1">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-white/5 rounded-full blur-3xl -z-10"></div>
                            <div className="iphone-dark w-[140px] h-[280px] sm:w-[200px] sm:h-[400px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transform rotate-[-8deg] md:group-hover:rotate-[-4deg] transition-all duration-700">
                                <div className="notch-dark w-[60px] sm:w-[80px]"></div>
                                <div className="w-full h-full bg-[#0f0f0f] p-2 sm:p-3 pt-6 sm:pt-8 overflow-hidden">
                                    <div className="flex justify-between items-center mb-3 sm:mb-4">
                                        <div className="flex gap-0.5">
                                            <div className="w-1 h-1 rounded-full bg-[#00F0FF]"></div>
                                            <div className="w-1 h-1 rounded-full bg-[#FF0055]"></div>
                                        </div>
                                        <span className="text-[8px] text-gray-500 uppercase font-bold">Marketplace</span>
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <div className="bg-[#1a1a1a] p-1.5 sm:p-2 rounded-lg border border-gray-800 flex items-center gap-2">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-orange-500/20 text-orange-500 flex items-center justify-center"><Users className="w-3 h-3 sm:w-4 sm:h-4" /></div>
                                            <div><p className="text-[7px] sm:text-[8px] text-white font-bold">Píxeles Humanos</p></div>
                                        </div>
                                        <div className="bg-[#1a1a1a] p-1.5 sm:p-2 rounded-lg border border-gray-800 flex items-center gap-2">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-cyan-500/20 text-cyan-500 flex items-center justify-center"><Wind className="w-3 h-3 sm:w-4 sm:h-4" /></div>
                                            <div><p className="text-[7px] sm:text-[8px] text-white font-bold">Aterrizaje Forzoso</p></div>
                                        </div>
                                        <div className="bg-[#1a1a1a] p-1.5 sm:p-2 rounded-lg border border-gray-800 flex items-center gap-2">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-yellow-500/20 text-yellow-500 flex items-center justify-center"><Zap className="w-3 h-3 sm:w-4 sm:h-4" /></div>
                                            <div><p className="text-[7px] sm:text-[8px] text-white font-bold">Batería Crítica</p></div>
                                        </div>
                                        <div className="bg-[#1a1a1a] p-1.5 sm:p-2 rounded-lg border border-gray-800 flex items-center gap-2">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-purple-500/20 text-purple-500 flex items-center justify-center"><Eye className="w-3 h-3 sm:w-4 sm:h-4" /></div>
                                            <div><p className="text-[7px] sm:text-[8px] text-white font-bold">Veo Veo 360º</p></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-[60%] text-center md:text-left order-1 md:order-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-4 sm:mb-6 mx-auto md:mx-0">
                                <span className="w-2 h-2 rounded-full bg-[#00FF94] animate-pulse"></span>
                                <span className="text-white text-[10px] font-bold tracking-widest uppercase">Fase 3: Aterrizaje y Aprendizaje</span>
                            </div>

                            <div className="flex gap-1 mb-3 sm:mb-4 justify-center md:justify-start select-none">
                                <span className="text-2xl sm:text-3xl font-black text-[#00F0FF] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">S</span>
                                <span className="text-2xl sm:text-3xl font-black text-[#7000FF] drop-shadow-[0_0_10px_rgba(112,0,255,0.5)]">T</span>
                                <span className="text-2xl sm:text-3xl font-black text-[#FFD600]">E</span>
                                <span className="text-2xl sm:text-3xl font-black text-[#FF0055] drop-shadow-[0_0_10px_rgba(255,0,85,0.5)]">A</span>
                                <span className="text-2xl sm:text-3xl font-black text-[#00FF94]">M</span>
                            </div>

                            <h2 className="font-['Outfit',sans-serif] font-bold text-lg sm:text-4xl text-white mb-2 md:mb-3">
                                El dron aterriza, pero la <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#7000FF]">mente sigue volando.</span>
                            </h2>

                            <p className="text-slate-400 text-[10px] sm:text-base mb-4 sm:mb-8 max-w-lg mx-auto md:mx-0 leading-relaxed">
                                Reforzamos lo visto en el aire con retos digitales. Un marketplace de actividades donde los maestros se convierten en "Game Masters" y el patio en un tablero gigante.
                            </p>

                            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                <button suppressHydrationWarning className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[linear-gradient(90deg,#FF0055_0%,#7000FF_100%)] shadow-[0_0_15px_rgba(255,0,85,0.4)] hover:scale-105 transition-all flex items-center gap-2">
                                    <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Explorar Marketplace
                                </button>
                                <button suppressHydrationWarning className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
                                    <Lock className="w-3 h-3" /> Acceso Maestros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .iphone-dark {
          border: 8px solid #1a1a1a;
          border-radius: 35px;
          overflow: hidden;
          position: relative;
          background: #0f0f0f;
          box-shadow: 0 0 0 2px #333, 0 30px 80px -20px rgba(0,0,0,0.8);
        }
        @media (min-width: 640px) {
            .iphone-dark {
                border: 10px solid #1a1a1a;
                border-radius: 45px;
            }
        }
        .notch-dark {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          height: 20px;
          background: #1a1a1a;
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
          z-index: 20;
        }
        @media (min-width: 640px) {
            .notch-dark {
                height: 25px;
                border-bottom-left-radius: 14px;
                border-bottom-right-radius: 14px;
            }
        }
      `}</style>
        </section>
    );
}
