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
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0185e4]"
                    >
                        {/* Contenedor del logo con animación de levitación simulando un dron */}
                        <motion.div
                            animate={{
                                y: [-15, 15, -15],
                            }}
                            transition={{
                                duration: 3, // ajusta la velocidad según sientas más natural el vuelo
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="w-[30%] max-w-sm min-w-[200px] relative flex justify-center items-center"
                        >
                            {/* Reemplaza la ruta por el logo proporcionado (ej: /logo.png o logo de Vercel/FlyHigh) */}
                            <img
                                src="/logo.png"
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
