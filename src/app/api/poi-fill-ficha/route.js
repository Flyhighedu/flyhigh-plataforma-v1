import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════════
// POI Fill Ficha — TRIDENTE para generar fichas didácticas
// Motor 1: Groq (Llama 3) — PRIMARIO: 14,400 RPD, ultrarrápido
// Motor 2: Gemini Flash-Lite — Respaldo
// Motor 3: Cohere Command A — Respaldo final
// No requiere búsqueda web (procesa artículo ya investigado).
// Groq es primario para AHORRAR cuota de Gemini para investigación.
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const ENGINE_ORDER = ['groq', 'gemini', 'cohere'];

const SYSTEM_PROMPT = `Eres un pedagogo experto en diseño de fichas educativas para niños de primaria y secundaria en México.
Recibirás un artículo de investigación sobre un punto de interés geográfico o cultural.
Tu trabajo es generar exactamente 4 campos para una ficha didáctica que será usada por un piloto de vuelos turísticos educativos para narrar a los niños durante un vuelo.

CAMPOS A GENERAR:
1. "dato_clave_1": Un dato concreto y sorprendente (una fecha, un número, un hecho poco conocido) que asombre a un niño. Máximo 1 oración corta y directa (10-18 palabras).
2. "dato_clave_2": Otro dato diferente, enfocado en por qué este lugar importa para su comunidad o para México. Máximo 1 oración corta y directa (10-18 palabras).
3. "pregunta_estudio_1": Una pregunta directa de autoevaluación cuya respuesta sea EXACTAMENTE la información de dato_clave_1. Ejemplo: "¿En qué año fue inaugurado este hospital?".
4. "pregunta_estudio_2": Una pregunta directa de autoevaluación cuya respuesta sea EXACTAMENTE la información de dato_clave_2. Ejemplo: "¿Cuántas especialidades ofrece a la comunidad?".
5. "pregunta_interaccion": Una pregunta abierta y reflexiva que el piloto le pueda hacer a los niños DURANTE el vuelo para generar conversación y pensamiento crítico. Debe ser diferente a las preguntas de estudio. Una sola pregunta.

REGLAS:
- Basa TODO en el artículo proporcionado. No inventes datos adicionales.
- Escribe en español claro y amigable para niños.
- IMPORTANTE: Sé muy conciso. Los datos deben poder leerse de un solo vistazo rápido.
- Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones extra.
- Formato exacto: {"dato_clave_1":"...","dato_clave_2":"...","pregunta_estudio_1":"...","pregunta_estudio_2":"...","pregunta_interaccion":"..."}`;

