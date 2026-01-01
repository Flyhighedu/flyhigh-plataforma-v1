import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';

export default function FloatingButton({ onClick, className = "fixed bottom-0 right-0" }) {
    const [isHovered, setIsHovered] = useState(false);

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

            {/* 2. Botón Físico "True Quarter" */}
            <motion.button
                onClick={onClick}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ x: 100, y: 100 }} // Enter from corner
                animate={{ x: 0, y: 0 }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20
                }}
                className="relative w-full h-full bg-[#0066FF] rounded-tl-[100%] overflow-hidden shadow-[inset_10px_10px_20px_rgba(255,255,255,0.3),inset_-10px_-10px_20px_rgba(0,0,0,0.2)]"
            >
                {/* Icono Centrado Geométricamente (Centroide Exacto: 42.4%) */}
                <motion.div
                    animate={{
                        scale: isHovered ? 1.1 : 1,
                        rotate: isHovered ? -5 : 0
                    }}
                    className="absolute bottom-[42%] right-[42%] translate-x-1/2 translate-y-1/2 text-white drop-shadow-md"
                >
                    <User className="w-10 h-10 md:w-12 md:h-12" strokeWidth={3} />
                </motion.div>
            </motion.button>
        </div>
    );
}
