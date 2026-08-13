import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Initialize Gemini client lazily
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Route: Transcribe audio using Gemini STT and translate automatically
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json({ sentences: [], fallback: true });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/mp3",
              data: audioBase64,
            },
          },
          {
            text: `Listen to this French audio recording carefully and transcribe ALL spoken words.
1. Perform Speech-to-Text (STT) transcribing EVERY spoken French word verbatim without missing any words.
2. Group the transcribed French words into natural, full continuous sentences and thoughts.
3. CRUCIAL SEGMENTATION RULE: Do NOT break a sentence after conjunctions or connecting words like 'et', 'mais', 'ou', 'donc', 'car', 'puis', 'parce que', 'alors', 'cependant', 'néanmoins', etc. Keep the connector attached to the sentence/clause it belongs to so the thought is continuous and complete!
4. Estimate accurate startTime and endTime timestamps (in seconds) for each sentence segment covering the full audio file from start to finish.
5. Provide a direct English translation for each sentence segment.
Return a JSON array of sentence objects.`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frenchText: { type: Type.STRING },
                englishTranslation: { type: Type.STRING },
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
              },
              required: ["frenchText", "englishTranslation", "startTime", "endTime"],
            },
          },
        },
      });

      const result = JSON.parse(response.text || "[]");
      return res.json({ sentences: result });
    } catch (apiErr: any) {
      console.warn("Audio STT API rate limit or error, falling back to local audio pause detection:", apiErr.message || apiErr);
      return res.status(200).json({ sentences: [], error: apiErr.message, fallback: true });
    }
  } catch (err: any) {
    console.error("Audio Transcription error:", err);
    return res.status(200).json({ sentences: [], fallback: true });
  }
});

// API Route: Translate and analyze French sentences
app.post("/api/translate", async (req, res) => {
  try {
    const { sentences } = req.body;
    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return res.status(400).json({ error: "Sentences array is required" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const translations = sentences.map((s: string) => ({
        french: s,
        english: s,
        keyVocab: [],
        grammarNotes: "Local mode active."
      }));
      return res.json({ translations });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Translate the following French sentences into natural English. For each sentence, provide the English translation, 2-3 key vocabulary words with definitions, and a short grammar tip for French learners.
Sentences:
${JSON.stringify(sentences)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                french: { type: Type.STRING },
                english: { type: Type.STRING },
                keyVocab: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      meaning: { type: Type.STRING },
                    },
                    required: ["word", "meaning"],
                  },
                },
                grammarNotes: { type: Type.STRING },
              },
              required: ["french", "english", "keyVocab", "grammarNotes"],
            },
          },
        },
      });

      const result = JSON.parse(response.text || "[]");
      return res.json({ translations: result });
    } catch (apiErr: any) {
      console.warn("Translation API rate limit or error, returning local fallback:", apiErr.message || apiErr);
      const translations = sentences.map((s: string) => ({
        french: s,
        english: s,
        keyVocab: [],
        grammarNotes: "AI rate limit reached; standard text displayed."
      }));
      return res.json({ translations });
    }
  } catch (err: any) {
    console.error("Translation API error:", err);
    const fallback = (req.body.sentences || []).map((s: string) => ({
      french: s,
      english: s,
      keyVocab: [],
      grammarNotes: ""
    }));
    return res.json({ translations: fallback });
  }
});

// API Route: Parse raw text transcript into clean French sentences
app.post("/api/parse-transcript", async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== "string") {
      return res.status(400).json({ error: "rawText string is required" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const splitLines = rawText
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((s) => s.length > 0);
      return res.json({ sentences: splitLines });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Clean up and split this French audio transcript into distinct, complete sentences ready for audio phrase alignment.
Transcript:
${rawText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      });

      const result = JSON.parse(response.text || "[]");
      return res.json({ sentences: result });
    } catch (apiErr: any) {
      console.warn("Parse transcript API rate limit or error, using local sentence splitter fallback:", apiErr.message || apiErr);
      const localSplit = rawText
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((s) => s.length > 0);
      return res.json({ sentences: localSplit });
    }
  } catch (err: any) {
    console.error("Parse transcript error:", err);
    const rawText = req.body.rawText || "";
    const localSplit = rawText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s: string) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s: string) => s.length > 0);
    return res.json({ sentences: localSplit });
  }
});

// API Route: Align a French transcript with audio recording for exact sentence timestamps
app.post("/api/align-transcript", async (req, res) => {
  try {
    const { audioBase64, mimeType, sentences, rawTranscript } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ alignedSentences: [], fallback: true });
    }

    const transcriptPrompt = sentences && Array.isArray(sentences) && sentences.length > 0
      ? sentences.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")
      : rawTranscript || "";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/wav",
              data: audioBase64,
            },
          },
          {
            text: `You are an expert audio alignment system for language learning. Listen to this audio recording carefully.
Here is the French transcript text provided by the user:
---
${transcriptPrompt}
---
CRITICAL INSTRUCTION: The transcript above may correspond to the ENTIRE audio recording OR ONLY A PORTION of the audio (for example, only the first few sentences or a specific section).
1. Match each sentence from the transcript to the EXACT startTime and endTime (in seconds) in the audio where that exact sentence is spoken.
2. DO NOT stretch or force the sentences to span the full audio duration if the transcript only covers part of the audio.
3. Provide a clean, natural English translation for each matched sentence.
4. Return a JSON array of objects with frenchText, englishTranslation, startTime, endTime.`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frenchText: { type: Type.STRING },
                englishTranslation: { type: Type.STRING },
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
              },
              required: ["frenchText", "englishTranslation", "startTime", "endTime"],
            },
          },
        },
      });

      const result = JSON.parse(response.text || "[]");
      return res.json({ alignedSentences: result });
    } catch (apiErr: any) {
      console.warn("Audio alignment API rate limit or error, falling back to local pause alignment:", apiErr.message || apiErr);
      return res.json({ alignedSentences: [], fallback: true });
    }
  } catch (err: any) {
    console.error("Audio Transcript Alignment error:", err);
    return res.json({ alignedSentences: [], fallback: true });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`French Audio Learner Server running on http://localhost:${PORT}`);
  });
}

startServer();
