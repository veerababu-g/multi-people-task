
import { GoogleGenAI, Type } from "@google/genai";
import { TaskCategory, AISuggestion } from "./types";

// Always use new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})
export const getTaskSuggestions = async (
  userName: string,
  existingTopics: string[]
): Promise<AISuggestion[]> => {
  try {
    const apiKey = "AIzaSyC3oE0ckY0kSqxDfvyNSvUtvGmbH2Kd_88";
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing. Please ensure it is set in the environment.");
      return [];
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest 3 learning tasks for ${userName}. Current focused topics: ${existingTopics.join(', ')}. 
      Ensure tasks fit into a 6-hour daily schedule.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              topic: { type: Type.STRING },
              duration: { type: Type.NUMBER, description: 'Duration in minutes' },
              category: { 
                type: Type.STRING, 
                enum: [TaskCategory.NEW_LEARNING, TaskCategory.REVISION] 
              },
              reason: { type: Type.STRING }
            },
            required: ['title', 'topic', 'duration', 'category', 'reason']
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as AISuggestion[];
  } catch (error) {
    console.error("Error fetching AI suggestions:", error);
    return [];
  }
};
