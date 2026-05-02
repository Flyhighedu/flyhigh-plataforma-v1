import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// POI Info — Groq AI + Supabase Cache
// Cada POI se consulta a Groq UNA vez, después vive en caché.
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `Eres un guía turístico educativo de México especializado en puntos de interés.
Genera una descripción BREVE (2-3 oraciones, máximo 200 caracteres) sobre el siguiente punto de interés.

Reglas:
- La información debe ser precisa y educativa (para niños y maestros)
- Enfócate en historia, cultura o importancia del lugar
- En español
- Si no conoces el lugar exacto, describe qué tipo de lugar es basándote en su nombre y categoría
- Responde SOLO con la descripción, sin comillas, sin formato extra`;

// Normalizar nombre para crear una clave única de caché
function makeCacheKey(name, context) {
    const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const ctx = (context || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return `${norm}|${ctx}`;
}

// Estado de cuota Groq (se actualiza con cada llamada)
let lastGroqQuota = null;

// Llamar a Groq para generar descripción
async function generateDescription(poiName, poiType, context) {
    if (!GROQ_API_KEY) {
        console.error('GROQ_API_KEY no configurada');
        return null;
    }

    try {
        const userMessage = `Punto de interés: "${poiName}"
Ubicación: ${context || 'México'}
Tipo: ${poiType || 'punto de interés'}`;

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        // Capturar headers de cuota de Groq
        lastGroqQuota = {
            remainingRequests: parseInt(res.headers.get('x-ratelimit-remaining-requests') || '0'),
            limitRequests: parseInt(res.headers.get('x-ratelimit-limit-requests') || '14400'),
            remainingTokens: parseInt(res.headers.get('x-ratelimit-remaining-tokens') || '0'),
            limitTokens: parseInt(res.headers.get('x-ratelimit-limit-tokens') || '500000'),
            resetRequests: res.headers.get('x-ratelimit-reset-requests') || '',
            resetTokens: res.headers.get('x-ratelimit-reset-tokens') || ''
        };

        if (!res.ok) {
            const errText = await res.text();
            console.error(`Groq API error (${res.status}):`, errText);
            return null;
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();

        if (text && text.length > 10) {
            console.log(`  [Groq] ✓ "${poiName}" → ${text.length} chars | Cuota: ${lastGroqQuota.remainingRequests}/${lastGroqQuota.limitRequests} req`);
            return text;
        }
        return null;
    } catch (e) {
        console.error(`  [Groq] Error:`, e.message);
        return null;
    }
}

export async function POST(request) {
    try {
        const { pois, context } = await request.json();
        if (!pois || !pois.length) return NextResponse.json({});

        const results = {};

        // Paso 1: Intentar buscar en caché (tolerante a fallos si tabla no existe)
        const cacheKeys = pois.map(p => makeCacheKey(p.name, context));
        const cacheMap = {};

        try {
            const { data: cachedRows } = await supabase
                .from('poi_info_cache')
                .select('poi_key, description')
                .in('poi_key', cacheKeys);

            (cachedRows || []).forEach(row => {
                cacheMap[row.poi_key] = row.description;
            });
        } catch (e) {
            console.warn('Cache read skipped:', e.message);
        }

        // Paso 2: Para cada POI, servir de caché o generar con Groq
        const toInsert = [];

        for (const poi of pois) {
            const key = makeCacheKey(poi.name, context);

            // ¿Ya está en caché?
            if (cacheMap[key]) {
                results[poi.name] = cacheMap[key];
                console.log(`📦 "${poi.name}" → caché`);
                continue;
            }

            // Generar con Groq
            console.log(`🤖 "${poi.name}" → Groq...`);
            const description = await generateDescription(poi.name, poi.type, context);

            if (description) {
                results[poi.name] = description;
                toInsert.push({
                    poi_key: key,
                    poi_name: poi.name,
                    lat: poi.lat || null,
                    lon: poi.lon || null,
                    description: description,
                    city_context: context || null
                });
            } else {
                results[poi.name] = null;
            }
        }

        // Paso 3: Guardar nuevos resultados en caché (tolerante a fallos)
        if (toInsert.length > 0) {
            try {
                const { error } = await supabase
                    .from('poi_info_cache')
                    .upsert(toInsert, { onConflict: 'poi_key' });

                if (error) {
                    console.warn('Cache write skipped:', error.message);
                } else {
                    console.log(`💾 ${toInsert.length} POIs guardados en caché`);
                }
            } catch (e) {
                console.warn('Cache write skipped:', e.message);
            }
        }

        return NextResponse.json({ results, quota: lastGroqQuota });
    } catch (error) {
        console.error('POI batch info error:', error.message);
        return NextResponse.json({}, { status: 500 });
    }
}
