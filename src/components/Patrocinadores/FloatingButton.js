import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function FloatingButton({ onClick, className = "fixed bottom-0 right-0" }) {
    const [isHovered, setIsHovered] = useState(false);
    const [gifKey, setGifKey] = useState(0);
    const [isHeartbeating, setIsHeartbeating] = useState(false);

    // Orchestrated Animation Cycle: 10s Total (Strict No-Overlap)
    // 0s - 5s: GIF Plays (Heartbeat OFF). Ample time for GIF to finish.
    // 5s - 10s: Heartbeat Plays (GIF Static).
    useEffect(() => {
        const runCycle = () => {
            // Phase 1: Play GIF, Stop Heartbeat
            setGifKey(prev => prev + 1);
            setIsHeartbeating(false);

            // Phase 2: Play Heartbeat (after 5s)
            setTimeout(() => {
                setIsHeartbeating(true);
            }, 5000);
        };

        runCycle(); // Initial run
        const interval = setInterval(runCycle, 10000); // Loop every 10s

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`${className} z-[150]`}>
            {/* 1. Sombra "Cutout" (Quarter Circle Shadow) */}
            <motion.div
                animate={{
                    scale: isHovered ? 0.95 : 1,
                    opacity: isHovered ? 0.4 : 0.3
                }}
                className="absolute inset-0 bg-black rounded-tl-[100%] blur-xl translate-x-2 translate-y-2 pointer-events-none"
            />

            {/* 2. Botón Físico "True Quarter" - THE LIVING BUTTON */}
            <motion.button
                onClick={onClick}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                whileTap={{ scale: 0.95 }}
                initial={{ x: 100, y: 100 }}
                animate={{
                    x: 0,
                    y: 0,
                    scale: isHovered ? 1.05 : (isHeartbeating ? [1, 1.08, 1] : 1)
                }}
                transition={{
                    x: { type: "spring", stiffness: 300, damping: 20 },
                    y: { type: "spring", stiffness: 300, damping: 20 },
                    scale: {
                        duration: 2.5,
                        ease: "easeInOut",
                        times: [0, 0.5, 1]
                    }
                }}
                style={{
                    boxShadow: "inset 2px 2px 4px rgba(255, 255, 255, 0.4), inset 4px 4px 15px rgba(255, 255, 255, 0.2), inset -4px -4px 10px rgba(0, 0, 0, 0.1), 0px 10px 20px rgba(0, 0, 0, 0.3)"
                }}
                className="relative w-full h-full bg-[#0066FF] rounded-tl-[100%] overflow-hidden"
            >
                {/* Icono Animado Centrado Geométricamente - THE WINK */}
                <motion.div
                    animate={{
                        scale: isHovered ? 1.15 : 1,
                        rotate: isHovered ? -5 : (isHeartbeating ? [0, -10, 0] : 0)
                    }}
                    transition={{
                        rotate: {
                            duration: 2.5,
                            ease: "easeInOut",
                            times: [0, 0.5, 1]
                        }
                    }}
                    className="absolute bottom-[42%] right-[42%] translate-x-1/2 translate-y-1/2 drop-shadow-md"
                >
                    <img
                        key={gifKey}
                        src="/img/login icono saludando.gif"
                        alt="Waving Login Icon"
                        className="w-12 h-12 md:w-16 md:h-16 object-contain"
                    />
                </motion.div>
            </motion.button>
        </div>
    );
}
