const fs = require('fs');

const pilotFile = 'src/components/staff/POIDetailModal.js';
let content = fs.readFileSync(pilotFile, 'utf8');

const startMarker = '{/* ═══ NARRACIÓN IA — Visible cuando existe guion o audio ═══ */}';
const endMarker = '{/* ═══ IMAGE SELECTOR ═══ */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const newUI = `                        {/* ═══ FÁBRICA DE NARRATIVAS ═══ */}
                        <div style={{ padding: '0 24px 24px' }}>
                            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6', borderRadius: 12, padding: '20px 16px', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FileText size={18} color="#8B5CF6" />
                                        <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fábrica de Narrativas</span>
                                    </div>
                                    {poi?.is_official && (
                                        <span style={{
                                            background: '#3B82F6', color: '#fff', fontSize: 9,
                                            fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                            textTransform: 'uppercase', letterSpacing: '0.08em'
                                        }}>
                                            Oficial 👑
                                        </span>
                                    )}
                                </div>
                                
                                {!readOnly && (
                                    <>
                                        <div style={{ marginBottom: 20 }}>
                                            <p style={{ fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: 500 }}>
                                                Instrucciones para el Guion (Opcional):
                                            </p>
                                            <textarea
                                                value={customInstructions}
                                                onChange={(e) => { setCustomInstructions(e.target.value); if (e.target) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; } }}
                                                placeholder="Ej: Menciona su fecha de creación, o enfócate en la arquitectura..."
                                                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: 13, color: '#334155', outline: 'none', resize: 'none', minHeight: 60 }}
                                            />
                                        </div>

                                        <button onClick={handleGenerateScript} disabled={isGeneratingScript || isResearching} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#8B5CF6', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: (isGeneratingScript || isResearching) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, opacity: (isGeneratingScript || isResearching) ? 0.5 : 1 }}>
                                            {isGeneratingScript ? <><Loader2 size={16} className="animate-spin" /> Redactando guion...</> : <><Sparkles size={16} /> Investigar y Crear Guion</>}
                                        </button>
                                    </>
                                )}

                                <div style={{ marginBottom: 16, position: 'relative' }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                        Guion Narrativo
                                    </p>
                                    {readOnly ? (
                                        <p style={{
                                            fontSize: 14, lineHeight: 1.7, color: '#334155',
                                            margin: '0 0 16px', whiteSpace: 'pre-wrap', fontStyle: 'italic'
                                        }}>
                                            {narrativeScript ? \`"\${narrativeScript}"\` : 'Sin guion narrativo aún.'}
                                        </p>
                                    ) : (
                                        <>
                                            <textarea
                                                value={narrativeScript}
                                                onChange={(e) => { setNarrativeScript(e.target.value); if (e.target) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; } }}
                                                placeholder="¡Miren abajo! Ese edificio es..."
                                                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid', borderColor: isOverWordLimit ? '#FCA5A5' : '#E2E8F0', background: '#FFFFFF', fontSize: 14, color: '#0F172A', outline: 'none', resize: 'none', minHeight: 100, lineHeight: 1.5 }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: isOverWordLimit ? '#EF4444' : '#94A3B8' }}>
                                                    {wordCount}/60 palabras {isOverWordLimit && '(Demasiado largo para el vuelo)'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {!readOnly && (
                                    <button onClick={handleGenerateAudio} disabled={isGeneratingAudio || !narrativeScript || narrativeScript.length < 10} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#1E293B', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: (isGeneratingAudio || !narrativeScript || narrativeScript.length < 10) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, opacity: (isGeneratingAudio || !narrativeScript || narrativeScript.length < 10) ? 0.5 : 1 }}>
                                        {isGeneratingAudio ? <><Loader2 size={16} className="animate-spin" /> Generando Voz...</> : <><Mic size={16} /> Generar Voz (Despina)</>}
                                    </button>
                                )}

                                {audioUrl && (
                                    <div style={{ marginTop: 16, background: '#F1F5F9', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 16, background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Volume2 size={16} color="#FFF" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Voz Despina Lista</p>
                                            <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>~\${audioDuration || 15}s duración</p>
                                        </div>
                                        <audio controls src={audioUrl} style={{ height: 32, maxWidth: 120, outline: 'none' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        `;
    content = content.substring(0, startIndex) + newUI + content.substring(endIndex);
    fs.writeFileSync(pilotFile, content, 'utf8');
    console.log('Removed Ficha Didáctica correctly');
} else {
    console.log('Markers not found');
}
