'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomSplashScreen({ children }) {
    const pathname = usePathname();
    const isStaffRoute = pathname.startsWith('/staff');
    const [showSplash, setShowSplash] = useState(isStaffRoute);

    useEffect(() => {
        // Solo activar el Splash en rutas /staff/*
        if (!isStaffRoute) {
            setShowSplash(false);
            return;
        }

        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2500);

        return () => clearTimeout(timer);
    }, [isStaffRoute]);

    return (
        <>
            <AnimatePresence>
                {showSplash && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: 'easeInOut' }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0185e4] overflow-hidden"
                    >
                        {/* Pulse glow ring behind the logo */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.6, 0.8] }}
                            transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: 0.8
                            }}
                            className="absolute w-[65%] aspect-square rounded-full"
                            style={{
                                background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)'
                            }}
                        />

                        {/* Logo with blur reveal + scale entrance */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.6, filter: 'blur(20px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            transition={{
                                duration: 1.0,
                                ease: [0.22, 1, 0.36, 1] // custom cubic-bezier for premium deceleration
                            }}
                            className="w-[55%] max-w-md min-w-[260px] relative flex justify-center items-center"
                        >
                            <img
                                src="/img/LOGO OPS.png"
                                alt="FlyHigh Logo"
                                className="w-full h-auto object-contain drop-shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Contenido de la app que quedará al fondo o se mostrará después */}
            {children}
        </>
    );
}
