import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// POST /api/staff/analyze-audio
//
// AI-Powered Audio Quality Monitoring — "El Cerebro"
//
// Receives an audio URL (from Supabase Storage),
// downloads it, sends it to Gemini 2.5 Flash for
// native audio analysis, and stores the quality
// scorecard in audio_quality_audits.
//
// FLOW:
//   1. Receive audioUrl + journeyId + flightNumber
//   2. Download audio from Storage (server-side)
//   3. Convert to base64 for Gemini inlineData
//   4. Send to Gemini with QA audit prompt
//   5. Parse JSON scorecard from response
//   6. Persist scorecard in audio_quality_audits
//   7. Return scorecard to caller (for ISA feedback)
//
// SECURITY: Uses dedicated GEMINI_AUDIO_API_KEY and
//           SUPABASE_SERVICE_ROLE_KEY. No client secrets.
//
// SAFETY: This endpoint is fire-and-forget from the PWA.
//         Failures here must NEVER block ISA's workflow.
// =====================================================

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60s for audio analysis

const GEMINI_AUDIO_KEY = process.env.GEMINI_AUDIO_API_KEY || process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MODEL_ID = 'gemini-2.5-flash';
const MIN_AUDIO_DURATION_SEC = 5;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB safety cap

// ───────── Supabase Admin Client ─────────
function getSupabaseAdmin() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ───────── Audit Prompt for Pre-Flight Dynamic ─────────
const BITACORA_AUDIT_PROMPT = `Eres un supervisor de calidad de Fly High, una empresa de experiencias de vuelo educativas para niños en escuelas.

Estás escuchando el audio de la DINÁMICA PREVIA AL VUELO que la Animadora (ISA) realiza con un grupo de niños antes de que suban al simulador.

La dinámica tiene un protocolo de 4 pasos obligatorios:

1. **NOMBRE DEL EQUIPO**: La animadora debe ponerle un nombre al grupo de niños (ej: "Escuadrón Águilas", "Escuadrón Tiburones") y referirse a ellos por ese nombre durante la dinámica. Los nombres son siempre de animales.

2. **MENCIÓN DEL DESTINO**: Debe mencionar a dónde van a "volar" — el destino o lugar especial que los niños eligieron. Puede ser una ciudad, país o lugar ficticio/imaginario.

3. **DINÁMICA "¡SUBE SUBE!"**: Este es el momento clave. La animadora debe hacer la dinámica interactiva donde les explica que el dron necesita de SU VOZ para volar. Les dice: cuando yo diga "¡SUBE, SUBE, SUBE!", ustedes tienen que gritar muy fuerte "¡HASTA LAS NUBES!". Si no gritan fuerte, el dron se apaga. Debe practicarlo al menos una vez con los niños.

4. **ENERGÍA E INTERACCIÓN**: La animadora debe sonar entusiasta, con energía alta, proyectando la voz, haciendo participar activamente a los niños (no debe ser un monólogo; se deben escuchar respuestas o gritos de los niños).

INSTRUCCIONES DE ANÁLISIS:
- Escucha el audio completo con atención.
- El audio CONTIENE ruido ambiental significativo (estamos al aire libre, en una escuela, con niños pequeños). No penalices por ruido de fondo.
- Si no puedes distinguir claramente si una parte se realizó o no debido al ruido, márcala como null (no_detectado) en vez de false.
- El idioma es español mexicano.
- Sé justo pero exigente. El score debe reflejar realmente la calidad de la dinámica.

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown, sin backticks. Solo el JSON:

{
  "menciona_nombre_equipo": true | false | null,
  "nombre_equipo_detectado": "nombre escuchado" | null,
  "menciona_destino": true | false | null,
  "destino_detectado": "destino mencionado" | null,
  "dinamica_sube_sube": true | false | null,
  "energia_interaccion": "alta" | "media" | "baja" | "no_detectado",
  "participacion_ninos_audible": true | false | null,
  "score": número de 0 a 100,
  "feedback_para_isa": "Mensaje directo, amigable y constructivo para ISA en español. Si hizo todo bien, felicítala brevemente. Si faltó algo, dile exactamente qué faltó y cómo mejorarlo. Máximo 2 oraciones cortas.",
  "resumen_supervisor": "Resumen técnico de una línea para el panel de administración."
}`;

