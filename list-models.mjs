import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        if (data.models) {
            data.models.forEach(m => {
                if(m.name.includes('flash') || m.name.includes('pro')) {
                    console.log(m.name);
                }
            });
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
listModels();
