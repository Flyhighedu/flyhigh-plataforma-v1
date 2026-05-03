import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// POI Info — Groq AI (Deep Research Mode) + Supabase Cache
// Modelo grande (70B) para información REAL y verificable.
// Cada POI se investiga UNA vez, después vive en caché.
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Modelo grande para investigación profunda (1,000 req/día, sobra con caché)
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
// Modelo respaldo si el grande falla por rate limit
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `Eres un investigador y guía turístico profesional de México con conocimiento enciclopédico profundo.

Tu trabajo es proporcionar información REAL, VERIFICABLE y EDUCATIVA sobre puntos de interés en México. Esta información será narrada por un piloto de vuelos turísticos a pasajeros, incluyendo niños y maestros de escuelas.

INSTRUCCIONES DE INVESTIGACIÓN:
1. Analiza el nombre del punto de interés, su ubicación geográfica exacta (coordenadas GPS y ciudad/estado), y su categoría.
2. Busca en tu conocimiento: hechos históricos, fechas, personajes relevantes, eventos importantes, datos geográficos, significado cultural.
3. Si el nombre contiene un santo (San Pedro, San Francisco, etc.): investiga la historia del lugar, no del santo.
4. Si es un cerro, volcán o formación natural: incluye datos geográficos reales (altitud si la conoces, ecosistema, importancia para la región).
5. Si es un templo o iglesia: menciona la época de construcción, estilo arquitectónico, y su relevancia para la comunidad.
6. Si es un sitio industrial (fábrica, mina, etc.): investiga su historia económica y su impacto en la región.

REGLAS DE CALIDAD:
- SOLO incluye información que consideres REAL y verificable. No inventes fechas, nombres ni datos.
- Si genuinamente no tienes información específica sobre este lugar exacto, di honestamente: "Este punto de interés se encuentra en [ubicación]. No se cuenta con información histórica verificada en este momento."
- NO llenes con información genérica tipo "los templos son importantes para la comunidad". Eso no sirve.
- Escribe en español, en tono informativo pero accesible.
- 3-5 oraciones. Entre 150 y 400 caracteres.
- Responde SOLO con la descripción, sin comillas, sin markdown, sin prefijos como "Respuesta:" o "Descripción:".`;

// Normalizar nombre para crear una clave única de caché
function makeCacheKey(name, context) {
    const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const ctx = (context || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return `${norm}|${ctx}`;
}

// Estado de cuota Groq (se actualiza con cada llamada)
let lastGroqQuota = null;

// Llamar a Groq para investigar un POI
async function investigatePOI(poiName, poiType, context, lat, lon, model) {
    if (!GROQ_API_KEY) {
        console.error('GROQ_API_KEY no configurada');
        return null;
    }

    try {
        let userMessage = `Investiga este punto de interés:\n`;
        userMessage += `Nombre: "${poiName}"\n`;
        userMessage += `Ciudad/Estado: ${context || 'México'}\n`;
        if (lat && lon) {
            userMessage += `Coordenadas GPS: ${lat}, ${lon}\n`;
        }
        if (poiType) {
            userMessage += `Categoría OSM: ${poiType}\n`;
        }
        userMessage += `\nProporciona información real y verificable sobre este lugar.`;

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.2, // Bajo para máxima precisión factual
                max_tokens: 350
            })
        });

        // Capturar headers de cuota de Groq
        lastGroqQuota = {
            remainingRequests: parseInt(res.headers.get('x-ratelimit-remaining-requests') || '0'),
            limitRequests: parseInt(res.headers.get('x-ratelimit-limit-requests') || '14400'),
            remainingTokens: parseInt(res.headers.get('x-ratelimit-remaining-tokens') || '0'),
            limitTokens: parseInt(res.headers.get('x-ratelimit-limit-tokens') || '500000'),
            resetRequests: res.headers.get('x-ratelimit-reset-requests') || '',
            resetTokens: res.headers.get('x-ratelimit-reset-tokens') || '',
            model: model
        };

        if (res.status === 429) {
            console.warn(`  [Groq] Rate limit en ${model}`);
            return { rateLimited: true };
        }

        if (!res.ok) {
            const errText = await res.text();
            console.error(`Groq API error (${res.status}):`, errText);
            return null;
        }

        const data = await res.json();
        let text = data.choices?.[0]?.message?.content?.trim();

        // Limpiar formatos extraños
        if (text) {
            text = text.replace(/^["']+|["']+$/g, '').trim();
            text = text.replace(/^\*\*.*?\*\*[\s:]*/g, '').trim();
            text = text.replace(/^(Respuesta|Descripción|Info|Nota):\s*/i, '').trim();
        }

        if (text && text.length > 30) {
            return text;
        }

        return null;
    } catch (e) {
        console.error(`  [Groq] Error (${model}):`, e.message);
        return null;
    }
}

// Pipeline de investigación: 70B → 8B fallback
async function deepResearch(poiName, poiType, context, lat, lon) {
    // Intento 1: Modelo grande (70B) — máximo conocimiento
    console.log(`  🔬 Investigando con ${PRIMARY_MODEL}...`);
    let result = await investigatePOI(poiName, poiType, context, lat, lon, PRIMARY_MODEL);

    // Si fue rate-limited, intentar con modelo pequeño
    if (result && result.rateLimited) {
        console.log(`  ⚡ Fallback a ${FALLBACK_MODEL}...`);
        result = await investigatePOI(poiName, poiType, context, lat, lon, FALLBACK_MODEL);
        if (result && result.rateLimited) return null;
    }

    if (typeof result === 'string') {
        console.log(`  ✓ "${poiName}" → ${result.length} chars | Cuota: ${lastGroqQuota?.remainingRequests}/${lastGroqQuota?.limitRequests}`);
        return result;
    }

    return null;
}

export async function POST(request) {
    try {
        const { pois, context } = await request.json();
        if (!pois || !pois.length) return NextResponse.json({});

        const results = {};

        // Paso 1: Buscar en caché
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

        // Paso 2: Para cada POI, servir de caché o investigar con Groq
        const toInsert = [];
        let fromCache = 0;
        let fromGroq = 0;
        let noInfo = 0;

        for (const poi of pois) {
            const key = makeCacheKey(poi.name, context);

            if (cacheMap[key]) {
                results[poi.name] = cacheMap[key];
                fromCache++;
                continue;
            }

            // Investigar con IA
            console.log(`🔍 "${poi.name}" → investigando...`);
            const description = await deepResearch(poi.name, poi.type, context, poi.lat, poi.lon);

            if (description) {
                results[poi.name] = description;
                fromGroq++;
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
                noInfo++;
            }
        }

        console.log(`📊 Resumen: ${fromCache} caché, ${fromGroq} investigados, ${noInfo} sin info verificada`);

        // Paso 3: Guardar en caché
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
