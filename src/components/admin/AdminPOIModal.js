'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Sparkles, Save, Trash2, RefreshCw, BookOpen, Zap } from 'lucide-react';

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

const PLAYFUL_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#0284C7'];

export default function AdminPOIModal({
    onClose, onSave, onDelete,
    poi, isNewPin = false, geoContext = ''
}) {
    const [title, setTitle] = useState('');
    const [datoClave1, setDatoClave1] = useState('');
    const [datoClave2, setDatoClave2] = useState('');
    const [datoClave3, setDatoClave3] = useState('');
    const [preguntaEstudio1, setPreguntaEstudio1] = useState('');
    const [preguntaEstudio2, setPreguntaEstudio2] = useState('');
    const [preguntaEstudio3, setPreguntaEstudio3] = useState('');
    const [pregunta, setPregunta] = useState('');

    const [researchArticle, setResearchArticle] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [accordionOpen, setAccordionOpen] = useState(false);
    const [researchTriggered, setResearchTriggered] = useState(false);

    const [isFillingFicha, setIsFillingFicha] = useState(false);
    const [hasGeneratedFicha, setHasGeneratedFicha] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [headerColor, setHeaderColor] = useState('#2563EB');
    const [regeneratingField, setRegeneratingField] = useState(null);
    const [loadingStep, setLoadingStep] = useState(null);
    
    // Animation Keys
    const [animKeyDc1, setAnimKeyDc1] = useState(0);
    const [animKeyDc2, setAnimKeyDc2] = useState(0);
    const [animKeyDc3, setAnimKeyDc3] = useState(0);
    const [animKeyPe1, setAnimKeyPe1] = useState(0);
    const [animKeyPe2, setAnimKeyPe2] = useState(0);
    const [animKeyPe3, setAnimKeyPe3] = useState(0);
    const [animKeyPi, setAnimKeyPi] = useState(0);

    const [poiImages, setPoiImages] = useState([]);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    const ENGINE_OPTIONS = [
        { id: 'gemini', label: 'Gemini Flash', color: '#4285F4', icon: '🔵' },
        { id: 'rag', label: 'Tavily + Groq', color: '#F59E0B', icon: '🟡' },
        { id: 'cohere', label: 'Cohere Command A', color: '#D18EE2', icon: '🟣' }
    ];
    const [activeEngine, setActiveEngine] = useState('gemini');
    const [engineDropdownOpen, setEngineDropdownOpen] = useState(false);
    const [engineToast, setEngineToast] = useState(null);
    const [tavilyUsage, setTavilyUsage] = useState(null);

    const nameRef = useRef(null);
    const accordionRef = useRef(null);

    // Textarea resize helpers
    const resizeTextarea = (e) => {
        if (e.target) {
            e.target.style.height = 'auto';
            e.target.style.height = (e.target.scrollHeight) + 'px';
        }
    };

    useEffect(() => {
        // Auto-resize textareas when values change programmatically
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(el => {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        });
    }, [datoClave1, datoClave2, datoClave3, preguntaEstudio1, preguntaEstudio2, preguntaEstudio3, pregunta, researchArticle]);

    useEffect(() => {
        setHeaderColor(PLAYFUL_COLORS[Math.floor(Math.random() * PLAYFUL_COLORS.length)]);
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
        setIsSaving(false);
        setLoadingStep(null);
        setEngineToast(null);
        setEngineDropdownOpen(false);
        setPoiImages([]);
        setSelectedImageUrl(poi?.image_url || null);
        setIsLoadingImages(false);

        if (isNewPin) setTimeout(() => nameRef.current?.focus(), 400);
    }, [poi, isNewPin]);

    const handleDeepResearch = async (forcedEngine = null) => {
        if (isResearching) return '';
        setIsResearching(true);
        setResearchTriggered(true);
        setEngineToast(null);
        let articleText = '';
        let researchImages = [];
        
        let actualGeoContext = geoContext;
        if (poi?.latitude && poi?.longitude) {
            try {
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${poi.latitude}&lon=${poi.longitude}&format=json`);
                if (nomRes.ok) {
                    const nomData = await nomRes.json();
                    if (nomData.address) {
                        const city = nomData.address.city || nomData.address.town || nomData.address.village || nomData.address.county || '';
                        const state = nomData.address.state || '';
                        if (city || state) {
                            actualGeoContext = `${city} ${state}`.trim();
                        }
                    }
                }
            } catch (e) {
                console.warn('Nominatim reverse geocode failed in admin', e);
            }
        }

        let enginesToTry = forcedEngine ? [forcedEngine] : [activeEngine, ...ENGINE_OPTIONS.map(e => e.id).filter(id => id !== activeEngine)];
        let success = false;

        for (const engineId of enginesToTry) {
            try {
                if (engineId !== activeEngine && !forcedEngine) {
                    const prevLabel = ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label || activeEngine;
                    const newLabel = ENGINE_OPTIONS.find(e => e.id === engineId)?.label || engineId;
                    setEngineToast({ message: 'Fallback automático activado', detail: `${prevLabel} falló. Probando con ${newLabel}...` });
                    setActiveEngine(engineId);
                }

                const res = await fetch('/api/poi-deep-research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: title || poi?.name || '',
                        type: poi?.description || '',
                        context: actualGeoContext,
                        lat: poi?.latitude,
                        lon: poi?.longitude,
                        preferredEngine: engineId
                    })
                });
                const data = await res.json();
                if (data.article && data.article.length > 30) {
                    articleText = data.article;
                    if (data.images && data.images.length > 0) researchImages = data.images;
                    if (data.tavilyUsage) setTavilyUsage(data.tavilyUsage);
                    success = true;
                    if (!forcedEngine && engineId !== activeEngine) {
                        setTimeout(() => setEngineToast(null), 5000);
                    }
                    break;
                }
            } catch (e) {
                console.warn(`Engine ${engineId} failed:`, e);
            }
        }

        if (!success) {
            articleText = 'No se pudo encontrar información verificada con ninguno de los motores de IA. Intenta con otro nombre o revisa tu conexión.';
            setTimeout(() => setEngineToast(null), 5000);
        }

        setResearchArticle(articleText);
        setIsResearching(false);
        if (articleText && articleText.length > 30 && researchImages.length > 0) fetchPoiImages(researchImages);
        return articleText;
    };

    const toggleAccordion = () => {
        const opening = !accordionOpen;
        setAccordionOpen(opening);
        if (opening && !researchArticle && !researchTriggered) handleDeepResearch();
    };

    const handleFillFicha = async (isRegenerating = false, fieldToRegenerate = null) => {
        let article = researchArticle;
        if (!article || article.length < 30) {
            setAccordionOpen(true);
            setIsFillingFicha(true);
            setLoadingStep('researching');
            setTimeout(() => accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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

        if (fieldToRegenerate) setRegeneratingField(fieldToRegenerate);
        else { setIsFillingFicha(true); setLoadingStep('generating'); }

        let enginesToTry = [activeEngine, ...ENGINE_OPTIONS.map(e => e.id).filter(id => id !== activeEngine)];
        let success = false;

        for (const engineId of enginesToTry) {
            try {
                if (engineId !== activeEngine) {
                    const prevLabel = ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label || activeEngine;
                    const newLabel = ENGINE_OPTIONS.find(e => e.id === engineId)?.label || engineId;
                    setEngineToast({ message: 'Fallback automático activado', detail: `${prevLabel} falló. Generando ficha con ${newLabel}...` });
                    setActiveEngine(engineId);
                }

                const res = await fetch('/api/poi-fill-ficha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ article, poiName: title || poi?.name, regenerate: isRegenerating, fieldToRegenerate, currentValue, preferredEngine: engineId })
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    if (data.dato_clave_1 || data[fieldToRegenerate] || (fieldToRegenerate === 'dato_clave_3' && data.dato_clave_3)) {
                        success = true;
                        
                        if (fieldToRegenerate) {
                            if (fieldToRegenerate === 'dato_clave_3') {
                                if (data.dato_clave_3) { setDatoClave3(data.dato_clave_3); setAnimKeyDc3(k => k + 1); }
                                if (data.pregunta_estudio_3) { setPreguntaEstudio3(data.pregunta_estudio_3); setAnimKeyPe3(k => k + 1); }
                            } else if (fieldToRegenerate === 'dato_clave_1') {
                                if (data.dato_clave_1) { setDatoClave1(data.dato_clave_1); setAnimKeyDc1(k => k + 1); }
                                if (data.pregunta_estudio_1) { setPreguntaEstudio1(data.pregunta_estudio_1); setAnimKeyPe1(k => k + 1); }
                            } else if (fieldToRegenerate === 'dato_clave_2') {
                                if (data.dato_clave_2) { setDatoClave2(data.dato_clave_2); setAnimKeyDc2(k => k + 1); }
                                if (data.pregunta_estudio_2) { setPreguntaEstudio2(data.pregunta_estudio_2); setAnimKeyPe2(k => k + 1); }
                            } else {
                                const newValue = data[fieldToRegenerate];
                                if (newValue) {
                                    if (fieldToRegenerate === 'pregunta_estudio_1') { setPreguntaEstudio1(newValue); setAnimKeyPe1(k => k + 1); }
                                    else if (fieldToRegenerate === 'pregunta_estudio_2') { setPreguntaEstudio2(newValue); setAnimKeyPe2(k => k + 1); }
                                    else if (fieldToRegenerate === 'pregunta_interaccion') { setPregunta(newValue); setAnimKeyPi(k => k + 1); }
                                }
                            }
                        } else {
                            if (data.dato_clave_1) setDatoClave1(data.dato_clave_1);
                            if (data.dato_clave_2) setDatoClave2(data.dato_clave_2);
                            if (data.dato_clave_3) setDatoClave3(data.dato_clave_3);
                            if (data.pregunta_estudio_1) setPreguntaEstudio1(data.pregunta_estudio_1);
                            if (data.pregunta_estudio_2) setPreguntaEstudio2(data.pregunta_estudio_2);
                            if (data.pregunta_estudio_3) setPreguntaEstudio3(data.pregunta_estudio_3);
                            if (data.pregunta_interaccion) setPregunta(data.pregunta_interaccion);
                            setAnimKeyDc1(k => k + 1); setAnimKeyDc2(k => k + 1); setAnimKeyDc3(k => k + 1);
                            setAnimKeyPe1(k => k + 1); setAnimKeyPe2(k => k + 1); setAnimKeyPe3(k => k + 1); setAnimKeyPi(k => k + 1);
                        }
                        
                        setHasGeneratedFicha(true);
                        if (!fieldToRegenerate && !selectedImageUrl) fetchPoiImages();
                        if (engineId !== activeEngine) setTimeout(() => setEngineToast(null), 5000);
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Engine ${engineId} failed to generate ficha:`, err);
            }
        }

        if (!success) {
            setEngineToast({ message: 'Error en todos los motores', detail: 'Ninguna IA pudo generar la ficha. Inténtalo más tarde.' });
            setTimeout(() => setEngineToast(null), 5000);
        }

        setIsFillingFicha(false); setRegeneratingField(null); setLoadingStep(null);
    };

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
                let combined = [...initialImages, ...(data.images || [])];
                const uniqueImages = [];
                const seenUrls = new Set();
                for (const img of combined) {
                    if (!seenUrls.has(img.url)) { seenUrls.add(img.url); uniqueImages.push(img); }
                }
                setPoiImages(uniqueImages);
            }
        } finally { setIsLoadingImages(false); }
    };

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
                is_official: true,
                ...(poi?.id ? { id: poi.id } : {})
            });
            // We do not close automatically since it's a sidebar, but the parent might setEditingPoi(null)
        } finally { setIsSaving(false); }
    };

    if (!poi) return null;

    const cat = autoCategory(poi?.description);
    const isImageSelectionRequired = poiImages.length > 0 && !selectedImageUrl;
    const isValid = title.trim().length >= 2 && !isImageSelectionRequired;

    // Field definition helper
    const renderField = (fieldId, titleLabel, subtitle, textValue, setTextValue, questionValue, setQuestionValue, animKeyD, animKeyP) => (
        <div key={`${fieldId}-${animKeyD}`} className="premium-reveal" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6', borderRadius: 12, padding: '20px 16px 12px', marginBottom: 24, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{titleLabel}</span>
                {hasGeneratedFicha && (
                    <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, fieldId); }} disabled={regeneratingField !== null || isFillingFicha} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#CBD5E1' }}>
                        <RefreshCw size={14} style={{ animation: regeneratingField === fieldId ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                )}
            </div>
            <textarea ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} value={textValue} onChange={(e) => setTextValue(e.target.value)} onInput={resizeTextarea} placeholder="Dato clave..." rows={1} disabled={regeneratingField === fieldId} style={{ width: '100%', padding: '0 0 12px 0', border: 'none', background: 'transparent', fontSize: 16, color: '#0F172A', fontWeight: 500, resize: 'none', outline: 'none', lineHeight: 1.5, borderBottom: '1px solid #E2E8F0', opacity: regeneratingField === fieldId ? 0.4 : 1, overflow: 'hidden' }} />
            <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', display: 'block' }}>🧠 RETO DE MEMORIA</span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#34D399', marginTop: 2, display: 'block' }}>{subtitle}</span>
                </div>
                <textarea ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} value={questionValue} onChange={(e) => setQuestionValue(e.target.value)} onInput={resizeTextarea} placeholder="Pregunta..." rows={1} disabled={regeneratingField === fieldId} style={{ width: '100%', padding: '0 0 8px 0', border: 'none', background: 'transparent', fontSize: 15, color: '#10B981', fontWeight: 500, fontStyle: 'italic', resize: 'none', outline: 'none', lineHeight: 1.4, opacity: regeneratingField === fieldId ? 0.4 : 1, overflow: 'hidden' }} />
            </div>
        </div>
    );

    return (
        <>
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* ═══ HEADER ═══ */}
                <div style={{ background: selectedImageUrl ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${selectedImageUrl}) center/cover no-repeat` : headerColor, padding: '24px 24px 20px', position: 'relative', flexShrink: 0, transition: 'background 0.3s ease' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, background: 'rgba(255, 255, 255, 0.15)', border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <X size={18} />
                    </button>
                    
                    {/* LAT/LNG GRID AS REQUESTED */}
                    <div className="flex gap-2 mb-4">
                        <div className="flex-1 bg-white/10 rounded-lg p-2 border border-white/20">
                            <span className="block text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">Latitud</span>
                            <span className="text-white text-sm font-mono">{typeof poi?.latitude === 'number' ? poi.latitude.toFixed(5) : '—'}</span>
                        </div>
                        <div className="flex-1 bg-white/10 rounded-lg p-2 border border-white/20">
                            <span className="block text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">Longitud</span>
                            <span className="text-white text-sm font-mono">{typeof poi?.longitude === 'number' ? poi.longitude.toFixed(5) : '—'}</span>
                        </div>
                    </div>

                    <input ref={nameRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isNewPin ? 'Nombre del lugar...' : 'Sin nombre'} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 26, fontWeight: 800, color: '#FFFFFF', padding: 0, margin: 0, boxSizing: 'border-box' }} />
                    
                    <div style={{ position: 'relative', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                        <button onClick={() => setEngineDropdownOpen(!engineDropdownOpen)} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 12px', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{ENGINE_OPTIONS.find(e => e.id === activeEngine)?.icon}</span>
                            <span>{ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label} {activeEngine === 'rag' && tavilyUsage && `(${tavilyUsage.count}/${tavilyUsage.limit})`}</span>
                            <ChevronDown size={12} style={{ transform: engineDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                        </button>
                        {engineDropdownOpen && (
                            <div style={{ position: 'absolute', top: '100%', left: 20, marginTop: 4, zIndex: 100, background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: 4, minWidth: 220, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                                {ENGINE_OPTIONS.map(eng => (
                                    <button key={eng.id} onClick={() => { setActiveEngine(eng.id); setEngineDropdownOpen(false); }} style={{ width: '100%', padding: '10px 12px', background: activeEngine === eng.id ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: 8, color: '#F1F5F9', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 14 }}>{eng.icon}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span>{eng.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ BODY ═══ */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 40px' }} className="no-scrollbar">
                    {/* ACCORDION */}
                    <div ref={accordionRef} style={{ padding: '24px 24px 0' }}>
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF', marginBottom: 8 }}>
                            <button onClick={toggleAccordion} style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: accordionOpen ? '#F8FAFC' : '#FFFFFF', border: 'none', cursor: 'pointer', outline: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ background: researchArticle ? '#EFF6FF' : '#F1F5F9', width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {researchArticle ? <BookOpen size={20} color="#2563EB" /> : <Sparkles size={20} color="#64748B" />}
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0F172A' }}>{researchArticle ? 'Información generada' : 'Investigar con IA'}</h3>
                                    </div>
                                </div>
                                <ChevronDown size={20} style={{ color: '#64748B', transform: accordionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </button>
                            {accordionOpen && (
                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                                    {isResearching ? (
                                        <div style={{ textAlign: 'center', padding: '24px 0' }}><Loader2 size={24} className="animate-spin text-slate-800 mx-auto mb-2" /><p className="text-sm font-semibold">Investigando...</p></div>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', paddingBottom: 16 }}>{researchArticle || 'Sin datos.'}</div>
                                            {researchArticle && <button onClick={handleDeepResearch} className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-slate-50">Reinvestigar</button>}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* FICHA */}
                    <div style={{ padding: '24px' }}>
                        <button onClick={(e) => { e.preventDefault(); handleFillFicha(true); }} disabled={isFillingFicha || regeneratingField !== null} style={{ width: '100%', padding: '16px', borderRadius: 12, background: (isFillingFicha || regeneratingField !== null) ? '#F1F5F9' : '#8B5CF6', border: 'none', color: (isFillingFicha || regeneratingField !== null) ? '#94A3B8' : '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: (isFillingFicha || regeneratingField !== null) ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                            {isFillingFicha ? <><Loader2 size={18} className="animate-spin" /> Generando...</> : <><Sparkles size={18} /> Generar Ficha Completa</>}
                        </button>

                        {renderField('dato_clave_1', 'Dato Clave 1', 'Evalúa la memoria', datoClave1, setDatoClave1, preguntaEstudio1, setPreguntaEstudio1, animKeyDc1, animKeyPe1)}
                        {renderField('dato_clave_2', 'Dato Clave 2', 'Evalúa la memoria', datoClave2, setDatoClave2, preguntaEstudio2, setPreguntaEstudio2, animKeyDc2, animKeyPe2)}
                        {renderField('dato_clave_3', 'Dato Clave 3', 'Evalúa la memoria', datoClave3, setDatoClave3, preguntaEstudio3, setPreguntaEstudio3, animKeyDc3, animKeyPe3)}

                        <div key={`pi-${animKeyPi}`} className="premium-reveal" style={{ marginBottom: 40, position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ paddingRight: 12 }}>
                                    <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>🎤 PREGUNTA OPERATIVA</span>
                                </div>
                                {hasGeneratedFicha && (
                                    <button onClick={(e) => { e.preventDefault(); handleFillFicha(true, 'pregunta_interaccion'); }} disabled={regeneratingField !== null || isFillingFicha} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#CBD5E1' }}>
                                        <RefreshCw size={14} style={{ animation: regeneratingField === 'pregunta_interaccion' ? 'spin 1s linear infinite' : 'none' }} />
                                    </button>
                                )}
                            </div>
                            <textarea value={pregunta} onChange={(e) => setPregunta(e.target.value)} onInput={resizeTextarea} placeholder="Una pregunta para detonar curiosidad..." rows={1} disabled={regeneratingField === 'pregunta_interaccion'} style={{ width: '100%', padding: '0 0 8px 0', border: 'none', background: 'transparent', fontSize: 17, color: '#0F172A', resize: 'none', outline: 'none', lineHeight: 1.5, borderBottom: '1px solid #E2E8F0', opacity: regeneratingField === 'pregunta_interaccion' ? 0.4 : 1 }} />
                        </div>

                        {/* IMAGE SELECTOR */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div><span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📸 PORTADA</span></div>
                                {!isLoadingImages && poiImages.length === 0 && !selectedImageUrl && (
                                    <button onClick={() => fetchPoiImages()} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Buscar</button>
                                )}
                            </div>
                            {isLoadingImages ? (
                                <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>{[1,2,3,4].map(i => <div key={i} style={{ width: 80, height: 80, borderRadius: 12, background: '#E2E8F0', flexShrink: 0 }} />)}</div>
                            ) : poiImages.length > 0 || selectedImageUrl ? (
                                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12 }} className="no-scrollbar">
                                    {poiImages.map((img, i) => (
                                        <div key={i} onClick={() => setSelectedImageUrl(img.url)} style={{ width: 110, height: 85, borderRadius: 12, flexShrink: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden', border: selectedImageUrl === img.url ? '3px solid #2563EB' : '2px solid transparent' }}>
                                            <img src={img.thumbUrl || img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                            {selectedImageUrl === img.url && <div style={{ position: 'absolute', inset: 0, background: 'rgba(37,99,235,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#FFF', fontSize: 24 }}>✓</span></div>}
                                        </div>
                                    ))}
                                </div>
                            ) : <p style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic', margin: 0 }}>Sin imágenes.</p>}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 12, flexShrink: 0 }}>
                    {poi?.id && onDelete && (
                        <button onClick={() => onDelete(poi.id)} disabled={isSaving} style={{ width: 52, height: 52, borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', opacity: isSaving ? 0.5 : 1, flexShrink: 0 }}>
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button onClick={handleSave} disabled={!isValid || isSaving} className="flex-1 py-4 rounded-xl font-black text-white text-[15px] shadow-lg transition-all" style={{ background: isValid ? (isSaving ? '#94A3B8' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)') : '#E2E8F0', cursor: (!isValid || isSaving) ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        {isSaving ? 'Guardando...' : 'Establecer como Punto Oficial 👑'}
                    </button>
                </div>
            </div>
            {engineToast && (
                <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 60000, background: '#1E293B', color: '#F1F5F9', padding: '12px 20px', borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>⚡ {engineToast.message}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8' }}>{engineToast.detail}</p>
                </div>
            )}
            <style>{`
                @keyframes poiFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes poiScaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes premiumReveal { 0% { opacity: 0; filter: blur(4px); transform: translateX(-10px); } 100% { opacity: 1; filter: blur(0); transform: translateX(0); } }
                .premium-reveal { animation: premiumReveal 0.4s ease-out forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </>
    );
}
