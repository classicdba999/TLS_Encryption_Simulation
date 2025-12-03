import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const explainConcept = async (concept: string, context: string): Promise<string> => {
  if (!apiKey) {
    return "API Key is missing. Please configure your environment to use the AI assistant.";
  }

  try {
    const model = ai.models.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `You are a world-class network security engineer and teacher. 
      Explain TLS/SSL concepts clearly, concisely, and accurately. 
      Focus on TLS 1.3. Use analogies where appropriate but maintain technical accuracy.
      Format the output with Markdown.`,
    });

    const prompt = `Context: The user is currently viewing the "${context}" step of a TLS 1.3 handshake simulation.
    
    User Question: ${concept}
    
    Provide a concise explanation suitable for a web developer or student.`;

    const response = await model.generateContent({
      contents: prompt,
    });
    
    return response.text || "No explanation generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to retrieve explanation. Please try again later.";
  }
};

export const getStepDeepDive = async (stepName: string): Promise<string> => {
   if (!apiKey) return "API Key required for AI insights.";

   try {
    const model = ai.models.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    const prompt = `Explain the "${stepName}" step of the TLS 1.3 handshake in depth. 
    Explain what cryptographic primitives are typically used (e.g., ECDHE, AES-GCM).
    Keep it under 150 words.`;

    const response = await model.generateContent({
      contents: prompt,
    });

    return response.text || "No details available.";
   } catch (error) {
     return "AI Service temporarily unavailable.";
   }
}