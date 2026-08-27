import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";

export const IMAGE_OUTPUT_DIR = path.join(process.cwd(), "data", "veo-images");

// The user's exact non-negotiable rules for every generated storyboard shot —
// reused verbatim (translated context stays intact) so every shot obeys them
// identically, rather than re-derived per call and risking drift.
const STORYBOARD_RULES = `The visual style must be strictly realistic photography or photorealistic renders — no cartoon, illustration, painterly, or artistic styles — and the people, product, setting, and overall look must stay consistent with the attached reference photo; if the shot includes people or human subjects, they must be Indonesian, with Indonesian faces, skin tones, and styling. CRITICAL, NON-NEGOTIABLE REQUIREMENT: this image must contain ZERO text — not a single letter, number, word, or character anywhere in the frame. This means absolutely no script, dialogue, voiceover, narration, captions, subtitles, titles, headlines, taglines, slogans, logos, brand names, watermarks, timestamps, labels, arrows with words, speech bubbles, thought bubbles, signage text, packaging text, screen or UI text, or handwriting — and no lettering rendered, painted, printed, embossed, or baked into the image in any form, whether in focus or blurred in the background. Communicate purely through visuals alone — composition, framing, expression, body language, action, and lighting. If the frame would naturally contain visible text (a sign, a phone screen, a product label), render that surface blank, clean, or out of frame instead.`;

