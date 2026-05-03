'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Sparkles, Save, Trash2, RefreshCw, BookOpen, Search, Zap } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// POIDetailModal — Modal único para ver, crear y editar POIs.
// Integra investigación Gemini + ficha didáctica en un solo flujo.
// ═══════════════════════════════════════════════════════════════

function autoCategory(desc) {
    if (!desc) return { emoji: '📍', label: 'Punto de interés' };
    if (/museo/i.test(desc)) return { emoji: '🏛️', label: 'Museo' };
    if (/templo|iglesia|culto|capilla|parroquia/i.test(desc)) return { emoji: '⛪', label: 'Templo' };
    if (/río|lago|presa|cascada|agua|laguna/i.test(desc)) return { emoji: '💧', label: 'Agua' };
    if (/parque|reserva|bosque|natural|área/i.test(desc)) return { emoji: '🌿', label: 'Natural' };
    if (/cerro|volcán|montaña|elevación|peak/i.test(desc)) return { emoji: '⛰️', label: 'Cerro' };
    if (/universidad|biblioteca|educativa|teatro|college/i.test(desc)) return { emoji: '📚', label: 'Educativo' };
    if (/planta|fábrica|infraestructura|estación|tratadora/i.test(desc)) return { emoji: '🏭', label: 'Industrial' };
    if (/aeropuerto|aeródromo/i.test(desc)) return { emoji: '✈️', label: 'Aeropuerto' };
    if (/deportiv|estadio/i.test(desc)) return { emoji: '⚽', label: 'Deportivo' };
    if (/monument|históric|arqueológ/i.test(desc)) return { emoji: '🏺', label: 'Histórico' };
    if (/mirador|viewpoint/i.test(desc)) return { emoji: '👁️', label: 'Mirador' };
    if (/zoológico|acuario/i.test(desc)) return { emoji: '🐾', label: 'Fauna' };
    return { emoji: '📍', label: 'Punto de interés' };
}

// Header gradient backgrounds per category (fallback if needed)
const HEADER_GRADIENTS = {
    '🏛️': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    '⛪': 'linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 50%, #462255 100%)',
    '💧': 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0c4a6e 100%)',
    '🌿': 'linear-gradient(135deg, #0a1f0a 0%, #1a2e1a 50%, #14532d 100%)',
    '⛰️': 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #44403c 100%)',
    '📚': 'linear-gradient(135deg, #1e1b4b 0%, #1e293b 50%, #312e81 100%)',
    '🏭': 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)',
    '✈️': 'linear-gradient(135deg, #0c1222 0%, #1e293b 50%, #1e3a5f 100%)',
    '⚽': 'linear-gradient(135deg, #14210a 0%, #1a2e1a 50%, #365314 100%)',
    '🏺': 'linear-gradient(135deg, #2a1708 0%, #431407 50%, #7c2d12 100%)',
    '👁️': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    '🐾': 'linear-gradient(135deg, #1a2e05 0%, #1e293b 50%, #3f6212 100%)',
    '📍': 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
};

const PLAYFUL_COLORS = [
    '#2563EB', // Blue 600
    '#7C3AED', // Violet 600
    '#DB2777', // Pink 600
    '#EA580C', // Orange 600
    '#059669', // Emerald 600
    '#0284C7', // Light Blue 600
];

