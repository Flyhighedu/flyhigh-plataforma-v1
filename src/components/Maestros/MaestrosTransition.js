import React from 'react';

export default function MaestrosTransition() {
    return (
        <>
            <style jsx>{`
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 2rem;
        }

        .transition-section {
            padding: 10rem 0;
            position: relative;
            background: #fff;
            overflow: hidden;
            width: 100%;
        }

        .big-statement {
            font-size: clamp(2.5rem, 5vw, 4rem);
            font-weight: 700;
            line-height: 1.1;
            margin-bottom: 2rem;
            color: #111;
        }

        .big-statement span {
            color: #666; /* var(--text-muted) */
            transition: color 0.5s ease;
        }

        .big-statement span.highlight {
            color: #000;
            background: linear-gradient(120deg, rgba(0,242,234,0.2) 0%, rgba(0,242,234,0) 100%);
        }

        /* Re-using reveal text class from global if possible, or defining here */
        .reveal-text {
            /* Handled by global useEffect in parent usually, but we can style here */
            /* Opacity handled by parent class addition 'visible' */
        }
      `}</style>
            <section className="transition-section">
                <div className="container">
                    <div className="big-statement reveal-text">
                        Tu aula ya no tiene cuatro paredes.<br />
                        <span className="highlight">Tiene alas.</span>
                    </div>
                    <p style={{ fontSize: '1.2rem', lineHeight: '1.8', color: '#555', maxWidth: '700px' }} className="reveal-text">
                        La educación moderna no se trata de retener a los alumnos en un salón, sino de impulsarlos a explorar el mundo.
                        Convertimos tu patio escolar en una plataforma de despegue y a ti, en el <strong>Capitán de la Misión</strong>.
                    </p>
                </div>
            </section>
        </>
    );
}
