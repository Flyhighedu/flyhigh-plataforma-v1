"use client";

import React, { useState, useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { Sparkles, Save, ChevronLeft, Brush, User2, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Nuevos Arrays Mapeando a la Colección "Avataaars" (El estándar mundial de Flat Design)
const HAIR_MALE = ['dreads01', 'dreads02', 'frizzle', 'shaggy', 'shaggyMullet', 'shavedSides', 'shortCurly', 'shortFlat', 'shortRound', 'shortWaved', 'sides', 'theCaesar', 'theCaesarAndSidePart', 'straight01', 'fro'];
const HAIR_FEMALE = ['bob', 'bun', 'curly', 'curvy', 'dreads', 'frida', 'fro', 'froBand', 'longButNotTooLong', 'miaWallace', 'straight02', 'straight01', 'straightAndStrand', 'bigHair'];
const HATS = ['hat', 'baseballCap'];

const MOUTH_OPTIONS = ['smile', 'default', 'concerned', 'disbelief', 'eating', 'grimace', 'sad', 'screamOpen', 'serious', 'tongue', 'twinkle'];
const EYES_OPTIONS = ['happy', 'default', 'closed', 'cry', 'eyeRoll', 'side', 'squint', 'surprised', 'wink', 'winkWacky', 'xDizzy'];
const EYEBROWS_OPTIONS = ['defaultNatural', 'default', 'angryNatural', 'flatNatural', 'frownNatural', 'raisedExcitedNatural', 'sadConcernedNatural', 'unibrowNatural', 'upDownNatural'];
const FACIAL_HAIR_OPTIONS = ['beardMedium', 'beardLight', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'];
const GLASSES_OPTIONS = ['kurt', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers', 'eyepatch'];

// Base amarrillo corporativo + Paleta
const SKIN_COLORS = ['f8d25c', 'ffdbb4', 'edb98a', 'd08b5b', 'ae5d29', '614335', 'fd9841'];
const HAIR_COLORS = ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'e8e1e1', 'f59797'];
const HAT_COLORS = ['262e33', '65c9ff', '5199e4', '25557c', 'e6e6e6', '929598', '3c4f5c', 'ff5c5c', 'ffffff'];
const CLOTHES_COLORS = ['ffffff', '262e33', '65c9ff', '5199e4', '25557c', 'e6e6e6', '929598', '3c4f5c', 'ff5c5c', 'f8d25c', '8b5cf6', '10b981', '000000'];

export default function IDStudio() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('eyes');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [showOnboarding, setShowOnboarding] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [config, setConfig] = useState({
        gender: 'neutral',
        top: 'shortFlat', // acts as hair/hat
        hairColor: '2c1b18',
        hatColor: '262e33',
        mouth: 'smile',
        eyes: 'happy',
        eyebrows: 'defaultNatural',
        skinColor: 'f8d25c', // Yellow default
        clothing: 'shirtCrewNeck', // FIXED UNIFORM
        clothesColor: 'ffffff', // FIXED WHITE
        facialHair: 'beardMedium',
        facialHairProbability: 0,
        accessories: 'round',
        accessoriesProbability: 0
    });

    const masterAvatarUri = useMemo(() => {
        const avatar = createAvatar(avataaars, {
            seed: 'master',
            size: 256,
            top: [config.top === 'baseballCap' ? 'shortFlat' : config.top],
            hairColor: [config.hairColor],
            hatColor: [config.hatColor],
            mouth: [config.mouth],
            eyes: [config.eyes],
            eyebrows: [config.eyebrows],
            skinColor: [config.skinColor],
            clothing: [config.clothing],
            clothesColor: [config.clothesColor],
            facialHair: [config.facialHair],
            facialHairColor: [config.hairColor || '2c1b18'],
            facialHairProbability: config.facialHairProbability,
            accessories: [config.accessories],
            accessoriesProbability: config.accessoriesProbability,
            backgroundColor: ['transparent']
        });
        return avatar.toDataUri();
    }, [config]);

    const handleGenderChange = (gender) => {
        if (gender === 'male') {
            setConfig(p => ({ ...p, gender, top: 'shortFlat', eyebrows: 'defaultNatural', facialHairProbability: 0 }));
        } else {
            setConfig(p => ({ ...p, gender, top: 'straight02', eyebrows: 'raisedExcitedNatural', facialHairProbability: 0 }));
        }
    };

    const handleRandomize = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const isMale = Math.random() > 0.5;
            const hairPool = isMale ? HAIR_MALE : HAIR_FEMALE;
            const useHat = Math.random() > 0.8;
            
            setConfig({
                gender: isMale ? 'male' : 'female',
                top: useHat ? HATS[Math.floor(Math.random() * HATS.length)] : hairPool[Math.floor(Math.random() * hairPool.length)],
                hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
                hatColor: HAT_COLORS[Math.floor(Math.random() * HAT_COLORS.length)],
                mouth: MOUTH_OPTIONS[Math.floor(Math.random() * MOUTH_OPTIONS.length)],
                eyes: EYES_OPTIONS[Math.floor(Math.random() * EYES_OPTIONS.length)],
                eyebrows: EYEBROWS_OPTIONS[Math.floor(Math.random() * EYEBROWS_OPTIONS.length)],
                skinColor: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
                clothing: 'shirtCrewNeck', // FIXED UNIFORM
                clothesColor: 'ffffff', // FIXED WHITE
                facialHair: FACIAL_HAIR_OPTIONS[Math.floor(Math.random() * FACIAL_HAIR_OPTIONS.length)],
                facialHairProbability: isMale && Math.random() > 0.6 ? 100 : 0,
                accessories: GLASSES_OPTIONS[Math.floor(Math.random() * GLASSES_OPTIONS.length)],
                accessoriesProbability: Math.random() > 0.7 ? 100 : 0
            });
            setIsGenerating(false);
        }, 300);
    };

    const renderVisualOptionBtn = (featureKey, opt) => {
        const previewConfig = { ...config, [featureKey]: opt };
        
        if (featureKey === 'facialHair') previewConfig.facialHairProbability = 100;
        if (featureKey === 'accessories') previewConfig.accessoriesProbability = 100;

        const previewUri = createAvatar(avataaars, {
            seed: 'preview',
            size: 64,
            top: [previewConfig.top === 'baseballCap' ? 'shortFlat' : previewConfig.top],
            hairColor: [previewConfig.hairColor],
            hatColor: [previewConfig.hatColor],
            mouth: [previewConfig.mouth],
            eyes: [previewConfig.eyes],
            eyebrows: [previewConfig.eyebrows],
            skinColor: [previewConfig.skinColor],
            clothing: [previewConfig.clothing],
            clothesColor: [previewConfig.clothesColor],
            facialHair: [previewConfig.facialHair],
            facialHairColor: [previewConfig.hairColor || '2c1b18'],
            facialHairProbability: previewConfig.facialHairProbability,
            accessories: [previewConfig.accessories],
            accessoriesProbability: previewConfig.accessoriesProbability,
            backgroundColor: ['transparent']
        }).toDataUri();

        const isActive = config[featureKey] === opt;

        return (
            <button
                key={opt}
                onClick={() => {
                    setConfig(prev => {
                        const next = { ...prev, [featureKey]: opt };
                        if (featureKey === 'facialHair') next.facialHairProbability = 100;
                        if (featureKey === 'accessories') next.accessoriesProbability = 100;
                        return next;
                    });
                }}
                className={`rounded-2xl flex items-center justify-center p-1 transition-all duration-200
                ${isActive 
                    ? 'bg-slate-50 ring-2 ring-blue-500 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]' 
                    : 'bg-slate-50 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff] hover:scale-105'
                }`}
            >
                <div className="relative w-[85%] h-[85%] flex items-center justify-center">
                    <img src={previewUri} alt={opt} className="w-full h-full object-contain" />
                    {opt === 'baseballCap' && (
                        <svg viewBox="0 0 100 100" className="absolute top-0 left-0 w-full h-full drop-shadow-md z-20 pointer-events-none" style={{ transform: 'translateY(-2%) scale(1.15)' }}>
                            <path d="M 28 28 C 28 5, 72 5, 72 28 Z" fill={`#${previewConfig.hatColor || '262e33'}`} />
                            <path d="M 50 28 L 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                            <path d="M 38 28 Q 44 18, 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                            <path d="M 62 28 Q 56 18, 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                            <path d="M 15 28 Q 50 20, 85 28 Q 50 38, 15 28 Z" fill={`#${previewConfig.hatColor || '262e33'}`} opacity="0.95" />
                            <path d="M 15 28 Q 50 38, 85 28 Q 50 35, 15 28 Z" fill="#000000" opacity="0.2" />
                            <circle cx="50" cy="8" r="2.5" fill="#000000" opacity="0.2" />
                        </svg>
                    )}
                </div>
            </button>
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/staff/update-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar_config: config })
            });
            if (res.ok) {
                setSaveSuccess(true);
                setTimeout(() => {
                    router.push('/staff/hub');
                }, 2000);
            } else {
                console.error("Failed to save avatar");
                setIsSaving(false);
            }
        } catch (error) {
            console.error(error);
            setIsSaving(false);
        }
    };

    // ONBOARDING MODAL INITIAL
    if (showOnboarding) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="max-w-xs w-full">
                    <div className="w-24 h-24 mx-auto mb-8 bg-slate-50 rounded-[28px] shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] flex items-center justify-center">
                        <Brush size={40} className="text-blue-500" />
                    </div>
                    <h1 className="text-xl font-black text-slate-800 tracking-[-0.05em] mb-4">Bienvenido al ID Studio</h1>
                    <p className="text-[13px] text-slate-500 font-medium mb-10 leading-relaxed max-w-[260px] mx-auto">
                        Para comenzar a crear tu identidad corporativa virtual, por favor elige tu perfil:
                    </p>
                    
                    <div className="flex gap-6 justify-center">
                        <button
                            onClick={() => { handleGenderChange('female'); setShowOnboarding(false); }}
                            className="w-32 h-32 flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-[32px] shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] hover:shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] hover:text-blue-600 transition-all text-slate-500 group"
                        >
                            <User2 size={36} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Mujer</span>
                        </button>
                        <button
                            onClick={() => { handleGenderChange('male'); setShowOnboarding(false); }}
                            className="w-32 h-32 flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-[32px] shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] hover:shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] hover:text-blue-600 transition-all text-slate-500 group"
                        >
                            <User2 size={36} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Hombre</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // SUCCESS FULLSCREEN
    if (saveSuccess) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-24 h-24 mb-8 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.4)] animate-bounce">
                    <Check size={40} className="text-white bg-transparent" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-[-0.05em] mb-2">¡ID Guardado!</h1>
                <p className="text-[14px] text-slate-500 font-medium">Volviendo a la operación...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            <div className="bg-slate-50 pt-8 pb-4 px-6 sticky top-0 z-20 shadow-[0_10px_30px_rgba(203,213,225,0.4)]">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <Link href="/staff/hub" className="w-10 h-10 rounded-full bg-slate-50 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff] flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all active:shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]">
                        <ChevronLeft size={20} />
                    </Link>
                    <h1 className="text-[13px] font-black text-slate-800 uppercase tracking-widest">ID Studio</h1>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-8 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all 
                        ${isSaving 
                            ? 'bg-slate-50 text-slate-300 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]' 
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_10px_25px_rgba(59,130,246,0.6)] hover:shadow-[0_15px_35px_rgba(59,130,246,0.8)] hover:-translate-y-1 active:scale-95'}`}
                    >
                        {isSaving ? <Sparkles size={20} className="animate-spin" /> : <Save size={20} />}
                        <span className="text-[13px] font-black tracking-widest uppercase">{isSaving ? 'Aplicando...' : 'Guardar Avatar'}</span>
                    </button>
                </div>
            </div>

            <div className="max-w-md mx-auto px-6 py-6">
                {/* STAGE */}
                <div className="relative w-full aspect-square rounded-[40px] bg-slate-50 shadow-[inset_8px_8px_16px_#cbd5e1,inset_-8px_-8px_16px_#ffffff] flex items-center justify-center p-8 mb-8 overflow-hidden z-10 transition-transform duration-300">
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5" />
                    
                    <div className={`relative w-full h-full transform transition-all duration-300 ${isGenerating ? 'scale-90 opacity-50 blur-sm' : 'scale-100 opacity-100'}`}>
                        <img 
                            src={masterAvatarUri} 
                            alt="Master Avatar" 
                            className="w-full h-full object-contain relative z-10 drop-shadow-xl"
                        />
                        {/* CUSTOM BASEBALL CAP SUPERPOSITION */}
                        {config.top === 'baseballCap' && (
                            <svg viewBox="0 0 100 100" className="absolute top-0 left-0 w-full h-full drop-shadow-xl z-30 pointer-events-none" style={{ transform: 'translateY(1%) scale(1.05)' }}>
                                <path d="M 28 28 C 28 5, 72 5, 72 28 Z" fill={`#${config.hatColor || '262e33'}`} />
                                <path d="M 50 28 L 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                                <path d="M 38 28 Q 44 18, 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                                <path d="M 62 28 Q 56 18, 50 8" stroke="#000000" strokeWidth="0.5" opacity="0.15" />
                                <path d="M 15 28 Q 50 20, 85 28 Q 50 38, 15 28 Z" fill={`#${config.hatColor || '262e33'}`} opacity="0.95" />
                                <path d="M 15 28 Q 50 38, 85 28 Q 50 35, 15 28 Z" fill="#000000" opacity="0.2" />
                                <circle cx="50" cy="8" r="2.5" fill="#000000" opacity="0.2" />
                            </svg>
                        )}
                        {/* FLYHIGH UNIFORM LOGO (Flanco Izquierdo, nivel del pecho) */}
                        <div className={`absolute z-20 pointer-events-none opacity-90 ${['262e33', '25557c', '3c4f5c', 'ff5c5c', '8b5cf6', '10b981', '000000'].includes(config.clothesColor) ? '' : 'mix-blend-darken'}`} 
                             style={{ bottom: '12%', left: '28%' }}>
                            <span className={`font-black text-[10px] tracking-tighter drop-shadow-sm ${['262e33', '25557c', '3c4f5c', 'ff5c5c', '8b5cf6', '10b981', '000000'].includes(config.clothesColor) ? 'text-white' : 'text-black'}`}>
                                FLYHIGH
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={handleRandomize}
                        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white shadow-[0_8px_20px_rgba(59,130,246,0.4)] hover:bg-blue-600 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-20"
                    >
                        <Sparkles size={24} className={isGenerating ? "animate-spin" : "animate-pulse"} />
                    </button>
                </div>

                {/* FILTERS */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => handleGenderChange('female')}
                        className={`flex-1 py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                            config.gender === 'female' 
                            ? 'bg-slate-50 text-blue-600 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]' 
                            : 'bg-slate-50 text-slate-400 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff]'
                        }`}
                    >
                        <User2 size={16} /> Mujer
                    </button>
                    <button
                        onClick={() => handleGenderChange('male')}
                        className={`flex-1 py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                            config.gender === 'male' 
                            ? 'bg-slate-50 text-blue-600 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]' 
                            : 'bg-slate-50 text-slate-400 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff]'
                        }`}
                    >
                        <User2 size={16} /> Hombre
                    </button>
                </div>

                {/* DECK */}
                <div className="bg-slate-50 rounded-[32px] shadow-[6px_6px_16px_#cbd5e1,-6px_-6px_16px_#ffffff] p-2">
                    <div className="flex overflow-x-auto no-scrollbar gap-2 p-2 mb-2">
                        {[
                            { id: 'hair', label: 'Cabeza' },
                            { id: 'eyes', label: 'Ojos' },
                            { id: 'mouth', label: 'Boca' },
                            ...(config.gender === 'male' ? [{ id: 'beard', label: 'Barba' }] : []),
                            { id: 'colors', label: 'Tono' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-3 min-w-fit rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                                    activeTab === tab.id 
                                        ? 'bg-slate-50 text-blue-600 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]'
                                        : 'bg-slate-50 text-slate-400 shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] hover:text-slate-600'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 pt-2">
                        {/* CABEZA/PELO/GORRAS */}
                        {activeTab === 'hair' && (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Peinado</p>
                                    <div className="grid grid-cols-4 gap-4">
                                        {(config.gender === 'male' ? HAIR_MALE : HAIR_FEMALE).map(opt => renderVisualOptionBtn('top', opt))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Gorros / Sombreros</p>
                                    <div className="grid grid-cols-4 gap-4 mb-4">
                                        {HATS.map(opt => renderVisualOptionBtn('top', opt))}
                                    </div>
                                    {HATS.includes(config.top) && (
                                        <div className="flex flex-wrap gap-4 mt-4 p-4 bg-slate-100/50 rounded-2xl border border-slate-200">
                                            <p className="text-[10px] font-black w-full text-slate-400 uppercase tracking-widest mb-2">Color del Gorro</p>
                                            {HAT_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setConfig(p => ({ ...p, hatColor: color }))}
                                                    className={`w-8 h-8 rounded-full shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] border border-slate-200/50 ${config.hatColor === color ? 'ring-2 ring-blue-500 scale-90' : 'hover:scale-110'}`}
                                                    style={{ backgroundColor: `#${color}` }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Color de Pelo</p>
                                    <div className="flex flex-wrap gap-4">
                                        {HAIR_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setConfig(p => ({ ...p, hairColor: color }))}
                                                className={`w-8 h-8 rounded-full shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] border border-slate-200/50 ${config.hairColor === color ? 'ring-2 ring-blue-500 scale-90' : 'hover:scale-110'}`}
                                                style={{ backgroundColor: `#${color}` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* OJOS/CEJAS/LENTES */}
                        {activeTab === 'eyes' && (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Expresión</p>
                                    <div className="grid grid-cols-4 gap-4">
                                        {EYES_OPTIONS.map(opt => renderVisualOptionBtn('eyes', opt))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cejas</p>
                                    <div className="grid grid-cols-4 gap-4">
                                        {EYEBROWS_OPTIONS.map(opt => renderVisualOptionBtn('eyebrows', opt))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lentes y Accesorios</p>
                                        <button
                                            onClick={() => setConfig(p => ({ ...p, accessoriesProbability: p.accessoriesProbability === 100 ? 0 : 100 }))}
                                            className={`w-12 h-6 rounded-full p-1 ${config.accessoriesProbability === 100 ? 'bg-blue-500' : 'bg-slate-300 shadow-inner'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${config.accessoriesProbability === 100 ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <div className={`grid grid-cols-4 gap-4 ${config.accessoriesProbability === 0 ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                        {GLASSES_OPTIONS.map(opt => renderVisualOptionBtn('accessories', opt))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BOCA */}
                        {activeTab === 'mouth' && (
                            <div className="grid grid-cols-4 gap-4">
                                {MOUTH_OPTIONS.map(opt => renderVisualOptionBtn('mouth', opt))}
                            </div>
                        )}
                        
                        {/* BARBA */}
                        {activeTab === 'beard' && config.gender === 'male' && (
                            <div className="space-y-6">
                                <div className="flex justify-between p-4 bg-slate-50 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] rounded-2xl">
                                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Activar Vello Facial</p>
                                    <button
                                        onClick={() => setConfig(p => ({ ...p, facialHairProbability: p.facialHairProbability === 100 ? 0 : 100 }))}
                                        className={`w-12 h-6 rounded-full p-1 ${config.facialHairProbability === 100 ? 'bg-blue-500' : 'bg-slate-300 shadow-inner'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${config.facialHairProbability === 100 ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <div className={`grid grid-cols-3 gap-4 ${config.facialHairProbability === 0 ? 'opacity-30 pointer-events-none' : ''}`}>
                                    {FACIAL_HAIR_OPTIONS.map(opt => renderVisualOptionBtn('facialHair', opt))}
                                </div>
                            </div>
                        )}

                        {/* COLORES (Solo piel, forzado Uniforme Blanco) */}
                        {activeTab === 'colors' && (
                            <div className="space-y-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Brush size={12}/> Tono de Piel</p>
                                    <div className="flex flex-wrap gap-4">
                                        {SKIN_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setConfig(p => ({ ...p, skinColor: color }))}
                                                className={`w-10 h-10 rounded-full shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] border-2 ${config.skinColor === color ? 'border-blue-500 scale-90 shadow-inner' : 'border-transparent hover:scale-110'}`}
                                                style={{ backgroundColor: `#${color}` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Brush size={12}/> Color de Playera Corporativa
                                    </p>
                                    <div className="flex flex-wrap gap-4">
                                        {CLOTHES_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setConfig(p => ({ ...p, clothesColor: color }))}
                                                className={`w-10 h-10 rounded-full shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] border border-slate-200/50 ${config.clothesColor === color ? 'ring-2 ring-blue-500 scale-90' : 'hover:scale-110'}`}
                                                style={{ backgroundColor: `#${color}` }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
