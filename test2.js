const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: 'hello',
    });
    console.log(response.text);
  } catch (e) {
    console.error("SDK ERROR:", e);
  }
}

test();
