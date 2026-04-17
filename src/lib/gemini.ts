import { GoogleGenAI, Type } from "@google/genai";
import { StyleProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeStyle(texts: string[]): Promise<StyleProfile> {
  const combinedText = texts.join("\n\n---\n\n");
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Using a stable model for analysis
    contents: [
      {
        role: "user",
        parts: [{
          text: `Perform a deep forensic analysis of the following writing samples to create a unique "Voice DNA" profile. 

          ANALYZE THE FOLLOWING DIMENSIONS:
          1. Sentence Structure: Do they use fragments? Run-ons? Do they start sentences with "And", "But", or "So"?
          2. Vocabulary Level: Is it academic, colloquial, or "internet-speak"? Any slang or specific informalisms?
          3. Tone/Mood: Is it cynical, optimistic, authoritative, or gentle?
          4. Transition Words: How do they move between ideas? (e.g., "But here's the thing," "Anyway," "So,")
          5. Punctuation Style: How do they use commas and periods? Do they use exclamation points? Do they avoid formal symbols like em-dashes?
          6. Burstiness: Scale 0-1. (0 = robotic rhythm, 1 = unpredictable human rhythm).
          7. Perplexity: Scale 0-1. (0 = generic/cliché, 1 = original/personable).

          Output the result as a structured JSON object:
          {
            "sentenceStructure": "Detailed description of syntax patterns",
            "vocabularyLevel": "Description of word choice habits",
            "tone": "Primary and secondary emotional tones",
            "transitionWords": ["word1", "word2", ...],
            "quirks": ["quirk1", "quirk2", ...],
            "burstiness": number,
            "perplexity": number
          }

          SAMPLES TO ANALYZE:
          "${combinedText}"`
        }]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentenceStructure: { type: Type.STRING },
          vocabularyLevel: { type: Type.STRING },
          tone: { type: Type.STRING },
          transitionWords: { type: Type.ARRAY, items: { type: Type.STRING } },
          quirks: { type: Type.ARRAY, items: { type: Type.STRING } },
          burstiness: { type: Type.NUMBER },
          perplexity: { type: Type.NUMBER }
        },
        required: ["sentenceStructure", "vocabularyLevel", "tone", "transitionWords", "quirks", "burstiness", "perplexity"]
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response text returned from Gemini API");
  }
  
  // Strip markdown code blocks if present
  const cleanJson = text.replace(/```json\n?|\n?```/g, "").trim();
  const result = JSON.parse(cleanJson);
  
  return {
    ...result,
    id: crypto.randomUUID(),
    name: "My Voice DNA",
    createdAt: Date.now()
  };
}

export async function humanizeText(text: string, profile: StyleProfile): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{
          text: `REWRITE the following text using the provided Style Profile. 

          USER STYLE PROFILE:
          - Sentence Structure: ${profile.sentenceStructure}
          - Vocabulary Level: ${profile.vocabularyLevel}
          - Tone: ${profile.tone}
          - Signature Transition Words: ${profile.transitionWords.join(", ")}
          - Unique Phrasing/Quirks: ${profile.quirks.join(", ")}
          - Burstiness Score: ${profile.burstiness} (0=uniform, 1=highly varied sentence lengths)
          - Perplexity Score: ${profile.perplexity} (0=predictable, 1=creative/uncommon word choices)

          INSTRUCTIONS:
          1. REWRITE the text to match the User Profile. Do not just edit—reconstruct it.
          2. STRICTLY NO AI FORMATTING: 
             - Never use markdown bolding (**text**) or italics (*text*).
             - Never use bullet points (-, *, •) or numbered lists.
             - Avoid symbols like em-dashes (—) or dashes (-) unless they are essential for a specific word.
             - Do not use excessive quotation marks ("").
          3. HUMAN PUNCTUATION: Use simple, natural punctuation. 
             - NO ELLIPSES: Do not use ellipses (...) or any sequence of two or more dots (..). 
             - Use informal comma usage or simple periods instead.
          4. EMBRACE IMPERFECTION: To bypass AI detectors, include 1-2 very minor "human" imperfections, such as a slightly informal contraction choice or a sentence starting with "And" or "But".
          5. VARIATION: Ensure extreme variation in sentence length (Burstiness). AI is too rhythmic; humans are erratic.
          6. NO QUOTES: Do not wrap the final output in quotation marks. Output ONLY the rewritten text.

          TEXT TO REWRITE:
          "${text}"`
        }]
      }
    ],
    config: {
      systemInstruction: "You are a world-class ghostwriter. Your goal is to bypass AI detectors by mimicking human writing perfectly. This means avoiding all standard AI patterns: no markdown bolding, no bulleted lists, no perfectly balanced sentences, and no 'assistant-like' clarity. You prioritize raw, organic rhythm, personal voice, and subtle human-like 'looseness' in grammar and punctuation.",
      temperature: 1.0,
    }
  });

  if (!response.text) {
    throw new Error("No response text returned from Gemini API for humanization");
  }
  return response.text;
}
