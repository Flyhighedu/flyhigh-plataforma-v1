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
4. ESTRATEGIA DE BÚSQUEDA AVANZADA: Si recibes Coordenadas GPS, úsalas INMEDIATAMENTE para triangular la ciudad, estado y colonia exacta. Si el lugar es una calle, avenida, parque o monumento local, NO te rindas rápido; busca su "historia urbana", a quién o qué debe su nombre, año de construcción y su relevancia local en la ciudad que detectaste.

ESTRUCTURA OBLIGATORIA DE LA RESPUESTA:
Debes estructurar tu respuesta en formato de "Visión General" Ejecutiva:

1. INTRODUCCIÓN CORTA:
Un párrafo inicial muy breve (máximo 3 o 4 líneas) que resuma qué es el lugar y su importancia principal.

2. DETALLES CLAVE (Viñetas / Bullet Points):
A continuación, añade el título "Detalles Clave:" y crea una lista usando viñetas (guiones). Cada viñeta debe resaltar un dato duro de forma estructurada. 
Ejemplos de viñetas que DEBES buscar e incluir (si aplican):
- **Estado/Año:** Cuándo se inauguró o fundó.
- **Capacidad/Dimensiones:** Metros, hectáreas, litros, capacidad de aforo.
- **Inversión/Costo:** Dinero invertido en su creación o remodelación.
- **Beneficios/Uso:** Para qué sirve actualmente, o en honor a quién está nombrado.
- **Historia Curiosa:** Algún acrónimo o anécdota concreta y rápida.

