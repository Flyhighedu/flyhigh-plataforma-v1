'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Sparkles, RefreshCw, BookOpen, ChevronDown, Zap, Mic, Volume2, FileText } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// SharedNarrativeFactory — Single Source of Truth
// Componente compartido entre Admin y Staff para:
//   - Investigación IA (acordeón)
//   - Fábrica de Narrativas (guion + audio)
//   - Selector de imágenes
// ═══════════════════════════════════════════════════════════════

const ENGINE_OPTIONS = [
    { id: 'gemini', label: 'Gemini Flash', color: '#4285F4', icon: '🔵' },
    { id: 'rag', label: 'Tavily + Groq', color: '#F59E0B', icon: '🟡' },
    { id: 'cohere', label: 'Cohere Command A', color: '#D18EE2', icon: '🟣' }
];

export function EngineSelector({ activeEngine, setActiveEngine, tavilyUsage, readOnly }) {
    const [open, setOpen] = useState(false);
    if (readOnly) return null;
    return (
        <div style={{ position: 'relative', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <button onClick={() => setOpen(!open)} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '5px 12px', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
                <span>{ENGINE_OPTIONS.find(e => e.id === activeEngine)?.icon}</span>
                <span>
                    {ENGINE_OPTIONS.find(e => e.id === activeEngine)?.label}
                    {activeEngine === 'rag' && tavilyUsage && (
                        <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 4 }}>({tavilyUsage.count}/{tavilyUsage.limit})</span>
                    )}
                </span>
                <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 20, marginTop: 4, zIndex: 100, background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: 4, minWidth: 220, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', animation: 'poiFadeIn 0.15s ease-out' }}>
                    {ENGINE_OPTIONS.map(eng => (
                        <button key={eng.id} onClick={() => { setActiveEngine(eng.id); setOpen(false); }} style={{ width: '100%', padding: '10px 12px', background: activeEngine === eng.id ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: 8, color: '#F1F5F9', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s' }}>
                            <span style={{ fontSize: 14 }}>{eng.icon}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span>{eng.label}</span>
                                {eng.id === 'rag' && tavilyUsage && (
                                    <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{tavilyUsage.count}/{tavilyUsage.limit} búsquedas</span>
                                )}
                            </div>
                            {activeEngine === eng.id && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#22C55E' }}>● Activo</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══ Highlight-to-Include: Selection-based interaction ═══

// Renders research text with bold formatting + permanent highlights for used snippets
function renderResearchText(text, usedSnippets = []) {
    if (!text) return <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sin datos. Se generarán automáticamente al crear el guion.</span>;

    // Step 1: Parse **bold** markers into segments
    const parts = text.split(/(\*\*.*?\*\*)/g);
    const rendered = parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
        const content = boldMatch ? boldMatch[1] : part;
        const isBold = !!boldMatch;

        // Check if this segment (or a portion) was already used
        const isUsed = usedSnippets.some(s => content.includes(s) || s.includes(content));

        if (isBold) {
            return (
                <span key={i} data-bold-text={content} style={{
                    fontWeight: 700,
                    color: isUsed ? '#059669' : '#0F172A',
                    background: isUsed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.06)',
                    borderRadius: 3,
                    padding: '1px 3px',
                    cursor: 'pointer',
                    borderBottom: isUsed ? '2px solid #10B981' : '2px dashed #C4B5FD',
                    transition: 'all 0.3s ease',
                }}>
                    {isUsed && <span style={{ fontSize: 10, marginRight: 2 }}>✓</span>}
                    {content}
                </span>
            );
        }

        // For non-bold text, check if any used snippet matches a portion
        if (usedSnippets.length === 0 || !content.trim()) return <span key={i}>{content}</span>;

        // Highlight used portions within plain text
        let remaining = content;
        const fragments = [];
        let fragIdx = 0;
        for (const snippet of usedSnippets) {
            if (snippet.length < 4) continue; // Skip very short snippets
            const idx = remaining.indexOf(snippet);
            if (idx !== -1) {
                if (idx > 0) fragments.push(<span key={`${i}-${fragIdx++}`}>{remaining.slice(0, idx)}</span>);
                fragments.push(
                    <mark key={`${i}-${fragIdx++}`} style={{
                        background: 'rgba(250, 204, 21, 0.25)',
                        borderRadius: 2, padding: '0 1px',
                        borderBottom: '2px solid #FBBF24',
                    }}>{snippet}</mark>
                );
                remaining = remaining.slice(idx + snippet.length);
            }
        }
        if (fragments.length > 0) {
            if (remaining) fragments.push(<span key={`${i}-${fragIdx++}`}>{remaining}</span>);
            return <span key={i}>{fragments}</span>;
        }

        return <span key={i}>{content}</span>;
    });

    return rendered;
}

export function ResearchAccordion({ researchArticle, isResearching, researchPhase, activeEngine, onResearch, readOnly, onInsightClick }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const textRef = useRef(null);

    // Selection popup state
    const [selPopup, setSelPopup] = useState(null); // { text, x, y }
    // Memory: used snippets
    const [usedSnippets, setUsedSnippets] = useState([]);

    const toggle = () => {
        const opening = !open;
        setOpen(opening);
        if (opening && !researchArticle && onResearch) onResearch();
    };

    // Bold click handler (event delegation)
    const handleTextClick = (e) => {
        if (readOnly || !onInsightClick) return;
        const boldEl = e.target.closest('[data-bold-text]');
        if (boldEl) {
            const text = boldEl.getAttribute('data-bold-text');
            if (text) {
                onInsightClick(text);
                setUsedSnippets(prev => [...prev, text]);
            }
        }
    };

    // Listen for free text selection within the research container
    useEffect(() => {
        if (!open || readOnly || !researchArticle) return;

        const handleSelectionEnd = () => {
            // Small delay to let selection finalize
            setTimeout(() => {
                const sel = window.getSelection();
                const text = sel?.toString()?.trim();
                if (!text || text.length < 3) { setSelPopup(null); return; }

                // Ensure selection is inside our research container
                if (textRef.current && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    if (!textRef.current.contains(range.commonAncestorContainer)) { setSelPopup(null); return; }

                    // getBoundingClientRect returns viewport-relative coords — perfect for position:fixed portal
                    const rect = range.getBoundingClientRect();
                    setSelPopup({
                        text,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                    });
                }
            }, 10);
        };

        const handleDismiss = (e) => {
            if (selPopup && !e.target.closest('[data-sel-popup]')) {
                setSelPopup(null);
            }
        };

        document.addEventListener('mouseup', handleSelectionEnd);
        document.addEventListener('touchend', handleSelectionEnd);
        document.addEventListener('mousedown', handleDismiss);
        return () => {
            document.removeEventListener('mouseup', handleSelectionEnd);
            document.removeEventListener('touchend', handleSelectionEnd);
            document.removeEventListener('mousedown', handleDismiss);
        };
    }, [open, readOnly, researchArticle, selPopup]);

    // Handle popup button click
    const handleAddSelection = () => {
        if (!selPopup?.text || !onInsightClick) return;
        onInsightClick(selPopup.text);
        setUsedSnippets(prev => [...prev, selPopup.text]);
        setSelPopup(null);
        window.getSelection()?.removeAllRanges();
    };

    return (
        <div ref={ref} style={{ padding: '0 20px', marginTop: 16 }}>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: 8 }}>
                <button onClick={toggle} style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: open ? '#F8FAFC' : '#FFFFFF', border: 'none', cursor: 'pointer', transition: 'background 0.2s ease', outline: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: researchArticle ? '#EFF6FF' : '#F1F5F9', width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                    <ChevronDown size={20} style={{ color: '#64748B', transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                {open && (
                    <div style={{ padding: '0 16px 16px', animation: 'poiAccordion 0.3s ease-out', borderTop: '1px solid #E2E8F0', background: '#FFFFFF', paddingTop: 16 }}>
                        {isResearching ? (
                            <div style={{ padding: '20px 0' }}>
                                {[
                                    { id: 'searching', label: 'Buscando en fuentes verificadas...' },
                                    { id: 'analyzing', label: 'Analizando datos encontrados...' },
                                    { id: 'writing', label: 'Redactando visión general...' }
                                ].map((phase, idx) => {
                                    const phases = ['searching', 'analyzing', 'writing'];
                                    const currentIdx = phases.indexOf(researchPhase);
                                    const isActive = phase.id === researchPhase;
                                    const isDone = idx < currentIdx;
                                    const isPending = idx > currentIdx;
                                    return (
                                        <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                            {isDone ? (
                                                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                                            ) : isActive ? (
                                                <Loader2 size={18} style={{ color: '#2563EB', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                                            ) : (
                                                <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #CBD5E1', flexShrink: 0 }} />
                                            )}
                                            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#0F172A' : '#64748B' }}>{phase.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <>
                                {/* Discoverability hint */}
                                {researchArticle && !readOnly && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FEF3C7' }}>
                                        <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                                        <span style={{ fontSize: 11, color: '#92400E', fontWeight: 500, lineHeight: 1.4 }}>
                                            Selecciona cualquier texto para agregarlo a las instrucciones del guion
                                        </span>
                                    </div>
                                )}
                                <div ref={textRef} onClick={handleTextClick} style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', padding: '8px 0 16px 0', whiteSpace: 'pre-wrap', userSelect: readOnly ? 'auto' : 'text', position: 'relative' }}>
                                    {renderResearchText(researchArticle, usedSnippets)}
                                </div>
                                {researchArticle && !readOnly && (
                                    <button onClick={onResearch} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <RefreshCw size={14} /> Reinvestigar
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ FLOATING POPUP — rendered via Portal to escape overflow:hidden ═══ */}
            {selPopup && typeof document !== 'undefined' && createPortal(
                <div
                    data-sel-popup="true"
                    style={{
                        position: 'fixed',
                        top: selPopup.y - 10,
                        left: Math.max(60, Math.min(selPopup.x, window.innerWidth - 60)),
                        transform: 'translate(-50%, -100%)',
                        zIndex: 99999,
                        animation: 'poiFadeIn 0.12s ease-out',
                        pointerEvents: 'auto',
                    }}
                >
                    <button
                        onClick={handleAddSelection}
                        style={{
                            background: '#1E293B',
                            color: '#F1F5F9',
                            border: 'none',
                            borderRadius: 10,
                            padding: '8px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <span style={{ fontSize: 14 }}>➕</span>
                        Agregar a instrucciones
                    </button>
                    <div style={{
                        width: 0, height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '6px solid #1E293B',
                        margin: '0 auto',
                    }} />
                </div>,
                document.body
            )}
        </div>
    );
}

export function NarrativeFactoryPanel({
    narrativeScript, setNarrativeScript,
    audioUrl, setAudioUrl,
    audioDuration, setAudioDuration,
    audioGeneratedAt, setAudioGeneratedAt,
    customInstructions, setCustomInstructions,
    isGeneratingScript, handleGenerateScript,
    isGeneratingAudio, handleGenerateAudio,
    isResearching, isOfficial, readOnly,
    // Track script-audio sync
    onScriptEdited
}) {
    const wordCount = narrativeScript ? narrativeScript.trim().split(/\s+/).filter(Boolean).length : 0;
    const isOverWordLimit = wordCount > 60;

    // Candado: si el usuario edita el guion DESPUÉS de generar audio, invalidar audio
    const handleScriptChange = (e) => {
        setNarrativeScript(e.target.value);
        if (e.target) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }
        // Si ya había audio generado, invalidarlo
        if (audioUrl) {
            setAudioUrl(null);
            setAudioDuration(null);
            setAudioGeneratedAt(null);
            if (onScriptEdited) onScriptEdited();
        }
    };

    // Formatear duración limpia (sin $)
    const formatDuration = (sec) => {
        if (!sec || sec <= 0) return '~15s';
        if (sec < 60) return `${sec}s`;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div style={{ padding: '0 24px 24px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6', borderRadius: 12, padding: '20px 16px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={18} color="#8B5CF6" />
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fábrica de Narrativas</span>
                    </div>
                    {isOfficial && (
                        <span style={{ background: '#3B82F6', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Oficial 👑
                        </span>
                    )}
                </div>

                {/* Instrucciones personalizadas */}
                {!readOnly && (
                    <>
                        <div style={{ marginBottom: 20 }}>
                            <p style={{ fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: 500 }}>
                                Instrucciones para el Guion (Opcional):
                            </p>
                            <textarea
                                value={customInstructions}
                                onChange={(e) => { setCustomInstructions(e.target.value); if (e.target) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; } }}
                                placeholder="Escribe aquí o selecciona texto de la investigación ☝️ para agregarlo..."
                                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: 13, color: '#334155', outline: 'none', resize: 'none', minHeight: 60, boxSizing: 'border-box' }}
                            />
                        </div>
                        <button onClick={handleGenerateScript} disabled={isGeneratingScript || isResearching} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#8B5CF6', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: (isGeneratingScript || isResearching) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, opacity: (isGeneratingScript || isResearching) ? 0.5 : 1 }}>
                            {isGeneratingScript ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Redactando guion...</> : <><Sparkles size={16} /> Investigar y Crear Guion</>}
                        </button>
                    </>
                )}

                {/* Guion */}
                <div style={{ marginBottom: 16, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Guion Narrativo</span>
                        {narrativeScript && !readOnly && (
                            <button onClick={handleGenerateScript} disabled={isGeneratingScript} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#CBD5E1' }}>
                                <RefreshCw size={14} style={{ animation: isGeneratingScript ? 'spin 1s linear infinite' : 'none' }} />
                            </button>
                        )}
                    </div>
                    {readOnly ? (
                        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#334155', margin: '0 0 16px', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                            {narrativeScript ? `"${narrativeScript}"` : 'Sin guion narrativo aún.'}
                        </p>
                    ) : (
                        <>
                            <textarea
                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                value={narrativeScript}
                                onChange={handleScriptChange}
                                placeholder="¡Miren abajo! Ese edificio es..."
                                disabled={isGeneratingScript}
                                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid', borderColor: isOverWordLimit ? '#FCA5A5' : '#E2E8F0', background: '#FFFFFF', fontSize: 14, color: '#0F172A', outline: 'none', resize: 'none', minHeight: 100, lineHeight: 1.5, boxSizing: 'border-box', opacity: isGeneratingScript ? 0.6 : 1, overflow: 'hidden' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: isOverWordLimit ? '#EF4444' : '#94A3B8' }}>
                                    {wordCount}/60 palabras {isOverWordLimit && '(Demasiado largo)'}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Botón generar audio */}
                {!readOnly && (
                    <button onClick={handleGenerateAudio} disabled={isGeneratingAudio || !narrativeScript || narrativeScript.length < 10} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#1E293B', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: (isGeneratingAudio || !narrativeScript || narrativeScript.length < 10) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, opacity: (isGeneratingAudio || !narrativeScript || narrativeScript.length < 10) ? 0.5 : 1 }}>
                        {isGeneratingAudio ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando Voz...</> : <><Mic size={16} /> Generar Voz (Despina)</>}
                    </button>
                )}

                {/* Audio player */}
                {audioUrl && (
                    <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 16, background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Volume2 size={16} color="#FFF" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Voz Despina Lista</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>
                                {formatDuration(audioDuration)} duración
                            </p>
                        </div>
                        <audio controls src={audioUrl} style={{ height: 32, maxWidth: 120, outline: 'none' }} />
                    </div>
                )}
            </div>
        </div>
    );
}

export function ImageSelector({ poiImages, selectedImageUrl, setSelectedImageUrl, isLoadingImages, fetchPoiImages, readOnly }) {
    if (readOnly) return null;
    return (
        <div style={{ padding: '0 24px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📸 PORTADA</span>
                {!isLoadingImages && poiImages.length === 0 && !selectedImageUrl && fetchPoiImages && (
                    <button onClick={() => fetchPoiImages()} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Buscar</button>
                )}
            </div>
            {isLoadingImages ? (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {[1, 2, 3, 4].map(i => <div key={i} style={{ width: 80, height: 80, borderRadius: 12, background: '#E2E8F0', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
                </div>
            ) : poiImages.length > 0 || selectedImageUrl ? (
                <>
                    <div className="no-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12 }}>
                        {poiImages.map((img, i) => (
                            <div key={i} onClick={() => setSelectedImageUrl(img.url)} style={{ width: 110, height: 85, borderRadius: 12, flexShrink: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden', border: selectedImageUrl === img.url ? '3px solid #2563EB' : '2px solid transparent', transition: 'border 0.2s' }}>
                                <img src={img.thumbUrl || img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                {selectedImageUrl === img.url && (
                                    <>
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(37,99,235,0.8), transparent 60%)' }} />
                                        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
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
                <p style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic', margin: 0 }}>Sin imágenes disponibles.</p>
            )}
        </div>
    );
}
