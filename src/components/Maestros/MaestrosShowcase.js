'use client';

import React, { useEffect, useRef } from 'react';

export default function MaestrosShowcase() {
    const showcaseRef = useRef(null);
    const tabletRef = useRef(null);

    useEffect(() => {
        // 3D TABLET EFFECT (Mouse Move)
        const handleTabletMove = (e) => {
            if (!tabletRef.current) return;

            const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
            const clampX = Math.max(-10, Math.min(10, xAxis));
            const clampY = Math.max(-10, Math.min(10, yAxis));

            tabletRef.current.style.transform = `rotateY(${clampX}deg) rotateX(${clampY}deg)`;
        };

        const handleTabletLeave = () => {
            if (tabletRef.current) {
                tabletRef.current.style.transform = `rotateY(0deg) rotateX(0deg)`;
            }
        };

        const section = showcaseRef.current;
        if (section) {
            section.addEventListener('mousemove', handleTabletMove);
            section.addEventListener('mouseleave', handleTabletLeave);
        }

        return () => {
            if (section) {
                section.removeEventListener('mousemove', handleTabletMove);
                section.removeEventListener('mouseleave', handleTabletLeave);
            }
        };
    }, []);

    return (
        <>
            <style jsx>{`
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 2rem;
        }
        
        .showcase-section {
            background-color: #F8F8FA;
            padding: 5rem 0 10rem 0;
            position: relative;
            perspective: 2000px;
            width: 100%;
        }

        .showcase-header {
            text-align: center;
            margin-bottom: 5rem;
        }

        .showcase-grid {
            display: grid;
            grid-template-columns: 1fr 2fr 1fr;
            gap: 2rem;
            align-items: center;
            max-width: 1200px;
            margin: 0 auto;
        }

        .feature-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255, 0.8);
            border-radius: 24px;
            padding: 2rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.05);
            transition: transform 0.4s ease, box-shadow 0.4s ease;
            cursor: default;
        }

        .feature-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 30px 60px rgba(0,242,234,0.15);
            border-color: var(--accent-cyan);
        }

        .icon-box {
            width: 50px;
            height: 50px;
            background: #111;
            color: white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            margin-bottom: 1.5rem;
        }

        .feature-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .feature-desc {
            font-size: 0.9rem;
            color: #666;
            line-height: 1.5;
        }

        .tablet-mockup {
            width: 100%;
            aspect-ratio: 4/3;
            background: #1a1a1a;
            border-radius: 30px;
            position: relative;
            box-shadow: 
                0 50px 100px -20px rgba(0,0,0,0.3),
                inset 0 0 0 2px #333;
            transform-style: preserve-3d;
            transform: rotateY(0deg) rotateX(0deg);
            transition: transform 0.1s ease-out; 
            padding: 12px;
            display: flex;
        }

        .screen {
            background: #fff;
            width: 100%;
            height: 100%;
            border-radius: 20px;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .dash-nav {
            height: 50px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            padding: 0 20px;
            justify-content: space-between;
        }
        .dash-circle { width: 30px; height: 30px; background: #eee; border-radius: 50%; }
        .dash-lines { width: 100px; height: 10px; background: #eee; border-radius: 5px; }
        
        .dash-content {
            padding: 20px;
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 15px;
            background: #fbfbfb;
            flex: 1;
        }
        
        .dash-card-lg {
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.03);
            height: 100%;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .dash-graph {
            flex: 1;
            background: linear-gradient(to top, rgba(0,242,234,0.1), transparent);
            border-bottom: 2px solid var(--accent-cyan);
            border-radius: 0 0 10px 10px;
            position: relative;
            overflow: hidden;
        }
        
        .dash-graph::after {
            content: '';
            position: absolute;
            left: 0; bottom: 0;
            width: 100%; height: 2px;
            background: white;
            animation: scanGraph 2s infinite;
        }

        .dash-card-sm {
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.03);
            height: 48%;
            margin-bottom: 4%;
        }

        @keyframes scanGraph {
            0% { left: -100%; }
            50% { left: 100%; }
            100% { left: 100%; }
        }

        @media (max-width: 900px) {
            .showcase-grid {
                grid-template-columns: 1fr;
            }
            .tablet-mockup {
                order: -1;
                margin-bottom: 2rem;
            }
        }
      `}</style>
            <section className="showcase-section" ref={showcaseRef}>
                <div className="container">
                    <div className="showcase-header">
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '700' }} className="reveal-text">Tecnología de Cabina</h2>
                        <p style={{ color: '#666', marginTop: '10px' }} className="reveal-text">Todo lo que necesitas para operar el vuelo, en tu mano.</p>
                    </div>

                    <div className="showcase-grid">
                        <div className="feature-card reveal-text" style={{ transitionDelay: '0.1s' }}>
                            <div className="icon-box"><i className="fa-solid fa-satellite-dish"></i></div>
                            <div className="feature-title">Control de Misión</div>
                            <div className="feature-desc">Monitorea el estado de la flota de drones y la conexión de tus alumnos en tiempo real.</div>
                        </div>

                        {/* TABLET MOCKUP with Ref */}
                        <div className="tablet-mockup" id="tablet3D" ref={tabletRef}>
                            <div className="screen">
                                <div className="dash-nav">
                                    <div className="dash-circle"></div>
                                    <div className="dash-lines"></div>
                                </div>
                                <div className="dash-content">
                                    <div className="dash-card-lg">
                                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>ALTITUD DE VUELO</div>
                                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>1,200m</div>
                                        <div className="dash-graph"></div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div className="dash-card-sm" style={{ background: '#000', color: 'white', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className="fa-solid fa-plane-departure"></i>
                                        </div>
                                        <div className="dash-card-sm" style={{ background: 'var(--accent-pink)', opacity: '0.8' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="feature-card reveal-text" style={{ transitionDelay: '0.2s' }}>
                            <div className="icon-box"><i className="fa-solid fa-atom"></i></div>
                            <div className="feature-title">Marketplace STEAM</div>
                            <div className="feature-desc">Accede a guías narrativas y actividades post-vuelo para aterrizar el aprendizaje.</div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
