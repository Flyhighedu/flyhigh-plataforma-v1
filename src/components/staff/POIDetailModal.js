'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Sparkles, Save, Trash2, RefreshCw, BookOpen, Search, Zap, Check, Mic, Play, Pause, Volume2, FileText } from 'lucide-react';
import { EngineSelector, ResearchAccordion, NarrativeFactoryPanel, ImageSelector } from '@/components/shared/SharedNarrativeFactory';

// ═══════════════════════════════════════════════════════════════
// POIDetailModal — Modal Staff (usa SharedNarrativeFactory)
// Soporta readOnly para POIs oficiales y edición completa para personales.
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

export default function POIDetailModal({
    isOpen, onClose, onSave, onDelete,
    poi, isNewPin = false, geoContext = '',
    readOnly = false
}) {
    // Form state
    const [title, setTitle] = useState('');

    // Narrative Factory States
    const [narrativeScript, setNarrativeScript] = useState('');
    const [audioUrl, setAudioUrl] = useState(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioDuration, setAudioDuration] = useState(null);
    const [audioGeneratedAt, setAudioGeneratedAt] = useState(null);
    const [customInstructions, setCustomInstructions] = useState('');

    // Research state
    const [researchArticle, setResearchArticle] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [researchPhase, setResearchPhase] = useState(null);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [headerColor, setHeaderColor] = useState('#2563EB');

    // Image selector state
    const [poiImages, setPoiImages] = useState([]);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    // Engine state
    const [activeEngine, setActiveEngine] = useState('gemini');
    const [tavilyUsage, setTavilyUsage] = useState(null);
    const [engineToast, setEngineToast] = useState(null);

    const nameRef = useRef(null);
    const scrollRef = useRef(null);

    // Initialize form when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setHeaderColor(PLAYFUL_COLORS[Math.floor(Math.random() * PLAYFUL_COLORS.length)]);
        setTitle(poi?.name || '');
        setNarrativeScript(poi?.narrative_script || '');
        setAudioUrl(poi?.audio_url || null);
        setAudioDuration(poi?.audio_duration_seconds || null);
        setAudioGeneratedAt(poi?.audio_generated_at || null);
        setResearchArticle(poi?.research_article || '');
        setCustomInstructions('');
        setIsGeneratingScript(false);
        setIsGeneratingAudio(false);
        setResearchPhase(null);
        setIsResearching(false);
        setIsSaving(false);
        setEngineToast(null);
        setModalTranslateY(0);
        setPoiImages([]);
        setSelectedImageUrl(poi?.image_url || null);
        setIsLoadingImages(false);
        if (isNewPin) setTimeout(() => nameRef.current?.focus(), 400);
    }, [isOpen, poi, isNewPin]);

    // Swipe to close logic
    const [touchStartY, setTouchStartY] = useState(null);
    const [modalTranslateY, setModalTranslateY] = useState(0);

    const handleTouchStart = (e) => setTouchStartY(e.touches[0].clientY);
    const handleTouchMove = (e) => {
        if (touchStartY === null) return;
        const diff = e.touches[0].clientY - touchStartY;
        if (diff > 0) setModalTranslateY(diff);
    };
    const handleTouchEnd = () => {
        if (modalTranslateY > 150) { onClose(); setTimeout(() => setModalTranslateY(0), 300); }
        else setModalTranslateY(0);
        setTouchStartY(null);
    };

    // ═══ RESEARCH ═══
    const handleDeepResearch = async () => {
        if (isResearching) return '';
        setIsResearching(true);
        setEngineToast(null);
        setResearchPhase('searching');
        let articleText = '';
        let researchImages = [];
        const t1 = setTimeout(() => setResearchPhase('analyzing'), 5000);
        const t2 = setTimeout(() => setResearchPhase('writing'), 10000);
        try {
            const res = await fetch('/api/poi-deep-research', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: title || poi?.name || '', type: poi?.description || '', context: geoContext, lat: poi?.latitude, lon: poi?.longitude, preferredEngine: activeEngine })
            });
            const data = await res.json();
            if (data.article && data.article.length > 30) {
                articleText = data.article;
                if (data.images?.length > 0) researchImages = data.images;
                if (data.tavilyUsage) setTavilyUsage(data.tavilyUsage);
                // No auto-switch engines (user request)
                if (data.engine && data.engine !== 'none') setActiveEngine(data.engine);
            } else { articleText = data.article || 'No se encontró información verificada.'; }
        } catch (e) { articleText = 'Error de conexión. Verifica tu internet.'; }
        clearTimeout(t1); clearTimeout(t2);
        setResearchPhase(null);
        setResearchArticle(articleText);
        setIsResearching(false);
        if (articleText.length > 30) fetchPoiImages(researchImages);
        return articleText;
    };

    // Fetch images
    const fetchPoiImages = async (initial = []) => {
        setIsLoadingImages(true);
        try {
            const res = await fetch('/api/poi-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poiName: title || poi?.name, context: geoContext || 'Uruapan Michoacán' }) });
            if (res.ok) { const d = await res.json(); const combined = [...initial, ...(d.images || [])]; const seen = new Set(); setPoiImages(combined.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; })); }
        } catch (err) { console.error('Image fetch error:', err); }
        finally { setIsLoadingImages(false); }
    };

    // ═══ SCRIPT ═══
    const handleGenerateScript = async () => {
        setIsGeneratingScript(true);
        try {
            let article = researchArticle;
            if (!article || article.length < 30) { article = await handleDeepResearch(); }
            const res = await fetch('/api/poi-generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poiName: title || poi?.name || '', lat: poi?.latitude || poi?.lat, lng: poi?.longitude || poi?.lng, researchArticle: article, customInstructions }) });
            const data = await res.json();
            if (res.ok && data.script) { setNarrativeScript(data.script); setAudioUrl(null); setAudioDuration(null); setAudioGeneratedAt(null); }
            else { setEngineToast({ message: 'Error', detail: data.error || 'No se pudo generar el guion' }); setTimeout(() => setEngineToast(null), 5000); }
        } catch (err) { console.error(err); } finally { setIsGeneratingScript(false); }
    };

    // ═══ AUDIO ═══
    const handleGenerateAudio = async () => {
        if (!narrativeScript || narrativeScript.length < 10) return;
        setIsGeneratingAudio(true);
        try {
            const res = await fetch('/api/poi-generate-audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poiId: poi?.id || `temp-${Date.now()}`, narrativeScript }) });
            const data = await res.json();
            if (res.ok && data.audio_url) {
                setAudioUrl(data.audio_url);
                setAudioGeneratedAt(new Date().toISOString());
                setAudioDuration(data.audio_duration_seconds || Math.round((narrativeScript.trim().split(/\s+/).length / 60) * 15));
            } else { setEngineToast({ message: 'Error', detail: data.error || 'No se pudo generar el audio' }); setTimeout(() => setEngineToast(null), 5000); }
        } catch (err) { console.error(err); } finally { setIsGeneratingAudio(false); }
    };

    // ═══ SAVE ═══
    const handleSave = async () => {
        const t = title.trim();
        if (t.length < 2 || isSaving) return;
        setIsSaving(true);
        try {
            await onSave({
                name: t,
                description: (poi?.description?.trim()?.length > 0) ? poi.description.trim() : 'Punto de interés',
                latitude: poi?.latitude, longitude: poi?.longitude,
                category: 'landmark', is_favorite: poi?.is_favorite || false,
                research_article: researchArticle || null,
                narrative_script: narrativeScript || null,
                audio_url: audioUrl || null,
                audio_duration_seconds: audioDuration || null,
                audio_generated_at: audioGeneratedAt || null,
                image_url: selectedImageUrl || null,
                ...(poi?.id ? { id: poi.id } : {})
            });
        } finally { setIsSaving(false); }
    };

    if (!isOpen || !poi) return null;

    const cat = autoCategory(poi?.description);
    const isGeneral = poi?.is_general_topic || (poi?.latitude == null && poi?.longitude == null);
    const effectiveReadOnly = readOnly || poi?.is_official;

    // Candado: si hay guion pero no audio real, bloquear guardado
    const hasScript = narrativeScript && narrativeScript.trim().length >= 10;
    const needsAudio = hasScript && !audioUrl;
    const isValid = title.trim().length >= 2 && !needsAudio;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'poiFadeIn 0.2s ease-out' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={scrollRef} style={{ width: '100%', maxWidth: 600, height: '95dvh', background: '#FFFFFF', borderRadius: '2rem 2rem 0 0', display: 'flex', flexDirection: 'column', border: 'none', overflow: 'hidden', boxShadow: '0 -10px 40px rgba(0,0,0,0.15)', animation: 'poiSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)', transform: `translateY(${modalTranslateY}px)`, transition: touchStartY === null ? 'transform 0.2s ease-out' : 'none' }}>

                {/* ═══ HEADER ═══ */}
                <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ background: selectedImageUrl ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${selectedImageUrl}) center/cover no-repeat` : headerColor, padding: '20px 20px', position: 'relative', flexShrink: 0, transition: 'background 0.3s ease' }}>
                    <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 10, margin: '0 auto 16px' }} />
                    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: isGeneral ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 10px', border: isGeneral ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.3)' }}>
                            <span style={{ fontSize: 14, lineHeight: 1 }}>{isGeneral ? '💡' : cat.emoji}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isGeneral ? 'Tema General' : cat.label}</span>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: poi?.is_official ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', border: poi?.is_official ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.2)' }}>
                            <span style={{ fontSize: 12, lineHeight: 1 }}>{poi?.is_official ? '👑' : '👤'}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{poi?.is_official ? 'Oficial' : 'Personal'}</span>
                        </div>
                    </div>
                    <input ref={nameRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isNewPin ? 'Nombre del punto...' : 'Sin nombre'} maxLength={100} disabled={effectiveReadOnly} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 26, fontWeight: 800, color: '#FFFFFF', padding: 0, margin: 0, fontFamily: 'system-ui', letterSpacing: '-0.03em', boxSizing: 'border-box' }} />
                    {isGeneral ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <span style={{ fontSize: 12 }}>💡</span>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>Sin ubicación geográfica</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <span style={{ fontSize: 12 }}>📍</span>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500, fontFamily: 'monospace' }}>
                                {typeof poi?.latitude === 'number' ? poi.latitude.toFixed(5) : '—'}, {typeof poi?.longitude === 'number' ? poi.longitude.toFixed(5) : '—'}
                            </p>
                        </div>
                    )}
                    <EngineSelector activeEngine={activeEngine} setActiveEngine={setActiveEngine} tavilyUsage={tavilyUsage} readOnly={effectiveReadOnly} />
                </div>

                {/* ═══ SCROLLABLE BODY ═══ */}
                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <ResearchAccordion researchArticle={researchArticle} isResearching={isResearching} researchPhase={researchPhase} activeEngine={activeEngine} onResearch={handleDeepResearch} readOnly={effectiveReadOnly} onInsightClick={(text) => setCustomInstructions(prev => prev ? `${prev}\n• ${text}` : `• ${text}`)} />
                    <NarrativeFactoryPanel
                        narrativeScript={narrativeScript} setNarrativeScript={setNarrativeScript}
                        audioUrl={audioUrl} setAudioUrl={setAudioUrl}
                        audioDuration={audioDuration} setAudioDuration={setAudioDuration}
                        audioGeneratedAt={audioGeneratedAt} setAudioGeneratedAt={setAudioGeneratedAt}
                        customInstructions={customInstructions} setCustomInstructions={setCustomInstructions}
                        isGeneratingScript={isGeneratingScript} handleGenerateScript={handleGenerateScript}
                        isGeneratingAudio={isGeneratingAudio} handleGenerateAudio={handleGenerateAudio}
                        isResearching={isResearching} isOfficial={poi?.is_official} readOnly={effectiveReadOnly}
                    />
                    <ImageSelector poiImages={poiImages} selectedImageUrl={selectedImageUrl} setSelectedImageUrl={setSelectedImageUrl} isLoadingImages={isLoadingImages} fetchPoiImages={fetchPoiImages} readOnly={effectiveReadOnly} />
                </div>

                {/* ═══ STICKY FOOTER ═══ */}
                {!effectiveReadOnly && (
                    <div style={{ padding: '16px 20px 24px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 12, flexShrink: 0 }}>
                        {poi?.id && onDelete && (
                            <button onClick={() => onDelete(poi.id)} disabled={isSaving} style={{ width: 52, height: 52, borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', opacity: isSaving ? 0.5 : 1, flexShrink: 0 }}>
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button onClick={handleSave} disabled={!isValid || isSaving} style={{ flex: 1, height: 52, borderRadius: 12, background: isValid ? (isSaving ? '#94A3B8' : 'linear-gradient(135deg, #10B981, #059669)') : '#E2E8F0', border: 'none', color: isValid ? '#FFFFFF' : '#94A3B8', fontSize: 15, fontWeight: 800, cursor: (!isValid || isSaving) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: isValid ? '0 4px 15px rgba(16,185,129,0.3)' : 'none' }}>
                            {isSaving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={20} />}
                            {isSaving ? 'Guardando...' : needsAudio ? '⚠️ Genera el audio primero' : 'Guardar Punto'}
                        </button>
                    </div>
                )}
            </div>

            {/* Engine Toast */}
            {engineToast && (
                <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 60000, background: '#1E293B', color: '#F1F5F9', padding: '12px 20px', borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', animation: 'poiFadeIn 0.15s ease-out' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>⚡ {engineToast.message}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{engineToast.detail}</p>
                </div>
            )}

            <style>{`
                @keyframes poiFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes poiSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                @keyframes poiAccordion { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
