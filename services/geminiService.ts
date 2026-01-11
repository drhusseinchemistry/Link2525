
import { GoogleGenAI } from "@google/genai";

export const analyzeScreen = async (imageBuffer: string, prompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBuffer.split(',')[1] } },
          { text: `Analyze this remote screen and help me with the following task: ${prompt}. Answer in Kurdish (Sorani).` }
        ]
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "ببورە، هەڵەیەک ڕوویدا لە کاتی شیکردنەوەی شاشەکە.";
  }
};
