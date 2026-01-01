'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

export default function PortalOverlay({ isOpen, onClose }) {
    return (
        <motion.div
            initial={{ clipPath: "circle(0% at calc(100% - 40px) calc(100% - 40px))" }} // Start exactly from button centroid (approx)
            animate={{ clipPath: "circle(150% at 100% 100%)" }}
            exit={{
                clipPath: "circle(0% at 100% 100%)",
                transition: { duration: 0.5, ease: "anticipate" } // "Suck" back effect
            }}
            transition={{
                type: "spring",
                stiffness: 40,
                damping: 10,
                mass: 1
            }}
            className="fixed inset-0 z-[200] bg-[#0066FF] flex flex-col overflow-hidden"
        >
            {/* Header Flotante */}
            <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-20 pointer-events-none">
                <motion.span
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="font-black text-[10px] uppercase tracking-widest text-white/50"
                >
                    Seleccionar Portal
                </motion.span>

                <motion.button
                    onClick={onClose}
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="w-12 h-12 flex items-center justify-center bg-white rounded-full shadow-lg pointer-events-auto hover:bg-gray-100 transition-colors cursor-pointer group"
                >
                    <X className="w-6 h-6 text-black group-hover:rotate-90 transition-transform duration-300" />
                </motion.button>
            </div>

            {/* Contenido (Cards) */}
            <div className="flex-1 flex flex-col p-6 md:p-12 space-y-6 justify-center overflow-y-auto">

                {/* 1. Patrocinadores Card */}
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 50 }}
                    className="p-8 md:p-12 rounded-[40px] bg-black text-white flex flex-col justify-end min-h-[35vh] relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-2xl"
                >
                    <div className="relative z-10">
                        <h3 className="text-3xl md:text-5xl font-black leading-none mb-4 uppercase tracking-tighter">
                            Centro de<br />Control
                        </h3>
                        <p className="text-white/60 text-sm md:text-base font-medium max-w-sm mb-8">
                            Audita el impacto de tu inversión en tiempo real. Transparencia total.
                        </p>
                        <button className="bg-[#0066FF] text-white px-8 py-4 rounded-full font-bold tracking-wider uppercase text-xs flex items-center gap-2 group-hover:gap-4 transition-all">
                            Entrar <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Gradient Blob */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2 group-hover:translate-x-[40%] transition-transform duration-700"></div>
                </motion.div>

                {/* 2. Aliados Card */}
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 50 }}
                    className="p-8 md:p-12 rounded-[40px] bg-white text-black flex flex-col justify-end min-h-[35vh] relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-2xl border-2 border-black/5"
                >
                    <div className="relative z-10">
                        <h3 className="text-3xl md:text-5xl font-black leading-none mb-4 uppercase tracking-tighter text-black">
                            Zona de<br />Custodios
                        </h3>
                        <p className="text-black/60 text-sm md:text-base font-medium max-w-sm mb-8">
                            Coordina contenido pedagógico y gestiona recursos educativos.
                        </p>
                        <button className="bg-black text-white px-8 py-4 rounded-full font-bold tracking-wider uppercase text-xs flex items-center gap-2 group-hover:gap-4 transition-all">
                            Acceder <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>

            </div>
        </motion.div>
    );
}
