'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
    Compass, Map, ChevronLeft, 
    Flame, BookOpen, X, ArrowRight, ArrowLeft,
    Zap, PartyPopper, RotateCcw,
    Check, X as XIcon, Pointer, Hand, HelpCircle, Award, Plus
} from 'lucide-react';
import { motion, useAnimation, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import POIDetailModal from '@/components/staff/POIDetailModal';
import PilotDashboardHeader from '@/components/staff/PilotDashboardHeader';

// ═══════════════════════════════════════════════════════════════
// autoCategory — reutilizada de POIDetailModal.js
// Clasifica un POI por su descripción y devuelve emoji + label.
// ═══════════════════════════════════════════════════════════════
function autoCategory(desc) {
    if (!desc) return { emoji: '📍', label: 'Punto de interés', color: '#6366F1' };
    if (/museo/i.test(desc)) return { emoji: '🏛️', label: 'Museo', color: '#7C3AED' };
    if (/templo|iglesia|culto|capilla|parroquia/i.test(desc)) return { emoji: '⛪', label: 'Templo', color: '#E11D48' };
    if (/río|lago|presa|cascada|agua|laguna/i.test(desc)) return { emoji: '💧', label: 'Agua', color: '#0EA5E9' };
    if (/parque|reserva|bosque|natural|área/i.test(desc)) return { emoji: '🌿', label: 'Natural', color: '#10B981' };
    if (/cerro|volcán|montaña|elevación/i.test(desc)) return { emoji: '⛰️', label: 'Cerro', color: '#78716C' };
    if (/universidad|biblioteca|educativa|teatro/i.test(desc)) return { emoji: '📚', label: 'Educativo', color: '#4F46E5' };
    if (/planta|fábrica|infraestructura|estación/i.test(desc)) return { emoji: '🏭', label: 'Industrial', color: '#52525B' };
    if (/aeropuerto|aeródromo/i.test(desc)) return { emoji: '✈️', label: 'Aeropuerto', color: '#0284C7' };
    if (/deportiv|estadio/i.test(desc)) return { emoji: '⚽', label: 'Deportivo', color: '#16A34A' };
    if (/monument|históric|arqueológ/i.test(desc)) return { emoji: '🏺', label: 'Histórico', color: '#B45309' };
    if (/mirador|viewpoint/i.test(desc)) return { emoji: '👁️', label: 'Mirador', color: '#64748B' };
    if (/zoológico|acuario/i.test(desc)) return { emoji: '🐾', label: 'Fauna', color: '#65A30D' };
    return { emoji: '📍', label: 'Punto de interés', color: '#6366F1' };
}

// Determina el estado de estudio de un POI
function getStudyStatus(poi) {
    if (!poi.dato_clave_1 && !poi.dato_clave_2) {
        return { label: 'Sin ficha', color: 'bg-red-50 text-red-500 border-red-100', dot: '🔴' };
    }
    return { label: 'Por repasar', color: 'bg-amber-50 text-amber-600 border-amber-100', dot: '🟡' };
}

// Fisher-Yates shuffle
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export default function AcademiaLobbyPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [pois, setPois] = useState([]);
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState('Piloto');
    const [userAvatarConfig, setUserAvatarConfig] = useState(null);

    // Capacitación FlyHigh
    const [trainingModules, setTrainingModules] = useState([]);

    // Study mode state
    const [studyMode, setStudyMode] = useState(false);
    const [studyDeck, setStudyDeck] = useState([]);
    
    // Modal state for POI details
    const [selectedPoi, setSelectedPoi] = useState(null);
    const [isPoiModalOpen, setIsPoiModalOpen] = useState(false);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [studyComplete, setStudyComplete] = useState(false);
    
    // Tutorial state
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        const seen = localStorage.getItem('flyhigh_study_tutorial_seen');
        if (!seen) setShowTutorial(true);
    }, []);

    const skipTutorial = () => {
        localStorage.setItem('flyhigh_study_tutorial_seen', 'true');
        setShowTutorial(false);
    };

    const replayTutorial = () => {
        setShowTutorial(true);
    };

    // Gamification (static for now)
    const studyReadyCount = pois.filter(p => p.dato_clave_1).length;
    const totalPoints = pois.length;
    const nextLevelTarget = Math.max(totalPoints + 3, 5);
    const progressPercent = Math.min((totalPoints / nextLevelTarget) * 100, 100);

    useEffect(() => {
        let isMounted = true;
        async function fetchPOIs() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.replace('/staff/login'); return; }
                
                // Fetch profile data (avatar lives in staff_profiles, NOT profiles)
                const { data: profile } = await supabase
                    .from('staff_profiles')
                    .select('full_name, avatar_config')
                    .eq('user_id', user.id)
                    .single();

                if (isMounted) {
                    setUserId(user.id);
                    setUserName(profile?.full_name || user.user_metadata?.full_name || 'Piloto');
                    setUserAvatarConfig(profile?.avatar_config || null);
                }

                const { data, error } = await supabase
                    .from('pilot_pois')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;

                // Fetch published training modules and their approved cards
                const { data: modulesData } = await supabase
                    .from('training_modules')
                    .select('*, training_cards(*)')
                    .eq('status', 'published')
                    .order('created_at', { ascending: false });

                if (isMounted) {
                    setPois(data || []);
                    setTrainingModules(modulesData || []);
                }
            } catch (err) {
                console.error('Error fetching POIs:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchPOIs();
        return () => { isMounted = false; };
    }, [router]);

    // ═══ STUDY MODE HANDLERS ═══
    const startStudy = useCallback(() => {
        let granularDeck = [];
        pois.forEach(poi => {
            // Memory Challenge 1
            if (poi.dato_clave_1) {
                granularDeck.push({
                    id: `${poi.id}-1`,
                    poiId: poi.id,
                    name: poi.name,
                    description: poi.description,
                    image_url: poi.image_url,
                    question: poi.pregunta_estudio_1 || '¿Qué sabes sobre este lugar?',
                    answer: poi.dato_clave_1,
                    type: 'memory',
                    indexLabel: 'DATO CLAVE 1'
                });
            }
            // Memory Challenge 2
            if (poi.dato_clave_2) {
                granularDeck.push({
                    id: `${poi.id}-2`,
                    poiId: poi.id,
                    name: poi.name,
                    description: poi.description,
                    image_url: poi.image_url,
                    question: poi.pregunta_estudio_2 || '¿Qué otro dato relevante recuerdas?',
                    answer: poi.dato_clave_2,
                    type: 'memory',
                    indexLabel: 'DATO CLAVE 2'
                });
            }
            // Memory Challenge 3
            if (poi.dato_clave_3) {
                granularDeck.push({
                    id: `${poi.id}-3`,
                    poiId: poi.id,
                    name: poi.name,
                    description: poi.description,
                    image_url: poi.image_url,
                    question: poi.pregunta_estudio_3 || '¿Qué más recuerdas sobre este lugar?',
                    answer: poi.dato_clave_3,
                    type: 'memory',
                    indexLabel: 'DATO CLAVE 3'
                });
            }
            
            // Kids Question
            if (poi.pregunta_interaccion) {
                granularDeck.push({
                    id: `${poi.id}-kids`,
                    poiId: poi.id,
                    name: poi.name,
                    description: poi.description,
                    image_url: poi.image_url,
                    question: '¿Qué pregunta detonadora le harías a los niños en el vuelo?',
                    answer: poi.pregunta_interaccion,
                    type: 'kids',
                    indexLabel: 'PREGUNTA OPERATIVA'
                });
            }
        });

        const deck = shuffle(granularDeck);
        if (deck.length === 0) return;
        
        setStudyDeck(deck);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setStudyComplete(false);
        setStudyMode(true);
        // Reset score
        // We could track a score state if desired, but for now we'll just track completion
    }, [pois]);

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
                        Volver a la Bitácora
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
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
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
                                            <div className="relative h-1/2 w-full shrink-0">
                                                <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
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
                                                <div className="flex flex-col items-center gap-1">
                                                    <ArrowRight size={16} className="rotate-180" />
                                                    <span>Repasar</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <ArrowRight size={16} />
                                                    <span>Lo sé</span>
                                                </div>
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

    // ═══════════════════════════════════════════════════════════
    // RENDER: BITÁCORA (Main Lobby)
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
            <PilotDashboardHeader 
                userName={userName}
                avatarConfig={userAvatarConfig}
                totalPoints={totalPoints}
                nextLevelTarget={nextLevelTarget}
                progressPercent={progressPercent}
                studyReadyCount={studyReadyCount}
            />

            {/* Content Area */}
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-12">

                {/* ═══ CTA: EMPEZAR A ESTUDIAR (El "Play" del Juego) ═══ */}
                <button
                    onClick={startStudy}
                    disabled={studyReadyCount === 0}
                    className={`w-full rounded-[32px] py-6 px-6 flex flex-col items-center justify-center gap-2 transition-all mb-4 relative overflow-hidden group ${
                        studyReadyCount > 0
                            ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-[0_12px_40px_rgba(124,58,237,0.3)] hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(124,58,237,0.4)] active:scale-[0.98]'
                            : 'bg-white text-slate-400 cursor-not-allowed border-2 border-slate-100 shadow-[0_4px_15px_rgba(0,0,0,0.02)]'
                    }`}
                >
                    {studyReadyCount > 0 && (
                        <>
                            <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        </>
                    )}
                    <div className="relative z-10 flex items-center justify-center gap-3">
                        <BookOpen size={28} className={studyReadyCount > 0 ? "drop-shadow-lg" : ""} strokeWidth={2.5} />
                        <span className="font-black text-[20px] tracking-tight">{studyReadyCount > 0 ? 'REPASAR FICHAS' : 'SIN FICHAS'}</span>
                    </div>
                    {studyReadyCount > 0 ? (
                        <span className="relative z-10 text-[11px] font-bold text-white/90 bg-black/20 px-4 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md shadow-sm border border-white/10">
                            Tienes {studyReadyCount} pendiente{studyReadyCount !== 1 && 's'}
                        </span>
                    ) : (
                        <span className="relative z-10 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-full">
                            Completa una ficha primero
                        </span>
                    )}
                </button>

                {/* ═══ CTA: EXPLORAR MAPA (Añadir Puntos) ═══ */}
                <button
                    onClick={() => router.push('/staff/mapeo')}
                    className={`w-full rounded-[32px] py-6 px-6 flex flex-col items-center justify-center gap-2 transition-all mb-8 relative overflow-hidden group bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[0_12px_40px_rgba(0,0,0,0.25)] hover:-translate-y-1 hover:shadow-[0_16px_50px_rgba(0,0,0,0.35)] active:scale-[0.98] border border-slate-700/50`}
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                    
                    <div className="relative z-10 flex items-center justify-center gap-3">
                        <Compass size={28} className="text-indigo-400 drop-shadow-lg group-hover:rotate-45 transition-transform duration-700" strokeWidth={2.5} />
                        <span className="font-black text-[20px] tracking-tight text-white">EXPLORAR MAPA</span>
                    </div>
                    <span className="relative z-10 text-[11px] font-bold text-indigo-300 bg-indigo-900/40 px-4 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md shadow-sm border border-indigo-500/20">
                        Descubre y añade fichas
                    </span>
                </button>
                {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white rounded-[24px] aspect-[4/5] border border-slate-100 shadow-sm animate-pulse flex flex-col p-4">
                                <div className="w-12 h-12 bg-slate-200 rounded-full mb-auto mx-auto" />
                                <div className="h-4 w-3/4 bg-slate-200 rounded-full mt-4 mb-2" />
                                <div className="h-3 w-1/2 bg-slate-100 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : pois.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                    <BookOpen size={14} className="text-slate-600" />
                                </div>
                                <h2 className="text-[13px] font-black text-slate-800 uppercase tracking-widest">
                                    Tu Colección <span className="text-slate-400">({pois.length})</span>
                                </h2>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {pois.map(poi => {
                                const cat = autoCategory(poi.description);
                                const status = getStudyStatus(poi);
                                const needsStudy = status.label.includes('Repasar');
                                
                                return (
                                    <div 
                                        key={poi.id}
                                        onClick={() => { setSelectedPoi(poi); setIsPoiModalOpen(true); }}
                                        className="bg-white rounded-[28px] overflow-hidden border border-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.03)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all cursor-pointer group flex flex-col relative"
                                    >
                                        {/* Status Badge */}
                                        <div className="absolute top-3 right-3 z-10">
                                            <div className={`px-2.5 py-1.5 rounded-full backdrop-blur-md text-[9px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1 ${
                                                needsStudy 
                                                ? 'bg-amber-500/90 text-white border-amber-400' 
                                                : 'bg-emerald-500/90 text-white border-emerald-400'
                                            }`}>
                                                {needsStudy ? <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> : <Award size={10} />}
                                                {needsStudy ? 'Entrenando' : 'Dominado'}
                                            </div>
                                        </div>

                                        {/* Top Image / Pattern Area */}
                                        <div 
                                            className="h-[130px] shrink-0 w-full relative flex flex-col items-center justify-center transition-transform duration-500 group-hover:scale-105"
                                            style={!poi.image_url ? { background: `linear-gradient(135deg, ${cat.color}20, ${cat.color}40)` } : {}}
                                        >
                                            {poi.image_url ? (
                                                <>
                                                    <img src={poi.image_url} alt={poi.name} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/30" />
                                                </>
                                            ) : (
                                                <span className="text-5xl drop-shadow-md">{cat.emoji}</span>
                                            )}
                                        </div>
                                        
                                        {/* Bottom Content Area */}
                                        <div className="flex-1 p-4 flex flex-col bg-white relative z-10 border-t border-slate-100/50">
                                            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 truncate" style={{ color: cat.color }}>
                                                {cat.label}
                                            </p>
                                            <h3 className="font-black text-slate-800 text-[14px] leading-tight mb-3 line-clamp-2">
                                                {poi.name}
                                            </h3>
                                            
                                            {/* Datos Clave Preview */}
                                            <div className="space-y-1.5 mt-auto">
                                                {poi.dato_clave_1 && (
                                                    <div className="text-[10px] text-slate-500 flex gap-1.5 items-center">
                                                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: cat.color }}/> 
                                                        <span className="truncate">{poi.dato_clave_1}</span>
                                                    </div>
                                                )}
                                                {poi.dato_clave_2 && (
                                                    <div className="text-[10px] text-slate-500 flex gap-1.5 items-center">
                                                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: cat.color }}/> 
                                                        <span className="truncate">{poi.dato_clave_2}</span>
                                                    </div>
                                                )}
                                                {poi.dato_clave_3 && (
                                                    <div className="text-[10px] text-slate-500 flex gap-1.5 items-center">
                                                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: cat.color }}/> 
                                                        <span className="truncate">{poi.dato_clave_3}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── SECCIÓN: CAPACITACIÓN FLYHIGH ── */}
                        {trainingModules.length > 0 && (
                            <div className="mt-8 mb-4 px-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                        <Award size={14} className="text-slate-600" />
                                    </div>
                                    <h2 className="text-[13px] font-black text-slate-800 uppercase tracking-widest">
                                        Capacitación FlyHigh
                                    </h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {trainingModules.map((mod) => {
                                        const approvedCards = (mod.training_cards || []).filter(c => c.status === 'approved').length;
                                        return (
                                            <div 
                                                key={mod.id} 
                                                onClick={() => approvedCards > 0 && startModuleStudy(mod)}
                                                className={`bg-white rounded-[24px] border shadow-sm p-5 transition-all group overflow-hidden relative flex flex-col ${approvedCards > 0 ? 'border-slate-100 hover:border-indigo-200 hover:shadow-md cursor-pointer active:scale-[0.98]' : 'border-slate-100 opacity-60 cursor-not-allowed'}`}
                                            >
                                                {approvedCards > 0 && (
                                                    <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-20" style={{ background: mod.color || '#6366F1' }}></div>
                                                )}
                                                
                                                <div className="flex items-start gap-4 relative z-10">
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner" style={{ background: (mod.color || '#6366F1') + '18' }}>
                                                        {mod.icon || '📋'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-black text-[17px] text-slate-800 leading-tight mb-1 truncate">
                                                            {mod.title}
                                                        </h3>
                                                        <p className="text-[13px] text-slate-500 font-medium truncate mb-3">
                                                            {mod.description || 'Manual de capacitación'}
                                                        </p>
                                                        
                                                        {approvedCards > 0 ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {approvedCards} Fichas
                                                                </span>
                                                                <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors ml-auto">
                                                                    <BookOpen size={12} strokeWidth={3} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100">
                                                                Próximamente
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[45vh] text-center px-4">
                        <div className="w-24 h-24 mb-6 relative">
                            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-50" />
                            <div className="relative w-full h-full bg-white rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.15)] flex items-center justify-center border-4 border-indigo-50 text-indigo-500">
                                <Compass size={40} strokeWidth={1.5} />
                            </div>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 mb-2">Comienza tu Bitácora</h2>
                        <p className="text-slate-500 text-sm max-w-[260px] leading-relaxed">
                            No tienes objetivos registrados. ¡Explora el mapa y guarda tu primer punto para empezar a estudiar!
                        </p>
                    </div>
                )}
            </div>

            <POIDetailModal
                isOpen={isPoiModalOpen}
                onClose={() => setIsPoiModalOpen(false)}
                poi={selectedPoi}
                isNewPin={false}
                onSave={async (poiData) => {
                    try {
                        const supabase = createClient();
                        const { error } = await supabase
                            .from('pilot_pois')
                            .update({
                                name: poiData.name,
                                description: poiData.description,
                                dato_clave_1: poiData.dato_clave_1,
                                dato_clave_2: poiData.dato_clave_2,
                                dato_clave_3: poiData.dato_clave_3,
                                pregunta_estudio_1: poiData.pregunta_estudio_1,
                                pregunta_estudio_2: poiData.pregunta_estudio_2,
                                pregunta_estudio_3: poiData.pregunta_estudio_3,
                                pregunta_interaccion: poiData.pregunta_interaccion,
                                image_url: poiData.image_url
                            })
                            .eq('id', poiData.id);
                        
                        if (error) throw error;
                        
                        // Update local state
                        setPois(prev => prev.map(p => p.id === poiData.id ? { ...p, ...poiData } : p));
                        setIsPoiModalOpen(false);
                    } catch (error) {
                        console.error('Error updating POI:', error);
                        alert('Error guardando los datos. Por favor, intenta de nuevo.');
                    }
                }}
            />
        </div>
    );
}
