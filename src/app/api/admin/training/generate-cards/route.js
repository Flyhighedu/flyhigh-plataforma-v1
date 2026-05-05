import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// Training Card Generator — Groq Llama 3
// Recibe el texto fuente de un módulo y genera fichas de estudio
// con preguntas/respuestas para capacitación del staff.
// ═══════════════════════════════════════════════════════════════

const GROQ_API_KEY = process.env.GROQ_API_KEY;

function getAdminClient() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

const SYSTEM_PROMPT = `Eres un diseñador instruccional experto en crear material de capacitación para personal operativo de aviación educativa.

Recibirás un texto (puede ser un manual, procedimiento, protocolo, o contenido educativo). Tu trabajo es generar fichas de estudio tipo flashcard con preguntas y respuestas concisas.

REGLAS:
- Genera entre 8 y 15 fichas dependiendo de la extensión y complejidad del texto.
- Cada ficha tiene: "question" (pregunta directa y clara) y "answer" (respuesta concisa, máximo 2 oraciones).
- Varía los tipos de preguntas: definiciones, procedimientos, datos numéricos, causas/consecuencias, mejores prácticas.
- Clasifica cada ficha con "card_type": "knowledge" (datos y definiciones), "procedure" (pasos y procesos), o "safety" (seguridad y precauciones).
- Asigna "difficulty": 1 (básico), 2 (intermedio), 3 (avanzado).
- Las preguntas deben ser claras y directas. Las respuestas deben ser verificables desde el texto fuente.
- Escribe en español mexicano profesional.
- Responde ÚNICAMENTE con un JSON array válido, sin markdown, sin explicaciones extra.
- Formato exacto: [{"question":"...","answer":"...","card_type":"knowledge|procedure|safety","difficulty":1|2|3}, ...]`;

export async function POST(request) {
    try {
        if (!GROQ_API_KEY) {
            return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 500 });
        }

        const { module_id, source_text, title } = await request.json();

        if (!module_id || !source_text) {
            return NextResponse.json({ error: 'module_id y source_text son requeridos' }, { status: 400 });
        }

        if (source_text.length < 50) {
            return NextResponse.json({ error: 'El texto fuente es demasiado corto (mínimo 50 caracteres)' }, { status: 400 });
        }

        // Truncate to ~6000 chars to stay within Groq context limits
        const truncatedText = source_text.length > 6000 
            ? source_text.substring(0, 6000) + '\n\n[...texto truncado para procesamiento...]' 
            : source_text;

        const userMsg = `Módulo de capacitación: "${title || 'Sin título'}"

Texto fuente:
${truncatedText}

Genera las fichas de estudio en formato JSON array.`;

        const groqBody = JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMsg }
            ],
            temperature: 0.4,
            max_tokens: 2000
        });

        let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: groqBody,
            cache: 'no-store'
        });

        // Mini-retry on 429
        if (res.status === 429) {
            console.log('⏳ Groq rate limit — retry en 2s...');
            await new Promise(r => setTimeout(r, 2000));
            res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: groqBody,
                cache: 'no-store'
            });
        }

        if (res.status === 429) {
            return NextResponse.json({ error: 'Rate limit en Groq. Intenta de nuevo en unos segundos.' }, { status: 429 });
        }
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq ${res.status}: ${errText}`);
        }

        const data = await res.json();
        let text = data.choices?.[0]?.message?.content?.trim() || '';
        text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        
        let cards;
        try {
            cards = JSON.parse(text);
        } catch (parseErr) {
            console.error('Failed to parse Groq response:', text);
            return NextResponse.json({ error: 'La IA no devolvió un formato válido. Intenta de nuevo.' }, { status: 422 });
        }

        if (!Array.isArray(cards) || cards.length === 0) {
            return NextResponse.json({ error: 'No se generaron fichas. Verifica que el texto tenga contenido sustancial.' }, { status: 422 });
        }

        // Insert cards into DB
        const supabase = getAdminClient();
        const cardsToInsert = cards.map((card, index) => ({
            module_id,
            question: card.question || '',
            answer: card.answer || '',
            card_type: ['knowledge', 'procedure', 'safety'].includes(card.card_type) ? card.card_type : 'knowledge',
            difficulty: [1, 2, 3].includes(card.difficulty) ? card.difficulty : 1,
            status: 'draft',
            sort_order: index
        }));

        const { data: insertedCards, error: insertError } = await supabase
            .from('training_cards')
            .insert(cardsToInsert)
            .select();

        if (insertError) throw insertError;

        return NextResponse.json({ 
            cards: insertedCards,
            count: insertedCards.length,
            engine: 'groq-llama-3.1-8b'
        });

    } catch (error) {
        console.error('Error generating training cards:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