REGLA DE FORMATO (Markdown Permitido):
- SÍ debes usar negritas (**texto**) para resaltar los títulos de cada viñeta (Ej. "**Inversión:** 200 millones...").
- Ve directo al grano en cada punto. PROHIBIDO escribir párrafos densos dentro de la lista.`;

    let userMsg = `Investiga este lugar específico:\n`;
    userMsg += `Nombre: "${name}"\n`;
    userMsg += `Ciudad/Estado/Zona (Referencia): ${context || 'México'}\n`;
    if (lat && lon) userMsg += `Coordenadas GPS (Úsalas como primer paso para geolocalizar la ciudad y estado exactos antes de buscar la historia): ${lat}, ${lon}\n`;
    if (type) userMsg += `Categoría referencial: ${type}\n`;
    userMsg += `\nGenera la investigación PROFUNDA Y EXTENSA asegurándote de incluir TODO el contexto histórico posible (incluyendo en honor a quién está nombrado, si aplica) y, al final, la lista de Etiquetas Clave solicitada.`;
    userMsg += `\n\nAdemás, en la ÚLTIMA línea de tu respuesta, incluye exactamente este formato:\nKEYWORDS: palabra1, palabra2, palabra3, palabra4, palabra5\nDeben ser las 3 a 5 palabras clave MÁS relevantes y únicas para identificar este lugar/tema en un sistema de búsqueda por voz. Usa sustantivos concretos, NO adjetivos genéricos.`;

    return { systemPrompt, userMsg };
}

// ───────── Extractor de keywords del artículo ─────────
function extractKeywords(articleText) {
    const match = articleText.match(/KEYWORDS:\s*(.+)/i);
    if (!match) return { cleanArticle: articleText, keywords: [] };
    const keywords = match[1].split(',').map(k => k.trim().toLowerCase()).filter(Boolean).slice(0, 5);
    const cleanArticle = articleText.replace(/\n?KEYWORDS:.+/i, '').trim();
    return { cleanArticle, keywords };
}

// ═══════════════════════════════════════════════════════════════
// Frases centinela — detectan "falsos éxitos" de la IA
// ═══════════════════════════════════════════════════════════════
const FAILURE_PHRASES = [
    'no se encontró información', 'no tengo datos específicos',
    'no pude encontrar', 'no fue posible investigar',
    'no dispongo de información', 'no cuento con datos',
    'información no disponible', 'no hay información verificada',
    'no encontré información', 'no tengo información'
];

function validateResponse(text) {
    if (!text || text.length < 30) throw new Error('EMPTY_RESPONSE');
    const lower = text.toLowerCase();
    const isFailure = FAILURE_PHRASES.some(p => lower.includes(p));
    if (isFailure) throw new Error('EMPTY_RESPONSE');
}

// ═══════════════════════════════════════════════════════════════
// MOTOR 1: Gemini 2.5 Flash (con Google Search Grounding)
// ═══════════════════════════════════════════════════════════════
async function researchWithGemini(name, type, context, lat, lon) {
    if (!GEMINI_API_KEY) throw new Error('NO_KEY');

    const { systemPrompt, userMsg } = buildPrompt(name, type, context, lat, lon);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [{ googleSearch: {} }]
    });

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
    });

    let text = result.response.text().trim();
    text = text.replace(/^["']+|["']+$/g, '').trim();

    validateResponse(text);
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
    text = text.replace(/^["']+|["']+$/g, '').trim();

    validateResponse(text);
    
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
    text = text.replace(/^["']+|["']+$/g, '').trim();

    validateResponse(text);
    return { text, images: [] };
}

// ═══════════════════════════════════════════════════════════════
// ORQUESTADOR — Reintenta SOLO el motor seleccionado (sin fallback)
// ═══════════════════════════════════════════════════════════════
const ENGINE_FNS = {
    gemini: researchWithGemini,
    rag: researchWithRAG,
    cohere: researchWithCohere
};

const MAX_RETRIES = 5;

export async function POST(request) {
    try {
        const { name, type, context, lat, lon, preferredEngine } = await request.json();
        if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

        // Usar SOLO el motor seleccionado — sin fallback automático
        const engineId = (preferredEngine && ENGINE_FNS[preferredEngine]) ? preferredEngine : 'gemini';
        const fn = ENGINE_FNS[engineId];

        // Leer odómetro Tavily para incluirlo en la respuesta
        let tavilyUsage = null;
        try { tavilyUsage = await getTavilyUsage(); } catch (e) { /* ignore */ }

        const engineLog = [];

        // Reintentar el motor seleccionado hasta MAX_RETRIES veces
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            console.log(`🔬 [${ENGINE_LABELS[engineId]}] Intento ${attempt}/${MAX_RETRIES} — Investigando: "${name}"`);

            try {
                const result = await fn(name, type, context, lat, lon);
                const rawArticle = typeof result === 'string' ? result : result.text;
                const images = result.images || [];

                // Extract keywords from article text
                const { cleanArticle, keywords } = extractKeywords(rawArticle);

                // Releer odómetro si se usó Tavily
                if (engineId === 'rag') {
                    try { tavilyUsage = await getTavilyUsage(); } catch (e) { /* ignore */ }
                }

                console.log(`  ✓ [${ENGINE_LABELS[engineId]}] Éxito en intento ${attempt}${keywords.length > 0 ? ` (${keywords.length} keywords)` : ''}`);
                return NextResponse.json({
                    article: cleanArticle,
                    images: images,
                    keywords: keywords,
                    engine: engineId,
                    engineLabel: ENGINE_LABELS[engineId],
                    attempt: attempt,
                    tavilyUsage: tavilyUsage ? {
                        count: tavilyUsage.usage_count,
                        limit: tavilyUsage.monthly_limit
                    } : null,
                    failedAttempts: engineLog.length > 0 ? engineLog : undefined
                });
            } catch (err) {
                const msg = err.message;
                const reason = msg === 'EMPTY_RESPONSE' ? 'sin información'
                             : msg === 'NO_KEY' ? 'sin API key'
                             : msg === '429' ? 'cuota agotada'
                             : `error: ${msg.substring(0, 80)}`;
                console.warn(`  ✗ [${ENGINE_LABELS[engineId]}] Intento ${attempt} falló: ${reason}`);
                engineLog.push({ attempt, reason });

                // Exponential backoff: 1s → 2s → 4s → 8s
                if (attempt < MAX_RETRIES) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
                    console.log(`  ⏳ Esperando ${delay}ms antes del intento ${attempt + 1}...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        // Todos fallaron
        console.error(`❌ [${ENGINE_LABELS[engineId]}] Todos los ${MAX_RETRIES} intentos fallaron:`, engineLog);
        return NextResponse.json({
            article: `No fue posible investigar este punto con ${ENGINE_LABELS[engineId]} después de ${MAX_RETRIES} intentos. Intenta de nuevo o cambia el motor de búsqueda.`,
            engine: engineId,
            engineLabel: ENGINE_LABELS[engineId],
            tavilyUsage: tavilyUsage ? { count: tavilyUsage.usage_count, limit: tavilyUsage.monthly_limit } : null,
            failedAttempts: engineLog,
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
