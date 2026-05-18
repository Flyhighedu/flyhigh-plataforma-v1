import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        
        if (!audioFile) {
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

        const groqFormData = new FormData();
        groqFormData.append('file', audioFile, 'audio.webm');
        groqFormData.append('model', 'whisper-large-v3-turbo');
        groqFormData.append('language', 'es');
        groqFormData.append('response_format', 'json');
        groqFormData.append('temperature', '0.0');

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: groqFormData
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq API Error: ${errText}`);
        }

        const data = await res.json();
        return NextResponse.json({ text: data.text });
    } catch (err) {
        console.error('Transcription error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
