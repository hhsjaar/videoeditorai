import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

function getApiKey(): string {
  const clean = (val?: string) => (val || "").replace(/^["']|["']$/g, "").replace(/["']/g, "").trim();
  if (process.env.GEMINI_API_KEY && clean(process.env.GEMINI_API_KEY).length > 5) return clean(process.env.GEMINI_API_KEY);
  try {
    const p1 = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(p1)) {
      const content = fs.readFileSync(p1, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("GEMINI_API_KEY=")) {
          const val = clean(trimmed.substring("GEMINI_API_KEY=".length));
          if (val.length > 5) return val;
        }
      }
    }
  } catch {}
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const { text, audioDurationSec, audioBase64, audioMime } = await req.json();

    if (!text || !audioBase64 || !audioDurationSec) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not found." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Use Gemini to perform forced alignment: given audio + transcript, return per-word timestamps
    const prompt = `You are a precise audio forced-alignment engine. 
You will receive an audio file and its transcript. 
Return ONLY a valid JSON array of word-level timestamps.

TRANSCRIPT: "${text}"
AUDIO DURATION: ${audioDurationSec} seconds

Listen carefully to the audio and estimate the start and end time (in seconds) for EACH WORD in the transcript.
The words must match the transcript exactly in order.
Group consecutive words together where they sound like they're said as one breath/phrase.

Return ONLY this JSON format (no markdown, no explanation):
[{"word":"word1","start":0.0,"end":0.8},{"word":"word2","start":0.8,"end":1.4},...] `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: audioBase64,
                mimeType: audioMime || "audio/wav",
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    let wordTimings: Array<{ word: string; start: number; end: number }> = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        wordTimings = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("Failed to parse word timings JSON:", rawText);
    }

    if (!wordTimings || wordTimings.length === 0) {
      return NextResponse.json({ wordTimings: [] });
    }

    // Clamp all timestamps to [0, audioDurationSec]
    wordTimings = wordTimings.map((w) => ({
      word: w.word,
      start: Math.max(0, Math.min(audioDurationSec, w.start)),
      end: Math.max(0, Math.min(audioDurationSec, w.end)),
    }));

    return NextResponse.json({ wordTimings });
  } catch (error: any) {
    console.error("Align words error:", error);
    return NextResponse.json({ wordTimings: [] });
  }
}
