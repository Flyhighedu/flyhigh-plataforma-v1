import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta la clave GEMINI_API_KEY en las variables de entorno (.env.local).' }, { status: 500 });
    }

    const { html, prompt } = await req.json();

    if (!html || !prompt) {
      return NextResponse.json({ error: 'HTML y prompt son requeridos.' }, { status: 400 });
    }

    const systemPrompt = `
      Eres un experto desarrollador web y diseñador. 
      El usuario te proporcionará el código HTML de un documento imprimible (como un flyer o certificado) que utiliza estilos en línea (inline styles) para mantener su fidelidad al exportarse a PDF/Imagen.
      
      Tu objetivo es modificar este código HTML según la solicitud del usuario (ej. agregar una sección, cambiar una firma, modificar la estructura) Y proporcionar una breve respuesta amigable explicando lo que hiciste.
      
      REGLAS CRÍTICAS:
      1. DEBES mantener todos los estilos en línea (inline styles) existentes. Si agregas nuevos elementos, usa estilos en línea consistentes con el diseño original.
      2. NUNCA uses clases CSS externas ni hojas de estilo, todo debe ser inline.
      3. Asegúrate de que el HTML sea válido y que todas las etiquetas estén cerradas.
      4. Responde ÚNICAMENTE con JSON válido con las llaves "html" y "message". Sin markdown, sin explicaciones extra.
      Formato exacto: {"html":"...","message":"..."}

      LOGOS DISPONIBLES:
      ¡ATENCIÓN! CUANDO EL USUARIO SOLICITE AGREGAR LOGOS, DEBES UTILIZAR EXACTAMENTE LAS SIGUIENTES ETIQUETAS HTML. ESTÁ TOTALMENTE PROHIBIDO INVENTAR RUTAS, USAR PLACEHOLDERS (EJ: src="logo.png") O NOMBRES GENÉRICOS (EJ: Aliado 1). DEBES COPIAR Y PEGAR ESTAS ETIQUETAS EXACTAS:
      
      - Para el Logo principal de Fly High:
        <img src="/flyers/1000x200.png" alt="Fly High" style="max-width:260px; height:auto; display:block; filter:brightness(0) saturate(100%) invert(14%) sepia(45%) saturate(1212%) hue-rotate(176deg) brightness(97%) contrast(93%);" />
      
      - Para los Patrocinadores (colócalos juntos en una fila):
        <img src="/flyers/Logo-Madobox.png" alt="Madobox" style="max-height:50px; width:auto;" />
        <img src="/flyers/Logo-La-Bonanza-Avocados-pdf.png" alt="La Bonanza" style="max-height:50px; width:auto;" />
        <img src="/flyers/Logo-Global-Frut-png.png" alt="Global Frut" style="max-height:50px; width:auto;" />
        <img src="/flyers/51d89e34-3d94-448c-9b34-16abb3360127.png" alt="Aztecavo" style="max-height:50px; width:auto;" />
        <img src="/flyers/logo-Strong-plastic-pdf.png" alt="Strong Plastic" style="max-height:50px; width:auto;" />
        <img src="/flyers/logo-RV-Fresh.png" alt="RV Fresh" style="max-height:50px; width:auto;" />
      
      - Para los Aliados (colócalos juntos en una fila separada):
        <img src="/flyers/logo-parque.png" alt="Parque Nacional" style="max-height:40px; width:auto;" />
        <img src="/flyers/logo-secretaria-cultura-y-turismo.png" alt="Secretaría de Cultura" style="max-height:40px; width:auto;" />
        <img src="/flyers/logo-huatapera.png" alt="Museo de la Huatapera" style="max-height:40px; width:auto;" />
        <img src="/flyers/logo-ccfdsp.png" alt="Fábrica de San Pedro" style="max-height:40px; width:auto;" />
    `;

    const userMessage = `
      Solicitud del usuario: "${prompt}"
      
      Código HTML original a modificar:
      ${html}
    `;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      }
    });

    let response;
    let lastError;
    let retries = 3;
    let delay = 2000; // 2 seconds initial delay

    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`Intentando generación con gemini-2.5-flash-lite (Intento ${i + 1}/${retries + 1})...`);
        response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
        });
        
        // Si tiene éxito, salimos del bucle
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Fallo en el intento ${i + 1}:`, err?.message || err);
        
        if (i < retries) {
          console.log(`Esperando ${delay/1000}s antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff (2s, 4s, 8s)
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Fallaron todos los reintentos.");
    }

    const resultText = response.response.text().trim();
    const resultData = JSON.parse(resultText);
    
    // Strip markdown code block wrappers if the AI included them
    let cleanHtml = resultData.html || '';
    cleanHtml = cleanHtml.replace(/^```[a-z]*\n/gi, '').replace(/\n?```$/g, '').trim();

    return NextResponse.json({ success: true, html: cleanHtml, message: resultData.message });
  } catch (error) {
    console.error('Error in AI Edit:', error);
    return NextResponse.json({ error: 'Hubo un error al procesar la solicitud con IA.' }, { status: 500 });
  }
}