// ───────── Audit Prompt for Pilot Flight Narration ─────────
const PILOT_NARRATION_PROMPT = `Eres un supervisor de calidad de Fly High, una empresa de experiencias de vuelo educativas para niños en escuelas.

Estás escuchando el audio de la NARRACIÓN DURANTE EL VUELO que el Piloto realiza mientras opera el dron con un grupo de niños a bordo del simulador.

El piloto tiene un protocolo de 4 pasos obligatorios durante el vuelo:

1. **NOMBRE DEL EQUIPO**: El piloto debe referirse al grupo de niños por su nombre de escuadrón (ej: "Escuadrón Águilas", "Escuadrón Tiburones"). El nombre fue asignado por la animadora antes del vuelo.

2. **NARRACIÓN DEL DESTINO**: El piloto debe narrar sobre el destino al que están "volando". Debe hacer referencia al lugar (ciudad, país, o lugar imaginario) y describir lo que están "viendo" durante el vuelo para crear la experiencia inmersiva.

3. **INTERACCIÓN CON LOS NIÑOS**: El piloto debe interactuar activamente con los niños durante el vuelo. No debe ser un monólogo. Debe hacerles preguntas, animarlos a mirar por la "ventana", invitarlos a gritar o reaccionar. Se deben escuchar respuestas o reacciones de los niños.

4. **ENERGÍA Y ENTUSIASMO**: El piloto debe sonar emocionado, entusiasta y con buena proyección de voz. Debe transmitir emoción y aventura, no sonar monótono o aburrido.

INSTRUCCIONES DE ANÁLISIS:
- Escucha el audio completo con atención.
- El audio CONTIENE ruido ambiental significativo (estamos al aire libre, en una escuela, con motor de dron, y niños). No penalices por ruido de fondo.
- Si no puedes distinguir claramente si una parte se realizó o no debido al ruido, márcala como null (no_detectado) en vez de false.
- El idioma es español mexicano.
- Sé justo pero exigente. El score debe reflejar realmente la calidad de la narración del piloto.

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown, sin backticks. Solo el JSON:

{
  "menciona_nombre_equipo": true | false | null,
  "nombre_equipo_detectado": "nombre escuchado" | null,
  "menciona_destino": true | false | null,
  "destino_detectado": "destino mencionado" | null,
  "dinamica_sube_sube": true | false | null,
  "energia_interaccion": "alta" | "media" | "baja" | "no_detectado",
  "participacion_ninos_audible": true | false | null,
  "score": número de 0 a 100,
  "feedback_para_isa": "Mensaje directo, amigable y constructivo para el PILOTO en español. Si hizo todo bien, felicítalo brevemente. Si faltó algo, dile exactamente qué faltó y cómo mejorarlo. Máximo 2 oraciones cortas.",
  "resumen_supervisor": "Resumen técnico de una línea para el panel de administración."
}`;

// ───────── Select prompt based on audio source ─────────
function getAuditPrompt(source) {
    if (source === 'pilot_narration') return PILOT_NARRATION_PROMPT;
    return BITACORA_AUDIT_PROMPT;
}


// ───────── Download audio from URL ─────────
async function downloadAudio(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_AUDIO_SIZE_BYTES) {
        throw new Error(`Audio file too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_AUDIO_SIZE_BYTES) {
        throw new Error(`Audio buffer too large: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
    }

    return Buffer.from(arrayBuffer);
}

// ───────── Detect MIME type from URL ─────────
function detectMimeType(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('.webm')) return 'audio/webm';
    if (lower.includes('.mp3'))  return 'audio/mp3';
    if (lower.includes('.mp4'))  return 'audio/mp4';
    if (lower.includes('.m4a'))  return 'audio/m4a';
    if (lower.includes('.wav'))  return 'audio/wav';
    if (lower.includes('.ogg'))  return 'audio/ogg';
    if (lower.includes('.flac')) return 'audio/flac';
    // Default: webm (our recorder outputs WebM/Opus)
    return 'audio/webm';
}

// ───────── Parse JSON from Gemini response (fault-tolerant) ─────────
function parseGeminiJSON(text) {
    // Try direct parse first
    try {
        return JSON.parse(text);
    } catch { /* try cleanup */ }

    // Strip markdown code fences if present
    const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch { /* try regex extraction */ }

    // Last resort: extract first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch { /* give up */ }
    }

    return null;
}

// ───────── Normalize scorecard values ─────────
function normalizeScorecard(raw) {
    const toBool = (v) => {
        if (v === true || v === false) return v;
        if (v === null || v === 'null' || v === 'no_detectado') return null;
        if (v === 'true') return true;
        if (v === 'false') return false;
        return null;
    };

    const energyValues = ['alta', 'media', 'baja', 'no_detectado'];
    const rawEnergy = String(raw.energia_interaccion || 'no_detectado').toLowerCase();

    return {
        menciona_nombre_equipo: toBool(raw.menciona_nombre_equipo),
        nombre_equipo_detectado: raw.nombre_equipo_detectado || null,
        menciona_destino: toBool(raw.menciona_destino),
        destino_detectado: raw.destino_detectado || null,
        dinamica_sube_sube: toBool(raw.dinamica_sube_sube),
        energia_interaccion: energyValues.includes(rawEnergy) ? rawEnergy : 'no_detectado',
        participacion_ninos_audible: toBool(raw.participacion_ninos_audible),
        score: Math.max(0, Math.min(100, Number(raw.score) || 0)),
        feedback_para_isa: String(raw.feedback_para_isa || '').trim() || null,
        resumen_supervisor: String(raw.resumen_supervisor || '').trim() || null
    };
}

