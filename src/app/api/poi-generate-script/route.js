import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request) {
    try {
        const body = await request.json();
        const { poiName, lat, lng, researchArticle, customInstructions } = body;

        if (!poiName) {
            return NextResponse.json({ error: 'poiName es requerido' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

        // Utilizamos gemini-2.5-flash-lite ya que 1.5 y 2.0 arrojan 404
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        // Bifurcación mínima: solo la línea introductoria cambia según coordenadas.
        // Las 6 reglas de personalidad son IDÉNTICAS al prompt original pre-Temas-Generales.
        const hasCoords = lat != null && lng != null;

        const REGLAS = `\n1. OBLIGATORIO: La primera oración DEBE mencionar explícitamente el nombre del lugar. (Ej. "El ${poiName} es..." o "La historia de ${poiName} comenzó..."). PROHIBIDO iniciar con frases genéricas de relleno como "¡Imagina un lugar donde...!" o "¿Sabías que este rincón...?". Ve directo al grano.\n2. Tono narrativo directo, calmado y amigable. Sin euforia ni exageraciones (PROHIBIDO usar signos de exclamación innecesarios).\n3. Di los hechos TAL CUAL SON, pero fáciles de digerir. PROHIBIDO usar jerga burocrática, histórica compleja o palabras rebuscadas. Explica las cosas de forma literal y sencilla (Ej. en lugar de decir "decretado zona protegida", di "se convirtió en parque"). NUNCA inventes datos.\n4. PROHIBIDO sonar como telegrama enciclopédico. Hila los datos en una narración corta y natural.\n5. Mantén respeto y calidez documental, sin infantilizar el contenido en exceso.\n6. PROHIBIDO fingir procesos de computadora ('escaneando'). NUNCA saludes ni te presentes.`;

        let prompt = hasCoords
            ? `Eres la locutora principal de una AUDIOGUÍA DOCUMENTAL para niños y adolescentes. Investiga el lugar: '${poiName}', ubicado en: ${lat}, ${lng}. Escribe un guion de MÁXIMO 60 palabras (15 segs). REGLAS ESTRICTAS:${REGLAS}`
            : `Eres la locutora principal de una AUDIOGUÍA DOCUMENTAL para niños y adolescentes. Investiga el tema: '${poiName}'. Escribe un guion de MÁXIMO 60 palabras (15 segs). REGLAS ESTRICTAS:${REGLAS}`;

        if (customInstructions && customInstructions.trim().length > 0) {
            prompt += `\n\nATENCIÓN (INSTRUCCIÓN DIRECTA DEL DIRECTOR): \nDEBES seguir obligatoriamente esta indicación para construir el guion:\n"${customInstructions}"`;
        }

        if (researchArticle) {
            prompt += `\n\nCONTEXTO GENERAL (Úsalo solo como base para hilar la historia):\n${researchArticle}`;
        }

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ script: responseText.trim() });
    } catch (error) {
        console.error('Error generating narrative script:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
