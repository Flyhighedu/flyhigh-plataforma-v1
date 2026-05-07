import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// POST /api/staff/analyze-audio
//
// AI-Powered Audio Quality Monitoring — "El Cerebro"
// ADAPTIVE DUAL-ENGINE STRATEGY
//
// ENGINE 1 (always): Groq Whisper (free) + GPT-4o-mini
//   → Transcribes + analyzes TEXT for content criteria
//
// ENGINE 2 (conditional): gpt-4o-audio-preview
//   → Native audio analysis for tone/emotion/energy
//   → Triggered only when:
//     a) Text score < 75 (potential issue detected)
//     b) First flight of the day (baseline)
//     c) Source is 'bitacora' (docente - higher priority)
//
// COST OPTIMIZATION:
//   Engine 1: ~$0.0001/request (practically free)
//   Engine 2: ~$0.04/request (only ~25% of requests)
//   Total: ~$4 USD/month for 400 requests
//
// SAFETY: Fire-and-forget. Failures NEVER block ops.
// =====================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHAT_MODEL = 'gpt-4o-mini';
const AUDIO_MODEL = 'gpt-4o-audio-preview';
const DEEP_ANALYSIS_THRESHOLD = 75; // Score below this triggers audio analysis
const MIN_AUDIO_DURATION_SEC = 5;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

// ───────── Supabase Admin Client ─────────
function getSupabaseAdmin() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ───────── System Prompts ─────────

const DOCENTE_TEXT_PROMPT = `Eres un auditor de calidad para la empresa educativa Fly High. Analiza la transcripción del audio de esta dinámica infantil guiada por la docente en un entorno ruidoso. Devuelve un JSON con estas 5 claves:

"menciona_nombre_equipo" (boolean): ¿La docente le pone un nombre al grupo de niños (ej: "Escuadrón Águilas") y se refiere a ellos por ese nombre?

"menciona_destino" (boolean): ¿La docente menciona a dónde van a "volar" (un destino, ciudad, país o lugar)?

"dinamica_sube_sube" (boolean): ¿Se escucha que la docente dice "Sube, sube" y los niños responden "Hasta las nubes"? ¿O al menos intenta hacer esta dinámica interactiva?

"energia_positiva" (boolean): ¿La docente habla con entusiasmo, alegría y actitud positiva (sin sonar aburrida, monótona o demasiado seria)? Infiere esto del contenido textual: uso de exclamaciones, preguntas a los niños, palabras motivadoras.

"feedback" (string o null): Si alguna es falsa, da un consejo constructivo, amable y corto (máximo 2 líneas). Si todas son verdaderas, null.`;

const PILOTO_TEXT_PROMPT = `Eres un auditor de calidad de vuelo para la empresa educativa Fly High. Analiza la transcripción del audio de este piloto narrando el vuelo. Devuelve un JSON con estas 5 claves:

"menciona_punto_interes" (boolean): ¿Menciona algún dato educativo, geográfico o histórico de lo que ven durante el vuelo?

"mantiene_personaje" (boolean): ¿Habla con un tono profesional e inspirador de capitán/aviador?

"energia_positiva" (boolean): ¿El piloto transmite asombro, emoción y actitud positiva? Infiere del texto: exclamaciones, descripciones vívidas, invitaciones a los niños.

"fomenta_interaccion" (boolean): ¿El piloto intenta interactuar activamente con los niños (ej: les hace preguntas, los invita a observar algo específico)?

"feedback" (string o null): Si alguna es falsa, da un consejo constructivo y corto. Si todas son verdaderas, null.`;

const DOCENTE_AUDIO_PROMPT = `Eres un auditor de calidad para Fly High. ESCUCHA ATENTAMENTE este audio de una dinámica infantil. Evalúa el TONO DE VOZ y la ENERGÍA de la docente.

Responde SOLO un JSON:
{
  "energia_vocal": "alta" | "media" | "baja",
  "tono_entusiasta": true | false,
  "proyeccion_voz": true | false,
  "participacion_ninos_audible": true | false,
  "feedback_energia": "Consejo sobre la energía vocal (o null si es alta)"
}

IMPORTANTE: No analices el contenido de las palabras. Solo evalúa HOW she speaks: volumen, entusiasmo, variación tonal, energía. ¿Suena viva y emocionada o suena cansada y monótona?`;

