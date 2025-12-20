"use client";
import React from 'react';

export default function EscuelasHero() {
    const scrollToCard = () => {
        const card = document.getElementById('missionCard');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <header className="escuelas-hero">
            <div className="hero-video-container">
                <video
                    className="hero-video"
                    src="/videos/Videoportada.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                />
                <div className="hero-overlay"></div>
            </div>

            <div style={{ zIndex: 2, position: 'relative' }}>
                <h1>Misión: Cielos Abiertos</h1>
                <p>Conectando la educación con el futuro.</p>
                <button onClick={scrollToCard} className="btn-start">
                    Iniciar Plan de Vuelo
                </button>
            </div>
        </header>
    );
}
