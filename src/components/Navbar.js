'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Rocket, Heart, Menu, X, School, GraduationCap, HeartHandshake, Building2 } from 'lucide-react';

import { useImpact } from '../context/ImpactContext';

export default function Navbar({ onOpenDonation }) {
  const { totalImpact } = useImpact();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [mobileShowCTA, setMobileShowCTA] = useState(false);
  // const [isImpactVisible, setIsImpactVisible] = useState(false); // Removed since section is gone

  useEffect(() => {
    setIsPulsing(true);
    const timer = setTimeout(() => setIsPulsing(false), 200);
    return () => clearTimeout(timer);
  }, [totalImpact]);

  // Mobile Auto-Switch Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setMobileShowCTA(prev => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Removed Impact Observer since section is gone

  const menuItems = [
    { name: "Escuelas", href: "/escuelas", icon: School },
    { name: "Maestros", href: "/#maestros", icon: GraduationCap },
    { name: "Padrinos", href: "/#padrinos", icon: HeartHandshake },
    { name: "Patrocinadores", href: "/patrocinadores", icon: Building2 },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 px-3 sm:px-5 pt-2 sm:pt-4 pb-2 flex justify-between items-center z-[100] pointer-events-none">

      {/* Píldora Izquierda: Menú + Logo */}
      <div className="relative pointer-events-auto">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            x: 0,
            pointerEvents: 'auto'
          }}
          className="bg-white px-2 sm:px-3 h-10 sm:h-12 rounded-full shadow-sm border border-gray-100 flex items-center gap-2 sm:gap-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {/* Hamburger Icon */}
          <div className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            {isMenuOpen ? <X size={16} className="text-gray-600" /> : <Menu size={16} className="text-gray-600" />}
          </div>

          {/* Divider */}
          <div className="w-[1px] h-4 bg-gray-200"></div>

          {/* Logo */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Link href="/">
              <img
                src="/img/logoFH.png"
                alt="Fly High Logo"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </Link>
          </div>
        </motion.div>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col py-2"
            >
              {menuItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="px-4 py-2.5 text-sm font-['Inter',sans-serif] font-medium text-slate-600 hover:bg-gray-50 hover:text-black transition-all flex items-center gap-3 group"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon size={16} className="text-slate-400 group-hover:text-black transition-colors" />
                  {item.name}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Píldora Derecha: Contador / CTA (Soft Clay Progress) */}
      <motion.div
        layout
        onClick={onOpenDonation}
        className="group pointer-events-auto cursor-pointer relative"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <motion.div
          animate={
            isPulsing
              ? { scale: 1.05, x: [0, -3, 3, -3, 3, 0] } // Vibration
              : { scale: 1, x: 0 }
          }
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-full h-10 sm:h-12 min-w-[110px] sm:min-w-[130px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_16px_rgba(236,72,153,0.3)] transition-shadow duration-300 bg-[#f0f0f0]"
        >
          {/* 1. FONDO BASE (Soft Clay) */}
          <div className="absolute inset-0 bg-slate-100 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.06),inset_-2px_-2px_6px_rgba(255,255,255,0.8)] rounded-full"></div>

          {/* 2. BARRA DE PROGRESO (Gradiente Azul) */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-1000 ease-out opacity-100 group-hover:opacity-0 transition-opacity duration-300"
            style={{ width: `${totalImpact === null ? 0 : Math.min((totalImpact / 30000) * 100, 100)}%` }}
          ></div>

          {/* 3. FONDO HOVER (Gradiente Rosa) */}
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          {/* 4. CONTENIDO (Texto e Iconos) */}
          <div className="relative z-10 flex items-center gap-2 px-4">

            {/* ESTADO NORMAL (Contador) */}
            <div className="flex items-center gap-2 group-hover:hidden group-hover:opacity-0 transition-all duration-300">

              {/* Mobile Switch with Fade */}
              <div className="md:hidden relative h-10 sm:h-12 w-[100px] sm:w-[120px] flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={mobileShowCTA ? "cta" : "counter"}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 flex items-center justify-center font-['Inter',sans-serif] font-bold text-[10px] sm:text-xs text-slate-700 tabular-nums"
                  >
                    {mobileShowCTA ? "APADRINAR" : (totalImpact === null ? "..." : `${totalImpact.toLocaleString()} / 30k Niños`)}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* Desktop Text (Static) */}
              <span className="hidden md:inline font-['Inter',sans-serif] font-bold text-xs text-slate-700 group-hover:text-white tabular-nums mix-blend-multiply">
                {totalImpact === null ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  `${totalImpact.toLocaleString()} / 30k Niños`
                )}
              </span>

              <Rocket size={14} className="text-slate-600 md:text-white/80 mix-blend-multiply" />
            </div>

            {/* ESTADO HOVER (CTA) */}
            <div className="hidden group-hover:flex items-center gap-2 text-white animate-in fade-in slide-in-from-bottom-1 duration-200">
              <Heart size={14} className="fill-white animate-pulse" />
              <span className="font-['Inter',sans-serif] font-bold text-xs tracking-wide">APADRINAR AHORA</span>
            </div>

          </div>
        </motion.div>
      </motion.div>

    </div>
  );
}
