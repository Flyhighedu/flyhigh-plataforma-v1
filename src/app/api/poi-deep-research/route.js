import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// POI Deep Research — EL TRIDENTE 🔱
// Motor 1: Gemini 2.5 Flash-Lite (Google Search Grounding)
// Motor 2: RAG → Tavily (búsqueda web) + Groq (redacción)
// Motor 3: Cohere Command A (conocimiento enciclopédico)
// Fallover automático e invisible entre motores.
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Orden: Gemini → Tavily+Groq → Cohere
const ENGINE_ORDER = ['gemini', 'rag', 'cohere'];

const ENGINE_LABELS = {
    gemini: 'Gemini Flash',
    rag: 'Tavily + Groq',
    cohere: 'Cohere Command A'
};

// ───────── Supabase client (service role para escritura) ─────────
function getSupabase() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ───────── Odómetro Tavily: leer/incrementar/reset mensual ─────────
async function getTavilyUsage() {
    const sb = getSupabase();
    if (!sb) return { usage_count: 0, monthly_limit: 1000, month_key: '' };

    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-05"

    const { data, error } = await sb.from('tavily_usage').select('*').eq('id', 1).single();

    if (error || !data) {
        // Tabla no existe o fila no encontrada — devolver defaults
        return { usage_count: 0, monthly_limit: 1000, month_key: currentMonth };
    }

    // Auto-reset si cambió el mes
    if (data.month_key !== currentMonth) {
        await sb.from('tavily_usage').update({
            usage_count: 0,
            month_key: currentMonth,
            updated_at: new Date().toISOString()
        }).eq('id', 1);
        return { usage_count: 0, monthly_limit: data.monthly_limit || 1000, month_key: currentMonth };
    }

    return data;
}

async function incrementTavilyUsage() {
    const sb = getSupabase();
    if (!sb) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Intentar actualizar
    const { error } = await sb.from('tavily_usage').update({
        usage_count: (await getTavilyUsageCount()) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }).eq('id', 1);

    if (error) {
        console.warn('⚠️ No se pudo actualizar odómetro Tavily:', error.message);
    }
}

async function getTavilyUsageCount() {
    const sb = getSupabase();
    if (!sb) return 0;
    const { data } = await sb.from('tavily_usage').select('usage_count, month_key').eq('id', 1).single();
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (!data || data.month_key !== currentMonth) return 0;
    return data.usage_count || 0;
}

