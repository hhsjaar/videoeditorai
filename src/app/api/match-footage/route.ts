import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * POST /api/match-footage
 *
 * Uses Gemini to semantically match voiceover words/segments to the best footage clip.
 * Returns an optimal ordering of footage clips and suggested segment timings.
 *
 * Request body:
 *   {
 *     script: string,          // Full voiceover text
 *     wordTimings: { word, start, end }[],  // Word-level timestamps from TTS
 *     footageNames: string[],   // Filenames of uploaded footage clips
 *     audioDurationSec: number  // Total VO duration
 *   }
 *
 * Response:
 *   {
 *     orderedIndices: number[],  // Optimal ordering (indices into footageNames)
 *     clipTimings: { index: number, startSec: number, endSec: number }[],
 *     explanation: string
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script, wordTimings, footageNames, audioDurationSec } = body;

    if (!footageNames || !Array.isArray(footageNames) || footageNames.length === 0) {
      return NextResponse.json({ error: "footageNames required" }, { status: 400 });
    }

    const n = footageNames.length;
    const voText = script || "";
    const voDur = parseFloat(audioDurationSec) || 10;

    // Build a word timing summary for Gemini
    let timingSummary = "";
    if (wordTimings && Array.isArray(wordTimings) && wordTimings.length > 0) {
      // Group words into 5-word chunks for readability
      const chunks: string[] = [];
      for (let i = 0; i < wordTimings.length; i += 5) {
        const slice = wordTimings.slice(i, i + 5);
        const start = slice[0].start.toFixed(1);
        const end = slice[slice.length - 1].end.toFixed(1);
        chunks.push(`[${start}s-${end}s]: "${slice.map((w: any) => w.word).join(" ")}"`);
      }
      timingSummary = chunks.join("\n");
    }

    const prompt = `You are a professional video editor's AI assistant. Your job is to intelligently match footage clips to voiceover content.

Voiceover Script:
"${voText}"

Total VO Duration: ${voDur.toFixed(1)} seconds

Word Timing Segments:
${timingSummary || "(no word timings available)"}

Available Footage Clips (index: filename):
${footageNames.map((name: string, i: number) => `${i}: "${name}"`).join("\n")}

Task: Analyze the voiceover content and the footage filenames. Based on semantic relevance (what the words/sentences describe vs what the footage likely shows), create the optimal clip order and timing.

Rules:
1. Every clip must appear at least once
2. Clip timings must be sequential with no gaps and no overlaps
3. Total duration must equal exactly ${voDur.toFixed(1)} seconds
4. Each clip should be at minimum 1.0 second
5. If a filename suggests a specific scene (e.g. "gunung.mp4" → mountain), align it with the moment the voiceover mentions that scene
6. If filenames are generic (e.g. "VID001.mp4"), distribute clips evenly

Respond ONLY with a JSON object, no other text:
{
  "orderedIndices": [array of clip indices in display order, e.g. [2, 0, 1, 3]],
  "clipTimings": [
    { "index": <clip index>, "startSec": <float>, "endSec": <float> },
    ...
  ],
  "explanation": "Brief explanation of matching logic in Bahasa Indonesia"
}`;

    let result: any = null;
    for (const modelName of ["gemini-2.5-flash", "gemini-1.5-flash"]) {
      try {
        result = await genai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.2 },
        });
        if (result?.text) break;
      } catch (e) {
        continue;
      }
    }

    if (!result?.text) {
      // Fallback: equal distribution
      return NextResponse.json(generateEqualDistribution(n, voDur));
    }

    const rawText = result.text;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(generateEqualDistribution(n, voDur));
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(generateEqualDistribution(n, voDur));
    }

    // Validate and sanitize
    const orderedIndices: number[] = Array.isArray(parsed.orderedIndices)
      ? parsed.orderedIndices.filter((i: any) => typeof i === "number" && i >= 0 && i < n)
      : [];

    // Fill in any missing indices
    const presentSet = new Set(orderedIndices);
    for (let i = 0; i < n; i++) {
      if (!presentSet.has(i)) orderedIndices.push(i);
    }

    const clipTimings = Array.isArray(parsed.clipTimings)
      ? parsed.clipTimings.filter(
          (t: any) =>
            typeof t.index === "number" &&
            typeof t.startSec === "number" &&
            typeof t.endSec === "number" &&
            t.endSec > t.startSec
        )
      : [];

    // If timings are invalid or incomplete, regenerate them from orderedIndices
    const finalTimings =
      clipTimings.length === orderedIndices.length
        ? clipTimings
        : generateTimingsFromOrder(orderedIndices, voDur);

    return NextResponse.json({
      orderedIndices,
      clipTimings: finalTimings,
      explanation: parsed.explanation || "Klip disusun berdasarkan analisis semantik voiceover.",
    });
  } catch (err: any) {
    console.error("[match-footage] Error:", err);
    return NextResponse.json({ error: err.message || "Gagal melakukan matching footage." }, { status: 500 });
  }
}

function generateEqualDistribution(n: number, totalDur: number) {
  const perClip = parseFloat((totalDur / n).toFixed(2));
  const indices = Array.from({ length: n }, (_, i) => i);
  const timings = indices.map((idx, i) => ({
    index: idx,
    startSec: parseFloat((i * perClip).toFixed(2)),
    endSec: parseFloat(Math.min(totalDur, (i + 1) * perClip).toFixed(2)),
  }));
  // Fix last clip to exactly totalDur
  if (timings.length > 0) timings[timings.length - 1].endSec = totalDur;
  return {
    orderedIndices: indices,
    clipTimings: timings,
    explanation: "Klip dibagi rata karena tidak dapat mendeteksi konteks semantik dari nama file.",
  };
}

function generateTimingsFromOrder(orderedIndices: number[], totalDur: number) {
  const n = orderedIndices.length;
  const perClip = totalDur / n;
  return orderedIndices.map((idx, i) => ({
    index: idx,
    startSec: parseFloat((i * perClip).toFixed(2)),
    endSec: parseFloat(Math.min(totalDur, (i + 1) * perClip).toFixed(2)),
  }));
}
