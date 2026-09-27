import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPhasePrompt, educationPhase, hasUsableResearch } from '@/lib/education-phases.mjs';
import { geminiApiKey } from '@/lib/gemini-config.mjs';

export async function POST(request) {
    try {
        const body = await request.json();
        const { poiName, lat, lng, researchArticle, customInstructions } = body;
        const phaseId = body.phaseId ?? 'general';
        if (!educationPhase(phaseId)) return NextResponse.json({ error: 'Fase educativa inválida.' }, { status: 400 });

        if (typeof poiName !== 'string' || !poiName.trim() || poiName.length > 240) {
            return NextResponse.json({ error: 'poiName es requerido' }, { status: 400 });
        }
        if (phaseId !== 'general' && (!hasUsableResearch(researchArticle) || !['nature', 'context'].includes(body.curriculumFocus ?? 'context'))) {
            return NextResponse.json({ error: 'Agrega una investigación suficiente y selecciona un enfoque curricular válido.' }, { status: 400 });
        }
        if ((researchArticle && (typeof researchArticle !== 'string' || researchArticle.length > 80000)) ||
            (customInstructions && (typeof customInstructions !== 'string' || customInstructions.length > 5000)) ||
            (body.learningGoal && (typeof body.learningGoal !== 'string' || body.learningGoal.length > 220))) {
            return NextResponse.json({ error: 'El contenido excede el tamaño permitido.' }, { status: 400 });
        }

        const apiKey = geminiApiKey();
        if (!apiKey) return NextResponse.json({ error: 'La generación con IA no está configurada en este entorno. Puedes escribir y guardar los guiones manualmente.' }, { status: 503 });

        // Utilizamos gemini-2.5-flash-lite ya que 1.5 y 2.0 arrojan 404
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', ...(phaseId !== 'general' ? { generationConfig: {
            responseMimeType: 'application/json', temperature: 0.4,
            responseSchema: { type: 'OBJECT', properties: {
                script: { type: 'STRING', description: 'Guion oral breve. Vacío si falta información factual.' },
                learning_goal: { type: 'STRING', description: 'Propósito concreto, máximo 220 caracteres.' },
                review_note: { type: 'STRING', description: 'Una observación breve para revisión humana. No redefinir fases ni grados de la SEP.' },
                error: { type: 'STRING', description: 'Solo si no es posible redactar un guion con la información aportada.' },
            }, required: ['script', 'learning_goal', 'review_note'] },
        } } : {}) });

        if (phaseId !== 'general') {
            const prompt = buildPhasePrompt({ poiName, researchArticle, phaseId, focus: body.curriculumFocus, learningGoal: body.learningGoal, customInstructions });
            const result = await model.generateContent(prompt);
            let data;
            try { data = JSON.parse(result.response.text()); } catch { return NextResponse.json({ error: 'La propuesta llegó incompleta. Vuelve a intentarlo; tu guion se conserva.' }, { status: 502 }); }
            if (data?.error) return NextResponse.json({ error: String(data.error).slice(0, 500) }, { status: 422 });
            if (!data || typeof data.script !== 'string' || data.script.trim().length < 10 || data.script.length > 10000 ||
                typeof data.learning_goal !== 'string' || !data.learning_goal.trim() || data.learning_goal.length > 220 ||
                typeof data.review_note !== 'string' || data.review_note.length > 2000) {
                return NextResponse.json({ error: 'La propuesta no incluye un guion y un propósito válidos. Intenta de nuevo.' }, { status: 502 });
            }
            return NextResponse.json({ script: data.script.trim(), learning_goal: data.learning_goal.trim(), review_note: data.review_note, phaseId });
        }

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
