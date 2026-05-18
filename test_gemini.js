const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cargar la API key desde .env.local
require('dotenv').config({ path: './.env.local' });

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY found");
        return;
    }

    const name = "Paseo Lázaro Cárdenas";
    const lat = "19.39881";
    const lon = "-102.05626";
    const context = "";

    const systemPrompt = `REGLAS ABSOLUTAS (CERO ALUCINACIÓN):
1. Foco Estricto: Se te pregunta por un lugar ESPECÍFICO ("${name}"). NUNCA respondas con la historia general de la ciudad o municipio ("${context}") si no tienes datos del lugar en sí.
2. Si no tienes información real sobre este punto ESPECÍFICO, di exactamente: "No se encontró información verificada para esta instalación/punto específico."
3. NUNCA INVENTES DATOS. Si no estás 100% seguro de un dato numérico, omítelo.
4. ESTRATEGIA DE BÚSQUEDA AVANZADA: Si recibes Coordenadas GPS, úsalas INMEDIATAMENTE para triangular la ciudad, estado y colonia exacta. Si el lugar es una calle, avenida, parque o monumento local, NO te rindas rápido; busca su "historia urbana", a quién o qué debe su nombre, año de construcción y su relevancia local en la ciudad que detectaste.`;

    let userMsg = `Investiga este lugar específico:\n`;
    userMsg += `Nombre: "${name}"\n`;
    userMsg += `Ciudad/Estado/Zona (Referencia): ${context || 'México'}\n`;
    if (lat && lon) userMsg += `Coordenadas GPS (Úsalas como primer paso para geolocalizar la ciudad y estado exactos antes de buscar la historia): ${lat}, ${lon}\n`;
    userMsg += `\nGenera la investigación PROFUNDA Y EXTENSA asegurándote de incluir TODO el contexto histórico posible (incluyendo a quién debe su nombre si es una avenida/calle) y, al final, la lista de Datos Técnicos y Métricas solicitada.`;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            tools: [{ googleSearch: {} }]
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userMsg }] }],
            systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
        });

        console.log("RESPONSE FROM GEMINI:");
        console.log(result.response.text());
        
        // Also check if search grounding metadata is there
        if (result.response.candidates && result.response.candidates[0].groundingMetadata) {
            console.log("\nGrounding Metadata:", JSON.stringify(result.response.candidates[0].groundingMetadata, null, 2));
        }

    } catch (err) {
        console.error("ERROR:");
        console.error(err);
    }
}

testGemini();
