const fs = require('fs');

const pilotFile = 'src/components/staff/POIDetailModal.js';
let content = fs.readFileSync(pilotFile, 'utf8');

// 1. Imports
content = content.replace(
    "import { X, ChevronDown, Loader2, Sparkles, Save, Trash2, RefreshCw, BookOpen, Search, Zap, Check } from 'lucide-react';",
    "import { X, ChevronDown, Loader2, Sparkles, Save, Trash2, RefreshCw, BookOpen, Search, Zap, Check, Mic, Play, Pause, Volume2, FileText } from 'lucide-react';"
);

// 2. States
const statesOld = `    // Form state
    const [title, setTitle] = useState('');
    const [datoClave1, setDatoClave1] = useState('');
    const [datoClave2, setDatoClave2] = useState('');
    const [datoClave3, setDatoClave3] = useState('');
    const [preguntaEstudio1, setPreguntaEstudio1] = useState('');
    const [preguntaEstudio2, setPreguntaEstudio2] = useState('');
    const [preguntaEstudio3, setPreguntaEstudio3] = useState('');
    const [pregunta, setPregunta] = useState('');`;

const statesNew = `    // Form state
    const [title, setTitle] = useState('');
    const [datoClave1, setDatoClave1] = useState('');
    const [datoClave2, setDatoClave2] = useState('');
    const [datoClave3, setDatoClave3] = useState('');
    const [preguntaEstudio1, setPreguntaEstudio1] = useState('');
    const [preguntaEstudio2, setPreguntaEstudio2] = useState('');
    const [preguntaEstudio3, setPreguntaEstudio3] = useState('');
    const [pregunta, setPregunta] = useState('');

    // Narrative Factory States
    const [narrativeScript, setNarrativeScript] = useState('');
    const [audioUrl, setAudioUrl] = useState(null);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioDuration, setAudioDuration] = useState(null);
    const [audioGeneratedAt, setAudioGeneratedAt] = useState(null);
    const [customInstructions, setCustomInstructions] = useState('');
    const [researchPhase, setResearchPhase] = useState(null);`;
content = content.replace(statesOld, statesNew);

// 3. Init states
const initOld = `        setPregunta(poi?.pregunta_interaccion || '');
        setResearchArticle(poi?.research_article || '');
        setAccordionOpen(false);`;
        
const initNew = `        setPregunta(poi?.pregunta_interaccion || '');
        setResearchArticle(poi?.research_article || '');
        setNarrativeScript(poi?.narrative_script || '');
        setAudioUrl(poi?.audio_url || null);
        setAudioDuration(poi?.audio_duration_seconds || null);
        setAudioGeneratedAt(poi?.audio_generated_at || null);
        setCustomInstructions('');
        setIsGeneratingScript(false);
        setIsGeneratingAudio(false);
        setResearchPhase(null);
        setAccordionOpen(false);`;
content = content.replace(initOld, initNew);

// 4. handleSave
const saveOld = `                pregunta_interaccion: pregunta.trim() || null,
                image_url: selectedImageUrl || null,
                ...(poi?.id ? { id: poi.id } : {})`;

const saveNew = `                pregunta_interaccion: pregunta.trim() || null,
                image_url: selectedImageUrl || null,
                narrative_script: narrativeScript || null,
                audio_url: audioUrl || null,
                audio_duration_seconds: audioDuration || null,
                audio_generated_at: audioGeneratedAt || null,
                ...(poi?.id ? { id: poi.id } : {})`;
content = content.replace(saveOld, saveNew);

