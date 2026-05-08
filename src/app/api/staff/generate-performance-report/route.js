import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// POST /api/staff/generate-performance-report
//
// Generates a personalized AI-written performance report
// for a staff member using Gemini 3.1 Pro.
//
// READS from audio_quality_audits (never writes).
// Completely isolated from analyze-audio pipeline.
//
// SAFETY: Non-blocking. Failures return graceful errors.
// =====================================================

export const runtime = 'nodejs';
export const maxDuration = 30;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REPORT_MODEL = 'gemini-3.1-pro-preview';

function getSupabaseAdmin() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ── Aggregate audit data into compact JSON for Gemini ──
function aggregateAudits(audits, role, actorName) {
    const isPilot = role === 'pilot';
    const sourceFilter = isPilot ? 'pilot_narration' : 'bitacora';

    const relevant = audits.filter(
        a => a.source === sourceFilter && a.status === 'completed' && a.score !== null
    );

    if (relevant.length === 0) return null;

    const avgScore = Math.round(relevant.reduce((s, a) => s + a.score, 0) / relevant.length);

    // Count pass/fail for each criterion
    const countField = (field) => {
        let passed = 0, total = 0;
        for (const a of relevant) {
            if (a[field] === true) { passed++; total++; }
            else if (a[field] === false) { total++; }
        }
        return { aprobados: passed, total };
    };

    // Energy distribution
    const energyCounts = { alta: 0, media: 0, baja: 0 };
    for (const a of relevant) {
        const e = a.energia_interaccion;
        if (e && energyCounts[e] !== undefined) energyCounts[e]++;
    }
    const dominantEnergy = Object.entries(energyCounts).sort((a, b) => b[1] - a[1])[0];
    const energyLabel = dominantEnergy && dominantEnergy[1] > 0 ? dominantEnergy[0] : 'no disponible';

    // Collect unique feedbacks from individual audits
    const feedbacks = relevant
        .map(a => a.feedback_para_isa)
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3);

    let criterios;
    if (isPilot) {
        criterios = {
            datos_educativos: {
                ...countField('menciona_destino'),
                descripcion: 'Mencionar datos educativos o geográficos de los puntos de interés durante la narración del vuelo'
            },
            energia_positiva: {
                ...countField('energia_positiva'),
                descripcion: 'Transmitir energía, asombro y entusiasmo en la voz al narrar'
            },
            interaccion_ninos: {
                ...countField('participacion_ninos_audible'),
                descripcion: 'Fomentar la participación activa de los niños durante el vuelo'
            }
        };
    } else {
        criterios = {
            nombre_equipo: {
                ...countField('menciona_nombre_equipo'),
                descripcion: 'Ponerle nombre al equipo de niños y usarlo durante la actividad'
            },
            destino_vuelo: {
                ...countField('menciona_destino'),
                descripcion: 'Mencionar a dónde van a "volar" para activar la imaginación'
            },
            dinamica_sube_sube: {
                ...countField('dinamica_sube_sube'),
                descripcion: 'Realizar la dinámica interactiva "¡Sube, sube! ¡Hasta las nubes!"'
            },
            energia_positiva: {
                ...countField('energia_positiva'),
                descripcion: 'Transmitir entusiasmo y actitud positiva con la voz'
            },
            participacion_ninos: {
                ...countField('participacion_ninos_audible'),
                descripcion: 'Lograr que los niños participen activamente'
            }
        };
    }

    return {
        empleado: actorName,
        rol: isPilot ? 'Piloto' : 'Docente',
        vuelos_evaluados: relevant.length,
        score_promedio: avgScore,
        criterios,
        energia_vocal_dominante: energyLabel,
        feedbacks_previos: feedbacks
    };
}

