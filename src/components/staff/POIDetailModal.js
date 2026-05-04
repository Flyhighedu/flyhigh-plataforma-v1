'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Sparkles, Save, Trash2, RefreshCw, BookOpen, Search, Zap, Check } from 'lucide-react';

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
    const [datoClave3, setDatoClave3] = useState('');
    const [preguntaEstudio1, setPreguntaEstudio1] = useState('');
    const [preguntaEstudio2, setPreguntaEstudio2] = useState('');
    const [preguntaEstudio3, setPreguntaEstudio3] = useState('');
    const [pregunta, setPregunta] = useState('');

    // Research state
    const [researchArticle, setResearchArticle] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [accordionOpen, setAccordionOpen] = useState(false);
    const [researchTriggered, setResearchTriggered] = useState(false);

    // Ficha AI state
    const [isFillingFicha, setIsFillingFicha] = useState(false);
    const [hasGeneratedFicha, setHasGeneratedFicha] = useState(false);
    const [isEditingKeys, setIsEditingKeys] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [headerColor, setHeaderColor] = useState('#2563EB');
    const [regeneratingField, setRegeneratingField] = useState(null);
    const [confirmRegenerateField, setConfirmRegenerateField] = useState(null);
    const [loadingStep, setLoadingStep] = useState(null);
    const [animKeyDc1, setAnimKeyDc1] = useState(0);
    const [animKeyDc2, setAnimKeyDc2] = useState(0);
    const [animKeyDc3, setAnimKeyDc3] = useState(0);
    const [animKeyPe1, setAnimKeyPe1] = useState(0);
    const [animKeyPe2, setAnimKeyPe2] = useState(0);
    const [animKeyPe3, setAnimKeyPe3] = useState(0);
    const [animKeyPi, setAnimKeyPi] = useState(0);

    // Image selector state
    const [poiImages, setPoiImages] = useState([]);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    // ═══ TRIDENTE ENGINE STATE ═══
    const ENGINE_OPTIONS = [
        { id: 'gemini', label: 'Gemini Flash', color: '#4285F4', icon: '🔵' },
        { id: 'rag', label: 'Tavily + Groq', color: '#F59E0B', icon: '🟡' },
        { id: 'cohere', label: 'Cohere Command A', color: '#D18EE2', icon: '🟣' }
    ];
    const [activeEngine, setActiveEngine] = useState('gemini');
    const [engineDropdownOpen, setEngineDropdownOpen] = useState(false);
    const [engineToast, setEngineToast] = useState(null);
    const [tavilyUsage, setTavilyUsage] = useState(null); // { count, limit }

    const nameRef = useRef(null);
    const scrollRef = useRef(null);
    const accordionRef = useRef(null);
    
    // Textarea refs for auto-resizing
    const dc1Ref = useRef(null);
    const dc2Ref = useRef(null);
    const dc3Ref = useRef(null);
    const pe1Ref = useRef(null);
    const pe2Ref = useRef(null);
    const pe3Ref = useRef(null);
    const piRef = useRef(null);

    const resizeTextarea = (ref) => {
        if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = (ref.current.scrollHeight + 8) + 'px';
        }
    };

    const resizeAll = () => {
        resizeTextarea(dc1Ref);
        resizeTextarea(dc2Ref);
        resizeTextarea(dc3Ref);
        resizeTextarea(pe1Ref);
        resizeTextarea(pe2Ref);
        resizeTextarea(pe3Ref);
        resizeTextarea(piRef);
    };

    useEffect(() => { 
        const t1 = setTimeout(resizeAll, 100);
        const t2 = setTimeout(resizeAll, 400); // after modal animation
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [datoClave1, datoClave2, datoClave3, pregunta, isFillingFicha, accordionOpen]);

    // Initialize form when modal opens
    useEffect(() => {
        if (!isOpen) return;
        
        // Random playful color for header
        const randomColor = PLAYFUL_COLORS[Math.floor(Math.random() * PLAYFUL_COLORS.length)];
        setHeaderColor(randomColor);

        setTitle(poi?.name || '');
        setDatoClave1(poi?.dato_clave_1 || '');
        setDatoClave2(poi?.dato_clave_2 || '');
        setDatoClave3(poi?.dato_clave_3 || '');
        setPreguntaEstudio1(poi?.pregunta_estudio_1 || '');
        setPreguntaEstudio2(poi?.pregunta_estudio_2 || '');
        setPreguntaEstudio3(poi?.pregunta_estudio_3 || '');
        setPregunta(poi?.pregunta_interaccion || '');
        setResearchArticle(poi?.research_article || '');
        setAccordionOpen(false);
        setResearchTriggered(false);
        setIsResearching(false);
        setIsFillingFicha(false);
        setHasGeneratedFicha(!!(poi?.dato_clave_1 || poi?.dato_clave_2));
        setIsEditingKeys(false);
        setIsSaving(false);
        setLoadingStep(null);
        setEngineToast(null);
        setEngineDropdownOpen(false);
        setModalTranslateY(0);
        setPoiImages([]);
        setSelectedImageUrl(poi?.image_url || null);
        setIsLoadingImages(false);

        if (isNewPin) {
            setTimeout(() => nameRef.current?.focus(), 400);
        }
    }, [isOpen, poi, isNewPin]);

    // Swipe to close logic
    const [touchStartY, setTouchStartY] = useState(null);
    const [modalTranslateY, setModalTranslateY] = useState(0);

    const handleTouchStart = (e) => {
        setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
        if (touchStartY === null) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY;
        if (diff > 0) {
            setModalTranslateY(diff);
        }
    };

    const handleTouchEnd = () => {
        if (modalTranslateY > 150) {
            onClose();
            // Reset after animation
            setTimeout(() => setModalTranslateY(0), 300);
        } else {
            setModalTranslateY(0);
        }
        setTouchStartY(null);
    };

    // ═══ TRIDENTE: Deep Research con fallover automático ═══
    const handleDeepResearch = async () => {
        if (isResearching) return '';
        setIsResearching(true);
        setResearchTriggered(true);
        setEngineToast(null);
        let articleText = '';
        let researchImages = [];
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
                
                if (data.images && data.images.length > 0) {
                    researchImages = data.images;
                }

                // Actualizar odómetro Tavily si viene en la respuesta
                if (data.tavilyUsage) setTavilyUsage(data.tavilyUsage);

                // Si el backend hizo fallover automático, notificar al usuario
                if (data.engine && data.engine !== activeEngine && data.engine !== 'none') {
                    const prevLabel = ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label || activeEngine;
                    const newLabel = ENGINE_OPTIONS.find(e => e.id === data.engine)?.label || data.engine;
                    setActiveEngine(data.engine);
                    setEngineToast({
                        message: 'El sistema está saturado. Cambiando de motor automáticamente para asegurar tu información',
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
            // Siempre pedir imágenes adicionales para maximizar opciones (Tavily + Wikipedia)
            if (articleText && articleText.length > 30) {
                fetchPoiImages(researchImages);
            }
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
        else if (fieldToRegenerate === 'dato_clave_3') currentValue = JSON.stringify({ dato_clave_1: datoClave1, dato_clave_2: datoClave2 });
        else if (fieldToRegenerate === 'pregunta_interaccion') currentValue = pregunta;
        else if (isRegenerating && !fieldToRegenerate) {
            currentValue = JSON.stringify({ dato_clave_1: datoClave1, dato_clave_2: datoClave2, dato_clave_3: datoClave3, pregunta_interaccion: pregunta });
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
                
                if (fieldToRegenerate) {
                    if (fieldToRegenerate === 'dato_clave_3') {
                        if (data.dato_clave_3) { setDatoClave3(data.dato_clave_3); setAnimKeyDc3(k => k + 1); }
                        if (data.pregunta_estudio_3) { setPreguntaEstudio3(data.pregunta_estudio_3); setAnimKeyPe3(k => k + 1); }
                    } else {
                        const newValue = data[fieldToRegenerate];
                        if (newValue) {
                            if (fieldToRegenerate === 'dato_clave_1') { setDatoClave1(newValue); setAnimKeyDc1(k => k + 1); }
                            else if (fieldToRegenerate === 'dato_clave_2') { setDatoClave2(newValue); setAnimKeyDc2(k => k + 1); }
                            else if (fieldToRegenerate === 'pregunta_estudio_1') { setPreguntaEstudio1(newValue); setAnimKeyPe1(k => k + 1); }
                            else if (fieldToRegenerate === 'pregunta_estudio_2') { setPreguntaEstudio2(newValue); setAnimKeyPe2(k => k + 1); }
                            else if (fieldToRegenerate === 'pregunta_interaccion') { setPregunta(newValue); setAnimKeyPi(k => k + 1); }
                        }
                    }
                } else {
                    // Full regeneration — update all fields and animate all
                    if (data.dato_clave_1) setDatoClave1(data.dato_clave_1);
                    if (data.dato_clave_2) setDatoClave2(data.dato_clave_2);
                    if (data.dato_clave_3) setDatoClave3(data.dato_clave_3);
                    if (data.pregunta_estudio_1) setPreguntaEstudio1(data.pregunta_estudio_1);
                    if (data.pregunta_estudio_2) setPreguntaEstudio2(data.pregunta_estudio_2);
                    if (data.pregunta_estudio_3) setPreguntaEstudio3(data.pregunta_estudio_3);
                    if (data.pregunta_interaccion) setPregunta(data.pregunta_interaccion);
                    setAnimKeyDc1(k => k + 1);
                    setAnimKeyDc2(k => k + 1);
                    setAnimKeyDc3(k => k + 1);
                    setAnimKeyPe1(k => k + 1);
                    setAnimKeyPe2(k => k + 1);
                    setAnimKeyPe3(k => k + 1);
                    setAnimKeyPi(k => k + 1);
                }
                
                setHasGeneratedFicha(true);

                // Auto-fetch images after successful ficha generation
                if (!fieldToRegenerate && !selectedImageUrl) {
                    fetchPoiImages();
                }
            }
        } catch (e) {
            console.error('Fill ficha error:', e);
        } finally {
            setIsFillingFicha(false);
            setRegeneratingField(null);
            setLoadingStep(null);
        }
    };

    // Fetch POI images from API
    const fetchPoiImages = async (initialImages = []) => {
        setIsLoadingImages(true);
        try {
            const res = await fetch('/api/poi-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poiName: title || poi?.name, context: 'Uruapan Michoacán' })
            });
            if (res.ok) {
                const data = await res.json();
                
                // Combinar las imágenes de la investigación (si hay) con las de Wikipedia/Tavily
                let combined = [...initialImages, ...(data.images || [])];
                
                // Eliminar duplicados
                const uniqueImages = [];
                const seenUrls = new Set();
                for (const img of combined) {
                    if (!seenUrls.has(img.url)) {
                        seenUrls.add(img.url);
                        uniqueImages.push(img);
                    }
                }

                setPoiImages(uniqueImages);
            }
        } catch (err) {
            console.error('Image fetch error:', err);
        } finally {
            setIsLoadingImages(false);
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
                description: (poi?.description && poi.description.trim().length > 0) ? poi.description.trim() : 'Punto de interés',
                latitude: poi?.latitude,
                longitude: poi?.longitude,
                category: 'landmark',
                is_favorite: poi?.is_favorite || false,
                research_article: researchArticle || null,
                dato_clave_1: datoClave1.trim() || null,
                dato_clave_2: datoClave2.trim() || null,
                dato_clave_3: datoClave3.trim() || null,
                pregunta_estudio_1: preguntaEstudio1.trim() || null,
                pregunta_estudio_2: preguntaEstudio2.trim() || null,
                pregunta_estudio_3: preguntaEstudio3.trim() || null,
                pregunta_interaccion: pregunta.trim() || null,
                image_url: selectedImageUrl || null,
                ...(poi?.id ? { id: poi.id } : {})
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !poi) return null;

    const cat = autoCategory(poi?.description);
    const gradient = HEADER_GRADIENTS[cat.emoji] || HEADER_GRADIENTS['📍'];
    
    // Si hay opciones de imagen cargadas, es estrictamente obligatorio elegir una.
    const isImageSelectionRequired = poiImages.length > 0 && !selectedImageUrl;
    const isValid = title.trim().length >= 2 && !isImageSelectionRequired;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'poiFadeIn 0.2s ease-out'
        }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={scrollRef} style={{
                width: '100%', maxWidth: 600, height: '95dvh',
                background: '#FFFFFF', borderRadius: '2rem 2rem 0 0',
                display: 'flex', flexDirection: 'column',
                border: 'none',
                overflow: 'hidden',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
                animation: 'poiSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
                transform: `translateY(${modalTranslateY}px)`,
                transition: touchStartY === null ? 'transform 0.2s ease-out' : 'none'
            }}>
                {/* ═══ HEADER (PORTADA PLAYFUL) ═══ */}
                <div 
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                    background: selectedImageUrl ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${selectedImageUrl}) center/cover no-repeat` : headerColor,
                    padding: '20px 20px',
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
                            <span>
                                {ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label}
                                {activeEngine === 'rag' && tavilyUsage && (
                                    <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 4 }}>({tavilyUsage.count}/{tavilyUsage.limit})</span>
                                )}
                            </span>
                            <ChevronDown size={12} style={{
                                transition: 'transform 0.2s',
                                transform: engineDropdownOpen ? 'rotate(180deg)' : 'rotate(0)'
                            }} />
                        </button>
                        {engineDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 20, marginTop: 4, zIndex: 100,
                                background: '#1E293B', border: '1px solid #334155',
                                borderRadius: 10, padding: 4, minWidth: 220,
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
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span>{eng.label}</span>
                                            {eng.id === 'rag' && tavilyUsage && (
                                                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>
                                                    {tavilyUsage.count}/{tavilyUsage.limit} búsquedas usadas
                                                </span>
                                            )}
                                        </div>
                                        {activeEngine === eng.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#22C55E' }}>● Activo</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ SCROLLABLE BODY ═══ */}
                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

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
                                    background: '#FFFFFF',
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
                                            <div key={`article-${animKeyDc1}`} className="premium-reveal-1" style={{
                                                fontSize: 16, lineHeight: 1.6, color: '#0F172A',
                                                fontFamily: 'system-ui',
                                                padding: '8px 0 16px 0',
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
                    <div style={{ padding: '32px 24px 120px' }}>
                        <h3 style={{
                            fontSize: 11, fontWeight: 700, color: '#94A3B8',
                            textTransform: 'uppercase', letterSpacing: '0.15em',
                            margin: '0 0 24px'
                        }}>
                            Ficha Didáctica
                        </h3>
                        
                        {/* AI Fill Button (Movido hacia arriba para lógica causa-efecto) */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                            {hasGeneratedFicha ? (
                                !isEditingKeys ? (
                                    <button
                                        onClick={(e) => { e.preventDefault(); setIsEditingKeys(true); }}
                                        style={{
                                            flex: 1, padding: '16px', borderRadius: 12,
                                            background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                                            border: '1px solid #E2E8F0',
                                            color: '#475569', fontSize: 14, fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}
                                    >
                                        <><BookOpen size={18} /> Habilitar Edición de Ficha</>
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.preventDefault(); setIsEditingKeys(false); }}
                                        style={{
                                            flex: 1, padding: '16px', borderRadius: 12,
                                            background: 'rgba(15, 23, 42, 0.03)',
                                            border: '1px solid transparent',
                                            color: '#64748B', fontSize: 14, fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <><Check size={18} /> Finalizar Edición</>
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={(e) => { e.preventDefault(); handleFillFicha(false); }}
                                    disabled={isFillingFicha || regeneratingField !== null}
                                    style={{
                                        flex: 1, padding: '16px', borderRadius: 12,
                                        background: (isFillingFicha || regeneratingField !== null) ? '#F1F5F9' : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                                        border: 'none',
                                        color: (isFillingFicha || regeneratingField !== null) ? '#94A3B8' : '#FFFFFF', fontSize: 15, fontWeight: 600,
                                        cursor: (isFillingFicha || regeneratingField !== null) ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        transition: 'all 0.2s ease',
                                        boxShadow: (isFillingFicha || regeneratingField !== null) ? 'none' : '0 4px 16px rgba(139, 92, 246, 0.3)',
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
                                        <><Sparkles size={18} /> Generar Ficha con IA</>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* ═══ TARJETA A: DATO CLAVE 1 ═══ */}
                        <div key={`dc1-${animKeyDc1}`} className="premium-reveal-1" style={{
                            background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6',
                            borderRadius: 12, padding: '20px 16px 12px', marginBottom: 24, position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Dato Clave 1
                                </span>
                                {(hasGeneratedFicha && isEditingKeys) && (
                                    confirmRegenerateField === 'dato_clave_1' ? (
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FEF2F2', padding: '6px 12px', borderRadius: 12, border: '1px solid #FECACA' }}>
                                            <span style={{fontSize: 12, color: '#DC2626', fontWeight: 600}}>¿Regenerar?</span>
                                            <div style={{display: 'flex', gap: 8}}>
                                                <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'dato_clave_1'); }} style={{background:'#FEE2E2', border:'none', color:'#DC2626', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Check size={18} strokeWidth={2.5}/></button>
                                                <button onClick={(e) => { e.preventDefault(); setConfirmRegenerateField(null); }} style={{background:'#F1F5F9', border:'none', color:'#64748B', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={18} strokeWidth={2.5}/></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setConfirmRegenerateField('dato_clave_1'); }}
                                            disabled={regeneratingField !== null || isFillingFicha}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                color: regeneratingField === 'dato_clave_1' ? '#2563EB' : '#CBD5E1',
                                                transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Regenerar solo este dato"
                                        >
                                            <RefreshCw size={14} style={{ animation: regeneratingField === 'dato_clave_1' ? 'spin 1s linear infinite' : 'none' }} />
                                        </button>
                                    )
                                )}
                            </div>
                            <textarea
                                ref={dc1Ref}
                                className="no-scrollbar"
                                value={datoClave1}
                                onChange={(e) => setDatoClave1(e.target.value)}
                                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                placeholder="Un dato concreto que sorprenda..."
                                rows={1}
                                disabled={regeneratingField === 'dato_clave_1' || (hasGeneratedFicha && !isEditingKeys)}
                                style={{
                                    width: '100%', padding: '0 0 12px 0', border: 'none', background: 'transparent',
                                    fontSize: 17, color: '#0F172A', fontWeight: 400,
                                    resize: 'none', outline: 'none', boxSizing: 'border-box',
                                    lineHeight: 1.5, fontFamily: 'system-ui',
                                    borderBottom: '1px solid #E2E8F0',
                                    opacity: regeneratingField === 'dato_clave_1' ? 0.4 : 1,
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => { e.target.style.borderBottomColor = '#2563EB'; }}
                                onBlur={(e) => { e.target.style.borderBottomColor = '#E2E8F0'; }}
                            />
                            
                            {/* Pregunta de Estudio 1 */}
                            <div key={`pe1-${animKeyPe1}`} style={{ marginTop: 12, position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                    <div>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                                            🧠 RETO DE MEMORIA 1
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 500, color: '#A78BFA', marginTop: 2, display: 'block' }}>
                                            Con esta pregunta te evaluarás al entrar a "Repasar Fichas"
                                        </span>
                                    </div>
                                    {(hasGeneratedFicha && isEditingKeys) && (
                                        confirmRegenerateField === 'pregunta_estudio_1' ? (
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FEF2F2', padding: '6px 12px', borderRadius: 12, border: '1px solid #FECACA' }}>
                                                <span style={{fontSize: 12, color: '#DC2626', fontWeight: 600}}>¿Regenerar?</span>
                                                <div style={{display: 'flex', gap: 8}}>
                                                    <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'pregunta_estudio_1'); }} style={{background:'#FEE2E2', border:'none', color:'#DC2626', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Check size={18} strokeWidth={2.5}/></button>
                                                    <button onClick={(e) => { e.preventDefault(); setConfirmRegenerateField(null); }} style={{background:'#F1F5F9', border:'none', color:'#64748B', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={18} strokeWidth={2.5}/></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setConfirmRegenerateField('pregunta_estudio_1'); }}
                                                disabled={regeneratingField !== null || isFillingFicha}
                                                style={{ 
                                                    background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                    color: regeneratingField === 'pregunta_estudio_1' ? '#8B5CF6' : '#CBD5E1',
                                                    transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                                }}
                                                title="Regenerar solo esta pregunta"
                                            >
                                                <RefreshCw size={12} style={{ animation: regeneratingField === 'pregunta_estudio_1' ? 'spin 1s linear infinite' : 'none' }} />
                                            </button>
                                        )
                                    )}
                                </div>
                                <textarea
                                    ref={pe1Ref}
                                    className="no-scrollbar"
                                    value={preguntaEstudio1}
                                    onChange={(e) => setPreguntaEstudio1(e.target.value)}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    placeholder="Escribe una pregunta que te obligue a recordar el dato superior..."
                                    rows={1}
                                    disabled={regeneratingField === 'pregunta_estudio_1' || (hasGeneratedFicha && !isEditingKeys)}
                                    style={{
                                        width: '100%', padding: '0 0 8px 0', border: 'none', background: 'transparent',
                                        fontSize: 15, color: '#8B5CF6', fontWeight: 500, fontStyle: 'italic',
                                        resize: 'none', outline: 'none', boxSizing: 'border-box',
                                        lineHeight: 1.4, fontFamily: 'system-ui',
                                        opacity: regeneratingField === 'pregunta_estudio_1' ? 0.4 : 1
                                    }}
                                />
                            </div>
                        </div> {/* Fin Tarjeta A */}

                        {/* ═══ TARJETA B: DATO CLAVE 2 ═══ */}
                        <div key={`dc2-${animKeyDc2}`} className="premium-reveal-2" style={{
                            background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6',
                            borderRadius: 12, padding: '20px 16px 12px', marginBottom: 32, position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Dato Clave 2
                                </span>
                                {(hasGeneratedFicha && isEditingKeys) && (
                                    confirmRegenerateField === 'dato_clave_2' ? (
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FEF2F2', padding: '6px 12px', borderRadius: 12, border: '1px solid #FECACA' }}>
                                            <span style={{fontSize: 12, color: '#DC2626', fontWeight: 600}}>¿Regenerar?</span>
                                            <div style={{display: 'flex', gap: 8}}>
                                                <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'dato_clave_2'); }} style={{background:'#FEE2E2', border:'none', color:'#DC2626', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Check size={18} strokeWidth={2.5}/></button>
                                                <button onClick={(e) => { e.preventDefault(); setConfirmRegenerateField(null); }} style={{background:'#F1F5F9', border:'none', color:'#64748B', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={18} strokeWidth={2.5}/></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setConfirmRegenerateField('dato_clave_2'); }}
                                            disabled={regeneratingField !== null || isFillingFicha}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                color: regeneratingField === 'dato_clave_2' ? '#2563EB' : '#CBD5E1',
                                                transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Regenerar solo este dato"
                                        >
                                            <RefreshCw size={14} style={{ animation: regeneratingField === 'dato_clave_2' ? 'spin 1s linear infinite' : 'none' }} />
                                        </button>
                                    )
                                )}
                            </div>
                            <textarea
                                ref={dc2Ref}
                                className="no-scrollbar"
                                value={datoClave2}
                                onChange={(e) => setDatoClave2(e.target.value)}
                                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                placeholder="Por qué este lugar importa..."
                                rows={1}
                                disabled={regeneratingField === 'dato_clave_2' || (hasGeneratedFicha && !isEditingKeys)}
                                style={{
                                    width: '100%', padding: '0 0 12px 0', border: 'none', background: 'transparent',
                                    fontSize: 17, color: '#0F172A', fontWeight: 400,
                                    resize: 'none', outline: 'none', boxSizing: 'border-box',
                                    lineHeight: 1.5, fontFamily: 'system-ui',
                                    borderBottom: '1px solid #E2E8F0',
                                    opacity: regeneratingField === 'dato_clave_2' ? 0.4 : 1,
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => { e.target.style.borderBottomColor = '#2563EB'; }}
                                onBlur={(e) => { e.target.style.borderBottomColor = '#E2E8F0'; }}
                            />

                            {/* Pregunta de Estudio 2 */}
                            <div key={`pe2-${animKeyPe2}`} style={{ marginTop: 12, position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                    <div>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                                            🧠 RETO DE MEMORIA 2
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 500, color: '#A78BFA', marginTop: 2, display: 'block' }}>
                                            Con esta pregunta te evaluarás al entrar a "Repasar Fichas"
                                        </span>
                                    </div>
                                    {(hasGeneratedFicha && isEditingKeys) && (
                                        confirmRegenerateField === 'pregunta_estudio_2' ? (
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FEF2F2', padding: '6px 12px', borderRadius: 12, border: '1px solid #FECACA' }}>
                                                <span style={{fontSize: 12, color: '#DC2626', fontWeight: 600}}>¿Regenerar?</span>
                                                <div style={{display: 'flex', gap: 8}}>
                                                    <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'pregunta_estudio_2'); }} style={{background:'#FEE2E2', border:'none', color:'#DC2626', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Check size={18} strokeWidth={2.5}/></button>
                                                    <button onClick={(e) => { e.preventDefault(); setConfirmRegenerateField(null); }} style={{background:'#F1F5F9', border:'none', color:'#64748B', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={18} strokeWidth={2.5}/></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setConfirmRegenerateField('pregunta_estudio_2'); }}
                                                disabled={regeneratingField !== null || isFillingFicha}
                                                style={{ 
                                                    background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                    color: regeneratingField === 'pregunta_estudio_2' ? '#8B5CF6' : '#CBD5E1',
                                                    transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                                }}
                                                title="Regenerar solo esta pregunta"
                                            >
                                                <RefreshCw size={12} style={{ animation: regeneratingField === 'pregunta_estudio_2' ? 'spin 1s linear infinite' : 'none' }} />
                                            </button>
                                        )
                                    )}
                                </div>
                                <textarea
                                    ref={pe2Ref}
                                    className="no-scrollbar"
                                    value={preguntaEstudio2}
                                    onChange={(e) => setPreguntaEstudio2(e.target.value)}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    placeholder="Escribe una pregunta que te obligue a recordar el dato superior..."
                                    rows={1}
                                    disabled={regeneratingField === 'pregunta_estudio_2' || (hasGeneratedFicha && !isEditingKeys)}
                                    style={{
                                        width: '100%', padding: '0 0 8px 0', border: 'none', background: 'transparent',
                                        fontSize: 15, color: '#8B5CF6', fontWeight: 500, fontStyle: 'italic',
                                        resize: 'none', outline: 'none', boxSizing: 'border-box',
                                        lineHeight: 1.4, fontFamily: 'system-ui',
                                        opacity: regeneratingField === 'pregunta_estudio_2' ? 0.4 : 1
                                    }}
                                />
                            </div>
                        </div> {/* Fin Tarjeta B */}

                        {/* Tarjeta C (Tercer Dato Clave) */}
                        {datoClave3 ? (
                            <div key={`dc3-${animKeyDc3}`} className="premium-reveal-3" style={{
                                background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem',
                                padding: 16, marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div style={{ paddingRight: 12 }}>
                                        <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                            🌿 DATO CLAVE 3 (EXTRA)
                                        </span>
                                        <span style={{ display: 'block', fontSize: 11, color: '#64748B', lineHeight: 1.3 }}>
                                            Un dato adicional para profundizar tu dominio sobre este punto.
                                        </span>
                                    </div>
                                    {(hasGeneratedFicha && isEditingKeys) && (
                                        confirmRegenerateField === 'dato_clave_3' ? (
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FEF2F2', padding: '6px 12px', borderRadius: 12, border: '1px solid #FECACA' }}>
                                                <span style={{fontSize: 12, color: '#DC2626', fontWeight: 600}}>¿Regenerar?</span>
                                                <div style={{display: 'flex', gap: 8}}>
                                                    <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'dato_clave_3'); }} style={{background:'#FEE2E2', border:'none', color:'#DC2626', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Check size={18} strokeWidth={2.5}/></button>
                                                    <button onClick={(e) => { e.preventDefault(); setConfirmRegenerateField(null); }} style={{background:'#F1F5F9', border:'none', color:'#64748B', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={18} strokeWidth={2.5}/></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setConfirmRegenerateField('dato_clave_3'); }}
                                                disabled={regeneratingField !== null || isFillingFicha}
                                                style={{ 
                                                    background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                    color: regeneratingField === 'dato_clave_3' ? '#10B981' : '#CBD5E1',
                                                    transition: 'color 0.2s', display: 'flex', alignItems: 'center',
                                                    visibility: (hasGeneratedFicha && isEditingKeys) ? 'visible' : 'hidden'
                                                }}
                                                title="Regenerar este dato y su pregunta"
                                            >
                                                <RefreshCw size={14} style={{ animation: regeneratingField === 'dato_clave_3' ? 'spin 1s linear infinite' : 'none' }} />
                                            </button>
                                        )
                                    )}
                                </div>
                                <textarea
                                    ref={dc3Ref}
                                    className="no-scrollbar"
                                    value={datoClave3}
                                    onChange={(e) => setDatoClave3(e.target.value)}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                    placeholder="Escribe el tercer dato clave aquí..."
                                    rows={1}
                                    disabled={regeneratingField === 'dato_clave_3' || (hasGeneratedFicha && !isEditingKeys)}
                                    style={{
                                        width: '100%', padding: '0 0 12px 0', border: 'none', background: 'transparent',
                                        fontSize: 16, color: '#0F172A', fontWeight: 500,
                                        resize: 'none', outline: 'none', boxSizing: 'border-box',
                                        lineHeight: 1.5, fontFamily: 'system-ui', borderBottom: '1px solid #E2E8F0',
                                        opacity: regeneratingField === 'dato_clave_3' ? 0.4 : 1
                                    }}
                                />

                                <div style={{ marginTop: 12, position: 'relative' }}>
                                    <div style={{ marginBottom: 6 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                                            🧠 RETO DE MEMORIA 3
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 500, color: '#34D399', marginTop: 2, display: 'block' }}>
                                            Con esta pregunta te evaluarás al entrar a "Repasar Fichas"
                                        </span>
                                    </div>
                                    <textarea
                                        ref={pe3Ref}
                                        className="no-scrollbar"
                                        value={preguntaEstudio3}
                                        onChange={(e) => setPreguntaEstudio3(e.target.value)}
                                        onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                        placeholder="Escribe una pregunta que te obligue a recordar el dato superior..."
                                        rows={1}
                                        disabled={regeneratingField === 'dato_clave_3' || (hasGeneratedFicha && !isEditingKeys)}
                                        style={{
                                            width: '100%', padding: '0 0 8px 0', border: 'none', background: 'transparent',
                                            fontSize: 15, color: '#10B981', fontWeight: 500, fontStyle: 'italic',
                                            resize: 'none', outline: 'none', boxSizing: 'border-box',
                                            lineHeight: 1.4, fontFamily: 'system-ui',
                                            opacity: regeneratingField === 'dato_clave_3' ? 0.4 : 1
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            (hasGeneratedFicha && !isNewPin) && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
                                    <button 
                                        onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'dato_clave_3'); }}
                                        disabled={regeneratingField !== null || isFillingFicha}
                                        style={{
                                            background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                                            color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '16px',
                                            padding: '16px 24px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12,
                                            cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                            opacity: (regeneratingField || isFillingFicha) ? 0.6 : 1,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', width: '100%', justifyContent: 'center',
                                            transform: 'translateY(0)',
                                        }}
                                        onMouseEnter={(e) => { if (!regeneratingField && !isFillingFicha) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03)'; } }}
                                        onMouseLeave={(e) => { if (!regeneratingField && !isFillingFicha) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)'; } }}
                                    >
                                        {regeneratingField === 'dato_clave_3' ? (
                                            <><Loader2 size={20} className="animate-spin text-emerald-500" /> <span style={{color: '#64748B'}}>Generando maestría...</span></>
                                        ) : (
                                            <>
                                                <div style={{ background: '#F0FDF4', padding: '6px', borderRadius: '10px', color: '#10B981' }}>
                                                    <Sparkles size={18} strokeWidth={2.5} />
                                                </div>
                                                <span style={{letterSpacing: '-0.01em'}}>¿Ya dominas esta ficha? <span style={{color: '#10B981'}}>¡Agrega un dato clave más!</span></span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )
                        )}

                        {/* Pregunta Operativa (para el vuelo) */}
                        <div key={`pi-${animKeyPi}`} className="premium-reveal-3" style={{ marginBottom: 40, position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ paddingRight: 12 }}>
                                    <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                        🎤 PREGUNTA PARA EL VUELO (NIÑOS)
                                    </span>
                                    <span style={{ display: 'block', fontSize: 11, color: '#64748B', lineHeight: 1.3 }}>
                                        Usa esta pregunta por el intercomunicador para detonar la curiosidad de los niños al pasar por este punto.
                                    </span>
                                </div>
                                {(hasGeneratedFicha && isEditingKeys) && (
                                    confirmRegenerateField === 'pregunta_interaccion' ? (
                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#FEF2F2', padding: '6px 12px', borderRadius: 12, border: '1px solid #FECACA' }}>
                                            <span style={{fontSize: 12, color: '#DC2626', fontWeight: 600}}>¿Regenerar?</span>
                                            <div style={{display: 'flex', gap: 8}}>
                                                <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'pregunta_interaccion'); }} style={{background:'#FEE2E2', border:'none', color:'#DC2626', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Check size={18} strokeWidth={2.5}/></button>
                                                <button onClick={(e) => { e.preventDefault(); setConfirmRegenerateField(null); }} style={{background:'#F1F5F9', border:'none', color:'#64748B', cursor:'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><X size={18} strokeWidth={2.5}/></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setConfirmRegenerateField('pregunta_interaccion'); }}
                                            disabled={regeneratingField !== null || isFillingFicha}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 4, cursor: (regeneratingField || isFillingFicha) ? 'not-allowed' : 'pointer',
                                                color: regeneratingField === 'pregunta_interaccion' ? '#2563EB' : '#CBD5E1',
                                                transition: 'color 0.2s', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Regenerar solo esta pregunta"
                                        >
                                            <RefreshCw size={14} style={{ animation: regeneratingField === 'pregunta_interaccion' ? 'spin 1s linear infinite' : 'none' }} />
                                        </button>
                                    )
                                )}
                            </div>
                            <textarea
                                ref={piRef}
                                className="no-scrollbar"
                                value={pregunta}
                                onChange={(e) => setPregunta(e.target.value)}
                                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                placeholder="Una pregunta para detonar curiosidad..."
                                rows={1}
                                disabled={regeneratingField === 'pregunta_interaccion' || (hasGeneratedFicha && !isEditingKeys)}
                                style={{
                                    width: '100%', padding: '0 0 8px 0', border: 'none', background: 'transparent',
                                    fontSize: 17, color: '#0F172A', fontWeight: 400,
                                    resize: 'none', outline: 'none', boxSizing: 'border-box',
                                    lineHeight: 1.5, fontFamily: 'system-ui',
                                    borderBottom: '1px solid #E2E8F0',
                                    opacity: regeneratingField === 'pregunta_interaccion' ? 0.4 : 1,
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => { e.target.style.borderBottomColor = '#2563EB'; }}
                                onBlur={(e) => { e.target.style.borderBottomColor = '#E2E8F0'; }}
                            />
                        </div>

                        {/* ═══ IMAGE SELECTOR ═══ */}
                        {(hasGeneratedFicha || selectedImageUrl || researchArticle) && (
                            <div style={{ marginBottom: 32 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ paddingRight: 12 }}>
                                        <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                            📸 SELECCIONA LA PORTADA DE TU FICHA
                                        </span>
                                        <span style={{ display: 'block', fontSize: 11, color: '#64748B', lineHeight: 1.3 }}>
                                            Esta imagen aparecerá en el frente de tu flashcard. Elige la foto que mejor represente el exterior.
                                        </span>
                                    </div>
                                    {!isLoadingImages && poiImages.length === 0 && !selectedImageUrl && (
                                        <button
                                            onClick={fetchPoiImages}
                                            style={{
                                                background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                                                color: '#2563EB', fontSize: 11, fontWeight: 600
                                            }}
                                        >
                                            Buscar imágenes
                                        </button>
                                    )}
                                </div>

                                {isLoadingImages ? (
                                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                                        {[1,2,3,4].map(i => (
                                            <div key={i} style={{
                                                width: 80, height: 80, borderRadius: 12, flexShrink: 0,
                                                background: 'linear-gradient(110deg, #F1F5F9 30%, #E2E8F0 50%, #F1F5F9 70%)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 1.5s ease-in-out infinite'
                                            }} />
                                        ))}
                                    </div>
                                ) : poiImages.length > 0 || selectedImageUrl ? (
                                    <>
                                        <div style={{ 
                                            display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, paddingRight: 10,
                                            borderRadius: 14,
                                            padding: '0'
                                        }} className="no-scrollbar">
                                            {poiImages.map((img, i) => (
                                                    <div
                                                    key={i}
                                                    onClick={() => setSelectedImageUrl(img.url)}
                                                    style={{
                                                        width: 110, height: 85, borderRadius: 12, flexShrink: 0,
                                                        cursor: 'pointer', position: 'relative', overflow: 'hidden',
                                                        border: selectedImageUrl === img.url ? '3px solid #2563EB' : '2px solid transparent',
                                                        boxShadow: selectedImageUrl === img.url ? '0 0 0 2px rgba(37,99,235,0.25), 0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                                                        opacity: selectedImageUrl && selectedImageUrl !== img.url ? 0.6 : 1,
                                                        transform: selectedImageUrl === img.url ? 'scale(1.02)' : 'scale(1)',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                >
                                                    <img
                                                        src={img.thumbUrl || img.url}
                                                        alt={`Imagen ${i + 1}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            if (e.target.parentElement) {
                                                                e.target.parentElement.style.display = 'none';
                                                            }
                                                        }}
                                                    />
                                                    {selectedImageUrl === img.url && (
                                                        <>
                                                            <div style={{
                                                                position: 'absolute', inset: 0,
                                                                background: 'linear-gradient(to top, rgba(37,99,235,0.8), transparent 60%)'
                                                            }} />
                                                            <div style={{
                                                                position: 'absolute', bottom: 4, left: 0, right: 0,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                                            }}>
                                                                <span style={{ color: '#FFF', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portada</span>
                                                                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <span style={{ color: '#2563EB', fontSize: 9, fontWeight: 800 }}>✓</span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {poiImages.length > 0 && (
                                            <p style={{ fontSize: 10, color: '#94A3B8', margin: '4px 0 0' }}>
                                                📷 {poiImages.find(i => i.url === selectedImageUrl)?.credit || poiImages[0]?.credit || 'Fuente abierta'}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic', margin: 0 }}>
                                        No se encontraron imágenes.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* AI Fill Button removido de aquí y colocado arriba */}
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
                
                @keyframes premiumReveal {
                    0% { opacity: 0; filter: blur(8px); transform: translateX(-20px); }
                    100% { opacity: 1; filter: blur(0); transform: translateX(0); }
                }
                .premium-reveal-1 { animation: premiumReveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .premium-reveal-2 { animation: premiumReveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: 0.1s; opacity: 0; }
                .premium-reveal-3 { animation: premiumReveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: 0.2s; opacity: 0; }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
