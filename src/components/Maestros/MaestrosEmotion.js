import React from 'react';

export default function MaestrosEmotion() {
    return (
        <>
            <style jsx>{`
        .emotion-section {
            background: #000;
            color: white;
            padding: 8rem 0;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }
        
        .emotion-video-overlay {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            opacity: 0.4;
            background-image: url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2576&auto=format&fit=crop');
            background-size: cover;
            background-position: center;
            filter: grayscale(100%);
        }

        .emotion-text {
            position: relative;
            z-index: 5;
            text-align: center;
            font-size: clamp(2rem, 5vw, 4rem);
            font-weight: 300;
            line-height: 1.3;
        }

        .emotion-text strong {
            font-weight: 800;
            background: linear-gradient(90deg, #fff, var(--accent-cyan));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: block;
        }
      `}</style>
            <section className="emotion-section">
                <div className="emotion-video-overlay"></div>
                <div className="emotion-text reveal-text">
                    Enseñar es dejar huella.<br />
                    Volar es hacerla...
                    <strong>ETERNA.</strong>
                </div>
            </section>
        </>
    );
}
