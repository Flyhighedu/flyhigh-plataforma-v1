import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Convertir raw PCM (16-bit, 24kHz, mono) a WAV agregando header de 44 bytes
function buildWavBuffer(pcmBuffer) {
    const header = Buffer.alloc(44);
    const dataSize = pcmBuffer.length;

    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
    header.writeUInt16LE(1, 22); // NumChannels (Mono)
    header.writeUInt32LE(24000, 24); // SampleRate
    header.writeUInt32LE(24000 * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    header.writeUInt16LE(2, 32); // BlockAlign (NumChannels * BitsPerSample/8)
    header.writeUInt16LE(16, 34); // BitsPerSample

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { poiId, narrativeScript } = body;

        if (!poiId || !narrativeScript) {
            return NextResponse.json({ error: 'poiId y narrativeScript son requeridos' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

        // endpoint estricto: gemini-3.1-flash-tts-preview
        const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`;

        const ttsResponse = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: `INSTRUCCIÓN DE ACTUACIÓN: Eres una locutora amable y cálida. Lee el siguiente guion como si le narraras a niños y adolescentes: de forma ágil, dinámica, con calidez y a un ritmo ligeramente rápido y con pausas justas, pero totalmente fluido y entendible, manteniendo un tono amigable e ideal para un documental educativo.\n\nGUION:\n${narrativeScript}` }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Despina"
                            }
                        }
                    }
                }
            })
        });

        if (!ttsResponse.ok) {
            const errBody = await ttsResponse.text();
            throw new Error(`Gemini TTS API error: ${errBody}`);
        }

        const ttsData = await ttsResponse.json();
        const base64Audio = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) throw new Error('No se recibió audio del API de Gemini TTS');

        const pcmBuffer = Buffer.from(base64Audio, 'base64');
        const wavBuffer = buildWavBuffer(pcmBuffer);

        // Calcular duración REAL del audio desde el tamaño del PCM
        // PCM 16-bit mono @ 24kHz = 48000 bytes por segundo
        const realDurationSeconds = Math.round(pcmBuffer.length / 48000);

        // Subir a Supabase Storage (Service Role)
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const timestamp = Date.now();
        const filePath = `narratives/${poiId}/audio_${timestamp}.wav`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('poi-narratives')
            .upload(filePath, wavBuffer, {
                contentType: 'audio/wav',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from('poi-narratives')
            .getPublicUrl(filePath);

        return NextResponse.json({
            success: true,
            audio_url: publicUrlData.publicUrl,
            audio_duration_seconds: realDurationSeconds
        });

    } catch (error) {
        console.error('Error en poi-generate-audio:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
