import React from 'react';
import { Instagram, Facebook, Globe, ShieldCheck } from 'lucide-react';

const MinimalFooter = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-white border-t border-slate-100 font-sans text-sm relative z-50">
            <div className="max-w-7xl mx-auto px-6 py-8">

                {/* CONTENEDOR FLEXIBLE (Mobile: Columna / Desktop: Fila) */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                    {/* 1. IDENTIDAD (Izquierda) */}
                    <div className="flex items-center gap-3 order-2 md:order-1">
                        {/* Logo Símbolo (Monocromático para sobriedad) */}
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            {/* Simulación de Isotipo FlyHigh Minimal */}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <path d="M22 4L12 14.01l-3-3" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800 tracking-tight leading-none">
                                Fly High Edu
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                                © {currentYear} Uruapan, Mich.
                            </span>
                        </div>
                    </div>

                    {/* 2. ENLACES LEGALES & NAV (Centro - Oculto en móbiles muy pequeños o adaptado) */}
                    <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 order-1 md:order-2">
                        <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 font-medium text-xs">
                            Misión
                        </a>
                        <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 font-medium text-xs">
                            Transparencia
                        </a>
                        <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 font-medium text-xs flex items-center gap-1">
                            <ShieldCheck size={12} /> Privacidad
                        </a>
                    </nav>

                    {/* 3. REDES SOCIALES (Derecha) */}
                    <div className="flex items-center gap-4 order-3">
                        <SocialLink href="#" icon={<Instagram size={16} />} label="Instagram" />
                        <SocialLink href="#" icon={<Facebook size={16} />} label="Facebook" />
                        <SocialLink href="#" icon={<Globe size={16} />} label="Website" />
                    </div>

                </div>

                {/* LÍNEA DE CRÉDITO SUTIL (Firma de Autor) */}
                {/* Opcional: Si quieres dar crédito al desarrollador o mantenerlo limpio, puedes quitar esto */}
                <div className="mt-8 pt-4 border-t border-slate-50 text-center md:text-right">
                    <p className="text-[10px] text-slate-300">
                        Diseñado con ❤ para el futuro de México. <span className="mx-1">•</span> Hecho con orgullo en Uruapan.
                    </p>
                </div>

            </div>
        </footer>
    );
};

// Componente auxiliar para iconos sociales con Hover suave
const SocialLink = ({ href, icon, label }) => (
    <a
        href={href}
        aria-label={label}
        className="text-slate-400 hover:text-pink-500 hover:bg-pink-50 p-2 rounded-full transition-all duration-300 transform hover:scale-110"
    >
        {icon}
    </a>
);

export default MinimalFooter;
