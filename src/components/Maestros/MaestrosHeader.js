import React from 'react';

export default function MaestrosHeader() {
    return (
        <>
            <style jsx>{`
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 20px 4vw;
            width: 100%;
            position: relative;
            z-index: 10;
        }

        .header-meta-block {
            display: flex;
            gap: 20px;
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            line-height: 1.4;
            max-width: 400px;
        }
        
        .meta-col {
            display: flex;
            flex-direction: column;
        }

        .menu-btn {
            background-color: #000;
            color: #fff;
            padding: 12px 30px;
            border-radius: 50px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.3s ease;
        }

        .menu-btn:hover {
            transform: scale(1.05);
            background-color: var(--accent-pink);
        }

        .reveal-up {
            opacity: 0;
            transform: translateY(30px);
            animation: fadeInUp 1s forwards ease-out;
        }

        @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .d-1 { animation-delay: 0.1s; }
      `}</style>
            <header className="header-top">
                <div className="header-meta-block reveal-up d-1">
                    <div className="meta-col">
                        <span>TU NORTE</span>
                        <span>MI NORTE</span>
                        <span>EL NORTE</span>
                    </div>
                    <div className="meta-col">
                        <span>IMPACTO</span>
                        <span>SOCIAL</span>
                        <span>URUAPAN</span>
                    </div>
                    <div className="meta-col">
                        <span>// EDUCACIÓN</span>
                        <span>// FUTURO</span>
                        <span>// VUELO</span>
                    </div>
                </div>

                <a href="#" className="menu-btn reveal-up d-1">Menú</a>
            </header>
        </>
    );
}