export default function POIDetailModal({
    isOpen, onClose, onSave, onDelete,
    poi, isNewPin = false, geoContext = ''
}) {
    // Form state
    const [title, setTitle] = useState('');
    const [datoClave1, setDatoClave1] = useState('');
    const [datoClave2, setDatoClave2] = useState('');
    const [pregunta, setPregunta] = useState('');

    // Research state
    const [researchArticle, setResearchArticle] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [accordionOpen, setAccordionOpen] = useState(false);
    const [researchTriggered, setResearchTriggered] = useState(false);

    // Ficha AI state
    const [isFillingFicha, setIsFillingFicha] = useState(false);
    const [hasGeneratedFicha, setHasGeneratedFicha] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [headerColor, setHeaderColor] = useState('#2563EB');
    const [regeneratingField, setRegeneratingField] = useState(null);
    const [loadingStep, setLoadingStep] = useState(null);

    // ═══ TRIDENTE ENGINE STATE ═══
    const ENGINE_OPTIONS = [
        { id: 'gemini', label: 'Gemini Flash', color: '#4285F4', icon: '🔵' },
        { id: 'cohere', label: 'Cohere Command R+', color: '#D18EE2', icon: '🟣' },
        { id: 'rag', label: 'Tavily + Groq', color: '#F59E0B', icon: '🟡' }
    ];
    const [activeEngine, setActiveEngine] = useState('gemini');
    const [engineDropdownOpen, setEngineDropdownOpen] = useState(false);
    const [engineToast, setEngineToast] = useState(null); // { message, fromEngine, toEngine }

    const nameRef = useRef(null);
    const scrollRef = useRef(null);
    const accordionRef = useRef(null);

    // Initialize form when modal opens
    useEffect(() => {
        if (!isOpen) return;
        
        // Random playful color for header
        const randomColor = PLAYFUL_COLORS[Math.floor(Math.random() * PLAYFUL_COLORS.length)];
        setHeaderColor(randomColor);

        setTitle(poi?.name || '');
        setDatoClave1(poi?.dato_clave_1 || '');
        setDatoClave2(poi?.dato_clave_2 || '');
        setPregunta(poi?.pregunta_interaccion || '');
        setResearchArticle(poi?.research_article || '');
        setAccordionOpen(false);
        setResearchTriggered(false);
        setIsResearching(false);
        setIsFillingFicha(false);
        setHasGeneratedFicha(!!(poi?.dato_clave_1 || poi?.dato_clave_2));
        setIsSaving(false);
        setLoadingStep(null);
        setEngineToast(null);
        setEngineDropdownOpen(false);

        if (isNewPin) {
            setTimeout(() => nameRef.current?.focus(), 400);
        }
    }, [isOpen, poi, isNewPin]);

    // ═══ TRIDENTE: Deep Research con fallover automático ═══
    const handleDeepResearch = async () => {
        if (isResearching) return '';
        setIsResearching(true);
        setResearchTriggered(true);
        setEngineToast(null);
        let articleText = '';
        try {
            const res = await fetch('/api/poi-deep-research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: title || poi?.name || '',
                    type: poi?.description || '',
                    context: geoContext,
                    lat: poi?.latitude,
                    lon: poi?.longitude,
                    preferredEngine: activeEngine
                })
            });
            const data = await res.json();

            if (data.article && data.article.length > 30) {
                articleText = data.article;

                // Si el backend hizo fallover automático, notificar al usuario
                if (data.engine && data.engine !== activeEngine && data.engine !== 'none') {
                    const prevLabel = ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label || activeEngine;
                    const newLabel = ENGINE_OPTIONS.find(e => e.id === data.engine)?.label || data.engine;
                    setActiveEngine(data.engine);
                    setEngineToast({
                        message: `Motor cambiado automáticamente para asegurar tu respuesta`,
                        detail: `${prevLabel} → ${newLabel}`
                    });
                    setTimeout(() => setEngineToast(null), 5000);
                } else if (data.engine && data.engine !== 'none') {
                    setActiveEngine(data.engine);
                }
            } else if (data.allFailed) {
                articleText = data.article || 'No fue posible investigar este punto en este momento. Intenta más tarde.';
            } else {
                articleText = data.article || 'No se encontró información verificada.';
            }
        } catch (e) {
            console.error('Deep research error:', e);
            articleText = 'Error de conexión. Verifica tu internet.';
        } finally {
            setResearchArticle(articleText);
            setIsResearching(false);
        }
        return articleText;
    };

    // Accordion toggle — trigger research on first open
    const toggleAccordion = () => {
        const opening = !accordionOpen;
        setAccordionOpen(opening);
        if (opening && !researchArticle && !researchTriggered) {
            handleDeepResearch();
        }
    };

    // Fill Ficha with AI
    const handleFillFicha = async (isRegenerating = false, fieldToRegenerate = null) => {
        let article = researchArticle;

        // If no article yet, research first and capture the result directly
        if (!article || article.length < 30) {
            setAccordionOpen(true);
            setIsFillingFicha(true);
            setLoadingStep('researching');
            
            // Auto-scroll to accordion to show the user that research is happening
            setTimeout(() => {
                accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);

            article = await handleDeepResearch();
        }
        
        if (!article || article.length < 30) {
            setIsFillingFicha(false);
            setLoadingStep(null);
            return;
        }

        let currentValue = null;
        if (fieldToRegenerate === 'dato_clave_1') currentValue = datoClave1;
        else if (fieldToRegenerate === 'dato_clave_2') currentValue = datoClave2;
        else if (fieldToRegenerate === 'pregunta_interaccion') currentValue = pregunta;
        else if (isRegenerating && !fieldToRegenerate) {
            currentValue = JSON.stringify({ dato_clave_1: datoClave1, dato_clave_2: datoClave2, pregunta_interaccion: pregunta });
        }

        if (fieldToRegenerate) {
            setRegeneratingField(fieldToRegenerate);
        } else {
            setIsFillingFicha(true);
            setLoadingStep('generating');
        }

        try {
            const res = await fetch('/api/poi-fill-ficha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article, poiName: title || poi?.name, regenerate: isRegenerating, fieldToRegenerate, currentValue, preferredEngine: activeEngine })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.dato_clave_1) setDatoClave1(data.dato_clave_1);
                if (data.dato_clave_2) setDatoClave2(data.dato_clave_2);
                if (data.pregunta_interaccion) setPregunta(data.pregunta_interaccion);
                setHasGeneratedFicha(true);
            }
        } catch (e) {
            console.error('Fill ficha error:', e);
        } finally {
            setIsFillingFicha(false);
            setRegeneratingField(null);
            setLoadingStep(null);
        }
    };

    // Save — single POST
    const handleSave = async () => {
        const trimmedTitle = title.trim();
        if (trimmedTitle.length < 2 || isSaving) return;
        setIsSaving(true);
        try {
            await onSave({
                name: trimmedTitle,
                description: poi?.description || '',
                latitude: poi?.latitude,
                longitude: poi?.longitude,
                category: 'landmark',
                is_favorite: poi?.is_favorite || false,
                research_article: researchArticle || null,
                dato_clave_1: datoClave1.trim() || null,
                dato_clave_2: datoClave2.trim() || null,
                pregunta_interaccion: pregunta.trim() || null,
                ...(poi?.id ? { id: poi.id } : {})
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !poi) return null;

    const cat = autoCategory(poi?.description);
    const gradient = HEADER_GRADIENTS[cat.emoji] || HEADER_GRADIENTS['📍'];
    const isValid = title.trim().length >= 2;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'poiFadeIn 0.2s ease-out'
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={scrollRef} style={{
                width: '100%', maxWidth: 600, height: '85dvh',
                background: '#FFFFFF', borderRadius: '2rem 2rem 0 0',
                display: 'flex', flexDirection: 'column',
                border: 'none',
                overflow: 'hidden',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
                animation: 'poiSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)'
            }}>
                {/* ═══ HEADER (PORTADA PLAYFUL) ═══ */}
                <div style={{
                    background: headerColor, padding: '20px 20px',
                    position: 'relative', flexShrink: 0,
                    transition: 'background 0.3s ease'
                }}>
                    {/* Drag pill */}
                    <div style={{ width: 40, height: 4, background: 'rgba(255, 255, 255, 0.3)', borderRadius: 10, margin: '0 auto 16px' }} />

                    {/* Close button */}
                    <button onClick={onClose} style={{
                        position: 'absolute', top: 16, right: 16,
                        width: 32, height: 32, borderRadius: 16,
                        background: 'rgba(255, 255, 255, 0.15)', border: 'none',
                        color: '#FFFFFF', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                        <X size={18} />
                    </button>

                    {/* Category badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: 6, padding: '6px 10px',
                        marginBottom: 16, border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{cat.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {cat.label}
                        </span>
                    </div>

                    {/* Editable title */}
                    <input
                        ref={nameRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={isNewPin ? 'Nombre del punto...' : 'Sin nombre'}
                        maxLength={100}
                        style={{
                            width: '100%', background: 'transparent', border: 'none',
                            outline: 'none', fontSize: 26, fontWeight: 800,
                            color: '#FFFFFF', padding: 0, margin: 0,
                            fontFamily: 'system-ui', letterSpacing: '-0.03em',
                            boxSizing: 'border-box'
                        }}
                    />

                    {/* Coordinates */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                        <span style={{ fontSize: 12, lineHeight: 1 }}>📍</span>
                        <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', margin: 0, fontWeight: 500, fontFamily: 'monospace' }}>
                            {typeof poi?.latitude === 'number' ? poi.latitude.toFixed(5) : '—'}, {typeof poi?.longitude === 'number' ? poi.longitude.toFixed(5) : '—'}
                        </p>
                    </div>

                    {/* ═══ ENGINE SELECTOR DROPDOWN ═══ */}
                    <div style={{ position: 'relative', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <button
                            onClick={() => setEngineDropdownOpen(!engineDropdownOpen)}
                            style={{
                                background: 'rgba(255,255,255,0.12)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 8, padding: '5px 12px',
                                color: 'rgba(255,255,255,0.9)',
                                fontSize: 11, fontWeight: 600,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>{ENGINE_OPTIONS.find(e => e.id === activeEngine)?.icon}</span>
                            <span>{ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label}</span>
                            <ChevronDown size={12} style={{
                                transition: 'transform 0.2s',
                                transform: engineDropdownOpen ? 'rotate(180deg)' : 'rotate(0)'
                            }} />
                        </button>
                        {engineDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 20, marginTop: 4, zIndex: 100,
                                background: '#1E293B', border: '1px solid #334155',
                                borderRadius: 10, padding: 4, minWidth: 200,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                                animation: 'poiFadeIn 0.15s ease-out'
                            }}>
                                {ENGINE_OPTIONS.map(eng => (
                                    <button
                                        key={eng.id}
                                        onClick={() => { setActiveEngine(eng.id); setEngineDropdownOpen(false); }}
                                        style={{
                                            width: '100%', padding: '10px 12px',
                                            background: activeEngine === eng.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                                            border: 'none', borderRadius: 8,
                                            color: '#F1F5F9', fontSize: 12, fontWeight: 600,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                                            transition: 'background 0.15s'
                                        }}
                                    >
                                        <span style={{ fontSize: 14 }}>{eng.icon}</span>
                                        <span>{eng.label}</span>
                                        {activeEngine === eng.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#22C55E' }}>● Activo</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ SCROLLABLE BODY ═══ */}
                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

                    {/* ═══ ACCORDION: Información Completa ═══ */}
                    <div ref={accordionRef} style={{ padding: '0 20px', marginTop: 16 }}>
                        <div style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: 12,
                            overflow: 'hidden',
                            background: '#FFFFFF',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            marginBottom: 8
                        }}>
                            <button onClick={toggleAccordion} style={{
                                width: '100%', padding: '16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: accordionOpen ? '#F8FAFC' : '#FFFFFF', border: 'none', cursor: 'pointer',
                                transition: 'background 0.2s ease',
                                outline: 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        background: researchArticle ? '#EFF6FF' : '#F1F5F9',
                                        width: 38, height: 38, borderRadius: 8,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {researchArticle ? <BookOpen size={20} color="#2563EB" /> : <Sparkles size={20} color="#64748B" />}
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
                                            {researchArticle ? 'Información generada disponible' : 'Más información'}
                                        </h3>
                                        <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748B' }}>
                                            {researchArticle ? 'Resumen detallado del lugar' : 'Obtener detalles del lugar'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown size={20} style={{
                                    color: '#64748B',
                                    transition: 'transform 0.3s ease',
                                    transform: accordionOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                }} />
                            </button>

                            {accordionOpen && (
                                <div style={{
                                    padding: '0 16px 16px',
                                    animation: 'poiAccordion 0.3s ease-out',
                                    borderTop: '1px solid #E2E8F0',
                                    background: '#F8FAFC',
                                    paddingTop: 16
                                }}>
                                    {isResearching ? (
                                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                            <Loader2 size={24} style={{ color: '#0F172A', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                                            <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>Investigando...</p>
                                            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                                                {ENGINE_OPTIONS.find(e => e.id === activeEngine)?.icon} Usando {ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label}
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{
                                                fontSize: 14, lineHeight: 1.6, color: '#334155',
                                                background: '#FFFFFF', borderRadius: 8,
                                                padding: '16px', border: '1px solid #E2E8F0'
                                            }}>
                                                {researchArticle || 'Toca "Reinvestigar" para extraer datos de este lugar.'}
                                            </div>
                                            {researchArticle && (
                                                <button onClick={handleDeepResearch} style={{
                                                    marginTop: 12, padding: '8px 16px', borderRadius: 6,
                                                    background: '#FFFFFF', border: '1px solid #CBD5E1',
                                                    color: '#0F172A', fontSize: 13, fontWeight: 600,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}>
                                                    Reinvestigar
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ FICHA DIDÁCTICA ═══ */}
                    <div style={{ padding: '24px 20px 120px' }}>
                        <h3 style={{
                            fontSize: 12, fontWeight: 700, color: '#64748B',
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            margin: '0 0 20px'
                        }}>
                            Ficha Didáctica
                        </h3>

                        {/* Dato Clave 1 */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'block' }}>
                                        Dato Clave 1
                                    </span>
                                    {hasGeneratedFicha && (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'dato_clave_1'); }}
                                            disabled={regeneratingField !== null || isFillingFicha}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                color: regeneratingField === 'dato_clave_1' ? '#2563EB' : '#94A3B8',
                                                transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Regenerar solo este dato"
                                        >
                                            <RefreshCw size={14} style={{ animation: regeneratingField === 'dato_clave_1' ? 'spin 1s linear infinite' : 'none' }} />
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={datoClave1}
                                    onChange={(e) => setDatoClave1(e.target.value)}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    placeholder="Un dato concreto que sorprenda..."
                                    rows={2}
                                    disabled={regeneratingField === 'dato_clave_1'}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: 8,
                                        border: '1px solid #CBD5E1', background: '#FFFFFF',
                                        fontSize: 15, color: '#0F172A', resize: 'none',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'all 0.2s ease', lineHeight: 1.5,
                                        fontFamily: 'system-ui',
                                        opacity: regeneratingField === 'dato_clave_1' ? 0.5 : 1
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#0F172A'; e.target.style.boxShadow = '0 0 0 1px #0F172A'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#CBD5E1'; e.target.style.boxShadow = 'none'; }}
                                />
                            </label>
                        </div>

                        {/* Dato Clave 2 */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'block' }}>
                                        Dato Clave 2
                                    </span>
                                    {hasGeneratedFicha && (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'dato_clave_2'); }}
                                            disabled={regeneratingField !== null || isFillingFicha}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                color: regeneratingField === 'dato_clave_2' ? '#2563EB' : '#94A3B8',
                                                transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Regenerar solo este dato"
                                        >
                                            <RefreshCw size={14} style={{ animation: regeneratingField === 'dato_clave_2' ? 'spin 1s linear infinite' : 'none' }} />
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={datoClave2}
                                    onChange={(e) => setDatoClave2(e.target.value)}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    placeholder="Por qué este lugar importa..."
                                    rows={2}
                                    disabled={regeneratingField === 'dato_clave_2'}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: 8,
                                        border: '1px solid #CBD5E1', background: '#FFFFFF',
                                        fontSize: 15, color: '#0F172A', resize: 'none',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'all 0.2s ease', lineHeight: 1.5,
                                        fontFamily: 'system-ui',
                                        opacity: regeneratingField === 'dato_clave_2' ? 0.5 : 1
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#0F172A'; e.target.style.boxShadow = '0 0 0 1px #0F172A'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#CBD5E1'; e.target.style.boxShadow = 'none'; }}
                                />
                            </label>
                        </div>

                        {/* Pregunta de Interacción */}
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'block' }}>
                                        Pregunta de Interacción
                                    </span>
                                    {hasGeneratedFicha && (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'pregunta_interaccion'); }}
                                            disabled={regeneratingField !== null || isFillingFicha}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                color: regeneratingField === 'pregunta_interaccion' ? '#2563EB' : '#94A3B8',
                                                transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Regenerar solo esta pregunta"
                                        >
                                            <RefreshCw size={14} style={{ animation: regeneratingField === 'pregunta_interaccion' ? 'spin 1s linear infinite' : 'none' }} />
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={pregunta}
                                    onChange={(e) => setPregunta(e.target.value)}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    placeholder="Una pregunta para detonar curiosidad..."
                                    rows={2}
                                    disabled={regeneratingField === 'pregunta_interaccion'}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: 8,
                                        border: '1px solid #CBD5E1', background: '#FFFFFF',
                                        fontSize: 15, color: '#0F172A', resize: 'none',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'all 0.2s ease', lineHeight: 1.5,
                                        fontFamily: 'system-ui',
                                        opacity: regeneratingField === 'pregunta_interaccion' ? 0.5 : 1
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = '#0F172A'; e.target.style.boxShadow = '0 0 0 1px #0F172A'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#CBD5E1'; e.target.style.boxShadow = 'none'; }}
                                />
                            </label>
                        </div>

                        {/* AI Fill Button */}
                        <div style={{ display: 'flex', gap: 12 }}>
                            {hasGeneratedFicha ? (
                                <button
                                    onClick={(e) => { e.preventDefault(); handleFillFicha(true); }}
                                    disabled={isFillingFicha || regeneratingField !== null}
                                    style={{
                                        flex: 1, padding: '14px', borderRadius: 8,
                                        background: isFillingFicha ? '#F8FAFC' : '#FFFFFF',
                                        border: '1px solid #CBD5E1',
                                        color: isFillingFicha ? '#94A3B8' : '#0F172A', fontSize: 14, fontWeight: 600,
                                        cursor: (isFillingFicha || regeneratingField !== null) ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        transition: 'all 0.2s ease',
                                        opacity: regeneratingField !== null ? 0.5 : 1
                                    }}
                                >
                                    {loadingStep === 'researching' ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Paso 1/2: Investigando lugar...</>
                                    ) : loadingStep === 'generating' ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Paso 2/2: Creando Ficha...</>
                                    ) : isFillingFicha ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Regenerando...</>
                                    ) : (
                                        <><RefreshCw size={18} /> Regenerar Ficha Completa</>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => { e.preventDefault(); handleFillFicha(false); }}
                                    disabled={isFillingFicha || regeneratingField !== null}
                                    style={{
                                        flex: 1, padding: '14px', borderRadius: 8,
                                        background: (isFillingFicha || regeneratingField !== null) ? '#F1F5F9' : '#0F172A',
                                        border: '1px solid',
                                        borderColor: (isFillingFicha || regeneratingField !== null) ? '#E2E8F0' : '#0F172A',
                                        color: (isFillingFicha || regeneratingField !== null) ? '#94A3B8' : '#FFFFFF', fontSize: 14, fontWeight: 600,
                                        cursor: (isFillingFicha || regeneratingField !== null) ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        transition: 'all 0.2s ease',
                                        opacity: regeneratingField !== null ? 0.5 : 1
                                    }}
                                >
                                    {loadingStep === 'researching' ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Paso 1/2: Investigando lugar...</>
                                    ) : loadingStep === 'generating' ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Paso 2/2: Creando Ficha...</>
                                    ) : isFillingFicha ? (
                                        <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Generando...</>
                                    ) : (
                                        <><Sparkles size={18} /> Generar Ficha</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ═══ STICKY FOOTER ═══ */}
                <div style={{
                    padding: '16px 20px 24px',
                    background: '#FFFFFF',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex', gap: 12, flexShrink: 0
                }}>
                    {poi?.id && onDelete && (
                        <button onClick={() => onDelete(poi.id)} disabled={isSaving} style={{
                            width: 52, height: 52, borderRadius: 8,
                            border: '1px solid #FECACA', background: '#FEF2F2',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#EF4444', opacity: isSaving ? 0.5 : 1,
                            flexShrink: 0
                        }}>
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!isValid || isSaving}
                        style={{
                            flex: 1, padding: '16px 0', borderRadius: 8,
                            border: 'none',
                            background: isValid ? '#2563EB' : '#E2E8F0',
                            color: isValid ? '#FFFFFF' : '#94A3B8',
                            fontSize: 16, fontWeight: 600,
                            cursor: isValid ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isSaving ? (
                            <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                        ) : (
                            <>Guardar Punto</>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ ENGINE TOAST — Notificación de cambio automático ═══ */}
            {engineToast && (
                <div style={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 60000, animation: 'poiFadeIn 0.3s ease-out',
                    background: '#1E293B', color: '#F1F5F9',
                    padding: '12px 20px', borderRadius: 14,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                    border: '1px solid #334155',
                    maxWidth: '90vw', textAlign: 'center'
                }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                        ⚡ {engineToast.message}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                        {engineToast.detail}
                    </p>
                </div>
            )}

            <style>{`
                @keyframes poiFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes poiSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                @keyframes poiAccordion { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
            `}</style>
        </div>
    );
}
