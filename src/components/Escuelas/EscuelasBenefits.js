"use client";
import React, { useRef, useEffect, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Telescope, HeartHandshake, Rocket, BookOpen, ArrowRight, X, Zap, Cpu, BarChart3 } from 'lucide-react';

const FallingLogos = () => {
    const logoSrcs = [
        "/img/logo ccfdsp.png", "/img/logo parque.png", "/img/logo secretaria cultura y turismo.png",
        "/img/museo del agua azul png.png", "/img/logo huatapera.png", "/img/bonanza.png",
        "/img/logo sp Negro.png", "/img/logo RV Fresh.png", "/img/Logo Madobox.png",
        "/img/Logo Global Frut png.png"
    ];

    const TETRIS_SHAPES = [
        { name: 'I', color: '#00f0f0', grid: [[1, 1, 1, 1]] },
        { name: 'O', color: '#f0f000', grid: [[1, 1], [1, 1]] },
        { name: 'T', color: '#a000f0', grid: [[0, 1, 0], [1, 1, 1]] },
        { name: 'S', color: '#00f000', grid: [[0, 1, 1], [1, 1, 0]] },
        { name: 'Z', color: '#f00000', grid: [[1, 1, 0], [0, 1, 1]] },
        { name: 'J', color: '#0000f0', grid: [[1, 0, 0], [1, 1, 1]] },
        { name: 'L', color: '#f0a000', grid: [[0, 0, 1], [1, 1, 1]] },
    ];

    const containerRef = useRef(null);
    const [gameState, setGameState] = useState({
        grid: Array(14).fill().map(() => Array(10).fill(null)),
        activePiece: null,
        nextPiece: null,
        isGameOver: false
    });

    const blockSize = 28;
    const columns = 10;
    const rows = 14;

    // AI Heuristics and Simulator
    const rotateGrid = (grid) => {
        const rows = grid.length;
        const cols = grid[0].length;
        const newGrid = Array(cols).fill().map(() => Array(rows).fill(0));
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                newGrid[x][rows - 1 - y] = grid[y][x];
            }
        }
        return newGrid;
    };

    const calculateBestMove = (piece, grid) => {
        let bestX = 0;
        let bestRotation = 0;
        let bestScore = -Infinity;

        // Try every possible rotation (0, 90, 180, 270)
        let currentShapeGrid = piece.shape.grid;
        for (let r = 0; r < 4; r++) {
            const maxCol = columns - currentShapeGrid[0].length;

            for (let x = 0; x <= maxCol; x++) {
                let tempY = 0;
                // Simulate falling
                while (true) {
                    let collision = false;
                    for (let ry = 0; ry < currentShapeGrid.length; ry++) {
                        for (let rx = 0; rx < currentShapeGrid[ry].length; rx++) {
                            if (currentShapeGrid[ry][rx]) {
                                const ny = tempY + ry + 1;
                                const nx = x + rx;
                                if (ny >= rows || (ny >= 0 && grid[ny][nx])) {
                                    collision = true;
                                    break;
                                }
                            }
                        }
                        if (collision) break;
                    }
                    if (collision) break;
                    tempY++;
                }

                // Evaluate position
                let score = 0;
                const simGrid = grid.map(row => [...row]);
                currentShapeGrid.forEach((row, ry) => {
                    row.forEach((cell, rx) => {
                        if (cell && tempY + ry >= 0 && tempY + ry < rows) {
                            simGrid[tempY + ry][x + rx] = { color: 'test' };
                        }
                    });
                });

                // Heuristics
                let lines = simGrid.filter(row => row.every(c => c !== null)).length;

                let aggregateHeight = 0;
                let heights = Array(columns).fill(0);
                for (let cx = 0; cx < columns; cx++) {
                    for (let cy = 0; cy < rows; cy++) {
                        if (simGrid[cy][cx]) {
                            heights[cx] = rows - cy;
                            aggregateHeight += heights[cx];
                            break;
                        }
                    }
                }

                let holes = 0;
                for (let cx = 0; cx < columns; cx++) {
                    let blockFound = false;
                    for (let cy = 0; cy < rows; cy++) {
                        if (simGrid[cy][cx]) blockFound = true;
                        else if (blockFound) holes++;
                    }
                }

                let bumpiness = 0;
                for (let cx = 0; cx < columns - 1; cx++) {
                    bumpiness += Math.abs(heights[cx] - heights[cx + 1]);
                }

                // Professional Weights
                score = (lines * 76) - (aggregateHeight * 51) - (holes * 35) - (bumpiness * 18);

                if (score > bestScore) {
                    bestScore = score;
                    bestX = x;
                    bestRotation = r;
                }
            }
            currentShapeGrid = rotateGrid(currentShapeGrid);
        }
        return { x: bestX, rotation: bestRotation };
    };

    const spawnPiece = (currentGrid) => {
        const shape = TETRIS_SHAPES[Math.floor(Math.random() * TETRIS_SHAPES.length)];
        const logo = logoSrcs[Math.floor(Math.random() * logoSrcs.length)];
        const initialX = Math.floor((columns - shape.grid[0].length) / 2);

        let piece = {
            shape: { ...shape },
            logo,
            x: initialX,
            y: 0,
            targetX: initialX,
            targetRotation: 0,
            id: Math.random().toString(36).substr(2, 9)
        };

        const decision = calculateBestMove(piece, currentGrid);
        piece.targetX = decision.x;
        piece.targetRotation = decision.rotation;
        return piece;
    };

    const checkCollision = (piece, grid, offsetX = 0, offsetY = 0) => {
        for (let y = 0; y < piece.shape.grid.length; y++) {
            for (let x = 0; x < piece.shape.grid[y].length; x++) {
                if (piece.shape.grid[y][x]) {
                    const newX = piece.x + x + offsetX;
                    const newY = piece.y + y + offsetY;
                    if (newX < 0 || newX >= columns || newY >= rows || (newY >= 0 && grid[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const gameLoop = useRef();

    useEffect(() => {
        const step = () => {
            setGameState(prev => {
                if (prev.isGameOver) return prev;

                let activePiece = prev.activePiece || spawnPiece(prev.grid);
                const newGrid = prev.grid.map(row => [...row]);

                // AI Execution: Rotate first, then move laterally
                if (activePiece.targetRotation > 0) {
                    activePiece.shape.grid = rotateGrid(activePiece.shape.grid);
                    activePiece.targetRotation--;
                } else if (activePiece.x < activePiece.targetX && !checkCollision(activePiece, prev.grid, 1, 0)) {
                    activePiece = { ...activePiece, x: activePiece.x + 1 };
                } else if (activePiece.x > activePiece.targetX && !checkCollision(activePiece, prev.grid, -1, 0)) {
                    activePiece = { ...activePiece, x: activePiece.x - 1 };
                }

                // Try to move down
                if (!checkCollision(activePiece, prev.grid, 0, 1)) {
                    return { ...prev, activePiece: { ...activePiece, y: activePiece.y + 1 } };
                } else {
                    // Lock piece
                    activePiece.shape.grid.forEach((row, ry) => {
                        row.forEach((cell, rx) => {
                            if (cell) {
                                const finalY = activePiece.y + ry;
                                const finalX = activePiece.x + rx;
                                if (finalY >= 0 && finalY < rows) {
                                    newGrid[finalY][finalX] = {
                                        color: activePiece.shape.color,
                                        logo: activePiece.logo,
                                        isCenter: ry === Math.floor(activePiece.shape.grid.length / 2) && rx === Math.floor(activePiece.shape.grid[0].length / 2)
                                    };
                                }
                            }
                        });
                    });

                    // Clear lines
                    const filteredGrid = newGrid.filter(row => !row.every(cell => cell !== null));
                    while (filteredGrid.length < rows) {
                        filteredGrid.unshift(Array(columns).fill(null));
                    }

                    // Check Game Over
                    if (activePiece.y <= 0) {
                        return {
                            grid: Array(rows).fill().map(() => Array(columns).fill(null)),
                            activePiece: null,
                            isGameOver: false
                        };
                    }

                    return { ...prev, grid: filteredGrid, activePiece: null };
                }
            });
        };

        gameLoop.current = setInterval(step, 250);
        return () => clearInterval(gameLoop.current);
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center pt-24 pb-8">
            <div
                className="relative bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                style={{ width: columns * blockSize, height: rows * blockSize }}
            >
                {/* Grid Lines for Desktop feel */}
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
                        backgroundSize: `${blockSize}px ${blockSize}px`
                    }}
                />

                {/* Render Grid Pieces */}
                {gameState.grid.map((row, y) => row.map((cell, x) => cell && (
                    <div
                        key={`cell-${x}-${y}`}
                        className="absolute rounded-sm border-[0.5px] border-black/40 shadow-[inset_0_4px_4px_rgba(255,255,255,0.2),inset_0_-4px_4px_rgba(0,0,0,0.3)]"
                        style={{
                            left: x * blockSize,
                            top: y * blockSize,
                            width: blockSize,
                            height: blockSize,
                            backgroundColor: cell.color
                        }}
                    >
                        {cell.isCenter && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 p-0.5">
                                <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/50 animate-pulse">
                                    <img src={cell.logo} alt="logo" className="w-4 h-4 object-contain" />
                                </div>
                            </div>
                        )}
                    </div>
                )))}

                {/* Render Active Piece */}
                {gameState.activePiece && gameState.activePiece.shape.grid.map((row, ry) =>
                    row.map((cell, rx) => cell && (
                        <div
                            key={`active-${rx}-${ry}`}
                            className="absolute rounded-sm border-[0.5px] border-black/40 shadow-[0_0_15px_rgba(255,255,255,0.4),inset_0_4px_4px_rgba(255,255,255,0.3)] transition-all duration-100"
                            style={{
                                left: (gameState.activePiece.x + rx) * blockSize,
                                top: (gameState.activePiece.y + ry) * blockSize,
                                width: blockSize,
                                height: blockSize,
                                backgroundColor: gameState.activePiece.shape.color,
                                zIndex: 20
                            }}
                        >
                            {ry === Math.floor(gameState.activePiece.shape.grid.length / 2) && rx === Math.floor(gameState.activePiece.shape.grid[0].length / 2) && (
                                <div className="absolute inset-0 flex items-center justify-center z-30 p-0.5">
                                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/30">
                                        <img src={gameState.activePiece.logo} alt="logo" className="w-4 h-4 object-contain" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const SpaceshipAscent = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Cinematic Star Particles */}
            {[...Array(30)].map((_, i) => {
                const size = Math.random() * 2 + 1;
                return (
                    <motion.div
                        key={`star-${i}`}
                        className="absolute bg-white rounded-full"
                        style={{
                            width: size,
                            height: size,
                            left: `${Math.random() * 100}%`,
                            top: -20,
                            boxShadow: size > 2 ? '0 0 10px rgba(255,255,255,0.8)' : 'none'
                        }}
                        animate={{
                            y: [0, 600],
                            opacity: [0, 0.8, 0],
                            scale: [0.5, 1, 0.5]
                        }}
                        transition={{
                            duration: Math.random() * 3 + 1, // Slower and varied for depth
                            repeat: Infinity,
                            ease: "linear",
                            delay: Math.random() * 5
                        }}
                    />
                );
            })}

            {/* Central Spaceship - VERTICAL */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center opacity-10"
                animate={{
                    x: [-0.5, 0.5, -1, 1, 0],
                    y: [-0.5, 1, -0.5, 0.5, 0],
                }}
                transition={{
                    duration: 0.2,
                    repeat: Infinity,
                    ease: "linear"
                }}
            >
                <Rocket className="w-64 h-64 text-white rotate-[-45deg]" />
            </motion.div>

            {/* Engine Glow Bloom */}
            <motion.div
                className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-400/10 rounded-full blur-[100px]"
                animate={{
                    scale: [1, 1.3, 0.8, 1.2, 1],
                    opacity: [0.1, 0.4, 0.2, 0.3, 0.1]
                }}
                transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
        </div>
    );
};

const SteamExpandedContent = ({ onClose }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: "backOut" } }
    };

    const steamPillars = [
        {
            letter: "S",
            full: "Science",
            title: "Ciencias del Vuelo",
            desc: "Aerodinámica y meteorología aplicada. Los alumnos comprenden la física de la sustentación mientras observan el ecosistema urbano desde una nueva perspectiva.",
            color: "text-cyan-400",
            border: "border-cyan-500/30",
            bg: "hover:bg-cyan-500/10",
            glow: "shadow-cyan-500/20"
        },
        {
            letter: "T",
            full: "Technology",
            title: "Morfología Digital",
            desc: "Sistemas FPV de baja latencia y transmisión en tiempo real. El aula se transforma en un centro de control tecnológico de vanguardia.",
            color: "text-emerald-400",
            border: "border-emerald-500/30",
            bg: "hover:bg-emerald-500/10",
            glow: "shadow-emerald-500/20"
        },
        {
            letter: "E",
            full: "Engineering",
            title: "Resolución Mecánica",
            desc: "Ingeniería de sistemas no tripulados. Pensamiento lógico y resolución de problemas bajo presión en el entorno más dinámico posible.",
            color: "text-orange-400",
            border: "border-orange-500/30",
            bg: "hover:bg-orange-500/10",
            glow: "shadow-orange-500/20"
        },
        {
            letter: "A",
            full: "Arts",
            title: "Perspectiva Estética",
            desc: "Narrativa visual y composición aérea. El vuelo se convierte en una herramienta de expresión artística y cinematográfica única.",
            color: "text-purple-400",
            border: "border-purple-500/30",
            bg: "hover:bg-purple-500/10",
            glow: "shadow-purple-500/20"
        },
        {
            letter: "M",
            full: "Math",
            title: "Geometría del Aire",
            desc: "Cálculo de ángulos, trayectorias y velocidad angular. Las matemáticas dejan de ser abstractas para convertirse en la brújula del piloto.",
            color: "text-amber-400",
            border: "border-amber-500/30",
            bg: "hover:bg-amber-500/10",
            glow: "shadow-amber-500/20"
        }
    ];

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col h-full bg-slate-950/98 p-6 md:p-12 overflow-y-auto scrollbar-hide"
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="fixed top-8 right-8 z-[120] p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10 backdrop-blur-md active:scale-95 group"
            >
                <X size={28} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

            <div className="max-w-7xl mx-auto w-full py-12">
                {/* Header Section */}
                <motion.div variants={itemVariants} className="text-center mb-16 px-4">
                    <span className="text-blue-500 font-bold tracking-[0.5em] uppercase text-[10px] mb-6 block">Ecosistema Educativo</span>
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-8 leading-none">
                        El Marco <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-fuchsia-400 to-amber-400">S.T.E.A.M.</span> en Fly High
                    </h2>
                    <p className="text-lg md:text-2xl text-white/80 font-medium italic max-w-4xl mx-auto leading-relaxed text-balance">
                        "Convertimos el cielo en el laboratorio más grande del mundo, donde cada sigla cobra vida a través de la emoción del primer vuelo."
                    </p>
                </motion.div>

                {/* S.T.E.A.M Grid - Custom 5 Column Grid on Desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {steamPillars.map((pillar, idx) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className={`
                                relative p-8 rounded-[2.5rem] border ${pillar.border}
                                bg-white/5 ${pillar.bg} transition-all duration-500
                                flex flex-col items-center text-center group
                                shadow-lg ${pillar.glow}
                            `}
                        >
                            {/* Letter Circle */}
                            <div className="w-20 h-20 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-8 relative group-hover:scale-110 transition-transform duration-500">
                                <span className={`text-4xl font-black ${pillar.color}`}>{pillar.letter}</span>
                                {/* Background glow effect */}
                                <div className={`absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-20 transition-opacity bg-current ${pillar.color}`} />
                            </div>

                            <div className="mb-4">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] block mb-1">
                                    {pillar.full}
                                </span>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                                    {pillar.title}
                                </h3>
                            </div>

                            <p className="text-white/60 text-sm leading-relaxed font-medium">
                                {pillar.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

export default function EscuelasBenefits() {
    const scrollContainerRef = useRef(null);
    const [expandedCardId, setExpandedCardId] = useState(null);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setTimeout(() => {
                        container.scrollBy({ left: 100, behavior: 'smooth' });
                        setTimeout(() => {
                            container.scrollBy({ left: -100, behavior: 'smooth' });
                        }, 800);
                    }, 500);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const pillars = [
        {
            icon: <Telescope className="w-10 h-10 text-white" />,
            title: "El Primer Vuelo",
            subtitle: "Rompiendo Paradigmas",
            desc: "Para muchos, será su primera experiencia de vuelo. Al ver su mundo sin fronteras desde arriba, descubren que no hay límites para sus sueños.",
            bg: "bg-blue-600",
            gradient: "from-blue-600 to-blue-800"
        },
        {
            icon: <HeartHandshake className="w-10 h-10 text-white" />,
            title: "Movimiento Social",
            subtitle: "Sinergia Histórica",
            desc: "Gobierno, empresas y sociedad unidos por la niñez. No es solo un evento; es la ciudad entera apostando por sus niños para decirles: 'Creemos en ustedes'.",
            bg: "bg-emerald-600",
            gradient: "from-emerald-600 to-emerald-800"
        },
        {
            icon: <Rocket className="w-10 h-10 text-white" />,
            title: "Vocaciones STEAM",
            subtitle: "Futuro Sin Límites",
            desc: "Inspiramos a la próxima generación de ingenieros, pilotos y científicas. La tecnología es el lienzo; su futuro es la obra maestra.",
            bg: "bg-fuchsia-600",
            gradient: "from-fuchsia-600 to-fuchsia-800"
        }
    ];

    return (
        <section id="benefits" className="pt-[140px] pb-20 bg-white relative overflow-hidden z-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="px-6 mb-12">
                    <span className="text-blue-600 font-bold tracking-widest uppercase text-[10px] mb-2 block">
                        NUEVAS PERSPECTIVAS
                    </span>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-[0.9]">
                        EL EFECTO <br />
                        <motion.span
                            animate={{
                                filter: [
                                    'drop-shadow(0 0 0px rgba(124, 58, 237, 0))',
                                    'drop-shadow(0 0 15px rgba(124, 58, 237, 0.5))',
                                    'drop-shadow(0 0 0px rgba(124, 58, 237, 0))'
                                ],
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-fuchsia-500 to-indigo-600 text-balance bg-[length:200%_auto] inline-block pb-1"
                        >
                            FLYHIGH EDU.
                        </motion.span>
                    </h2>
                </div>

                {/* Mobile Snap Carousel / Desktop Grid */}
                <div
                    ref={scrollContainerRef}
                    className="flex xl:grid xl:grid-cols-3 gap-4 overflow-x-auto xl:overflow-visible snap-x snap-mandatory px-6 pb-12 xl:pb-0 scrollbar-hide"
                >
                    {pillars.map((item, idx) => (
                        <motion.div
                            key={idx}
                            layoutId={`card-${idx}`}
                            onClick={() => item.title === "Vocaciones STEAM" && setExpandedCardId(`card-${idx}`)}
                            className={`
                                relative shrink-0 w-[85vw] sm:w-[350px] xl:w-auto h-[420px] 
                                rounded-[2rem] snap-center 
                                flex flex-col justify-between p-8
                                bg-gradient-to-br ${item.gradient}
                                shadow-xl shadow-slate-200
                                group overflow-hidden cursor-pointer
                            `}
                        >
                            {item.title === "Movimiento Social" && <FallingLogos />}
                            {item.title === "El Primer Vuelo" && <SpaceshipAscent />}

                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-500 pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-black/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative z-10">
                                <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-widest text-white/80 backdrop-blur-sm mb-6">
                                    {item.subtitle}
                                </span>
                                <motion.h3 layoutId={`title-${idx}`} className="text-3xl font-black text-white uppercase tracking-tight leading-none mb-4">
                                    {item.title}
                                </motion.h3>
                                <p className="text-white/80 font-medium leading-relaxed text-sm">
                                    {item.desc}
                                </p>
                            </div>

                            <div className="relative z-10 flex justify-between items-end">
                                <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                                    {item.icon}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {item.title === "Vocaciones STEAM" ? (
                                        <motion.div
                                            animate={{ scale: [1, 1.05, 1] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            className="px-4 py-2 bg-white rounded-full shadow-lg shadow-fuchsia-900/20"
                                        >
                                            <span className="text-[9px] font-black text-fuchsia-600 tracking-wider uppercase whitespace-nowrap">
                                                Ver Respaldo Pedagógico
                                            </span>
                                        </motion.div>
                                    ) : (
                                        <ArrowRight className="text-white/50 w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                    <div className="shrink-0 w-2 xl:hidden" />
                </div>

                <div className="flex justify-center gap-2 mt-4 xl:hidden opacity-40">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
            </div>

            <AnimatePresence>
                {expandedCardId && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setExpandedCardId(null)}
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            layoutId={expandedCardId}
                            className="fixed inset-[5%] md:inset-[7.5%] z-[110] bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col"
                        >
                            <SteamExpandedContent onClose={() => setExpandedCardId(null)} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </section>
    );
}
