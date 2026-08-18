import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * POST /api/match-footage
 *
 * Uses Gemini Vision (multi-frame) to analyze footage clips and match them to voiceover.
 *
 * Request body:
 *   {
 *     script: string,
 *     wordTimings: { word, start, end }[],
 *     footageNames: string[],
 *     audioDurationSec: number,
 *     frameArrays?: string[][]   // base64 JPEG frames per clip (3 frames for video, 1 for image)
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { script, wordTimings, footageNames, audioDurationSec, frameArrays } = body;

    if (!footageNames || !Array.isArray(footageNames) || footageNames.length === 0) {
      return NextResponse.json({ error: "footageNames required" }, { status: 400 });
    }

    const n = footageNames.length;
    const voText = script || "";
    const voDur = parseFloat(audioDurationSec) || 10;

    // Step 1: Describe each clip visually using Gemini Vision (multi-frame)
    const clipDescriptions: string[] = [];
    const hasFrames = frameArrays && Array.isArray(frameArrays) && frameArrays.length === n;

    if (hasFrames) {
      console.log(`[match-footage] Analyzing ${n} clips with Gemini Vision (multi-frame)...`);

      for (let i = 0; i < n; i++) {
        const frames: string[] = frameArrays[i] || [];
        if (frames.length === 0) {
          clipDescriptions.push(`Klip ${i + 1}: "${footageNames[i]}" (tidak ada frame)`);
          continue;
        }

        try {
          // Build multi-image parts (up to 3 frames per clip)
          const imageParts = frames.slice(0, 3).map((frame: string) => {
            const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;
            const mimeMatch = frame.match(/data:([^;]+);base64/);
            const mimeType = (mimeMatch ? mimeMatch[1] : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
            return { inlineData: { mimeType, data: base64Data } };
          });

          const visionResult = await genai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  ...imageParts,
                  {
                    text: frames.length > 1
                      ? `Ini adalah ${frames.length} frame dari 1 klip video (diambil dari waktu berbeda). Deskripsikan konten visual klip ini dalam 2-3 kalimat. Sebutkan: objek utama, latar tempat/suasana, aksi/gerakan, dan kata kunci semantik yang berguna untuk mencocokkan dengan narasi video promosi. Jawab dalam Bahasa Indonesia, padat dan informatif.`
                      : `Deskripsikan konten visual gambar ini dalam 2-3 kalimat. Sebutkan: objek utama, latar, suasana, dan kata kunci untuk video promosi. Jawab dalam Bahasa Indonesia.`,
                  },
                ],
              },
            ],
            config: { temperature: 0.1 },
          });

          const desc = visionResult?.text?.trim() || `Klip ${i + 1}`;
          clipDescriptions.push(`Klip ${i + 1} (${footageNames[i]}): ${desc}`);
          console.log(`[match-footage] Clip ${i + 1}: ${desc.substring(0, 100)}`);
        } catch (vErr: any) {
          console.warn(`[match-footage] Vision failed clip ${i}:`, vErr.message?.slice(0, 100));
          clipDescriptions.push(`Klip ${i + 1}: "${footageNames[i]}" (analisis visual gagal)`);
        }
      }
    } else {
      // Fallback: use filenames only
      footageNames.forEach((name: string, i: number) => {
        clipDescriptions.push(`Klip ${i + 1}: "${name}"`);
      });
      console.log(`[match-footage] No frames provided, using filename-only analysis`);
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

    // Step 3: Semantic matching
    const prompt = `Kamu adalah editor video profesional berpengalaman. Tugasmu: mengurutkan klip footage agar relevan secara naratif dengan voiceover.

Narasi Voiceover:
"${voText}"

Total Durasi: ${voDur.toFixed(1)} detik

Segmen Waktu Narasi:
${timingSummary || "(tidak ada word timing — bagi merata)"}

Deskripsi Visual Setiap Klip${hasFrames ? " (hasil analisis Gemini Vision)" : " (berdasarkan nama file)"}:
${clipDescriptions.join("\n")}

ATURAN WAJIB:
1. Setiap klip muncul TEPAT 1 kali
2. Durasi setiap segmen >= 1.0 detik
3. Total durasi harus PERSIS ${voDur.toFixed(1)} detik (jumlah semua endSec - startSec = ${voDur.toFixed(1)})
4. Klip "Cover Akhiran" / "ending" HARUS di urutan TERAKHIR
5. Cocokkan visual klip dengan momen narasi (kata yang relevan dengan gambar)

Respons HANYA JSON valid (tidak ada teks lain, tidak ada markdown):
{
  "orderedIndices": [array indeks 0-based contoh [2,0,1,3]],
  "clipTimings": [
    { "index": 0, "startSec": 0.0, "endSec": 4.5 }
  ],
  "explanation": "Penjelasan singkat alasan urutan dalam Bahasa Indonesia"
}`;

    let result: any = null;
    for (const modelName of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
      try {
        result = await genai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.05 },
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
    // Extract JSON robustly
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

    // Validate and sanitize orderedIndices
    let orderedIndices: number[] = Array.isArray(parsed.orderedIndices)
      ? parsed.orderedIndices.filter((i: any) => typeof i === "number" && i >= 0 && i < n)
      : [];

    // Fill missing indices
    const presentSet = new Set(orderedIndices);
    for (let i = 0; i < n; i++) {
      if (!presentSet.has(i)) orderedIndices.push(i);
    }

    // Validate clip timings
    let clipTimings = Array.isArray(parsed.clipTimings)
      ? parsed.clipTimings.filter(
          (t: any) =>
            typeof t.index === "number" &&
            typeof t.startSec === "number" &&
            typeof t.endSec === "number" &&
            t.endSec > t.startSec &&
            t.index >= 0 && t.index < n
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
      usedVision: hasFrames,
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
    explanation: "Klip dibagi rata (tidak ada data visual).",
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
