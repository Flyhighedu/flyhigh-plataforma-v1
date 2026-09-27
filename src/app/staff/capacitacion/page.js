'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
const PoiCoverImage = ({ imageUrl, name }) => <Image src={imageUrl} alt={name} width={400} height={250} unoptimized/>;
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ArrowRight, ArrowLeft, BookOpen, X, PartyPopper, HelpCircle, Pointer, Hand, Play, Pause, Volume2, Check, X as XIcon, RotateCcw } from 'lucide-react';
import { motion, useAnimation, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import styles from '@/components/shared/NarrationLibrary.module.css';
const autoCategory = () => ({ color: '#2563eb' });
export default function TrainingPage() {
    const router = useRouter();
    const [trainingModules, setTrainingModules] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [studyMode, setStudyMode] = useState(false);
    const [studyDeck, setStudyDeck] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [studyComplete, setStudyComplete] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [playingPoiId, setPlayingPoiId] = useState(null);
    const audioRef = useRef(null);
    const skipTutorial = () => setShowTutorial(false);
    const replayTutorial = () => setShowTutorial(true);
    useEffect(() => {
        let active = true;
        const player = audioRef;
        (async () => {
            try {
                const db = createClient();
                const { data: { user } } = await db.auth.getUser();
                if (!user) { router.replace('/staff/login'); return; }
                const { data, error } = await db.from('training_modules').select('*, training_cards(*)').eq('status', 'published').order('created_at', { ascending: false });
                if (error) throw error;
                if (active) setTrainingModules(data || []);
            } catch { if (active) setError('No se pudo cargar la capacitación. Recarga para intentar de nuevo.'); }
            finally { if (active) setLoading(false); }
        })();
        return () => { active = false; player.current?.pause(); };
    }, [router]);
    const startModuleStudy = useCallback((mod) => {
        let granularDeck = [];
        const approvedCards = (mod.training_cards || []).filter(c => c.status === 'approved');
        
        // Sort by order
        approvedCards.sort((a, b) => a.sort_order - b.sort_order);

        approvedCards.forEach((card, idx) => {
            granularDeck.push({
                id: `card-${card.id}`,
                poiId: mod.id,
                name: mod.title,
                description: mod.description,
                image_url: null,
                icon: mod.icon,
                color: mod.color,
                question: card.question,
                answer: card.answer,
                type: card.card_type || 'knowledge',
                indexLabel: `FICHA ${idx + 1} • ${card.difficulty === 1 ? 'BÁSICO' : card.difficulty === 2 ? 'INTERMEDIO' : 'AVANZADO'}`
            });
        });

        if (granularDeck.length === 0) return;

        setStudyDeck(granularDeck);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setStudyComplete(false);
        setStudyMode(true);
    }, []);

    const flipCard = () => setIsFlipped(prev => !prev);

    const x = useMotionValue(0);
    const controls = useAnimation();
    const rotate = useTransform(x, [-200, 200], [-8, 8]);
    const opacityLeft = useTransform(x, [-100, -20], [1, 0]);
    const opacityRight = useTransform(x, [20, 100], [0, 1]);

    const handleDragEnd = async (event, info) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (showTutorial) skipTutorial();

        if (offset > 100 || velocity > 500) {
            // Swipe Right (Correct)
            await controls.start({ x: window.innerWidth, opacity: 0, transition: { duration: 0.3 } });
            handleNextCard();
        } else if (offset < -100 || velocity < -500) {
            // Swipe Left (Incorrect/Review)
            await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.3 } });
            handleNextCard();
        } else {
            // Return to center
            controls.start({ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } });
        }
    };

    const handleNextCard = () => {
        if (currentCardIndex < studyDeck.length - 1) {
            setCurrentCardIndex(prev => prev + 1);
            setIsFlipped(false);
            x.set(0);
            controls.set({ x: 0, opacity: 1 });
        } else {
            setStudyComplete(true);
        }
    };

    const exitStudy = () => {
        setStudyMode(false);
        setStudyComplete(false);
        setIsFlipped(false);
        x.set(0);
        controls.set({ x: 0, opacity: 1 });
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER: STUDY MODE (Flashcards Tinder)
    // ═══════════════════════════════════════════════════════════
    if (studyMode) {
        if (studyComplete) {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans px-6 text-center">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner animate-bounce">
                        <PartyPopper size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 mb-2">¡Mazo completado!</h1>
                    <p className="text-slate-500 text-[15px] mb-1">
                        Has revisado las <span className="font-bold text-indigo-600">{studyDeck.length}</span> fichas.
                    </p>
                    <p className="text-slate-400 text-sm mb-10">
                        Excelente trabajo ejercitando tu memoria.
                    </p>
                    <button
                        onClick={exitStudy}
                        className="bg-slate-800 text-white rounded-2xl px-8 py-4 font-bold text-[15px] shadow-lg active:scale-95 transition-all flex items-center gap-3"
                    >
                        <ArrowRight size={18} className="rotate-180" />
                        Volver a capacitación
                    </button>
                </div>
            );
        }

        const card = studyDeck[currentCardIndex];
        const cat = autoCategory(card.description);

        return (
            <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col font-sans overflow-hidden">
                {/* Progress Header */}
                <div className="pt-12 pb-4 px-6 flex items-center justify-between z-10 bg-gradient-to-b from-slate-100 to-transparent">
                    <button
                        onClick={exitStudy}
                        className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                    
                    {/* Progress Bar (Duolingo style) */}
                    <div className="flex-1 mx-6 h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-500 transition-all duration-300 ease-out"
                            style={{ width: `${((currentCardIndex) / studyDeck.length) * 100}%` }}
                        />
                    </div>
                    
                    <div className="w-10 h-10 flex items-center justify-center font-black text-slate-400 text-sm">
                        {currentCardIndex + 1}/{studyDeck.length}
                    </div>
                    
                    {/* Replay Tutorial Button */}
                    <button 
                        onClick={replayTutorial}
                        className="w-10 h-10 ml-2 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 active:scale-95 transition-all"
                    >
                        <HelpCircle size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Tinder Cards Container */}
                <div className="flex-1 relative flex items-center justify-center px-4 pb-12 w-full max-w-md mx-auto">
                    <AnimatePresence>
                        {showTutorial && !isFlipped && currentCardIndex === 0 && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 z-40 flex flex-col items-center justify-between pointer-events-none rounded-[32px] bg-black/40 py-12"
                            >
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <motion.div animate={{ scale: [1, 0.8, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="flex flex-col items-center">
                                        <div className="bg-white text-indigo-600 px-4 py-2 rounded-full font-bold text-sm mb-4 shadow-lg">
                                            Toca para ver la respuesta
                                        </div>
                                        <Pointer size={48} className="text-white drop-shadow-lg" />
                                    </motion.div>
                                </div>
                                <button 
                                    onClick={skipTutorial} 
                                    className="pointer-events-auto text-white/70 text-sm font-bold uppercase tracking-wider hover:text-white pb-8"
                                >
                                    Omitir Tutorial
                                </button>
                            </motion.div>
                        )}
                        
                        {showTutorial && isFlipped && currentCardIndex === 0 && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[100] pointer-events-none flex flex-col justify-end pb-8"
                            >
                                {/* Left/Right Edge Indicators */}
                                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-orange-100/90 text-orange-500 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.3)] border border-orange-200 backdrop-blur-sm">
                                        <ArrowLeft size={24} strokeWidth={3} />
                                    </div>
                                    <span className="text-[11px] font-black text-orange-600 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded-md backdrop-blur-sm">Repasar</span>
                                </motion.div>

                                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-green-100/90 text-green-500 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.3)] border border-green-200 backdrop-blur-sm">
                                        <ArrowRight size={24} strokeWidth={3} />
                                    </div>
                                    <span className="text-[11px] font-black text-green-600 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded-md backdrop-blur-sm">Lo sé</span>
                                </motion.div>

                                {/* Hand & Instruction Bottom overlay */}
                                <div className="w-full px-6 flex flex-col items-center gap-5 mt-auto">
                                    <motion.div animate={{ x: [-40, 40, -40] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                                        <div className="w-16 h-16 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-200">
                                            <Hand size={32} className="text-slate-800" />
                                        </div>
                                    </motion.div>

                                    <div className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl flex items-center gap-2">
                                        Desliza para responder
                                    </div>
                                    
                                    <button 
                                        onClick={skipTutorial} 
                                        className="pointer-events-auto text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-700 px-4 py-2 bg-white/50 backdrop-blur-sm rounded-full mb-2"
                                    >
                                        Omitir Tutorial
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        <motion.div
                            key={card.id}
                            drag={isFlipped ? "x" : false}
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={handleDragEnd}
                            style={{ x, rotate }}
                            animate={controls}
                            initial={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.2 } }}
                            className="absolute w-full h-full max-h-[70vh] flex items-center justify-center touch-pan-y overscroll-x-none"
                        >
                            <div
                                onClick={flipCard}
                                className="w-full h-full cursor-pointer relative"
                                style={{ perspective: '1200px' }}
                            >
                                <div
                                    className="relative w-full h-full transition-transform duration-500 ease-in-out"
                                    style={{
                                        transformStyle: 'preserve-3d',
                                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                                    }}
                                >
                                    {/* FRONT FACE (Question) */}
                                    <div
                                        className="absolute inset-0 bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-slate-100/50"
                                        style={{ backfaceVisibility: 'hidden' }}
                                    >
                                        {card.icon ? (
                                            <div className="relative h-1/3 w-full shrink-0 flex flex-col items-center justify-center" style={{ background: (card.color || '#6366F1') + '18' }}>
                                                <div className="text-5xl mb-2">{card.icon}</div>
                                                <h2 className="text-xl font-black text-slate-800 px-4 text-center">{card.name}</h2>
                                            </div>
                                        ) : card.image_url ? (
                                            <div className="relative h-1/2 w-full shrink-0" style={{ background: cat.color + '30' }}>
                                                <PoiCoverImage key={card.image_url} imageUrl={card.image_url} name={card.name} emoji={cat.emoji} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                <div className="absolute bottom-4 left-6 right-6">
                                                    <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full mb-2">
                                                        {cat.emoji} {cat.label}
                                                    </span>
                                                    <h2 className="text-2xl font-black text-white leading-tight drop-shadow-md">{card.name}</h2>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative h-1/3 w-full shrink-0 flex flex-col items-center justify-center" style={{ background: cat.color + '18' }}>
                                                <div className="text-5xl mb-2">{cat.emoji}</div>
                                                <h2 className="text-xl font-black text-slate-800 px-4 text-center">{card.name}</h2>
                                            </div>
                                        )}
                                        
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white relative">
                                            <div className="mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat.color }}>
                                                    {card.indexLabel}
                                                </span>
                                            </div>
                                            <h3 className="text-[22px] font-bold text-slate-800 leading-snug">
                                                {card.question}
                                            </h3>
                                            
                                            <p className="absolute bottom-6 text-[13px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                                                Toca para voltear
                                            </p>
                                        </div>
                                    </div>

                                    {/* BACK FACE (Answer) */}
                                    <div
                                        className="absolute inset-0 bg-white rounded-[32px] shadow-2xl flex flex-col px-8 py-10 overflow-y-auto border border-slate-100/50 touch-pan-y overscroll-x-none"
                                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                    >
                                        <div className="flex-1 flex flex-col justify-center">
                                            <div className="mb-6 text-center">
                                                <div className="inline-flex w-12 h-12 rounded-full mb-4 items-center justify-center shadow-inner" style={{ background: cat.color + '20', color: cat.color }}>
                                                    <span className="text-2xl">{cat.emoji}</span>
                                                </div>
                                                <h2 className="text-lg font-black text-slate-300 uppercase tracking-widest mb-1">{card.name}</h2>
                                                <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: cat.color }}>
                                                    Respuesta Correcta
                                                </p>
                                            </div>
                                            
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                                                <p className="text-[20px] text-slate-800 font-medium leading-relaxed">
                                                    {card.type === 'kids' ? `"${card.answer}"` : card.answer}
                                                </p>
                                            </div>
                                            
                                            <div className="mt-10 flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-widest px-4">
                                                <button 
                                                    onClick={async (e) => { e.stopPropagation(); if (showTutorial) skipTutorial(); await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.3 } }); handleNextCard(); }}
                                                    className="flex flex-col items-center gap-1 px-5 py-3 -mx-2 rounded-2xl active:bg-orange-50 active:text-orange-500 transition-colors cursor-pointer"
                                                    style={{ border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', fontWeight: 'inherit' }}
                                                >
                                                    <ArrowRight size={16} className="rotate-180" />
                                                    <span>Repasar</span>
                                                </button>
                                                <button 
                                                    onClick={async (e) => { e.stopPropagation(); if (showTutorial) skipTutorial(); await controls.start({ x: window.innerWidth, opacity: 0, transition: { duration: 0.3 } }); handleNextCard(); }}
                                                    className="flex flex-col items-center gap-1 px-5 py-3 -mx-2 rounded-2xl active:bg-green-50 active:text-green-500 transition-colors cursor-pointer"
                                                    style={{ border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', fontWeight: 'inherit' }}
                                                >
                                                    <ArrowRight size={16} />
                                                    <span>Lo sé</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Swiping Overlays - Placed OUTSIDE the rotating container so text isn't backwards! */}
                                <motion.div 
                                    style={{ opacity: opacityRight }} 
                                    className="absolute inset-0 z-20 pointer-events-none rounded-[32px] flex items-center justify-center border-4 border-green-500 bg-green-500/10"
                                >
                                    <div className="px-6 py-2 border-4 border-green-500 rounded-xl -rotate-12 text-green-500 font-black text-4xl uppercase tracking-widest bg-white/50 backdrop-blur-sm">
                                        ¡Lo sé!
                                    </div>
                                </motion.div>
                                
                                <motion.div 
                                    style={{ opacity: opacityLeft }} 
                                    className="absolute inset-0 z-20 pointer-events-none rounded-[32px] flex items-center justify-center border-4 border-orange-500 bg-orange-500/10"
                                >
                                    <div className="px-6 py-2 border-4 border-orange-500 rounded-xl rotate-12 text-orange-500 font-black text-4xl uppercase tracking-widest text-center leading-none bg-white/50 backdrop-blur-sm">
                                        Repasar<br/>Luego
                                    </div>
                                </motion.div>

                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    return <div className={styles.shell}><header className={styles.header}><div className={styles.headerRow}><Link href="/staff/dashboard" aria-label="Volver al inicio"><ArrowLeft size={22}/></Link><h1>Capacitación</h1></div></header><main className={styles.content}>
        {loading && <p role="status">Cargando capacitación…</p>}{error && <p role="alert">{error}</p>}
        {!loading && !error && !trainingModules.length && <p>Aún no hay módulos publicados.</p>}
        <div className={styles.grid}>{trainingModules.map(mod => <button key={mod.id} className={styles.trainingCard} disabled={!(mod.training_cards || []).some(card => card.status === 'approved')} onClick={() => startModuleStudy(mod)}><BookOpen size={25}/><h2>{mod.title}</h2><p>{mod.description}</p></button>)}</div>
    </main></div>;
}