// ───────── Prompt universal (mismo para los 3 motores) ─────────
function buildPrompt(name, type, context, lat, lon) {
    const systemPrompt = `Eres un investigador experto en geografía, infraestructura y turismo en México con capacidad de búsqueda web.
Tu única tarea es investigar lugares y puntos de interés (POIs) específicos para generar un artículo educativo verídico altamente detallado, profundo y enciclopédico.

REGLAS ABSOLUTAS (CERO ALUCINACIÓN):
1. Foco Estricto: Se te pregunta por un lugar ESPECÍFICO ("${name}"). NUNCA respondas con la historia general de la ciudad o municipio ("${context}") si no tienes datos del lugar en sí.
2. Si no tienes información real sobre este punto ESPECÍFICO, di exactamente: "No se encontró información verificada para esta instalación/punto específico."
3. NUNCA INVENTES DATOS. Si no estás 100% seguro de un dato numérico, omítelo.

ESTRUCTURA OBLIGATORIA DE LA RESPUESTA:
Debes estructurar tu respuesta en dos partes claras:

PARTE 1: RESUMEN HISTÓRICO Y OPERATIVO ENVOLVENTE (Narrativa Profunda)
Redacta un artículo enciclopédico muy detallado, rico y extenso (sin límite de palabras, puede extenderse hasta 1600 o 2000 palabras si hay mucha historia). Cuenta la historia profunda del lugar, quién lo fundó, por qué, qué pasaba en esa época, su evolución, significado cultural para la comunidad, anécdotas, personajes históricos involucrados y su estado o uso actual. Queremos una narrativa extensa, rica y apasionante, no un simple párrafo.

PARTE 2: DATOS TÉCNICOS Y MÉTRICAS (Lista de KPIs)
A continuación del artículo, añade un título "Datos Técnicos y Métricas:" y luego una lista con al menos 4 a 6 "Datos Duros" o métricas verificables sobre el lugar. Ejemplos de datos requeridos según el tipo de lugar:
- Años de fundación, inauguración, clausura o remodelación.
- Dimensiones: Altitudes (msnm), hectáreas, metros cuadrados, kilómetros de longitud, profundidad.
- Capacidades: Aforo máximo, número de camas, capacidad de producción, volumen de captación de agua.
- Cantidades: Número de visitantes anuales, número de trabajadores, piezas de exhibición, especies.

FORMATO DE LA RESPUESTA:
Escribe todo el artículo narrativo, luego un salto de línea, y presenta los datos técnicos como una lista simple (usando guiones).
Nota: NO uses formato Markdown avanzado (como negritas con asteriscos o encabezados con #), usa solo texto plano limpio.`;

    let userMsg = `Investiga este lugar específico:\n`;
    userMsg += `Nombre: "${name}"\n`;
    userMsg += `Ciudad/Estado/Zona: ${context || 'México'}\n`;
    if (lat && lon) userMsg += `Coordenadas GPS: ${lat}, ${lon}\n`;
    if (type) userMsg += `Categoría referencial: ${type}\n`;
    userMsg += `\nGenera la investigación PROFUNDA Y EXTENSA asegurándote de incluir TODO el contexto histórico posible y, al final, la lista de Datos Técnicos y Métricas solicitada.`;

    return { systemPrompt, userMsg };
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 1: Gemini 2.5 Flash-Lite (con Google Search Grounding)
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
    return { text, images: [] };
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 2: RAG — Tavily (búsqueda web) + Groq (redacción)
// Con odómetro: verifica límite antes de usar
// ═══════════════════════════════════════════════════════════════
async function researchWithRAG(name, type, context, lat, lon) {
    if (!TAVILY_API_KEY || !GROQ_API_KEY) throw new Error('NO_KEY');

    // ═══ Verificar odómetro Tavily ═══
    const usage = await getTavilyUsage();
    if (usage.usage_count >= usage.monthly_limit) {
        console.warn(`⚠️ Tavily al límite: ${usage.usage_count}/${usage.monthly_limit}`);
        throw new Error('TAVILY_LIMIT_REACHED');
    }

    // Paso 1: Tavily busca información web real
    const searchQuery = `${name} ${context || 'México'} historia información`;
    const tavilyBody = JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: 'basic',
        max_results: 5,
        include_images: true,
        include_answer: true,
        include_raw_content: false
    });

    let tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: tavilyBody,
        cache: 'no-store'
    });

    // Mini-retry: si Tavily da 429, esperar 3s e intentar una vez más
    if (tavilyRes.status === 429) {
        const retryAfter = tavilyRes.headers.get('retry-after');
        const waitMs = retryAfter ? Math.min(parseInt(retryAfter) * 1000, 5000) : 3000;
        console.log(`  ⏳ Tavily rate limit (retry-after: ${retryAfter || 'not set'}) — esperando ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        tavilyRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: tavilyBody,
            cache: 'no-store'
        });
        console.log(`  ⏳ Tavily retry result: ${tavilyRes.status}`);
    }

    if (tavilyRes.status === 429) throw new Error('429');
    if (!tavilyRes.ok) {
        const errBody = await tavilyRes.text().catch(() => '');
        console.warn(`  ⚠️ Tavily error ${tavilyRes.status}: ${errBody.substring(0, 200)}`);
        throw new Error(`TAVILY_${tavilyRes.status}`);
    }

    // ═══ Incrementar odómetro DESPUÉS de búsqueda exitosa ═══
    await incrementTavilyUsage();

    const tavilyData = await tavilyRes.json();
    const webContext = [
        tavilyData.answer || '',
        ...(tavilyData.results || []).map(r => `${r.title}: ${r.content}`).slice(0, 4)
    ].filter(Boolean).join('\n\n');

    if (!webContext || webContext.length < 50) throw new Error('EMPTY_RESPONSE');

    // Paso 2: Groq redacta el artículo a partir de los datos web
    const { systemPrompt } = buildPrompt(name, type, context, lat, lon);
    const groqBody = JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
            { role: 'system', content: systemPrompt + '\n\nIMPORTANTE: Basa tu artículo EXCLUSIVAMENTE en la siguiente información extraída de páginas web reales. No agregues datos de tu propia memoria.' },
            { role: 'user', content: `Datos web verificados sobre "${name}" (${context || 'México'}):\n\n${webContext}\n\nRedacta el artículo educativo basándote SOLO en estos datos.` }
        ],
        temperature: 0.25,
        max_tokens: 2500
    });

    let groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: groqBody,
        cache: 'no-store'
    });

    // Mini-retry para Groq
    if (groqRes.status === 429) {
        console.log('  ⏳ Groq rate limit — esperando 2s para reintentar...');
        await new Promise(r => setTimeout(r, 2000));
        groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: groqBody,
            cache: 'no-store'
        });
        console.log(`  ⏳ Groq retry result: ${groqRes.status}`);
    }

    if (groqRes.status === 429) throw new Error('GROQ_429');
    if (!groqRes.ok) throw new Error(`GROQ_${groqRes.status}`);

    const groqData = await groqRes.json();
    let text = groqData.choices?.[0]?.message?.content?.trim() || '';
    text = text.replace(/\*\*/g, '').replace(/^["']+|["']+$/g, '').trim();

    if (!text || text.length < 30) throw new Error('EMPTY_RESPONSE');
    
    // Map Tavily images to standard format
    const images = (tavilyData.images || []).map(url => ({
        url,
        thumbUrl: url,
        credit: 'Tavily',
        source: 'tavily'
    }));

    return { text, images };
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 3: Cohere Command A (conocimiento enciclopédico)
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
        }),
        cache: 'no-store'
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
    return { text, images: [] };
}

// ═══════════════════════════════════════════════════════════════
// ORQUESTADOR — Intenta cada motor en orden, salta al siguiente
// ═══════════════════════════════════════════════════════════════
const ENGINE_FNS = {
    gemini: researchWithGemini,
    rag: researchWithRAG,
    cohere: researchWithCohere
};

export async function POST(request) {
    try {
        const { name, type, context, lat, lon, preferredEngine } = await request.json();
        if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

        // Build engine order: preferred first, then the rest in default order
        let order = [...ENGINE_ORDER];
        if (preferredEngine && ENGINE_FNS[preferredEngine]) {
            order = [preferredEngine, ...ENGINE_ORDER.filter(e => e !== preferredEngine)];
        }

        // Leer odómetro Tavily para incluirlo en la respuesta
        let tavilyUsage = null;
        try { tavilyUsage = await getTavilyUsage(); } catch (e) { /* ignore */ }

        let lastError = null;
        const engineLog = [];

        for (const engineId of order) {
            const fn = ENGINE_FNS[engineId];
            console.log(`🔬 [${ENGINE_LABELS[engineId]}] Investigando: "${name}"`);

            try {
                const result = await fn(name, type, context, lat, lon);
                const articleText = typeof result === 'string' ? result : result.text;
                const images = result.images || [];
                console.log(`  ✓ [${ENGINE_LABELS[engineId]}] → ${articleText.length} chars`);

                // Releer odómetro si se usó Tavily
                if (engineId === 'rag') {
                    try { tavilyUsage = await getTavilyUsage(); } catch (e) { /* ignore */ }
                }

                return NextResponse.json({
                    article: articleText,
                    images: images,
                    engine: engineId,
                    engineLabel: ENGINE_LABELS[engineId],
                    tavilyUsage: tavilyUsage ? {
                        count: tavilyUsage.usage_count,
                        limit: tavilyUsage.monthly_limit
                    } : null,
                    failedEngines: engineLog.length > 0 ? engineLog : undefined
                });
            } catch (err) {
                const msg = err.message;
                const reason = msg === 'GROQ_429' ? 'Groq: cuota agotada'
                             : msg === '429' ? 'cuota agotada'
                             : msg === 'NO_KEY' ? 'sin API key'
                             : msg === 'EMPTY_RESPONSE' ? 'sin información'
                             : msg === 'TAVILY_LIMIT_REACHED' ? 'límite mensual alcanzado'
                             : msg.startsWith('TAVILY_') ? `Tavily error: ${msg}`
                             : msg.startsWith('GROQ_') ? `Groq error: ${msg}`
                             : msg.startsWith('COHERE_') ? `Cohere error: ${msg}`
                             : `error: ${msg.substring(0, 80)}`;
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
            tavilyUsage: tavilyUsage ? { count: tavilyUsage.usage_count, limit: tavilyUsage.monthly_limit } : null,
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
