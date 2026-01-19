'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Heart, Plane, Trophy, Sparkles, School, Target, X,
    Lock, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useImpact } from '@/context/ImpactContext';
import { supabaseNew as supabase } from '@/lib/supabaseClientNew';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// --- DATA: Frases de Impacto ---
const IMPACT_PHRASES = {
    // UNIDADES
    1: ["Hoy le regalaste sus primeras alas.", "Eres la razón de su primera gran sonrisa."],
    2: ["Dos amigos compartirán una aventura inolvidable.", "Doble impacto: dos vidas cambiadas hoy."],
    3: ["Tres pequeños pilotos listos para despegar.", "Tres nuevas historias de éxito comienzan contigo."],
    4: ["Cuatro miradas que hoy brillarán más fuerte.", "Tu generosidad impulsa cuatro grandes sueños."],
    5: ["¡Choca esos cinco! Cambiaste 5 vidas para siempre.", "Una manita completa de futuros pilotos."],
    6: ["Media docena de sueños despegan por tu causa.", "Seis niños descubrirán hoy que el cielo es suyo."],
    7: ["Siete destinos transformados con un solo gesto.", "Tu bondad hoy tiene el número de la suerte."],
    8: ["Ocho mentes jóvenes inspiradas por tu acción.", "Estás abriendo ocho ventanas hacia el futuro."],
    9: ["Casi una decena de sonrisas llevan tu nombre.", "Nueve niños recordarán este día gracias a ti."],
    // DECENAS
    10: ["¡Increíble! Una decena de sueños hechos realidad.", "Tus alas son grandes: 10 niños vuelan hoy."],
    20: ["La vibra de todo un grupo cambia gracias a ti.", "Veinte razones para creer en un futuro brillante."],
    30: ["Todo un salón de clases te aplaude hoy.", "Eres el héroe anónimo de treinta nuevos pilotos."],
    40: ["¡Impacto total! Un grado escolar vuela por ti.", "Cuarenta familias hablarán de esto en la cena."],
    50: ["Medio centenar de vidas tocadas por tu bondad.", "Tu legado empieza a crecer: 50 niños inspirados."],
    // CENTENAS
    100: ["¡Histórico! Cien niños miran al cielo por ti.", "Acabas de romper la barrera: 100 sueños en vuelo."],
    150: ["Tu impacto resuena en toda la comunidad escolar.", "Ciento cincuenta corazones latiendo a mil por hora."],
    200: ["¡Doscientos! Estás moviendo a la juventud de Uruapan.", "Doscientos niños saben hoy que sí se puede."],
    250: ["Media escuela transformada. Eres un motor de cambio.", "Tu generosidad no conoce la gravedad: 250 vuelos."],
    300: ["Trescientos alumnos listos para conquistar el futuro.", "Estás creando una generación de soñadores."],
    350: ["Casi una escuela completa cambia su perspectiva hoy.", "El cielo de Uruapan se llena de esperanza por ti."],
    // LEYENDA
    400: ["¡LEYENDA! Una escuela entera vuela por ti.", "PATROCINADOR OFICIAL: Hiciste historia."]
};