function buildSystemPrompt(regenerate, fieldToRegenerate, currentValue) {
    let prompt = SYSTEM_PROMPT;
    if (regenerate) {
        if (fieldToRegenerate === 'dato_clave_3') {
            prompt += `\n\nIMPORTANTE (NUEVO DATO): El usuario quiere agregar un TERCER dato clave ("dato_clave_3") y su pregunta de estudio ("pregunta_estudio_3").`;
            if (currentValue) {
                prompt += `\nEstos datos ya existen y NO debes repetirlos: ${currentValue}\nPROHIBIDO REESCRIBIR EL MISMO HECHO. Busca un ángulo COMPLETAMENTE DIFERENTE dentro del artículo.`;
            }
            prompt += `\nDevuelve un JSON que contenga SOLO las llaves "dato_clave_3" y "pregunta_estudio_3".`;
        } else if (fieldToRegenerate === 'dato_clave_1' || fieldToRegenerate === 'dato_clave_2') {
            // PAIRED REGENERATION: dato + pregunta juntos para mantener coherencia
            const pairedQuestion = fieldToRegenerate === 'dato_clave_1' 
                ? 'pregunta_estudio_1' : 'pregunta_estudio_2';
            prompt += `\n\nIMPORTANTE (REGENERACIÓN DE PAR): El usuario quiere regenerar "${fieldToRegenerate}" Y su pregunta de estudio emparejada "${pairedQuestion}".`;
            if (currentValue) {
                prompt += `\nEl usuario RECHAZÓ este dato actual: "${currentValue}".\nPROHIBIDO REESCRIBIR EL MISMO HECHO. Debes buscar un ángulo, tema, evento o personaje COMPLETAMENTE DIFERENTE dentro del artículo.`;
            }
            prompt += `\nDevuelve un JSON que contenga SOLO las llaves "${fieldToRegenerate}" y "${pairedQuestion}".`;
        } else if (fieldToRegenerate) {
            prompt += `\n\nIMPORTANTE (REGENERACIÓN INDIVIDUAL): El usuario quiere regenerar el campo "${fieldToRegenerate}".`;
            if (currentValue) {
                prompt += `\nEl usuario RECHAZÓ este dato actual: "${currentValue}".\nPROHIBIDO REESCRIBIR EL MISMO HECHO. Debes buscar un ángulo, tema, evento o personaje COMPLETAMENTE DIFERENTE dentro del artículo.`;
            }
            prompt += `\nDevuelve un JSON que contenga SOLO la llave "${fieldToRegenerate}".`;
        } else {
            prompt += `\n\nIMPORTANTE (REGENERACIÓN TOTAL): El usuario ha pedido regenerar la ficha. DEBES proporcionar opciones COMPLETAMENTE DIFERENTES a las más obvias.`;
            if (currentValue) {
                prompt += `\nIgnora estos datos que ya fueron rechazados: ${currentValue}\nBusca datos curiosos alternativos y otra pregunta original.`;
            }
        }
    }
    return prompt;
}

// ───────── Motor 2 (Respaldo): Gemini ─────────
async function fichaWithGemini(article, poiName, systemPrompt, temperature) {
    if (!GEMINI_API_KEY) throw new Error('NO_KEY');

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { temperature }
    });

    const userMsg = `Punto de interés: "${poiName || 'Desconocido'}"\n\nArtículo de investigación:\n${article}\n\nGenera la ficha didáctica en JSON.`;
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
    });

    let text = result.response.text().trim();
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(text);
}

// ───────── Motor 3 (Respaldo final): Cohere ─────────
async function fichaWithCohere(article, poiName, systemPrompt, temperature) {
    if (!COHERE_API_KEY) throw new Error('NO_KEY');

    const userMsg = `Punto de interés: "${poiName || 'Desconocido'}"\n\nArtículo de investigación:\n${article}\n\nGenera la ficha didáctica en JSON.`;

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
            temperature
        }),
        cache: 'no-store'
    });

    if (res.status === 429) throw new Error('429');
    if (!res.ok) throw new Error(`COHERE_${res.status}`);

    const data = await res.json();
    let text = data.message?.content?.[0]?.text || data.text || '';
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(text);
}

// ───────── Motor 1 (PRIMARIO): Groq — 14,400 RPD ─────────
async function fichaWithGroq(article, poiName, systemPrompt, temperature) {
    if (!GROQ_API_KEY) throw new Error('NO_KEY');

    const userMsg = `Punto de interés: "${poiName || 'Desconocido'}"\n\nArtículo de investigación:\n${article}\n\nGenera la ficha didáctica en JSON.`;
    const groqBody = JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg }
        ],
        temperature,
        max_tokens: 300
    });

    let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: groqBody,
        cache: 'no-store'
    });

    // Mini-retry si 429
    if (res.status === 429) {
        console.log('  ⏳ Groq rate limit — retry en 2s...');
        await new Promise(r => setTimeout(r, 2000));
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: groqBody,
            cache: 'no-store'
        });
    }

    if (res.status === 429) throw new Error('GROQ_429');
    if (!res.ok) throw new Error(`GROQ_${res.status}`);

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content?.trim() || '';
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(text);
}