// ── Build the system prompt for Gemini ──
function buildPrompt(data) {
    return `Eres un coach de desempeño de la empresa educativa Fly High.
Tu trabajo es escribir un reporte personalizado y útil para ${data.empleado}, quien trabaja como ${data.rol}.

CONTEXTO DE LA EMPRESA:
- Fly High lleva experiencias de vuelo virtual a escuelas primarias en México.
- El Piloto narra los vuelos simulados y debe mencionar datos educativos sobre los puntos de interés que sobrevuelan (geografía, historia, datos curiosos).
- La Docente dirige las dinámicas con los niños, les pone nombre de equipo y realiza la dinámica "¡Sube, sube! ¡Hasta las nubes!".
- Existe una sección en la app llamada "Academia" donde los empleados pueden estudiar los puntos de interés de cada escuela antes de cada misión. Si el piloto no mencionó datos educativos, recomiéndale usar la Academia.

DATOS DE LA JORNADA DE HOY:
${JSON.stringify(data, null, 2)}

REGLAS PARA EL REPORTE:
1. Tutéalo. Escribe como un compañero experimentado que se preocupa genuinamente, no como un jefe.
2. SIEMPRE empieza reconociendo lo que hizo bien — sé específico con los números.
3. Si hay áreas débiles, explica POR QUÉ importan para la experiencia de los niños y da un consejo CONCRETO y accionable.
4. Si es piloto y falló en "datos_educativos" → recomiéndale usar la "Academia" para estudiar los puntos de interés antes de la misión.
5. Si es docente y falló en "dinamica_sube_sube" → recuérdale la frase clave: "¡Sube, sube!" y que los niños responden "¡Hasta las nubes!".
6. Cierra con un mensaje motivacional y personal mencionando que en la próxima misión se evaluará nuevamente y que es una oportunidad de crecer.
7. Escribe en PROSA NARRATIVA fluida (4-6 oraciones). NO uses bullets, listas, asteriscos ni formato markdown.
8. Sé honesto pero amable. Si todo salió bien, celébralo genuinamente con entusiasmo.
9. NO inventes datos. Solo usa la información proporcionada.
10. Escribe en español mexicano natural y cálido.
11. NO incluyas el score numérico en el texto — ese ya se muestra en la UI.`;
}

// ── Score grading ──
function getGrade(score) {
    if (score >= 90) return '¡Excelente!';
    if (score >= 75) return '¡Buen trabajo!';
    if (score >= 60) return 'Bien, puedes mejorar';
    if (score >= 40) return 'Necesitas practicar';
    return 'Requiere atención';
}

// ── Main handler ──
export async function POST(request) {
    try {
        const body = await request.json();
        const { journeyId, role, actorName } = body || {};

        if (!journeyId || !role || !actorName) {
            return NextResponse.json(
                { ok: false, error: 'Missing required fields: journeyId, role, actorName' },
                { status: 400 }
            );
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json(
                { ok: false, error: 'Missing GEMINI_API_KEY configuration' },
                { status: 500 }
            );
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return NextResponse.json(
                { ok: false, error: 'Missing Supabase configuration' },
                { status: 500 }
            );
        }

        // ── Step 1: Read audits (READ-ONLY) ──
        const { data: audits, error: dbError } = await supabase
            .from('audio_quality_audits')
            .select('*')
            .eq('journey_id', journeyId)
            .order('created_at', { ascending: true });

        if (dbError) {
            console.error('[PerformanceReport] DB error:', dbError);
            return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
        }

        // ── Step 2: Aggregate data ──
        const aggregated = aggregateAudits(audits || [], role, actorName);

        if (!aggregated) {
            return NextResponse.json({ ok: false, reason: 'no_audits' });
        }

        // ── Step 3: Generate narrative with Gemini 3.1 Pro ──
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: REPORT_MODEL,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500
            }
        });

        const prompt = buildPrompt(aggregated);

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const narrative = result.response?.text?.() || result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!narrative.trim()) {
            return NextResponse.json({ ok: false, reason: 'empty_response' });
        }

        // ── Step 4: Determine if Academia should be recommended ──
        const needsAcademia = role === 'pilot' &&
            aggregated.criterios?.datos_educativos?.aprobados === 0 &&
            aggregated.criterios?.datos_educativos?.total > 0;

        return NextResponse.json({
            ok: true,
            report: {
                narrative: narrative.trim(),
                score: aggregated.score_promedio,
                grade: getGrade(aggregated.score_promedio),
                flightCount: aggregated.vuelos_evaluados,
                energyLabel: aggregated.energia_vocal_dominante,
                needsAcademia
            }
        });

    } catch (error) {
        console.error('[PerformanceReport] Error:', error);
        return NextResponse.json(
            { ok: false, error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