// ───────── Create initial audit record ─────────
async function createAuditRecord(supabase, { journeyId, userId, flightNumber, source, audioUrl, durationSeconds }) {
    const { data, error } = await supabase
        .from('audio_quality_audits')
        .insert({
            journey_id: journeyId,
            user_id: userId || null,
            flight_number: flightNumber || null,
            source: source || 'bitacora',
            audio_url: audioUrl || null,
            audio_duration_seconds: durationSeconds || null,
            status: 'analyzing'
        })
        .select('id')
        .single();

    if (error) throw error;
    return data.id;
}

// ───────── Update audit record with results ─────────
async function updateAuditRecord(supabase, auditId, updates) {
    const { error } = await supabase
        .from('audio_quality_audits')
        .update({
            ...updates,
            analyzed_at: new Date().toISOString()
        })
        .eq('id', auditId);

    if (error) console.warn('⚠️ Failed to update audit record:', error.message);
}


// ═════════════════════════════════════════════════════
// POST Handler
// ═════════════════════════════════════════════════════
export async function POST(request) {
    const startTime = Date.now();

    try {
        // ── Validate server config ──
        if (!GEMINI_AUDIO_KEY) {
            return NextResponse.json(
                { ok: false, error: 'Missing GEMINI_AUDIO_API_KEY configuration.' },
                { status: 500 }
            );
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return NextResponse.json(
                { ok: false, error: 'Missing Supabase configuration.' },
                { status: 500 }
            );
        }

        // ── Parse request body ──
        let body;
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            body = await request.json();
        } else if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            body = {
                audioUrl: formData.get('audioUrl'),
                journeyId: formData.get('journeyId'),
                flightNumber: Number(formData.get('flightNumber')) || null,
                source: formData.get('source') || 'bitacora',
                userId: formData.get('userId') || null,
                durationSeconds: Number(formData.get('durationSeconds')) || null,
                auditId: formData.get('auditId') || null
            };
        } else {
            body = await request.json();
        }

        const { audioUrl, journeyId, flightNumber, source, userId, durationSeconds, auditId: existingAuditId } = body;

        // ── Validate required fields ──
        if (!audioUrl) {
            return NextResponse.json(
                { ok: false, error: 'Missing audioUrl.' },
                { status: 400 }
            );
        }

        if (!journeyId && !existingAuditId) {
            return NextResponse.json(
                { ok: false, error: 'Missing journeyId.' },
                { status: 400 }
            );
        }

        // ── Check minimum duration (if provided) ──
        if (durationSeconds && durationSeconds < MIN_AUDIO_DURATION_SEC) {
            // Create record but mark as too_short
            try {
                if (existingAuditId) {
                    await updateAuditRecord(supabase, existingAuditId, { status: 'too_short' });
                } else {
                    await createAuditRecord(supabase, {
                        journeyId, userId, flightNumber, source, audioUrl, durationSeconds
                    }).then(id => updateAuditRecord(supabase, id, { status: 'too_short' }));
                }
            } catch { /* non-blocking */ }

            return NextResponse.json({
                ok: true,
                skipped: true,
                reason: `Audio too short (${durationSeconds}s < ${MIN_AUDIO_DURATION_SEC}s minimum).`
            });
        }

        // ── Create or reuse audit record (status: analyzing) ──
        let auditId = existingAuditId;
        try {
            if (!auditId) {
                auditId = await createAuditRecord(supabase, {
                    journeyId, userId, flightNumber, source, audioUrl, durationSeconds
                });
            } else {
                await updateAuditRecord(supabase, auditId, { status: 'analyzing', error_message: null });
            }
        } catch (err) {
            console.error('⚠️ Failed to setup audit record:', err.message);
            // Continue anyway — we can still return results even without DB
        }

        // ── Step 1: Download audio ──
        let audioBuffer;
        try {
            audioBuffer = await downloadAudio(audioUrl);
        } catch (err) {
            if (auditId) {
                await updateAuditRecord(supabase, auditId, {
                    status: 'download_failed',
                    error_message: err.message
                });
            }
            return NextResponse.json(
                { ok: false, error: `Audio download failed: ${err.message}` },
                { status: 502 }
            );
        }

        // ── Step 2: Convert to base64 ──
        const base64Audio = audioBuffer.toString('base64');
        const mimeType = detectMimeType(audioUrl);

        const { SchemaType } = require('@google/generative-ai');

        const responseSchema = {
            type: SchemaType.OBJECT,
            properties: {
                menciona_nombre_equipo: { type: SchemaType.BOOLEAN, nullable: true },
                nombre_equipo_detectado: { type: SchemaType.STRING, nullable: true },
                menciona_destino: { type: SchemaType.BOOLEAN, nullable: true },
                destino_detectado: { type: SchemaType.STRING, nullable: true },
                dinamica_sube_sube: { type: SchemaType.BOOLEAN, nullable: true },
                energia_interaccion: { type: SchemaType.STRING, enum: ["alta", "media", "baja", "no_detectado"] },
                participacion_ninos_audible: { type: SchemaType.BOOLEAN, nullable: true },
                score: { type: SchemaType.INTEGER },
                feedback_para_isa: { type: SchemaType.STRING },
                resumen_supervisor: { type: SchemaType.STRING }
            },
            required: ["menciona_nombre_equipo", "menciona_destino", "dinamica_sube_sube", "energia_interaccion", "participacion_ninos_audible", "score", "feedback_para_isa", "resumen_supervisor"]
        };

        const genAI = new GoogleGenerativeAI(GEMINI_AUDIO_KEY);
        const model = genAI.getGenerativeModel({
            model: MODEL_ID,
            generationConfig: {
                temperature: 0.2,      // Low temperature for consistent, factual analysis
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            }
        });

        let geminiResponse;
        let rawText = '';

        // Attempt with 1 retry
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const result = await model.generateContent([
                    { text: getAuditPrompt(source) },
                    {
                        inlineData: {
                            mimeType,
                            data: base64Audio
                        }
                    }
                ]);

                rawText = result.response.text();
                geminiResponse = parseGeminiJSON(rawText);

                if (geminiResponse) break; // Success

            } catch (err) {
                console.warn(`⚠️ Gemini attempt ${attempt} failed:`, err.message);
                if (attempt === 2) {
                    // Both attempts failed
                    if (auditId) {
                        await updateAuditRecord(supabase, auditId, {
                            status: 'failed',
                            error_message: `Gemini error: ${err.message}`,
                            raw_response: { error: err.message, rawText }
                        });
                    }
                    return NextResponse.json(
                        { ok: false, error: `AI analysis failed: ${err.message}` },
                        { status: 502 }
                    );
                }
                // Wait 2s before retry
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        // ── Step 4: Parse & Validate scorecard ──
        if (!geminiResponse) {
            if (auditId) {
                await updateAuditRecord(supabase, auditId, {
                    status: 'parse_failed',
                    error_message: 'Could not parse JSON from Gemini response',
                    raw_response: { rawText }
                });
            }
            return NextResponse.json(
                { ok: false, error: 'Failed to parse AI response.' },
                { status: 502 }
            );
        }

        const scorecard = normalizeScorecard(geminiResponse);

        // ── Step 5: Persist scorecard ──
        if (auditId) {
            await updateAuditRecord(supabase, auditId, {
                status: 'completed',
                score: scorecard.score,
                menciona_nombre_equipo: scorecard.menciona_nombre_equipo,
                nombre_equipo_detectado: scorecard.nombre_equipo_detectado,
                menciona_destino: scorecard.menciona_destino,
                destino_detectado: scorecard.destino_detectado,
                dinamica_sube_sube: scorecard.dinamica_sube_sube,
                energia_interaccion: scorecard.energia_interaccion,
                participacion_ninos_audible: scorecard.participacion_ninos_audible,
                feedback_para_isa: scorecard.feedback_para_isa,
                resumen_supervisor: scorecard.resumen_supervisor,
                raw_response: geminiResponse,
                model_used: MODEL_ID,
                error_message: null
            });
        }

        // ── Step 6: Return scorecard ──
        const elapsed = Date.now() - startTime;
        console.log(`✅ Audio audit completed: score=${scorecard.score}, time=${elapsed}ms, audit=${auditId}`);

        return NextResponse.json({
            ok: true,
            auditId,
            score: scorecard.score,
            menciona_nombre_equipo: scorecard.menciona_nombre_equipo,
            nombre_equipo_detectado: scorecard.nombre_equipo_detectado,
            menciona_destino: scorecard.menciona_destino,
            destino_detectado: scorecard.destino_detectado,
            dinamica_sube_sube: scorecard.dinamica_sube_sube,
            energia_interaccion: scorecard.energia_interaccion,
            participacion_ninos_audible: scorecard.participacion_ninos_audible,
            feedback_para_isa: scorecard.feedback_para_isa,
            resumen_supervisor: scorecard.resumen_supervisor,
            elapsedMs: elapsed
        });

    } catch (error) {
        console.error('❌ Analyze-audio fatal error:', error);
        return NextResponse.json(
            { ok: false, error: error?.message || 'Internal server error.' },
            { status: 500 }
        );
    }
}
