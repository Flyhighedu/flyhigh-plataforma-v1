'use client';

import React, { useRef, useEffect } from 'react';

const VideoWithPause = ({ src }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleEnded = () => {
            setTimeout(() => {
                video.currentTime = 0;
                video.play().catch(e => console.log("Play failed:", e));
            }, 5000); // 5 segundos de pausa
        };

        video.addEventListener('ended', handleEnded);
        return () => video.removeEventListener('ended', handleEnded);
    }, []);

    return (
        <video
            ref={videoRef}
            src={src}
            autoPlay
            muted
            playsInline
            // Quitamos 'loop' para controlar el reinicio manualmente
            className="h-32 w-auto mx-auto mb-2 object-contain" // Más grande (h-32)
        />
    );
};

export default function SponsorsGrid() {
    return (
        <section id="sponsors" className="py-24 px-6 space-y-16 bg-white relative">
            <style jsx>{`
                :global(:root) {
                    --steam-science: #007AFF;
                    --steam-tech: #8E54E9;
                    --steam-eng: #FF512F;
                    --steam-art: #FFD200;
                    --steam-math: #4CD964;
                    --obsidian: #0A0A0A;
                }
                
                .card-elite {
                    background: #FFFFFF;
                    border: 1px solid #EEEEEE;
                    border-radius: 32px;
                    transition: transform 0.3s cubic-bezier(0.165, 0.84, 0.44, 1), border-color 0.3s ease;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.01);
                    position: relative;
                    z-index: 1;
                }

                .card-elite:active {
                    transform: scale(0.98);
                }

                .steam-badge {
                    width: 4px;
                    height: 24px;
                    border-radius: 2px;
                }
            `}</style>

            <div className="text-center mb-16 reveal-node">
                <h2 className="text-[9px] font-bold tracking-[0.6em] text-blue-600 uppercase mb-4">
                    Motores del Cambio
                </h2>
                <p className="text-gray-900 text-3xl font-black leading-tight">
                    Presentamos a las empresas visionarias que han transformado sus recursos en alas.
                </p>
            </div>

            {/* Sponsor 1: Strong Plastic */}
            <div className="card-elite p-10 reveal-node">
                <div className="flex justify-between items-start mb-12">
                    <div className="flex items-center space-x-2">
                        <div className="steam-badge" style={{ backgroundColor: 'var(--steam-science)' }}></div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-800">Inversión STEAM</span>
                    </div>
                    <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Aliado Fundador</span>
                </div>
                <div className="text-center py-6">
                    <VideoWithPause src="/videos/logo strong plastic animado.mp4" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-12">Compromiso Industrial</p>
                    <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-10">
                        <div>
                            <span className="text-3xl font-black block leading-none text-slate-900">1,500</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-2 block">Alas Entregadas</span>
                        </div>
                        <div>
                            <span className="text-3xl font-black block leading-none text-slate-900">12</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-2 block">Escuelas</span>
                        </div>
                    </div>
                </div>
                <button className="w-full mt-10 border border-gray-100 py-4 rounded-xl font-black text-[9px] tracking-widest uppercase active:bg-gray-50 text-slate-900 transition-colors">
                    Ver Huella de Impacto
                </button>
            </div>

            {/* Sponsor 2: RV FRESH */}
            <div className="card-elite p-10 reveal-node">
                <div className="flex justify-between items-start mb-12">
                    <div className="flex items-center space-x-2">
                        <div className="steam-badge" style={{ backgroundColor: 'var(--steam-tech)' }}></div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-800">Inversión STEAM</span>
                    </div>
                    <span className="text-[8px] font-bold bg-purple-50 text-purple-600 px-3 py-1 rounded-full uppercase">Patrocinador Oro</span>
                </div>
                <div className="text-center py-6">
                    <VideoWithPause src="/videos/logo rv fresh animado(1).mp4" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-12">Impulso Agrícola</p>
                    <div className="grid grid-cols-2 gap-8 border-t border-gray-100 pt-10">
                        <div>
                            <span className="text-3xl font-black block leading-none text-slate-900">850</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-2 block">Niños Volados</span>
                        </div>
                        <div>
                            <span className="text-3xl font-black block leading-none text-slate-900">05</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-2 block">Instituciones</span>
                        </div>
                    </div>
                </div>
                <button className="w-full mt-10 border border-gray-100 py-4 rounded-xl font-black text-[9px] tracking-widest uppercase active:bg-gray-50 text-slate-900 transition-colors">
                    Auditar Inversión
                </button>
            </div>

            {/* Captación CTA */}
            <div className="reveal-node">
                <div className="bg-blue-600 rounded-[40px] p-12 text-white text-center shadow-2xl relative overflow-hidden transform-gpu">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </div>
                        <h3 className="text-2xl font-black tracking-tighter mb-4 uppercase leading-tight">Tu logo aquí es una promesa cumplida.</h3>
                        <p className="text-white/70 text-xs mb-10 max-w-[200px] mx-auto">Hay un lugar reservado para las empresas que no solo habitan Uruapan, sino que la construyen.</p>
                        <button className="w-full bg-white text-blue-600 py-5 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-xl active:scale-95 transition-transform">
                            Iniciar mi Legado
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
