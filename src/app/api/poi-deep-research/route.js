import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ═══════════════════════════════════════════════════════════════
// POI Deep Research — Investigación profunda de un solo POI
// Ahora potenciado por Gemini 1.5 Flash + BÚSQUEDA EN GOOGLE.
// 0 Alucinaciones. Usa datos 100% reales de internet.
// ═══════════════════════════════════════════════════════════════

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `Eres un investigador enciclopédico experto en México. Tienes ACCESO DIRECTO A GOOGLE SEARCH.
Tu única tarea es investigar lugares y puntos de interés (POIs) para generar un artículo educativo verídico que será leído por un piloto a sus pasajeros.

REGLAS ABSOLUTAS E INQUEBRANTABLES:
1. DEBES buscar el lugar en Google.
2. Si los resultados de Google NO confirman la existencia del lugar ni arrojan historia real, DEBES decir exactamente: "No se encontró información histórica verificada para este punto."
3. NUNCA INVENTES DATOS. Si no estás 100% seguro con base en los resultados web, no lo pongas.

ESTRUCTURA DEL ARTÍCULO (Si encuentras info):
- **Introducción** — Qué es y dónde está.
- **Historia** — Fechas, origen, fundación real.
- **Importancia** — Relevancia cultural/económica real.
- **Datos curiosos** — Hechos interesantes confirmados por la web.

- 5-8 oraciones máximo.
- Español claro y amigable.
- Sin formato Markdown (nada de asteriscos ni negritas), solo texto plano con punto y seguido.`;

export async function POST(request) {
    try {
        const { name, type, context, lat, lon } = await request.json();
        if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

        console.log(`🔬 Deep research (Gemini Search): "${name}" (${context})`);

        if (!GEMINI_API_KEY) {
            console.error('Falta GEMINI_API_KEY en .env.local');
            return NextResponse.json({ article: 'Error: API Key de Gemini no configurada. Agrega GEMINI_API_KEY al .env.local.' });
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Usamos Gemini 1.5 Flash: es rápido, soporta Search Grounding y tiene capa gratuita masiva.
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            // ¡ESTA ES LA MAGIA! Activamos la búsqueda en Google.
            tools: [{ googleSearch: {} }]
        });

        let msg = `Investiga a fondo este punto de interés en Google:\n\n`;
        msg += `📍 Nombre: "${name}"\n`;
        msg += `🏙️ Ciudad/Estado: ${context || 'México'}\n`;
        if (lat && lon) msg += `🌐 Coordenadas GPS: ${lat}, ${lon}\n`;
        if (type) msg += `🏷️ Categoría de mapa: ${type}\n`;
        msg += `\nGenera el artículo educativo con los datos reales encontrados en la web. Recuerda tus instrucciones del sistema.`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: msg }] }],
            systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] }
        });

        let text = result.response.text().trim();

        if (text) {
            text = text.replace(/^["']+|["']+$/g, '').trim();
            text = text.replace(/\*\*/g, '').trim(); // Quitar negritas si se le cuelan
        }

        console.log(`  ✓ Gemini response: ${text.length} chars`);
        return NextResponse.json({ article: text });
    } catch (error) {
        console.error('Deep research error:', error.message);

        // ═══ Detect 429 Quota Exceeded and forward retryDelay to frontend ═══
        if (error.message && error.message.includes('429')) {
            let retrySeconds = 60; // Default fallback
            const retryMatch = error.message.match(/retry in ([\d.]+)s/i);
            if (retryMatch) {
                retrySeconds = Math.ceil(parseFloat(retryMatch[1]));
            }
            console.warn(`⏳ Quota hit. Advising frontend to retry in ${retrySeconds}s`);
            return NextResponse.json({
                quotaExceeded: true,
                retryAfter: retrySeconds
            }, { status: 429 });
        }

        return NextResponse.json({ article: 'Ocurrió un error al intentar conectarse a Google para investigar este lugar.' }, { status: 500 });
    }
}