// 5. Add handleGenerateScript & handleGenerateAudio before handleSave
const handleSaveRegex = /    \/\/ Save — single POST\n    const handleSave = async \(\) => \{/g;

const genMethods = `
    const handleGenerateScript = async () => {
        setIsGeneratingScript(true);
        try {
            let article = researchArticle;
            if (!article || article.length < 30) {
                setAccordionOpen(true);
                article = await handleDeepResearch();
            }

            const res = await fetch('/api/poi-generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poiName: title || poi?.name || '',
                    lat: poi?.latitude || poi?.lat,
                    lng: poi?.longitude || poi?.lng,
                    researchArticle: article,
                    customInstructions: customInstructions
                })
            });
            const data = await res.json();
            if (res.ok && data.script) {
                setNarrativeScript(data.script);
            } else {
                setEngineToast({ message: 'Error', detail: data.error || 'No se pudo generar el guion' });
                setTimeout(() => setEngineToast(null), 5000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleGenerateAudio = async () => {
        if (!narrativeScript || narrativeScript.length < 10) return;
        setIsGeneratingAudio(true);
        try {
            const res = await fetch('/api/poi-generate-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poiId: poi?.id || \`temp-\${Date.now()}\`,
                    narrativeScript: narrativeScript
                })
            });
            const data = await res.json();
            if (res.ok && data.audio_url) {
                setAudioUrl(data.audio_url);
                setAudioGeneratedAt(new Date().toISOString());
                const estimatedSec = Math.round((narrativeScript.trim().split(/\\s+/).length / 60) * 15);
                setAudioDuration(estimatedSec || 15);
            } else {
                setEngineToast({ message: 'Error', detail: data.error || 'No se pudo generar el audio' });
                setTimeout(() => setEngineToast(null), 5000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    // Save — single POST
    const handleSave = async () => {`;
content = content.replace(handleSaveRegex, genMethods);

// 6. Update Deep Research to support Research Phase
const drOld = `        if (isResearching) return '';
        setIsResearching(true);
        setResearchTriggered(true);
        setEngineToast(null);
        let articleText = '';
        let researchImages = [];`;
        
const drNew = `        if (isResearching) return '';
        setIsResearching(true);
        setResearchTriggered(true);
        setEngineToast(null);
        setResearchPhase('searching');
        let articleText = '';
        let researchImages = [];
        
        const phaseTimer1 = setTimeout(() => setResearchPhase('analyzing'), 5000);
        const phaseTimer2 = setTimeout(() => setResearchPhase('writing'), 10000);`;
content = content.replace(drOld, drNew);

const drEndOld = `        } finally {
            setResearchArticle(articleText);
            setIsResearching(false);
            // Siempre pedir imágenes adicionales para maximizar opciones (Tavily + Wikipedia)
            if (articleText && articleText.length > 30) {
                fetchPoiImages(researchImages);
            }
        }`;
        
const drEndNew = `        } finally {
            clearTimeout(phaseTimer1);
            clearTimeout(phaseTimer2);
            setResearchPhase(null);
            setResearchArticle(articleText);
            setIsResearching(false);
            // Siempre pedir imágenes adicionales para maximizar opciones (Tavily + Wikipedia)
            if (articleText && articleText.length > 30) {
                fetchPoiImages(researchImages);
            }
        }`;
content = content.replace(drEndOld, drEndNew);


// 7. Inject FABRICA DE NARRATIVAS in the UI before IMAGE SELECTOR
const imageSelectorRegex = /                        \{\/\* ═══ IMAGE SELECTOR ═══ \*\/\}/g;

const wordCountLogic = `
    const wordCount = narrativeScript ? narrativeScript.trim().split(/\\s+/).length : 0;
    const isOverWordLimit = wordCount > 60;
    const isValid = title.trim().length >= 2;
`;

// Insert the word count logic at the top of the return
content = content.replace(
    "    const isValid = title.trim().length >= 2;",
    wordCountLogic
);

const fabricaUI = `
                        {/* ═══ FÁBRICA DE NARRATIVAS ═══ */}
                        <div style={{ padding: '0 24px 24px' }}>
                            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6', borderRadius: 12, padding: '20px 16px', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FileText size={18} color="#8B5CF6" />
                                        <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fábrica de Narrativas</span>
                                    </div>
                                </div>
                                
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

                                <div style={{ marginBottom: 16, position: 'relative' }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                        Guion Narrativo
                                    </p>
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
                                </div>

                                <button onClick={handleGenerateAudio} disabled={isGeneratingAudio || !narrativeScript || narrativeScript.length < 10} style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#1E293B', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: (isGeneratingAudio || !narrativeScript || narrativeScript.length < 10) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (isGeneratingAudio || !narrativeScript || narrativeScript.length < 10) ? 0.5 : 1 }}>
                                    {isGeneratingAudio ? <><Loader2 size={16} className="animate-spin" /> Generando Voz...</> : <><Mic size={16} /> Generar Voz (Despina)</>}
                                </button>

                                {audioUrl && (
                                    <div style={{ marginTop: 16, background: '#F1F5F9', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 16, background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Volume2 size={16} color="#FFF" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Voz Despina Lista</p>
                                            <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>~{audioDuration}s duración</p>
                                        </div>
                                        <audio controls src={audioUrl} style={{ height: 32, maxWidth: 120, outline: 'none' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ═══ IMAGE SELECTOR ═══ */}`;

content = content.replace("                        {/* ═══ IMAGE SELECTOR ═══ */}", fabricaUI);


// Save the file
fs.writeFileSync(pilotFile, content, 'utf8');
console.log('POIDetailModal updated successfully.');
