import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const systemPrompt = `
      Eres un experto desarrollador web y diseñador. 
      El usuario te proporcionará el código HTML de un documento imprimible (como un flyer o certificado) que utiliza estilos en línea (inline styles) para mantener su fidelidad al exportarse a PDF/Imagen.
      
      Tu objetivo es modificar este código HTML según la solicitud del usuario (ej. agregar una sección, cambiar una firma, modificar la estructura) Y proporcionar una breve respuesta amigable explicando lo que hiciste.
      
      REGLAS CRÍTICAS:
      1. DEBES mantener todos los estilos en línea (inline styles) existentes. Si agregas nuevos elementos, usa estilos en línea consistentes con el diseño original.
      2. NUNCA uses clases CSS externas ni hojas de estilo, todo debe ser inline.
      3. Asegúrate de que el HTML sea válido y que todas las etiquetas estén cerradas.

      LOGOS DISPONIBLES:
      ¡ATENCIÓN! CUANDO EL USUARIO SOLICITE AGREGAR LOGOS, DEBES UTILIZAR EXACTAMENTE LAS SIGUIENTES ETIQUETAS HTML. ESTÁ TOTALMENTE PROHIBIDO INVENTAR RUTAS, USAR PLACEHOLDERS (EJ: src="logo.png") O NOMBRES GENÉRICOS (EJ: Aliado 1). DEBES COPIAR Y PEGAR ESTAS ETIQUETAS EXACTAS:
      
      - Para el Logo principal de Fly High:
        <img src="/flyers/1000x200.png" alt="Fly High" style="max-width:260px; height:auto; display:block;" />
      
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
      Solicitud del usuario: "agrega por favor el logo de Fly High"
      
      Código HTML original a modificar:
      <div style="background: white; padding: 20px;">
        <h1>Comunicado</h1>
        <p>Este es un comunicado oficial.</p>
      </div>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            html: { type: "STRING", description: "El HTML modificado" },
            message: { type: "STRING", description: "Mensaje amigable explicando los cambios realizados" }
          },
          required: ["html", "message"]
        }
      }
    });

    console.log("RESPONSE SUCCESS:", response.text);
  } catch (err) {
    console.error("ERROR CAUGHT:", err);
  }
}

test();
