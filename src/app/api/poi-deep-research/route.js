import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════════
// POI Deep Research — TRIDENTE DE INVESTIGACIÓN
// Motor 1: Gemini Flash-Lite (Google Search Grounding)
// Motor 2: Cohere Command R+ (conocimiento enciclopédico)
// Motor 3: RAG → Tavily (búsqueda web) + Groq (redacción)
// Fallover automático e invisible entre motores.
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const ENGINE_ORDER = ['gemini', 'cohere', 'rag'];

// ───────── Prompt universal (mismo para los 3 motores) ─────────
function buildPrompt(name, type, context, lat, lon) {
    const systemPrompt = `Eres un investigador enciclopédico experto en México con capacidad de búsqueda web.
Tu única tarea es investigar lugares y puntos de interés (POIs) para generar un artículo educativo verídico.

REGLAS ABSOLUTAS:
1. Si dispones de búsqueda web, ÚSALA. Si no, basa tu respuesta en conocimiento verificable.
2. Si no tienes información real sobre este lugar, di exactamente: "No se encontró información histórica verificada para este punto."
3. NUNCA INVENTES DATOS. Si no estás 100% seguro, no lo pongas.
4. Incluye AL MENOS 3 datos numéricos reales (años, altitudes, medidas, cifras de visitantes, etc.)
5. El tono debe ser el de un narrador apasionado que cuenta la historia a niños de 9-12 años.

ESTRUCTURA:
- Introducción — Qué es y dónde está.
- Historia — Fechas, origen, fundación real.
- Importancia — Relevancia cultural/económica con datos.
- Dato curioso — Un hecho sorprendente con un número o comparación.

- 6-10 oraciones. Entre 500 y 1000 caracteres.
- Español claro y amigable.
- Sin formato Markdown. Solo texto plano con punto y seguido.`;

    let userMsg = `Investiga este punto de interés:\n`;
    userMsg += `Nombre: "${name}"\n`;
    userMsg += `Ciudad/Estado: ${context || 'México'}\n`;
    if (lat && lon) userMsg += `Coordenadas GPS: ${lat}, ${lon}\n`;
    if (type) userMsg += `Categoría: ${type}\n`;
    userMsg += `\nGenera el artículo educativo con datos reales.`;

    return { systemPrompt, userMsg };
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 1: Gemini Flash-Lite (con Google Search Grounding)
// ═══════════════════════════════════════════════════════════════
async function researchWithGemini(name, type, context, lat, lon) {
    if (!GEMINI_API_KEY) throw new Error('NO_KEY');

    const { systemPrompt, userMsg } = buildPrompt(name, type, context, lat, lon);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        tools: [{ googleSearch: {} }]
    });

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
    });

    let text = result.response.text().trim();
    text = text.replace(/^["']+|["']+$/g, '').replace(/\*\*/g, '').trim();

    if (!text || text.length < 30) throw new Error('EMPTY_RESPONSE');
    return text;
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 2: Cohere Command R+ (conocimiento enciclopédico)
// ═══════════════════════════════════════════════════════════════
async function researchWithCohere(name, type, context, lat, lon) {
    if (!COHERE_API_KEY) throw new Error('NO_KEY');

    const { systemPrompt, userMsg } = buildPrompt(name, type, context, lat, lon);

    const res = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'command-a-03-2025',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMsg }
            ],
            temperature: 0.3
        })
    });

    if (res.status === 429) throw new Error('429');
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`COHERE_${res.status}: ${errText}`);
    }

    const data = await res.json();
    let text = data.message?.content?.[0]?.text
            || data.text
            || '';
    text = text.replace(/\*\*/g, '').replace(/^["']+|["']+$/g, '').trim();

    if (!text || text.length < 30) throw new Error('EMPTY_RESPONSE');
    return text;
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 3: RAG — Tavily (búsqueda web) + Groq (redacción)
// ═══════════════════════════════════════════════════════════════
async function researchWithRAG(name, type, context, lat, lon) {
    if (!TAVILY_API_KEY || !GROQ_API_KEY) throw new Error('NO_KEY');

    // Paso 1: Tavily busca información web real
    const searchQuery = `${name} ${context || 'México'} historia información`;
    const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query: searchQuery,
            search_depth: 'basic',
            max_results: 5,
            include_answer: true,
            include_raw_content: false
        })
    });

    if (tavilyRes.status === 429) throw new Error('429');
    if (!tavilyRes.ok) throw new Error(`TAVILY_${tavilyRes.status}`);

    const tavilyData = await tavilyRes.json();
    const webContext = [
        tavilyData.answer || '',
        ...(tavilyData.results || []).map(r => `${r.title}: ${r.content}`).slice(0, 4)
    ].filter(Boolean).join('\n\n');

    if (!webContext || webContext.length < 50) throw new Error('EMPTY_RESPONSE');

    // Paso 2: Groq redacta el artículo a partir de los datos web
    const { systemPrompt } = buildPrompt(name, type, context, lat, lon);
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt + '\n\nIMPORTANTE: Basa tu artículo EXCLUSIVAMENTE en la siguiente información extraída de páginas web reales. No agregues datos de tu propia memoria.' },
                { role: 'user', content: `Datos web verificados sobre "${name}" (${context || 'México'}):\n\n${webContext}\n\nRedacta el artículo educativo basándote SOLO en estos datos.` }
            ],
            temperature: 0.25,
            max_tokens: 600
        })
    });

    if (groqRes.status === 429) throw new Error('429');
    if (!groqRes.ok) throw new Error(`GROQ_${groqRes.status}`);

    const groqData = await groqRes.json();
    let text = groqData.choices?.[0]?.message?.content?.trim() || '';
    text = text.replace(/\*\*/g, '').replace(/^["']+|["']+$/g, '').trim();

    if (!text || text.length < 30) throw new Error('EMPTY_RESPONSE');
    return text;
}

// ═══════════════════════════════════════════════════════════════
// ORQUESTADOR — Intenta cada motor en orden, salta al siguiente
// ═══════════════════════════════════════════════════════════════
const ENGINE_FNS = {
    gemini: researchWithGemini,
    cohere: researchWithCohere,
    rag: researchWithRAG
};

const ENGINE_LABELS = {
    gemini: 'Gemini Flash',
    cohere: 'Cohere Command A',
    rag: 'Tavily + Groq'
};

export async function POST(request) {
    try {
        const { name, type, context, lat, lon, preferredEngine } = await request.json();
        if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

        // Build engine order: preferred first, then the rest
        let order = [...ENGINE_ORDER];
        if (preferredEngine && ENGINE_FNS[preferredEngine]) {
            order = [preferredEngine, ...ENGINE_ORDER.filter(e => e !== preferredEngine)];
        }

        let lastError = null;
        const engineLog = [];

        for (const engineId of order) {
            const fn = ENGINE_FNS[engineId];
            console.log(`🔬 [${ENGINE_LABELS[engineId]}] Investigando: "${name}"`);

            try {
                const article = await fn(name, type, context, lat, lon);
                console.log(`  ✓ [${ENGINE_LABELS[engineId]}] → ${article.length} chars`);

                return NextResponse.json({
                    article,
                    engine: engineId,
                    engineLabel: ENGINE_LABELS[engineId],
                    failedEngines: engineLog.length > 0 ? engineLog : undefined
                });
            } catch (err) {
                const reason = err.message.includes('429') ? 'cuota agotada'
                             : err.message === 'NO_KEY' ? 'sin API key'
                             : err.message === 'EMPTY_RESPONSE' ? 'sin información'
                             : 'error';
                console.warn(`  ✗ [${ENGINE_LABELS[engineId]}] falló: ${reason}`);
                engineLog.push({ engine: engineId, label: ENGINE_LABELS[engineId], reason });
                lastError = err;
            }
        }

        // Todos fallaron
        console.error('❌ Los 3 motores fallaron:', engineLog);
        return NextResponse.json({
            article: 'No fue posible investigar este punto en este momento. Todos los motores de investigación están temporalmente agotados. Por favor, intenta más tarde.',
            engine: 'none',
            engineLabel: 'Sin motor disponible',
            failedEngines: engineLog,
            allFailed: true
        }, { status: 503 });

    } catch (error) {
        console.error('Deep research fatal error:', error.message);
        return NextResponse.json({
            article: 'Ocurrió un error inesperado al investigar este lugar.',
            engine: 'none'
        }, { status: 500 });
    }
}