// --- COMPONENTE: Confeti ---
const ConfettiPiece = ({ delay }) => {
    const colors = ['bg-cyan-400', 'bg-fuchsia-500', 'bg-yellow-400', 'bg-white'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomLeft = Math.random() * 100;

    return (
        <div
            className={`absolute top-0 w-2 h-4 ${randomColor} rounded-sm transition-all duration-700`}
            style={{
                left: `${randomLeft}%`,
                animation: `fall 3s linear ${delay}ms infinite`, // Simulación de caída
                opacity: 0.8,
                transform: `translateY(${Math.random() * 50}px) rotate(${Math.random() * 360}deg)`
            }}
        />
    );
};

// --- COMPONENTE: Iconos de Tarjetas ---
const CardLogos = () => (
    <div className="flex gap-2 opacity-50 grayscale transition-all hover:grayscale-0 hover:opacity-100 cursor-help" title="Aceptamos todas las tarjetas">
        {/* Visa */}
        <div className="h-6 w-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[10px] font-bold text-blue-800 tracking-tighter italic font-serif">Visa</div>
        {/* Mastercard */}
        <div className="h-6 w-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center relative overflow-hidden">
            <div className="w-3 h-3 bg-red-500/80 rounded-full -mr-1 mix-blend-multiply"></div>
            <div className="w-3 h-3 bg-orange-400/80 rounded-full -ml-1 mix-blend-multiply"></div>
        </div>
        {/* Amex */}
        <div className="h-6 w-10 bg-blue-400 border border-blue-500 rounded flex items-center justify-center text-[6px] font-bold text-white overflow-hidden">
            <span className="scale-[0.6] tracking-widest">AMEX</span>
        </div>
    </div>
);

// --- COMPONENTE: Payment Form ---
const CheckoutForm = ({ amount, onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsLoading(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href,
            },
            redirect: "if_required",
        });

        if (error) {
            setMessage(error.message);
            setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onSuccess();
        } else {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {message && <div className="text-red-500 text-sm">{message}</div>}
            <div className="sticky bottom-0 bg-white pt-4 pb-2 z-10 border-t border-slate-50">
                <button
                    disabled={isLoading || !stripe || !elements}
                    className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg active:scale-95 group relative overflow-hidden"
                    suppressHydrationWarning={true}
                >
                    {isLoading ? (
                        <span className="animate-pulse">Procesando...</span>
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <span className="font-medium tracking-wide">Donar ${amount.toLocaleString()}</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

// --- SUB-COMPONENTE: Partícula Slider ---
const Particle = ({ id, x, type, onComplete }) => {
    const [style, setStyle] = useState({ opacity: 1, transform: 'translateY(0px) scale(0.5)' });
    useEffect(() => {
        requestAnimationFrame(() => {
            const randomX = (Math.random() - 0.5) * 80;
            const randomY = -150 - Math.random() * 120;
            setStyle({
                opacity: 0,
                transform: `translate(${randomX}px, ${randomY}px) scale(${1 + Math.random()})`
            });
        });
        const timer = setTimeout(() => onComplete(id), 800);
        return () => clearTimeout(timer);
    }, []);
    const icons = { heart: <Heart className="fill-current" />, plane: <Plane className="fill-current" />, star: <Sparkles className="fill-current" /> };
    const colors = ['text-cyan-400', 'text-fuchsia-500', 'text-amber-400'];
    const colorClass = colors[Math.floor(Math.random() * colors.length)];
    return (<div className={`absolute pointer-events-none transition-all duration-700 ease-out ${colorClass}`} style={{ left: `${x}%`, bottom: '60%', ...style }}> <div className="w-5 h-5">{icons[type]}</div> </div>);
};

// --- COMPONENTE PRINCIPAL: Donation Modal ---
export default function DonationModal({ isOpen, onClose }) {
    const [mounted, setMounted] = useState(false);

    // Impact State
    const [step, setStep] = useState('selection'); // selection, payment, success
    const [sliderValue, setSliderValue] = useState(1);
    const [childCount, setChildCount] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [particles, setParticles] = useState([]);
    const [phrase, setPhrase] = useState("Hoy le regalaste sus primeras alas.");
    const [showPhrase, setShowPhrase] = useState(true);
    const [isLegend, setIsLegend] = useState(false);
    const { setLocalDonation } = useImpact();

    // Stripe State
    const [clientSecret, setClientSecret] = useState("");

    // Slider Ref
    const sliderRef = useRef(null);
    const [sliderWidth, setSliderWidth] = useState(0);

    const cost = childCount * 40;

    useEffect(() => {
        setMounted(true);
        const updateWidth = () => {
            if (sliderRef.current) setSliderWidth(sliderRef.current.offsetWidth);
        };
        // Small delay to ensure modal is rendered
        if (isOpen) setTimeout(updateWidth, 100);

        window.addEventListener('resize', updateWidth);
        return () => {
            setMounted(false);
            window.removeEventListener('resize', updateWidth);
        }
    }, [isOpen]);

    // Payment Intent Effect
    useEffect(() => {
        if (isOpen && step === 'payment' && !clientSecret) {
            fetch("/api/create-payment-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ childCount }),
            })
                .then((res) => res.json())
                .then((data) => setClientSecret(data.clientSecret));
        }
    }, [isOpen, step, childCount, clientSecret]);

    if (!isOpen || !mounted) return null;

    // Reset when modal opens (optional, or keep state persistence)
    // For now we keep state persistence as requested if modal is just hidden/shown

    const calculateChildren = (val) => {
        if (val <= 10) return Math.max(1, Math.round((val / 10) * 10));
        if (val <= 30) return 10 + Math.round(((val - 10) / 20) * 4) * 10;
        if (val <= 90) return 50 + Math.round(((val - 30) / 60) * 7) * 50;
        if (val < 100) return 400;
        return 800;
    };

    const handleInput = (e) => {
        const val = parseInt(e.target.value);
        setSliderValue(val);
        const count = calculateChildren(val);

        if (count !== childCount) {
            if (navigator.vibrate) {
                if (count === 400 || count === 800) navigator.vibrate(200);
                else if (count % 10 === 0) navigator.vibrate(40);
                else navigator.vibrate(10);
            }

            const specificOptions = IMPACT_PHRASES[count];
            if (specificOptions) {
                setPhrase(specificOptions[Math.floor(Math.random() * specificOptions.length)]);
            } else {
                setPhrase("Estás cambiando su destino para siempre.");
            }
        }

        setChildCount(count);
        setIsLegend(count === 400 || count === 800);
        setShowPhrase(true);
        setIsDragging(true);

        if (Math.random() > 0.6) {
            const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const type = Math.random() > 0.7 ? 'plane' : 'heart';
            setParticles(p => [...p, { id, x: 50 + (Math.random() - 0.5) * 30, type }]);
        }
    };

    const handleRelease = () => {
        setIsDragging(false);
        setShowPhrase(true);
    };

    const removeParticle = (id) => setParticles(prev => prev.filter(p => p.id !== id));

    const thumbWidth = 48;
    const pct = (childCount === 800 ? 100 : sliderValue) / 100;
    const thumbPosition = pct * (Math.max(0, sliderWidth - thumbWidth));

    const cardBase = "relative w-full max-w-[420px] bg-white rounded-3xl overflow-hidden shadow-2xl transition-all duration-300";

    const modalContent = (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                />

                {/* Modal Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={cardBase}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-50"
                    >
                        <X size={20} />
                    </button>

                    {/* Step 1: Selection Slider */}
                    {step === 'selection' && (
                        <div className="p-8 pt-10">
                            {/* Header */}
                            <div className="text-center mb-8 relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-6">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 shadow-sm">
                                        <Target size={14} className="text-cyan-600" />
                                        <span className="text-[10px] font-bold tracking-widest uppercase text-cyan-800">Tu Impacto</span>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight mt-4">
                                    Regala un <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-fuchsia-600">nuevo horizonte</span>
                                </h3>
                            </div>

                            {/* Main Interaction Area */}
                            <div className="relative w-full flex flex-col items-center justify-center mb-8 h-28">
                                {particles.map(p => <Particle key={p.id} {...p} onComplete={removeParticle} />)}

                                <div className="mb-2 transition-transform duration-200">
                                    {isLegend ? (<School size={48} strokeWidth={1.5} className="text-yellow-400 animate-bounce" />) : (<Heart size={48} weight="fill" className={`text-fuchsia-500 fill-current transition-all duration-300 drop-shadow-md ${isDragging ? 'animate-pulse' : ''}`} />)}
                                </div>

                                <div className="flex flex-col items-center">
                                    <div className="flex items-baseline justify-center gap-2 transition-all duration-300">
                                        <span className={`text-5xl font-black tracking-tighter leading-none ${isLegend ? "text-yellow-400" : "text-slate-800"}`}>{childCount}</span>
                                        <span className="text-sm font-bold uppercase tracking-widest text-slate-400">{childCount === 1 ? 'Niño' : 'Niños'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Phrase */}
                            <div className="h-10 flex items-center justify-center -mt-4 mb-6">
                                <p key={phrase} className="font-medium text-sm text-center text-slate-500 animate-in fade-in slide-in-from-bottom-1 duration-300">
                                    {phrase}
                                </p>
                            </div>

                            {/* Slider */}
                            <div className="w-full px-2 mb-8 group relative z-10">
                                <div className="flex justify-between mb-2 text-[10px] font-bold uppercase tracking-widest px-1 text-slate-400">
                                    <span>1 Pasajero</span><span>Escuela Completa</span>
                                </div>

                                <div className="relative w-full h-14 flex items-center touch-none" ref={sliderRef}>
                                    <div className="absolute w-full h-6 bg-slate-100 rounded-full shadow-inner overflow-hidden ring-1 ring-black/5">
                                        <div
                                            className={`absolute top-0 left-0 h-full origin-left will-change-transform ${isLegend ? 'bg-gradient-to-r from-yellow-300 to-amber-500' : 'bg-gradient-to-r from-cyan-400 to-fuchsia-500'}`}
                                            style={{
                                                width: '100%',
                                                transform: `scaleX(${childCount === 800 ? 1 : Math.max(sliderValue, 6) / 100})`,
                                                transformOrigin: 'left',
                                                transition: isDragging ? 'none' : 'transform 0.1s linear'
                                            }}
                                        />
                                    </div>

                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={sliderValue}
                                        onInput={handleInput}
                                        onTouchStart={() => setIsDragging(true)}
                                        onTouchEnd={handleRelease}
                                        onMouseDown={() => setIsDragging(true)}
                                        onMouseUp={handleRelease}
                                        className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-grab active:cursor-grabbing"
                                    />

                                    <div
                                        className="absolute w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none z-40 border-4 border-white ring-1 ring-slate-100"
                                        style={{
                                            left: 0,
                                            top: '50%',
                                            transform: `translate3d(${thumbPosition}px, -50%, 0)`,
                                            transition: isDragging ? 'none' : 'transform 0.1s linear'
                                        }}
                                    >
                                        {isLegend ? <Trophy size={16} className="text-amber-500 fill-current" /> : <Plane size={16} className="text-cyan-600 -rotate-45" />}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="w-full text-center space-y-4">
                                <div className="inline-flex items-center justify-center space-x-2 bg-slate-50 py-2 px-4 rounded-lg text-sm text-slate-400 mb-2">
                                    <span>$40</span><span className="text-xs text-slate-300">✕</span><span className="font-semibold text-slate-500">{childCount}</span><span className="text-xs text-slate-300">=</span><strong className="text-slate-700">${cost.toLocaleString()}</strong>
                                </div>
                                <button
                                    onClick={() => setStep('payment')}
                                    className={`w-full py-4 rounded-xl font-black text-lg shadow-xl shadow-fuchsia-200 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 group ${isLegend ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white' : 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white hover:scale-[1.02]'}`}
                                >
                                    {isLegend ? (<><span>PATROCINAR ESCUELA</span> <Sparkles className="animate-spin-slow" /></>) : (<><span>Apadrinar {childCount} {childCount === 1 ? 'niño' : 'niños'}</span> <Heart className="w-5 h-5 group-hover:scale-110 transition-transform fill-white/20" /></>)}
                                </button>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 opacity-60">Pago 100% Seguro • Fly High Edu</p>
                            </div>

                        </div>
                    )}

                    {/* Step 2: Payment */}
                    {step === 'payment' && (
                        <div className="p-8 max-h-[85vh] overflow-y-auto w-full">
                            <div className="flex items-center gap-3 mb-6">
                                <button onClick={() => setStep('selection')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                </button>
                                <h3 className="text-xl font-bold text-slate-800">Finalizar Apadrinamiento</h3>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-2xl flex justify-between items-center border border-slate-200/60 shadow-inner mb-6">
                                <div className="flex flex-col">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total a donar</span>
                                    <span className="text-slate-500 text-xs flex items-center gap-1"><Lock size={8} /> Pago único</span>
                                </div>
                                <span className="text-3xl font-black text-slate-800">${cost.toLocaleString()}</span>
                            </div>

                            <div className="space-y-4">
                                {clientSecret ? (
                                    <Elements options={{ clientSecret, appearance: { theme: 'stripe' } }} stripe={stripePromise}>
                                        <CheckoutForm amount={cost} onSuccess={() => setStep('success')} />
                                    </Elements>
                                ) : (
                                    <div className="py-12 flex flex-col items-center justify-center space-y-4 text-slate-400">
                                        <div className="w-8 h-8 border-2 border-slate-200 border-t-cyan-500 rounded-full animate-spin"></div>
                                        <span className="text-sm">Iniciando pago seguro...</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
                                <CardLogos />
                                <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                    <ShieldCheck size={12} className="text-green-500" />
                                    <span>Encriptación SSL de 256-bits. <strong>Datos blindados.</strong></span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 'success' && (
                        <div className="relative p-8 bg-gradient-to-b from-yellow-50 to-white min-h-[400px] flex flex-col items-center justify-center text-center">
                            {[...Array(20)].map((_, i) => <ConfettiPiece key={i} delay={i * 50} />)}

                            <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-xl shadow-yellow-200 mb-6 animate-bounce">
                                <Trophy size={40} className="text-white" />
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">¡Gracias, Padrino!</h3>
                            <p className="text-slate-600 font-medium mb-8">Acabas de darle alas a <strong className="text-amber-600">{childCount} {childCount === 1 ? 'niño' : 'niños'}</strong>.</p>

                            <div className="w-full bg-white border border-yellow-100 rounded-2xl overflow-hidden shadow-lg mb-8 relative">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>
                                <div className="p-4 border-b border-dashed border-slate-100 flex justify-between items-end">
                                    <div className="text-left">
                                        <div className="text-xs text-slate-400 font-medium mb-0.5">Destino</div>
                                        <div className="text-base font-bold text-slate-800 leading-none">Cielo de Uruapan</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400 font-medium mb-0.5">Pasajeros</div>
                                        <div className="text-2xl font-black text-slate-800 leading-none">{childCount}</div>
                                    </div>
                                </div>
                                <div className="bg-yellow-50/50 p-2.5 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 font-mono">REF: FLY-{Math.floor(Math.random() * 9999)}</span>
                                    <CheckCircle2 size={14} className="text-green-500" />
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-xl shadow-slate-200"
                            >
                                Cerrar y Volver
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}