const SHOT_SCHEMA = {
  type: "object",
  properties: {
    shotNumber: { type: "integer" },
    shotType: { type: "string", description: "Kode shot singkat, contoh: 'ECU' (extreme close-up), 'MCU', 'MS', 'WS', 'Macro'" },
    cameraAngle: { type: "string", description: "Sudut kamera, contoh: 'Eye-level', 'Low angle', 'Overhead'" },
    action: { type: "string", description: "Aksi/momen spesifik yang terjadi di shot ini" },
    lighting: { type: "string", description: "Kondisi pencahayaan shot ini" },
    mood: { type: "string", description: "Mood/emosi shot ini, 1-3 kata" },
    imagePrompt: {
      type: "string",
      description: "Prompt Bahasa Inggris SELF-CONTAINED untuk image generation model — deskripsikan subjek, aksi, komposisi, pencahayaan, mood shot ini secara detail dan runtut. JANGAN sertakan instruksi soal 'no text'/'photorealistic'/'Indonesian people' di sini, itu akan ditambahkan otomatis oleh sistem.",
    },
  },
  required: ["shotNumber", "shotType", "cameraAngle", "action", "lighting", "mood", "imagePrompt"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    videoTitle: { type: "string" },
    consistencyProfile: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Deskripsi detail subjek/produk/tempat/orang yang HARUS identik di setiap shot (dari foto referensi)" },
        visualStyle: { type: "string", description: "Gaya visual fotografi yang konsisten di semua shot" },
      },
      required: ["subject", "visualStyle"],
    },
    shots: { type: "array", minItems: 6, maxItems: 8, items: SHOT_SCHEMA },
  },
  required: ["videoTitle", "consistencyProfile", "shots"],
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageMimeType, userContext, apiKey } = await req.json();

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({ error: "API Key Google Gemini belum dikonfigurasi." }, { status: 400 });
    }
    if (!imageBase64) {
      return NextResponse.json({ error: "Foto referensi tidak ditemukan." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const mimeType = imageMimeType || "image/jpeg";
    const imagePart = { inlineData: { mimeType, data: imageBase64 } };

    // ─── Step 1: analyze the reference photo → structured 6-8 shot breakdown ──
    const breakdownPrompt = `Anda adalah sutradara iklan + storyboard artist. Lihat foto referensi yang dilampirkan ini.
${userContext ? `Konteks tambahan dari user: "${userContext}"` : ""}

Buatkan breakdown storyboard iklan berdasarkan foto ini: urutan 6-8 shot yang menceritakan kisah iklan dari hook pembuka sampai payoff produk/tempat di akhir (matches struktur: ECU macro detail → aksi manusia → wide context → produk/momen close-up → payoff/emosi akhir, sesuaikan dengan isi foto).

Aturan:
1. "consistencyProfile.subject": deskripsikan SANGAT detail subjek utama di foto (kalau produk: bentuk, warna, kemasan; kalau tempat: arsitektur, dekorasi, suasana; kalau orang: umur, wajah, pakaian) — ini akan dipakai supaya semua shot konsisten dengan foto asli.
2. Setiap shot: tentukan shotType, cameraAngle, action spesifik, lighting, mood, dan "imagePrompt" (Bahasa Inggris, deskriptif, sebutkan detail dari consistencyProfile.subject supaya konsisten).
3. Shot-shot ini akan digenerate ulang jadi foto baru yang photorealistic (bukan ilustrasi), jadi imagePrompt harus menggambarkan momen/aksi nyata yang bisa difoto.
4. Kalau foto referensi menunjukkan tempat/objek yang sangat spesifik & personal (misal restoran/toko milik user), tetap gambarkan shot-shot yang realistis konsisten dengan tempat itu — jangan ganti jadi tempat generik.`;

    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro"];
    let breakdownText = "";
    let lastErr: any = null;
    for (const mName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mName,
          contents: [{ role: "user", parts: [imagePart, { text: breakdownPrompt }] }],
          config: { temperature: 0.7, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
        });
        if (response?.text) { breakdownText = response.text; break; }
      } catch (err) { lastErr = err; }
    }
    if (!breakdownText) throw lastErr || new Error("Gagal menganalisis foto referensi.");

    const breakdown = JSON.parse(breakdownText);
    const shots: any[] = breakdown.shots || [];
    if (shots.length === 0) throw new Error("Gagal menyusun shot storyboard.");

    // ─── Step 2: generate a real photorealistic image for each shot, in parallel ──
    await mkdir(IMAGE_OUTPUT_DIR, { recursive: true });
    const imageModels = ["gemini-2.5-flash-image", "gemini-3-pro-image", "nano-banana-pro-preview"];

    const shotResults = await Promise.all(
      shots.map(async (shot) => {
        const fullPrompt = `${shot.imagePrompt}\n\nConsistent subject reference: ${breakdown.consistencyProfile?.subject || ""}. Visual style: ${breakdown.consistencyProfile?.visualStyle || "photorealistic"}.\n\n${STORYBOARD_RULES}`;

        for (const mName of imageModels) {
          try {
            const imgResponse = await ai.models.generateContent({
              model: mName,
              contents: [{ role: "user", parts: [imagePart, { text: fullPrompt }] }],
            });
            const parts = imgResponse?.candidates?.[0]?.content?.parts || [];
            const inline = parts.find((p: any) => p.inlineData?.data)?.inlineData;
            if (inline?.data) {
              const id = randomUUID();
              const ext = inline.mimeType === "image/png" ? "png" : "jpg";
              await writeFile(path.join(IMAGE_OUTPUT_DIR, `${id}.${ext}`), Buffer.from(inline.data, "base64"));
              return { ...shot, imageUrl: `/api/video-ai/image-file/${id}.${ext}`, imageBase64: inline.data, imageMimeType: inline.mimeType || "image/jpeg" };
            }
          } catch (err: any) {
            console.warn(`[image-storyboard] shot ${shot.shotNumber} failed on ${mName}:`, err?.message?.slice(0, 200));
          }
        }
        return { ...shot, imageUrl: null, imageBase64: null, imageMimeType: null, error: "Gagal generate gambar shot ini." };
      })
    );

    return NextResponse.json({
      success: true,
      storyboard: {
        videoTitle: breakdown.videoTitle,
        consistencyProfile: breakdown.consistencyProfile,
        shots: shotResults,
      },
    });
  } catch (error: any) {
    console.error("Error generating image storyboard:", error);
    return NextResponse.json({ error: error.message || "Gagal membuat storyboard dari foto." }, { status: 500 });
  }
}
