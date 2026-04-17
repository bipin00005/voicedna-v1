import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import crypto from "crypto";
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies
  app.use(express.json());

  // AI Service Initialization - Using the new non-reserved key name
  const getApiKey = () => (process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || "").trim();
  
  const checkKey = (key: string) => {
    return key && key !== "MY_GEMINI_API_KEY" && key !== "";
  };

  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // API routes
  app.get("/api/health", (req, res) => {
    const key = getApiKey();
    const isValid = checkKey(key);
    res.json({ 
      status: "ok", 
      config: {
        hasApiKey: isValid,
        hasResendKey: !!process.env.RESEND_API_KEY,
        env: process.env.NODE_ENV || 'development'
      }
    });
  });

  app.post("/api/support", async (req, res) => {
    try {
      const { type, subject, message, email } = req.body;
      // Resend Sandbox Restriction: You can only send to the email you signed up with
      // unless you verify a custom domain.
      const targetEmail = 'myauthgrp@gmail.com';

      const emailContent = `
        New ${type} received from VoiceDNA App:
        
        Type: ${type}
        From: ${email || 'Anonymous'}
        Subject: ${subject}
        
        Message:
        ${message}
      `;

      if (resend) {
        console.log(`Attempting to send ${type} email to ${targetEmail} via Resend...`);
        const { data, error } = await resend.emails.send({
          from: 'VoiceDNA <onboarding@resend.dev>',
          to: targetEmail,
          subject: `[VoiceDNA ${type}] ${subject}`,
          text: emailContent,
        });
        
        if (error) {
          console.error("Resend delivery error:", error);
          throw new Error(error.message);
        }
        
        console.log(`Support email sent successfully via Resend. ID: ${data?.id}`);
      } else {
        console.warn('RESEND_API_KEY is not configured. Logging support message to console instead:');
        console.log('--- SUPPORT MESSAGE START ---');
        console.log(emailContent);
        console.log('--- SUPPORT MESSAGE END ---');
      }

      res.json({ success: true, message: "Your message has been received. Thank you!" });
    } catch (error) {
      console.error("Support API Error:", error);
      res.status(500).json({ error: "Failed to send message. Please try again later." });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const currentKey = getApiKey();
      if (!checkKey(currentKey)) {
        return res.status(500).json({ error: "Gemini API Key is not configured correctly on the server." });
      }
      const { texts } = req.body;
      const combinedText = texts.join("\n\n---\n\n");
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Perform a deep forensic analysis of the following writing samples to create a unique "Voice DNA" profile. 

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
        "${combinedText}"` }] }],
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

      res.json({
        ...JSON.parse(response.text),
        id: crypto.randomUUID(),
        name: "My Voice DNA",
        createdAt: Date.now()
      });
    } catch (error) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: "Failed to analyze style" });
    }
  });

  app.post("/api/humanize", async (req, res) => {
    try {
      const currentKey = getApiKey();
      if (!checkKey(currentKey)) {
        return res.status(500).json({ error: "Gemini API Key is not configured correctly on the server." });
      }
      const { text, profile } = req.body;
      const prompt = `REWRITE the following text using the provided Style Profile. 

      USER STYLE PROFILE:
      - Sentence Structure: ${profile.sentenceStructure}
      - Vocabulary Level: ${profile.vocabularyLevel}
      - Tone: ${profile.tone}
      - Signature Transition Words: ${profile.transitionWords.join(", ")}
      - Unique Phrasing/Quirks: ${profile.quirks.join(", ")}
      - Burstiness Score: ${profile.burstiness}
      - Perplexity Score: ${profile.perplexity}

      INSTRUCTIONS:
      1. REWRITE the text to match the User Profile. STRICTLY NO AI FORMATTING (bolding, lists, etc).
      2. Use simple, natural punctuation. NO ELLIPSES (...).
      3. Output ONLY the rewritten text without quotes.

      TEXT TO REWRITE:
      "${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are a world-class ghostwriter mimicking human writing perfectly to bypass AI detectors. No markdown, no perfect balance, just organic rhythm.",
          temperature: 1.0,
        }
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error("Humanizing Error:", error);
      res.status(500).json({ error: "Failed to humanize text" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const currentKey = getApiKey();
      if (!checkKey(currentKey)) {
        return res.status(500).json({ error: "Gemini API Key is not configured correctly on the server." });
      }
      const { messages, profile, useThinking, useLowLatency } = req.body;

      // Select model based on user request
      let modelName = "gemini-3-flash-preview";
      if (useThinking) modelName = "gemini-3.1-pro-preview";
      else if (useLowLatency) modelName = "gemini-3.1-flash-lite-preview";

      const systemInstruction = `You are the official VoiceDNA App Assistant. Your ONLY purpose is to help users navigate the app, explain features, and address concerns about privacy or usage. 
      
      APP FEATURES:
      1. Calibration: Users upload their own writing samples (text, md, docx) to build a "Voice DNA" style profile.
      2. Humanizer: Transforms robotic AI text into the user's calibrated writing style.
      3. Voice DNA Profile: Analyzes metrics like tone, burstiness (sentence variation), and perplexity.
      4. History: Keeps a local record of previous humanizations.
      5. Support & Feedback: A form to email the team (contacts myauthgrp@gmail.com).

      PRIVACY INFO:
      Style profiles and history are stored locally in the browser's localStorage. We use Gemini to process text, but we do not permanently store user data on our servers.

      RULES:
      1. ONLY answer questions related to VoiceDNA. 
      2. If asked about random things, general knowledge, or external tasks, politely state: "I am here specifically to help you with the VoiceDNA app. How can I assist you with your writing profile today?"
      3. Be helpful, concise, and professional.
      4. If the user has a style profile: ${JSON.stringify(profile)}, you can refer to its tone (e.g., "${profile.tone}") to show you understand their setup.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: messages,
        config: {
          systemInstruction,
          temperature: 0.9,
          // Support high thinking level if requested
          ...(useThinking && { 
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
          })
        }
      });

      res.json({ result: response.text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });

  app.post("/api/scan", async (req, res) => {
    try {
      const currentKey = getApiKey();
      if (!checkKey(currentKey)) {
        return res.status(500).json({ error: "Gemini API Key is not configured correctly on the server." });
      }
      const { text } = req.body;
      
      const prompt = `You are a professional AI Detection Engine. Analyze the following text and provide an AI detection score.
      
      Output ONLY a JSON object with this structure:
      {
        "score": number (0-100, where 100 is definitely AI),
        "confidence": number (0-100),
        "analysis": "one sentence explanation of technical artifacts found",
        "breakdown": {
          "perplexity": number,
          "burstiness": number,
          "patternMatch": number
        }
      }

      TEXT TO ANALYZE:
      "${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1, // High precision
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Scan Error:", error);
      res.status(500).json({ error: "Failed to scan text" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);
