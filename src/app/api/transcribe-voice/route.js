import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Instanciar Google GenAI SDK con la API key de entorno
const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request) {
    try {
        // 1. Validar la sesión del usuario en Supabase para seguridad
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor.' }, { status: 500 });
        }

        // 2. Extraer el archivo de audio del formulario
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        const mimeType = formData.get('mimeType') || 'audio/webm';

        if (!audioFile) {
            return NextResponse.json({ error: 'No se recibió ningún archivo de audio.' }, { status: 400 });
        }

        // Convertir el archivo a Buffer
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        // 3. Configurar e invocar la API de Gemini
        // Inicializar SDK de Google GenAI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const systemInstruction = 
            "Eres un transcriptor de voz en tiempo real de alta fidelidad. Tu única función es transcribir textualmente todo el audio en español que recibas. No saludes, no respondas a las preguntas, no agregues explicaciones, no corrijas el sentido. Solo escribe lo que escuchas palabra por palabra. Si no hay voz inteligible o hay silencio completo en el audio, responde únicamente con una cadena vacía (nada).";

        const result = await model.generateContent([
            {
                inlineData: {
                    data: audioBuffer.toString('base64'),
                    mimeType: mimeType
                }
            },
            systemInstruction
        ]);

        const responseText = result.response.text() || '';
        const transcript = responseText.trim();

        console.log('[TranscribeAPI] Audio procesado. Transcripción:', transcript);

        return NextResponse.json({ transcript });
    } catch (error) {
        console.error('Error en /api/transcribe-voice:', error);
        return NextResponse.json({ error: 'Error interno de transcripción en la nube' }, { status: 500 });
    }
}