const PILOTO_AUDIO_PROMPT = `Eres un auditor de calidad de vuelo para Fly High. ESCUCHA ATENTAMENTE este audio de un piloto narrando un vuelo con niños. Evalúa el TONO DE VOZ y la ENERGÍA del piloto.

Responde SOLO un JSON:
{
  "energia_vocal": "alta" | "media" | "baja",
  "tono_entusiasta": true | false,
  "proyeccion_voz": true | false,
  "participacion_ninos_audible": true | false,
  "feedback_energia": "Consejo sobre la energía vocal (o null si es alta)"
}

IMPORTANTE: Solo evalúa la voz: volumen, emoción, variación tonal. ¿Suena como un capitán emocionado o como alguien leyendo un guión?`;

// ───────── JSON Schemas for Structured Output ─────────

const TEXT_DOCENTE_SCHEMA = {
    name: 'docente_text_audit',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            menciona_nombre_equipo: { type: 'boolean' },
            menciona_destino: { type: 'boolean' },
            dinamica_sube_sube: { type: 'boolean' },
            energia_positiva: { type: 'boolean' },
            feedback: { type: ['string', 'null'] }
        },
        required: ['menciona_nombre_equipo', 'menciona_destino', 'dinamica_sube_sube', 'energia_positiva', 'feedback'],
        additionalProperties: false
    }
};

const TEXT_PILOTO_SCHEMA = {
    name: 'piloto_text_audit',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            menciona_punto_interes: { type: 'boolean' },
            mantiene_personaje: { type: 'boolean' },
            energia_positiva: { type: 'boolean' },
            fomenta_interaccion: { type: 'boolean' },
            feedback: { type: ['string', 'null'] }
        },
        required: ['menciona_punto_interes', 'mantiene_personaje', 'energia_positiva', 'fomenta_interaccion', 'feedback'],
        additionalProperties: false
    }
};

// ───────── Download audio from URL ─────────
async function downloadAudio(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_AUDIO_SIZE_BYTES) throw new Error('Audio too large');
    return Buffer.from(arrayBuffer);
}

// ───────── Calculate score from booleans (25pts each) ─────────
function calculateScore(analysis, role) {
    const criteria = role === 'piloto'
        ? [analysis.menciona_punto_interes, analysis.mantiene_personaje, analysis.energia_positiva, analysis.fomenta_interaccion]
        : [analysis.menciona_nombre_equipo, analysis.menciona_destino, analysis.dinamica_sube_sube, analysis.energia_positiva];
    return criteria.filter(v => v === true).length * 25;
}

// ───────── Generate supervisor summary ─────────
function generateResumen(analysis, role, score, deepAnalysis) {
    const label = role === 'piloto' ? 'Piloto' : 'Docente';
    const energyNote = deepAnalysis ? ` | Energía vocal: ${deepAnalysis.energia_vocal}` : '';
    if (score === 100) return `${label}: Excelente — todos los criterios cumplidos.${energyNote}`;
    if (score >= 75) return `${label}: Buen desempeño — faltó 1 criterio.${energyNote}`;
    if (score >= 50) return `${label}: Regular — 2 criterios pendientes.${energyNote}`;
    return `${label}: Necesita mejora — 3+ criterios pendientes.${energyNote}`;
}

