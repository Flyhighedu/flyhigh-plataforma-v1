import { GoogleGenerativeAI } from '@google/generative-ai';

async function test() {
    console.log("🔬 Probando Gemini con Google Search...");
    
    // Obteniendo llave (toma de variable de entorno temporal)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ FALTAN CREDENCIALES: No tienes GEMINI_API_KEY.");
        console.log("Por favor ve a: https://aistudio.google.com/app/apikey");
        console.log("Crea una llave gratuita y ponla en tu archivo .env.local como:");
        console.log("GEMINI_API_KEY=AIzaSyTuLlaVexxxxxxx");
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [{ googleSearch: {} }]
    });

    const prompt = `Investiga a fondo este punto de interés en Google:
📍 Nombre: "Fábrica de San Pedro"
🏙️ Ciudad/Estado: Uruapan Michoacán
🏷️ Categoría de mapa: Fábrica / Textil Histórica

Responde con un pequeño artículo histórico de 3 párrafos basado únicamente en la información real encontrada en Google. Si no encuentras nada, di "No se encontró nada".`;

    try {
        const result = await model.generateContent(prompt);
        console.log("\n✅ RESULTADO:\n");
        console.log(result.response.text());
        
        const groundingMetadata = result.response.candidates[0].groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingChunks) {
            console.log("\n🔗 FUENTES CONSULTADAS EN GOOGLE:");
            groundingMetadata.groundingChunks.forEach(chunk => {
                if(chunk.web?.uri) {
                    console.log("- " + chunk.web.uri);
                }
            });
        }
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

test();
