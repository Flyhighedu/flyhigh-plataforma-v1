"use client";
import React, { useState, useEffect } from 'react';
import {
    Plane,
    School,
    MapPin,
    Calculator,
    ShieldCheck,
    Camera,
    Download,
    ChevronRight,
    Users,
    CheckCircle2,
    ArrowRight,
    Info,
    FileText,
    Printer,
    Heart,
    Coins,
    Sparkles,
    Zap,
    Star,
    Users2,
    Quote,
    Plus,
    Minus,
    Mail,
    Phone,
    User,
    Key,
    ClipboardCheck,
    Globe,
    Clock,
    Bus,
    Shield,
    UploadCloud,
    FileWarning,
    LogIn
} from 'lucide-react';

/**
 * App: Fly High Uruapan 2026 - Versión Definitiva con Copys Completos
 * - Flujo: Bienvenida -> Sector -> Modalidad -> Configuración/Estudio -> Registro -> Dashboard.
 * - Incluye calculadora de aportación y cuestionario social detallado.
 */
const EscuelasCalculator = () => {
    const [step, setStep] = useState('welcome');
    const [loading, setLoading] = useState(false);
    const [showInspiringModal, setShowInspiringModal] = useState(false);

    // Estados de la Institución
    const [schoolName, setSchoolName] = useState("");
    const [cct, setCct] = useState("");
    const [enrollment, setEnrollment] = useState(250);
    const [schoolType, setSchoolType] = useState(null); // 'private' | 'public'
    const [publicMode, setPublicMode] = useState(null); // 'hybrid' | 'full'
    const [contribution, setContribution] = useState(20);

    // Estados del Cuestionario de Beca Total
    const [socialContext, setSocialContext] = useState('');

    // Smart FAB State
    const [isHero, setIsHero] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => {
            setIsHero(window.scrollY < 100);
        };
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    const baseCost = 65;
    const contributionOptions = [10, 15, 20, 25, 30, 35, 40];

    const nextStep = (target) => {
        setLoading(true);
        setTimeout(() => {
            setStep(target);
            setLoading(false);
        }, 600);
    };

    const handleSectorChoice = (type) => {
        setSchoolType(type);
        if (type === 'private') {
            nextStep('setup_private');
        } else {
            nextStep('public_choice');
        }
    };

    const handleModalityChoice = (mode) => {
        setPublicMode(mode);
        if (mode === 'hybrid') {
            setShowInspiringModal(true);
            nextStep('setup_hybrid');
        } else {
            nextStep('scholarship_form');
        }
    };

    const adjustContribution = (amount) => {
        const newValue = contribution + amount;
        if (newValue >= 10 && newValue <= 40) {
            setContribution(newValue);
        }
    };

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20 overflow-x-hidden text-balance leading-none">

            {loading && (
                <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-black text-indigo-900 animate-pulse tracking-widest uppercase text-[10px]">Actualizando plataforma...</p>
                    </div>
                </div>
            )}

            {/* MODAL INSPIRADOR: ESFUERZO COMPARTIDO */}
            {showInspiringModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 sm:px-6 animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowInspiringModal(false)}></div>
                    <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="h-48 bg-gradient-to-br from-fuchsia-600 to-indigo-700 relative flex items-center justify-center">
                            <div className="absolute inset-0 opacity-20">
                                <Plane className="absolute -top-10 -right-10 text-white w-64 h-64 -rotate-45 opacity-20" />
                            </div>
                            <div className="bg-white/20 backdrop-blur-md p-4 rounded-[2rem] border border-white/30 shadow-xl">
                                <Quote size={40} className="text-white fill-white/20" />
                            </div>
                        </div>
                        <div className="p-10 space-y-6 text-center leading-none text-balance">
                            <div className="space-y-1">
                                <p className="text-[11px] font-black text-fuchsia-500 uppercase tracking-[0.4em]">Misión Solidaria</p>
                                <h3 className="text-2xl font-black text-slate-900 leading-none uppercase tracking-tighter">Su criterio es la guía</h3>
                            </div>
                            <p className="text-sm text-slate-600 font-medium leading-relaxed italic text-center">
                                "El recurso de esta campaña es limitado y queremos que llegue a todos. Como líder de su comunidad, le pedimos definir una aportación justa y consciente; su honestidad es la pieza clave para que este patrocinio alcance para todos los niños de Uruapan."
                            </p>
                            <button
                                onClick={() => setShowInspiringModal(false)}
                                className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-lg shadow-xl uppercase tracking-widest active:scale-95 transition-all"
                            >
                                Comprendo y Acepto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

                {/* STEP 0: WELCOME */}
                {step === 'welcome' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 leading-none text-center">
                        <div className="space-y-4 leading-none">
                            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 leading-none">
                                <Sparkles size={12} /> Fly High Uruapan 2026
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-[1.1] tracking-tight uppercase">
                                Bienvenidos a la <br />
                                <span className="text-blue-600 font-black">Expedición Escolar</span>
                            </h1>
                            <p className="text-slate-500 text-base sm:text-lg font-medium italic text-balance">
                                Bienvenido, Director. Prepare a su escuadrón para una aventura tecnológica que transformará su visión del futuro.
                            </p>
                        </div>
                        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 space-y-6 leading-none">
                            <button onClick={() => nextStep('sector_choice')} className="group w-full bg-blue-600 text-white py-7 rounded-2xl font-black text-lg sm:text-xl flex items-center justify-center gap-4 shadow-xl shadow-blue-600/30 active:scale-[0.98] transition-all uppercase tracking-widest leading-none">
                                Registrar Escuela <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <div className="grid grid-cols-2 gap-3 text-center leading-none">
                                <div className="p-4 bg-slate-50 rounded-[1.25rem] text-center space-y-1 border border-slate-100 leading-none">
                                    <Calculator size={20} className="mx-auto text-blue-500" />
                                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">Planificación</p>
                                    <p className="text-[9px] text-slate-400 font-medium leading-none">Optimización de Recursos</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-[1.25rem] text-center space-y-1 border border-slate-100 leading-none">
                                    <ShieldCheck size={20} className="mx-auto text-blue-500" />
                                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">Garantía</p>
                                    <p className="text-[9px] text-slate-400 font-medium leading-none">Vuelo Seguro</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 1: SECTOR CHOICE */}
                {step === 'sector_choice' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-6 duration-500 text-left leading-none text-balance">
                        <button onClick={() => setStep('welcome')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-blue-600 leading-none transition-colors"><ChevronRight className="rotate-180" size={14} /> Volver al Inicio</button>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-none uppercase text-slate-900">Tipo de Institución</h2>
                            <p className="text-sm text-slate-500 font-medium leading-none">Seleccione el sector correspondiente a su escuela.</p>
                        </div>
                        <div className="grid gap-6">
                            {/* PRIVADA */}
                            <div role="button" onClick={() => handleSectorChoice('private')} className="cursor-pointer group relative overflow-hidden p-1 bg-gradient-to-br from-blue-400 via-blue-600 to-indigo-700 rounded-[3.5rem] shadow-xl active:scale-[0.98] transition-all leading-none">
                                <div className="bg-white rounded-[3.4rem] p-8 sm:p-10 relative overflow-hidden h-full flex flex-col items-start text-left border-b-[12px] border-slate-200 group-hover:border-blue-700 transition-colors">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform rotate-12 group-hover:scale-110 transition-transform leading-none"><Globe size={240} strokeWidth={1} /></div>
                                    <div className="flex justify-between items-start w-full mb-8 z-10 leading-none">
                                        <div className="w-16 h-16 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl leading-none"><School size={32} /></div>
                                        <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-5 py-2.5 rounded-full uppercase border border-blue-100 shadow-sm leading-none">Modelo Innovación</span>
                                    </div>
                                    <div className="z-10 flex-1 leading-none">
                                        <h3 className="font-black text-3xl text-slate-900 uppercase tracking-tighter mb-4 text-left leading-none">Escuela Privada</h3>
                                        <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed italic opacity-80 leading-none text-left">Excelencia educativa de vanguardia. Genere un impacto real transformando la visión del futuro de sus alumnos mediante la tecnología de drones.</p>
                                    </div>
                                    <div className="mt-8 flex items-center gap-3 text-blue-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all leading-none">Seleccionar sector <ArrowRight size={14} /></div>
                                </div>
                            </div>
                            {/* PÚBLICA */}
                            <div role="button" onClick={() => handleSectorChoice('public')} className="cursor-pointer group relative overflow-hidden p-1 bg-gradient-to-br from-fuchsia-400 via-fuchsia-600 to-pink-700 rounded-[3.5rem] shadow-xl active:scale-[0.98] transition-all leading-none">
                                <div className="bg-white rounded-[3.4rem] p-8 sm:p-10 relative overflow-hidden h-full flex flex-col items-start text-left border-b-[12px] border-slate-200 group-hover:border-fuchsia-600 transition-colors">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform -rotate-12 group-hover:scale-110 transition-transform leading-none"><Users2 size={240} strokeWidth={1} /></div>
                                    <div className="flex justify-between items-start w-full mb-8 z-10 leading-none">
                                        <div className="w-16 h-16 bg-fuchsia-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-fuchsia-600/40 group-hover:rotate-6 transition-transform leading-none text-balance"><Users size={32} /></div>
                                        <span className="bg-fuchsia-50 text-fuchsia-700 text-[10px] font-black px-5 py-2.5 rounded-full uppercase border border-fuchsia-100 shadow-sm leading-none text-balance text-left">Modelo Social</span>
                                    </div>
                                    <div className="z-10 flex-1 leading-none text-left text-balance">
                                        <h3 className="font-black text-3xl fuchsia-700 uppercase tracking-tighter mb-4 leading-none text-left text-balance">Escuela Pública</h3>
                                        <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed italic opacity-80 leading-none text-left text-balance">Diseñado para acceder a programas de patrocinio y lograr que todos los niños de Uruapan tengan la oportunidad de volar.</p>
                                    </div>
                                    <div className="mt-8 flex items-center gap-3 text-fuchsia-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all leading-none text-balance">Seleccionar sector <ArrowRight size={14} /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP: PUBLIC MODALITY CHOICE */}
                {step === 'public_choice' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-6 duration-500 text-left text-balance leading-none">
                        <button onClick={() => setStep('sector_choice')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-fuchsia-600 leading-none transition-colors"><ChevronRight className="rotate-180" size={14} /> Volver al Sector</button>
                        <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white space-y-4 shadow-2xl border-l-[15px] border-fuchsia-600 relative overflow-hidden leading-none text-left">
                            <div className="absolute top-[-5%] right-[-5%] opacity-10 leading-none text-left"><Heart size={180} fill="currentColor" className="text-fuchsia-400" /></div>
                            <h2 className="text-3xl sm:text-4xl font-black leading-[1.1] tracking-tight relative z-10 uppercase text-balance leading-none">Misión Solidaria</h2>
                            <p className="text-slate-400 text-base font-medium relative z-10 italic leading-relaxed text-balance">Nuestro objetivo es que los 30,000 niños de Uruapan vivan la tecnología. Su honestidad nos ayuda a priorizar los recursos adecuadamente.</p>
                        </div>

                        <div className="space-y-6 leading-none">
                            <h2 className="text-xl font-black text-slate-800 ml-4 uppercase tracking-tight leading-none text-balance">Modalidad de Apoyo</h2>
                            <div className="grid gap-6 text-balance text-left text-balance">

                                {/* ESFUERZO COMPARTIDO */}
                                <div
                                    role="button"
                                    onClick={() => handleModalityChoice('hybrid')}
                                    className="cursor-pointer group relative overflow-hidden p-1 bg-gradient-to-br from-fuchsia-400 to-pink-600 rounded-[3rem] shadow-lg active:scale-[0.98] transition-all leading-none"
                                >
                                    <div className="bg-white rounded-[2.9rem] p-8 relative overflow-hidden h-full flex items-center gap-6 border-b-[8px] border-slate-100 group-hover:border-fuchsia-600 transition-colors leading-none text-balance">
                                        <div className="w-16 h-16 bg-fuchsia-600 text-white rounded-2xl flex items-center justify-center shrink-0 z-10 leading-none shadow-xl shadow-fuchsia-100"><Coins size={32} /></div>
                                        <div className="flex-1 z-10 text-left">
                                            <h4 className="font-black text-xl text-slate-900 leading-none mb-2 uppercase tracking-tight leading-none text-left">Esfuerzo Compartido</h4>
                                            <p className="text-[11px] text-slate-500 font-bold leading-snug">
                                                Los alumnos hacen una aportación simbólica definida por la dirección. <span className="text-fuchsia-600 font-black leading-none italic">Usted decide cuánto.</span>
                                            </p>
                                        </div>
                                        <ChevronRight size={24} className="text-slate-200 group-hover:text-fuchsia-600 transition-all transform group-hover:translate-x-1 leading-none" />
                                    </div>
                                </div>

                                {/* BECA TOTAL */}
                                <div
                                    role="button"
                                    onClick={() => handleModalityChoice('full')}
                                    className="cursor-pointer group relative overflow-hidden p-1 bg-gradient-to-br from-violet-500 to-indigo-800 rounded-[3rem] shadow-lg active:scale-[0.98] transition-all leading-none"
                                >
                                    <div className="bg-white rounded-[2.9rem] p-8 relative overflow-hidden h-full flex items-center gap-6 border-b-[8px] border-slate-100 group-hover:border-violet-600 transition-colors leading-none text-balance">
                                        <div className="w-16 h-16 bg-violet-600 text-white rounded-2xl flex items-center justify-center shrink-0 z-10 leading-none shadow-xl shadow-violet-100"><Heart size={32} className="text-red-500 fill-red-500 leading-none" /></div>
                                        <div className="flex-1 z-10 text-left text-balance leading-tight leading-none">
                                            <h4 className="font-black text-xl text-slate-900 leading-none mb-2 uppercase tracking-tight leading-none text-left">Beca Total (100%)</h4>
                                            <p className="text-[11px] text-slate-500 font-bold leading-snug uppercase tracking-tight italic leading-none">Vuelo cubierto al 100% mediante patrocinio empresarial <span className="font-black text-indigo-600 leading-none"> (Sujeto a estudio social).</span></p>
                                        </div>
                                        <ChevronRight size={24} className="text-slate-200 group-hover:text-violet-600 transition-all transform group-hover:translate-x-1 leading-none" />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

                {/* STEP: SETUP HYBRID (CALCULADORA DE APORTACIÓN) */}
                {step === 'setup_hybrid' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-6 duration-500 text-left text-balance leading-none">
                        <button onClick={() => setStep('public_choice')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-fuchsia-600 leading-none transition-colors"><ChevronRight className="rotate-180" size={14} /> Volver</button>

                        <div className="text-center space-y-4">
                            <h2 className="text-2xl sm:text-3xl font-black text-fuchsia-600 uppercase italic leading-none">Aportación Escolar</h2>
                            <p className="text-sm text-slate-500 font-medium italic text-balance px-6">Seleccione el monto que aportará cada alumno para complementar el patrocinio de su vuelo.</p>
                        </div>

                        <div className="bg-white border border-slate-100 p-8 sm:p-10 rounded-[3.5rem] shadow-2xl space-y-10 leading-none text-balance text-center">
                            <div className="flex items-center justify-center gap-6 sm:gap-10 leading-none text-balance">
                                <button onClick={() => adjustContribution(-5)} className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-fuchsia-500 hover:text-white transition-all border border-slate-100 active:scale-90 leading-none shadow-sm"><Minus size={24} /></button>
                                <div className="relative leading-none">
                                    <p className="text-[6rem] sm:text-[8rem] font-black text-slate-900 tracking-tighter leading-[0.8] drop-shadow-sm">${contribution}</p>
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-4 leading-none">pesos mxn</p>
                                </div>
                                <button onClick={() => adjustContribution(5)} className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-fuchsia-500 hover:text-white transition-all border border-slate-100 active:scale-90 leading-none shadow-sm"><Plus size={24} /></button>
                            </div>

                            <div className="flex flex-wrap justify-center gap-3 pt-4 text-balance">
                                {contributionOptions.map(val => (
                                    <button
                                        key={val}
                                        onClick={() => setContribution(val)}
                                        className={`px-6 py-4 rounded-full text-sm font-black transition-all border-2 leading-none ${contribution === val ? 'bg-fuchsia-600 border-fuchsia-600 text-white scale-110 shadow-lg shadow-fuchsia-100 border-none' : 'bg-white border-slate-200 text-slate-500 hover:border-fuchsia-200'}`}
                                    >
                                        ${val}
                                    </button>
                                ))}
                            </div>

                            <div className="py-6 border-t border-slate-50 text-center leading-none">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                                    Los patrocinadores cubrirán <span className="text-slate-900 font-black leading-none">${baseCost - contribution}</span> por cada niño
                                </p>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <div className="flex justify-between items-center text-left leading-none">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Matrícula Estimada</p>
                                    <span className="text-xl font-black text-slate-900 leading-none">{enrollment} Niños</span>
                                </div>
                                <input type="range" min="30" max="500" step="10" value={enrollment} onChange={(e) => setEnrollment(parseInt(e.target.value))} className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-fuchsia-600 shadow-inner" />
                            </div>

                            <button onClick={() => nextStep('registration_final')} className="w-full bg-fuchsia-600 text-white py-8 rounded-[2rem] font-black text-xl shadow-2xl active:scale-[0.98] transition-all uppercase tracking-widest border-b-8 border-fuchsia-800 leading-none">Confirmar Aportación</button>
                        </div>
                    </div>
                )}

                {/* STEP: SETUP PRIVATE */}
                {step === 'setup_private' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-6 duration-500 text-left text-balance leading-none">
                        <button onClick={() => setStep('sector_choice')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-blue-600 leading-none transition-colors"><ChevronRight className="rotate-180" size={14} /> Volver</button>

                        <div className="text-center space-y-4">
                            <h2 className="text-2xl sm:text-3xl font-black text-blue-600 uppercase italic leading-none">Garantía de Vuelo</h2>
                            <p className="text-sm text-slate-500 font-medium italic text-balance px-6 text-center">Establezca la matrícula de su escuadrón para asegurar la disponibilidad técnica de la expedición.</p>
                        </div>

                        <div className="bg-blue-900 text-white p-10 rounded-[3.5rem] space-y-10 shadow-2xl border-t-8 border-blue-400 leading-none">
                            <div className="space-y-6 leading-none text-balance">
                                <div className="flex justify-between items-end leading-none text-balance">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 leading-none">Alumnos proyectados</label>
                                    <span className="text-5xl font-black text-white leading-none">{enrollment}</span>
                                </div>
                                <input type="range" min="50" max="500" step="10" value={enrollment} onChange={(e) => setEnrollment(parseInt(e.target.value))} className="w-full h-3 bg-blue-800 rounded-full appearance-none cursor-pointer accent-white shadow-inner" />
                            </div>
                            <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-10 leading-none text-left">
                                <div className="space-y-2 leading-none">
                                    <p className="text-[10px] font-black uppercase opacity-50 tracking-widest leading-none">Garantía</p>
                                    <p className="text-3xl font-black text-white leading-none">$5,000</p>
                                </div>
                                <div className="text-right space-y-2 leading-none">
                                    <p className="text-[10px] font-black uppercase opacity-50 tracking-widest leading-none">Expedición</p>
                                    <p className="text-xl font-black text-blue-200 leading-none text-balance">Premium V.I.P.</p>
                                </div>
                            </div>
                            <button onClick={() => nextStep('registration_final')} className="w-full bg-white text-blue-900 py-8 rounded-[2rem] font-black text-xl shadow-xl uppercase tracking-widest active:scale-95 transition-all border-b-8 border-slate-200 leading-none">Continuar al Registro</button>
                        </div>
                    </div>
                )}

                {/* STEP: SCHOLARSHIP FORM (ESTUDIO SOCIAL) */}
                {step === 'scholarship_form' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-500 text-left leading-none text-balance">
                        <button onClick={() => setStep('public_choice')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 leading-none transition-colors text-balance"><ChevronRight className="rotate-180" size={14} /> Volver</button>

                        <div className="space-y-2 leading-none text-balance text-left">
                            <h2 className="text-3xl font-black text-violet-700 tracking-tight leading-none uppercase italic text-left leading-none text-balance">Estudio Social</h2>
                            <p className="text-lg text-slate-500 font-bold italic leading-none text-left text-balance">La Beca Total del 100% requiere de una validación de impacto institucional.</p>
                        </div>

                        <div className="bg-white border-2 border-slate-100 p-10 rounded-[3.5rem] space-y-12 shadow-2xl leading-none text-balance text-left">
                            <div className="space-y-6 leading-none text-balance text-left">
                                <p className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 leading-none"><Zap size={22} className="text-violet-500" /> 1. Situación Institucional</p>
                                <div className="grid grid-cols-1 gap-3 leading-none">
                                    {[
                                        { id: 'margen', label: 'Escuela en zona de alta marginación' },
                                        { id: 'familia', label: 'Familias con retos económicos críticos' },
                                        { id: 'apoyo', label: 'Institución dedicada al apoyo social' },
                                        { id: 'infra', label: 'Infraestructura con necesidades urgentes' }
                                    ].map(val => (
                                        <button key={val.id} onClick={() => setSocialContext(val.id)} className={`p-6 border-2 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all shadow-sm text-left leading-tight ${socialContext === val.id ? 'bg-violet-600 border-violet-600 text-white scale-[1.01]' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-violet-200'}`}>{val.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6 leading-none text-balance text-left text-balance">
                                <p className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 text-slate-400 leading-none"><Camera size={22} className="text-violet-500" /> 2. Evidencias de la Escuela</p>
                                <p className="text-[10px] text-slate-400 font-bold italic leading-none -mt-3 text-left">Por favor, cargue una imagen clara de cada zona solicitada para validar el recurso social.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-balance leading-none">
                                    <button className="group h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-white transition-all border-violet-100 shadow-inner p-4 text-center leading-none text-balance">
                                        <Camera size={32} className="text-violet-300 group-hover:text-violet-500 transition-colors" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-violet-600 leading-none">Sanitarios</span>
                                    </button>
                                    <button className="group h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-white transition-all border-violet-100 shadow-inner p-4 text-center leading-none text-balance text-balance">
                                        <Camera size={32} className="text-violet-300 group-hover:text-violet-500 transition-colors" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-violet-600 leading-none">Aulas</span>
                                    </button>
                                    <button className="group h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-white transition-all border-violet-100 shadow-inner p-4 text-center leading-none text-balance text-balance text-balance">
                                        <Camera size={32} className="text-violet-300 group-hover:text-violet-500 transition-colors" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-violet-600 leading-none text-balance text-balance text-center">Fachada</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6 leading-none text-balance text-left text-balance">
                                <p className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 leading-none"><Quote size={22} className="text-violet-500" /> 3. Situación de sus alumnos</p>
                                <textarea placeholder="Cuéntenos brevemente por qué sus alumnos necesitan recibir este patrocinio tecnológico el día de hoy..." className="w-full bg-slate-50 border-2 border-slate-100 p-8 rounded-[2.5rem] text-sm font-bold outline-none focus:border-violet-500 transition-all min-h-[200px] leading-relaxed shadow-inner" />
                            </div>

                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center text-left leading-none">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Matrícula Escolar</p>
                                    <span className="text-xl font-black text-slate-900 leading-none">{enrollment} Niños</span>
                                </div>
                                <input type="range" min="30" max="500" step="10" value={enrollment} onChange={(e) => setEnrollment(parseInt(e.target.value))} className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-violet-600 shadow-inner" />
                            </div>

                            <button onClick={() => nextStep('registration_final')} className="w-full bg-violet-600 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl active:scale-[0.98] transition-all uppercase tracking-widest border-b-8 border-violet-800 text-balance leading-none">Continuar al Registro</button>
                        </div>
                    </div>
                )}

                {/* STEP: REGISTRATION FINAL */}
                {step === 'registration_final' && (
                    <div className="space-y-8 animate-in slide-in-from-right-6 duration-500 text-left text-balance leading-none text-balance text-balance">
                        <button onClick={() => setStep('welcome')} className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-blue-600 leading-none transition-colors"><ChevronRight className="rotate-180" size={14} /> Volver al Inicio</button>
                        <div className="space-y-4 leading-none text-balance text-balance">
                            <div className={`p-8 rounded-[2.5rem] text-white space-y-4 shadow-xl border-b-8 leading-none ${publicMode === 'full' ? 'bg-violet-600 border-violet-800' : 'bg-indigo-600 border-indigo-800'}`}>
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center leading-none shadow-sm border border-white/10 text-balance leading-none"><ClipboardCheck size={24} /></div>
                                <div className="space-y-1 text-balance leading-none"><h2 className="text-2xl font-black uppercase leading-none">Ficha de Registro</h2><p className="text-[11px] font-bold text-blue-100 italic leading-none">Complete los datos oficiales para la planeación logística.</p></div>
                            </div>

                            <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 space-y-10 shadow-2xl shadow-blue-900/5 leading-none text-balance text-left">
                                <div className="space-y-6 leading-none text-balance text-left text-balance">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 border-l-4 border-blue-50 pl-3 leading-none">Identidad de la Institución</p>
                                    <div className="grid gap-4 leading-none">
                                        <input type="text" placeholder="Nombre completo de la Escuela" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-2xl font-bold text-sm leading-none text-balance outline-none focus:border-blue-500 transition-colors" />
                                        <input type="text" placeholder="Clave CCT (Obligatorio)" value={cct} onChange={(e) => setCct(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-2xl font-black text-sm uppercase leading-none outline-none focus:border-blue-500 text-balance transition-colors" />
                                    </div>
                                </div>

                                {schoolType === 'public' && (
                                    <div className="space-y-5 p-6 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 leading-none text-left text-balance text-balance">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none text-balance flex items-center gap-2"><Shield size={14} className="text-indigo-600" /> Garantía Social de Vuelo</p>
                                        <div className="space-y-4 leading-none text-balance">
                                            <p className="text-[11px] font-bold text-slate-500 leading-snug text-balance">Al no existir un pago anticipado, se requiere la <span className="text-indigo-600 font-black uppercase tracking-tight">Carta Compromiso</span> firmada por el director y el comité de padres para confirmar la fecha en calendario.</p>
                                            <div className="flex gap-3 leading-none">
                                                <button className="flex-1 bg-white border border-indigo-200 text-indigo-600 p-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-sm leading-none transition-all hover:bg-indigo-50"><Download size={14} /> Descargar</button>
                                                <button className="flex-1 bg-indigo-600 text-white p-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 leading-none transition-all hover:bg-indigo-700">Subir Firmada</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6 leading-none text-balance text-left text-balance">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 border-l-4 border-blue-50 pl-3 leading-none">Responsable del Escuadrón</p>
                                    <div className="grid gap-4 text-balance text-left text-balance">
                                        <div className="relative group leading-none text-balance text-left">
                                            <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors leading-none" size={20} />
                                            <input type="text" placeholder="Nombre del Director/a" className="w-full bg-slate-50 border-none p-6 pl-16 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm leading-none" />
                                        </div>
                                        <div className="relative group leading-none text-balance text-left">
                                            <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors leading-none" size={20} />
                                            <input type="tel" placeholder="WhatsApp Directo" className="w-full bg-slate-50 border-none p-6 pl-16 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm leading-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 leading-none text-balance text-left text-balance">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 border-l-4 border-blue-50 pl-3 leading-none">Acceso Administrativo</p>
                                    <div className="relative group leading-none text-balance text-left">
                                        <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors leading-none" size={20} />
                                        <input type="password" placeholder="Mínimo 6 caracteres" className="w-full bg-slate-50 border-none p-6 pl-16 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm leading-none" />
                                    </div>
                                </div>

                                <button onClick={() => nextStep('dashboard')} className="w-full bg-slate-900 text-white py-8 rounded-[2rem] font-black text-xl shadow-xl uppercase tracking-widest active:scale-95 transition-all border-b-8 border-slate-700 leading-none text-balance">Finalizar y Agendar Vuelo</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP: DASHBOARD */}
                {step === 'dashboard' && (
                    <div className="space-y-8 animate-in zoom-in-95 duration-700 text-center text-balance leading-none text-balance text-balance text-balance text-balance">
                        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden space-y-8 leading-none">
                            <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-[0.05] leading-none text-balance text-balance"><Plane size={140} className="sm:w-[180px] sm:h-[180px] -rotate-45 text-blue-600" /></div>
                            <div className="w-24 h-24 bg-green-50 text-green-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner leading-none"><CheckCircle2 size={48} className="text-green-500 leading-none" /></div>
                            <div className="space-y-2 leading-none text-balance text-balance text-balance text-balance">
                                <h2 className="text-3xl font-black tracking-tight uppercase italic leading-none">¡Vuelo Agendado!</h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Escuadrón Fly High Uruapan</p>
                            </div>
                            <div className="bg-slate-50 p-10 rounded-[3rem] flex justify-around text-center border border-slate-100 shadow-inner leading-none text-balance">
                                <div className="space-y-2 leading-none text-balance"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Escuadrón</p><p className="font-black text-3xl text-indigo-600 leading-none">{enrollment} Niños</p></div>
                                <div className="w-px bg-slate-200 mx-4 leading-none" />
                                <div className="space-y-2 text-balance leading-none"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Estatus</p><p className="font-black uppercase text-[11px] tracking-widest px-5 py-3 rounded-full shadow-sm border border-green-100 bg-green-50 text-green-600 leading-none text-balance uppercase">Confirmado</p></div>
                            </div>
                        </div>

                        <div className="space-y-4 text-left leading-none">
                            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.4em] ml-6 leading-none">Siguiente Paso</h3>
                            <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between group hover:border-slate-900 transition-all shadow-sm active:scale-95 leading-none">
                                <div className="flex items-center gap-6 leading-none">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors leading-none"><Printer size={28} /></div>
                                    <div className="space-y-1">
                                        <h4 className="font-black text-lg text-slate-800 uppercase tracking-tight leading-none">Media Kit 2026</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none italic">Imprimibles para maestros y padres</p>
                                    </div>
                                </div>
                                <Download size={24} className="text-slate-300 group-hover:text-slate-900 transition-colors leading-none" />
                            </div>
                        </div>

                        <button onClick={() => setStep('welcome')} className="w-full text-center text-[10px] font-black uppercase text-slate-300 tracking-[0.5em] py-8 leading-none hover:text-slate-500 transition-colors">Cerrar Sesión</button>
                    </div>
                )}

            </main>


            {/* 1. Botón Iniciar Sesión (Solo Hero - Fijo al Centro) */}
            {/* 1. Etiqueta Iniciar Sesión (Solo Hero - Label) */}
            <div
                role="button"
                className={`fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 group cursor-pointer transition-all duration-500 ease-in-out ${isHero
                    ? 'bottom-32 opacity-100 translate-y-0'
                    : 'bottom-24 opacity-0 translate-y-10 pointer-events-none'
                    }`}
            >
                <img src="/img/login icono saludando.gif" alt="Login" className="w-5 h-5 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                <span className="text-white text-[13px] font-medium tracking-wide border-b border-white/30 group-hover:border-white transition-all text-shadow-sm whitespace-nowrap">
                    Ya tengo cuenta. Iniciar Sesión.
                </span>
            </div>

            {/* 2. Botón Registrar Escuela (Smart FAB - Moveable) */}
            <button
                onClick={() => {
                    const el = document.getElementById('calculator-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`fixed z-50 w-64 py-3.5 shadow-2xl shadow-blue-900/20 rounded-full flex items-center justify-center gap-3 border border-b-4 hover:scale-105 active:scale-95 transition-all duration-500 ease-in-out group overflow-hidden ${isHero
                    ? 'bg-white text-blue-600 border-slate-100 bottom-40 right-1/2 translate-x-1/2'
                    : 'bg-blue-600 text-white border-blue-700 bottom-6 right-6 sm:bottom-8 sm:right-8 translate-x-0'
                    }`}
            >
                <span className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${isHero ? 'bg-slate-50' : 'bg-blue-500'}`} />
                <School size={18} className="relative z-10" />
                <span className="relative z-10 flex flex-col items-start text-left leading-tight">
                    <span className="font-black uppercase tracking-widest text-[11px]">Registrar mi escuela</span>
                    <span className="font-medium text-[10px] opacity-80 uppercase tracking-[0.2em] -mt-0.5">(2 min)</span>
                </span>
            </button>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}} />
        </div>
    );
};

export default EscuelasCalculator;