// ───────── Map to DB columns ─────────
function mapToDbColumns(textAnalysis, role, score, transcript, deepAnalysis) {
    const energiaFromDeep = deepAnalysis?.energia_vocal || null;
    const energiaFromText = textAnalysis.energia_positiva ? 'alta' : 'baja';

    if (role === 'piloto') {
        return {
            menciona_nombre_equipo: null,
            nombre_equipo_detectado: null,
            menciona_destino: textAnalysis.menciona_punto_interes,
            destino_detectado: null,
            dinamica_sube_sube: null,
            energia_interaccion: energiaFromDeep || energiaFromText,
            participacion_ninos_audible: deepAnalysis?.participacion_ninos_audible ?? textAnalysis.fomenta_interaccion,
            score,
            feedback_para_isa: textAnalysis.feedback || deepAnalysis?.feedback_energia || null,
            resumen_supervisor: generateResumen(textAnalysis, role, score, deepAnalysis),
            raw_response: { textAnalysis, deepAnalysis, role, transcript },
            model_used: deepAnalysis ? `groq-whisper+${CHAT_MODEL}+${AUDIO_MODEL}` : `groq-whisper+${CHAT_MODEL}`
        };
    }
    return {
        menciona_nombre_equipo: textAnalysis.menciona_nombre_equipo,
        nombre_equipo_detectado: null,
        menciona_destino: textAnalysis.menciona_destino,
        destino_detectado: null,
        dinamica_sube_sube: textAnalysis.dinamica_sube_sube,
        energia_interaccion: energiaFromDeep || energiaFromText,
        participacion_ninos_audible: deepAnalysis?.participacion_ninos_audible ?? null,
        score,
        feedback_para_isa: textAnalysis.feedback || deepAnalysis?.feedback_energia || null,
        resumen_supervisor: generateResumen(textAnalysis, role, score, deepAnalysis),
        raw_response: { textAnalysis, deepAnalysis, role, transcript },
        model_used: deepAnalysis ? `groq-whisper+${CHAT_MODEL}+${AUDIO_MODEL}` : `groq-whisper+${CHAT_MODEL}`
    };
}

// ───────── Audit record helpers ─────────
async function createAuditRecord(supabase, { journeyId, userId, flightNumber, source, audioUrl, durationSeconds }) {
    const { data, error } = await supabase
        .from('audio_quality_audits')
        .insert({
            journey_id: journeyId, user_id: userId || null,
            flight_number: flightNumber || null, source: source || 'bitacora',
            audio_url: audioUrl || null, audio_duration_seconds: durationSeconds || null,
            status: 'analyzing'
        })
        .select('id').single();
    if (error) throw error;
    return data.id;
}

async function updateAuditRecord(supabase, auditId, updates) {
    const { error } = await supabase
        .from('audio_quality_audits')
        .update({ ...updates, analyzed_at: new Date().toISOString() })
        .eq('id', auditId);
    if (error) console.warn('⚠️ Failed to update audit:', error.message);
}


