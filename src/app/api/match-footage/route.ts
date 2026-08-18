import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * POST /api/match-footage
 *
 * Uses Gemini Vision to analyze footage thumbnails and match them to voiceover content.
 * Falls back to filename analysis if no thumbnails are provided.
 *
 * Request body:
 *   {
 *     script: string,
 *     wordTimings: { word, start, end }[],
 *     footageNames: string[],
 *     audioDurationSec: number,
 *     thumbnails?: string[]  // base64 JPEG/PNG thumbnails per clip (optional)
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script, wordTimings, footageNames, audioDurationSec, thumbnails } = body;

    if (!footageNames || !Array.isArray(footageNames) || footageNames.length === 0) {
      return NextResponse.json({ error: "footageNames required" }, { status: 400 });
    }

    const n = footageNames.length;
    const voText = script || "";
    const voDur = parseFloat(audioDurationSec) || 10;

    // Step 1: Describe each clip's visual content using Gemini Vision (if thumbnails provided)
    const clipDescriptions: string[] = [];
    const hasThumbnails = thumbnails && Array.isArray(thumbnails) && thumbnails.length === n;

    if (hasThumbnails) {
      console.log(`[match-footage] Analyzing ${n} thumbnails with Gemini Vision...`);
      for (let i = 0; i < n; i++) {
        const thumb = thumbnails[i];
        if (!thumb) {
          clipDescriptions.push(`Klip ${i + 1}: "${footageNames[i]}" (tidak ada thumbnail)`);
          continue;
        }
        try {
          // Strip data URL prefix if present
          const base64Data = thumb.includes(",") ? thumb.split(",")[1] : thumb;
          const mimeMatch = thumb.match(/data:([^;]+);base64/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

          const visionResult = await genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  {
                    text: `Deskripsikan secara singkat (1-2 kalimat) konten visual dari gambar/frame video ini. Fokus pada: subjek utama, latar, suasana, dan kata kunci yang relevan untuk video promosi. Jawab dalam Bahasa Indonesia.`,
                  },
                ],
              },
            ],
            config: { temperature: 0.1 },
          });

          const desc = visionResult?.text?.trim() || `Klip ${i + 1}`;
          clipDescriptions.push(`Klip ${i + 1} (${footageNames[i]}): ${desc}`);
          console.log(`[match-footage] Clip ${i + 1} vision: ${desc.substring(0, 80)}`);
        } catch (vErr: any) {
          console.warn(`[match-footage] Vision failed for clip ${i}:`, vErr.message);
          clipDescriptions.push(`Klip ${i + 1}: "${footageNames[i]}" (gagal analisis visual)`);
        }
      }
    } else {
      // Fallback: use filenames only
      footageNames.forEach((name: string, i: number) => {
        clipDescriptions.push(`Klip ${i + 1}: "${name}"`);
      });
    }

    // Step 2: Build word timing summary
    let timingSummary = "";
    if (wordTimings && Array.isArray(wordTimings) && wordTimings.length > 0) {
      const chunks: string[] = [];
      for (let i = 0; i < wordTimings.length; i += 5) {
        const slice = wordTimings.slice(i, i + 5);
        const start = slice[0].start.toFixed(1);
        const end = slice[slice.length - 1].end.toFixed(1);
        chunks.push(`[${start}s-${end}s]: "${slice.map((w: any) => w.word).join(" ")}"`);
      }
      timingSummary = chunks.join("\n");
    }

    // Step 3: Semantic matching with Gemini
    const prompt = `Kamu adalah editor video profesional. Tugasmu: mengurutkan klip footage agar paling relevan dengan narasi voiceover.

Narasi Voiceover:
"${voText}"

Total Durasi VO: ${voDur.toFixed(1)} detik

Segmen Waktu Narasi:
${timingSummary || "(tidak ada word timing)"}

Deskripsi Visual Setiap Klip:
${clipDescriptions.join("\n")}

Aturan:
1. Setiap klip harus muncul tepat 1 kali
2. Durasi setiap segmen harus positif, minimum 1.0 detik
3. Total durasi harus persis ${voDur.toFixed(1)} detik
4. Urutan harus logis secara naratif (konten klip sesuai dengan kata-kata narasi yang sedang diucapkan)
5. Klip yang memuat "Cover Akhiran" atau "ending" harus tetap di urutan TERAKHIR

Respons HANYA JSON (tanpa teks lain):
{
  "orderedIndices": [<array indeks 0-based, contoh: [2, 0, 1]>],
  "clipTimings": [
    { "index": <indeks klip>, "startSec": <float>, "endSec": <float> }
  ],
  "explanation": "Penjelasan singkat alasan pengurutannya dalam Bahasa Indonesia"
}`;

    let result: any = null;
    for (const modelName of ["gemini-2.5-flash", "gemini-1.5-flash"]) {
      try {
        result = await genai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.1 },
        });
        if (result?.text) break;
      } catch (e) {
        continue;
      }
    }

    if (!result?.text) {
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

    // Validate ordered indices
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

    const finalTimings =
      clipTimings.length === orderedIndices.length
        ? clipTimings
        : generateTimingsFromOrder(orderedIndices, voDur);

    return NextResponse.json({
      orderedIndices,
      clipTimings: finalTimings,
      explanation: parsed.explanation || "Klip disusun berdasarkan analisis visual dan narasi.",
      usedVision: hasThumbnails,
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
  if (timings.length > 0) timings[timings.length - 1].endSec = totalDur;
  return {
    orderedIndices: indices,
    clipTimings: timings,
    explanation: "Klip dibagi rata karena tidak ada thumbnail untuk analisis visual.",
    usedVision: false,
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
