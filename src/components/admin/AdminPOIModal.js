'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Save, Trash2 } from 'lucide-react';
import { EngineSelector, ResearchAccordion, NarrativeFactoryPanel, ImageSelector } from '@/components/shared/SharedNarrativeFactory';

// ═══════════════════════════════════════════════════════════════
// AdminPOIModal — Panel Admin (usa SharedNarrativeFactory)
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

const PLAYFUL_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#0284C7'];

export default function AdminPOIModal({ onClose, onSave, onDelete, poi, isNewPin = false, geoContext = '', isGeneralTopic = false }) {
    const [title, setTitle] = useState('');
    const [narrativeScript, setNarrativeScript] = useState('');
    const [audioUrl, setAudioUrl] = useState(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioDuration, setAudioDuration] = useState(null);
    const [audioGeneratedAt, setAudioGeneratedAt] = useState(null);
    const [researchArticle, setResearchArticle] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [researchPhase, setResearchPhase] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [headerColor, setHeaderColor] = useState('#2563EB');
    const [poiImages, setPoiImages] = useState([]);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [activeEngine, setActiveEngine] = useState('gemini');
    const [tavilyUsage, setTavilyUsage] = useState(null);
    const [engineToast, setEngineToast] = useState(null);
    // Track if script was edited after audio generation
    const [audioInvalidated, setAudioInvalidated] = useState(false);
    // Voice-ready keywords (auto-extracted from research)
    const [triggerKeywords, setTriggerKeywords] = useState([]);

    const nameRef = useRef(null);

    useEffect(() => {
        setHeaderColor(PLAYFUL_COLORS[Math.floor(Math.random() * PLAYFUL_COLORS.length)]);
        setTitle(poi?.name || '');
        setNarrativeScript(poi?.narrative_script || '');
        setAudioUrl(poi?.audio_url || null);
        setAudioDuration(poi?.audio_duration_seconds || null);
        setAudioGeneratedAt(poi?.audio_generated_at || null);
        setResearchArticle(poi?.research_article || '');
        setCustomInstructions('');
        setIsResearching(false);
        setIsGeneratingScript(false);
        setIsGeneratingAudio(false);
        setIsSaving(false);
        setEngineToast(null);
        setPoiImages([]);
        setSelectedImageUrl(poi?.image_url || null);
        setIsLoadingImages(false);
        setResearchPhase(null);
        setAudioInvalidated(false);
        setTriggerKeywords(poi?.trigger_keywords || []);
        if (isNewPin || isGeneralTopic) setTimeout(() => nameRef.current?.focus(), 400);
    }, [poi, isNewPin, isGeneralTopic]);

    // ═══ RESEARCH ═══
    const handleDeepResearch = async () => {
        if (isResearching) return '';
        setIsResearching(true);
        setResearchPhase('searching');
        let articleText = '';
        let researchImages = [];
        const t1 = setTimeout(() => setResearchPhase('analyzing'), 5000);
        const t2 = setTimeout(() => setResearchPhase('writing'), 10000);

        // Reverse geocode for context
        let actualGeo = geoContext;
        const lat = poi?.latitude || poi?.lat;
        const lng = poi?.longitude || poi?.lng;
        if (lat && lng) {
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                if (r.ok) { const d = await r.json(); const c = d.address?.city || d.address?.town || d.address?.village || ''; const s = d.address?.state || ''; if (c || s) actualGeo = `${c} ${s}`.trim(); }
            } catch (e) { console.warn('Nominatim failed', e); }
        }

        try {
            const res = await fetch('/api/poi-deep-research', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: title || poi?.name || '', type: poi?.description || '', context: actualGeo, lat, lon: lng, preferredEngine: activeEngine })
            });
            const data = await res.json();
            if (data.article && data.article.length > 30 && !data.allFailed) {
                articleText = data.article;
                if (data.images?.length > 0) researchImages = data.images;
                if (data.tavilyUsage) setTavilyUsage(data.tavilyUsage);
            } else {
                articleText = data.article || 'No se pudo encontrar información verificada. Intenta de nuevo.';
            }
        } catch (e) { articleText = 'Error de conexión.'; }

        clearTimeout(t1); clearTimeout(t2);
        setResearchPhase(null);
        setResearchArticle(articleText);
        setIsResearching(false);
        // Extract keywords if returned by API
        if (data.keywords?.length > 0) setTriggerKeywords(data.keywords);
        if (articleText.length > 30 && !articleText.startsWith('No se pudo') && !articleText.startsWith('Error')) fetchPoiImages(researchImages);
        return articleText;
    };

    const fetchPoiImages = async (initial = []) => {
        setIsLoadingImages(true);
        try {
            const res = await fetch('/api/poi-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poiName: title || poi?.name, context: geoContext || 'Michoacán' }) });
            if (res.ok) { const d = await res.json(); const combined = [...initial, ...(d.images || [])]; const seen = new Set(); setPoiImages(combined.filter(i => { if (seen.has(i.url)) return false; seen.add(i.url); return true; })); }
        } finally { setIsLoadingImages(false); }
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
                setAudioInvalidated(false);
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
                is_official: true,
                is_general_topic: isGeneralTopic || false,
                trigger_keywords: triggerKeywords.length > 0 ? triggerKeywords : null,
                // Chameleon: limpiar coords para temas generales
                ...(isGeneralTopic ? { latitude: null, longitude: null } : {}),
                ...(poi?.id ? { id: poi.id } : {})
            });
        } finally { setIsSaving(false); }
    };

    if (!poi) return null;

    // Candado: si hay guion pero no audio real, no se puede guardar
    const hasScript = narrativeScript && narrativeScript.trim().length >= 10;
    const needsAudio = hasScript && !audioUrl;
    const isValid = title.trim().length >= 2 && !needsAudio;

    return (
        <>
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* HEADER */}
                <div style={{ background: selectedImageUrl ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${selectedImageUrl}) center/cover no-repeat` : headerColor, padding: '24px 24px 20px', position: 'relative', flexShrink: 0, transition: 'background 0.3s ease' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                    {isGeneralTopic ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 12px', border: '1px solid rgba(245,158,11,0.4)' }}>
                            <span style={{ fontSize: 16 }}>💡</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#FDE68A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tema General</span>
                        </div>
                    ) : (
                        <>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.2)' }}>
                                <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Latitud</span>
                                <span style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace' }}>{typeof poi?.latitude === 'number' ? poi.latitude.toFixed(5) : '—'}</span>
                            </div>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.2)' }}>
                                <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Longitud</span>
                                <span style={{ color: '#fff', fontSize: 13, fontFamily: 'monospace' }}>{typeof poi?.longitude === 'number' ? poi.longitude.toFixed(5) : '—'}</span>
                            </div>
                        </>
                    )}
                </div>
                    <input ref={nameRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isNewPin ? 'Nombre del lugar...' : 'Sin nombre'} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 26, fontWeight: 800, color: '#FFFFFF', padding: 0, margin: 0, boxSizing: 'border-box' }} />
                    <EngineSelector activeEngine={activeEngine} setActiveEngine={setActiveEngine} tavilyUsage={tavilyUsage} readOnly={false} />
                </div>

                {/* BODY */}
                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 0 40px' }}>
                    <ResearchAccordion researchArticle={researchArticle} isResearching={isResearching} researchPhase={researchPhase} activeEngine={activeEngine} onResearch={handleDeepResearch} readOnly={false} onInsightClick={(text) => setCustomInstructions(prev => prev ? `${prev}\n• ${text}` : `• ${text}`)} />
                    <NarrativeFactoryPanel
                        narrativeScript={narrativeScript} setNarrativeScript={setNarrativeScript}
                        audioUrl={audioUrl} setAudioUrl={setAudioUrl}
                        audioDuration={audioDuration} setAudioDuration={setAudioDuration}
                        audioGeneratedAt={audioGeneratedAt} setAudioGeneratedAt={setAudioGeneratedAt}
                        customInstructions={customInstructions} setCustomInstructions={setCustomInstructions}
                        isGeneratingScript={isGeneratingScript} handleGenerateScript={handleGenerateScript}
                        isGeneratingAudio={isGeneratingAudio} handleGenerateAudio={handleGenerateAudio}
                        isResearching={isResearching} isOfficial={true} readOnly={false}
                        onScriptEdited={() => setAudioInvalidated(true)}
                    />
                    <ImageSelector poiImages={poiImages} selectedImageUrl={selectedImageUrl} setSelectedImageUrl={setSelectedImageUrl} isLoadingImages={isLoadingImages} fetchPoiImages={fetchPoiImages} readOnly={false} />
                </div>

                {/* FOOTER */}
                <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 12, flexShrink: 0 }}>
                    {poi?.id && onDelete && (
                        <button onClick={() => onDelete(poi.id)} disabled={isSaving} style={{ width: 52, height: 52, borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', opacity: isSaving ? 0.5 : 1, flexShrink: 0 }}>
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button onClick={handleSave} disabled={!isValid || isSaving} style={{ flex: 1, padding: '16px', borderRadius: 12, background: isValid ? (isSaving ? '#94A3B8' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)') : '#E2E8F0', cursor: (!isValid || isSaving) ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: isValid ? '#FFFFFF' : '#94A3B8', fontSize: 15, fontWeight: 800, boxShadow: isValid ? '0 4px 15px rgba(16,185,129,0.3)' : 'none' }}>
                        {isSaving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={20} />}
                        {isSaving ? 'Guardando...' : needsAudio ? '⚠️ Genera el audio primero' : isGeneralTopic ? 'Guardar Tema General 💡' : 'Establecer como Punto Oficial 👑'}
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
                @keyframes poiAccordion { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </>
    );
}