// ───────── Orquestador ─────────
const ENGINE_FNS = { gemini: fichaWithGemini, cohere: fichaWithCohere, groq: fichaWithGroq };
const ENGINE_LABELS = { gemini: 'Gemini Flash', cohere: 'Cohere Command A', groq: 'Groq Llama 3' };

export async function POST(request) {
    try {
        const { article, poiName, regenerate, fieldToRegenerate, currentValue, preferredEngine } = await request.json();
        if (!article || article.length < 20) {
            return NextResponse.json({ dato_clave_1: '', dato_clave_2: '', pregunta_estudio_1: '', pregunta_estudio_2: '', pregunta_interaccion: '' });
        }

        const systemPrompt = buildSystemPrompt(regenerate, fieldToRegenerate, currentValue);
        const temperature = regenerate ? 0.9 : 0.4;

        // Build engine order
        let order = [...ENGINE_ORDER];
        if (preferredEngine && ENGINE_FNS[preferredEngine]) {
            order = [preferredEngine, ...ENGINE_ORDER.filter(e => e !== preferredEngine)];
        }

        for (const engineId of order) {
            const fn = ENGINE_FNS[engineId];
            console.log(`📝 [${ENGINE_LABELS[engineId]}] Generando ficha: "${poiName}"`);

            try {
                const parsed = await fn(article, poiName, systemPrompt, temperature);

                // STRICT: if regenerating a single field or pair, return only relevant fields
                if (fieldToRegenerate) {
                    // Paired regeneration for dato_clave_1/2 — return dato + paired pregunta
                    if (fieldToRegenerate === 'dato_clave_1' || fieldToRegenerate === 'dato_clave_2') {
                        const pairedQuestion = fieldToRegenerate === 'dato_clave_1' 
                            ? 'pregunta_estudio_1' : 'pregunta_estudio_2';
                        if (parsed[fieldToRegenerate]) {
                            return NextResponse.json({
                                [fieldToRegenerate]: parsed[fieldToRegenerate],
                                [pairedQuestion]: parsed[pairedQuestion] || '',
                                engine: engineId
                            });
                        }
                        console.warn(`  ⚠ ${ENGINE_LABELS[engineId]} no devolvió ${fieldToRegenerate}`);
                        continue;
                    }
                    // dato_clave_3 pair or single field
                    const value = parsed[fieldToRegenerate];
                    if (value) {
                        // dato_clave_3 also returns its pregunta_estudio_3
                        if (fieldToRegenerate === 'dato_clave_3') {
                            return NextResponse.json({
                                dato_clave_3: value,
                                pregunta_estudio_3: parsed.pregunta_estudio_3 || '',
                                engine: engineId
                            });
                        }
                        return NextResponse.json({
                            [fieldToRegenerate]: value,
                            engine: engineId
                        });
                    }
                    console.warn(`  ⚠ ${ENGINE_LABELS[engineId]} no devolvió ${fieldToRegenerate}`);
                    continue;
                }

                return NextResponse.json({
                    dato_clave_1: parsed.dato_clave_1 || '',
                    dato_clave_2: parsed.dato_clave_2 || '',
                    pregunta_estudio_1: parsed.pregunta_estudio_1 || '',
                    pregunta_estudio_2: parsed.pregunta_estudio_2 || '',
                    pregunta_interaccion: parsed.pregunta_interaccion || '',
                    engine: engineId
                });
            } catch (err) {
                console.warn(`  ✗ [${ENGINE_LABELS[engineId]}] falló: ${err.message}`);
            }
        }

        // Todos fallaron
        return NextResponse.json({
            dato_clave_1: '', dato_clave_2: '', pregunta_estudio_1: '', pregunta_estudio_2: '', pregunta_interaccion: '',
            engine: 'none', allFailed: true
        }, { status: 503 });

    } catch (error) {
        console.error('Fill ficha fatal error:', error.message);
        return NextResponse.json({
            dato_clave_1: '', dato_clave_2: '', pregunta_estudio_1: '', pregunta_estudio_2: '', pregunta_interaccion: ''
        }, { status: 500 });
    }
}
