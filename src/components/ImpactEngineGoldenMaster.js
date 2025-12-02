'use client';

import React, { useState, useEffect } from 'react';
import {
    Heart, Plane, Trophy, Sparkles, School, Target, X,
    CreditCard, Smartphone, Lock, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useImpact } from '../context/ImpactContext';
import { supabaseNew as supabase } from '../lib/supabaseClientNew';

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
                animation: `fall 3s linear ${delay}ms infinite`, // Simulación de caída con CSS keyframes asumidos o inline
                opacity: 0.8,
                transform: `translateY(${Math.random() * 50}px) rotate(${Math.random() * 360}deg)`
            }}
        />
    );
};

// --- COMPONENTE: Iconos de Tarjetas (SVG Inline Simulado) ---
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

// --- COMPONENTE: Modal de Pago Blindado ---
const PaymentModal = ({ isOpen, onClose, childCount, amount }) => {
    const [step, setStep] = useState('summary'); // summary, processing, success
    const [clientSecret, setClientSecret] = useState("");

    useEffect(() => {
        if (isOpen) {
            setStep('summary');
            // Create PaymentIntent as soon as the modal opens
            fetch("/api/create-payment-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ childCount }),
            })
                .then((res) => res.json())
                .then((data) => setClientSecret(data.clientSecret));
        }
    }, [isOpen, childCount]);

    const handleSuccess = async () => {
        // 1. Call Supabase RPC to increment counter atomically
        const { error } = await supabase.rpc('increment_counter', { amount: childCount });
        if (error) {
            console.error('Error incrementing counter:', error);
            // Optionally handle error (but maybe still show success to user if payment worked?)
        }

        setStep('success');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
                onClick={step !== 'processing' ? onClose : undefined}
            ></div>

            {/* Modal Blindado */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl transition-all duration-300 transform scale-100 ring-1 ring-white/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto my-8 scrollbar-hide">

                {step !== 'success' && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
                        disabled={step === 'processing'}
                    >
                        <X size={20} />
                    </button>
                )}

                {/* --- ESTADO 1: RESUMEN Y PAGO --- */}
                {step === 'summary' && (
                    <div className="p-6 md:p-8 space-y-6">
                        {/* Header Emocional */}
                        <div className="text-center space-y-2">
                            <div className="inline-block p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl mb-1 text-cyan-600 shadow-sm border border-cyan-100">
                                <Plane size={28} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Tu Vuelo está Listo</h3>
                            <p className="text-slate-500 font-medium">Estás apadrinando a <strong className="text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md">{childCount} {childCount === 1 ? 'niño' : 'niños'}</strong></p>
                        </div>

                        {/* Tarjeta de Total */}
                        <div className="bg-slate-50 p-5 rounded-2xl flex justify-between items-center border border-slate-200/60 shadow-inner">
                            <div className="flex flex-col">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total a donar</span>
                                <span className="text-slate-500 text-xs flex items-center gap-1"><Lock size={8} /> Pago único</span>
                            </div>
                            <span className="text-3xl font-black text-slate-800">${amount.toLocaleString()}</span>
                        </div>

                        <div className="space-y-4 pt-2">
                            {clientSecret && (
                                <Elements options={{ clientSecret, appearance: { theme: 'stripe' } }} stripe={stripePromise}>
                                    <CheckoutForm amount={amount} onSuccess={handleSuccess} />
                                </Elements>
                            )}
                        </div>

                        {/* Footer de Seguridad (Trust Badges) */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
                            <div className="flex items-center gap-4">
                                <CardLogos />
                            </div>
                            <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                                <ShieldCheck size={12} className="text-green-500" />
                                <span>Encriptación SSL de 256-bits. <strong>Datos blindados.</strong></span>
                            </p>

                            {/* TEST BUTTON - SIMULATION */}

                        </div>
                    </div>
                )}

                {/* --- ESTADO 2: PROCESANDO --- */}
                {step === 'processing' && (
                    <div className="p-12 flex flex-col items-center justify-center space-y-8 min-h-[450px]">
                        <div className="relative">
                            {/* Spinner de Carga Premium */}
                            <div className="w-20 h-20 border-[6px] border-slate-100 border-t-cyan-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-cyan-500">
                                <Lock size={24} className="animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center space-y-3">
                            <h4 className="text-xl font-bold text-slate-800">Conectando con el Banco...</h4>
                            <p className="text-sm text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                                Estamos encriptando tu donación para enviarla de forma segura.
                            </p>
                        </div>
                        <div className="text-xs font-mono text-slate-300 bg-slate-50 px-3 py-1 rounded">
                            ID: SECURE-{Math.floor(Math.random() * 10000)}
                        </div>
                    </div>
                )}

                {/* --- ESTADO 3: ÉXITO (Ticket Dorado) --- */}
                {step === 'success' && (
                    <div className="relative p-8 bg-gradient-to-b from-yellow-50 to-white min-h-[500px] flex flex-col items-center justify-center overflow-hidden">
                        {/* Confeti */}
                        {[...Array(30)].map((_, i) => <ConfettiPiece key={i} delay={i * 50} />)}

                        <div className="relative z-10 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="w-24 h-24 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-xl shadow-yellow-200 mb-2 animate-bounce">
                                <Trophy size={48} className="text-white" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight">¡Gracias, Padrino!</h3>
                                <p className="text-slate-600 font-medium text-lg">Acabas de darle alas a <strong className="text-amber-600">{childCount} {childCount === 1 ? 'niño' : 'niños'}</strong>.</p>
                            </div>

                            {/* El Ticket Digital */}
                            <div className="w-full bg-white border border-yellow-100 rounded-2xl p-0 shadow-lg relative overflow-hidden group hover:scale-105 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>

                                <div className="p-5 border-b border-dashed border-slate-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                                            <Plane size={10} /> Boleto de Abordaje
                                        </span>
                                        <span className="text-yellow-500 bg-yellow-50 p-1 rounded"><Sparkles size={14} /></span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-left">
                                            <div className="text-xs text-slate-400 font-medium mb-0.5">Destino</div>
                                            <div className="text-lg font-bold text-slate-800 leading-none">Cielo de Uruapan</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-400 font-medium mb-0.5">Pasajeros</div>
                                            <div className="text-3xl font-black text-slate-800 leading-none">{childCount}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-yellow-50/50 p-3 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 font-mono">REF: FLY-{Math.floor(Math.random() * 9999)}</span>
                                    <CheckCircle2 size={16} className="text-green-500" />
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-xl shadow-slate-200"
                            >
                                Cerrar y Volver
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
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

// --- SUB-COMPONENTE: Impact Engine (Tarjeta) ---
const ImpactEngine = ({ onDonate, onImpactChange }) => {
    const [sliderValue, setSliderValue] = useState(1);
    const [childCount, setChildCount] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [particles, setParticles] = useState([]);
    const [phrase, setPhrase] = useState("Hoy le regalaste sus primeras alas.");
    const [showPhrase, setShowPhrase] = useState(true);
    const [isLegend, setIsLegend] = useState(false);
    const { setLocalDonation } = useImpact();

    // Optimización Slider
    const sliderRef = React.useRef(null);
    const [sliderWidth, setSliderWidth] = useState(0);

    useEffect(() => {
        if (!sliderRef.current) return;
        const updateWidth = () => {
            if (sliderRef.current) setSliderWidth(sliderRef.current.offsetWidth);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Calculate thumb position in pixels (Contained behavior: 0 to width - thumbWidth)
    // Thumb width is w-12 (48px)
    const thumbWidth = 48;
    const pct = (childCount === 800 ? 100 : sliderValue) / 100;
    const thumbPosition = pct * (Math.max(0, sliderWidth - thumbWidth));

    // Sync parent state whenever childCount changes
    useEffect(() => {
        if (onImpactChange) {
            onImpactChange(childCount);
        }
        // Update local donation in context (adds to server total)
        setLocalDonation(childCount);
    }, [childCount, onImpactChange, setLocalDonation]);

    const calculateChildren = (val) => {
        if (val <= 10) return Math.max(1, Math.round((val / 10) * 10));
        if (val <= 30) return 10 + Math.round(((val - 10) / 20) * 4) * 10;
        if (val <= 90) return 50 + Math.round(((val - 30) / 60) * 7) * 50; // Scale to 400 at 90%
        if (val < 100) return 400; // Plateau 90-99%
        return 800; // Jump to 800 at 100%
    };
    const handleInput = (e) => {
        const val = parseInt(e.target.value);
        setSliderValue(val);
        const count = calculateChildren(val);
        if (count !== childCount && navigator.vibrate) {
            if (count === 400 || count === 800) navigator.vibrate(200); else if (count % 10 === 0) navigator.vibrate(40); else navigator.vibrate(10);
        }
        setChildCount(count);
        if (onImpactChange) onImpactChange(count);
        setIsLegend(count === 400 || count === 800);
        setShowPhrase(false);
        setIsDragging(true);
        if (Math.random() > 0.6) { const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; const type = Math.random() > 0.7 ? 'plane' : 'heart'; setParticles(p => [...p, { id, x: 50 + (Math.random() - 0.5) * 30, type }]); }
    };
    const handleRelease = () => {
        setIsDragging(false);
        setShowPhrase(true);
        const specificOptions = IMPACT_PHRASES[childCount];
        if (specificOptions) setPhrase(specificOptions[Math.floor(Math.random() * specificOptions.length)]);
        else setPhrase("Estás cambiando su destino para siempre.");
    };
    const removeParticle = (id) => setParticles(prev => prev.filter(p => p.id !== id));
    const cost = childCount * 40;

    const cardBase = "relative w-full max-w-[380px] rounded-[2.5rem] p-8 border backdrop-blur-md transition-all duration-500 ease-out select-none flex flex-col items-center shadow-2xl";
    const cardStyle = isLegend
        ? `${cardBase} bg-slate-900 shadow-[0_30px_60px_-12px_rgba(234,179,8,0.5)] border-yellow-500/30`
        : `${cardBase} bg-white shadow-[0_20px_40px_-10px_rgba(168,85,247,0.15)] border-white/80`;
    const textMain = isLegend ? "text-yellow-400" : "text-slate-800";
    const textSub = isLegend ? "text-yellow-200/50" : "text-slate-400";
    const heartColor = isLegend ? "text-yellow-400" : "text-fuchsia-500";

    return (
        <div className={cardStyle}>
            {/* Header */}
            <div className="relative w-full flex flex-col items-center justify-center mt-2 mb-6 h-32">
                {particles.map(p => <Particle key={p.id} {...p} onComplete={removeParticle} />)}
                <div className="mb-3 transition-transform duration-200 scale-100">
                    {isLegend ? (<School size={56} strokeWidth={1.5} className="text-yellow-400 animate-bounce" />) : (<Heart size={56} weight="fill" className={`${heartColor} fill-current transition-all duration-300 drop-shadow-md ${isDragging ? 'animate-pulse' : ''}`} />)}
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-baseline justify-center gap-2.5 transition-all duration-300 scale-100">
                        <span className={`text-6xl font-black tracking-tighter leading-none ${textMain}`}>{childCount}</span>
                        <span className={`text-base font-bold uppercase tracking-widest translate-y-[-4px] ${textSub}`}>{childCount === 1 ? 'Niño' : 'Niños'}</span>
                    </div>
                    {isLegend && (
                        <div className="mt-2 px-3 py-1 bg-yellow-400/10 border border-yellow-400/50 rounded-full flex items-center gap-2 animate-fade-in-up">
                            <School size={14} className="text-yellow-400" />
                            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">
                                {childCount === 800 ? 'x2 Escuelas' : 'x1 Escuela'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Phrase (Moved Above Slider) */}
            <div className="h-12 flex items-center justify-center px-4 mb-2">
                <p className={`font-bold text-sm leading-tight text-center transition-all duration-300 ${showPhrase ? 'opacity-100 scale-100 translate-y-0 animate-in zoom-in fade-in slide-in-from-bottom-2' : 'opacity-0 scale-95 translate-y-2'} ${textMain}`}>
                    {phrase}
                </p>
            </div>

            {/* Slider Optimized */}
            <div className="w-full relative px-2 mb-8 group pt-4 touch-none" ref={sliderRef}>
                <div className={`flex justify-between mb-8 text-[10px] font-bold uppercase tracking-widest px-1 transition-colors duration-300 ${isLegend ? 'text-yellow-500/50' : 'text-slate-400'}`}>
                    <span>1 Pasajero</span><span>2 Escuelas</span>
                </div>

                {/* Track Background */}
                <div className="relative w-full h-8 bg-slate-100 rounded-full shadow-inner overflow-hidden ring-1 ring-black/5">
                    {/* Progress Bar (GPU Accelerated) */}
                    <div
                        className={`absolute top-0 left-0 h-full origin-left will-change-transform ${isLegend ? 'bg-gradient-to-r from-yellow-300 to-amber-500' : 'bg-gradient-to-r from-cyan-400 to-fuchsia-500'}`}
                        style={{
                            width: '100%',
                            transform: `scaleX(${childCount === 800 ? 1 : Math.max(sliderValue, 6) / 100})`,
                            transformOrigin: 'left',
                            transition: isDragging ? 'none' : 'transform 0.1s linear'
                        }}
                    ></div>
                </div>

                {/* Invisible Touch Area (Hit Area Optimized) */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderValue}
                    onInput={handleInput}
                    onChange={handleInput}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={handleRelease}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={handleRelease}
                    className={`absolute inset-0 w-full h-full opacity-0 z-30 top-4 h-20 cursor-grab active:cursor-grabbing`}
                />

                {/* Thumb (GPU Accelerated) */}
                <div
                    className="absolute top-[5.1rem] w-12 h-12 bg-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center pointer-events-none z-20 border-4 border-white ring-1 ring-slate-100 will-change-transform"
                    style={{
                        left: 0,
                        transform: `translate3d(${thumbPosition}px, -50%, 0)`,
                        transition: isDragging ? 'none' : 'transform 0.1s linear'
                    }}
                >
                    {isLegend ? <Trophy size={20} className="text-amber-500 fill-current" /> : <Plane size={20} className="text-cyan-600 -rotate-45" />}
                </div>
            </div>

            {/* Footer */}
            <div className="w-full text-center space-y-6">
                {!isLegend && (
                    <div className="inline-flex items-center justify-center space-x-2 bg-slate-100/80 py-2.5 px-6 rounded-xl text-sm text-slate-400">
                        <span>$40</span><span className="text-xs text-slate-300">✕</span><span className="font-semibold text-slate-500">{childCount}</span><span className="text-xs text-slate-300">=</span><strong className="text-slate-700">${cost.toLocaleString()}</strong>
                    </div>
                )}
                <button
                    onClick={() => onDonate(childCount, cost)}
                    className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl shadow-fuchsia-200 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 group ${isLegend ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white animate-pulse shadow-amber-200' : 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white hover:scale-[1.02]'}`}
                >
                    {isLegend ? (<><span>PATROCINAR ESCUELA</span> <Sparkles className="animate-spin-slow" /></>) : (<><span>Apadrinar {childCount} {childCount === 1 ? 'niño' : 'niños'}</span> <Heart className="w-5 h-5 group-hover:scale-110 transition-transform fill-white/20" /></>)}
                </button>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 opacity-60">Pago 100% Seguro • Fly High Edu</p>
            </div>
        </div>
    );
};

// --- COMPONENTE MAESTRO: SECCIÓN COMPLETA ---
export default function FlyHighDonationSection() {
    const [modalState, setModalState] = useState({ isOpen: false, childCount: 0, amount: 0 });
    const [impactCount, setImpactCount] = useState(1);
    const [isPillAnimating, setIsPillAnimating] = useState(false);

    const isLegendary = impactCount === 400 || impactCount === 800;

    useEffect(() => {
        setIsPillAnimating(true);
        const timer = setTimeout(() => setIsPillAnimating(false), 150);
        return () => clearTimeout(timer);
    }, [impactCount]);

    const openModal = (childCount, amount) => {
        setModalState({ isOpen: true, childCount, amount });
    };

    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <section id="impact-engine" className={`relative w-full min-h-screen flex flex-col items-center justify-center py-20 px-4 overflow-hidden transition-colors duration-1000 ${isLegendary ? 'bg-[#050A18]' : 'bg-slate-50'}`}>

            {/* FONDO AMBIENTAL */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isLegendary ? 'opacity-0' : 'opacity-100'} bg-gradient-to-b from-sky-200 to-slate-50 pointer-events-none`}></div>

            {/* FONDO LEGENDARIO (Glow Dorado) */}
            <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isLegendary ? 'opacity-100' : 'opacity-0'} bg-[radial-gradient(circle_at_center_bottom,_var(--tw-gradient-stops))] from-amber-500/20 via-[#050A18] to-[#050A18] pointer-events-none`}></div>

            {/* ENCABEZADO NARRATIVO */}
            <div className="relative z-10 w-full max-w-2xl text-center mb-16 space-y-6">
                <div className="flex justify-center animate-fade-in-up">
                    <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border shadow-sm transition-all duration-500 ${isPillAnimating ? 'scale-125 bg-yellow-100 border-yellow-400 shadow-yellow-200/50 shadow-lg' : isLegendary ? 'bg-white/10 border-white/20 backdrop-blur-md shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-white/40 backdrop-blur-sm border-white/60'}`}>
                        <Target size={16} className={`transition-colors duration-500 ${isPillAnimating ? 'text-yellow-600' : isLegendary ? 'text-yellow-400' : 'text-cyan-600'}`} />
                        <span className={`text-xs font-bold tracking-widest uppercase transition-colors duration-500 ${isPillAnimating ? 'text-yellow-700' : isLegendary ? 'text-yellow-100' : 'text-cyan-800'}`}>
                            Tu Impacto: {impactCount} {impactCount === 1 ? 'Niño' : 'Niños'}
                        </span>
                    </div>
                </div>
                <h2 className={`text-4xl md:text-5xl font-black tracking-tight leading-tight transition-all duration-700 ${isLegendary ? 'text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]' : 'text-slate-800'}`}>
                    Regálales un <br className="md:hidden" /> <span className={`text-transparent bg-clip-text bg-gradient-to-r transition-all duration-700 ${isLegendary ? 'from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'from-cyan-600 to-fuchsia-600'}`}>nuevo horizonte.</span>
                </h2>
                <div className="max-w-xl mx-auto px-4">
                    <p className={`text-lg md:text-xl leading-relaxed font-medium transition-colors duration-700 ${isLegendary ? 'text-slate-300' : 'text-slate-600'}`}>
                        En Uruapan existen exactamente <span className={`font-bold transition-colors duration-700 ${isLegendary ? 'text-white' : 'text-slate-800'}`}>30,000 niños en nivel primaria</span>, y nuestra meta es absoluta: <span className={`font-bold transition-colors duration-700 ${isLegendary ? 'text-yellow-400' : 'text-slate-800'}`}>que vuelen los 30,000</span>.
                    </p>
                    <p className={`text-base md:text-lg mt-4 leading-relaxed transition-colors duration-700 ${isLegendary ? 'text-slate-400' : 'text-slate-500'}`}>
                        No queremos que sea un privilegio de pocos, sino una realidad para todos. Hoy tienes el poder de acercarnos a esa totalidad; elige a cuántos de ellos llevarás al cielo.
                    </p>
                </div>
            </div>

            {/* MOTOR DE IMPACTO */}
            <div className="relative z-10 animate-fade-in-up delay-150 w-full max-w-[380px]">
                <ImpactEngine onDonate={openModal} onImpactChange={setImpactCount} />
            </div>

            {/* MODAL DE PAGO (SIMULADO) */}
            <PaymentModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                childCount={modalState.childCount}
                amount={modalState.amount}
            />

        </section>
    );
}
