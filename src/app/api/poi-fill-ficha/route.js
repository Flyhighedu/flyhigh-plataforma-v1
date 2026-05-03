import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════════
// POI Fill Ficha — Genera los 3 campos de la Ficha Didáctica
// Usa Gemini 2.5 Flash (sin Search — solo procesa el artículo)
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `Eres un pedagogo experto en diseño de fichas educativas para niños de primaria y secundaria en México.
Recibirás un artículo de investigación sobre un punto de interés geográfico o cultural.
Tu trabajo es generar exactamente 3 campos para una ficha didáctica que será usada por un piloto de vuelos turísticos educativos para narrar a los niños durante un vuelo.

CAMPOS A GENERAR:
1. "dato_clave_1": Un dato concreto y sorprendente (una fecha, un número, un hecho poco conocido) que asombre a un niño. Máximo 1 oración corta y directa (10-18 palabras).
2. "dato_clave_2": Otro dato diferente, enfocado en por qué este lugar importa para su comunidad o para México. Máximo 1 oración corta y directa (10-18 palabras).
3. "pregunta_interaccion": Una pregunta abierta y divertida que el piloto le pueda hacer a los niños durante el vuelo para generar conversación. Debe ser muy breve. Una sola pregunta.

REGLAS:
- Basa TODO en el artículo proporcionado. No inventes datos adicionales.
- Escribe en español claro y amigable para niños.
- IMPORTANTE: Sé muy conciso. Los datos deben poder leerse de un solo vistazo rápido.
- Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones extra.
- Formato exacto: {"dato_clave_1":"...","dato_clave_2":"...","pregunta_interaccion":"..."}`;

export async function POST(request) {
    try {
        const { article, poiName, regenerate, fieldToRegenerate, currentValue } = await request.json();
        if (!article || article.length < 20) {
            return NextResponse.json({
                dato_clave_1: '',
                dato_clave_2: '',
                pregunta_interaccion: ''
            });
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite",
            generationConfig: {
                temperature: regenerate ? 0.9 : 0.4 // Mayor creatividad si está regenerando
            }
        });

        let currentSystemPrompt = SYSTEM_PROMPT;
        if (regenerate) {
            if (fieldToRegenerate) {
                currentSystemPrompt += `\n\nIMPORTANTE (REGENERACIÓN INDIVIDUAL): El usuario quiere regenerar el campo "${fieldToRegenerate}".`;
                if (currentValue) {
                    currentSystemPrompt += `\nEl usuario RECHAZÓ este dato actual: "${currentValue}".\nPROHIBIDO REESCRIBIR EL MISMO HECHO. Debes buscar un ángulo, tema, evento o personaje COMPLETAMENTE DIFERENTE dentro del artículo.`;
                }
                currentSystemPrompt += `\nDevuelve un JSON que contenga SOLO la llave "${fieldToRegenerate}".`;
            } else {
                currentSystemPrompt += `\n\nIMPORTANTE (REGENERACIÓN TOTAL): El usuario ha pedido regenerar la ficha. DEBES proporcionar opciones COMPLETAMENTE DIFERENTES a las más obvias.`;
                if (currentValue) {
                    currentSystemPrompt += `\nIgnora estos datos que ya fueron rechazados: ${currentValue}\nBusca datos curiosos alternativos y otra pregunta original.`;
                }
            }
        }

        const userMessage = `Punto de interés: "${poiName || 'Desconocido'}"\n\nArtículo de investigación:\n${article}\n\nGenera la ficha didáctica en JSON.`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            systemInstruction: { role: "system", parts: [{ text: currentSystemPrompt }] }
        });

        let text = result.response.text().trim();

        // Limpiar posibles wrappers de markdown
        text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

        const parsed = JSON.parse(text);

        if (fieldToRegenerate && parsed[fieldToRegenerate]) {
            return NextResponse.json({
                [fieldToRegenerate]: parsed[fieldToRegenerate]
            });
        }

        return NextResponse.json({
            dato_clave_1: parsed.dato_clave_1 || '',
            dato_clave_2: parsed.dato_clave_2 || '',
            pregunta_interaccion: parsed.pregunta_interaccion || ''
        });
    } catch (error) {
        console.error('Fill ficha error:', error.message);

        // ═══ Detect 429 Quota Exceeded ═══
        if (error.message && error.message.includes('429')) {
            let retrySeconds = 60;
            const retryMatch = error.message.match(/retry in ([\d.]+)s/i);
            if (retryMatch) {
                retrySeconds = Math.ceil(parseFloat(retryMatch[1]));
            }
            return NextResponse.json({
                quotaExceeded: true,
                retryAfter: retrySeconds
            }, { status: 429 });
        }

        return NextResponse.json({
            dato_clave_1: '',
            dato_clave_2: '',
            pregunta_interaccion: ''
        }, { status: 500 });
    }
}