// ═════════════════════════════════════════════════════
// POST Handler — Adaptive Dual-Engine
// ═════════════════════════════════════════════════════
export async function POST(request) {
    const startTime = Date.now();

    try {
        // ── Validate config ──
        if (!OPENAI_KEY) {
            return NextResponse.json({ ok: false, error: 'Missing OPENAI_API_KEY.' }, { status: 500 });
        }
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return NextResponse.json({ ok: false, error: 'Missing Supabase config.' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey: OPENAI_KEY });

        // ── Parse request ──
        let audioUrl, journeyId, flightNumber, source, userId, durationSeconds, existingAuditId;
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            audioUrl = formData.get('audioUrl');
            journeyId = formData.get('journeyId');
            flightNumber = Number(formData.get('flightNumber')) || null;
            source = formData.get('source') || formData.get('rol') === 'piloto' ? 'pilot_narration' : 'bitacora';
            userId = formData.get('userId') || null;
            durationSeconds = Number(formData.get('durationSeconds')) || null;
            existingAuditId = formData.get('auditId') || null;
        } else {
            const body = await request.json();
            audioUrl = body.audioUrl;
            journeyId = body.journeyId;
            flightNumber = Number(body.flightNumber) || null;
            source = body.source || 'bitacora';
            userId = body.userId || null;
            durationSeconds = Number(body.durationSeconds) || null;
            existingAuditId = body.auditId || null;
        }

        const effectiveRole = source === 'pilot_narration' ? 'piloto' : 'docente';

        // ── Validate ──
        if (!audioUrl) return NextResponse.json({ ok: false, error: 'Missing audioUrl.' }, { status: 400 });
        if (!journeyId && !existingAuditId) return NextResponse.json({ ok: false, error: 'Missing journeyId.' }, { status: 400 });

        // ── Duration check ──
        if (durationSeconds && durationSeconds < MIN_AUDIO_DURATION_SEC) {
            try {
                if (existingAuditId) await updateAuditRecord(supabase, existingAuditId, { status: 'too_short' });
                else await createAuditRecord(supabase, { journeyId, userId, flightNumber, source, audioUrl, durationSeconds })
                    .then(id => updateAuditRecord(supabase, id, { status: 'too_short' }));
            } catch { /* non-blocking */ }
            return NextResponse.json({ ok: true, skipped: true, reason: `Audio too short (${durationSeconds}s).` });
        }

        // ── Create audit record ──
        let auditId = existingAuditId;
        try {
            if (!auditId) auditId = await createAuditRecord(supabase, { journeyId, userId, flightNumber, source, audioUrl, durationSeconds });
            else await updateAuditRecord(supabase, auditId, { status: 'analyzing', error_message: null });
        } catch (err) { console.error('⚠️ Audit record setup error:', err.message); }

        // ── Download audio ──
        let audioBuffer;
        try {
            audioBuffer = await downloadAudio(audioUrl);
        } catch (err) {
            if (auditId) await updateAuditRecord(supabase, auditId, { status: 'download_failed', error_message: err.message });
            return NextResponse.json({ ok: false, error: `Download failed: ${err.message}` }, { status: 502 });
        }

        // ══════════════════════════════════════════════
        // ENGINE 1: Groq Whisper (free) + GPT-4o-mini
        // ══════════════════════════════════════════════

        // Step 1a: Transcribe with Groq Whisper (FREE)
        let transcript;
        try {
            const whisperClient = GROQ_KEY
                ? new OpenAI({ apiKey: GROQ_KEY, baseURL: 'https://api.groq.com/openai/v1' })
                : openai; // Fallback to OpenAI Whisper if no Groq key

            const audioFilename = (audioUrl || '').toLowerCase().includes('.mp3') ? 'audio.mp3' : 'audio.webm';
            const audioMime = audioFilename.endsWith('.mp3') ? 'audio/mp3' : 'audio/webm';
            const file = new File([audioBuffer], audioFilename, { type: audioMime });

            const transcription = await whisperClient.audio.transcriptions.create({
                file, model: 'whisper-large-v3', language: 'es', response_format: 'text'
            });
            transcript = typeof transcription === 'string' ? transcription : transcription.text || '';

            if (!transcript || transcript.trim().length < 5) {
                if (auditId) await updateAuditRecord(supabase, auditId, {
                    status: 'no_speech', error_message: 'No speech detected', raw_response: { transcript: '' }
                });
                return NextResponse.json({ ok: true, skipped: true, reason: 'No speech detected.' });
            }
        } catch (err) {
            console.error('❌ Whisper failed:', err.message);
            if (auditId) await updateAuditRecord(supabase, auditId, {
                status: 'failed', error_message: `Whisper: ${err.message}`, raw_response: { error: err.message }
            });
            return NextResponse.json({ ok: false, error: `Transcription failed: ${err.message}` }, { status: 502 });
        }

        // Step 1b: Analyze text with GPT-4o-mini (cheap)
        let textAnalysis;
        try {
            const systemPrompt = effectiveRole === 'piloto' ? PILOTO_TEXT_PROMPT : DOCENTE_TEXT_PROMPT;
            const jsonSchema = effectiveRole === 'piloto' ? TEXT_PILOTO_SCHEMA : TEXT_DOCENTE_SCHEMA;

            const completion = await openai.chat.completions.create({
                model: CHAT_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Transcripción:\n\n"${transcript}"` }
                ],
                response_format: { type: 'json_schema', json_schema: jsonSchema },
                temperature: 0.2
            });
            textAnalysis = JSON.parse(completion.choices[0].message.content);
        } catch (err) {
            console.error('❌ GPT-4o-mini failed:', err.message);
            if (auditId) await updateAuditRecord(supabase, auditId, {
                status: 'failed', error_message: `GPT-4o-mini: ${err.message}`,
                raw_response: { error: err.message, transcript }
            });
            return NextResponse.json({ ok: false, error: `Text analysis failed: ${err.message}` }, { status: 502 });
        }

        const textScore = calculateScore(textAnalysis, effectiveRole);

        // ══════════════════════════════════════════════
        // ENGINE 2: gpt-4o-audio-preview (conditional)
        // Triggers 50% of the time: uno sí, uno no (impares sí, pares no)
        // ══════════════════════════════════════════════

        let deepAnalysis = null;
        const isMP3 = (audioUrl || '').toLowerCase().includes('.mp3');
        const currentFlightNum = flightNumber || 1;
        const shouldDeepAnalyze = isMP3 && (currentFlightNum % 2 !== 0);

        if (shouldDeepAnalyze) {
            try {
                const base64Audio = audioBuffer.toString('base64');
                const audioPrompt = effectiveRole === 'piloto' ? PILOTO_AUDIO_PROMPT : DOCENTE_AUDIO_PROMPT;

                const audioCompletion = await openai.chat.completions.create({
                    model: AUDIO_MODEL,
                    messages: [
                        { role: 'system', content: audioPrompt },
                        {
                            role: 'user',
                            content: [
                                { type: 'input_audio', input_audio: { data: base64Audio, format: 'mp3' } }
                            ]
                        }
                    ],
                    modalities: ['text'],
                    temperature: 0.2
                });

                const rawDeep = audioCompletion.choices?.[0]?.message?.content || '';
                // Parse JSON from response (might have markdown fences)
                const cleaned = rawDeep.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                try {
                    deepAnalysis = JSON.parse(cleaned);
                } catch {
                    const match = cleaned.match(/\{[\s\S]*\}/);
                    if (match) deepAnalysis = JSON.parse(match[0]);
                }

                console.log(`🎧 Deep audio analysis: energia_vocal=${deepAnalysis?.energia_vocal}`);

                // Override text-based energia with audio-based if available
                if (deepAnalysis?.energia_vocal) {
                    if (deepAnalysis.energia_vocal === 'baja' || !deepAnalysis.tono_entusiasta) {
                        textAnalysis.energia_positiva = false;
                    } else if (deepAnalysis.energia_vocal === 'alta' && deepAnalysis.tono_entusiasta) {
                        textAnalysis.energia_positiva = true;
                    }
                }
            } catch (err) {
                console.warn('⚠️ Deep audio analysis failed (non-blocking):', err.message);
                // Continue with text-only results — deep analysis is a bonus
            }
        }

        // ── Final score (may be adjusted by deep analysis) ──
        const finalScore = calculateScore(textAnalysis, effectiveRole);
        const dbColumns = mapToDbColumns(textAnalysis, effectiveRole, finalScore, transcript, deepAnalysis);

        // ── Persist ──
        if (auditId) {
            await updateAuditRecord(supabase, auditId, {
                status: 'completed', ...dbColumns, error_message: null
            });
        }

        // ── Return ──
        const elapsed = Date.now() - startTime;
        const engines = deepAnalysis ? 'groq-whisper→gpt4o-mini→audio-preview' : 'groq-whisper→gpt4o-mini';
        console.log(`✅ Audit [${effectiveRole}]: score=${finalScore}, engines=${engines}, time=${elapsed}ms`);

        return NextResponse.json({
            ok: true,
            auditId,
            role: effectiveRole,
            analysis: textAnalysis,
            deepAnalysis,
            transcript,
            engines,
            score: finalScore,
            menciona_nombre_equipo: dbColumns.menciona_nombre_equipo,
            nombre_equipo_detectado: dbColumns.nombre_equipo_detectado,
            menciona_destino: dbColumns.menciona_destino,
            destino_detectado: dbColumns.destino_detectado,
            dinamica_sube_sube: dbColumns.dinamica_sube_sube,
            energia_interaccion: dbColumns.energia_interaccion,
            participacion_ninos_audible: dbColumns.participacion_ninos_audible,
            feedback_para_isa: dbColumns.feedback_para_isa,
            resumen_supervisor: dbColumns.resumen_supervisor,
            elapsedMs: elapsed
        });

    } catch (error) {
        console.error('❌ Analyze-audio fatal:', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal server error.' }, { status: 500 });
    }
}
