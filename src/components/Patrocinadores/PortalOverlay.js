'use client';

import React from 'react';
import { X } from 'lucide-react';

export default function PortalOverlay({ isOpen, onClose }) {
    return (
        <div
            id="portalOverlay"
            className={`fixed inset-0 z-[200] transition-transform duration-700 ease-[cubic-bezier(0.85,0,0.15,1)] bg-white flex flex-col ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        >
            <div className="p-8 flex justify-between items-center border-b border-gray-100 shrink-0">
                <span className="font-black text-[10px] uppercase tracking-widest text-slate-900">Seleccionar Portal</span>
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X className="w-6 h-6 text-slate-900" />
                </button>
            </div>

            <div className="flex-1 flex flex-col p-8 space-y-6 justify-center overflow-y-auto">
                {/* Patrocinadores Card */}
                <div className="p-8 rounded-[40px] bg-black text-white flex flex-col justify-end min-h-[33vh] relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 ease-out">
                    <h3 className="text-3xl font-black leading-none mb-3 relative z-10">BIENVENIDO AL CENTRO DE CONTROL.</h3>
                    <p className="text-white/40 text-[10px] mb-6 relative z-10">Ingresa para auditar el impacto en vivo de tu inversión.</p>
                    <button className="bg-blue-600 py-4 rounded-xl font-black text-[10px] tracking-widest uppercase relative z-10 hover:bg-blue-500 transition-colors">
                        Entrar como Patrocinador
                    </button>

                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/30 transition-colors"></div>
                </div>

                {/* Aliados Card */}
                <div className="p-8 rounded-[40px] border-2 border-black flex flex-col justify-end min-h-[33vh] relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 ease-out bg-white">
                    <h3 className="text-3xl font-black leading-none mb-3 text-black">BIENVENIDO, CUSTODIO.</h3>
                    <p className="text-black/40 text-[10px] mb-6">Ingresa para coordinar el contenido pedagógico.</p>
                    <button className="bg-black text-white py-4 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-slate-800 transition-colors">
                        Entrar como Aliado
                    </button>
                </div>
            </div>
        </div>
    );
}
