import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// POST /api/staff/analyze-audio
//
// AI-Powered Audio Quality Monitoring — "El Cerebro"
// SINGLE ENGINE: Gemini 2.5 Flash (Native Audio)
//
// Gemini receives the raw audio file and analyzes it
// directly — no transcription step needed.
//
// ADVANTAGES over previous triple-engine stack:
//   ✅ 1 API call instead of 3
//   ✅ 100% coverage (was 50% — odd flights only)
//   ✅ Native tone/energy analysis on EVERY audio
//   ✅ Detects children participation from audio
//   ✅ ~$0.001/request (was ~$0.04)
//   ✅ Single point of failure instead of 3
//
// SAFETY: Fire-and-forget. Failures NEVER block ops.
// =====================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GEMINI_MODEL = 'gemini-2.5-flash';
const MIN_AUDIO_DURATION_SEC = 5;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

// ───────── Supabase Admin Client ─────────
function getSupabaseAdmin() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ───────── Unified Prompts (Audio-Native) ─────────
// These prompts are designed for Gemini listening to raw audio.
// They combine content + tone analysis in a single pass.

const DOCENTE_PROMPT = `Eres un auditor de calidad para la empresa educativa Fly High. ESCUCHA ATENTAMENTE este audio de una dinámica infantil guiada por la docente.

Evalúa TANTO el contenido de lo que dice COMO el tono de voz y la energía. Es un entorno ruidoso con niños — eso es normal.

Responde ÚNICAMENTE con un JSON válido con estas claves:

"menciona_nombre_equipo" (boolean): ¿La docente le pone un nombre al grupo de niños (ej: "Escuadrón Águilas", "Equipo Dragones") y se refiere a ellos por ese nombre?

"menciona_destino" (boolean): ¿La docente menciona a dónde van a "volar" (un destino, ciudad, país o lugar)?

"dinamica_sube_sube" (boolean): ¿Se escucha que la docente dice "Sube, sube" y los niños responden "Hasta las nubes"? ¿O al menos intenta hacer esta dinámica interactiva?

"energia_positiva" (boolean): ¿La docente SUENA con entusiasmo, alegría y actitud positiva? Evalúa directamente su TONO DE VOZ: ¿suena viva y emocionada o cansada y monótona?

"participacion_ninos_audible" (boolean): ¿Se escuchan voces de niños participando activamente (respondiendo, gritando, cantando)? No solo ruido de fondo.

"energia_vocal" (string): Evalúa la energía general de la voz de la docente. Responde "alta", "media" o "baja".

"feedback" (string o null): Si algún criterio es falso, da un consejo constructivo, amable y corto (máximo 2 líneas) para mejorar. Si todos son verdaderos, null.

IMPORTANTE: Escucha el audio completo antes de responder. No asumas — evalúa lo que realmente escuchas.`;

const PILOTO_PROMPT = `Eres un auditor de calidad de vuelo para la empresa educativa Fly High. ESCUCHA ATENTAMENTE este audio de un piloto narrando un vuelo con niños.

Evalúa TANTO el contenido de la narración COMO el tono de voz y la energía del piloto.

Responde ÚNICAMENTE con un JSON válido con estas claves:

"menciona_punto_interes" (boolean): ¿El piloto menciona algún dato educativo, geográfico o histórico de lo que ven durante el vuelo?

"energia_positiva" (boolean): ¿El piloto SUENA con asombro, emoción y actitud positiva? Evalúa directamente su TONO DE VOZ.

"fomenta_interaccion" (boolean): ¿El piloto intenta interactuar activamente con los niños (les hace preguntas, los invita a observar algo)?

"participacion_ninos_audible" (boolean): ¿Se escuchan voces de niños participando o respondiendo al piloto?

"energia_vocal" (string): Evalúa la energía general de la voz del piloto. Responde "alta", "media" o "baja".

"feedback" (string o null): Si algún criterio es falso, da un consejo constructivo y corto. Si todos son verdaderos, null.

IMPORTANTE: Escucha el audio completo. ¿Suena como un capitán emocionado o como alguien leyendo un guión?`;

// ───────── Download audio from URL ─────────
async function downloadAudio(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_AUDIO_SIZE_BYTES) throw new Error('Audio too large');
    return Buffer.from(arrayBuffer);
}

// ───────── Detect MIME type from URL ─────────
function getAudioMime(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('.mp3')) return 'audio/mp3';
    if (lower.includes('.wav')) return 'audio/wav';
    if (lower.includes('.ogg')) return 'audio/ogg';
    if (lower.includes('.m4a')) return 'audio/mp4';
    return 'audio/webm'; // Default for our recordings
}

// ───────── Calculate score from booleans (20pts each, 5 criteria) ─────────
function calculateScore(analysis, role) {
    if (role === 'piloto') {
        const criteria = [analysis.menciona_punto_interes, analysis.energia_positiva, analysis.fomenta_interaccion, analysis.participacion_ninos_audible];
        return criteria.filter(v => v === true).length * 25;
    } else {
        const criteria = [analysis.menciona_nombre_equipo, analysis.menciona_destino, analysis.dinamica_sube_sube, analysis.energia_positiva, analysis.participacion_ninos_audible];
        return criteria.filter(v => v === true).length * 20;
    }
}

