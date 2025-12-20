'use client';

import React, { useEffect, useRef } from 'react';

export default function MaestrosCTA() {
    const btnRef = useRef(null);

    useEffect(() => {
        // MAGNETIC BUTTON
        const handleBtnMove = (e) => {
            if (!btnRef.current) return;
            const position = btnRef.current.getBoundingClientRect();
            const x = e.pageX - position.left - position.width / 2;
            const y = e.pageY - position.top - position.height / 2;

            btnRef.current.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        };

        const handleBtnLeave = () => {
            if (btnRef.current) {
                btnRef.current.style.transform = 'translate(0px, 0px)';
            }
        };

        const btn = btnRef.current;
        if (btn) {
            btn.addEventListener('mousemove', handleBtnMove);
            btn.addEventListener('mouseleave', handleBtnLeave);
        }

        return () => {
            if (btn) {
                btn.removeEventListener('mousemove', handleBtnMove);
                btn.removeEventListener('mouseleave', handleBtnLeave);
            }
        };
    }, []);

    return (
        <>
            <style jsx>{`
        .cta-section {
            height: 80vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: white;
            text-align: center;
            width: 100%;
        }

        .cta-title {
            font-size: 2.5rem;
            margin-bottom: 3rem;
            font-weight: 700;
        }

        .magnetic-btn {
            padding: 1.5rem 4rem;
            font-size: 1.1rem;
            font-weight: 700;
            color: white;
            background: #000;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            text-transform: uppercase;
            letter-spacing: 2px;
            display: inline-block;
            text-decoration: none;
            z-index: 1;
        }

        .magnetic-btn::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(45deg, var(--accent-cyan), var(--accent-pink));
            z-index: -1;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .magnetic-btn:hover {
            transform: scale(1.05);
        }

        .magnetic-btn:hover::before {
            opacity: 1;
        }

        .cta-sub {
            margin-top: 1.5rem;
            color: #666;
            font-size: 0.9rem;
        }
        
        .cta-sub a {
            color: #000;
            text-decoration: none;
            border-bottom: 1px solid #ccc;
            transition: border-color 0.3s;
        }
        
        .cta-sub a:hover {
            border-color: #000;
        }
      `}</style>
            <section className="cta-section">
                <div className="cta-title reveal-text">¿Listo para tomar el mando?</div>

                <a href="#" className="magnetic-btn reveal-text" id="magneticBtn" ref={btnRef}>
                    Ingresar a Cabina
                </a>

                <div className="cta-sub reveal-text">
                    ¿Tu escuela no está registrada? <a href="#">Solicitar código de vuelo</a>
                </div>
            </section>
        </>
    );
}