// ───────── Generate supervisor summary ─────────
function generateResumen(analysis, role, score) {
    const label = role === 'piloto' ? 'Piloto' : 'Docente';
    const energyNote = analysis.energia_vocal ? ` | Energía vocal: ${analysis.energia_vocal}` : '';
    if (score === 100) return `${label}: Excelente — todos los criterios cumplidos.${energyNote}`;
    if (score >= 75) return `${label}: Buen desempeño — faltó 1 criterio.${energyNote}`;
    if (score >= 50) return `${label}: Regular — 2 criterios pendientes.${energyNote}`;
    return `${label}: Necesita mejora — 3+ criterios pendientes.${energyNote}`;
}

// ───────── Map to DB columns ─────────
function mapToDbColumns(analysis, role, score) {
    if (role === 'piloto') {
        return {
            menciona_nombre_equipo: null,
            nombre_equipo_detectado: null,
            menciona_destino: analysis.menciona_punto_interes,
            destino_detectado: null,
            dinamica_sube_sube: null,
            energia_positiva: analysis.energia_positiva ?? null,
            energia_interaccion: analysis.energia_vocal || (analysis.energia_positiva ? 'alta' : 'baja'),
            participacion_ninos_audible: analysis.participacion_ninos_audible ?? null,
            score,
            feedback_para_isa: analysis.feedback || null,
            resumen_supervisor: generateResumen(analysis, role, score),
            raw_response: { analysis, role },
            model_used: GEMINI_MODEL
        };
    }
    return {
        menciona_nombre_equipo: analysis.menciona_nombre_equipo,
        nombre_equipo_detectado: null,
        menciona_destino: analysis.menciona_destino,
        destino_detectado: null,
        dinamica_sube_sube: analysis.dinamica_sube_sube,
        energia_positiva: analysis.energia_positiva ?? null,
        energia_interaccion: analysis.energia_vocal || (analysis.energia_positiva ? 'alta' : 'baja'),
        participacion_ninos_audible: analysis.participacion_ninos_audible ?? null,
        score,
        feedback_para_isa: analysis.feedback || null,
        resumen_supervisor: generateResumen(analysis, role, score),
        raw_response: { analysis, role },
        model_used: GEMINI_MODEL
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

// ───────── Parse JSON from Gemini response ─────────
function parseGeminiJson(text) {
    // Clean markdown fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        // Try extracting JSON object from the response
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('Failed to parse Gemini JSON response');
    }
}


// ═════════════════════════════════════════════════════
// POST Handler — Single Engine: Gemini 2.5 Flash
// ═════════════════════════════════════════════════════
export async function POST(request) {
    const startTime = Date.now();

    try {
        // ── Validate config ──
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ ok: false, error: 'Missing GEMINI_API_KEY.' }, { status: 500 });
        }
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return NextResponse.json({ ok: false, error: 'Missing Supabase config.' }, { status: 500 });
        }

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
        // GEMINI 2.5 FLASH — Native Audio Analysis
        // Single call: content + tone + energy + participation
        // ══════════════════════════════════════════════

        let analysis;
        try {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: GEMINI_MODEL,
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: 'application/json'
                }
            });

            const audioMime = getAudioMime(audioUrl);
            const base64Audio = audioBuffer.toString('base64');
            const prompt = effectiveRole === 'piloto' ? PILOTO_PROMPT : DOCENTE_PROMPT;

            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: audioMime,
                                data: base64Audio
                            }
                        },
                        { text: prompt }
                    ]
                }]
            });

            const rawText = result.response.text();
            analysis = parseGeminiJson(rawText);

            console.log(`🎧 Gemini audio analysis: energia_vocal=${analysis.energia_vocal}, energia_positiva=${analysis.energia_positiva}`);

        } catch (err) {
            console.error('❌ Gemini analysis failed:', err.message);
            if (auditId) await updateAuditRecord(supabase, auditId, {
                status: 'failed', error_message: `Gemini: ${err.message}`,
                raw_response: { error: err.message }
            });
            return NextResponse.json({ ok: false, error: `Analysis failed: ${err.message}` }, { status: 502 });
        }

        // ── Calculate score & map to DB ──
        const finalScore = calculateScore(analysis, effectiveRole);
        const dbColumns = mapToDbColumns(analysis, effectiveRole, finalScore);

        // ── Persist ──
        if (auditId) {
            await updateAuditRecord(supabase, auditId, {
                status: 'completed', ...dbColumns, error_message: null
            });
        }

        // ── Return ──
        const elapsed = Date.now() - startTime;
        console.log(`✅ Audit [${effectiveRole}]: score=${finalScore}, engine=${GEMINI_MODEL}, time=${elapsed}ms`);

        return NextResponse.json({
            ok: true,
            auditId,
            role: effectiveRole,
            analysis,
            score: finalScore,
            engines: GEMINI_MODEL,
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
